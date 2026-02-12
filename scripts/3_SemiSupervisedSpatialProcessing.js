// =============================================================================
// Semi-supervised flood risk classification (Random Forest)
// Flow:
// → (1) export samples
// → (2) Colab (SMOTE/Spy)
// → (3) reimport and train RF executed in Google Earth Engine (present script)
// Area: Paragominas/PA
// =============================================================================

// ------------------------------ Steps previously performed in Python Google Colab ------------------------------
/*
1) SMOTE (synthetic oversampling)
   - Creates synthetic samples for positive class.
   - Useful for balancing, but does not "generate" negatives.

2) Spy Technique
   - Selects fraction of positives as "spies" and mixes with unlabeled.
   - Uses probabilistic classifier (Naive Bayes) to estimate P(positive).
   - Establishes threshold from spy probability distribution, mean and standard deviation.

3) Reliable Negatives
   - Unlabeled data with P(positive) below threshold → reliable negatives.

4) Export combined dataset
   - Export to EE as `combined_dataset` with final label (e.g., `new_class`).
*/

// ------------------------------ Inputs (EE) ----------------------------------
var dadosEspaciais = ee.Image(
  '/spatial_data_raster_flood'
);

// Selection of explanatory bands (must match raster bands)
var bandas = [
  'elevation',
  'distance',
  'slope',
  'soil_hydraulic_conductivity',
  'hand',
  'twi'
];

// Export/classification region: geometries derived from "distance" band
var region = dadosEspaciais.select('distance').geometry(0);

// ------------------- Combined samples (post-Colab) ---------------------------
var dadosNovos = ee.FeatureCollection(
  '/combined_dataset'
);
print('Sample example:', dadosNovos.first());

// Reproducible split (80/20)
dadosNovos = dadosNovos.randomColumn('rand', 42);
var split = 0.8;
var training = dadosNovos.filter(ee.Filter.lt('rand', split));
var test     = dadosNovos.filter(ee.Filter.gte('rand', split));

// ---------------------------- RF Classifier ----------------------------------
// RF is robust to noise and correlations between variables.
var rf = ee.Classifier.smileRandomForest({
  numberOfTrees: 100,}).train({
  features: training,
  classProperty: 'new_class', // label from Colab
  inputProperties: bandas
});

// Classify image (only explanatory bands)
var imagemClassificada = dadosEspaciais
  .select(bandas)
  .clip(region)
  .classify(rf);

// Binary visualization: 0 = no flood; 1 = flood
Map.addLayer(
  imagemClassificada,
  {bands: ['classification'], min: 0, max: 1, palette: ['ffffff', 'ff0606']},
  'Classified image (RF)',
  true
);

// ----------------------- Accuracy metrics ------------------------------------
// Resubstitution (training)
var trainMatrix = rf.confusionMatrix();
print('Matrix (training):', trainMatrix);
print('Accuracy (training):', trainMatrix.accuracy());

// Validation (test)
var tested = test.classify(rf);
var testMatrix = tested.errorMatrix('new_class', 'classification');
print('Matrix (test):', testMatrix);
print('Accuracy (test):', testMatrix.accuracy());

// Variable importance
var explanation = rf.explain();
print('Classifier explanation:', explanation);

// -------------------- Post-processing (smoothing) ----------------------------
// Reduces "salt-and-pepper" effect without altering coherent masses.
var imagemSuav = imagemClassificada
  .unmask(0)
  .focal_mode({ radius: 1, units: 'pixels' }); // 3x3 window

Map.addLayer(
  imagemSuav,
  {bands: ['classification'], min: 0, max: 1, palette: ['ffffff', 'ff0606']},
  'Classified image (smoothed)',
  false
);

// ---------------------- Reference layer (CPRM) -------------------------------
Map.addLayer(
  setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação')),
  {},
  'Risk Sectors — CPRM/SGB',
  false
);

// ------------------------------- Exports -------------------------------------
var assetPathEnchente = '/assets/FloodProject/';

// Export classified raster (smoothed)
Export.image.toAsset({
  image: imagemSuav.select('classification'),
  assetId: assetPathEnchente + 'img_SemiSupervisedClassified_flood_risk',
  description: 'img_SemiSupervisedClassified_flood_risk',
  region: region,
  scale: 10,
  maxPixels: 1e10
});
Export.image.toDrive({
  image: imagemSuav.select('classification'),
  description: 'img_SemiSupervisedClassified_flood_risk', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

// Export variable importance (table)
var importanceDict = ee.Dictionary(explanation.get('importance'));
var importanceFeature = ee.Feature(ee.Geometry.Point([0, 0]), importanceDict);
var importanciaAtributosInund = ee.FeatureCollection([importanceFeature]);

Export.table.toAsset({
  collection: importanciaAtributosInund,
  description: 'attribute_importance_flood',
  assetId: assetPathEnchente + 'attribute_importance_flood'
});
