// =============================================================================
// Crossover with urban area (class 24) and post-processing for 3 outputs:
// 1) RF (semi-supervised)   2) K-means (unsupervised)   3) HAND (5m,4m,3m)
// =============================================================================

var dados_espaciais = ee.Image('/spatial_data_raster_flood')
var region = dados_espaciais.select(['distance']).geometry(0)

var imagemClassificadaRF = ee.Image('/img_SemiSupervisedClassified_flood_risk')
var imagemClusterizadaKmeans = ee.Image('/img_UnsupervisedClassified_flood_risk')
var imagemClassificadaSlicedHAND_5m = ee.Image('/img_SlicedClassified_flood_risk_height5m')
var imagemClassificadaSlicedHAND_4m = ee.Image('/img_SlicedClassified_flood_risk_height4m')
var imagemClassificadaSlicedHAND_3m = ee.Image('/img_SlicedClassified_flood_risk_height3m')

// Land use and land cover mask (select only urban areas - class 24)
var uso_cobert_terra = dados_espaciais.select('landcover_classification_2022')
var valores_unicos_class_anos = ee.List([24]) //urban area class (24)
var mascara_usocobersolo = uso_cobert_terra.remap(valores_unicos_class_anos, valores_unicos_class_anos)
mascara_usocobersolo = uso_cobert_terra.updateMask(mascara_usocobersolo)
//Map.addLayer(mascara_usocobersolo,{},'Land use and land cover mask',false)
mascara_usocobersolo = mascara_usocobersolo.gt(0).selfMask().unmask(0).rename('classification')
//Map.addLayer(mascara_usocobersolo,{},"Land cover mask",false)

// ---- Supervised classification (RF) crossover with urban mask ---------------
var imgClassificada_UsoCobertSolo = imagemClassificadaRF.add(mascara_usocobersolo)
imgClassificada_UsoCobertSolo = imgClassificada_UsoCobertSolo.gte(2).selfMask()
Map.addLayer(imgClassificada_UsoCobertSolo,{bands: ["classification"],opacity: 1, palette: ["ff1f12"]},'Classified Img crossover with LandCover',false)
//------

// ---- Clustering (K-means) crossover with urban mask -------------------------
// Function to get cluster ID corresponding to reference point
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
Map.addLayer(imagemClusterizada_UsoCobertSolo,{bands: ["cluster"],opacity: 1, palette: ["ff1f12"]},'Clustered Img crossover with LandCover',false)
//------

// ---- HAND classification (5 m) crossover with urban mask --------------------
var imagemClassificadaHAND_suav_5m = imagemClassificadaSlicedHAND_5m.gte(-9999).clip(region)
//Map.addLayer(imagemClassificadaHAND_suav)
var imgClassificadaHAND_UsoCobertSolo_5m = imagemClassificadaHAND_suav_5m.add(mascara_usocobersolo).gte(2).selfMask()
//imgClassificadaHAND_UsoCobertSolo = imgClassificadaHAND_UsoCobertSolo_5m.gte(2).selfMask()
Map.addLayer(imgClassificadaHAND_UsoCobertSolo_5m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'HAND Classified Img 5m crossover with LandCover',false)
// ---- HAND classification (4 m) crossover with urban mask --------------------
var imagemClassificadaHAND_suav_4m = imagemClassificadaSlicedHAND_4m.gte(-9999).clip(region)
var imgClassificadaHAND_UsoCobertSolo_4m = imagemClassificadaHAND_suav_4m.add(mascara_usocobersolo).gte(2).selfMask()
Map.addLayer(imgClassificadaHAND_UsoCobertSolo_4m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'HAND Classified Img 4m crossover with LandCover',false)
// ---- HAND classification (3 m) crossover with urban mask --------------------
var imagemClassificadaHAND_suav_3m = imagemClassificadaSlicedHAND_3m.gte(-9999).clip(region)
var imgClassificadaHAND_UsoCobertSolo_3m = imagemClassificadaHAND_suav_3m.add(mascara_usocobersolo).gte(2).selfMask()
Map.addLayer(imgClassificadaHAND_UsoCobertSolo_3m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'HAND Classified Img 3m crossover with LandCover',false)
//------

//Calculates objects by connectivity, area per object (m²), applies minimum threshold
//and adds visualization layers to map.
function hotspotsPorArea(imgBinaria, rotuloCamadaPrefix, areaMin_m2, oitoConectado, maxSizePx) {
  var _max = maxSizePx || 1024;
  var connKernel = ee.Kernel.plus(1); // 4-connected (cross)

  // 1) Labeling by connectivity
  var rotulada = imgBinaria.connectedComponents({
    connectedness: connKernel,
    maxSize: _max
  });

  // 2) Number of pixels per object
  var nPixels = rotulada.select('labels').connectedPixelCount({
    maxSize: _max,
    eightConnected: !!oitoConectado // false → 4-connected; true → 8-connected
  });

  // 3) Area per object (m²)
  var area = nPixels.multiply(ee.Image.pixelArea());

  // 4) Mask by minimum area and final hotspots
  var mascaraArea = area.gte(areaMin_m2);
  var hotspots = rotulada.updateMask(mascaraArea);

  // 5) Visualizations (same style as your original code)
  Map.addLayer(rotulada.randomVisualizer(), {}, rotuloCamadaPrefix + ' — Objects', false);
  Map.addLayer(nPixels, { min: 1, max: _max }, rotuloCamadaPrefix + ' — Nº pixels', false);
  Map.addLayer(area, { min: 0, max: 3e6, palette: ['0000FF', 'FF00FF'] }, rotuloCamadaPrefix + ' — Area (m²)', false);
  Map.addLayer(hotspots, {}, rotuloCamadaPrefix + ' — Hotspots (≥ ' + areaMin_m2 + ' m²)', true);

  return { rotulada: rotulada, nPixels: nPixels, area: area, hotspots: hotspots };
}

// =============================================================================
// Apply function to three images (RF, K-means, HAND ≤ 5 m)
// =============================================================================

// Area threshold: 3,000 m² | 4-connectivity (as in your snippet) | maxSize 1024
var AREA_MIN_M2 = 3000;
var OITO_CON = false;
var MAXSIZE = 1024;

// 1) Classified Image (RF) ∧ Urban
var img_ClassificadaRF_HotSpot = hotspotsPorArea(
  imgClassificada_UsoCobertSolo,          // selfMask binary image
  'Classified (RF) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);

// 2) Clustered Image (K-means) ∧ Urban
var img_ClassificadaKMeans_HotSpot = hotspotsPorArea(
  imagemClusterizada_UsoCobertSolo,       // selfMask binary image
  'Clustered (K-means) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);

// 3) HAND Classified Image (≤ 3 m) ∧ Urban
var img_ClassificadaSlicedHAND_3m_HotSpot = hotspotsPorArea(
  imgClassificadaHAND_UsoCobertSolo_3m,   // selfMask binary image
  'HAND Classified (≤3 m) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);
// 4) HAND Classified Image (≤ 4 m) ∧ Urban
var img_ClassificadaSlicedHAND_4m_HotSpot = hotspotsPorArea(
  imgClassificadaHAND_UsoCobertSolo_4m,   // selfMask binary image
  'HAND Classified (≤4 m) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);
// 5) HAND Classified Image (≤ 5 m) ∧ Urban
var img_ClassificadaSlicedHAND_5m_HotSpot = hotspotsPorArea(
  imgClassificadaHAND_UsoCobertSolo_5m,   // selfMask binary image
  'HAND Classified (≤5 m) — Hotspots',
  AREA_MIN_M2,
  OITO_CON,
  MAXSIZE
);

Map.addLayer(setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação')),{},"CRPM Sectors")
//-------

//Export
var assetPathEnchente = '/assets/FloodProject/'; 

Export.image.toAsset({
      image:img_ClassificadaRF_HotSpot.hotspots.select(['classification']),
      description:"img_ClassificadaRF_HotSpot",
      assetId:assetPathEnchente+"imgPostSemiSupervisedClassified_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaRF_HotSpot.hotspots.select(['classification']),
  description: 'imgPostSemiSupervisedClassified_floodRisk', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaKMeans_HotSpot.hotspots.select(['cluster']),
      description:"img_ClassificadaKMeans_HotSpot",
      assetId:assetPathEnchente+"imgPostUnsupervisedClassified_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaKMeans_HotSpot.hotspots.select(['cluster']),
  description: 'imgPostUnsupervisedClassified_floodRisk', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaSlicedHAND_3m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassificadaSlicedHAND_3m_HotSpot",
      assetId:assetPathEnchente+"imgPostSlicedClassifiedHAND_3m_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaSlicedHAND_3m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassificadaSlicedHAND_3m_HotSpot', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaSlicedHAND_4m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassificadaSlicedHAND_4m_HotSpot",
      assetId:assetPathEnchente+"imgPostSlicedClassifiedHAND_4m_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaSlicedHAND_4m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassificadaSlicedHAND_4m_HotSpot', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassificadaSlicedHAND_5m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassificadaSlicedHAND_5m_HotSpot",
      assetId:assetPathEnchente+"imgPostSlicedClassifiedHAND_5m_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassificadaSlicedHAND_5m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassificadaSlicedHAND_5m_HotSpot', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});
