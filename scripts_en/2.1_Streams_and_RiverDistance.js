// =============================================================================
// Euclidean distance calculation to rivers/streams in Paragominas
// Author: GILBERTO N S JR
// Description: creates buffer around drainage network, rasterizes as "target"
//              and calculates Euclidean distance per pixel to those targets.
// External dependencies (Assets):
//  - /TrechosDrenagemParagominas_Intersesct
// Preconditions (defined outside this snippet):
//  - roi: ee.Geometry/ee.FeatureCollection of region of interest. A rectangle over urban area.
//  - stream_river_urain_pgm: ee.FeatureCollection with additional streams.
// Note: base projection taken from Dynamic World V1 (2024).
// =============================================================================

// ---- General parameters ------------------------------------------------------
var pixelSize = 10; // [m] target resolution for reprojection and export

// ---- Drainage network (rivers/streams) ---------------------------------------
// Region of interest: drainage sections of Paragominas near urban area.
var drainagesPgm = ee.FeatureCollection(
  '/TrechosDrenagemParagominas_Intersesct'
);
Map.addLayer(drainagesPgm, {}, 'Drainages (rivers)', false)

var drainagesWithStreams = roi.intersection(drainagesPgm, 0.5)
drainagesWithStreams = drainagesWithStreams.union(stream_river_urain_pgm)
Map.addLayer(drainagesWithStreams, {}, 'Drainages (rivers + streams)', false)

// ---- Buffer around water courses --------------------------------------------
var drainagesBuffer  = drainagesWithStreams.buffer(pixelSize,0.5)
Map.addLayer(drainagesBuffer, {}, 'Drainages (buffer)', false)

// ---- Base projection from Dynamic World (2024) ------------------------------
// Import Dynamic World, aggregate 2024 median and get projection to standardize.
var imgDw2024  = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(roi).filterDate("2024-01-01","2025-01-01").median().select('label').clip(roi)
var baseProj  = imgDw2024.projection()

// ---- Auxiliary image: zero background + "target" painted with 1 -------------
// distance() requires a "target" raster (1) in the middle of zeros to calculate distance to target pixels.
var imgZeroBackground  = imgDw2024.multiply(0).reproject(baseProj,null, pixelSize)
var imgRiverTarget  = imgZeroBackground.paint(drainagesBuffer,1)

// ---- Euclidean distance to rivers/streams (in meters) -----------------------
//Application of kernel to identify the distance of each pixel to PGM rivers
var maxDistanceM = 2500// adjust according to range needs//4096//2048//512//50000;  
var euclideanKernel = ee.Kernel.euclidean(maxDistanceM, 'meters')
var euclideanDist  = imgRiverTarget.distance(euclideanKernel).rename("RiverDistance_m")

//Visualization of distance 
var visDist  = {min: 0, max: maxDistanceM}
Map.addLayer(euclideanDist.clip(roi), visDist, 'Euclidean distance to rivers');

// ---- Base path for export ---------------------------------------------------
var assetPath  = '/assets/Projeto/'; // Add asset export path

// ---- Export: vectors (unified rivers + streams) -----------------------------
//Export vectors as rasters of PGM rivers with addition of identified streams
Export.table.toAsset({
  collection:ee.FeatureCollection([ee.Feature(drainagesWithStreams)]), 
  description: 'rivers_streams_pgm',
  assetId: assetPath+'rivers_streams_pgm'
})

Export.table.toDrive({
  collection:ee.FeatureCollection([ee.Feature(drainagesWithStreams)]), 
  description: 'rivers_streams_pgm',
  folder:"floodProjectAssets"
})

// ---- Export: distance raster in meters --------------------------------------
Export.image.toAsset({
  image: euclideanDist,
  assetId:assetPath+'river_distance',
  description: 'river_distance', 
  scale: pixelSize, 
  region: roi, 
  crs: 'EPSG:4326', 
  maxPixels: 1e10
});
