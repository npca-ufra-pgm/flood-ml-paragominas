/***************************************************************
 * PROJECT: Urban Flood Susceptibility Mapping
 * PLATFORM: Google Earth Engine (JavaScript)
 * AUTHOR: Gilberto Junior
 * DESCRIPTION:
 *  - Calculation of flood risk areas in urban regions
 *  - Evaluation of classifications (unsupervised, semi-supervised and HAND)
 *  - Generation of flood susceptibility map
 *  - Export of results (tables, images and GIF)
 ***************************************************************/

//Area calculation function (in hectares)
var areaCalculate = function(img,geom){
      //The input image is multiplied by an image.pixelArea
      //The image.pixelArea has the value where each pixel is the area of that pixel in square meters.
      var areaImg = img.multiply(ee.Image.pixelArea());
    
      //Performs the sum of the multiplied image of the resulting image area within the specified geometry (geom).
      //This is done using an Earth Engine reducer ee.Reducer.sum().
      var area = areaImg.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: geom,
        maxPixels: 1e11,
        scale:10
      })
      
      //Transforms the summed value into hectares and rounds to remove digits after decimal point
      var areaValue = ee.Number(area.values().get(0)).divide(10000) 
      
      //print("Area in hectares:",areaValue)
      return areaValue
    }

//Land use and land cover mask
var dados_espaciais = ee.Image('/spatial_data_raster_flood')
var uso_cobert_terra = dados_espaciais.select('landcover_classification_2022')
var valores_unicos_class_anos = ee.List([24]) //urban area class (24), Wetland and Swamp Area, Rivers and Lakes and Ocean
//print(valores_unicos_class_anos)
var mascara_usocobersolo = uso_cobert_terra.remap(valores_unicos_class_anos, valores_unicos_class_anos)
mascara_usocobersolo = uso_cobert_terra.updateMask(mascara_usocobersolo)
//Map.addLayer(mascara_usocobersolo,{},'Land use and land cover mask',false)
mascara_usocobersolo = mascara_usocobersolo.gt(0).selfMask().unmask(0).rename('risk_sector')
//Map.addLayer(mascara_usocobersolo,{},"Land cover mask",false)

var setor_risco_inund = setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação'))
var img_area_setor_risco_inund = ee.Image(1).rename("risk_sector").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//print(img_area_setor_risco_inund)
//Map.addLayer(img_area_setor_risco_inund)

var img_area_setor_risco_inund_UsoCobertSolo = img_area_setor_risco_inund.add(mascara_usocobersolo)
img_area_setor_risco_inund_UsoCobertSolo = img_area_setor_risco_inund_UsoCobertSolo.gte(2).selfMask()
//Map.addLayer(img_area_setor_risco_inund_UsoCobertSolo,{bands: ["risk_sector"],opacity: 1, palette: ["ff1f12"]},'flood sector in urban region',false)

var ajusteImg_paraCalculoArea = ee.Image.constant(1).clip(ajuste_areaderiscoinun)
//Map.addLayer(ajusteImg_paraCalculoArea)

img_area_setor_risco_inund_UsoCobertSolo = img_area_setor_risco_inund_UsoCobertSolo.blend(ajusteImg_paraCalculoArea)
//Map.addLayer(img_area_setor_risco_inund_UsoCobertSolo)

var area_setor_risco_inund = areaCalculate(img_area_setor_risco_inund_UsoCobertSolo,setor_risco_inund)
print("Area of risk sectors in urban regions", area_setor_risco_inund)

var imagemClusterizada_riscoInundacao = ee.Image('/imgPostUnsupervisedClassified_floodRisk')
var imagemClusterizada_riscoInundacao_preenchida = imagemClusterizada_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClusterizada_riscoInundacao_area = imagemClusterizada_riscoInundacao_preenchida
.select("cluster").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//Map.addLayer(imagemClusterizada_riscoInundacao_area,{},'imagemClusterizada_riscoInundacao')
var area_clusterizada_setor_risco_inund = areaCalculate(imagemClusterizada_riscoInundacao_area,setor_risco_inund)
print('Unsupervised classified area (clustered) over risk sectors:', area_clusterizada_setor_risco_inund)

var imagemClassificada_riscoInundacao = ee.Image('/imgPostSemiSupervisedClassified_floodRisk')
var imagemClassificada_riscoInundacao_preenchida = imagemClassificada_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificada_riscoInundacao_area = imagemClassificada_riscoInundacao_preenchida
.select("classification").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//Map.addLayer(imagemClassificada_riscoInundacao_area,{},'imagemClassificada_riscoInundacao')
var area_classificada_setor_risco_inund = areaCalculate(imagemClassificada_riscoInundacao_area,setor_risco_inund)
print('Semi-supervised classified area over risk sectors:',area_classificada_setor_risco_inund)


var imagemClassificadaHAND3m_riscoInundacao = ee.Image('/imgPostSlicedClassifiedHAND_3m_floodRisk')
var imagemClassificadaHAND3m_riscoInundacao_preenchida = imagemClassificadaHAND3m_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificadaHAND3m_riscoInundacao_area = imagemClassificadaHAND3m_riscoInundacao_preenchida
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
var area_classificadaHAND3m_setor_risco_inund = areaCalculate(imagemClassificadaHAND3m_riscoInundacao_area,setor_risco_inund)
print('Sliced classified area (HAND 3 meters) over risk sectors:', area_classificadaHAND3m_setor_risco_inund)

var imagemClassificadaHAND4m_riscoInundacao = ee.Image('/imgPostSlicedClassifiedHAND_4m_floodRisk')
var imagemClassificadaHAND4m_riscoInundacao_preenchida = imagemClassificadaHAND4m_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificadaHAND4m_riscoInundacao_area = imagemClassificadaHAND4m_riscoInundacao_preenchida
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
var area_classificadaHAND4m_setor_risco_inund = areaCalculate(imagemClassificadaHAND4m_riscoInundacao_area,setor_risco_inund)
print('Sliced classified area (HAND 4 meters) over risk sectors:', area_classificadaHAND4m_setor_risco_inund)

var imagemClassificadaHAND5m_riscoInundacao = ee.Image('/imgPostSlicedClassifiedHAND_5m_floodRisk')
var imagemClassificadaHAND5m_riscoInundacao_preenchida = imagemClassificadaHAND5m_riscoInundacao.blend(ajusteImg_paraCalculoArea);
var imagemClassificadaHAND5m_riscoInundacao_area = imagemClassificadaHAND5m_riscoInundacao_preenchida
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(setor_risco_inund)
//Map.addLayer(imagemClassificada_riscoInundacao_area,{},'imagemClassificada_riscoInundacao')
var area_classificadaHAND5m_setor_risco_inund = areaCalculate(imagemClassificadaHAND5m_riscoInundacao_area,setor_risco_inund)
print('Sliced classified area (HAND 5 meters) over risk sectors:', area_classificadaHAND5m_setor_risco_inund)


var porcentagem_ClassificationHAND_3m = (area_classificadaHAND3m_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Percentage accuracy of sliced classification (HAND 3 meters) over CPRM Flooding region",porcentagem_ClassificationHAND_3m)
var porcentagem_ClassificationHAND_4m = (area_classificadaHAND4m_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Percentage accuracy of sliced classification (HAND 4 meters) over CPRM Flooding region",porcentagem_ClassificationHAND_4m)
var porcentagem_ClassificationHAND_5m = (area_classificadaHAND5m_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Percentage accuracy of sliced classification (HAND 5 meters) over CPRM Flooding region",porcentagem_ClassificationHAND_5m)

var porcentagem_Cluster = (area_clusterizada_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Percentage accuracy of unsupervised classification (clustering) over CPRM Flooding region",porcentagem_Cluster)
var porcentagem_Classification = (area_classificada_setor_risco_inund.divide(area_setor_risco_inund)).multiply(100)
print("Percentage accuracy of semi-supervised classification (random forest) over CPRM Flooding region",porcentagem_Classification)

//Export data to identify class separability in python.
var setor_risco_geometr_buffer1000 = setor_risco.geometry().buffer(1700,0)// to make classification area smaller just decrease this buffer value
//Map.addLayer(setor_risco_geometr_buffer1000,{},"risk_sector_Flooding_CRPM 1000m buffer",false)

var dados_espaciais_comclassificacoes = dados_espaciais.addBands(imagemClusterizada_riscoInundacao.select('cluster').unmask(0))
dados_espaciais_comclassificacoes = dados_espaciais_comclassificacoes.addBands(imagemClassificadaHAND5m_riscoInundacao.select('classification_hand').unmask(0))
dados_espaciais_comclassificacoes = dados_espaciais_comclassificacoes.addBands(imagemClassificada_riscoInundacao.select('classification').unmask(0))

var bandas_avalSeparabilidade  = ['elevation', 'distance', 'slope', 'soil_hydraulic_conductivity','hand','twi','classification','cluster','classification_hand']
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
	  description: "separabilityEvaluationData",
	  folder:"floodProjectAssets",
})

// Visualize in console
//Map.addLayer(dadosAvaliacaoSeparabilidade, {color: 'blue'}, 'Sample pixel points',false)
print('Number of separability samples',dadosAvaliacaoSeparabilidade.size())

//---------------

var setores_inun_posClassif = imagemClassificada_riscoInundacao.select('classification').connectedComponents({
  connectedness: ee.Kernel.plus(1),
  maxSize: 1024//128
});
//print(setores_inun_posClassif)

//----------------

//Risk heat map
var buffer_setor_risco_geometr = setor_risco.geometry().buffer(200,0)
//Map.addLayer(buffer_setor_risco_geometr,{},"risk_sector_Flooding_CRPM 200m buffer",false)

var dados_espaciais = ee.Image('/spatial_data_raster_flood')
//print(dados_espaciais)
var bandas  = ['elevation', 'distance', 'slope', 'soil_hydraulic_conductivity','hand','twi','landcover_classification_2022']
var elevacao = dados_espaciais.select(['elevation'])

// Reduce image within buffer region to find maximum value
var maxElevacao = elevacao.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: buffer_setor_risco_geometr,
  scale: 10,  // adjust according to your raster resolution
  maxPixels: 1e10
});

// Print maximum value in console
var maxElevacao_value = maxElevacao.get('elevation').getInfo()
//print('Maximum elevation value in buffer:', maxElevacao_value)

var mascara = elevacao.lte(maxElevacao_value)  // lte = less than or equal

// Step 3: Apply mask to elevation image
var elevacao_mascarada = elevacao.updateMask(mascara)

//Map.addLayer(elevacao_mascarada, {min: 0, max: maxElevacao_value, palette: ['blue', 'green', 'yellow']}, 'Masked elevation ≤ maximum value')

var uso_cobert_solo = dados_espaciais.select(['landcover_classification_2022']).eq(24)

var elevacao_mascarada_final = elevacao_mascarada.updateMask(uso_cobert_solo);

//Map.addLayer(elevacao_mascarada_final, {min: 0, max: maxElevacao_value, palette: ['blue', 'green', 'yellow']},  'Masked elevation + land use = 24');

var dados_espaciais_bandasDeInteresse = dados_espaciais.select([
  'elevation', 
  'distance', 
  'slope', 
  'soil_hydraulic_conductivity',
  'hand',
  'twi'
]);

// Apply final mask (elevation + land use) to all these bands
var img_dados_espaciais_bandasDeInteresse = dados_espaciais_bandasDeInteresse.updateMask(elevacao_mascarada_final.mask());

// Visualize (for example, 'distance' band)
//Map.addLayer(img_dados_espaciais_bandasDeInteresse,{},"Selected bands")
//print(img_dados_espaciais_bandasDeInteresse)

/*
elevation_norm      = (elevation - minElev) / (maxElev - minElev);
river_dist_norm      = (river_dist - minDist) / (maxDist - minDist);
slope_norm   = (slope - minSlope) / (maxSlope - minSlope);
conductivity_norm = (conductivity - minConduct) / (maxConduct - minConduct);
hand_norm = (hand - minHand) / (maxHand - minHand);
twi_norm = (twi - minTwi) / (maxTwi - minTwi);
*/

// Calculate min and max values of each band within buffer
var stats = img_dados_espaciais_bandasDeInteresse.reduceRegion({
  reducer: ee.Reducer.minMax(),
  scale: 10,
  maxPixels: 1e10
});
//print(stats)

// Extract numeric values
var minElev   = ee.Number(stats.get('elevation_min'));
var maxElev   = ee.Number(stats.get('elevation_max'));
var minDist   = ee.Number(stats.get('distance_min'));
var maxDist   = ee.Number(stats.get('distance_max'));
var minDecliv = ee.Number(stats.get('slope_min'));
var maxDecliv = ee.Number(stats.get('slope_max'));
var minCondut = ee.Number(stats.get('soil_hydraulic_conductivity_min'));
var maxCondut = ee.Number(stats.get('soil_hydraulic_conductivity_max'));
var minHand = ee.Number(stats.get('hand_min'));
var maxHand = ee.Number(stats.get('hand_max'));
var minTwi = ee.Number(stats.get('twi_min'));
var maxTwi = ee.Number(stats.get('twi_max'));

// Normalizations using .expression()
var elevacao_norm = img_dados_espaciais_bandasDeInteresse.expression(
  '(e - minE) / (maxE - minE)', {
    'e': img_dados_espaciais_bandasDeInteresse.select('elevation'),
    'minE': minElev,
    'maxE': maxElev
  }).rename('elevation_norm');

var distancia_norm = img_dados_espaciais_bandasDeInteresse.expression(
  '(d - minD) / (maxD - minD)', {
    'd': img_dados_espaciais_bandasDeInteresse.select('distance'),
    'minD': minDist,
    'maxD': maxDist
  }).rename('distance_norm');

var declividade_norm = img_dados_espaciais_bandasDeInteresse.expression(
  '(s - minS) / (maxS - minS)', {
    's': img_dados_espaciais_bandasDeInteresse.select('slope'),
    'minS': minDecliv,
    'maxS': maxDecliv
  }).rename('slope_norm');

var condutividade_norm =img_dados_espaciais_bandasDeInteresse.expression(
  '(c - minC) / (maxC - minC)', {
    'c': img_dados_espaciais_bandasDeInteresse.select('soil_hydraulic_conductivity'),
    'minC': minCondut,
    'maxC': maxCondut
  }).rename('conductivity_norm');
  
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

// Join all normalized bands
var imagem_normalizada = elevacao_norm
  .addBands(distancia_norm)
  .addBands(declividade_norm)
  .addBands(condutividade_norm)
  .addBands(hand_norm)
  .addBands(twi_norm);

var pesos = ee.FeatureCollection('/attribute_importance_flood')
var props = ee.Feature(pesos.first()).toDictionary();
//print('All properties:', props);

var import_declividad =  ee.Number(props.get('slope'))
var import_elevac =  ee.Number(props.get('elevation'))
var import_distanc=  ee.Number(props.get('distance'))
var import_condutivid =  ee.Number(props.get('soil_hydraulic_conductivity'))
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
print("Feature weights: (slope_weight,elevation_weight,distance_weight,hydraulic_conductivity_weight,hand_weight,twi_weight) ", peso_declividade,peso_elevacao,peso_distancia,peso_condutivid_hidraulica_solo,peso_hand,peso_twi)

var img_risco_inundacao = imagem_normalizada.expression(
  'slope_w * (1 - sl) + elev_w * (1 - el) + dist_w * (1 - di) + cond_w * (1 - co) + hand_w * (1 - ha) + twi_w * (tw)', {
    'sl': imagem_normalizada.select('slope_norm'),
    'el': imagem_normalizada.select('elevation_norm'),
    'di': imagem_normalizada.select('distance_norm'),
    'co': imagem_normalizada.select('conductivity_norm'),
    'ha': imagem_normalizada.select('hand_norm'),
    'tw': imagem_normalizada.select('twi_norm'),
    'slope_w': peso_declividade,
    'elev_w': peso_elevacao,
    'dist_w': peso_distancia,
    'cond_w': peso_condutivid_hidraulica_solo,
    'hand_w': peso_hand,
    'twi_w': peso_twi,
  }).rename('flood_susceptibility');

//{min: 0.34, max: 0.96, palette: ['#1a9850', '#fee08b', '#d73027']}
//Map.addLayer(img_risco_inundacao,imageVisParam2,"Heat Map - Flood Risk")
img_risco_inundacao = img_risco_inundacao.focal_mean({radius: 1, units: 'pixels', kernel: ee.Kernel.square(1)})

var imageVisParam3 ={ bands: ["flood_susceptibility"],
max: 0.9534484538232613,
min: 0.3699895127314622,
opacity: 1,
palette: ["22dd0e","f9fe31","d70c0c"]}

Map.addLayer(img_risco_inundacao,imageVisParam3,"Heat Map - Flood Risk (smoothed by mean)")

Map.addLayer(setores_inun_posClassif.randomVisualizer(), null, 'Risk Zones');
//Map.addLayer(img_risco_inundacao.gte(0.83),imageVisParam2,"Heat Map - Flood Risk level 83%")

var mascaraRisco = imagemClassificada_riscoInundacao.select('classification');
mascaraRisco = mascaraRisco.updateMask(mascaraRisco.mask());
var img_risco_inundacao_masked = img_risco_inundacao.select('flood_susceptibility').updateMask(mascaraRisco);   
Map.addLayer(img_risco_inundacao_masked,imageVisParam3,"Heat Map over Flood Risk")

// Calculate statistics on generated image
var mimmax_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.minMax(),
  scale: 10,
  maxPixels: 1e10
});
print("minmax_img_risk",mimmax_img_risco)

var mean_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.mean(),
  scale: 10,
  maxPixels: 1e10
});
print("mean_img_risk",mean_img_risco)

var median_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.median(),
  scale: 10,
  maxPixels: 1e10
});
print("median_img_risk",median_img_risco)

var stdDev_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.stdDev(),
  scale: 10,
  maxPixels: 1e10
});
print("stdDev_img_risk",stdDev_img_risco)

var variance_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.variance(),
  scale: 10,
  maxPixels: 1e10
});
print("variance_img_risk",variance_img_risco)

var kurtosis_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.kurtosis(),
  scale: 10,
  maxPixels: 1e10
});
print("kurtosis_img_risk",kurtosis_img_risco)

var skew_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.skew(),
  scale: 10,
  maxPixels: 1e10
});
print("skew_img_risk",skew_img_risco)

var percentile_img_risco = img_risco_inundacao.reduceRegion({
  reducer: ee.Reducer.percentile([0, 25, 50,75, 100]),
  scale: 10,
  maxPixels: 1e10
});
print("percentile_img_risk",percentile_img_risco)

Map.addLayer(setor_risco_inund,{},"CPRM risk sectors")

// 5. Display histogram in console
var hist = ui.Chart.image.histogram({
  //image: img_risco_inundacao_masked,//
  image: img_risco_inundacao,
  region: geometry,
  scale: 10,  // spatial resolution
  //minBucketWidth: 10  // minimum histogram bucket width
}).setOptions({
  title: 'Histogram - FSIVI (Flood Susceptibility Index based on Variable Importance)',
  hAxis: {title: 'Pixel value'},
  vAxis: {title: 'Frequency'},
  series: [{color: 'purple'}]
});
print(hist);

// Import geetools text library
var Text = require('users/gena/packages:text');
// List of levels from 97 to 83
var niveis = ee.List.sequence(99, 75, -1);
// Use iterate to build image list
var image_forGif_list = niveis.iterate(function(nivel, lista) {
  nivel = ee.Number(nivel);
  var label = ee.String('Risk level ')
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
// Convert result to ImageCollection
image_forGif_list = ee.List(image_forGif_list);
var collection_imgs = ee.ImageCollection(image_forGif_list);
print(collection_imgs);
//Map.addLayer(collection_imgs.first(), {}, 'First image with text');

var videoArgs = {
  dimensions: 1024,
  region: geometry_forgif,
  framesPerSecond: 1,
  format: 'gif',
  min: 0.3699895127314622,
  max: 0.9534484538232613,
  palette: ["22dd0e","f9fe31","d70c0c"]
};
//low resolution preview visualization
print(ui.Thumbnail(collection_imgs))//, videoArgs));

// Export as video
Export.video.toDrive({
  collection: collection_imgs,
  description: 'video_floodrisk_PGM',
  fileNamePrefix: 'floodRisk_animation',
  framesPerSecond: 1,
  region: geometry_forgif,
  dimensions: 1024,
  folder:"floodProjectAssets",
});

var assetPathEnchente = '/assets/FloodProject/'; 

Export.image.toAsset({
      image:img_risco_inundacao,
      description:"heat_map_flood_risk_postClassif",
      assetId:assetPathEnchente+"heat_map_flood_risk_postClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_risco_inundacao,
  description: 'heat_map_flood_risk_postClassif', 
  folder:"floodProjectAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_risco_inundacao_masked,
      description:"heat_map_over_flood_risk_masked_postClassif",//Heat Map over Flood Risk
      assetId:assetPathEnchente+"heat_map_over_flood_risk_masked_postClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_risco_inundacao_masked,
  description: 'heat_map_over_flood_risk_masked_postClassif', 
  folder:"floodProjectAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:setores_inun_posClassif.randomVisualizer(),
      description:"risk_zones_flood_postClassif",
      assetId:assetPathEnchente+"risk_zones_flood_postClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: setores_inun_posClassif.randomVisualizer(),
  description: 'risk_zones_flood_postClassif', 
  folder:"floodProjectAssets",
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
Map.addLayer(regioes_de_destaques,{},"highlighted_regions")
Export.table.toDrive({
  collection: regioes_de_destaques,
  description: 'highlighted_regions',
  folder:"floodProjectAssets",
});
