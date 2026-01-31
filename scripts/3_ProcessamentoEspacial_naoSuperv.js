// =============================================================================
// Classificação não supervisionada por Clusterização  e Classificação por Fatiamento de limiares sobre o HAND
// Conjunto base: raster multibanda "dados_espaciais_inundacao"
// =============================================================================

// --------------------------- Carrega stack -----------------------------------
// Contém bandas como: elevacao, distancia, declividade, hand, (…)
var dadosEspaciais = ee.Image(
  '/raster_dados_espaciais_inundacao');//incluir dados do rasters com as bandas (features)
Map.addLayer(dadosEspaciais, {}, 'dados_espaciais', false);
print('Stack espacial (insumo):', dadosEspaciais);

// Selecionar bandas usadas na clusterização
var bandas = ['elevacao', 'distancia', 'declividade', 'hand'];
dadosEspaciais = dadosEspaciais.select(bandas);

// Região de trabalho: geometria derivada da banda "distancia"
// NOTE: manter coerência com a ROI do projeto (pode trocar por `geometry`).
var region = dadosEspaciais.select('distancia').geometry(0);

// ------------------- Clusterização não supervisionada (XMeans) ---------------
// Fonte: Weka XMeans (k variando até 10, partindo de 2 clusters).
// Explora-se os padrões espaciais sem rótulo prévio.
var dadosNovos = ee.FeatureCollection('/datasetInundacao_toAsset'); //incluir dataset com as amostras balanceadas 

var clusterizador = ee.Clusterer.wekaXMeans(2, 10).train(dadosNovos, bandas);

var imagemClusterizada = dadosEspaciais.cluster(clusterizador);
// Visual aleatório para inspeção
Map.addLayer(
  imagemClusterizada.clip(region).randomVisualizer(),
  {},
  'Clusterização (XMeans)',
  false
);

// ----------------------- Suavização pós-cluster ------------------------------
// Reduzir "ruído sal-pimenta" (pixels isolados).
// Estratégia: modo focal 3x3 sobre banda "cluster".
var imagemClusterizadaSuav = imagemClusterizada
  .unmask(0) // evita nodata na vizinhança
  .focal_mode({
    radius: 1,           // 1 pixel -> janela 3x3
    units: 'pixels'
  });


// Paleta binária para visual (assumindo até 2 clusters; ajuste conforme saída)
Map.addLayer(
  imagemClusterizadaSuav,
  {bands: ['cluster'], min: 0, max: 1, palette: ['ffffff', 'ff0606']},
  'Imagem clusterizada (suavizada)'
);

// ============================== HAND (fatiamento) ============================
// Global 30 m HAND — https://gee-community-catalog.org/projects/hand/
var paletteHand = [
  '023858','006837','1a9850','66bd63','a6d96a','d9ef8b',
  'ffffbf','fee08b','fdae61','f46d43','d73027'
];
var handVis = { min: 1, max: 150, palette: paletteHand };

// Reutiliza a banda "hand" do stack carregado (coerente com a clusterização).
var hand = dadosEspaciais.select('hand').clip(region)
  .rename('hand')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(hand, handVis, 'HAND (m) — do stack', false);

// Fatiamento por limite de altura acima da drenagem
var palettes = require('users/gena/packages:palettes');

var alturaInundacao_5m = 5; // m — pixels com HAND <= 5 m
var maskHand = hand.gte(0).and(hand.lte(alturaInundacao_5m));
// Classificação binária por HAND (0/1) para área potencialmente inundável
var classificadaHand_5m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classificadaHand_5m,
  { palette: palettes.cb.Blues[7], min: 0, max: alturaInundacao_5m },
  'Classificada por HAND ≤ ' + alturaInundacao_5m + ' m',
  true);
  
var alturaInundacao_4m = 4; // m — pixels com HAND <= 5 m
var maskHand = hand.gte(0).and(hand.lte(alturaInundacao_4m));
// Classificação binária por HAND (0/1) para área potencialmente inundável
var classificadaHand_4m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classificadaHand_4m,
  { palette: palettes.cb.Blues[7], min: 0, max: alturaInundacao_4m },
  'Classificada por HAND ≤ ' + alturaInundacao_4m + ' m',
  true);

var alturaInundacao_3m = 3; // m — pixels com HAND <= 5 m
var maskHand = hand.gte(0).and(hand.lte(alturaInundacao_3m));
// Classificação binária por HAND (0/1) para área potencialmente inundável
var classificadaHand_3m = hand.updateMask(maskHand).rename('classification_hand');
Map.addLayer(
  classificadaHand_3m,
  { palette: palettes.cb.Blues[7], min: 0, max: alturaInundacao_3m },
  'Classificada por HAND ≤ ' + alturaInundacao_3m + ' m',
  true);

// ----------------------- Camada de referência (CPRM) -------------------------
Map.addLayer(
  setor_risco.filter(ee.Filter.eq('tipolo_g1', 'Inundação')), //importação dos setores de risco  
  {},
  'Setores de Risco — CPRM'
);

// -------------------------- Exporta cluster ----------------------------------
var assetPathEnchente = '/assets/ProjetoEnchente/'; // caminho do repositório do asset

Export.image.toAsset({
  image: imagemClusterizadaSuav.select('cluster'), // exporta só a banda de cluster
  assetId: assetPathEnchente + 'img_ClassificadaNaoSuperv_risco_inund',
  description: 'img_ClassificadaNaoSuperv_risco_inund',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: imagemClusterizadaSuav.select('cluster'),
  description: 'img_ClassificadaNaoSuperv_risco_inund', 
  folder:"projetoEnchenteAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

// -------------------- Exporta classificação por HAND -------------------------
Export.image.toAsset({
  image: classificadaHand_5m,
  assetId: assetPathEnchente + ('img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_5m + 'm'),
  description: 'img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_5m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classificadaHand_5m,
  description: 'img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_5m + 'm', 
  folder:"projetoEnchenteAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
  image: classificadaHand_4m,
  assetId: assetPathEnchente + ('img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_4m + 'm'),
  description: 'img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_4m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classificadaHand_4m,
  description: 'img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_4m + 'm', 
  folder:"projetoEnchenteAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
  image: classificadaHand_3m,
  assetId: assetPathEnchente + ('img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_3m + 'm'),
  description: 'img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_3m + 'm',
  region: region,
  scale: 10,
  maxPixels: 1e7
});
Export.image.toDrive({
  image: classificadaHand_3m,
  description: 'img_ClassificadaSliced_risco_inund_alt' + alturaInundacao_3m + 'm', 
  folder:"projetoEnchenteAssets",
  region: region,
  scale: 10, 
  maxPixels: 1e10
});