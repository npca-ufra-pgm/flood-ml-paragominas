// =============================================================================
// Cálculo de distância euclidiana até rios/córregos em Paragominas
// Autor: GILBERTO N S JR
// Descrição: cria buffer ao redor da rede de drenagem, rasteriza como "alvo"
//            e calcula a distância euclidiana por pixel até esses alvos.
// Dependências externas (Assets):
//  - /TrechosDrenagemParagominas_Intersesct
// Pré-condições (definidas fora deste trecho):
//  - roi: ee.Geometry/ee.FeatureCollection da região de interesse. Um retângulo sobre a área urbana.
//  - corregoRioUrainPgm: ee.FeatureCollection com córregos adicionais.
// Observação: projeção base retirada do Dynamic World V1 (2024).
// =============================================================================

// ---- Parâmetros gerais -------------------------------------------------------
var tamanhoPixel = 10; // [m] resolução-alvo para reprojeção e exportação

// ---- Rede de drenagem (rios/córregos) ---------------------------------------
// Região de interesse: trechos de drenagem de Paragominas próximos da área urbana.
var drenagensPgm = ee.FeatureCollection(
  '/TrechosDrenagemParagominas_Intersesct'
);
Map.addLayer(drenagensPgm, {}, 'Drenagens (rios)', false)

var drenagensComCorregos = roi.intersection(drenagensPgm, 0.5)
drenagensComCorregos = drenagensComCorregos.union(corrego_rio_urain_pgm)
Map.addLayer(drenagensComCorregos, {}, 'Drenagens (rios + córregos)', false)

// ---- Buffer ao redor dos cursos d'água --------------------------------------
var drenagensBuffer  = drenagensComCorregos.buffer(tamanhoPixel,0.5)
Map.addLayer(drenagensBuffer, {}, 'Drenagens (buffer)', false)

// ---- Projeção base a partir do Dynamic World (2024) -------------------------
// Importa Dynamic World, agrega mediana de 2024 e pega a projeção para padronizar.
var imgDw2024  = ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1").filterBounds(roi).filterDate("2024-01-01","2025-01-01").median().select('label').clip(roi)
var projBase  = imgDw2024.projection()

// ---- Imagem auxiliar: fundo zero + "alvo" pintado com 1 ---------------------
// distance() exige um raster "alvo" (1) no meio de zeros para calcular a distância até os pixels-alvo.
var imgFundoZero  = imgDw2024.multiply(0).reproject(projBase,null, tamanhoPixel)
var imgAlvoRios  = imgFundoZero.paint(drenagensBuffer,1)

// ---- Distância Euclidiana até os rios/córregos (em metros) ------------------
//Aplicação de kernel para identificaão da distancia de cada pixel para os rios de PGM
var distanciaMaximaM = 2500// ajuste conforme necessidade de alcance//4096//2048//512//50000;  
var kernelEuclidiano = ee.Kernel.euclidean(distanciaMaximaM, 'meters')
var distEuclidiana  = imgAlvoRios.distance(kernelEuclidiano).rename("DistanciaRio_m")

//Visualização da distância 
var visDist  = {min: 0, max: distanciaMaximaM}
Map.addLayer(distEuclidiana.clip(roi), visDist, 'Distância euclidiana aos rios');

// ---- Caminho base para exportação -------------------------------------------
var caminhoAsset  = '/assets/Projeto/'; // Adicionar o caminho de exportação do asset 

// ---- Exportação: vetores (rios + córregos unificados) -----------------------
//Exportação dos vectores como rastes dos rios de PGM com a adição de corregos identificados
Export.table.toAsset({
  collection:ee.FeatureCollection([ee.Feature(drenagensComCorregos)]), 
  description: 'rios_corregos_pgm',
  assetId: caminhoAsset+'rios_corregos_pgm'
})

Export.table.toDrive({
  collection:ee.FeatureCollection([ee.Feature(drenagensComCorregos)]), 
  description: 'rios_corregos_pgm',
  folder:"projetoEnchenteAssets"
})

// ---- Exportação: raster de distância em metros ------------------------------
Export.image.toAsset({
  image: distEuclidiana,
  assetId:caminhoAsset+'distancia_rios',
  description: 'distancia_rios', 
  scale: tamanhoPixel, 
  region: roi, 
  crs: 'EPSG:4326', 
  maxPixels: 1e10
});