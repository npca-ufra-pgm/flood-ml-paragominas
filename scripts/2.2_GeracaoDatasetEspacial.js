// =============================================================================
// Camadas para modelagem de inundação — Paragominas/PA
// Descrição: carrega HAND, MDT (ANADEM), declividade, TWI, Ksat (HiHydroSoil),
//            distância a drenagens, uso/cobertura (MapBiomas) e gera amostras
//            estratificadas (classe 1 = inundação; 0 = não rotulada).
// Pré-condições (definidas fora deste trecho):
//   - geometry: ee.Geometry/ee.FeatureCollection da área de estudo (ROI).
//   - setor_risco: ee.FeatureCollection (CPRM/SGB) com tipologia de risco.
// Observações:
//   - CRS EPSG:4326 foi mantido (como no código original).
// =============================================================================


// --------------------------- HAND (30 m) -------------------------------------
// Fonte: https://gee-community-catalog.org/projects/hand/
var paletteHand = [
  '023858', '006837', '1a9850', '66bd63', 'a6d96a', 'd9ef8b',
  'ffffbf', 'fee08b', 'fdae61', 'f46d43', 'd73027'
];
var handVis = { min: 1, max: 150, palette: paletteHand };

//  usar a variante "hand-1000" (threshold de fluxo = 1000) para HAND.
var hand30m1000 = ee.Image('users/gena/GlobalHAND/30m/hand-1000').clip(geometry);

var hand = hand30m1000
  .rename('hand')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(hand, handVis, 'HAND (1000), 30 m (m)', false);


// ----------------------------- ANADEM (MDT) ----------------------------------
// Fonte: https://www.ufrgs.br/hge/anadem-modelo-digital-de-terreno-mdt/
var anadem = ee.Image('projects/et-brasil/assets/anadem/v1');

// Remove noData (-9999) e recorta à ROI.
var elevacaoM = anadem
  .updateMask(anadem.neq(-9999))
  .clip(geometry)
  .rename('elevacao')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

var elevacaoVis = {
  min: 70,
  max: 152.0,
  palette: ['006600', '002200', 'fff700', 'ab7634', 'c4d0ff', 'ffffff']
};

Map.addLayer(elevacaoM, elevacaoVis, 'Elevação (m)', false);


// --------------------------- Declividade (graus) -----------------------------
// declividade fornece contexto geomorfológico para áreas suscetíveis.
var declividadeGraus = ee.Terrain.slope(elevacaoM)
  .rename('declividade')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(
  declividadeGraus,
  { min: 0, max: 10, palette: ['green', 'yellow', 'red'] },
  'Declividade (graus)',
  false
);

// ---------------------------- TWI (adimensional) -----------------------------
// Índice Topográfico de Umidade calculado externamente (QGIS).
var twiVis = {
  min: 0, max: 30,
  palette: ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594']
};

var twiQgis = ee.Image('/twi_par') // importação do geo_tiff raster do TWI
  .clip(geometry)
  .rename('twi')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(twiQgis, twiVis, 'TWI (índice de umidade adimensional)');


// ----------------- Condutividade Hidráulica do Solo (Ksat) ------------------
// HiHydroSoil v2.0 — https://gee-community-catalog.org/projects/hihydro_soil/#citation-related-publications
var palettesGena = require('users/gena/packages:palettes');
var ksatVis = { min: 3, max: 16, palette: palettesGena.cmocean.Delta[7] };

var ksatCollection = ee.ImageCollection('projects/sat-io/open-datasets/HiHydroSoilv2_0/ksat');
var ksatBase = ksatCollection.first().multiply(0.0001).clip(geometry); // ajusta escala

// Estratégia de preenchimento de lacunas:
// 1) Define valor sentinel (1000) para noData; 2) substitui por mediana de vizinhos;
// 3) aplica resample bilinear para suavizar transições.
var ksatUnmask = ksatBase.unmask(1000);
var ksatFaltanteMask = ksatUnmask.eq(1000);

var ksatMedianaVizinhos = ksatUnmask.focal_median({
  radius: 45, kernelType: 'square', units: 'pixels'
});

var ksatPreenchido = ksatUnmask.where(ksatFaltanteMask, ksatMedianaVizinhos)
  .resample('bilinear')
  .rename('condutividade_hidraulica_solo')  // cm/d
  .reproject({ crs: 'EPSG:4326', scale: 10 });

Map.addLayer(ksatPreenchido, ksatVis, 'Ksat (cm/d) — preenchido (bilinear)', true);


// --------------------- Distância ao braço de rio mais próximo ----------------
// Distância euclidiana (m) a drenagens — asset produzido previamente.
var distRios = ee.Image('/distancia_rios') // importar asset de distancias do rio mais próximo
  .rename('distancia')
  .reproject({ crs: 'EPSG:4326', scale: 10 });

var distVis = { min: 0, max: 750, palette: ['blue', 'green', 'yellow', 'red'] };
Map.addLayer(distRios, distVis, 'Distância a rios (m)', false);


// --------------- Uso e cobertura da terra (MapBiomas S2 Beta) ----------------
// Fonte: https://brasil.mapbiomas.org/codigos-e-ferramentas/
var anoFinal = 2022;

var mapbiomasPal = require('users/mapbiomas/modules:Palettes.js').get('classification9');
var mapbiomasVis = { min: 0, max: 69, palette: mapbiomasPal, format: 'png' };

var lulcS2 = ee.Image('projects/mapbiomas-public/assets/brazil/lulc/collection_S2_beta/collection_LULC_S2_beta')
  .clip(geometry);

var usoCobertura2022 = lulcS2
  .select('classification_' + anoFinal)
  .rename('usocobersolo_classification_2022');

Map.addLayer(usoCobertura2022, mapbiomasVis, 'Cobertura e uso da terra (10 m) — ' + anoFinal, false);

/*
Exemplos de classes MapBiomas:
 3  – Formação Florestal                  #1f8d49
 9  – Silvicultura                        #7a5900
 11 – Campo Alagado/Área Pantanosa        #519799
 12 – Formação Campestre                  #d6bc74
 15 – Pastagem                            #edde8e
 19 – Lavoura Temporária                  #C27BA0
 24 – Área Urbanizada                     #d4271e
 25 – Outras Áreas não Vegetadas          #db4d4f
 33 – Rio, Lago e Oceano                  #2532e4
*/

// ------------------ Setores de Risco (CPRM/SGB) — Inundação ------------------
// Fonte: https://geoportal.sgb.gov.br/desastres/
var setorRisco = ee.FeatureCollection(setor_risco) // #setor_risco shapefile do setores de risco do SGB importado como variável externa fornecida
  .filter(ee.Filter.eq('tipolo_g1', 'Inundação'));

Map.addLayer(setorRisco, {}, 'Setor de Risco — Inundação (CPRM)', false);

// Buffer de 200 m ao redor dos polígonos de risco para compor a classe 0.
var setorRiscoBuffer200m = setorRisco.geometry().buffer(200, 0);
Map.addLayer(setorRiscoBuffer200m, {}, 'Setor de Risco — buffer 200 m', false);

// ---------------------- Empilhamento de bandas explicativas ------------------
// reunir variáveis físicas/hidrológicas + uso/cobertura.
var bandasEspaciais = distRios
  .addBands(elevacaoM)
  .addBands(declividadeGraus)
  .addBands(ksatPreenchido)
  .addBands(hand)
  .addBands(twiQgis)
  .addBands(usoCobertura2022);


// -------------------------- Máscara de classes (0/1) -------------------------
// Regra: 1 = inundação (dentro dos polígonos de risco); 0 = não rotulada (buffer).
var classesBase = ee.Image(0).clip(setorRiscoBuffer200m);
var classeInundacao = ee.Image(1).clip(setorRisco);

var classes = classesBase.add(classeInundacao).unmask().clip(setorRiscoBuffer200m);
Map.addLayer(classes, {}, 'Classes: 1 = inundação; 0 = não rotulada', false);

// Anexa a banda de classes ao stack principal.
bandasEspaciais = bandasEspaciais.addBands(classes.rename('classes'));


// ----------------------------- Amostragem ------------------------------------
// amostragem estratificada para balancear classes em 10 m.
var dataset = bandasEspaciais.stratifiedSample({
  numPoints: 0,                 // ignorado quando se usa classValues/classPoints
  classBand: 'classes',
  classValues: [0, 1],
  classPoints: [39000, 4000],   // ajuste conforme cobertura/área
  region: setorRiscoBuffer200m,
  scale: 10,
  geometries: true
});

Map.addLayer(dataset, { color: 'blue' }, 'Pontos de amostra (pixels)', false);
print('Quantidade de amostras:', dataset.size());


// ------------------------------ Exportações ----------------------------------
// a região da exportação do raster está definida pela geometria de `distRios`,
var assetPathEnchente = '/assets/ProjetoEnchente/'; // caminho do repositório do asset

Export.table.toDrive({
  collection: dataset,
  description: 'datasetInundacao_toDrive',
  folder:"projetoEnchenteAssets",
});

Export.table.toAsset({
  collection: dataset,
  description: 'datasetInundacao_toAsset',
  assetId: assetPathEnchente + 'datasetInundacao_toAsset'
});

Export.image.toAsset({
  image: bandasEspaciais,
  description: 'raster_dados_espaciais_inundacao',
  assetId: assetPathEnchente + 'raster_dados_espaciais_inundacao',
  region: distRios.geometry(0),
  crs: 'EPSG:4326',
  scale: 10,
  maxPixels: 1e10
});

print("Tipos das bandas:" ,bandasEspaciais.bandTypes())
bandasEspaciais = bandasEspaciais.toFloat()

Export.image.toDrive({
  image: bandasEspaciais,
  description: 'raster_dados_espaciais_inundacao', 
  folder:"projetoEnchenteAssets",
  region: distRios.geometry(0), 
  //crs: 'EPSG:4326', 
  scale: 10, 
  maxPixels: 1e10
});

//=========================================
//Após exportar as amostras dos dadosDeTreino, realizar as seguintes etapas no python Google Collab
//https://colab.research.google.com/drive/
/*
1 - SMOTE (Oversampling Sintético) Cria amostras sintéticas da classe positiva — útil para enriquecer o conjunto positivo, mas não resolve a ausência da classe negativa.
2 - Técnica Spy (Spy Technique) Seleciona uma fração dos positivos como "spies" e mistura com dados não rotulados. Usa um classificador probabilístico simples (ex: Naive Bayes) para calcular probabilidades e extrair negativos confiáveis.
3 - Usar a distribuição das probabilidades dos spies para definir um limiar. Os dados não rotulados com probabilidade abaixo desse limiar são considerados negativos confiáveis (na dúvida de como usar esse metodo).
*/
//=========================================
//De pois importar as amostras e realizar o resto do procedimento no GEE que inicialmente consiste em:=======================
/*
4 - Usa classificador robusto (ex: Random Forest) com os dados não rotulados como negativos confiáveis para treinar o modelo no processo normal de treinamento.
*/
//=========================================
