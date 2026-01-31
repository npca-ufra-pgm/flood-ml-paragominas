/ =============================================================================
// Classificação semi-supervisionada de risco de inundação (Random Forest)
// Fluxo: 
// → (1) exporta amostras 
// → (2) Colab (SMOTE/Spy) 
// → (3) reimporta e treina RF executado no Google Earth Engine (presente script)
// Área: Paragominas/PA
// =============================================================================

// ------------------------------ Etapas realizadas anteriormente no Python Google Colab ------------------------------
/*
1) SMOTE (oversampling sintético)
   - Cria amostras sintéticas para a classe positiva.
   - Útil para balancear, mas não “gera” negativos.

2) Spy Technique
   - Seleciona fração de positivos como "spies" e mistura com não rotulados.
   - Usa classificador probabilístico (Naive Bayes) para estimar P(positivo).
   - Estabelece limiar a partir da distribuição de probabilidades dos spies, média e desvio padrão.

3) Negativos Confiáveis
   - Dados não rotulados com P(positivo) abaixo do limiar → negativos confiáveis.

4) Exportar conjunto combinado
   - Exportar ao EE como `combined_dataset` com rótulo final (ex.: `new_class`).
*/

// ------------------------------ Insumos (EE) ---------------------------------
var dadosEspaciais = ee.Image(
  '/raster_dados_espaciais_inundacao'
);

// Seleção de bandas explicativas (deve coincidir com as bandas do raster)
var bandas = [
  'elevacao',
  'distancia',
  'declividade',
  'condutividade_hidraulica_solo',
  'hand',
  'twi'
];

// Região de exportação/classificação: geometrias derivadas da banda "distancia"
var region = dadosEspaciais.select('distancia').geometry(0);

// ------------------- Amostras combinadas (pós-Colab) ------------------------
var dadosNovos = ee.FeatureCollection(
  '/combined_dataset'
);
print('Exemplo de amostra:', dadosNovos.first());

// Split reprodutível (80/20)
dadosNovos = dadosNovos.randomColumn('rand', 42);
var split = 0.8;
var training = dadosNovos.filter(ee.Filter.lt('rand', split));
var test     = dadosNovos.filter(ee.Filter.gte('rand', split));

// ---------------------------- Classificador RF -------------------------------
// RF é robusto a ruído e a correlações entre variáveis.
var rf = ee.Classifier.smileRandomForest({
  numberOfTrees: 100,}).train({
  features: training,
  classProperty: 'new_class', // rótulo vindo do Colab
  inputProperties: bandas
});

// Classificar imagem (somente bandas explicativas)
var imagemClassificada = dadosEspaciais
  .select(bandas)
  .clip(region)
  .classify(rf);

// Visual binário: 0 = não inundação; 1 = inundação
Map.addLayer(
  imagemClassificada,
  {bands: ['classification'], min: 0, max: 1, palette: ['ffffff', 'ff0606']},
  'Imagem classificada (RF)',
  true
);

// ----------------------- Métricas de acurácia -------------------------------
// Resubstitution (treino)
var trainMatrix = rf.confusionMatrix();
print('Matriz (treino):', trainMatrix);
print('Acurácia (treino):', trainMatrix.accuracy());

// Validação (teste)
var tested = test.classify(rf);
var testMatrix = tested.errorMatrix('new_class', 'classification');
print('Matriz (teste):', testMatrix);
print('Acurácia (teste):', testMatrix.accuracy());

// Importância das variáveis
var explanation = rf.explain();
print('Explicação do classificador:', explanation);

// -------------------- Pós-processamento (suavização) -------------------------
// Reduz efeito “sal-pimenta” sem alterar massas coerentes.
var imagemSuav = imagemClassificada
  .unmask(0)
  .focal_mode({ radius: 1, units: 'pixels' }); // janela 3x3

Map.addLayer(
  imagemSuav,
  {bands: ['classification'], min: 0, max: 1, palette: ['ffffff', 'ff0606']},
  'Imagem classificada (suavizada)',
  false
);

// ---------------------- Camada de referência (CPRM) --------------------------
Map.addLayer(
  setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação')),
  {},
  'Setores de Risco — CPRM/SGB',
  false
);

// ------------------------------- Exportações ---------------------------------
var assetPathEnchente = '/assets/ProjetoEnchente/';

// Exporta raster classificado (suavizado)
Export.image.toAsset({
  image: imagemSuav.select('classification'),
  assetId: assetPathEnchente + 'img_ClassificadaSemiSuperv_risco_inund',
  description: 'img_ClassificadaSemiSuperv_risco_inund',
  region: region,
  scale: 10,
  maxPixels: 1e10
});
Export.image.toDrive({
  image: imagemSuav.select('classification'),
  description: 'img_ClassificadaSemiSuperv_risco_inund', 
  folder:"projetoEnchenteAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

// Exporta importância das variáveis (tabela)
var importanceDict = ee.Dictionary(explanation.get('importance'));
var importanceFeature = ee.Feature(ee.Geometry.Point([0, 0]), importanceDict);
var importanciaAtributosInund = ee.FeatureCollection([importanceFeature]);

Export.table.toAsset({
  collection: importanciaAtributosInund,
  description: 'importancia_atributos_inund',
  assetId: assetPathEnchente + 'importancia_atributos_inund'
});