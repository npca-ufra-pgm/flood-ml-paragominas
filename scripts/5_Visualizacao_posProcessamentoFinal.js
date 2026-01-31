/***************************************************************
 * PROJETO: Mapeamento de Suscetibilidade à Inundação Urbana
 * PLATAFORMA: Google Earth Engine (JavaScript)
 * AUTOR: Gilberto Junior
 * DESCRIÇÃO:
 *  - Cálculo de áreas de risco de inundação em regiões urbanas
 *  - Avaliação de classificações (não supervisionada, semi-supervisionada e HAND)
 *  - Geração de mapa de suscetibilidade à inundação
 *  - Exportação de resultados (tabelas, imagens e GIF)
 ***************************************************************/

//Função de Cálculo de área (em hectares)
var areaCalculate = function(img,geom){
      //A imagem de entrada é multiplicada por uma imagem.pixelArea
      //A imagem.pixelArea possui o valor onde cada pixel é a área desse pixel em metros quadrados.
      var areaImg = img.multiply(ee.Image.pixelArea());
    
      //Realiza a soma da imagem multiplicada da área da imagem resultante dentro da geometria especificada (geom). 
      //Isso é feito usando um redutor do Earth Engine ee.Reducer.sum().
      var area = areaImg.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: geom,
        maxPixels: 1e11,
        scale:10
      })
      
      //Transforma o valor somado em hectares e arredonda para retirar os digitos após a virgula
      var areaValue = ee.Number(area.values().get(0)).divide(10000) 
      
      //print("Area em hectare:",areaValue)
      return areaValue
    }

//Mascara de uso e cobertura da terra
var dados_espaciais = ee.Image('/raster_dados_espaciais_inundacao')
var uso_cobert_terra = dados_espaciais.select('usocobersolo_classification_2022')
var valores_unicos_class_anos = ee.List([24]) //classe de area urbana (24), Campo Alagado e Área Pantanosa, Rios e Lagos e Oceano
//print(valores_unicos_class_anos)
var mascara_usocobersolo = uso_cobert_terra.remap(valores_unicos_class_anos, valores_unicos_class_anos)
mascara_usocobersolo = uso_cobert_terra.updateMask(mascara_usocobersolo)
//Map.addLayer(mascara_usocobersolo,{},'Mascara de uso e cobertura da terra',false)
mascara_usocobersolo = mascara_usocobersolo.gt(0).selfMask().unmask(0).rename('setor_risco')
//Map.addLayer(mascara_usocobersolo,{},"Mascara uso e cober Solo",false)

var setor_risco_inund = setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação'))
var img_area_setor_risco_inund = ee.Image(1).rename("setor_risco").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//print(img_area_setor_risco_inund)
//Map.addLayer(img_area_setor_risco_inund)

var img_area_setor_risco_inund_UsoCobertSolo = img_area_setor_risco_inund.add(mascara_usocobersolo)
img_area_setor_risco_inund_UsoCobertSolo = img_area_setor_risco_inund_UsoCobertSolo.gte(2).selfMask()
//Map.addLayer(img_area_setor_risco_inund_UsoCobertSolo,{bands: ["setor_risco"],opacity: 1, palette: ["ff1f12"]},'setor inund em região urbana',false)

var ajusteImg_paraCalculoArea = ee.Image.constant(1).clip(ajuste_areaderiscoinun)
//Map.addLayer(ajusteImg_paraCalculoArea)

img_area_setor_risco_inund_UsoCobertSolo = img_area_setor_risco_inund_UsoCobertSolo.blend(ajusteImg_paraCalculoArea)
//Map.addLayer(img_area_setor_risco_inund_UsoCobertSolo)

var area_setor_risco_inund = areaCalculate(img_area_setor_risco_inund_UsoCobertSolo,setor_risco_inund)
print("Area dos setores de risco em regiões urbanas", area_setor_risco_inund)

var imagemClusterizada_riscoInundacao = ee.Image('/imgPosClassificadaNaoSuperv_riscoInundacao')
var imagemClusterizada_riscoInundacao_preenchida = imagemClusterizada_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClusterizada_riscoInundacao_area = imagemClusterizada_riscoInundacao_preenchida
.select("cluster").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//Map.addLayer(imagemClusterizada_riscoInundacao_area,{},'imagemClusterizada_riscoInundacao')
var area_clusterizada_setor_risco_inund = areaCalculate(imagemClusterizada_riscoInundacao_area,setor_risco_inund)
print('Area classificada nãosuperv (clusterizada) sobre setores de risco:', area_clusterizada_setor_risco_inund)

var imagemClassificada_riscoInundacao = ee.Image('/imgPosClassificadaSemiSuperv_riscoInundacao')
var imagemClassificada_riscoInundacao_preenchida = imagemClassificada_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificada_riscoInundacao_area = imagemClassificada_riscoInundacao_preenchida
.select("classification").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//Map.addLayer(imagemClassificada_riscoInundacao_area,{},'imagemClassificada_riscoInundacao')
var area_classificada_setor_risco_inund = areaCalculate(imagemClassificada_riscoInundacao_area,setor_risco_inund)
print('Area classificada semisuperv sobre setores de risco:',area_classificada_setor_risco_inund)


var imagemClassificadaHAND3m_riscoInundacao = ee.Image('/imgPosClassificadaSlicedHAND_3m_riscoInundacao')
var imagemClassificadaHAND3m_riscoInundacao_preenchida = imagemClassificadaHAND3m_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificadaHAND3m_riscoInundacao_area = imagemClassificadaHAND3m_riscoInundacao_preenchida
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
var area_classificadaHAND3m_setor_risco_inund = areaCalculate(imagemClassificadaHAND3m_riscoInundacao_area,setor_risco_inund)
print('Area classificada sliced (HAND 3metros) sobre setores de risco:', area_classificadaHAND3m_setor_risco_inund)

var imagemClassificadaHAND4m_riscoInundacao = ee.Image('/imgPosClassificadaSlicedHAND_4m_riscoInundacao')
var imagemClassificadaHAND4m_riscoInundacao_preenchida = imagemClassificadaHAND4m_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificadaHAND4m_riscoInundacao_area = imagemClassificadaHAND4m_riscoInundacao_preenchida
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
var area_classificadaHAND4m_setor_risco_inund = areaCalculate(imagemClassificadaHAND4m_riscoInundacao_area,setor_risco_inund)
print('Area classificada sliced (HAND 4metros) sobre setores de risco:', area_classificadaHAND4m_setor_risco_inund)

var imagemClassificadaHAND5m_riscoInundacao = ee.Image('/imgPosClassificadaSlicedHAND_5m_riscoInundacao')
var imagemClassificadaHAND5m_riscoInundacao_preenchida = imagemClassificadaHAND5m_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificadaHAND5m_riscoInundacao_area = imagemClassificadaHAND5m_riscoInundacao_preenchida
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//Map.addLayer(imagemClassificada_riscoInundacao_area,{},'imagemClassificada_riscoInundacao')
var area_classificadaHAND5m_setor_risco_inund = areaCalculate(imagemClassificadaHAND5m_riscoInundacao_area,setor_risco_inund)
print('Area clssificada sliced (HAND 5metros) sobre setores de risco:', area_classificadaHAND5m_setor_risco_inund)


var porcentagem_ClassificationHAND_3m = (area_classificadaHAND3m_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Porcentagem de acerto da classificação sliced (HAND 3 metros) sobre região de Inundação do CPRM",porcentagem_ClassificationHAND_3m)
var porcentagem_ClassificationHAND_4m = (area_classificadaHAND4m_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Porcentagem de acerto da classificação sliced (HAND 4 metros) sobre região de Inundação do CPRM",porcentagem_ClassificationHAND_4m)
var porcentagem_ClassificationHAND_5m = (area_classificadaHAND5m_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Porcentagem de acerto da classificação sliced (HAND 5 metros) sobre região de Inundação do CPRM",porcentagem_ClassificationHAND_5m)

var porcentagem_Cluster = (area_clusterizada_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Porcentagem de acerto da classificação nãosuperv (clusterização) sobre região de Inundação do CPRM",porcentagem_Cluster)
var porcentagem_Classification = (area_classificada_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Porcentagem de acerto da classificação semisuperv (randforest) sobre região de Inundação do CPRM",porcentagem_Classification)

//Exportar dados para identificar separabilidade das classes no python.
var setor_risco_geometr_buffer1000 = setor_risco.geometry().buffer(1700,0)// para deixar a area de classificação menor basta diminuir esse valor de buffer
//Map.addLayer(setor_risco_geometr_buffer1000,{},"setor_risco_Inundacao_CRPM 1000m buffer",false)

var dados_espaciais_comclassificacoes = dados_espaciais.addBands(imagemClusterizada_riscoInundacao.select('cluster').unmask(0))
dados_espaciais_comclassificacoes = dados_espaciais_comclassificacoes.addBands(imagemClassificadaHAND5m_riscoInundacao.select('classification_hand').unmask(0))
dados_espaciais_comclassificacoes = dados_espaciais_comclassificacoes.addBands(imagemClassificada_riscoInundacao.select('classification').unmask(0))

var bandas_avalSeparabilidade  = ['elevacao', 'distancia', 'declividade', 'condutividade_hidraulica_solo','hand','twi','classification','cluster','classification_hand']
dados_espaciais_comclassificacoes = dados_espaciais_comclassificacoes.select(bandas_avalSeparabilidade).clip(setor_risco_geometr_buffer1000)
//Map.addLayer(dados_espaciais_comclassificacoes)

var dadosAvaliacaoSeparabilidade = dados_espaciais_comclassificacoes.sample({
  //numPixels: 4000,
  region: setor_risco_geometr_buffer1000,
  scale: 10,                 
  geometries: true
});

Export.table.toDrive({
		collection: dadosAvaliacaoSeparabilidade,
	  description: "dadosAvaliacaoSeparabilidade",
	  folder:"projetoEnchenteAssets",
})

// Visualize no console
//Map.addLayer(dadosAvaliacaoSeparabilidade, {color: 'blue'}, 'Pontos dos Pixels de amostras',false)
print('Quantidade de amostras de separabilidade',dadosAvaliacaoSeparabilidade.size())

//---------------

var setores_inun_posClassif = imagemClassificada_riscoInundacao.select('classification').connectedComponents({
  connectedness: ee.Kernel.plus(1),
  maxSize: 1024//128
});
//print(setores_inun_posClassif)

//----------------

//Mapa de calor de riscos
var buffer_setor_risco_geometr = setor_risco.geometry().buffer(200,0)
//Map.addLayer(buffer_setor_risco_geometr,{},"setor_risco_Inundacao_CRPM 200m buffer",false)

var dados_espaciais = ee.Image('/raster_dados_espaciais_inundacao')
//print(dados_espaciais)
var bandas  = ['elevacao', 'distancia', 'declividade', 'condutividade_hidraulica_solo','hand','twi','usocobersolo_classification_2022']
var elevacao = dados_espaciais.select(['elevacao'])

// Reduz a imagem dentro da região do buffer para encontrar o valor máximo
var maxElevacao = elevacao.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: buffer_setor_risco_geometr,
  scale: 10,  // ajuste conforme a resolução do seu raster
  maxPixels: 1e10
});

// Imprime o valor máximo no console
var maxElevacao_value = maxElevacao.get('elevacao').getInfo()
//print('Valor máximo de elevação no buffer:', maxElevacao_value)

var mascara = elevacao.lte(maxElevacao_value)  // lte = less than or equal

// Passo 3: Aplica a máscara à imagem de elevação
var elevacao_mascarada = elevacao.updateMask(mascara)

//Map.addLayer(elevacao_mascarada, {min: 0, max: maxElevacao_value, palette: ['blue', 'green', 'yellow']}, 'Elevação mascarada ≤ valor máximo')

var uso_cobert_solo = dados_espaciais.select(['usocobersolo_classification_2022']).eq(24)

var elevacao_mascarada_final = elevacao_mascarada.updateMask(uso_cobert_solo);

//Map.addLayer(elevacao_mascarada_final, {min: 0, max: maxElevacao_value, palette: ['blue', 'green', 'yellow']},  'Elevação mascarada + uso do solo = 24');

var dados_espaciais_bandasDeInteresse = dados_espaciais.select([
  'elevacao', 
  'distancia', 
  'declividade', 
  'condutividade_hidraulica_solo',
  'hand',
  'twi'
]);

// Aplica a máscara final (de elevacao + uso do solo) a todas essas bandas
var img_dados_espaciais_bandasDeInteresse = dados_espaciais_bandasDeInteresse.updateMask(elevacao_mascarada_final.mask());

// Visualiza (por exemplo, a banda 'distancia')
//Map.addLayer(img_dados_espaciais_bandasDeInteresse,{},"Bandas selecionadas")
//print(img_dados_espaciais_bandasDeInteresse)

/*
elevacao_norm      = (elevacao - minElev) / (maxElev - minElev);
dist_rio_norm      = (dist_rio - minDist) / (maxDist - minDist);
declividade_norm   = (declividade - minDecliv) / (maxDecliv - minDecliv);
condutividade_norm = (condutividade - minCondut) / (maxCondut - minCondut);
hand_norm = (hand - minHand) / (maxHand - minHand);
twi_norm = (twi - minTwi) / (maxTwi - minTwi);
*/

// Calcula os valores min e max de cada banda dentro do buffer
var stats = img_dados_espaciais_bandasDeInteresse.reduceRegion({
  reducer: ee.Reducer.minMax(),
  scale: 10,
  maxPixels: 1e10
});
//print(stats)

// Extrai os valores numéricos
var minElev   = ee.Number(stats.get('elevacao_min'));
var maxElev   = ee.Number(stats.get('elevacao_max'));
var minDist   = ee.Number(stats.get('distancia_min'));
var maxDist   = ee.Number(stats.get('distancia_max'));
var minDecliv = ee.Number(stats.get('declividade_min'));
var maxDecliv = ee.Number(stats.get('declividade_max'));
var minCondut = ee.Number(stats.get('condutividade_hidraulica_solo_min'));
var maxCondut = ee.Number(stats.get('condutividade_hidraulica_solo_max'));
var minHand = ee.Number(stats.get('hand_min'));
var maxHand = ee.Number(stats.get('hand_max'));
var minTwi = ee.Number(stats.get('twi_min'));
var maxTwi = ee.Number(stats.get('twi_max'));

// Normalizações usando .expression()
var elevacao_norm = img_dados_espaciais_bandasDeInteresse.expression(
  '(e - minE) / (maxE - minE)', {
    'e': img_dados_espaciais_bandasDeInteresse.select('elevacao'),
    'minE': minElev,
    'maxE': maxElev
  }).rename('elevacao_norm');

var distancia_norm = img_dados_espaciais_bandasDeInteresse.expression(
  '(d - minD) / (maxD - minD)', {
    'd': img_dados_espaciais_bandasDeInteresse.select('distancia'),
    'minD': minDist,
    'maxD': maxDist
  }).rename('distancia_norm');

var declividade_norm = img_dados_espaciais_bandasDeInteresse.expression(
  '(s - minS) / (maxS - minS)', {
    's': img_dados_espaciais_bandasDeInteresse.select('declividade'),
    'minS': minDecliv,
    'maxS': maxDecliv
  }).rename('declividade_norm');

var condutividade_norm =img_dados_espaciais_bandasDeInteresse.expression(
  '(c - minC) / (maxC - minC)', {
    'c': img_dados_espaciais_bandasDeInteresse.select('condutividade_hidraulica_solo'),
    'minC': minCondut,
    'maxC': maxCondut
  }).rename('condutividade_norm');
  
var hand_norm =img_dados_espaciais_bandasDeInteresse.expression(
  '(h - minH) / (maxH - minH)', {
    'h': img_dados_espaciais_bandasDeInteresse.select('hand'),
    'minH': minHand,
    'maxH': maxHand
  }).rename('hand_norm');
  
var twi_norm =img_dados_espaciais_bandasDeInteresse.expression(
  '(t - minT) / (maxT - minT)', {
    't': img_dados_espaciais_bandasDeInteresse.select('twi'),
    'minT': minTwi,
    'maxT': maxTwi
  }).rename('twi_norm');    

// Junta todas as bandas normalizadas
var imagem_normalizada = elevacao_norm
  .addBands(distancia_norm)
  .addBands(declividade_norm)
  .addBands(condutividade_norm)
  .addBands(hand_norm)
  .addBands(twi_norm);

var pesos = ee.FeatureCollection('/importancia_atributos_inund')
var props = ee.Feature(pesos.first()).toDictionary();
//print('Todas as propriedades:', props);

var import_declividad =  ee.Number(props.get('declividade'))
var import_elevac =  ee.Number(props.get('elevacao'))
var import_distanc=  ee.Number(props.get('distancia'))
var import_condutivid =  ee.Number(props.get('condutividade_hidraulica_solo'))
var import_hand =  ee.Number(props.get('hand'))
var import_twi =  ee.Number(props.get('twi'))

var soma_pesos = import_condutivid.add(import_declividad).add(import_distanc).add(import_elevac).add(import_hand).add(import_twi)
//print(soma_pesos)
  
var peso_declividade = import_declividad.divide(soma_pesos)
var peso_elevacao = import_elevac.divide(soma_pesos)
var peso_distancia = import_distanc.divide(soma_pesos)
var peso_condutivid_hidraulica_solo = import_condutivid.divide(soma_pesos)
var peso_hand = import_hand.divide(soma_pesos)
var peso_twi = import_twi.divide(soma_pesos)
print("Pesos das features: (peso_declividade,peso_elevacao,peso_distancia,peso_condutivid_hidraulica_solo,peso_hand,peso_twi) ", peso_declividade,peso_elevacao,peso_distancia,peso_condutivid_hidraulica_solo,peso_hand,peso_twi)

var img_risco_inundacao = imagem_normalizada.expression(
  'peso_de * (1 - de) + peso_el * (1 - el) + peso_di * (1 - di) + peso_co * (1 - co) + peso_ha * (1 - ha) + peso_tw * (tw)', {
    'de': imagem_normalizada.select('declividade_norm'),
    'el': imagem_normalizada.select('elevacao_norm'),
    'di': imagem_normalizada.select('distancia_norm'),
    'co': imagem_normalizada.select('condutividade_norm'),
    'ha': imagem_normalizada.select('hand_norm'),
    'tw': imagem_normalizada.select('twi_norm'),
    'peso_de': peso_declividade,
    'peso_el': peso_elevacao,
    'peso_di': peso_distancia,
    'peso_co': peso_condutivid_hidraulica_solo,
    'peso_ha': peso_hand,
    'peso_tw': peso_twi,
  }).rename('suscetibilidade_inundacao');

//{min: 0.34, max: 0.96, palette: ['#1a9850', '#fee08b', '#d73027']}
//Map.addLayer(img_risco_inundacao,imageVisParam2,"Mapa Calor - Risco Inundacao")
img_risco_inundacao = img_risco_inundacao.focal_mean({radius: 1, units: 'pixels', kernel: ee.Kernel.square(1)})

var imageVisParam3 ={ bands: ["suscetibilidade_inundacao"],
max: 0.9534484538232613,
min: 0.3699895127314622,
opacity: 1,
palette: ["22dd0e","f9fe31","d70c0c"]}

Map.addLayer(img_risco_inundacao,imageVisParam3,"Mapa Calor - Risco Inundacao (suav by mean)")

Map.addLayer(setores_inun_posClassif.randomVisualizer(), null, 'Zonas de Risco');
//Map.addLayer(img_risco_inundacao.gte(0.83),imageVisParam2,"Mapa Calor - Risco Inundacao nivel 83%")

var mascaraRisco = imagemClassificada_riscoInundacao.select('classification');
mascaraRisco = mascaraRisco.updateMask(mascaraRisco.mask());
var img_risco_inundacao_masked = img_risco_inundacao.select('suscetibilidade_inundacao').updateMask(mascaraRisco);   
Map.addLayer(img_risco_inundacao_masked,imageVisParam3,"Mapa Calor sobre Risco Inundacao")

// Calcula estatisticas sobre imagem gerada
var mimmax_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.minMax(),
  scale: 10,
  maxPixels: 1e10
});
print("mimmax_img_risco",mimmax_img_risco)

var mean_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.mean(),
  scale: 10,
  maxPixels: 1e10
});
print("mean_img_risco",mean_img_risco)

var median_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.median(),
  scale: 10,
  maxPixels: 1e10
});
print("median_img_risco",median_img_risco)

var stdDev_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.stdDev(),
  scale: 10,
  maxPixels: 1e10
});
print("stdDev_img_risco",stdDev_img_risco)

var variance_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.variance(),
  scale: 10,
  maxPixels: 1e10
});
print("variance_img_risco",variance_img_risco)

var kurtosis_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.kurtosis(),
  scale: 10,
  maxPixels: 1e10
});
print("kurtosis_img_risco",kurtosis_img_risco)

var skew_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.skew(),
  scale: 10,
  maxPixels: 1e10
});
print("skew_img_risco",skew_img_risco)

var percentile_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.percentile([0, 25, 50,75, 100]),
  scale: 10,
  maxPixels: 1e10
});
print("percentile_img_risco",percentile_img_risco)

Map.addLayer(setor_risco_inund,{},"Setores de risco do CPRM")

// 5. Exibir o histograma no console
var hist = ui.Chart.image.histogram({
  //image: img_risco_inundacao_masked,//
  image: img_risco_inundacao,
  region: geometry,
  scale: 10,  // resolução espacial
  //minBucketWidth: 10  // largura mínima do bucket do histograma
}).setOptions({
  title: 'Histogram - FSIVI (Flood Susceptibility Index based on Variable Importance)',
  hAxis: {title: 'Pixel value'},
  vAxis: {title: 'Frequency'},
  series: [{color: 'purple'}]
});
print(hist);

// Importar biblioteca de texto do geetools 
var Text = require('users/gena/packages:text');
// Lista de níveis de 97 até 83
var niveis = ee.List.sequence(99, 75, -1);
// Usa iterate para construir a lista de imagens
var image_forGif_list = niveis.iterate(function(nivel, lista) {
  nivel = ee.Number(nivel);
  var label = ee.String('Nivel de risco ')
  .cat(nivel.format('%d'))
  .cat('%');

  lista = ee.List(lista);
  var nivel_prob = nivel.divide(100);
  var image_forGif = img_risco_inundacao.gte(nivel_prob).clip(geometry_forgif).focal_mean({radius: 1, units: 'pixels', kernel: ee.Kernel.square(1)});
  //var image_forGif = img_risco_inundacao_masked.gte(nivel_prob).clip(geometry_forgif).focal_mean({radius: 1, units: 'pixels', kernel: ee.Kernel.square(1)});

  var text = Text.draw(label, point_text, 10, {
    fontSize: 32,
    textColor: 'FFFFFF',
    outlineColor: '000000',
    outlineWidth: 2
  });
  var image_forGif_text = image_forGif.visualize({
    palette: ["22dd0e", "f9fe31", "d70c0c"]
  }).blend(text);
  return lista.add(image_forGif_text);
}, ee.List([]));
// Converte o resultado em ImageCollection
image_forGif_list = ee.List(image_forGif_list);
var collection_imgs = ee.ImageCollection(image_forGif_list);
print(collection_imgs);
//Map.addLayer(collection_imgs.first(), {}, 'Primeira imagem com texto');

var videoArgs = {
  dimensions: 1024,
  region: geometry_forgif,
  framesPerSecond: 1,
  format: 'gif',
  min: 0.3699895127314622,
  max: 0.9534484538232613,
  palette: ["22dd0e","f9fe31","d70c0c"]
};
//visuzalização prévia em baixa resolução
print(ui.Thumbnail(collection_imgs))//, videoArgs));

// Exporta como vídeo 
Export.video.toDrive({
  collection: collection_imgs,
  description: 'video_riscoinduncacao_PGM',
  fileNamePrefix: 'riscoInundacao_animation',
  framesPerSecond: 1,
  region: geometry_forgif,
  dimensions: 1024,
  folder:"projetoEnchenteAssets",
});

var assetPathEnchente = '/assets/ProjetoEnchente/'; 

Export.image.toAsset({
      image:img_risco_inundacao,
      description:"Mapa_calor_de_risco_inundacao_posClassif",
      assetId:assetPathEnchente+"Mapa_calor_de_risco_inundacao_posClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_risco_inundacao,
  description: 'Mapa_calor_de_risco_inundacao_posClassif', 
  folder:"projetoEnchenteAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_risco_inundacao_masked,
      description:"Mapa_calor_sobre_risco_inundacao_masked_posClassif",//Mapa Calor sobre Risco Inundacao
      assetId:assetPathEnchente+"Mapa_calor_sobre_risco_inundacao_masked_posClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_risco_inundacao_masked,
  description: 'Mapa_calor_sobre_risco_inundacao_masked_posClassif', 
  folder:"projetoEnchenteAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:setores_inun_posClassif.randomVisualizer(),
      description:"Zonas_risco_inun_posClassif",
      assetId:assetPathEnchente+"Zonas_risco_inun_posClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: setores_inun_posClassif.randomVisualizer(),
  description: 'Zonas_risco_inun_posClassif', 
  folder:"projetoEnchenteAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

var regioes_de_destaques = ee.FeatureCollection([
regioes_atencao_inicioDaInund99,
regioes_atencao_inicioDaInund96,
regioes_atencao_inicioDaInund95,
regioes_atencao_inicioDaInund90,
regioes_atencao_inicioDaInund89,
regioes_atencao_inicioDaInund88
])
Map.addLayer(regioes_de_destaques,{},"regioes_de_destaques")
Export.table.toDrive({
  collection: regioes_de_destaques,
  description: 'regioes_de_destaques',
  folder:"projetoEnchenteAssets",
});




