# Flood Susceptibility Mapping Using Machine Learning and Remote Sensing

## Overview

This repository contains the complete implementation code for urban flood susceptibility assessment in Paragominas, Pará, Brazil, using machine learning techniques and wide-coverage geospatial data. The methodology integrates semi-supervised learning, unsupervised clustering, and threshold-based classification with Google Earth Engine (GEE) and Python.

## Abstract

Urban flooding represents a significant environmental hazard requiring accurate susceptibility mapping for risk mitigation. This study presents a comprehensive framework combining multiple data sources (HAND, DEM, slope, TWI, soil hydraulic conductivity, land cover) with three classification approaches: (1) semi-supervised Random Forest using Spy technique for negative sample identification, (2) unsupervised K-means clustering, and (3) HAND-based threshold slicing. The final susceptibility index integrates variable importance weights derived from the Random Forest classifier.

## Repository Structure

```
flood-ml-paragominas/
├── scripts/              # Original scripts in Portuguese
│   ├── 2.1_Corregos_e_DistanciaDosRios.js
│   ├── 2.2_GeracaoDatasetEspacial.js
│   ├── 2.n_6.n_DataProcessToSemiSuperv_and_SeparabilityAnalysis.ipynb
│   ├── 3_ProcessamentoEspacial_naoSuperv.js
│   ├── 3_ProcessamentoEspacial_semiSuperv.js
│   ├── 4_Pos_ProcessamentoEspacial.js
│   └── 5_Visualizacao_posProcessamentoFinal.js
└── scripts_en/           # English version for scientific publication
    ├── 2.1_Streams_and_RiverDistance.js
    ├── 2.2_SpatialDatasetGeneration.js
    ├── 2.n_6.n_DataProcessToSemiSuperv_and_SeparabilityAnalysis.ipynb
    ├── 3_UnsupervisedSpatialProcessing.js
    ├── 3_SemiSupervisedSpatialProcessing.js
    ├── 4_SpatialPostProcessing.js
    └── 5_FinalPostProcessingVisualization.js
```

## Methodology Workflow

### 1. Preprocessing and Distance Calculation
**Script:** `2.1_Streams_and_RiverDistance.js`

Computes Euclidean distance from each pixel to the nearest river or stream using drainage network data.

**Key Operations:**
- Buffer creation around drainage network
- Rasterization of vector data
- Euclidean distance kernel application (max range: 2500m)
- Export to Google Earth Engine Assets

**Inputs:**
- Drainage network shapefile (TrechosDrenagemParagominas)
- Region of interest (ROI) geometry
- Additional stream features

**Outputs:**
- Distance raster (10m resolution)
- Unified rivers/streams vector layer

### 2. Spatial Dataset Generation
**Script:** `2.2_SpatialDatasetGeneration.js`

Assembles multi-band raster stack with geophysical and hydrological variables, generates stratified samples for model training.

**Variables Included:**
- **HAND** (Height Above Nearest Drainage, 30m) - Global HAND dataset
- **DEM** (Digital Elevation Model) - ANADEM Brazil
- **Slope** (degrees) - Derived from DEM
- **TWI** (Topographic Wetness Index) - Computed in QGIS
- **Ksat** (Soil Hydraulic Conductivity, cm/day) - HiHydroSoil v2.0
- **Distance to rivers** (meters) - From step 1
- **Land cover** (MapBiomas Sentinel-2 Beta, 2022)

**Sampling Strategy:**
- Class 0 (unlabeled): 39,000 samples from buffer zone (200m around risk sectors)
- Class 1 (flood): 4,000 samples from CPRM/SGB risk sectors
- Stratified sampling at 10m resolution

**Outputs:**
- Multi-band raster stack
- Training/validation dataset (CSV format)
- Asset exports for GEE

### 3. Semi-Supervised Learning Pipeline
**Scripts:** `2.n_6.n_DataProcessToSemiSuperv_and_SeparabilityAnalysis.ipynb` (Python) + `3_SemiSupervisedSpatialProcessing.js` (GEE)

Implements Positive-Unlabeled (PU) learning using Spy technique to identify reliable negative samples.

**Python Workflow (Google Colab):**

1. **SMOTE Oversampling:**
   - Synthetic Minority Over-sampling Technique
   - Increases positive class samples by 20%
   - Balances training data distribution

2. **Spy Technique:**
   - Selects 20% of positive samples as "spies"
   - Mixes spies with unlabeled data
   - Trains Naive Bayes classifier
   - Computes probability threshold: μ - σ
   - Identifies reliable negatives (P(positive) < threshold)

3. **Separability Analysis:**
   - Pearson correlation matrices by class
   - Variance Inflation Factor (VIF) for multicollinearity
   - PCA visualization (2 components)
   - Bhattacharyya distance
   - Mahalanobis distance
   - Silhouette score

**GEE Workflow:**

4. **Random Forest Classification:**
   - 100 decision trees
   - 80/20 train-test split
   - Uses combined dataset (labeled + reliable negatives)
   - Computes confusion matrix and accuracy metrics
   - Extracts variable importance scores

5. **Post-processing:**
   - Focal mode filter (3x3 window) to reduce salt-and-pepper noise
   - Smoothing of classification output

**Outputs:**
- Classified flood risk image
- Variable importance table
- Accuracy metrics (training and test)

### 4. Unsupervised Classification
**Script:** `3_UnsupervisedSpatialProcessing.js`

Provides alternative classification approaches without labeled data dependency.

**Method 1: K-means Clustering (Weka XMeans)**
- Automatic cluster determination (2-10 clusters)
- Features: elevation, distance, slope, HAND
- Focal mode smoothing applied

**Method 2: HAND Threshold Slicing**
- Three threshold levels: 3m, 4m, 5m
- Binary classification based on height above drainage
- Identifies potentially floodable areas

**Outputs:**
- Clustered image (smoothed)
- Three HAND-based classifications (3m, 4m, 5m thresholds)

### 5. Spatial Post-Processing
**Script:** `4_SpatialPostProcessing.js`

Intersects classification outputs with urban areas and applies area-based filtering.

**Processing Steps:**

1. **Urban Mask Application:**
   - Extracts urban areas (MapBiomas class 24)
   - Intersects with RF, K-means, and HAND classifications

2. **Hotspot Detection:**
   - Connected component analysis (4-connectivity)
   - Minimum area threshold: 3,000 m²
   - Pixel counting and area calculation
   - Filters small isolated pixels

3. **Quality Control:**
   - Removes artifacts below area threshold
   - Identifies coherent flood-prone zones
   - Generates final risk maps

**Outputs:**
- Post-processed RF classification
- Post-processed K-means classification
- Post-processed HAND classifications (3m, 4m, 5m)

### 6. Final Visualization and Susceptibility Index
**Script:** `5_FinalPostProcessingVisualization.js`

Generates flood susceptibility index based on variable importance and creates final visualizations.

**FSIVI Calculation (Flood Susceptibility Index based on Variable Importance):**

```
FSIVI = Σ (wi × fi')
```

Where:
- wi = normalized importance weight of variable i (from RF)
- fi' = normalized value of variable i
- Inversion applied to elevation, distance, slope, conductivity (lower values = higher risk)
- TWI used directly (higher values = higher risk)

**Normalization:**
```
fi' = (fi - min) / (max - min)
```

**Statistical Analysis:**
- Min/max values
- Mean, median, standard deviation
- Variance, kurtosis, skewness
- Percentiles (0, 25, 50, 75, 100)
- Histogram generation

**Area Calculation:**
- Overlap analysis with CPRM risk sectors
- Accuracy percentages for each method
- Hectare-based area quantification

**Visualization Outputs:**
- Heat map (continuous susceptibility index)
- Masked heat map (over classified areas)
- Risk zones (connected components)
- Animated GIF (risk levels 99%-75%)
- Highlighted attention regions

**Exports:**
- Final susceptibility rasters
- Statistical summary tables
- Video animation (1 fps, 1024px)
- Region-of-interest shapefiles

## Data Sources

| Dataset | Source | Resolution | Purpose |
|---------|--------|------------|---------|
| HAND | Global HAND (Gena) | 30m | Flood proximity to drainage |
| DEM | ANADEM Brazil | 30m | Elevation modeling |
| TWI | QGIS SAGA | 10m | Wetness index |
| Ksat | HiHydroSoil v2.0 | 250m | Soil hydraulic properties |
| Land Cover | MapBiomas S2 Beta | 10m | Urban area identification |
| Risk Sectors | CPRM/SGB | Vector | Validation reference |
| Drainage | Local database | Vector | River network |

## Requirements

### Google Earth Engine (JavaScript API)
- Earth Engine account with asset storage
- Access to public datasets (Dynamic World, ANADEM, MapBiomas)
- Community catalog datasets (HAND, HiHydroSoil)

### Python (Google Colab or Local)
```python
pandas>=1.3.0
numpy>=1.21.0
scikit-learn>=0.24.0
imbalanced-learn>=0.8.0
seaborn>=0.11.0
matplotlib>=3.4.0
statsmodels>=0.12.0
scipy>=1.7.0
```

## Execution Order

1. **GEE Step 1:** Run `2.1_Streams_and_RiverDistance.js`
   - Computes distance to rivers
   - Exports distance raster to Assets

2. **GEE Step 2:** Run `2.2_SpatialDatasetGeneration.js`
   - Requires: distance raster from Step 1
   - Generates multi-band stack and training samples
   - Exports dataset to Drive and Assets

3. **Python Step 3:** Run `2.n_6.n_DataProcessToSemiSuperv_and_SeparabilityAnalysis.ipynb`
   - Section 1: Data balancing and Spy technique
   - Exports `combined_dataset.csv`
   - Upload to GEE Assets
   - Section 2 (optional): Separability analysis

4. **GEE Step 4:** Run `3_SemiSupervisedSpatialProcessing.js`
   - Requires: combined_dataset from Step 3
   - Trains Random Forest classifier
   - Exports classification and variable importance

5. **GEE Step 5:** Run `3_UnsupervisedSpatialProcessing.js`
   - Alternative classifications (K-means, HAND)
   - Exports classification results

6. **GEE Step 6:** Run `4_SpatialPostProcessing.js`
   - Requires: outputs from Steps 4 and 5
   - Applies urban mask and area filtering
   - Exports post-processed classifications

7. **GEE Step 7:** Run `5_FinalPostProcessingVisualization.js`
   - Requires: outputs from Step 6
   - Generates FSIVI
   - Creates visualizations and exports

## Configuration

Before running scripts, update the following variables:

**Asset Paths:**
```javascript
var assetPathFlood = '/assets/FloodProject/';  // Your GEE asset path
```

**External Variables (to be defined):**
```javascript
var geometry;                    // Study area ROI
var risk_sector;                 // CPRM risk sectors shapefile
var stream_river_urain_pgm;      // Additional streams
var point_Cluster;               // Reference point for cluster ID
var geometry_forgif;             // Clipping geometry for animations
var point_text;                  // Text annotation position
var flood_risk_area_adjustment;  // Manual adjustment polygon
var attention_regions_*;         // Highlighted regions
```

## Key Parameters

**Spatial Resolution:** 10 meters (resampled from various sources)

**Classification Thresholds:**
- HAND: 3m, 4m, 5m
- Minimum hotspot area: 3,000 m²
- Distance calculation range: 2,500 m

**Machine Learning:**
- Random Forest trees: 100
- Train-test split: 80/20
- SMOTE sampling strategy: 0.2
- Spy fraction: 20% of positive class

**Connectivity:**
- 4-connected (cross kernel)
- Maximum component size: 1,024 pixels

## Outputs Description

### Raster Outputs (GeoTIFF format)
- `river_distance`: Euclidean distance to drainage (m)
- `raster_spatial_data_flood`: Multi-band feature stack
- `img_ClassifiedSemiSuperv_flood_risk`: RF classification (binary)
- `img_ClassifiedUnsuperv_flood_risk`: K-means clustering
- `img_ClassifiedSliced_flood_risk_height[3|4|5]m`: HAND thresholding
- `imgPostClassified[SemiSuperv|Unsuperv|SlicedHAND_*]_floodRisk`: Post-processed (urban + area filtered)
- `Heat_map_flood_risk_postClassif`: FSIVI continuous index
- `Heat_map_over_flood_risk_masked_postClassif`: FSIVI over classified areas

### Vector Outputs (Shapefile format)
- `rivers_streams_pgm`: Unified drainage network
- `datasetFlood_toDrive`: Training samples (CSV)
- `combined_dataset`: Balanced dataset with reliable negatives (CSV)
- `dataSeparabilityEvaluation`: Separability analysis samples (CSV)
- `highlighted_regions`: Priority attention areas

### Tables
- `importance_attributes_flood`: Variable importance scores
- Confusion matrices (printed to console)
- Statistical summaries (console output)

### Animations
- `floodRisk_animation.gif`: Risk progression (99%-75% thresholds)

## Validation

The methodology includes multiple validation approaches:

1. **Comparison with CPRM/SGB Risk Sectors:**
   - Area overlap calculation
   - Percentage accuracy metrics
   - Visual concordance assessment

2. **Classification Metrics:**
   - Confusion matrix (training and test)
   - Overall accuracy
   - Class-specific performance

3. **Separability Indices:**
   - Pearson correlation analysis
   - VIF for multicollinearity detection
   - Bhattacharyya distance
   - Mahalanobis distance
   - Silhouette score

4. **Cross-method Comparison:**
   - Semi-supervised vs unsupervised vs threshold-based
   - Consistency analysis across approaches

## Citation

If you use this code in your research, please cite:

```
[Author names]. (2026). Flood Susceptibility Zoning in Urban Areas of 
Paragominas-PA Using Machine Learning Techniques and Wide Coverage Data. 
[Conference/Journal Name].
```

## License

[Specify your license here]

## Contact

For questions or collaborations, please contact:
- Gilberto N S Jr
- [Add contact information]

## Acknowledgments

- Google Earth Engine platform
- CPRM/SGB for risk sector data
- MapBiomas project
- ANADEM team
- Community dataset contributors

## References

Key datasets and methodologies:
1. Global HAND: https://gee-community-catalog.org/projects/hand/
2. ANADEM: https://www.ufrgs.br/hge/anadem-modelo-digital-de-terreno-mdt/
3. HiHydroSoil: https://gee-community-catalog.org/projects/hihydro_soil/
4. MapBiomas: https://brasil.mapbiomas.org/
5. CPRM Risk Sectors: https://geoportal.sgb.gov.br/desastres/
