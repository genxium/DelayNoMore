const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const OnlineMap = require('./Map');

cc.Class({
  extends: OnlineMap,

  properties: {
    keyboardInputControllerNode: {
      type: cc.Node,
      default: null
    },
  },

  onDestroy() {
    console.warn("+++++++ Map onDestroy()");
  },

  onLoad() {
    const self = this;
    window.mapIns = self;

    self.mainCameraNode = canvasNode.getChildByName("Main Camera");
    self.mainCamera = self.mainCameraNode.getComponent(cc.Camera);
    for (let child of self.mainCameraNode.children) {
      child.setScale(1 / self.mainCamera.zoomRatio);
    }
    self.widgetsAboveAllNode = self.mainCameraNode.getChildByName("WidgetsAboveAll");
    self.mainCameraNode.setPosition(cc.v2());

    /** Init required prefab ended. */

    self.inputDelayFrames = parsedBattleColliderInfo.inputDelayFrames;
    self.inputScaleFrames = parsedBattleColliderInfo.inputScaleFrames;
    self.inputFrameUpsyncDelayTolerance = parsedBattleColliderInfo.inputFrameUpsyncDelayTolerance;

    self.battleDurationNanos = parsedBattleColliderInfo.battleDurationNanos;
    self.rollbackEstimatedDt = parsedBattleColliderInfo.rollbackEstimatedDt;
    self.rollbackEstimatedDtMillis = parsedBattleColliderInfo.rollbackEstimatedDtMillis;
    self.rollbackEstimatedDtNanos = parsedBattleColliderInfo.rollbackEstimatedDtNanos;
    self.maxChasingRenderFramesPerUpdate = parsedBattleColliderInfo.maxChasingRenderFramesPerUpdate;

    self.worldToVirtualGridRatio = parsedBattleColliderInfo.worldToVirtualGridRatio;
    self.virtualGridToWorldRatio = parsedBattleColliderInfo.virtualGridToWorldRatio;

    const tiledMapIns = self.node.getComponent(cc.TiledMap);

    // It's easier to just use the "barrier"s extracted by the backend (all anchor points in world coordinates), but I'd like to verify frontend tmx parser logic as well.
    const fullPathOfTmxFile = cc.js.formatStr("map/%s/map", parsedBattleColliderInfo.stageName);
    cc.loader.loadRes(fullPathOfTmxFile, cc.TiledMapAsset, (err, tmxAsset) => {
      if (null != err) {
        console.error(err);
        return;
      }

      /*
      [WARNING] 
      
      - The order of the following statements is important, because we should have finished "_resetCurrentMatch" before the first "RoomDownsyncFrame". 
      - It's important to assign new "tmxAsset" before "extractBoundaryObjects", to ensure that the correct tilesets are used.
      - To ensure clearance, put destruction of the "cc.TiledMap" component preceding that of "mapNode.destroyAllChildren()".
      */

      tiledMapIns.tmxAsset = null;
      mapNode.removeAllChildren();
      self._resetCurrentMatch();

      tiledMapIns.tmxAsset = tmxAsset;
      const newMapSize = tiledMapIns.getMapSize();
      const newTileSize = tiledMapIns.getTileSize();
      self.node.setContentSize(newMapSize.width * newTileSize.width, newMapSize.height * newTileSize.height);
      self.node.setPosition(cc.v2(0, 0));
      /*
      * Deliberately hiding "ImageLayer"s. This dirty fix is specific to "CocosCreator v2.2.1", where it got back the rendering capability of "ImageLayer of Tiled", yet made incorrectly. In this game our "markers of ImageLayers" are rendered by dedicated prefabs with associated colliders.
      *
      * -- YFLu, 2020-01-23
      */
      const existingImageLayers = tiledMapIns.getObjectGroups();
      for (let singleImageLayer of existingImageLayers) {
        singleImageLayer.node.opacity = 0;
      }

      let barrierIdCounter = 0;
      const boundaryObjs = tileCollisionManager.extractBoundaryObjects(self.node);
      for (let boundaryObj of boundaryObjs.barriers) {
        const x0 = boundaryObj.anchor.x,
          y0 = boundaryObj.anchor.y;

        const newBarrier = self.collisionSys.createPolygon(x0, y0, Array.from(boundaryObj, p => {
          return [p.x, p.y];
        }));

        if (self.showCriticalCoordinateLabels) {
          for (let i = 0; i < boundaryObj.length; ++i) {
            const barrierVertLabelNode = new cc.Node();
            switch (i % 4) {
              case 0:
                barrierVertLabelNode.color = cc.Color.RED;
                break;
              case 1:
                barrierVertLabelNode.color = cc.Color.GRAY;
                break;
              case 2:
                barrierVertLabelNode.color = cc.Color.BLACK;
                break;
              default:
                barrierVertLabelNode.color = cc.Color.MAGENTA;
                break;
            }
            const wx = boundaryObj.anchor.x + boundaryObj[i].x,
              wy = boundaryObj.anchor.y + boundaryObj[i].y;
            barrierVertLabelNode.setPosition(cc.v2(wx, wy));
            const barrierVertLabel = barrierVertLabelNode.addComponent(cc.Label);
            barrierVertLabel.fontSize = 12;
            barrierVertLabel.lineHeight = barrierVertLabel.fontSize + 1;
            barrierVertLabel.string = `(${wx.toFixed(1)}, ${wy.toFixed(1)})`;
            safelyAddChild(self.node, barrierVertLabelNode);
            setLocalZOrder(barrierVertLabelNode, 5);

            barrierVertLabelNode.active = true;
          }

        }
        // console.log("Created barrier: ", newBarrier);
        ++barrierIdCounter;
        const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter);
        self.collisionSysMap.set(collisionBarrierIndex, newBarrier);
      }
    });

  },

  update(dt) {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
      const elapsedMillisSinceLastFrameIdTriggered = performance.now() - self.lastRenderFrameIdTriggeredAt;
      if (elapsedMillisSinceLastFrameIdTriggered < (self.rollbackEstimatedDtMillis)) {
        // console.debug("Avoiding too fast frame@renderFrameId=", self.renderFrameId, ": elapsedMillisSinceLastFrameIdTriggered=", elapsedMillisSinceLastFrameIdTriggered);
        return;
      }
      try {
        let st = performance.now();
        let prevSelfInput = null,
          currSelfInput = null;
        const noDelayInputFrameId = self._convertToInputFrameId(self.renderFrameId, 0); // It's important that "inputDelayFrames == 0" here 
        if (self.shouldGenerateInputFrameUpsync(self.renderFrameId)) {
          const prevAndCurrInputs = self._generateInputFrameUpsync(noDelayInputFrameId);
          prevSelfInput = prevAndCurrInputs[0];
          currSelfInput = prevAndCurrInputs[1];
        }

        const rdf = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.collisionSys, self.collisionSysMap, false);
        self.applyRoomDownsyncFrameDynamics(rdf);
        let t3 = performance.now();
      } catch (err) {
        console.error("Error during Map.update", err);
      } finally {
        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
      }
    }
  },
});
