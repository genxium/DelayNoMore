"use strict";

window.ALL_DISCRETE_DIRECTIONS_CLOCKWISE = [{
  dx: 0,
  dy: 1
}, {
  dx: 2,
  dy: 1
}, {
  dx: 2,
  dy: 0
}, {
  dx: 2,
  dy: -1
}, {
  dx: 0,
  dy: -1
}, {
  dx: -2,
  dy: -1
}, {
  dx: -2,
  dy: 0
}, {
  dx: -2,
  dy: 1
}];

function TileCollisionManager() { }

TileCollisionManager.prototype._continuousFromCentreOfDiscreteTile = function (tiledMapNode, tiledMapIns, layerIns, discretePosX, discretePosY) {
  var mapOrientation = tiledMapIns.getMapOrientation();
  var mapTileRectilinearSize = tiledMapIns.getTileSize();
  var mapAnchorOffset = cc.v2(0, 0);
  var tileSize = {
    width: 0,
    height: 0
  };
  var layerOffset = cc.v2(0, 0);

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      return null;

    case cc.TiledMap.Orientation.ISO:
      var tileSizeUnifiedLength = Math.sqrt(mapTileRectilinearSize.width * mapTileRectilinearSize.width / 4 + mapTileRectilinearSize.height * mapTileRectilinearSize.height / 4);
      tileSize = {
        width: tileSizeUnifiedLength,
        height: tileSizeUnifiedLength
      };
      var cosineThetaRadian = mapTileRectilinearSize.width / 2 / tileSizeUnifiedLength;
      var sineThetaRadian = mapTileRectilinearSize.height / 2 / tileSizeUnifiedLength;
      mapAnchorOffset = cc.v2(
        tiledMapNode.getContentSize().width * (0.5 - tiledMapNode.getAnchorPoint().x),
        tiledMapNode.getContentSize().height * (1 - tiledMapNode.getAnchorPoint().y)
      );
      layerOffset = cc.v2(0, 0);
      var transMat = [
        [cosineThetaRadian, -cosineThetaRadian],
        [-sineThetaRadian, -sineThetaRadian]
      ];
      var tmpContinuousX = (parseFloat(discretePosX) + 0.5) * tileSizeUnifiedLength;
      var tmpContinuousY = (parseFloat(discretePosY) + 0.5) * tileSizeUnifiedLength;
      var dContinuousXWrtMapNode = transMat[0][0] * tmpContinuousX + transMat[0][1] * tmpContinuousY;
      var dContinuousYWrtMapNode = transMat[1][0] * tmpContinuousX + transMat[1][1] * tmpContinuousY;
      return cc.v2(dContinuousXWrtMapNode, dContinuousYWrtMapNode).add(mapAnchorOffset);

    default:
      return null;
  }
};

TileCollisionManager.prototype._continuousToDiscrete = function (tiledMapNode, tiledMapIns, continuousNewPosLocalToMap, continuousOldPosLocalToMap) {
  /*
   * References
   * - http://cocos2d-x.org/docs/api-ref/creator/v1.5/classes/TiledMap.html
   * - http://cocos2d-x.org/docs/api-ref/creator/v1.5/classes/TiledLayer.html
   * - http://docs.mapeditor.org/en/stable/reference/tmx-map-format/?highlight=orientation#map
   */
  var mapOrientation = tiledMapIns.getMapOrientation();
  var mapTileRectilinearSize = tiledMapIns.getTileSize();
  var mapAnchorOffset = {
    x: 0,
    y: 0
  };
  var tileSize = {
    width: 0,
    height: 0
  };
  var layerOffset = {
    x: 0,
    y: 0
  };
  var convertedContinuousOldXInTileCoordinates = null;
  var convertedContinuousOldYInTileCoordinates = null;
  var convertedContinuousNewXInTileCoordinates = null;
  var convertedContinuousNewYInTileCoordinates = null;
  var oldWholeMultipleX = 0;
  var oldWholeMultipleY = 0;
  var newWholeMultipleX = 0;
  var newWholeMultipleY = 0;
  var discretePosX = 0;
  var discretePosY = 0;
  var exactBorderX = 0;
  var exactBorderY = 0; // These tmp variables are NOT NECESSARILY useful.

  var oldTmpX = 0;
  var oldTmpY = 0;
  var newTmpX = 0;
  var newTmpY = 0;

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      mapAnchorOffset = {
        x: -(tiledMapNode.getContentSize().width * tiledMapNode.getAnchorPoint().x),
        y: tiledMapNode.getContentSize().height * (1 - tiledMapNode.getAnchorPoint().y)
      };
      layerOffset = {
        x: 0,
        y: 0
      };
      tileSize = mapTileRectilinearSize;
      convertedContinuousOldXInTileCoordinates = continuousOldPosLocalToMap.x - layerOffset.x - mapAnchorOffset.x;
      convertedContinuousOldYInTileCoordinates = mapAnchorOffset.y - (continuousOldPosLocalToMap.y - layerOffset.y);
      convertedContinuousNewXInTileCoordinates = continuousNewPosLocalToMap.x - layerOffset.x - mapAnchorOffset.x;
      convertedContinuousNewYInTileCoordinates = mapAnchorOffset.y - (continuousNewPosLocalToMap.y - layerOffset.y);
      break;

    case cc.TiledMap.Orientation.ISO:
      var tileSizeUnifiedLength = Math.sqrt(mapTileRectilinearSize.width * mapTileRectilinearSize.width / 4 + mapTileRectilinearSize.height * mapTileRectilinearSize.height / 4);
      tileSize = {
        width: tileSizeUnifiedLength,
        height: tileSizeUnifiedLength
      };
      var cosineThetaRadian = mapTileRectilinearSize.width / 2 / tileSizeUnifiedLength;
      var sineThetaRadian = mapTileRectilinearSize.height / 2 / tileSizeUnifiedLength;
      mapAnchorOffset = {
        x: tiledMapNode.getContentSize().width * (0.5 - tiledMapNode.getAnchorPoint().x),
        y: tiledMapNode.getContentSize().height * (1 - tiledMapNode.getAnchorPoint().y)
      };
      layerOffset = {
        x: 0,
        y: 0
      };
      oldTmpX = continuousOldPosLocalToMap.x - layerOffset.x - mapAnchorOffset.x;
      oldTmpY = continuousOldPosLocalToMap.y - layerOffset.y - mapAnchorOffset.y;
      newTmpX = continuousNewPosLocalToMap.x - layerOffset.x - mapAnchorOffset.x;
      newTmpY = continuousNewPosLocalToMap.y - layerOffset.y - mapAnchorOffset.y;
      var transMat = [[1 / (2 * cosineThetaRadian), -1 / (2 * sineThetaRadian)], [-1 / (2 * cosineThetaRadian), -1 / (2 * sineThetaRadian)]];
      convertedContinuousOldXInTileCoordinates = transMat[0][0] * oldTmpX + transMat[0][1] * oldTmpY;
      convertedContinuousOldYInTileCoordinates = transMat[1][0] * oldTmpX + transMat[1][1] * oldTmpY;
      convertedContinuousNewXInTileCoordinates = transMat[0][0] * newTmpX + transMat[0][1] * newTmpY;
      convertedContinuousNewYInTileCoordinates = transMat[1][0] * newTmpX + transMat[1][1] * newTmpY;
      break;

    default:
      break;
  }

  if (null == convertedContinuousOldXInTileCoordinates || null == convertedContinuousOldYInTileCoordinates || null == convertedContinuousNewXInTileCoordinates || null == convertedContinuousNewYInTileCoordinates) {
    return null;
  }

  oldWholeMultipleX = Math.floor(convertedContinuousOldXInTileCoordinates / tileSize.width);
  oldWholeMultipleY = Math.floor(convertedContinuousOldYInTileCoordinates / tileSize.height);
  newWholeMultipleX = Math.floor(convertedContinuousNewXInTileCoordinates / tileSize.width);
  newWholeMultipleY = Math.floor(convertedContinuousNewYInTileCoordinates / tileSize.height); // Mind that the calculation of `exactBorderY` is different for `convertedContinuousOldYInTileCoordinates <> convertedContinuousNewYInTileCoordinates`. 

  if (convertedContinuousOldYInTileCoordinates < convertedContinuousNewYInTileCoordinates) {
    exactBorderY = newWholeMultipleY * tileSize.height;

    if (convertedContinuousNewYInTileCoordinates > exactBorderY && convertedContinuousOldYInTileCoordinates <= exactBorderY) {
      // Will try to cross the border if (newWholeMultipleY != oldWholeMultipleY).
      discretePosY = newWholeMultipleY;
    } else {
      discretePosY = oldWholeMultipleY;
    }
  } else if (convertedContinuousOldYInTileCoordinates > convertedContinuousNewYInTileCoordinates) {
    exactBorderY = oldWholeMultipleY * tileSize.height;

    if (convertedContinuousNewYInTileCoordinates < exactBorderY && convertedContinuousOldYInTileCoordinates >= exactBorderY) {
      // Will try to cross the border if (newWholeMultipleY != oldWholeMultipleY).
      discretePosY = newWholeMultipleY;
    } else {
      discretePosY = oldWholeMultipleY;
    }
  } else {
    discretePosY = oldWholeMultipleY;
  } // Mind that the calculation of `exactBorderX` is different for `convertedContinuousOldXInTileCoordinates <> convertedContinuousNewXInTileCoordinates`. 


  if (convertedContinuousOldXInTileCoordinates < convertedContinuousNewXInTileCoordinates) {
    exactBorderX = newWholeMultipleX * tileSize.width;

    if (convertedContinuousNewXInTileCoordinates > exactBorderX && convertedContinuousOldXInTileCoordinates <= exactBorderX) {
      // Will cross the border if (newWholeMultipleX != oldWholeMultipleX).
      discretePosX = newWholeMultipleX;
    } else {
      discretePosX = oldWholeMultipleX;
    }
  } else if (convertedContinuousOldXInTileCoordinates > convertedContinuousNewXInTileCoordinates) {
    exactBorderX = oldWholeMultipleX * tileSize.width;

    if (convertedContinuousNewXInTileCoordinates < exactBorderX && convertedContinuousOldXInTileCoordinates >= exactBorderX) {
      // Will cross the border if (newWholeMultipleX != oldWholeMultipleX).
      discretePosX = newWholeMultipleX;
    } else {
      discretePosX = oldWholeMultipleX;
    }
  } else {
    discretePosX = oldWholeMultipleX;
  }

  return {
    x: discretePosX,
    y: discretePosY
  };
};

TileCollisionManager.prototype.continuousMapNodeVecToContinuousObjLayerVec = function (withTiledMapNode, continuousMapNodeVec) {
  var tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);

  var mapOrientation = tiledMapIns.getMapOrientation();
  var mapTileRectilinearSize = tiledMapIns.getTileSize();

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      // TODO
      return null;

    case cc.TiledMap.Orientation.ISO:
      var tileSizeUnifiedLength = Math.sqrt(mapTileRectilinearSize.width * mapTileRectilinearSize.width * 0.25 + mapTileRectilinearSize.height * mapTileRectilinearSize.height * 0.25);
      var isometricObjectLayerPointOffsetScaleFactor = (tileSizeUnifiedLength / mapTileRectilinearSize.height);
      var inverseIsometricObjectLayerPointOffsetScaleFactor = 1 / isometricObjectLayerPointOffsetScaleFactor;

      var cosineThetaRadian = (mapTileRectilinearSize.width * 0.5) / tileSizeUnifiedLength;
      var sineThetaRadian = (mapTileRectilinearSize.height * 0.5) / tileSizeUnifiedLength;

      var inverseTransMat = [
        [inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / cosineThetaRadian), - inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / sineThetaRadian)],
        [- inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / cosineThetaRadian), - inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / sineThetaRadian)]
      ];
      var convertedVecX = inverseTransMat[0][0] * continuousMapNodeVec.x + inverseTransMat[0][1] * continuousMapNodeVec.y;
      var convertedVecY = inverseTransMat[1][0] * continuousMapNodeVec.x + inverseTransMat[1][1] * continuousMapNodeVec.y;

      return cc.v2(convertedVecX, convertedVecY);

    default:
      return null;
  }
}

TileCollisionManager.prototype.continuousObjLayerVecToContinuousMapNodeVec = function (withTiledMapNode, continuousObjLayerVec) {
  var tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);

  var mapOrientation = tiledMapIns.getMapOrientation();
  var mapTileRectilinearSize = tiledMapIns.getTileSize();

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      // TODO
      return null;

    case cc.TiledMap.Orientation.ISO:
      var tileSizeUnifiedLength = Math.sqrt(mapTileRectilinearSize.width * mapTileRectilinearSize.width * 0.25 + mapTileRectilinearSize.height * mapTileRectilinearSize.height * 0.25);
      var isometricObjectLayerPointOffsetScaleFactor = (tileSizeUnifiedLength / mapTileRectilinearSize.height);

      var cosineThetaRadian = (mapTileRectilinearSize.width * 0.5) / tileSizeUnifiedLength;
      var sineThetaRadian = (mapTileRectilinearSize.height * 0.5) / tileSizeUnifiedLength;

      var transMat = [
        [isometricObjectLayerPointOffsetScaleFactor * cosineThetaRadian, - isometricObjectLayerPointOffsetScaleFactor * cosineThetaRadian],
        [- isometricObjectLayerPointOffsetScaleFactor * sineThetaRadian, - isometricObjectLayerPointOffsetScaleFactor * sineThetaRadian]
      ];
      var convertedVecX = transMat[0][0] * continuousObjLayerVec.x + transMat[0][1] * continuousObjLayerVec.y;
      var convertedVecY = transMat[1][0] * continuousObjLayerVec.x + transMat[1][1] * continuousObjLayerVec.y;

      return cc.v2(convertedVecX, convertedVecY);

    default:
      return null;
  }
}

TileCollisionManager.prototype.continuousObjLayerOffsetToContinuousMapNodePos = function (withTiledMapNode, continuousObjLayerOffset) {
  var tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);

  var mapOrientation = tiledMapIns.getMapOrientation();

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      // TODO
      return null;

    case cc.TiledMap.Orientation.ISO:
      const calibratedVec = continuousObjLayerOffset; // TODO: Respect the real offsets!

      // The immediately following statement takes a magic assumption that the anchor of `withTiledMapNode` is (0.5, 0.5) which is NOT NECESSARILY true.
      const layerOffset = cc.v2(0, +(withTiledMapNode.getContentSize().height * 0.5));

      return layerOffset.add(this.continuousObjLayerVecToContinuousMapNodeVec(withTiledMapNode, calibratedVec));

    default:
      return null;
  }
}

TileCollisionManager.prototype.continuousMapNodePosToContinuousObjLayerOffset = function (withTiledMapNode, continuousMapNodePos) {
  var tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);

  var mapOrientation = tiledMapIns.getMapOrientation();
  var mapTileRectilinearSize = tiledMapIns.getTileSize();

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      // TODO
      return null;

    case cc.TiledMap.Orientation.ISO:
      // The immediately following statement takes a magic assumption that the anchor of `withTiledMapNode` is (0.5, 0.5) which is NOT NECESSARILY true.
      var layerOffset = cc.v2(0, +(withTiledMapNode.getContentSize().height * 0.5));
      var calibratedVec = continuousMapNodePos.sub(layerOffset); // TODO: Respect the real offsets!
      return this.continuousMapNodeVecToContinuousObjLayerVec(withTiledMapNode, calibratedVec);

    default:
      return null;
  }
}

/**
 * Note that `TileCollisionManager.extractBoundaryObjects` returns everything with coordinates local to `withTiledMapNode`!
 */
window.battleEntityTypeNameToGlobalGid = {};
TileCollisionManager.prototype.extractBoundaryObjects = function (withTiledMapNode) {
  let toRet = {
    barriers: [],
    frameAnimations: [],
    grandBoundaries: [],
  };
  const tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap); // This is a magic name.
  const mapTileSize = tiledMapIns.getTileSize();
  const mapOrientation = tiledMapIns.getMapOrientation();

  /*
   * Copies from https://github.com/cocos-creator/engine/blob/master/cocos2d/tilemap/CCTiledMap.js as a hack to parse advanced <tile> info
   * of a TSX file. [BEGINS]
   */
  const file = tiledMapIns._tmxFile;
  const texValues = file.textures;
  const texKeys = file.textureNames;
  const textures = {};
  for (let texIdx = 0; texIdx < texValues.length; ++texIdx) {
    textures[texKeys[texIdx]] = texValues[texIdx];
  }

  const tsxFileNames = file.tsxFileNames;
  const tsxFiles = file.tsxFiles;
  let tsxMap = {};
  for (let tsxFilenameIdx = 0; tsxFilenameIdx < tsxFileNames.length; ++tsxFilenameIdx) {
    if (0 >= tsxFileNames[tsxFilenameIdx].length) continue;
    tsxMap[tsxFileNames[tsxFilenameIdx]] = tsxFiles[tsxFilenameIdx].text;
  }

  const mapInfo = new cc.TMXMapInfo(file.tmxXmlStr, tsxMap, textures);
  const tileSets = mapInfo.getTilesets();
  /*
   * Copies from https://github.com/cocos-creator/engine/blob/master/cocos2d/tilemap/CCTiledMap.js as a hack to parse advanced <tile> info
   * of a TSX file. [ENDS]
   */
  let gidBoundariesMap = {};
  const tilesElListUnderTilesets = {};
  for (let tsxFilenameIdx = 0; tsxFilenameIdx < tsxFileNames.length; ++tsxFilenameIdx) {
    const tsxOrientation = tileSets[tsxFilenameIdx].orientation;
    if (cc.TiledMap.Orientation.ORTHO == tsxOrientation) {
      cc.error("Error at tileset %s: We proceed with ONLY tilesets in ORTHO orientation for all map orientations by now.", tsxFileNames[tsxFilenameIdx]);
      continue;
    };

    const tsxXMLStr = tsxMap[tsxFileNames[tsxFilenameIdx]];
    const selTileset = mapInfo._parser._parseXML(tsxXMLStr).documentElement;
    const firstGid = (parseInt(selTileset.getAttribute('firstgid')) || tileSets[tsxFilenameIdx].firstGid || 0);
    const currentTiles = selTileset.getElementsByTagName('tile');
    if (!currentTiles) continue;
    tilesElListUnderTilesets[tsxFileNames[tsxFilenameIdx]] = currentTiles;

    for (let tileIdx = 0; tileIdx < currentTiles.length; ++tileIdx) {
      const currentTile = currentTiles[tileIdx];
      const parentGid = parseInt(firstGid) + parseInt(currentTile.getAttribute('id') || 0);
      let childrenOfCurrentTile = null;
      if (cc.sys.isNative) {
        childrenOfCurrentTile = currentTile.getElementsByTagName("objectgroup");
      } else {
        childrenOfCurrentTile = currentTile.children;
      }
      for (let childIdx = 0; childIdx < childrenOfCurrentTile.length; ++childIdx) {
        const ch = childrenOfCurrentTile[childIdx];
        if ('objectgroup' != ch.nodeName) continue;
        var currentObjectGroupUnderTile = mapInfo._parseObjectGroup(ch);
        gidBoundariesMap[parentGid] = {
          barriers: [],
        };
        for (let oidx = 0; oidx < currentObjectGroupUnderTile._objects.length; ++oidx) {
          const oo = currentObjectGroupUnderTile._objects[oidx];
          const polylinePoints = oo.polylinePoints;
          if (null == polylinePoints) continue;
          const boundaryType = oo.boundary_type;
          switch (boundaryType) {
            case "LowScoreTreasure":
            case "HighScoreTreasure":
            case "GuardTower":
              const spriteFrameInfoForGid = getOrCreateSpriteFrameForGid(parentGid, mapInfo, tilesElListUnderTilesets);
              if (null != spriteFrameInfoForGid) {
                window.battleEntityTypeNameToGlobalGid[boundaryType] = parentGid;
              }
            break;
            case "barrier":
              let brToPushTmp = [];
              for (let bidx = 0; bidx < polylinePoints.length; ++bidx) {
                brToPushTmp.push(cc.v2(oo.x, oo.y).add(polylinePoints[bidx]));
              }
              brToPushTmp.boundaryType = boundaryType;
              gidBoundariesMap[parentGid].barriers.push(brToPushTmp);
              break;
            default:
              break;
          }
        }
      }
    }
  }

  // Reference http://docs.cocos.com/creator/api/en/classes/TiledMap.html.
  let allObjectGroups = tiledMapIns.getObjectGroups();

  for (var i = 0; i < allObjectGroups.length; ++i) {
    // Reference http://docs.cocos.com/creator/api/en/classes/TiledObjectGroup.html.
    var objectGroup = allObjectGroups[i];
    if ("frame_anim" != objectGroup.getProperty("type")) continue;
    var allObjects = objectGroup.getObjects();
    for (var j = 0; j < allObjects.length; ++j) {
      var object = allObjects[j];
      var gid = object.gid;
      if (!gid || gid <= 0) {
        continue;
      }
      var animationClipInfoForGid = getOrCreateAnimationClipForGid(gid, mapInfo, tilesElListUnderTilesets);
      if (!animationClipInfoForGid) continue;
      toRet.frameAnimations.push({
        posInMapNode: this.continuousObjLayerOffsetToContinuousMapNodePos(withTiledMapNode, object.offset),
        origSize: animationClipInfoForGid.origSize,
        sizeInMapNode: cc.size(object.width, object.height),
        animationClip: animationClipInfoForGid.animationClip
      });
    }
  }

  for (let i = 0; i < allObjectGroups.length; ++i) {
    var objectGroup = allObjectGroups[i];
    if ("barrier_and_shelter" != objectGroup.getProperty("type")) continue;
    var allObjects = objectGroup.getObjects();
    for (let j = 0; j < allObjects.length; ++j) {
      let object = allObjects[j];
      let gid = object.gid;
      if (0 < gid) {
        continue;
      }
      const polylinePoints = object.polylinePoints;
      if (null == polylinePoints) {
        continue
      }
      for (let k = 0; k < polylinePoints.length; ++k) {
        /* Since CocosCreatorv2.1.3, the Y-coord of object polylines DIRECTLY DRAWN ON tmx with ISOMETRIC ORIENTATION is inverted. -- YFLu, 2019-11-01. */
        polylinePoints[k].y = -polylinePoints[k].y;
      }
      const boundaryType = object.boundary_type;
      switch (boundaryType) {
        case "barrier":
          let toPushBarriers = [];
          for (let k = 0; k < polylinePoints.length; ++k) {
            const tmp = object.offset.add(polylinePoints[k]);
            toPushBarriers.push(this.continuousObjLayerOffsetToContinuousMapNodePos(withTiledMapNode, tmp));
          }
          if (null != object.debug_mark) {
            console.log("Transformed ", polylinePoints, ", to ", toPushBarriers);
          }
          toPushBarriers.boundaryType = boundaryType;
          toRet.barriers.push(toPushBarriers);
          break;
        default:
          break;
      }
    }
  }

  const allLayers = tiledMapIns.getLayers();

  let layerDOMTrees = [];
  const mapDomTree = mapInfo._parser._parseXML(tiledMapIns.tmxAsset.tmxXmlStr).documentElement;
  const mapDOMAllChildren = (mapDomTree.children);
  for (let mdtIdx = 0; mdtIdx < mapDOMAllChildren.length; ++mdtIdx) {
    const tmpCh = mapDOMAllChildren[mdtIdx];
    if (mapInfo._shouldIgnoreNode(tmpCh)) {
      continue;
    }

    if (tmpCh.nodeName != 'layer') {
      continue;
    }
    layerDOMTrees.push(tmpCh);
  }

  for (let j = 0; j < allLayers.length; ++j) {
    // TODO: Respect layer offset!
    const currentTileLayer = allLayers[j];
    const currentTileset = currentTileLayer.getTileSet();

    if (!currentTileset) {
      continue;
    }

    const currentLayerSize = currentTileLayer.getLayerSize();

    const currentLayerTileSize = currentTileset._tileSize;
    const firstGidInCurrentTileset = currentTileset.firstGid;

    for (let discreteXInLayer = 0; discreteXInLayer < currentLayerSize.width; ++discreteXInLayer) {
      for (let discreteYInLayer = 0; discreteYInLayer < currentLayerSize.height; ++discreteYInLayer) {
        const currentGid = currentTileLayer.getTileGIDAt(discreteXInLayer, discreteYInLayer);
        if (0 >= currentGid) continue;
        const gidBoundaries = gidBoundariesMap[currentGid];
        if (!gidBoundaries) continue;
        switch (mapOrientation) {
          case cc.TiledMap.Orientation.ORTHO:
            // TODO
            return toRet;

          case cc.TiledMap.Orientation.ISO:
            const centreOfAnchorTileInMapNode = this._continuousFromCentreOfDiscreteTile(withTiledMapNode, tiledMapIns, currentTileLayer, discreteXInLayer, discreteYInLayer);
            const topLeftOfWholeTsxTileInMapNode = centreOfAnchorTileInMapNode.add(cc.v2(-0.5 * mapTileSize.width, currentLayerTileSize.height - 0.5 * mapTileSize.height));
            for (let bidx = 0; bidx < gidBoundaries.barriers.length; ++bidx) {
              const theBarrier = gidBoundaries.barriers[bidx]; // An array of cc.v2 points.
              let brToPushTmp = [];
              for (let tbidx = 0; tbidx < theBarrier.length; ++tbidx) {
                brToPushTmp.push(topLeftOfWholeTsxTileInMapNode.add(cc.v2(theBarrier[tbidx].x, -theBarrier[tbidx].y /* Mind the reverse y-axis here. */)));
              }
              toRet.barriers.push(brToPushTmp);
            }
            continue;

          default:
            return toRet;
        }
      }
    }
  }
  return toRet;
}

TileCollisionManager.prototype.isOutOfMapNode = function (tiledMapNode, continuousPosLocalToMap) {
  var tiledMapIns = tiledMapNode.getComponent(cc.TiledMap); // This is a magic name.

  var mapOrientation = tiledMapIns.getMapOrientation();
  var mapTileRectilinearSize = tiledMapIns.getTileSize();

  var mapContentSize = cc.size(tiledMapIns.getTileSize().width * tiledMapIns.getMapSize().width, tiledMapIns.getTileSize().height * tiledMapIns.getMapSize().height);

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      // TODO
      return true;

    case cc.TiledMap.Orientation.ISO:
      var continuousObjLayerOffset = this.continuousMapNodePosToContinuousObjLayerOffset(tiledMapNode, continuousPosLocalToMap);
      return 0 > continuousObjLayerOffset.x || 0 > continuousObjLayerOffset.y || mapContentSize.width < continuousObjLayerOffset.x || mapContentSize.height < continuousObjLayerOffset.y;

    default:
      return true;
  }
  return true;
};

TileCollisionManager.prototype.initMapNodeByTiledBoundaries = function(mapScriptIns, mapNode, extractedBoundaryObjs) {
  // TODO: TO DEPRECATE!
  const tiledMapIns = mapNode.getComponent(cc.TiledMap);
  if (extractedBoundaryObjs.grandBoundaries) {
    window.grandBoundary = [];
    for (let boundaryObj of extractedBoundaryObjs.grandBoundaries) {
      for (let p of boundaryObj) {
        if (CC_DEBUG) {
          const labelNode = new cc.Node();
          labelNode.setPosition(p);
          const label = labelNode.addComponent(cc.Label);
          label.string = "GB_(" + p.x.toFixed(2) + ", " + p.y.toFixed(2) + ")";
          safelyAddChild(mapNode, labelNode);
          setLocalZOrder(labelNode, 999);
        }
        window.grandBoundary.push(p);
      }
      break;
    }
  }

  mapScriptIns.dictOfTiledFrameAnimationList = {};
  for (let frameAnim of extractedBoundaryObjs.frameAnimations) {
    if (!frameAnim.type) {
      cc.warn("should bind a type to the frameAnim object layer");
      continue
    }
    const tiledMapIns = mapScriptIns.node.getComponent(cc.TiledMap);
    let frameAnimInType = mapScriptIns.dictOfTiledFrameAnimationList[frameAnim.type];
    if (!frameAnimInType) {
      mapScriptIns.dictOfTiledFrameAnimationList[frameAnim.type] = [];
      frameAnimInType = mapScriptIns.dictOfTiledFrameAnimationList[frameAnim.type];
    }
    const animNode = cc.instantiate(mapScriptIns.tiledAnimPrefab);
    const anim = animNode.getComponent(cc.Animation);
    animNode.setPosition(frameAnim.posInMapNode);
    animNode.width = frameAnim.sizeInMapNode.width;
    animNode.height = frameAnim.sizeInMapNode.height;
    animNode.setScale(frameAnim.sizeInMapNode.width / frameAnim.origSize.width, frameAnim.sizeInMapNode.height / frameAnim.origSize.height);
    animNode.opacity = 0;
    animNode.setAnchorPoint(cc.v2(0.5, 0)); // A special requirement for "image-type Tiled object" by "CocosCreator v2.0.1".
    safelyAddChild(mapScriptIns.node, animNode);
    setLocalZOrder(animNode, 5);
    anim.addClip(frameAnim.animationClip, "default");
    anim.play("default");
    frameAnimInType.push(animNode);
  }

  mapScriptIns.barrierColliders = [];
  for (let boundaryObj of extractedBoundaryObjs.barriers) {
    const newBarrier = cc.instantiate(mapScriptIns.polygonBoundaryBarrierPrefab);
    const newBoundaryOffsetInMapNode = cc.v2(boundaryObj[0].x, boundaryObj[0].y);
    newBarrier.setPosition(newBoundaryOffsetInMapNode);
    newBarrier.setAnchorPoint(cc.v2(0, 0));
    const newBarrierColliderIns = newBarrier.getComponent(cc.PolygonCollider);
    newBarrierColliderIns.points = [];
    for (let p of boundaryObj) {
      newBarrierColliderIns.points.push(p.sub(newBoundaryOffsetInMapNode));
    }
    mapScriptIns.barrierColliders.push(newBarrierColliderIns);
    mapScriptIns.node.addChild(newBarrier);
  }

  const allLayers = tiledMapIns.getLayers();
  for (let layer of allLayers) {
    const layerType = layer.getProperty("type");
    switch (layerType) {
      case "barrier_and_shelter":
        setLocalZOrder(layer.node, 3);
        break;
      default:
        break;
    }
  }

  const allObjectGroups = tiledMapIns.getObjectGroups();
  for (let objectGroup of allObjectGroups) {
    const objectGroupType = objectGroup.getProperty("type");
    switch (objectGroupType) {
      case "barrier_and_shelter":
        setLocalZOrder(objectGroup.node, 3);
        break;
      default:
        break;
    }
  }
}

window.tileCollisionManager = new TileCollisionManager();
