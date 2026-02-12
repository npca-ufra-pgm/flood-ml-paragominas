// =============================================================================
// Layers for flood modeling — Paragominas/PA
// Description: loads HAND, DTM (ANADEM), slope, TWI, Ksat (HiHydroSoil),
//              distance to drainage, land use/cover (MapBiomas) and generates
//              stratified samples (class 1 = flood; 0 = unlabeled).
// Pre-conditions (defined outside this snippet):
//   - geometry: ee.Geometry/ee.FeatureCollection of study area (ROI).
//   - setor_risco: ee.FeatureCollection (CPRM/SGB) with risk typology.
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


// ----------------------------- ANADEM (DTM) ----------------------------------
// Source: https://www.ufrgs.br/hge/anadem-modelo-digital-de-terreno-mdt/
var anadem = ee.Image('projects/et-brasil/assets/anadem/v1');

// Remove noData (-9999) and clip to ROI.
var elevacaoM = anadem
  .updateMask(anadem.neq(-9999))
  .clip(geometry)
  .rename('elevation')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

var elevacaoVis = {
  min: 70,
  max: 152.0,
  palette: ['006600', '002200', 'fff700', 'ab7634', 'c4d0ff', 'ffffff']
};

Map.addLayer(elevacaoM, elevacaoVis, 'Elevation (m)', false);


// --------------------------- Slope (degrees) ---------------------------------
// slope provides geomorphological context for susceptible areas.
var declividadeGraus = ee.Terrain.slope(elevacaoM)
  .rename('slope')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(
  declividadeGraus,
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

// Gap filling strategy:
// 1) Define sentinel value (1000) for noData; 2) replace with neighbor median;
// 3) apply bilinear resample to smooth transitions.
var ksatUnmask = ksatBase.unmask(1000);
var ksatFaltanteMask = ksatUnmask.eq(1000);

var ksatMedianaVizinhos = ksatUnmask.focal_median({
  radius: 45, kernelType: 'square', units: 'pixels'
});

var ksatPreenchido = ksatUnmask.where(ksatFaltanteMask, ksatMedianaVizinhos)
  .resample('bilinear')
  .rename('soil_hydraulic_conductivity')  // cm/d
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(ksatPreenchido, ksatVis, 'Ksat (cm/d) — filled (bilinear)', true);


// --------------------- Distance to nearest river branch ----------------------
// Euclidean distance (m) to drainage — previously produced asset.
var distRios = ee.Image('/river_distance') // import river distance asset
  .rename('distance')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

var distVis = { min: 0, max: 750, palette: ['blue', 'green', 'yellow', 'red'] };
Map.addLayer(distRios, distVis, 'Distance to rivers (m)', false);


// --------------- Land use and land cover (MapBiomas S2 Beta) ----------------
// Source: https://brasil.mapbiomas.org/codigos-e-ferramentas/
var anoFinal = 2022;

var mapbiomasPal = require('users/mapbiomas/modules:Palettes.js').get('classification9');
var mapbiomasVis = { min: 0, max: 69, palette: mapbiomasPal, format: 'png' };

var lulcS2 = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection_S2_beta/collection_LULC_S2_beta')
  .clip(geometry);

var usoCobertura2022 = lulcS2
  .select('classification_' + anoFinal)
  .rename('landcover_classification_2022');

Map.addLayer(usoCobertura2022, mapbiomasVis, 'Land cover and use (10 m) — ' + anoFinal, false);

/*
MapBiomas class examples:
 3  – Forest Formation                  #1f8d49
 9  – Forestry                          #7a5900
 11 – Wetland/Swamp Area                #519799
 12 – Grassland Formation               #d6bc74
 15 – Pasture                           #edde8e
 19 – Temporary Crop                    #C27BA0
 24 – Urban Area                        #d4271e
 25 – Other Non-Vegetated Areas         #db4d4f
 33 – River, Lake and Ocean             #2532e4
*/

// ------------------ Risk Sectors (CPRM/SGB) — Flooding -----------------------
// Source: https://geoportal.sgb.gov.br/desastres/
var setorRisco = ee.FeatureCollection(setor_risco) // #setor_risco shapefile of SGB risk sectors imported as external variable
  .filter(ee.Filter.eq('tipolo_g1', 'Inundação'));

Map.addLayer(setorRisco, {}, 'Risk Sector — Flooding (CPRM)', false);

// 200 m buffer around risk polygons to compose class 0.
var setorRiscoBuffer200m = setorRisco.geometry().buffer(200, 0);
Map.addLayer(setorRiscoBuffer200m, {}, 'Risk Sector — 200 m buffer', false);

// ---------------------- Stacking explanatory bands ---------------------------
// gather physical/hydrological variables + land use/cover.
var bandasEspaciais = distRios
  .addBands(elevacaoM)
  .addBands(declividadeGraus)
  .addBands(ksatPreenchido)
  .addBands(hand)
  .addBands(twiQgis)
  .addBands(usoCobertura2022);


// -------------------------- Class mask (0/1) ---------------------------------
// Rule: 1 = flood (within risk polygons); 0 = unlabeled (buffer).
var classesBase = ee.Image(0).clip(setorRiscoBuffer200m);
var classeInundacao = ee.Image(1).clip(setorRisco);

var classes = classesBase.add(classeInundacao).unmask().clip(setorRiscoBuffer200m);
Map.addLayer(classes, {}, 'Classes: 1 = flood; 0 = unlabeled', false);

// Attach class band to main stack.
bandasEspaciais = bandasEspaciais.addBands(classes.rename('classes'));


// ----------------------------- Sampling --------------------------------------
// stratified sampling to balance classes at 10 m.
var dataset = bandasEspaciais.stratifiedSample({
  numPoints: 0,                 // ignored when using classValues/classPoints
  classBand: 'classes',
  classValues: [0, 1],
  classPoints: [39000, 4000],   // adjust according to coverage/area
  region: setorRiscoBuffer200m,
  scale: 10,
  geometries: true
});

Map.addLayer(dataset, { color: 'blue' }, 'Sample points (pixels)', false);
print('Number of samples:', dataset.size());


// ------------------------------ Exports --------------------------------------
// raster export region is defined by `distRios` geometry,
var assetPathEnchente = '/assets/FloodProject/'; // asset repository path

Export.table.toDrive({
  collection: dataset,
  description: 'floodDataset_toDrive',
  folder:"floodProjectAssets",
});

Export.table.toAsset({
  collection: dataset,
  description: 'floodDataset_toAsset',
  assetId: assetPathEnchente + 'floodDataset_toAsset'
});

Export.image.toAsset({
  image: bandasEspaciais,
  description: 'spatial_data_raster_flood',
  assetId: assetPathEnchente + 'spatial_data_raster_flood',
  region: distRios.geometry(0),
  crs: 'EPSG:4326',
  scale: 10,
  maxPixels: 1e10
});

print("Band types:" ,bandasEspaciais.bandTypes())
bandasEspaciais = bandasEspaciais.toFloat()

Export.image.toDrive({
  image: bandasEspaciais,
  description: 'spatial_data_raster_flood', 
  folder:"floodProjectAssets",
  region: distRios.geometry(0), 
  //crs: 'EPSG:4326', 
  scale: 10, 
  maxPixels: 1e10
});

//=========================================
//After exporting training data samples, perform the following steps in Google Colab Python
//https://colab.research.google.com/drive/
/*
1 - SMOTE (Synthetic Oversampling) Creates synthetic samples of the positive class — useful for enriching the positive set, but does not solve the absence of the negative class.
2 - Spy Technique Selects a fraction of positives as "spies" and mixes with unlabeled data. Uses a simple probabilistic classifier (e.g., Naive Bayes) to calculate probabilities and extract reliable negatives.
3 - Use the spy probability distribution to define a threshold. Unlabeled data with probability below this threshold are considered reliable negatives (when in doubt about using this method).
*/
//=========================================
//Then import the samples and perform the rest of the procedure in GEE which initially consists of:=======================
/*
4 - Use robust classifier (e.g., Random Forest) with unlabeled data as reliable negatives to train the model in the normal training process.
*/
//=========================================
