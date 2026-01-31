// =============================================================================
// Unsupervised classification by Clustering and Classification by HAND threshold slicing
// Base set: multiband raster "spatial_data_flood"
// =============================================================================

// --------------------------- Load stack --------------------------------------
// Contains bands like: elevation, distance, slope, hand, (…)
var spatialData = ee.Image(
  '/raster_spatial_data_flood');//include raster data with bands (features)
Map.addLayer(spatialData, {}, 'spatial_data', false);
print('Spatial stack (input):', spatialData);

// Select bands used in clustering
var bands = ['elevation', 'distance', 'slope', 'hand'];
spatialData = spatialData.select(bands);

// Work region: geometry derived from "distance" band
// NOTE: maintain consistency with project ROI (can swap for `geometry`).
var region = spatialData.select('distance').geometry(0);

// ------------------- Unsupervised clustering (XMeans) ------------------------
// Source: Weka XMeans (k varying up to 10, starting from 2 clusters).
// Explores spatial patterns without prior labeling.
var newData = ee.FeatureCollection('/datasetFlood_toAsset'); //include dataset with balanced samples

var clusterer = ee.Clusterer.wekaXMeans(2, 10).train(newData, bands);

var clusteredImage = spatialData.cluster(clusterer);
// Random visual for inspection
Map.addLayer(
  clusteredImage.clip(region).randomVisualizer(),
  {},
  'Clustering (XMeans)',
  false
);

// ----------------------- Post-cluster smoothing ------------------------------
// Reduce "salt-and-pepper noise" (isolated pixels).
// Strategy: focal mode 3x3 over "cluster" band.
var clusteredImageSmooth = clusteredImage
  .unmask(0) // avoid nodata in neighborhood
  .focal_mode({
    radius: 1,           // 1 pixel -> 3x3 window
    units: 'pixels'
  });


// Binary palette for visualization (assuming up to 2 clusters; adjust according to output)
Map.addLayer(
  clusteredImageSmooth,
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

// Reuse the "hand" band from the loaded stack (consistent with clustering).
var hand = spatialData.select('hand').clip(region)
  .rename('hand')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(hand, handVis, 'HAND (m) — from stack', false);

// Slicing by height threshold above drainage
var palettes = require('users/gena/packages:palettes');

var floodHeight_5m = 5; // m — pixels with HAND <= 5 m
var maskHand = hand.gte(0).and(hand.lte(floodHeight_5m));
// Binary classification by HAND (0/1) for potentially floodable area
var classifiedHand_5m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classifiedHand_5m,
  { palette: palettes.cb.Blues[7], min: 0, max: floodHeight_5m },
  'Classified by HAND ≤ ' + floodHeight_5m + ' m',
  true);
  
var floodHeight_4m = 4; // m — pixels with HAND <= 4 m
var maskHand = hand.gte(0).and(hand.lte(floodHeight_4m));
// Binary classification by HAND (0/1) for potentially floodable area
var classifiedHand_4m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classifiedHand_4m,
  { palette: palettes.cb.Blues[7], min: 0, max: floodHeight_4m },
  'Classified by HAND ≤ ' + floodHeight_4m + ' m',
  true);

var floodHeight_3m = 3; // m — pixels with HAND <= 3 m
var maskHand = hand.gte(0).and(hand.lte(floodHeight_3m));
// Binary classification by HAND (0/1) for potentially floodable area
var classifiedHand_3m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classifiedHand_3m,
  { palette: palettes.cb.Blues[7], min: 0, max: floodHeight_3m },
  'Classified by HAND ≤ ' + floodHeight_3m + ' m',
  true);

// ----------------------- Reference layer (CPRM) ------------------------------
Map.addLayer(
  risk_sector.filter(ee.Filter.eq('tipolo_g1', 'Inundação')), //import risk sectors  
  {},
  'Risk Sectors — CPRM'
);

// -------------------------- Export cluster -----------------------------------
var assetPathFlood = '/assets/FloodProject/'; // path to asset repository

Export.image.toAsset({
  image: clusteredImageSmooth.select('cluster'), // export only cluster band
  assetId: assetPathFlood + 'img_ClassifiedUnsuperv_flood_risk',
  description: 'img_ClassifiedUnsuperv_flood_risk',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: clusteredImageSmooth.select('cluster'),
  description: 'img_ClassifiedUnsuperv_flood_risk', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

// -------------------- Export HAND classification -----------------------------
Export.image.toAsset({
  image: classifiedHand_5m,
  assetId: assetPathFlood + ('img_ClassifiedSliced_flood_risk_height' + floodHeight_5m + 'm'),
  description: 'img_ClassifiedSliced_flood_risk_height' + floodHeight_5m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classifiedHand_5m,
  description: 'img_ClassifiedSliced_flood_risk_height' + floodHeight_5m + 'm', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
  image: classifiedHand_4m,
  assetId: assetPathFlood + ('img_ClassifiedSliced_flood_risk_height' + floodHeight_4m + 'm'),
  description: 'img_ClassifiedSliced_flood_risk_height' + floodHeight_4m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classifiedHand_4m,
  description: 'img_ClassifiedSliced_flood_risk_height' + floodHeight_4m + 'm', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
  image: classifiedHand_3m,
  assetId: assetPathFlood + ('img_ClassifiedSliced_flood_risk_height' + floodHeight_3m + 'm'),
  description: 'img_ClassifiedSliced_flood_risk_height' + floodHeight_3m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classifiedHand_3m,
  description: 'img_ClassifiedSliced_flood_risk_height' + floodHeight_3m + 'm', 
  folder:"floodProjectAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});
