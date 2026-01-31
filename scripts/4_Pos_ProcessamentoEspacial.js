// =============================================================================
// Cruzamento com área urbana (classe 24) e pós-processamento para 3 saídas:
// 1) RF (semi-supervisionado)   2) K-means (não superv.)   3) HAND (5m,4m,3m)
// =============================================================================

var dados_espaciais = ee.Image('/raster_dados_espaciais_inundacao')
var region = dados_espaciais.select(['distancia']).geometry(0)

var imagemClassificadaRF = ee.Image('/img_ClassificadaSemiSuperv_risco_inund')
var imagemClusterizadaKmeans = ee.Image('/img_ClassificadaNaoSuperv_risco_inund')
var imagemClassificadaSlicedHAND_5m = ee.Image('/img_ClassificadaSliced_risco_inund_alt5m')
var imagemClassificadaSlicedHAND_4m = ee.Image('/img_ClassificadaSliced_risco_inund_alt4m')
var imagemClassificadaSlicedHAND_3m = ee.Image('/img_ClassificadaSliced_risco_inund_alt3m')

// Máscara de uso e cobertura da terra (seleciona apenas áreas urbanas - classe 24)
var uso_cobert_terra = dados_espaciais.select('usocobersolo_classification_2022')
var valores_unicos_class_anos = ee.List([24]) //classe de area urbana (24)
var mascara_usocobersolo = uso_cobert_terra.remap(valores_unicos_class_anos, valores_unicos_class_anos)
mascara_usocobersolo = uso_cobert_terra.updateMask(mascara_usocobersolo)
//Map.addLayer(mascara_usocobersolo,{},'Mascara de uso e cobertura da terra',false)
mascara_usocobersolo = mascara_usocobersolo.gt(0).selfMask().unmask(0).rename('classification')
//Map.addLayer(mascara_usocobersolo,{},"Mascara uso e cober Solo",false)

// ---- Cruzamento da classificação supervisionada (RF) com a máscara urbana ----
var imgClassificada_UsoCobertSolo = imagemClassificadaRF.add(mascara_usocobersolo)
imgClassificada_UsoCobertSolo = imgClassificada_UsoCobertSolo.gte(2).selfMask()
Map.addLayer(imgClassificada_UsoCobertSolo,{bands: ["classification"],opacity: 1, palette: ["ff1f12"]},'Img Classificada cruzamento com UsoCober',false)
//------

// ---- Cruzamento da clusterização (K-means) com a máscara urbana ----
// Função para obter o ID do cluster correspondente ao ponto de referência
var get_IdCluster = function(clusterizedImage,point) {
    var ID = clusterizedImage.reduceRegion({
    reducer:ee.Reducer.mean(),
    geometry:point,
    scale:10
    });
    ID = ID.get('cluster');
    return ee.Number.parse(ID);
}
var risco_ClusterId = get_IdCluster(imagemClusterizadaKmeans,point_Cluster);
//print("risco_ClusterId",risco_ClusterId)
mascara_usocobersolo = mascara_usocobersolo.rename('cluster')
var imagemClusterizada_UsoCobertSolo = imagemClusterizadaKmeans.eq(risco_ClusterId.getInfo()).add(mascara_usocobersolo)
imagemClusterizada_UsoCobertSolo = imagemClusterizada_UsoCobertSolo.gte(2).selfMask()
Map.addLayer(imagemClusterizada_UsoCobertSolo,{bands: ["cluster"],opacity: 1, palette: ["ff1f12"]},'Img Clusterizada cruzamento com UsoCober',false)
//------

// ---- Cruzamento da classificação HAND (5 m) com a máscara urbana ----
var imagemClassificadaHAND_suav_5m = imagemClassificadaSlicedHAND_5m.gte(-9999).clip(region)
//Map.addLayer(imagemClassificadaHAND_suav)
var imgClassificadaHAND_UsoCobertSolo_5m = imagemClassificadaHAND_suav_5m.add(mascara_usocobersolo).gte(2).selfMask()
//imgClassificadaHAND_UsoCobertSolo = imgClassificadaHAND_UsoCobertSolo_5m.gte(2).selfMask()
Map.addLayer(imgClassificadaHAND_UsoCobertSolo_5m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'Img ClassificadaHAND 5m cruzamento com UsoCober',false)
// ---- Cruzamento da classificação HAND (4 m) com a máscara urbana ----
var imagemClassificadaHAND_suav_4m = imagemClassificadaSlicedHAND_4m.gte(-9999).clip(region)
var imgClassificadaHAND_UsoCobertSolo_4m = imagemClassificadaHAND_suav_4m.add(mascara_usocobersolo).gte(2).selfMask()
Map.addLayer(imgClassificadaHAND_UsoCobertSolo_4m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'Img ClassificadaHAND 4m cruzamento com UsoCober',false)
// ---- Cruzamento da classificação HAND (3 m) com a máscara urbana ----
var imagemClassificadaHAND_suav_3m = imagemClassificadaSlicedHAND_3m.gte(-9999).clip(region)
var imgClassificadaHAND_UsoCobertSolo_3m = imagemClassificadaHAND_suav_3m.add(mascara_usocobersolo).gte(2).selfMask()
Map.addLayer(imgClassificadaHAND_UsoCobertSolo_3m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'Img ClassificadaHAND 3m cruzamento com UsoCober',false)
//------

//Calcula objetos por conectividade, área por objeto (m²), aplica limiar mínimo
//e adiciona camadas de visualização ao mapa.
function hotspotsPorArea(imgBinaria, rotuloCamadaPrefix, areaMin_m2, oitoConectado, maxSizePx) {
  var _max = maxSizePx || 1024;
  var connKernel = ee.Kernel.plus(1); // 4-conectado (cruz)

  // 1) Rotulagem por conectividade
  var rotulada = imgBinaria.connectedComponents({
    connectedness: connKernel,
    maxSize: _max
  });

  // 2) Número de pixels por objeto
  var nPixels = rotulada.select('labels').connectedPixelCount({
    maxSize: _max,
    eightConnected: !!oitoConectado // false → 4-conectado; true → 8-conectado
  });

  // 3) Área por objeto (m²)
  var area = nPixels.multiply(ee.Image.pixelArea());

  // 4) Máscara por área mínima e hotspots finais
  var mascaraArea = area.gte(areaMin_m2);
  var hotspots = rotulada.updateMask(mascaraArea);

  // 5) Visualizações (mesmo estilo do seu código original)
  Map.addLayer(rotulada.randomVisualizer(), {}, rotuloCamadaPrefix + ' — Objetos', false);
  Map.addLayer(nPixels, { min: 1, max: _max }, rotuloCamadaPrefix + ' — Nº de pixels', false);
  Map.addLayer(area, { min: 0, max: 3e6, palette: ['0000FF', 'FF00FF'] }, rotuloCamadaPrefix + ' — Área (m²)', false);
  Map.addLayer(hotspots, {}, rotuloCamadaPrefix + ' — Hotspots (≥ ' + areaMin_m2 + ' m²)', true);

  return { rotulada: rotulada, nPixels: nPixels, area: area, hotspots: hotspots };
}

// =============================================================================
// Aplique a função às três imagens (RF, K-means, HAND ≤ 5 m)
// =============================================================================

// Limiar de área: 3.000 m² | conectividade 4 (como no seu trecho) | maxSize 1024
var AREA_MIN_M2 = 3000;
var OITO_CON = false;
var MAXSIZE = 1024;

// 1) Imagem Classificada (RF) ∧ Urbano
var img_ClassificadaRF_HotSpot = hotspotsPorArea(
  imgClassificada_UsoCobertSolo,          // imagem binária selfMask
  'Classificada (RF) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);

// 2) Imagem Clusterizada (K-means) ∧ Urbano
var img_ClassificadaKMeans_HotSpot = hotspotsPorArea(
  imagemClusterizada_UsoCobertSolo,       // imagem binária selfMask
  'Clusterizada (K-means) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);

// 3) Imagem Classificada HAND (≤ 3 m) ∧ Urbano
var img_ClassificadaSlicedHAND_3m_HotSpot = hotspotsPorArea(
  imgClassificadaHAND_UsoCobertSolo_3m,   // imagem binária selfMask
  'Classificada HAND (≤3 m) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);
// 4) Imagem Classificada HAND (≤ 4 m) ∧ Urbano
var img_ClassificadaSlicedHAND_4m_HotSpot = hotspotsPorArea(
  imgClassificadaHAND_UsoCobertSolo_4m,   // imagem binária selfMask
  'Classificada HAND (≤4 m) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);
// 5) Imagem Classificada HAND (≤ 5 m) ∧ Urbano
var img_ClassificadaSlicedHAND_5m_HotSpot = hotspotsPorArea(
  imgClassificadaHAND_UsoCobertSolo_5m,   // imagem binária selfMask
  'Classificada HAND (≤5 m) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);

Map.addLayer(setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação')),{},"Setores CRPM")
//-------

//Exportação
var assetPathEnchente = '/assets/ProjetoEnchente/'; 

Export.image.toAsset({
      image:img_ClassificadaRF_HotSpot.hotspots.select(['classification']),
      description:"img_ClassificadaRF_HotSpot",
      assetId:assetPathEnchente+"imgPosClassificadaSemiSuperv_riscoInundacao",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaRF_HotSpot.hotspots.select(['classification']),
  description: 'imgPosClassificadaSemiSuperv_riscoInundacao', 
  folder:"projetoEnchenteAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaKMeans_HotSpot.hotspots.select(['cluster']),
      description:"img_ClassificadaKMeans_HotSpot",
      assetId:assetPathEnchente+"imgPosClassificadaNaoSuperv_riscoInundacao",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaKMeans_HotSpot.hotspots.select(['cluster']),
  description: 'imgPosClassificadaNaoSuperv_riscoInundacao', 
  folder:"projetoEnchenteAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaSlicedHAND_3m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassificadaSlicedHAND_3m_HotSpot",
      assetId:assetPathEnchente+"imgPosClassificadaSlicedHAND_3m_riscoInundacao",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaSlicedHAND_3m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassificadaSlicedHAND_3m_HotSpot', 
  folder:"projetoEnchenteAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaSlicedHAND_4m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassificadaSlicedHAND_4m_HotSpot",
      assetId:assetPathEnchente+"imgPosClassificadaSlicedHAND_4m_riscoInundacao",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaSlicedHAND_4m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassificadaSlicedHAND_4m_HotSpot', 
  folder:"projetoEnchenteAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaSlicedHAND_5m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassificadaSlicedHAND_5m_HotSpot",
      assetId:assetPathEnchente+"imgPosClassificadaSlicedHAND_5m_riscoInundacao",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaSlicedHAND_5m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassificadaSlicedHAND_5m_HotSpot', 
  folder:"projetoEnchenteAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});