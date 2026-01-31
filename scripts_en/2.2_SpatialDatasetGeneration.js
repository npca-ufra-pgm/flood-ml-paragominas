// =============================================================================
// Layers for flood modeling — Paragominas/PA
// Description: loads HAND, DEM (ANADEM), slope, TWI, Ksat (HiHydroSoil),
//              distance to drainages, land use/cover (MapBiomas) and generates
//              stratified samples (class 1 = flood; 0 = unlabeled).
// Preconditions (defined outside this snippet):
//   - geometry: ee.Geometry/ee.FeatureCollection of study area (ROI).
//   - risk_sector: ee.FeatureCollection (CPRM/SGB) with risk typology.
// Notes:
//   - CRS EPSG:4326 was maintained (as in original code).
// =============================================================================


// --------------------------- HAND (30 m) -------------------------------------
// Source: https://gee-community-catalog.org/projects/hand/
var paletteHand = [
  '023858', '006837', '1a9850', '66bd63', 'a6d96a', 'd9ef8b',
  'ffffbf', 'fee08b', 'fdae61', 'f46d43', 'd73027'
];
var handVis = { min: 1, max: 150, palette: paletteHand };

//  use "hand-1000" variant (flow threshold = 1000) for HAND.
var hand30m1000 = ee.Image('users/gena/GlobalHAND/30m/hand-1000').clip(geometry);

var hand = hand30m1000
  .rename('hand')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(hand, handVis, 'HAND (1000), 30 m (m)', false);


// ----------------------------- ANADEM (DEM) ----------------------------------
// Source: https://www.ufrgs.br/hge/anadem-modelo-digital-de-terreno-mdt/
var anadem = ee.Image('projects/et-brasil/assets/anadem/v1');

// Remove noData (-9999) and clip to ROI.
var elevationM = anadem
  .updateMask(anadem.neq(-9999))
  .clip(geometry)
  .rename('elevation')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

var elevationVis = {
  min: 70,
  max: 152.0,
  palette: ['006600', '002200', 'fff700', 'ab7634', 'c4d0ff', 'ffffff']
};

Map.addLayer(elevationM, elevationVis, 'Elevation (m)', false);


// --------------------------- Slope (degrees) ---------------------------------
// slope provides geomorphological context for susceptible areas.
var slopeDegrees = ee.Terrain.slope(elevationM)
  .rename('slope')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(
  slopeDegrees,
  { min: 0, max: 10, palette: ['green', 'yellow', 'red'] },
  'Slope (degrees)',
  false
);

// ---------------------------- TWI (dimensionless) ----------------------------
// Topographic Wetness Index calculated externally (QGIS).
var twiVis = {
  min: 0, max: 30,
  palette: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594']
};

var twiQgis = ee.Image('/twi_par') // import geo_tiff raster of TWI
  .clip(geometry)
  .rename('twi')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(twiQgis, twiVis, 'TWI (dimensionless wetness index)');


// ----------------- Soil Hydraulic Conductivity (Ksat) -----------------------
// HiHydroSoil v2.0 — https://gee-community-catalog.org/projects/hihydro_soil/#citation-related-publications
var palettesGena = require('users/gena/packages:palettes');
var ksatVis = { min: 3, max: 16, palette: palettesGena.cmocean.Delta[7] };

var ksatCollection = ee.ImageCollection('projects/sat-io/open-datasets/HiHydroSoilv2_0/ksat');
var ksatBase = ksatCollection.first().multiply(0.0001).clip(geometry); // adjust scale

// Gap-filling strategy:
// 1) Define sentinel value (1000) for noData; 2) replace with median of neighbors;
// 3) apply bilinear resample to smooth transitions.
var ksatUnmask = ksatBase.unmask(1000);
var ksatMissingMask = ksatUnmask.eq(1000);

var ksatMedianNeighbors = ksatUnmask.focal_median({
  radius: 45, kernelType: 'square', units: 'pixels'
});

var ksatFilled = ksatUnmask.where(ksatMissingMask, ksatMedianNeighbors)
  .resample('bilinear')
  .rename('soil_hydraulic_conductivity')  // cm/d
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(ksatFilled, ksatVis, 'Ksat (cm/d) — filled (bilinear)', true);


// --------------------- Distance to nearest river branch ----------------------
// Euclidean distance (m) to drainages — previously produced asset.
var distRivers = ee.Image('/river_distance') // import asset of distance to nearest river
  .rename('distance')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

var distVis = { min: 0, max: 750, palette: ['blue', 'green', 'yellow', 'red'] };
Map.addLayer(distRivers, distVis, 'Distance to rivers (m)', false);


// --------------- Land use and land cover (MapBiomas S2 Beta) ----------------
// Source: https://brasil.mapbiomas.org/codigos-e-ferramentas/
var finalYear = 2022;

var mapbiomasPal = require('users/mapbiomas/modules:Palettes.js').get('classification9');
var mapbiomasVis = { min: 0, max: 69, palette: mapbiomasPal, format: 'png' };

var lulcS2 = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection_S2_beta/collection_LULC_S2_beta')
  .clip(geometry);

var landCover2022 = lulcS2
  .select('classification_' + finalYear)
  .rename('landcover_classification_2022');

Map.addLayer(landCover2022, mapbiomasVis, 'Land cover and land use (10 m) — ' + finalYear, false);

/*
MapBiomas class examples:
 3  – Forest Formation                    #1f8d49
 9  – Forestry                             #7a5900
 11 – Wetland/Swamp Area                   #519799
 12 – Grassland Formation                  #d6bc74
 15 – Pasture                              #edde8e
 19 – Temporary Crop                       #C27BA0
 24 – Urban Area                           #d4271e
 25 – Other Non-Vegetated Areas            #db4d4f
 33 – River, Lake and Ocean                #2532e4
*/

// ------------------ Risk Sectors (CPRM/SGB) — Flood --------------------------
// Source: https://geoportal.sgb.gov.br/desastres/
var riskSector = ee.FeatureCollection(risk_sector) // #risk_sector shapefile of SGB risk sectors imported as external variable provided
  .filter(ee.Filter.eq('tipolo_g1', 'Inundação'));

Map.addLayer(riskSector, {}, 'Risk Sector — Flood (CPRM)', false);

// Buffer of 200 m around risk polygons to compose class 0.
var riskSectorBuffer200m = riskSector.geometry().buffer(200, 0);
Map.addLayer(riskSectorBuffer200m, {}, 'Risk Sector — 200 m buffer', false);

// ---------------------- Stack of explanatory bands ---------------------------
// gather physical/hydrological variables + land use/cover.
var spatialBands = distRivers
  .addBands(elevationM)
  .addBands(slopeDegrees)
  .addBands(ksatFilled)
  .addBands(hand)
  .addBands(twiQgis)
  .addBands(landCover2022);


// -------------------------- Class mask (0/1) ---------------------------------
// Rule: 1 = flood (inside risk polygons); 0 = unlabeled (buffer).
var baseClasses = ee.Image(0).clip(riskSectorBuffer200m);
var floodClass = ee.Image(1).clip(riskSector);

var classes = baseClasses.add(floodClass).unmask().clip(riskSectorBuffer200m);
Map.addLayer(classes, {}, 'Classes: 1 = flood; 0 = unlabeled', false);

// Attach the classes band to the main stack.
spatialBands = spatialBands.addBands(classes.rename('classes'));


// ----------------------------- Sampling --------------------------------------
// stratified sampling to balance classes at 10 m.
var dataset = spatialBands.stratifiedSample({
  numPoints: 0,                 // ignored when using classValues/classPoints
  classBand: 'classes',
  classValues: [0, 1],
  classPoints: [39000, 4000],   // adjust according to coverage/area
  region: riskSectorBuffer200m,
  scale: 10,
  geometries: true
});

Map.addLayer(dataset, { color: 'blue' }, 'Sample points (pixels)', false);
print('Number of samples:', dataset.size());


// ------------------------------ Exports --------------------------------------
// the region of raster export is defined by the geometry of `distRivers`,
var assetPathFlood = '/assets/FloodProject/'; // path to asset repository

Export.table.toDrive({
  collection: dataset,
  description: 'datasetFlood_toDrive',
  folder:"floodProjectAssets",
});

Export.table.toAsset({
  collection: dataset,
  description: 'datasetFlood_toAsset',
  assetId: assetPathFlood + 'datasetFlood_toAsset'
});

Export.image.toAsset({
  image: spatialBands,
  description: 'raster_spatial_data_flood',
  assetId: assetPathFlood + 'raster_spatial_data_flood',
  region: distRivers.geometry(0),
  crs: 'EPSG:4326',
  scale: 10,
  maxPixels: 1e10
});

print("Band types:" ,spatialBands.bandTypes())
spatialBands = spatialBands.toFloat()

Export.image.toDrive({
  image: spatialBands,
  description: 'raster_spatial_data_flood', 
  folder:"floodProjectAssets",
  region: distRivers.geometry(0), 
  //crs: 'EPSG:4326', 
  scale: 10, 
  maxPixels: 1e10
});

//=========================================
//After exporting training data samples, perform the following steps in Python Google Colab
//https://colab.research.google.com/drive/
/*
1 - SMOTE (Synthetic Minority Over-sampling Technique) Creates synthetic samples of the positive class — useful for enriching the positive set, but does not solve the absence of the negative class.
2 - Spy Technique Selects a fraction of positives as "spies" and mixes with unlabeled data. Uses a simple probabilistic classifier (e.g.: Naive Bayes) to calculate probabilities and extract reliable negatives.
3 - Use the probability distribution of spies to define a threshold. Unlabeled data with probability below that threshold are considered reliable negatives (if in doubt about how to use this method).
*/
//=========================================
//Then import the samples and perform the rest of the procedure in GEE which initially consists of:=======================
/*
4 - Use robust classifier (e.g.: Random Forest) with unlabeled data as reliable negatives to train the model in the normal training process.
*/
//=========================================
