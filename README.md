# Urban Flood Susceptibility Mapping Using Semi-Supervised Machine Learning

## Overview

This repository contains the complete implementation of an urban flood susceptibility assessment system for Paragominas, Pará, Brazil. The framework integrates semi-supervised machine learning with geospatial data processing in Google Earth Engine (GEE) and Python to identify flood-prone areas in urban regions. The methodology employs the Spy Technique for reliable negative sample identification, Random Forest classification, and generates a weighted susceptibility index (FSIVI - Flood Susceptibility Index based on Variable Importance).

## Abstract

Urban flooding is a critical environmental hazard that requires accurate susceptibility mapping for effective risk mitigation and urban planning. This study presents a comprehensive geospatial framework that combines multiple hydrological and topographic variables with advanced machine learning techniques. The system processes seven key features—HAND (Height Above Nearest Drainage), DEM-derived elevation and slope, TWI (Topographic Wetness Index), soil hydraulic conductivity, distance to rivers, and land cover—using three complementary classification approaches:

1. **Semi-supervised Random Forest** using the Spy Technique for reliable negative sample identification from unlabeled data
2. **Unsupervised K-means clustering** for pattern discovery without labeled training data
3. **HAND-based threshold slicing** at 3m, 4m, and 5m heights for physically-informed classification

The final output is the FSIVI (Flood Susceptibility Index based on Variable Importance), a weighted continuous index that normalizes all geophysical variables and applies Random Forest-derived importance weights to generate a comprehensive flood susceptibility map. The methodology includes rigorous separability analysis using Pearson correlation, VIF (Variance Inflation Factor), PCA visualization, and Bhattacharyya/Mahalanobis distances to ensure class discrimination quality.

## Repository Structure

```
flood-ml-paragominas/
├── scripts/                           # Main implementation scripts
│   ├── 1_DataExploration_and_InitialDisplay.js
│   ├── 2.1_Streams_and_RiverDistance.js
│   ├── 2.2_SpatialDatasetGeneration.js
│   ├── 2.n_6.n_DataProcessToSemiSuperv_and_SeparabilityAnalysis.ipynb
│   ├── 3_UnsupervisedSpatialProcessing.js
│   ├── 3_SemiSupervisedSpatialProcessing.js
│   ├── 4_SpatialPostProcessing.js
│   ├── 5_FinalPostProcessingVisualization.js
│   └── files/                         # Data files and outputs
│       ├── combined_dataset.csv       # Balanced dataset (41,486 samples)
│       ├── separabilityEvaluationData.csv  # Separability samples (387,098)
│       ├── floodDataset_toAsset.csv   # Initial dataset (38,572 samples)
│       ├── *.tif                      # Raster outputs (15 files, gitignored)
│       ├── twi_par.txt                # TWI file reference (large .tif excluded)
│       ├── Maps and Images/           # Visualizations
│       │   └── Paragominas.qgz        # QGIS project for TWI generation
│       └── shapefiles/                # Vector data (gitignored)
├── .gitignore                         # Excludes large files (*.tif, *.zip, *.rar)
├── LICENSE
└── README.md                          # This file
```

## Methodology Workflow

All scripts are located in the `scripts/` directory. Execute them in the order indicated below.

**Important Note on Data Files:**  
Large raster files (*.tif, 50-200 MB each) and shapefiles (*.zip, *.rar) are excluded from this repository via `.gitignore` to comply with GitHub's 100 MB file size limit. These files are generated during script execution or must be obtained from original data sources. The `twi_par.txt` file contains a reference to the original TWI raster location.

### 0. Initial Data Exploration
**Script:** `1_DataExploration_and_InitialDisplay.js`

Preliminary exploration and visualization of base datasets to understand data characteristics and quality.

**Key Operations:**
- Initial exploration of DEM (ANADEM Brazil, 30m resolution)
- Soil hydraulic conductivity (Ksat) visualization and gap analysis
- Land use/cover inspection (MapBiomas Sentinel-2, class 24 for urban areas)
- **Gap-filling strategy**: Pixels without Ksat data are filled using focal_median (45-pixel radius window)
- Risk sector overlay for validation
- Preliminary data quality assessment

**Purpose:**
- Understand spatial patterns and data completeness
- Identify data quality issues requiring preprocessing
- Establish visualization parameters for subsequent analyses
- Validate geometric extents and projections

### 1. Preprocessing and Distance Calculation
**Script:** `2.1_Streams_and_RiverDistance.js`

Computes Euclidean distance from each pixel to the nearest river or stream using drainage network data.

**Key Operations:**
- Buffer creation around drainage network
- Rasterization of vector data
- Euclidean distance kernel application (max range: 2500m)
- Export to Google Earth Engine Assets

**Inputs:**
- Drainage network shapefile: `/TrechosDrenagemParagominas_Intersesct`
- Additional streams: `corrego_rio_urain_pgm` (FeatureCollection)
- Region of interest (ROI): Urban area boundary geometry
- Base projection: Dynamic World V1 (2024) for standardization

**Outputs:**
- `river_distance.tif`: Distance raster at 10m resolution (meters)
- `rivers_streams_pgm`: Unified drainage vector layer (exported to Assets and Drive)

### 2. Spatial Dataset Generation
**Script:** `2.2_SpatialDatasetGeneration.js`

Assembles multi-band raster stack with geophysical and hydrological variables, generates stratified samples for model training.

**Variables Included:**
- **HAND** (Height Above Nearest Drainage, 30m) - Global HAND dataset (hand-1000 variant with flow threshold = 1000)
- **Elevation** (meters) - ANADEM Brazil DTM with NoData (-9999) removed
- **Slope** (degrees) - Derived from ANADEM DEM using `ee.Terrain.slope()`
- **TWI** (Topographic Wetness Index, dimensionless) - Computed externally in QGIS SAGA
- **Ksat** (Soil Hydraulic Conductivity, cm/day) - HiHydroSoil v2.0 with gap-filling (focal median, 45-pixel radius, bilinear resampling)
- **Distance to rivers** (meters) - From script 2.1
- **Land cover** (classification code) - MapBiomas Sentinel-2 Beta 2022 (class 24 = urban area)

**Sampling Strategy:**
- **Class 0 (unlabeled)**: 39,000 stratified samples from 200m buffer zone around CPRM/SGB risk sectors
- **Class 1 (flood)**: 4,000 stratified samples from within official flood risk sectors
- Random seed: 0 (for reproducibility)
- Sampling scale: 10 meters per pixel

**Processing Steps:**
1. Load and reproject all variables to EPSG:4326 at 10m resolution
2. Apply gap-filling to Ksat (unmask with sentinel value 1000, replace with focal median)
3. Stack all bands into multi-band image: `spatial_data_raster_flood`
4. Generate stratified point samples with class labels
5. Export raster stack to Assets
6. Export sample dataset to Google Drive as `floodDataset_toDrive.csv`

**Outputs:**
- `spatial_data_raster_flood`: Multi-band raster stack (7 bands total)
- `floodDataset_toDrive.csv`: Training/validation samples exported to Google Drive folder `floodProjectAssets`
- Asset exports for GEE pipeline integration

### 3. Semi-Supervised Learning Pipeline
**Scripts:** `2.n_6.n_DataProcessToSemiSuperv_and_SeparabilityAnalysis.ipynb` (Python/Colab) + `3_SemiSupervisedSpatialProcessing.js` (GEE)

Implements Positive-Unlabeled (PU) learning using the **Spy Technique** to transform unlabeled data into reliable negative samples for semi-supervised classification.

#### Part A: Python Workflow (Google Colab)

**1. Data Loading and Exploration:**
- Load `floodDataset_toDrive.csv` from Google Drive
- Feature columns: `distance`, `elevation`, `slope`, `soil_hydraulic_conductivity`, `hand`, `twi`
- Target column: `classes` (0 = unlabeled, 1 = flood)
- Visualizations: histograms, pairplots, boxplots by class

**2. Correlation Analysis:**
- Pearson correlation matrices for all classes, class 0, and class 1 separately
- Heatmap visualizations to identify feature relationships
- Pre-balancing multicollinearity assessment

**3. Multicollinearity Detection (VIF):**
- Variance Inflation Factor calculated for all features
- Identifies redundant variables (VIF > 10 indicates high multicollinearity)
- Computed separately for all classes, class 0, and class 1

**4. SMOTE Oversampling:**
- **Algorithm**: Synthetic Minority Over-sampling Technique (SMOTE)
- **Sampling strategy**: 0.2 (increases positive class by 20%)
- **Purpose**: Balance class distribution for Spy Technique
- Creates synthetic flood samples using k-nearest neighbors interpolation

**5. Spy Technique for Reliable Negative Identification:**
```
Step 1: Select 20% of positive samples randomly as "spies"
Step 2: Mix spies with unlabeled class (class 0)
Step 3: Train Naive Bayes classifier on {spies + unlabeled} vs {remaining positives}
Step 4: Predict probabilities P(positive) for all unlabeled samples
Step 5: Calculate threshold = mean(spy_probabilities) - std(spy_probabilities)
Step 6: Label unlabeled samples with P(positive) < threshold as reliable negatives (class -1)
Step 7: Remove remaining unlabeled samples (uncertain)
```

#### Part B: Google Earth Engine Workflow

**8. Random Forest Classification:**
- **Input**: `combined_dataset` from Colab (uploaded to EE Assets)
- **Features**: `elevation`, `distance`, `slope`, `soil_hydraulic_conductivity`, `hand`, `twi`
- **Target**: `new_class` (1 = flood, -1 = reliable negative)
- **Algorithm**: Random Forest with 100 trees (`ee.Classifier.smileRandomForest`)
- **Data split**: 80% training, 20% testing (random seed = 42)
- **Evaluation**: Confusion matrices for both training and test sets

**9. Spatial Classification:**
- Apply trained RF model to `spatial_data_raster_flood` multi-band image
- Output: Binary classification (0 = no flood, 1 = flood risk)
- Visualization: Red (#ff0606) for flood pixels, white (#ffffff) for non-flood

**10. Smoothing and Export:**
- Focal mode filter (3x3 kernel) to reduce salt-and-pepper noise
- Export classified image: `img_SemiSupervisedClassified_flood_risk`
- Export variable importance table for FSIVI calculation

**Outputs:**
- `img_SemiSupervisedClassified_flood_risk.tif`: Binary classification raster
- Variable importance scores (elevation, distance, slope, Ksat, HAND, TWI)
- Training accuracy metrics (console output)
- Test set confusion matrix and accuracy

### 4. Unsupervised Classification (Alternative Approaches)
**Script:** `3_UnsupervisedSpatialProcessing.js`

Provides label-independent classification methods for comparison and validation of semi-supervised results.

**Method 1: K-means Clustering (Weka XMeans)**
- **Algorithm**: XMeans clusterer with automatic cluster number selection
- **Cluster range**: 2 to 10 clusters (automatically determined)
- **Features used**: `elevation`, `distance`, `slope`, `hand` (4 bands)
- **Post-processing**: Focal mode filter (3x3 kernel) for spatial smoothing
- **Cluster identification**: Reference point (`point_Cluster`) used to identify flood risk cluster ID
- **Output**: `img_UnsupervisedClassified_flood_risk` (smoothed clusters)

**Method 2: HAND Threshold Slicing**
- **Algorithm**: Physical thresholding based on Height Above Nearest Drainage
- **Three threshold levels**:
  - **3 meters**: Conservative estimate (areas very close to drainage)
  - **4 meters**: Moderate flood extent
  - **5 meters**: Liberal estimate (wider flood-prone areas)
- **Classification rule**: HAND ≤ threshold → flood risk (class 1)
- **Smoothing**: Focal mode filter (3x3 kernel) applied to all three outputs
- **Outputs**:
  - `img_SlicedClassified_flood_risk_height3m`
  - `img_SlicedClassified_flood_risk_height4m`
  - `img_SlicedClassified_flood_risk_height5m`

**Rationale:**
- K-means discovers natural clusters without training data
- HAND thresholds provide physically-informed baselines
- Both methods serve as independent validation for RF classification
- Comparison identifies areas of consensus across methodologies

**Outputs:**
- 1 clustered image (K-means)
- 3 HAND-based binary classifications (3m, 4m, 5m thresholds)
- All outputs smoothed and ready for urban area intersection

### 5. Spatial Post-Processing and Urban Area Filtering
**Script:** `4_SpatialPostProcessing.js`

Refines classification outputs by intersecting with urban areas and applying area-based hotspot filtering to remove noise and isolated pixels.

**Processing Steps:**

**1. Urban Area Mask Creation:**
- Extract urban pixels from MapBiomas land cover (class 24)
- Create binary mask: urban = 1, non-urban = 0
- Purpose: Focus flood risk analysis on populated areas

**2. Crossover with Classification Outputs:**
Three independent classifications are intersected with urban mask:

a) **Random Forest (Semi-supervised)**:
   - Input: `img_SemiSupervisedClassified_flood_risk`
   - Operation: `RF_classification + urban_mask ≥ 2` → flood risk in urban area
   - Output: `imgPost_SemiSupervisedClassified_floodRisk`

b) **K-means (Unsupervised)**:
   - Input: `img_UnsupervisedClassified_flood_risk`
   - Reference point identifies flood cluster ID
   - Operation: `(cluster == flood_ID) + urban_mask ≥ 2`
   - Output: `imgPost_UnsupervisedClassified_floodRisk`

c) **HAND Threshold (3m, 4m, 5m)**:
   - Inputs: Three HAND-classified images
   - Operation: `HAND_classification + urban_mask ≥ 2` (for each threshold)
   - Outputs: 
     - `imgPost_SlicedClassifiedHAND_3m_HotSpot`
     - `imgPost_SlicedClassifiedHAND_4m_HotSpot`
     - `imgPost_SlicedClassifiedHAND_5m_HotSpot`

**3. Hotspot Detection (Connected Component Analysis):**
Custom function `hotspotsPorArea()` applies to all five outputs:

- **Connectivity**: 4-connected kernel (`ee.Kernel.plus(1)`) - cross pattern
- **Component labeling**: `connectedComponents()` with maxSize = 1024 pixels
- **Pixel counting**: `connectedPixelCount()` for each labeled object
- **Area calculation**: pixel_count × pixel_area (m²)
- **Area threshold**: Minimum 3,000 m² to be considered valid hotspot
- **Filtering**: Objects below threshold are removed

**Visualization Layers (for each method):**
- Random color visualization of labeled objects
- Pixel count heatmap (1 to 1024 pixels)
- Area heatmap (0 to 3,000,000 m², blue to magenta palette)
- Final hotspots layer (≥ 3,000 m²)

**Quality Control:**
- Removes salt-and-pepper noise (small isolated pixels)
- Identifies coherent flood-prone zones
- Ensures minimum meaningful area for risk designation
- Maintains spatial contiguity

**Outputs:**
- **5 post-processed classifications** (urban-filtered with hotspot analysis):
  - `imgPost_SemiSupervisedClassified_floodRisk` (Random Forest)
  - `imgPost_UnsupervisedClassified_floodRisk` (K-means)
  - `imgPost_SlicedClassifiedHAND_3m_HotSpot`
  - `imgPost_SlicedClassifiedHAND_4m_HotSpot`
  - `imgPost_SlicedClassifiedHAND_5m_HotSpot`
- Visualization layers for component analysis (objects, pixel counts, areas, hotspots)

### 6. Final Visualization and FSIVI Generation
**Script:** `5_FinalPostProcessingVisualization.js`

Generates the final Flood Susceptibility Index based on Variable Importance (FSIVI), performs comparative analysis of all classification methods, and creates comprehensive visualizations.

**A. Area Calculation and Method Comparison:**

1. **Reference Area Calculation:**
   - CPRM/SGB flood risk sectors intersected with urban areas (MapBiomas class 24)
   - Manual adjustment polygon applied for area refinement
   - Baseline area computed in hectares for accuracy assessment

2. **Classification Accuracy Evaluation:**
   Compares three methods against CPRM reference:
   - **Unsupervised** (K-means clustering)
   - **Semi-supervised** (Random Forest with Spy Technique)
   - **HAND threshold-based** (3m, 4m, 5m heights)
   
   For each method:
   - Intersection with CPRM flood sectors
   - Area overlap calculation (hectares)
   - Percentage accuracy relative to reference

**B. FSIVI Calculation (Flood Susceptibility Index based on Variable Importance):**

The core contribution of this work - a weighted continuous susceptibility index that integrates all geophysical variables using Random Forest-derived importance weights.

**Step 1: Spatial Masking**
- Elevation mask: pixels ≤ maximum elevation in 200m buffer around risk sectors
- Urban area mask: MapBiomas class 24 only
- Combined mask applied to all 6 bands

**Step 2: Feature Normalization**
Min-max normalization for each variable:
```
fi' = (fi - min) / (max - min)
```

Variables normalized:
- `elevation_norm`
- `distance_norm` (to rivers)
- `slope_norm`
- `conductivity_norm` (soil hydraulic conductivity)
- `hand_norm`
- `twi_norm`

**Step 3: Variable Importance Weighting**
Weights extracted from Random Forest variable importance scores (from script 3):
- Each importance score normalized to sum = 1.0
- Weights assigned: `w_elevation`, `w_distance`, `w_slope`, `w_conductivity`, `w_hand`, `w_twi`

**Step 4: Risk Inversion**
Physical interpretation requires inversion for certain variables:
- **Inverted** (lower values = higher flood risk): elevation, distance, slope, conductivity
- **Direct** (higher values = higher flood risk): TWI, HAND (already flood-oriented)

Inversion formula:
```
fi_inverted = 1 - fi_norm
```

**Step 5: Weighted Index Calculation**
```
FSIVI = Σ (wi × fi_inverted_or_direct)
      = w_elev×(1-elev_norm) + w_dist×(1-dist_norm) + w_slope×(1-slope_norm)
      + w_cond×(1-cond_norm) + w_hand×hand_norm + w_twi×twi_norm
```

Result: Continuous index from 0 (lowest susceptibility) to 1 (highest susceptibility)

**C. Statistical Analysis:**
- Reduce region statistics: min, max, mean, median, std, variance
- Percentile analysis: 0%, 25%, 50%, 75%, 100%
- Skewness and kurtosis for distribution characterization
- Histogram generation for index distribution
- Export statistical tables to Drive/Assets

**D. Visualization Outputs:**

1. **Continuous Heat Map:**
   - `heat_map_flood_risk_postClassif.tif`
   - Full FSIVI coverage (0-1 scale)
   - Gradient color palette (blue to red)

2. **Masked Heat Map:**
   - `heat_map_over_flood_risk_masked_postClassif.tif`
   - FSIVI overlaid only on RF-classified flood areas
   - Highlights most critical zones

3. **Animated Risk Progression:**
   - `floodRisk_animation.mp4` (1 fps, 1024px)
   - Threshold sequence: 99% → 95% → 90% → 85% → 80% → 75%
   - Shows gradual expansion of risk zones
   - Includes text annotations and highlighted regions

4. **Attention Zones:**
   - Multiple highlighted regions of critical concern
   - Overlay on susceptibility maps
   - Region-specific statistics

5. **Comparative Visualizations:**
   - Side-by-side classification results (RF vs K-means vs HAND)
   - Consensus areas (agreement across methods)
   - Divergence areas for uncertainty quantification

**E. Data Exports:**

1. **Raster Exports:**
   - Final susceptibility indices (heat maps)
   - Post-processed classifications
   - Connected component labels

2. **Vector Exports:**
   - Highlighted attention regions (shapefiles)
   - Risk sector boundaries
   - Sample points for separability analysis (`separabilityEvaluationData.csv`)

3. **Tables:**
   - Statistical summaries
   - Area calculations by method
   - Confusion matrices (from RF classification)

4. **Animations:**
   - Risk progression GIF/MP4
   - Temporal visualization of threshold-based segmentation

**F. Validation Summary:**
Console output includes:
- Total area of CPRM risk sectors in urban regions (hectares)
- Area identified by each classification method (hectares)
- Percentage accuracy for each method vs. CPRM reference
- Variable importance rankings
- FSIVI statistical distribution

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

Execute scripts in the `scripts/` directory following this sequence:

0. **GEE Step 0 (Optional):** Run `1_DataExploration_and_InitialDisplay.js`
   - Initial data exploration and quality assessment
   - Verify data availability and visualization

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

**Important:** Raster files are NOT included in the Git repository due to size constraints (50-200 MB per file). They are generated during script execution and should be stored locally or in Google Earth Engine Assets.

Expected raster outputs:

- `river_distance.tif`: Euclidean distance to drainage (m)
- `twi_par.tif`: Topographic Wetness Index (see twi_par.txt for reference)
- `spatial_data_raster_flood.tif`: Multi-band feature stack (7 bands)
- `img_SemiSupervisedClassified_flood_risk.tif`: RF classification (binary)
- `img_UnsupervisedClassified_flood_risk.tif`: K-means clustering
- `img_SlicedClassified_flood_risk_height3m.tif`: HAND threshold 3m
- `img_SlicedClassified_flood_risk_height4m.tif`: HAND threshold 4m
- `img_SlicedClassified_flood_risk_height5m.tif`: HAND threshold 5m
- `imgPost_SemiSupervisedClassified_floodRisk.tif`: Post-processed RF
- `imgPost_UnsupervisedClassified_floodRisk.tif`: Post-processed K-means
- `imgPost_SlicedClassifiedHAND_3m_HotSpot.tif`: Post-processed HAND 3m
- `imgPost_SlicedClassifiedHAND_4m_HotSpot.tif`: Post-processed HAND 4m
- `imgPost_SlicedClassifiedHAND_5m_HotSpot.tif`: Post-processed HAND 5m
- `heat_map_flood_risk_postClassif.tif`: FSIVI continuous index
- `heat_map_over_flood_risk_masked_postClassif.tif`: FSIVI over classified areas

Current repository includes 15 .tif files (see `scripts/files/`).

### CSV Outputs

Located in `scripts/files/`:

- `floodDataset_toAsset.csv`: Initial training samples (38,572 records)
- `combined_dataset.csv`: Balanced dataset after SMOTE + Spy Technique (41,486 records)
- `separabilityEvaluationData.csv`: Samples for separability analysis (387,098 records)

**Note on Column Names:** CSV files exported from Google Earth Engine use Portuguese column names:
- `condutividade_hidraulica_solo` = soil_hydraulic_conductivity
- `declividade` = slope  
- `distancia` = distance
- `elevacao` = elevation
- `classes` / `new_class` = class labels (0=unlabeled, 1=flood, -1=reliable negative)

### Vector Outputs (Shapefile format)

**Important:** Shapefile archives (*.zip, *.rar) are excluded from the repository via `.gitignore` due to size constraints. These should be obtained from original data sources or generated during script execution.

Expected shapefiles in `scripts/files/shapefiles/`:

- `rivers_streams_pgm.rar`: Unified drainage network (generated by script 2.1)
- `DrainageSectionsParagominas_Intersect.zip`: Drainage sections (input data required)
- `roi.zip`: Region of interest boundary (input data required)
- `risk_sectorization_PGM.rar`: CPRM/SGB risk sectors (input data required)
- `highlighted_regions.rar`: Priority attention areas (generated by script 5)

### Visualizations

**Important:** Visualization outputs (images and videos) are generated during script execution and are not included in the repository to minimize size.

Expected outputs in `scripts/files/Maps and Images/`:

- `HEAT_MAP.jpeg`: Susceptibility heat map
- `ATTENTION_ZONES.jpeg`: High-risk attention zones
- `URBAN_AREA.jpeg`, `URBAN_AREA2.jpeg`: Urban intersection results
- `floodRisk_animation.mp4` / `.gif`: Risk progression animation
- `zone1.jpeg` through `zone22.jpeg`: Detailed zone visualizations
- `Attributes.jpeg`: Variable importance visualization
- `Classes.jpeg`: Classification comparison
- Additional location references and comparative maps

**Currently in repository:**
- `Paragominas.qgz`: QGIS project file used for TWI generation (SAGA tools)

### Tables
- Variable importance scores (exported to Drive/Assets)
- Confusion matrices (printed to console)
- Statistical summaries (console output)

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

## License

MIT License (or specify your chosen license)

## Data Availability

Due to GitHub's file size limitations (100 MB), large data files are excluded from this repository:

**Excluded via `.gitignore`:**
- Raster files (*.tif): 15 files, ~50-200 MB each
- Shapefiles (*.zip, *.rar): Vector data archives
- Visualization outputs: Images and animations

**To reproduce this work:**
1. Input shapefiles must be obtained from CPRM/SGB and local data sources
2. The TWI raster (`twi_par.tif`) must be generated using QGIS SAGA tools (see `Paragominas.qgz`)
3. All other rasters are generated by running scripts 1-7 in sequence
4. Google Earth Engine Assets are required for intermediate data storage

**Included in repository:**
- All 8 processing scripts (~2,600 lines of code)
- 3 CSV datasets (467,156 total records)
- QGIS project file for TWI generation

## Citation

If you use this code or methodology in your research, please cite:

```
[Add your citation here after publication]
```

## Contact

[Add contact information]

## Acknowledgments

This work utilizes publicly available datasets from:
- Global HAND Project
- ANADEM Brazil (UFRGS)
- HiHydroSoil v2.0
- MapBiomas Brasil
- CPRM/Serviço Geológico do Brasil

**Documentation:** This README was prepared with assistance from GitHub Copilot (Claude Sonnet 4.5) for technical documentation, code review, and repository structure optimization.

## References

Key datasets and methodologies:
1. Global HAND: https://gee-community-catalog.org/projects/hand/
2. ANADEM: https://www.ufrgs.br/hge/anadem-modelo-digital-de-terreno-mdt/
3. HiHydroSoil: https://gee-community-catalog.org/projects/hihydro_soil/
4. MapBiomas: https://brasil.mapbiomas.org/
5. CPRM Risk Sectors: https://geoportal.sgb.gov.br/desastres/
