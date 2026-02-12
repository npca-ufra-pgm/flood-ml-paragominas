// =====================================================
// Initial data exploration script
// =====================================================

// =====================================================
// DIGITAL ELEVATION MODEL (DEM)
// Source: ANADEM – Digital Terrain Model
// https://www.ufrgs.br/hge/anadem-modelo-digital-de-terreno-mdt/
// =====================================================
var anadem = ee.Image('projects/et-brasil/assets/anadem/v1');

// Remove NoData values (-9999) and clip to study area
var elevacao = anadem
  .updateMask(anadem.neq(-9999))
  .clip(geometry);

// Elevation visualization parameters (meters)
var elevacaoVis = {
  min: 70,
  max: 152.0,
  palette: ['006600', '002200', 'fff700', 'ab7634', 'c4d0ff', 'ffffff']
};

// Rename band and reproject to WGS84 with 10 m resolution
elevacao = elevacao.rename("elevation").reproject({
  crs: 'EPSG:4326',
  scale: 10
});

// Add DEM to map
Map.addLayer(elevacao, elevacaoVis, 'Elevation (m)');


// =====================================================
// SOIL HYDRAULIC CONDUCTIVITY (Ks)
// Source: HiHydroSoil v2.0
// https://gee-community-catalog.org/projects/hihydro_soil/#citation-related-publications
// =====================================================
var HiHydro = ee.ImageCollection(
  'projects/sat-io/open-datasets/HiHydroSoilv2_0/ksat'
);

// Color palette for visualization
var palettes = require('users/gena/packages:palettes');
var ksatVis = {
  min: 3,
  max: 16,
  palette: palettes.cmocean.Delta[7]
};

// Select first image, adjust scale (cm/day) and clip to study area
var ksat = HiHydro.first()
  .multiply(0.0001)
  .clip(geometry);

// Fill pixels without data with sentinel value (1000)
var mask = ksat.unmask(1000).clip(geometry);

// Identify artificially filled pixels
var targetMask = mask.eq(1000);

// Calculate median of neighboring pixels (45x45 pixel window)
var medianNeighbors = mask.focal_median({
  radius: 45,
  kernelType: 'square',
  units: 'pixels'
});

// Replace pixels without data with median of neighbors
var replaced = mask.where(targetMask, medianNeighbors);

// Rename band and reproject to WGS84 with 30 m resolution
var ksat_dadospreencidos = replaced
  .rename("soil_hydraulic_conductivity")
  .reproject({
    crs: 'EPSG:4326',
    scale: 30
  });

// Add soil hydraulic conductivity to map
Map.addLayer(
  ksat_dadospreencidos,
  ksatVis,
  'Soil hydraulic conductivity (cm/d)'
);


// =====================================================
// LAND USE AND LAND COVER
// Source: MapBiomas – Sentinel-2 Collection (10 m)
// https://brasil.mapbiomas.org/codigos-e-ferramentas/
// =====================================================
var ano_final = 2022;
var ano_inicial = 2016;

// Official MapBiomas palette (classification level 9)
var palettesMapBiomas = require('users/mapbiomas/modules:Palettes.js');
palettesMapBiomas = palettesMapBiomas.get('classification9');

var mapbiomasVis = {
  min: 0,
  max: 69,
  palette: palettesMapBiomas,
  format: 'png'
};

// Load MapBiomas collection and select final year
var MapBiomas_collection = ee.Image(
  'projects/mapbiomas-public/assets/brazil/lulc/collection_S2_beta/collection_LULC_S2_beta'
).clip(geometry);

var MapBiomas = MapBiomas_collection
  .select('classification_' + ano_final);

// Add land use and land cover map
Map.addLayer(
  MapBiomas,
  mapbiomasVis,
  'Land use and land cover (10 m) - ' + ano_final,
  true
);

// Rename band
MapBiomas = MapBiomas.rename("landcover_classification_2022");

/*
MapBiomas classes considered:
3  – Forest Formation                  | #1f8d49
9  – Forestry                           | #7a5900
11 – Wetland / Swamp Area             | #519799
12 – Grassland Formation               | #d6bc74
15 – Pasture                           | #edde8e
19 – Temporary Crop                    | #C27BA0
24 – Urban Area                        | #d4271e
25 – Other Non-Vegetated Areas         | #db4d4f
33 – River, Lake and Ocean             | #2532e4
*/


// =====================================================
// FLOOD RISK AREAS
// Source: Geological Survey of Brazil (CPRM)
// https://geoportal.sgb.gov.br/desastres/
// =====================================================

// Filter only sectors classified as flooding
setor_risco = setor_risco.filter(
  ee.Filter.eq('tipolo_g1', 'Inundação')
);

// Convert risk sectors to geometry
var setor_risco_geometr = setor_risco.geometry();

// Add flood risk areas to map
Map.addLayer(
  setor_risco_geometr,
  {},
  "Risk sectors – Flooding (CPRM)"
);


// =====================================================
// HYDROGRAPHY
// Source: IBGE / Cerrado Institute
// =====================================================

// Add river vectors
Map.addLayer(
  rios,
  { color: 'black' },
  "Rivers"
);
