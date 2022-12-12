"use strict";

function TileCollisionManager() {
}

TileCollisionManager.prototype.continuousMapNodeVecToContinuousObjLayerVec = function(withTiledMapNode, continuousMapNodeVec) {
  const tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);

  const mapOrientation = tiledMapIns.getMapOrientation();
  const mapTileRectilinearSize = tiledMapIns.getTileSize();

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      return continuousMapNodeVec;

    case cc.TiledMap.Orientation.ISO:
      const tileSizeUnifiedLength = Math.sqrt(mapTileRectilinearSize.width * mapTileRectilinearSize.width * 0.25 + mapTileRectilinearSize.height * mapTileRectilinearSize.height * 0.25);
      const isometricObjectLayerPointOffsetScaleFactor = (tileSizeUnifiedLength / mapTileRectilinearSize.height);
      const inverseIsometricObjectLayerPointOffsetScaleFactor = 1 / isometricObjectLayerPointOffsetScaleFactor;

      const cosineThetaRadian = (mapTileRectilinearSize.width * 0.5) / tileSizeUnifiedLength;
      const sineThetaRadian = (mapTileRectilinearSize.height * 0.5) / tileSizeUnifiedLength;

      const inverseTransMat = [
        [inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / cosineThetaRadian), -inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / sineThetaRadian)],
        [-inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / cosineThetaRadian), -inverseIsometricObjectLayerPointOffsetScaleFactor * 0.5 * (1 / sineThetaRadian)]
      ];
      const convertedVecX = inverseTransMat[0][0] * continuousMapNodeVec.x + inverseTransMat[0][1] * continuousMapNodeVec.y;
      const convertedVecY = inverseTransMat[1][0] * continuousMapNodeVec.x + inverseTransMat[1][1] * continuousMapNodeVec.y;

      return cc.v2(convertedVecX, convertedVecY);

    default:
      return null;
  }
}

TileCollisionManager.prototype.continuousObjLayerVecToContinuousMapNodeVec = function(withTiledMapNode, continuousObjLayerVec) {
  var tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);

  var mapOrientation = tiledMapIns.getMapOrientation();
  var mapTileRectilinearSize = tiledMapIns.getTileSize();

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      return cc.v2(continuousObjLayerVec.x, -continuousObjLayerVec.y);

    case cc.TiledMap.Orientation.ISO:
      const tileSizeUnifiedLength = Math.sqrt(mapTileRectilinearSize.width * mapTileRectilinearSize.width * 0.25 + mapTileRectilinearSize.height * mapTileRectilinearSize.height * 0.25);
      const isometricObjectLayerPointOffsetScaleFactor = (tileSizeUnifiedLength / mapTileRectilinearSize.height);

      const cosineThetaRadian = (mapTileRectilinearSize.width * 0.5) / tileSizeUnifiedLength;
      const sineThetaRadian = (mapTileRectilinearSize.height * 0.5) / tileSizeUnifiedLength;

      const transMat = [
        [isometricObjectLayerPointOffsetScaleFactor * cosineThetaRadian, -isometricObjectLayerPointOffsetScaleFactor * cosineThetaRadian],
        [-isometricObjectLayerPointOffsetScaleFactor * sineThetaRadian, -isometricObjectLayerPointOffsetScaleFactor * sineThetaRadian]
      ];
      const convertedVecX = transMat[0][0] * continuousObjLayerVec.x + transMat[0][1] * continuousObjLayerVec.y;
      const convertedVecY = transMat[1][0] * continuousObjLayerVec.x + transMat[1][1] * continuousObjLayerVec.y;

      return cc.v2(convertedVecX, convertedVecY);

    default:
      return null;
  }
}

TileCollisionManager.prototype.continuousObjLayerOffsetToContinuousMapNodePos = function(withTiledMapNode, continuousObjLayerOffset) {
  const tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);
  const mapOrientation = tiledMapIns.getMapOrientation();

  let layerOffset = null;
  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      layerOffset = cc.v2(-(withTiledMapNode.getContentSize().width * 0.5), +(withTiledMapNode.getContentSize().height * 0.5));
      break;
    case cc.TiledMap.Orientation.ISO:
      layerOffset = cc.v2(0, +(withTiledMapNode.getContentSize().height * 0.5));
      break;
    default:
      return null;
  }
  return layerOffset.add(this.continuousObjLayerVecToContinuousMapNodeVec(withTiledMapNode, continuousObjLayerOffset));
}

TileCollisionManager.prototype.continuousMapNodePosToContinuousObjLayerOffset = function(withTiledMapNode, continuousMapNodePos) {
  const tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap);
  const mapOrientation = tiledMapIns.getMapOrientation();
  let layerOffset = null;
  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
      layerOffset = cc.v2(+(withTiledMapNode.getContentSize().width * 0.5), +(withTiledMapNode.getContentSize().height * 0.5));
      return cc.v2(continuousMapNodePos.x + layerOffset.x, continuousMapNodePos.y + layerOffset.y);
    case cc.TiledMap.Orientation.ISO:
      // The immediately following statement takes a magic assumption that the anchor of `withTiledMapNode` is (0.5, 0.5) which is NOT NECESSARILY true.
      layerOffset = cc.v2(0, +(withTiledMapNode.getContentSize().height * 0.5));
      const calibratedVec = continuousMapNodePos.sub(layerOffset); // TODO: Respect the real offsets!
      return this.continuousMapNodeVecToContinuousObjLayerVec(withTiledMapNode, calibratedVec);
    default:
      return null;
  }
}

/**
 * Note that `TileCollisionManager.extractBoundaryObjects` returns everything with coordinates local to `withTiledMapNode`!
 */
window.battleEntityTypeNameToGlobalGid = {};
TileCollisionManager.prototype.extractBoundaryObjects = function(withTiledMapNode) {
  let toRet = {
    playerStartingPositions: [],
    barriers: [],
  };
  const tiledMapIns = withTiledMapNode.getComponent(cc.TiledMap); // This is a magic name.

  const allObjectGroups = tiledMapIns.getObjectGroups();
  for (let i = 0; i < allObjectGroups.length; ++i) {
    var objectGroup = allObjectGroups[i];
    if ("PlayerStartingPos" == objectGroup.getGroupName()) {
      var allObjects = objectGroup.getObjects();
      for (let j = 0; j < allObjects.length; ++j) {
        const cccMaskedX = allObjects[j].x,
          cccMaskedY = allObjects[j].y;
        const origX = cccMaskedX,
          origY = withTiledMapNode.getContentSize().height - cccMaskedY; // FIXME: I don't know why CocosCreator did this, it's stupid and MIGHT NOT WORK IN ISOMETRIC orientation!   
        let wpos = this.continuousObjLayerOffsetToContinuousMapNodePos(withTiledMapNode, cc.v2(origX, origY));
        toRet.playerStartingPositions.push(wpos);
      }
      continue;
    }
    if ("barrier_and_shelter" != objectGroup.getProperty("type")) continue;
    var allObjects = objectGroup.getObjects();
    for (let j = 0; j < allObjects.length; ++j) {
      let object = allObjects[j];
      let gid = object.gid;
      if (0 < gid) {
        continue;
      }
      const boundaryType = object.boundary_type;
      let toPushBarrier = [];
      toPushBarrier.boundaryType = boundaryType;
      switch (boundaryType) {
        case "barrier":
          let polylinePoints = object.polylinePoints;
          if (null == polylinePoints) {
            polylinePoints = [{
              x: 0,
              y: 0
            }, {
              x: object.width,
              y: 0
            }, {
              x: object.width,
              y: -object.height
            }, {
              x: 0,
              y: -object.height
            }];
          }
          for (let k = 0; k < polylinePoints.length; ++k) {
            /* Since CocosCreatorv2.1.3, the Y-coord of object polylines is inverted compared to that of the tmx file. */
            toPushBarrier.push(this.continuousObjLayerVecToContinuousMapNodeVec(withTiledMapNode, cc.v2(polylinePoints[k].x, -polylinePoints[k].y)));
          }
          toPushBarrier.anchor = this.continuousObjLayerOffsetToContinuousMapNodePos(withTiledMapNode, object.offset); // DON'T use "(object.x, object.y)" which are wrong/meaningless! 
          toRet.barriers.push(toPushBarrier);
          break;
        default:
          break;
      }
    }
  }

  return toRet;
}

TileCollisionManager.prototype.isOutOfMapNode = function(tiledMapNode, continuousPosLocalToMap) {
  const tiledMapIns = tiledMapNode.getComponent(cc.TiledMap); // This is a magic name.

  const mapOrientation = tiledMapIns.getMapOrientation();
  const mapTileRectilinearSize = tiledMapIns.getTileSize();

  const mapContentSize = cc.size(tiledMapIns.getTileSize().width * tiledMapIns.getMapSize().width, tiledMapIns.getTileSize().height * tiledMapIns.getMapSize().height);

  switch (mapOrientation) {
    case cc.TiledMap.Orientation.ORTHO:
    case cc.TiledMap.Orientation.ISO:
      const continuousObjLayerOffset = this.continuousMapNodePosToContinuousObjLayerOffset(tiledMapNode, continuousPosLocalToMap); // Already took care of both orientations
      return 0 > continuousObjLayerOffset.x || 0 > continuousObjLayerOffset.y || mapContentSize.width < continuousObjLayerOffset.x || mapContentSize.height < continuousObjLayerOffset.y;

    default:
      return true;
  }
  return true;
};

TileCollisionManager.prototype.initMapNodeByTiledBoundaries = function(mapScriptIns, mapNode, extractedBoundaryObjs) {
  const tiledMapIns = mapNode.getComponent(cc.TiledMap);

  mapScriptIns.barrierColliders = [];
  for (let boundaryObj of extractedBoundaryObjs.barriers) {
    const newBarrier = cc.instantiate(mapScriptIns.polygonBoundaryBarrierPrefab);
    const newBoundaryOffsetInMapNode = cc.v2(boundaryObj.anchor.x, boundaryObj.anchor.y);
    newBarrier.setPosition(newBoundaryOffsetInMapNode);
    newBarrier.setAnchorPoint(cc.v2(0, 0));
    const newBarrierColliderIns = newBarrier.getComponent(cc.PolygonCollider);
    newBarrierColliderIns.points = [];
    for (let p of boundaryObj) {
      newBarrierColliderIns.points.push(p);
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
