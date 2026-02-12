// =============================================================================
// Euclidean distance calculation to rivers/streams in Paragominas
// Author: GILBERTO N S JR
// Description: creates buffer around drainage network, rasterizes as "target"
//              and calculates Euclidean distance per pixel to these targets.
// External dependencies (Assets):
//  - /TrechosDrenagemParagominas_Intersesct
// Pre-conditions (defined outside this snippet):
//  - roi: ee.Geometry/ee.FeatureCollection of region of interest. A rectangle over the urban area.
//  - corregoRioUrainPgm: ee.FeatureCollection with additional streams.
// Note: base projection taken from Dynamic World V1 (2024).
// =============================================================================

// ---- General parameters -----------------------------------------------------
var tamanhoPixel = 10; // [m] target resolution for reprojection and export

// ---- Drainage network (rivers/streams) --------------------------------------
// Region of interest: drainage sections of Paragominas near the urban area.
var drenagensPgm = ee.FeatureCollection(
  '/TrechosDrenagemParagominas_Intersesct'
);
Map.addLayer(drenagensPgm, {}, 'Drainage (rivers)', false)

var drenagensComCorregos = roi.intersection(drenagensPgm, 0.5)
drenagensComCorregos = drenagensComCorregos.union(corrego_rio_urain_pgm)
Map.addLayer(drenagensComCorregos, {}, 'Drainage (rivers + streams)', false)

// ---- Buffer around watercourses ---------------------------------------------
var drenagensBuffer  = drenagensComCorregos.buffer(tamanhoPixel,0.5)
Map.addLayer(drenagensBuffer, {}, 'Drainage (buffer)', false)

// ---- Base projection from Dynamic World (2024) ------------------------------
// Import Dynamic World, aggregate median of 2024 and get projection to standardize.
var imgDw2024  = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(roi).filterDate("2024-01-01","2025-01-01").median().select('label').clip(roi)
var projBase  = imgDw2024.projection()

// ---- Auxiliary image: zero background + "target" painted with 1 -------------
// distance() requires a "target" raster (1) amidst zeros to calculate distance to target pixels.
var imgFundoZero  = imgDw2024.multiply(0).reproject(projBase,null, tamanhoPixel)
var imgAlvoRios  = imgFundoZero.paint(drenagensBuffer,1)

// ---- Euclidean distance to rivers/streams (in meters) -----------------------
//Kernel application to identify distance from each pixel to PGM rivers
var distanciaMaximaM = 2500// adjust according to range need//4096//2048//512//50000;  
var kernelEuclidiano = ee.Kernel.euclidean(distanciaMaximaM, 'meters')
var distEuclidiana  = imgAlvoRios.distance(kernelEuclidiano).rename("RiverDistance_m")

//Distance visualization
var visDist  = {min: 0, max: distanciaMaximaM}
Map.addLayer(distEuclidiana.clip(roi), visDist, 'Euclidean distance to rivers');

// ---- Base path for export ---------------------------------------------------
var caminhoAsset  = '/assets/Projeto/'; // Add asset export path

// ---- Export: vectors (unified rivers + streams) -----------------------------
//Export vectors as rasters of PGM rivers with addition of identified streams
Export.table.toAsset({
  collection:ee.FeatureCollection([ee.Feature(drenagensComCorregos)]), 
  description: 'rivers_streams_pgm',
  assetId: caminhoAsset+'rivers_streams_pgm'
})

Export.table.toDrive({
  collection:ee.FeatureCollection([ee.Feature(drenagensComCorregos)]), 
  description: 'rivers_streams_pgm',
  folder:"floodProjectAssets"
})

// ---- Export: distance raster in meters --------------------------------------
Export.image.toAsset({
  image: distEuclidiana,
  assetId:caminhoAsset+'river_distance',
  description: 'river_distance', 
  scale: tamanhoPixel, 
  region: roi, 
  crs: 'EPSG:4326', 
  maxPixels: 1e10
});
