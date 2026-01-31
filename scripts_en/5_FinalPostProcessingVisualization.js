/***************************************************************
 * PROJECT: Urban Flood Susceptibility Mapping
 * PLATFORM: Google Earth Engine (JavaScript)
 * AUTHOR: Gilberto Junior
 * DESCRIPTION:
 *  - Calculation of flood risk areas in urban regions
 *  - Evaluation of classifications (unsupervised, semi-supervised and HAND)
 *  - Generation of flood susceptibility map
 *  - Export of results (tables, images and GIF)
 ***************************************************************/

//Area calculation function (in hectares)
var areaCalculate = function(img,geom){
      //The input image is multiplied by an image.pixelArea
      //The image.pixelArea has the value where each pixel is the area of that pixel in square meters.
      var areaImg = img.multiply(ee.Image.pixelArea());
    
      //Performs the sum of the multiplied image of the resulting image area within the specified geometry (geom). 
      //This is done using an Earth Engine reducer ee.Reducer.sum().
      var area = areaImg.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: geom,
        maxPixels: 1e11,
        scale:10
      })
      
      //Transforms the summed value to hectares and rounds to remove digits after decimal point
      var areaValue = ee.Number(area.values().get(0)).divide(10000) 
      
      //print("Area in hectare:",areaValue)
      return areaValue
    }

//Land use and land cover mask
var spatial_data = ee.Image('/raster_spatial_data_flood')
var land_cover = spatial_data.select('landcover_classification_2022')
var unique_class_values = ee.List([24]) //urban area class (24), Wetland and Swamp Area, Rivers and Lakes and Ocean
//print(unique_class_values)
var landcover_mask = land_cover.remap(unique_class_values, unique_class_values)
landcover_mask = land_cover.updateMask(landcover_mask)
//Map.addLayer(landcover_mask,{},'Land use and land cover mask',false)
landcover_mask = landcover_mask.gt(0).selfMask().unmask(0).rename('risk_sector')
//Map.addLayer(landcover_mask,{},"Land cover mask",false)

var flood_risk_sector = risk_sector.filter(ee.Filter.eq('tipolo_g1', 'Inundação'))
var img_flood_risk_sector_area = ee.Image(1).rename("risk_sector").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(flood_risk_sector)
//print(img_flood_risk_sector_area)
//Map.addLayer(img_flood_risk_sector_area)

var img_flood_risk_sector_area_LandCover = img_flood_risk_sector_area.add(landcover_mask)
img_flood_risk_sector_area_LandCover = img_flood_risk_sector_area_LandCover.gte(2).selfMask()
//Map.addLayer(img_flood_risk_sector_area_LandCover,{bands: ["risk_sector"],opacity: 1, palette: ["ff1f12"]},'flood sector in urban region',false)

var adjustImg_forAreaCalculation = ee.Image.constant(1).clip(flood_risk_area_adjustment)
//Map.addLayer(adjustImg_forAreaCalculation)

img_flood_risk_sector_area_LandCover = img_flood_risk_sector_area_LandCover.blend(adjustImg_forAreaCalculation)
//Map.addLayer(img_flood_risk_sector_area_LandCover)

var flood_risk_sector_area = areaCalculate(img_flood_risk_sector_area_LandCover,flood_risk_sector)
print("Area of risk sectors in urban regions", flood_risk_sector_area)

var clusteredImage_floodRisk = ee.Image('/imgPostClassifiedUnsuperv_floodRisk')
var clusteredImage_floodRisk_filled = clusteredImage_floodRisk.blend(adjustImg_forAreaCalculation);
var clusteredImage_floodRisk_area = clusteredImage_floodRisk_filled
.select("cluster").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(flood_risk_sector)
//Map.addLayer(clusteredImage_floodRisk_area,{},'clusteredImage_floodRisk')
var clustered_flood_risk_sector_area = areaCalculate(clusteredImage_floodRisk_area,flood_risk_sector)
print('Unsupervised classified area (clustered) over risk sectors:', clustered_flood_risk_sector_area)

var classifiedImage_floodRisk = ee.Image('/imgPostClassifiedSemiSuperv_floodRisk')
var classifiedImage_floodRisk_filled = classifiedImage_floodRisk.blend(adjustImg_forAreaCalculation);
var classifiedImage_floodRisk_area = classifiedImage_floodRisk_filled
.select("classification").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(flood_risk_sector)
//Map.addLayer(classifiedImage_floodRisk_area,{},'classifiedImage_floodRisk')
var classified_flood_risk_sector_area = areaCalculate(classifiedImage_floodRisk_area,flood_risk_sector)
print('Semi-supervised classified area over risk sectors:',classified_flood_risk_sector_area)


var classifiedImageHAND3m_floodRisk = ee.Image('/imgPostClassifiedSlicedHAND_3m_floodRisk')
var classifiedImageHAND3m_floodRisk_filled = classifiedImageHAND3m_floodRisk.blend(adjustImg_forAreaCalculation);
var classifiedImageHAND3m_floodRisk_area = classifiedImageHAND3m_floodRisk_filled
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(flood_risk_sector)
var classifiedHAND3m_flood_risk_sector_area = areaCalculate(classifiedImageHAND3m_floodRisk_area,flood_risk_sector)
print('Sliced classified area (HAND 3 meters) over risk sectors:', classifiedHAND3m_flood_risk_sector_area)

var classifiedImageHAND4m_floodRisk = ee.Image('/imgPostClassifiedSlicedHAND_4m_floodRisk')
var classifiedImageHAND4m_floodRisk_filled = classifiedImageHAND4m_floodRisk.blend(adjustImg_forAreaCalculation);
var classifiedImageHAND4m_floodRisk_area = classifiedImageHAND4m_floodRisk_filled
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(flood_risk_sector)
var classifiedHAND4m_flood_risk_sector_area = areaCalculate(classifiedImageHAND4m_floodRisk_area,flood_risk_sector)
print('Sliced classified area (HAND 4 meters) over risk sectors:', classifiedHAND4m_flood_risk_sector_area)

var classifiedImageHAND5m_floodRisk = ee.Image('/imgPostClassifiedSlicedHAND_5m_floodRisk')
var classifiedImageHAND5m_floodRisk_filled = classifiedImageHAND5m_floodRisk.blend(adjustImg_forAreaCalculation);
var classifiedImageHAND5m_floodRisk_area = classifiedImageHAND5m_floodRisk_filled
.select("classification_hand").reproject({
  crs: 'EPSG:4326',
  scale: 10
}).clip(flood_risk_sector)
//Map.addLayer(classifiedImage_floodRisk_area,{},'classifiedImage_floodRisk')
var classifiedHAND5m_flood_risk_sector_area = areaCalculate(classifiedImageHAND5m_floodRisk_area,flood_risk_sector)
print('Sliced classified area (HAND 5 meters) over risk sectors:', classifiedHAND5m_flood_risk_sector_area)


var percentage_ClassificationHAND_3m = (classifiedHAND3m_flood_risk_sector_area.divide(flood_risk_sector_area)).multiply(100)
print("Percentage of accuracy of sliced classification (HAND 3 meters) over CPRM Flood region",percentage_ClassificationHAND_3m)
var percentage_ClassificationHAND_4m = (classifiedHAND4m_flood_risk_sector_area.divide(flood_risk_sector_area)).multiply(100)
print("Percentage of accuracy of sliced classification (HAND 4 meters) over CPRM Flood region",percentage_ClassificationHAND_4m)
var percentage_ClassificationHAND_5m = (classifiedHAND5m_flood_risk_sector_area.divide(flood_risk_sector_area)).multiply(100)
print("Percentage of accuracy of sliced classification (HAND 5 meters) over CPRM Flood region",percentage_ClassificationHAND_5m)

var percentage_Cluster = (clustered_flood_risk_sector_area.divide(flood_risk_sector_area)).multiply(100)
print("Percentage of accuracy of unsupervised classification (clustering) over CPRM Flood region",percentage_Cluster)
var percentage_Classification = (classified_flood_risk_sector_area.divide(flood_risk_sector_area)).multiply(100)
print("Percentage of accuracy of semi-supervised classification (random forest) over CPRM Flood region",percentage_Classification)

//Export data to identify class separability in python.
var risk_sector_geometr_buffer1000 = risk_sector.geometry().buffer(1700,0)// to make the classification area smaller just decrease this buffer value
//Map.addLayer(risk_sector_geometr_buffer1000,{},"flood_risk_sector_CPRM 1000m buffer",false)

var spatial_data_with_classifications = spatial_data.addBands(clusteredImage_floodRisk.select('cluster').unmask(0))
spatial_data_with_classifications = spatial_data_with_classifications.addBands(classifiedImageHAND5m_floodRisk.select('classification_hand').unmask(0))
spatial_data_with_classifications = spatial_data_with_classifications.addBands(classifiedImage_floodRisk.select('classification').unmask(0))

var bands_evalSeparability  = ['elevation', 'distance', 'slope', 'soil_hydraulic_conductivity','hand','twi','classification','cluster','classification_hand']
spatial_data_with_classifications = spatial_data_with_classifications.select(bands_evalSeparability).clip(risk_sector_geometr_buffer1000)
//Map.addLayer(spatial_data_with_classifications)

var dataSeparabilityEvaluation = spatial_data_with_classifications.sample({
  //numPixels: 4000,
  region: risk_sector_geometr_buffer1000,
  scale: 10,                 
  geometries: true
});

Export.table.toDrive({
		collection: dataSeparabilityEvaluation,
	  description: "dataSeparabilityEvaluation",
	  folder:"floodProjectAssets",
})

// Visualize in console
//Map.addLayer(dataSeparabilityEvaluation, {color: 'blue'}, 'Sample Pixel Points',false)
print('Number of separability samples',dataSeparabilityEvaluation.size())

//---------------

var flood_sectors_postClassif = classifiedImage_floodRisk.select('classification').connectedComponents({
  connectedness: ee.Kernel.plus(1),
  maxSize: 1024//128
});
//print(flood_sectors_postClassif)

//----------------

//Risk heat map
var buffer_risk_sector_geometr = risk_sector.geometry().buffer(200,0)
//Map.addLayer(buffer_risk_sector_geometr,{},"flood_risk_sector_CPRM 200m buffer",false)

var spatial_data = ee.Image('/raster_spatial_data_flood')
//print(spatial_data)
var bands  = ['elevation', 'distance', 'slope', 'soil_hydraulic_conductivity','hand','twi','landcover_classification_2022']
var elevation = spatial_data.select(['elevation'])

// Reduce the image within the buffer region to find the maximum value
var maxElevation = elevation.reduceRegion({
  reducer: ee.Reducer.max(),
  geometry: buffer_risk_sector_geometr,
  scale: 10,  // adjust according to your raster resolution
  maxPixels: 1e10
});

// Print the maximum value in the console
var maxElevation_value = maxElevation.get('elevation').getInfo()
//print('Maximum elevation value in buffer:', maxElevation_value)

var mask = elevation.lte(maxElevation_value)  // lte = less than or equal

// Step 3: Apply mask to elevation image
var elevation_masked = elevation.updateMask(mask)

//Map.addLayer(elevation_masked, {min: 0, max: maxElevation_value, palette: ['blue', 'green', 'yellow']}, 'Masked elevation ≤ maximum value')

var land_cover_soil = spatial_data.select(['landcover_classification_2022']).eq(24)

var elevation_masked_final = elevation_masked.updateMask(land_cover_soil);

//Map.addLayer(elevation_masked_final, {min: 0, max: maxElevation_value, palette: ['blue', 'green', 'yellow']},  'Masked elevation + land use = 24');

var spatial_data_bandsOfInterest = spatial_data.select([
  'elevation', 
  'distance', 
  'slope', 
  'soil_hydraulic_conductivity',
  'hand',
  'twi'
]);

// Apply the final mask (elevation + land use) to all these bands
var img_spatial_data_bandsOfInterest = spatial_data_bandsOfInterest.updateMask(elevation_masked_final.mask());

// Visualize (for example, the 'distance' band)
//Map.addLayer(img_spatial_data_bandsOfInterest,{},"Selected bands")
//print(img_spatial_data_bandsOfInterest)

/*
elevation_norm      = (elevation - minElev) / (maxElev - minElev);
river_dist_norm     = (river_dist - minDist) / (maxDist - minDist);
slope_norm          = (slope - minSlope) / (maxSlope - minSlope);
conductivity_norm   = (conductivity - minConduc) / (maxConduc - minConduc);
hand_norm = (hand - minHand) / (maxHand - minHand);
twi_norm = (twi - minTwi) / (maxTwi - minTwi);
*/

// Calculate min and max values of each band within the buffer
var stats = img_spatial_data_bandsOfInterest.reduceRegion({
  reducer: ee.Reducer.minMax(),
  scale: 10,
  maxPixels: 1e10
});
//print(stats)

// Extract numeric values
var minElev   = ee.Number(stats.get('elevation_min'));
var maxElev   = ee.Number(stats.get('elevation_max'));
var minDist   = ee.Number(stats.get('distance_min'));
var maxDist   = ee.Number(stats.get('distance_max'));
var minSlope = ee.Number(stats.get('slope_min'));
var maxSlope = ee.Number(stats.get('slope_max'));
var minConduc = ee.Number(stats.get('soil_hydraulic_conductivity_min'));
var maxConduc = ee.Number(stats.get('soil_hydraulic_conductivity_max'));
var minHand = ee.Number(stats.get('hand_min'));
var maxHand = ee.Number(stats.get('hand_max'));
var minTwi = ee.Number(stats.get('twi_min'));
var maxTwi = ee.Number(stats.get('twi_max'));

// Normalizations using .expression()
var elevation_norm = img_spatial_data_bandsOfInterest.expression(
  '(e - minE) / (maxE - minE)', {
    'e': img_spatial_data_bandsOfInterest.select('elevation'),
    'minE': minElev,
    'maxE': maxElev
  }).rename('elevation_norm');

var distance_norm = img_spatial_data_bandsOfInterest.expression(
  '(d - minD) / (maxD - minD)', {
    'd': img_spatial_data_bandsOfInterest.select('distance'),
    'minD': minDist,
    'maxD': maxDist
  }).rename('distance_norm');

var slope_norm = img_spatial_data_bandsOfInterest.expression(
  '(s - minS) / (maxS - minS)', {
    's': img_spatial_data_bandsOfInterest.select('slope'),
    'minS': minSlope,
    'maxS': maxSlope
  }).rename('slope_norm');

var conductivity_norm =img_spatial_data_bandsOfInterest.expression(
  '(c - minC) / (maxC - minC)', {
    'c': img_spatial_data_bandsOfInterest.select('soil_hydraulic_conductivity'),
    'minC': minConduc,
    'maxC': maxConduc
  }).rename('conductivity_norm');
  
var hand_norm =img_spatial_data_bandsOfInterest.expression(
  '(h - minH) / (maxH - minH)', {
    'h': img_spatial_data_bandsOfInterest.select('hand'),
    'minH': minHand,
    'maxH': maxHand
  }).rename('hand_norm');
  
var twi_norm =img_spatial_data_bandsOfInterest.expression(
  '(t - minT) / (maxT - minT)', {
    't': img_spatial_data_bandsOfInterest.select('twi'),
    'minT': minTwi,
    'maxT': maxTwi
  }).rename('twi_norm');    

// Combine all normalized bands
var normalized_image = elevation_norm
  .addBands(distance_norm)
  .addBands(slope_norm)
  .addBands(conductivity_norm)
  .addBands(hand_norm)
  .addBands(twi_norm);

var weights = ee.FeatureCollection('/importance_attributes_flood')
var props = ee.Feature(weights.first()).toDictionary();
//print('All properties:', props);

var import_slope =  ee.Number(props.get('slope'))
var import_elevation =  ee.Number(props.get('elevation'))
var import_distance=  ee.Number(props.get('distance'))
var import_conductivity =  ee.Number(props.get('soil_hydraulic_conductivity'))
var import_hand =  ee.Number(props.get('hand'))
var import_twi =  ee.Number(props.get('twi'))

var sum_weights = import_conductivity.add(import_slope).add(import_distance).add(import_elevation).add(import_hand).add(import_twi)
//print(sum_weights)
  
var weight_slope = import_slope.divide(sum_weights)
var weight_elevation = import_elevation.divide(sum_weights)
var weight_distance = import_distance.divide(sum_weights)
var weight_soil_hydraulic_conductivity = import_conductivity.divide(sum_weights)
var weight_hand = import_hand.divide(sum_weights)
var weight_twi = import_twi.divide(sum_weights)
print("Feature weights: (weight_slope,weight_elevation,weight_distance,weight_soil_hydraulic_conductivity,weight_hand,weight_twi) ", weight_slope,weight_elevation,weight_distance,weight_soil_hydraulic_conductivity,weight_hand,weight_twi)

var img_flood_risk = normalized_image.expression(
  'weight_sl * (1 - sl) + weight_el * (1 - el) + weight_di * (1 - di) + weight_co * (1 - co) + weight_ha * (1 - ha) + weight_tw * (tw)', {
    'sl': normalized_image.select('slope_norm'),
    'el': normalized_image.select('elevation_norm'),
    'di': normalized_image.select('distance_norm'),
    'co': normalized_image.select('conductivity_norm'),
    'ha': normalized_image.select('hand_norm'),
    'tw': normalized_image.select('twi_norm'),
    'weight_sl': weight_slope,
    'weight_el': weight_elevation,
    'weight_di': weight_distance,
    'weight_co': weight_soil_hydraulic_conductivity,
    'weight_ha': weight_hand,
    'weight_tw': weight_twi,
  }).rename('flood_susceptibility');

//{min: 0.34, max: 0.96, palette: ['#1a9850', '#fee08b', '#d73027']}
//Map.addLayer(img_flood_risk,imageVisParam2,"Heat Map - Flood Risk")
img_flood_risk = img_flood_risk.focal_mean({radius: 1, units: 'pixels', kernel: ee.Kernel.square(1)})

var imageVisParam3 ={ bands: ["flood_susceptibility"],
max: 0.9534484538232613,
min: 0.3699895127314622,
opacity: 1,
palette: ["22dd0e","f9fe31","d70c0c"]}

Map.addLayer(img_flood_risk,imageVisParam3,"Heat Map - Flood Risk (smooth by mean)")

Map.addLayer(flood_sectors_postClassif.randomVisualizer(), null, 'Risk Zones');
//Map.addLayer(img_flood_risk.gte(0.83),imageVisParam2,"Heat Map - Flood Risk level 83%")

var riskMask = classifiedImage_floodRisk.select('classification');
riskMask = riskMask.updateMask(riskMask.mask());
var img_flood_risk_masked = img_flood_risk.select('flood_susceptibility').updateMask(riskMask);   
Map.addLayer(img_flood_risk_masked,imageVisParam3,"Heat Map over Flood Risk")

// Calculate statistics on generated image
var minmax_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.minMax(),
  scale: 10,
  maxPixels: 1e10
});
print("minmax_img_risk",minmax_img_risk)

var mean_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.mean(),
  scale: 10,
  maxPixels: 1e10
});
print("mean_img_risk",mean_img_risk)

var median_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.median(),
  scale: 10,
  maxPixels: 1e10
});
print("median_img_risk",median_img_risk)

var stdDev_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.stdDev(),
  scale: 10,
  maxPixels: 1e10
});
print("stdDev_img_risk",stdDev_img_risk)

var variance_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.variance(),
  scale: 10,
  maxPixels: 1e10
});
print("variance_img_risk",variance_img_risk)

var kurtosis_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.kurtosis(),
  scale: 10,
  maxPixels: 1e10
});
print("kurtosis_img_risk",kurtosis_img_risk)

var skew_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.skew(),
  scale: 10,
  maxPixels: 1e10
});
print("skew_img_risk",skew_img_risk)

var percentile_img_risk = img_flood_risk.reduceRegion({
  reducer: ee.Reducer.percentile([0, 25, 50,75, 100]),
  scale: 10,
  maxPixels: 1e10
});
print("percentile_img_risk",percentile_img_risk)

Map.addLayer(flood_risk_sector,{},"CPRM risk sectors")

// 5. Display histogram in console
var hist = ui.Chart.image.histogram({
  //image: img_flood_risk_masked,//
  image: img_flood_risk,
  region: geometry,
  scale: 10,  // spatial resolution
  //minBucketWidth: 10  // minimum histogram bucket width
}).setOptions({
  title: 'Histogram - FSIVI (Flood Susceptibility Index based on Variable Importance)',
  hAxis: {title: 'Pixel value'},
  vAxis: {title: 'Frequency'},
  series: [{color: 'purple'}]
});
print(hist);

// Import geetools text library
var Text = require('users/gena/packages:text');
// List of levels from 99 to 75
var levels = ee.List.sequence(99, 75, -1);
// Use iterate to build list of images
var image_forGif_list = levels.iterate(function(level, list) {
  level = ee.Number(level);
  var label = ee.String('Risk level ')
  .cat(level.format('%d'))
  .cat('%');

  list = ee.List(list);
  var level_prob = level.divide(100);
  var image_forGif = img_flood_risk.gte(level_prob).clip(geometry_forgif).focal_mean({radius: 1, units: 'pixels', kernel: ee.Kernel.square(1)});
  //var image_forGif = img_flood_risk_masked.gte(level_prob).clip(geometry_forgif).focal_mean({radius: 1, units: 'pixels', kernel: ee.Kernel.square(1)});

  var text = Text.draw(label, point_text, 10, {
    fontSize: 32,
    textColor: 'FFFFFF',
    outlineColor: '000000',
    outlineWidth: 2
  });
  var image_forGif_text = image_forGif.visualize({
    palette: ["22dd0e", "f9fe31", "d70c0c"]
  }).blend(text);
  return list.add(image_forGif_text);
}, ee.List([]));
// Convert result to ImageCollection
image_forGif_list = ee.List(image_forGif_list);
var collection_imgs = ee.ImageCollection(image_forGif_list);
print(collection_imgs);
//Map.addLayer(collection_imgs.first(), {}, 'First image with text');

var videoArgs = {
  dimensions: 1024,
  region: geometry_forgif,
  framesPerSecond: 1,
  format: 'gif',
  min: 0.3699895127314622,
  max: 0.9534484538232613,
  palette: ["22dd0e","f9fe31","d70c0c"]
};
//low resolution preview
print(ui.Thumbnail(collection_imgs))//, videoArgs));

// Export as video
Export.video.toDrive({
  collection: collection_imgs,
  description: 'video_floodrisk_PGM',
  fileNamePrefix: 'floodRisk_animation',
  framesPerSecond: 1,
  region: geometry_forgif,
  dimensions: 1024,
  folder:"floodProjectAssets",
});

var assetPathFlood = '/assets/FloodProject/'; 

Export.image.toAsset({
      image:img_flood_risk,
      description:"Heat_map_flood_risk_postClassif",
      assetId:assetPathFlood+"Heat_map_flood_risk_postClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_flood_risk,
  description: 'Heat_map_flood_risk_postClassif', 
  folder:"floodProjectAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_flood_risk_masked,
      description:"Heat_map_over_flood_risk_masked_postClassif",//Heat Map over Flood Risk
      assetId:assetPathFlood+"Heat_map_over_flood_risk_masked_postClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_flood_risk_masked,
  description: 'Heat_map_over_flood_risk_masked_postClassif', 
  folder:"floodProjectAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:flood_sectors_postClassif.randomVisualizer(),
      description:"Risk_zones_flood_postClassif",
      assetId:assetPathFlood+"Risk_zones_flood_postClassif",
      region:geometry_forgif,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: flood_sectors_postClassif.randomVisualizer(),
  description: 'Risk_zones_flood_postClassif', 
  folder:"floodProjectAssets",
  region: geometry_forgif, 
  scale: 10, 
  maxPixels: 1e10
});

var highlighted_regions = ee.FeatureCollection([
attention_regions_floodStart99,
attention_regions_floodStart96,
attention_regions_floodStart95,
attention_regions_floodStart90,
attention_regions_floodStart89,
attention_regions_floodStart88
])
Map.addLayer(highlighted_regions,{},"highlighted_regions")
Export.table.toDrive({
  collection: highlighted_regions,
  description: 'highlighted_regions',
  folder:"floodProjectAssets",
});
