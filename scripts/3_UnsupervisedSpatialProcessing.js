// =============================================================================
// Unsupervised classification by Clustering and Classification by HAND threshold slicing
// Base dataset: multiband raster "spatial_data_flood"
// =============================================================================

// --------------------------- Load stack --------------------------------------
// Contains bands such as: elevation, distance, slope, hand, (…)
var dadosEspaciais = ee.Image(
  '/spatial_data_raster_flood');//include raster data with bands (features)
Map.addLayer(dadosEspaciais, {}, 'spatial_data', false);
print('Spatial stack (input):', dadosEspaciais);

// Select bands used in clustering
var bandas = ['elevation', 'distance', 'slope', 'hand'];
dadosEspaciais = dadosEspaciais.select(bandas);

// Work region: geometry derived from "distance" band
// NOTE: maintain consistency with project ROI (can swap with `geometry`).
var region = dadosEspaciais.select('distance').geometry(0);

// ------------------- Unsupervised clustering (XMeans) ------------------------
// Source: Weka XMeans (k varying up to 10, starting from 2 clusters).
// Explores spatial patterns without prior labeling.
var dadosNovos = ee.FeatureCollection('/floodDataset_toAsset'); //include dataset with balanced samples

var clusterizador = ee.Clusterer.wekaXMeans(2, 10).train(dadosNovos, bandas);

var imagemClusterizada = dadosEspaciais.cluster(clusterizador);
// Random visualization for inspection
Map.addLayer(
  imagemClusterizada.clip(region).randomVisualizer(),
  {},
  'Clustering (XMeans)',
  false
);

// ----------------------- Post-cluster smoothing ------------------------------
// Reduce "salt-and-pepper" noise (isolated pixels).
// Strategy: focal mode 3x3 over "cluster" band.
var imagemClusterizadaSuav = imagemClusterizada
  .unmask(0) // avoid nodata in neighborhood
  .focal_mode({
    radius: 1,           // 1 pixel -> 3x3 window
    units: 'pixels'
  });


// Binary palette for visualization (assuming up to 2 clusters; adjust according to output)
Map.addLayer(
  imagemClusterizadaSuav,
  {bands: ['cluster'], min: 0, max: 1, palette: ['ffffff', 'ff0606']},
  'Clustered image (smoothed)'
);

// ============================== HAND (slicing) ===============================
// Global 30 m HAND — https://gee-community-catalog.org/projects/hand/
var paletteHand = [
  '023858','006837','1a9850','66bd63','a6d96a','d9ef8b',
  'ffffbf','fee08b','fdae61','f46d43','d73027'
];
var handVis = { min: 1, max: 150, palette: paletteHand };

// Reuse "hand" band from loaded stack (consistent with clustering).
var hand = dadosEspaciais.select('hand').clip(region)
  .rename('hand')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(hand, handVis, 'HAND (m) — from stack', false);

// Slicing by height limit above drainage
var palettes = require('users/gena/packages:palettes');

var alturaInundacao_5m = 5; // m — pixels with HAND <= 5 m
var maskHand = hand.gte(0).and(hand.lte(alturaInundacao_5m));
// Binary classification by HAND (0/1) for potentially floodable area
var classificadaHand_5m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classificadaHand_5m,
  { palette: palettes.cb.Blues[7], min: 0, max: alturaInundacao_5m },
  'Classified by HAND ≤ ' + alturaInundacao_5m + ' m',
  true);
  
var alturaInundacao_4m = 4; // m — pixels with HAND <= 4 m
var maskHand = hand.gte(0).and(hand.lte(alturaInundacao_4m));
// Binary classification by HAND (0/1) for potentially floodable area
var classificadaHand_4m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classificadaHand_4m,
  { palette: palettes.cb.Blues[7], min: 0, max: alturaInundacao_4m },
  'Classified by HAND ≤ ' + alturaInundacao_4m + ' m',
  true);

var alturaInundacao_3m = 3; // m — pixels with HAND <= 3 m
var maskHand = hand.gte(0).and(hand.lte(alturaInundacao_3m));
// Binary classification by HAND (0/1) for potentially floodable area
var classificadaHand_3m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classificadaHand_3m,
  { palette: palettes.cb.Blues[7], min: 0, max: alturaInundacao_3m },
  'Classified by HAND ≤ ' + alturaInundacao_3m + ' m',
  true);

// ----------------------- Reference layer (CPRM) ------------------------------
Map.addLayer(
  setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação')), //import risk sectors
  {},
  'Risk Sectors — CPRM'
);

// -------------------------- Export cluster -----------------------------------
var assetPathEnchente = '/assets/FloodProject/'; // asset repository path

Export.image.toAsset({
  image: imagemClusterizadaSuav.select('cluster'), // export only cluster band
  assetId: assetPathEnchente + 'img_UnsupervisedClassified_flood_risk',
  description: 'img_UnsupervisedClassified_flood_risk',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: imagemClusterizadaSuav.select('cluster'),
  description: 'img_UnsupervisedClassified_flood_risk', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

// -------------------- Export HAND classification -----------------------------
Export.image.toAsset({
  image: classificadaHand_5m,
  assetId: assetPathEnchente + ('img_SlicedClassified_flood_risk_height' + alturaInundacao_5m + 'm'),
  description: 'img_SlicedClassified_flood_risk_height' + alturaInundacao_5m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classificadaHand_5m,
  description: 'img_SlicedClassified_flood_risk_height' + alturaInundacao_5m + 'm', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
  image: classificadaHand_4m,
  assetId: assetPathEnchente + ('img_SlicedClassified_flood_risk_height' + alturaInundacao_4m + 'm'),
  description: 'img_SlicedClassified_flood_risk_height' + alturaInundacao_4m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classificadaHand_4m,
  description: 'img_SlicedClassified_flood_risk_height' + alturaInundacao_4m + 'm', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
  image: classificadaHand_3m,
  assetId: assetPathEnchente + ('img_SlicedClassified_flood_risk_height' + alturaInundacao_3m + 'm'),
  description: 'img_SlicedClassified_flood_risk_height' + alturaInundacao_3m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classificadaHand_3m,
  description: 'img_SlicedClassified_flood_risk_height' + alturaInundacao_3m + 'm', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});
