// =============================================================================
// Intersection with urban area (class 24) and post-processing for 3 outputs:
// 1) RF (semi-supervised)   2) K-means (unsupervised)   3) HAND (5m,4m,3m)
// =============================================================================

var spatial_data = ee.Image('/raster_spatial_data_flood')
var region = spatial_data.select(['distance']).geometry(0)

var classifiedImageRF = ee.Image('/img_ClassifiedSemiSuperv_flood_risk')
var clusteredImageKmeans = ee.Image('/img_ClassifiedUnsuperv_flood_risk')
var classifiedSlicedImageHAND_5m = ee.Image('/img_ClassifiedSliced_flood_risk_height5m')
var classifiedSlicedImageHAND_4m = ee.Image('/img_ClassifiedSliced_flood_risk_height4m')
var classifiedSlicedImageHAND_3m = ee.Image('/img_ClassifiedSliced_flood_risk_height3m')

// Land use and land cover mask (select only urban areas - class 24)
var land_cover = spatial_data.select('landcover_classification_2022')
var unique_class_values = ee.List([24]) //urban area class (24)
var landcover_mask = land_cover.remap(unique_class_values, unique_class_values)
landcover_mask = land_cover.updateMask(landcover_mask)
//Map.addLayer(landcover_mask,{},'Land use and land cover mask',false)
landcover_mask = landcover_mask.gt(0).selfMask().unmask(0).rename('classification')
//Map.addLayer(landcover_mask,{},"Land cover mask",false)

// ---- Intersection of supervised classification (RF) with urban mask ---------
var imgClassified_LandCover = classifiedImageRF.add(landcover_mask)
imgClassified_LandCover = imgClassified_LandCover.gte(2).selfMask()
Map.addLayer(imgClassified_LandCover,{bands: ["classification"],opacity: 1, palette: ["ff1f12"]},'Classified Img intersection with LandCover',false)
//------

// ---- Intersection of clustering (K-means) with urban mask -------------------
// Function to get the cluster ID corresponding to the reference point
var get_ClusterId = function(clusterizedImage,point) {
    var ID = clusterizedImage.reduceRegion({
    reducer:ee.Reducer.mean(),
    geometry:point,
    scale:10
    });
    ID = ID.get('cluster');
    return ee.Number.parse(ID);
}
var risk_ClusterId = get_ClusterId(clusteredImageKmeans,point_Cluster);
//print("risk_ClusterId",risk_ClusterId)
landcover_mask = landcover_mask.rename('cluster')
var clusteredImage_LandCover = clusteredImageKmeans.eq(risk_ClusterId.getInfo()).add(landcover_mask)
clusteredImage_LandCover = clusteredImage_LandCover.gte(2).selfMask()
Map.addLayer(clusteredImage_LandCover,{bands: ["cluster"],opacity: 1, palette: ["ff1f12"]},'Clustered Img intersection with LandCover',false)
//------

// ---- Intersection of HAND classification (5 m) with urban mask --------------
var classifiedImageHAND_smooth_5m = classifiedSlicedImageHAND_5m.gte(-9999).clip(region)
//Map.addLayer(classifiedImageHAND_smooth)
var imgClassifiedHAND_LandCover_5m = classifiedImageHAND_smooth_5m.add(landcover_mask).gte(2).selfMask()
//imgClassifiedHAND_LandCover = imgClassifiedHAND_LandCover_5m.gte(2).selfMask()
Map.addLayer(imgClassifiedHAND_LandCover_5m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'Classified HAND 5m Img intersection with LandCover',false)
// ---- Intersection of HAND classification (4 m) with urban mask --------------
var classifiedImageHAND_smooth_4m = classifiedSlicedImageHAND_4m.gte(-9999).clip(region)
var imgClassifiedHAND_LandCover_4m = classifiedImageHAND_smooth_4m.add(landcover_mask).gte(2).selfMask()
Map.addLayer(imgClassifiedHAND_LandCover_4m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'Classified HAND 4m Img intersection with LandCover',false)
// ---- Intersection of HAND classification (3 m) with urban mask --------------
var classifiedImageHAND_smooth_3m = classifiedSlicedImageHAND_3m.gte(-9999).clip(region)
var imgClassifiedHAND_LandCover_3m = classifiedImageHAND_smooth_3m.add(landcover_mask).gte(2).selfMask()
Map.addLayer(imgClassifiedHAND_LandCover_3m,{bands: ["classification_hand"],opacity: 1, palette: ["ff1f12"]},'Classified HAND 3m Img intersection with LandCover',false)
//------

//Calculates objects by connectivity, area per object (m²), applies minimum threshold
//and adds visualization layers to the map.
function hotspotsByArea(binaryImg, layerLabelPrefix, minArea_m2, eightConnected, maxSizePx) {
  var _max = maxSizePx || 1024;
  var connKernel = ee.Kernel.plus(1); // 4-connected (cross)

  // 1) Labeling by connectivity
  var labeled = binaryImg.connectedComponents({
    connectedness: connKernel,
    maxSize: _max
  });

  // 2) Number of pixels per object
  var nPixels = labeled.select('labels').connectedPixelCount({
    maxSize: _max,
    eightConnected: !!eightConnected // false → 4-connected; true → 8-connected
  });

  // 3) Area per object (m²)
  var area = nPixels.multiply(ee.Image.pixelArea());

  // 4) Mask by minimum area and final hotspots
  var areaMask = area.gte(minArea_m2);
  var hotspots = labeled.updateMask(areaMask);

  // 5) Visualizations (same style as original code)
  Map.addLayer(labeled.randomVisualizer(), {}, layerLabelPrefix + ' — Objects', false);
  Map.addLayer(nPixels, { min: 1, max: _max }, layerLabelPrefix + ' — No. of pixels', false);
  Map.addLayer(area, { min: 0, max: 3e6, palette: ['0000FF', 'FF00FF'] }, layerLabelPrefix + ' — Area (m²)', false);
  Map.addLayer(hotspots, {}, layerLabelPrefix + ' — Hotspots (≥ ' + minArea_m2 + ' m²)', true);

  return { labeled: labeled, nPixels: nPixels, area: area, hotspots: hotspots };
}

// =============================================================================
// Apply the function to the three images (RF, K-means, HAND ≤ 5 m)
// =============================================================================

// Area threshold: 3,000 m² | 4-connectivity (as in your snippet) | maxSize 1024
var MIN_AREA_M2 = 3000;
var EIGHT_CON = false;
var MAXSIZE = 1024;

// 1) Classified Image (RF) ∧ Urban
var img_ClassifiedRF_HotSpot = hotspotsByArea(
  imgClassified_LandCover,          // binary image selfMask
  'Classified (RF) — Hotspots',
  MIN_AREA_M2,
  EIGHT_CON,
  MAXSIZE
);

// 2) Clustered Image (K-means) ∧ Urban
var img_ClassifiedKMeans_HotSpot = hotspotsByArea(
  clusteredImage_LandCover,       // binary image selfMask
  'Clustered (K-means) — Hotspots',
  MIN_AREA_M2,
  EIGHT_CON,
  MAXSIZE
);

// 3) Classified HAND Image (≤ 3 m) ∧ Urban
var img_ClassifiedSlicedHAND_3m_HotSpot = hotspotsByArea(
  imgClassifiedHAND_LandCover_3m,   // binary image selfMask
  'Classified HAND (≤3 m) — Hotspots',
  MIN_AREA_M2,
  EIGHT_CON,
  MAXSIZE
);
// 4) Classified HAND Image (≤ 4 m) ∧ Urban
var img_ClassifiedSlicedHAND_4m_HotSpot = hotspotsByArea(
  imgClassifiedHAND_LandCover_4m,   // binary image selfMask
  'Classified HAND (≤4 m) — Hotspots',
  MIN_AREA_M2,
  EIGHT_CON,
  MAXSIZE
);
// 5) Classified HAND Image (≤ 5 m) ∧ Urban
var img_ClassifiedSlicedHAND_5m_HotSpot = hotspotsByArea(
  imgClassifiedHAND_LandCover_5m,   // binary image selfMask
  'Classified HAND (≤5 m) — Hotspots',
  MIN_AREA_M2,
  EIGHT_CON,
  MAXSIZE
);

Map.addLayer(risk_sector.filter(ee.Filter.eq('tipolo_g1', 'Inundação')),{},"CPRM Sectors")
//-------

//Export
var assetPathFlood = '/assets/FloodProject/'; 

Export.image.toAsset({
      image:img_ClassifiedRF_HotSpot.hotspots.select(['classification']),
      description:"img_ClassifiedRF_HotSpot",
      assetId:assetPathFlood+"imgPostClassifiedSemiSuperv_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassifiedRF_HotSpot.hotspots.select(['classification']),
  description: 'imgPostClassifiedSemiSuperv_floodRisk', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassifiedKMeans_HotSpot.hotspots.select(['cluster']),
      description:"img_ClassifiedKMeans_HotSpot",
      assetId:assetPathFlood+"imgPostClassifiedUnsuperv_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassifiedKMeans_HotSpot.hotspots.select(['cluster']),
  description: 'imgPostClassifiedUnsuperv_floodRisk', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassifiedSlicedHAND_3m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassifiedSlicedHAND_3m_HotSpot",
      assetId:assetPathFlood+"imgPostClassifiedSlicedHAND_3m_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassifiedSlicedHAND_3m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassifiedSlicedHAND_3m_HotSpot', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassifiedSlicedHAND_4m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassifiedSlicedHAND_4m_HotSpot",
      assetId:assetPathFlood+"imgPostClassifiedSlicedHAND_4m_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassifiedSlicedHAND_4m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassifiedSlicedHAND_4m_HotSpot', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});

Export.image.toAsset({
      image:img_ClassifiedSlicedHAND_5m_HotSpot.hotspots.select(['classification_hand']),
      description:"img_ClassifiedSlicedHAND_5m_HotSpot",
      assetId:assetPathFlood+"imgPostClassifiedSlicedHAND_5m_floodRisk",
      region:region,
      scale:10,
      maxPixels:1e10,
})
Export.image.toDrive({
  image: img_ClassifiedSlicedHAND_5m_HotSpot.hotspots.select(['classification_hand']),
  description: 'img_ClassifiedSlicedHAND_5m_HotSpot', 
  folder:"floodProjectAssets",
  region: region, 
  scale: 10, 
  maxPixels: 1e10
});
