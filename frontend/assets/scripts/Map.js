const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const collisions = require('./modules/Collisions');
const RingBuffer = require('./RingBuffer');

window.ALL_MAP_STATES = {
  VISUAL: 0, // For free dragging & zooming.
  EDITING_BELONGING: 1,
  SHOWING_MODAL_POPUP: 2,
};

window.ALL_BATTLE_STATES = {
  WAITING: 0,
  IN_BATTLE: 1,
  IN_SETTLEMENT: 2,
  IN_DISMISSAL: 3,
};

window.MAGIC_ROOM_DOWNSYNC_FRAME_ID = {
  BATTLE_READY_TO_START: -1,
  BATTLE_START: 0
};

window.PlayerBattleState = {
  ADDED_PENDING_BATTLE_COLLIDER_ACK: 0,
  READDED_PENDING_BATTLE_COLLIDER_ACK: 1,
  ACTIVE: 2,
  DISCONNECTED: 3,
  LOST: 4,
  EXPELLED_DURING_GAME: 5,
  EXPELLED_IN_DISMISSAL: 6
};

cc.Class({
  extends: cc.Component,

  properties: {
    canvasNode: {
      type: cc.Node,
      default: null,
    },
    controlledCharacterPrefab: {
      type: cc.Prefab,
      default: null,
    },
    joystickInputControllerNode: {
      type: cc.Node,
      default: null
    },
    confirmLogoutPrefab: {
      type: cc.Prefab,
      default: null
    },
    simplePressToGoDialogPrefab: {
      type: cc.Prefab,
      default: null
    },
    boundRoomIdLabel: {
      type: cc.Label,
      default: null
    },
    countdownLabel: {
      type: cc.Label,
      default: null
    },
    resultPanelPrefab: {
      type: cc.Prefab,
      default: null
    },
    gameRulePrefab: {
      type: cc.Prefab,
      default: null
    },
    findingPlayerPrefab: {
      type: cc.Prefab,
      default: null
    },
    countdownToBeginGamePrefab: {
      type: cc.Prefab,
      default: null
    },
    playersInfoPrefab: {
      type: cc.Prefab,
      default: null
    },
    forceBigEndianFloatingNumDecoding: {
      default: false,
    },
    renderFrameIdLagTolerance: {
      type: cc.Integer,
      default: 4 // implies (renderFrameIdLagTolerance >> inputScaleFrames) count of inputFrameIds
    },
    jigglingEps1D: {
      type: cc.Float,
      default: 1e-3
    },
    bulletTriggerEnabled: {
      default: false
    },
  },

  _inputFrameIdDebuggable(inputFrameId) {
    return (0 == inputFrameId % 10);
  },

  _convertToInputFrameId(renderFrameId, inputDelayFrames) {
    if (renderFrameId < inputDelayFrames) return 0;
    return ((renderFrameId - inputDelayFrames) >> this.inputScaleFrames);
  },

  _convertToFirstUsedRenderFrameId(inputFrameId, inputDelayFrames) {
    return ((inputFrameId << this.inputScaleFrames) + inputDelayFrames);
  },

  shouldGenerateInputFrameUpsync(renderFrameId) {
    return ((renderFrameId & ((1 << this.inputScaleFrames) - 1)) == 0);
  },

  _allConfirmed(confirmedList) {
    return (confirmedList + 1) == (1 << this.playerRichInfoDict.size);
  },

  _generateInputFrameUpsync(inputFrameId) {
    const self = this;
    if (
      null == self.ctrl ||
      null == self.selfPlayerInfo
    ) {
      throw `noDelayInputFrameId=${inputFrameId} couldn't be generated: recentInputCache=${self._stringifyRecentInputCache(false)}`;
    }

    let previousSelfInput = null,
      currSelfInput = null;
    const joinIndex = self.selfPlayerInfo.joinIndex;
    // [WARNING] The while-loop here handles a situation where the "resync rdf & accompaniedInputFrameDownsyncBatch" mismatched and we have to predict some "gap-inputFrames"! 
    while (self.recentInputCache.edFrameId <= inputFrameId) {
      // TODO: find some kind of synchronization mechanism against "onInputFrameDownsyncBatch"!
      const previousInputFrameDownsyncWithPrediction = self.getCachedInputFrameDownsyncWithPrediction(inputFrameId - 1);
      previousSelfInput = (null == previousInputFrameDownsyncWithPrediction ? null : previousInputFrameDownsyncWithPrediction.inputList[joinIndex - 1]);

      // If "forceConfirmation" is active on backend, there's a chance that the already downsynced "inputFrameDownsync"s are ahead of a locally generating inputFrameId, in this case we respect the downsynced one.  
      const existingInputFrame = self.recentInputCache.getByFrameId(inputFrameId);
      if (null != existingInputFrame && self._allConfirmed(existingInputFrame.confirmedList)) {
        console.log(`noDelayInputFrameId=${inputFrameId} already exists in recentInputCache and is all-confirmed: recentInputCache=${self._stringifyRecentInputCache(false)}`);
        return [previousSelfInput, existingInputFrame.inputList[joinIndex - 1]];
      }
      const prefabbedInputList = (null == previousInputFrameDownsyncWithPrediction ? new Array(self.playerRichInfoDict.size).fill(0) : previousInputFrameDownsyncWithPrediction.inputList.slice());
      currSelfInput = self.ctrl.getEncodedInput();
      prefabbedInputList[(joinIndex - 1)] = currSelfInput;
      const prefabbedInputFrameDownsync = window.pb.protos.InputFrameDownsync.create({
        inputFrameId: self.recentInputCache.edFrameId,
        inputList: prefabbedInputList,
        confirmedList: (1 << (self.selfPlayerInfo.joinIndex - 1))
      });

      self.recentInputCache.put(prefabbedInputFrameDownsync); // A prefabbed inputFrame, would certainly be adding a new inputFrame to the cache, because server only downsyncs "all-confirmed inputFrames" 
    }

    return [previousSelfInput, currSelfInput];
  },

  shouldSendInputFrameUpsyncBatch(prevSelfInput, currSelfInput, lastUpsyncInputFrameId, currInputFrameId) {
    /*
    For a 2-player-battle, this "shouldUpsyncForEarlyAllConfirmedOnBackend" can be omitted, however for more players in a same battle, to avoid a "long time non-moving player" jamming the downsync of other moving players, we should use this flag.

    When backend implements the "force confirmation" feature, we can have "false == shouldUpsyncForEarlyAllConfirmedOnBackend" all the time as well!
    */
    if (null == currSelfInput) return false;

    const shouldUpsyncForEarlyAllConfirmedOnBackend = (currInputFrameId - lastUpsyncInputFrameId >= this.inputFrameUpsyncDelayTolerance);
    return shouldUpsyncForEarlyAllConfirmedOnBackend || (prevSelfInput != currSelfInput);
  },

  sendInputFrameUpsyncBatch(latestLocalInputFrameId) {
    // [WARNING] Why not just send the latest input? Because different player would have a different "latestLocalInputFrameId" of changing its last input, and that could make the server not recognizing any "all-confirmed inputFrame"!
    const self = this;
    let inputFrameUpsyncBatch = [];
    let batchInputFrameIdSt = self.lastUpsyncInputFrameId + 1;
    if (batchInputFrameIdSt < self.recentInputCache.stFrameId) {
      // Upon resync, "self.lastUpsyncInputFrameId" might not have been updated properly.
      batchInputFrameIdSt = self.recentInputCache.stFrameId;
    }
    for (let i = batchInputFrameIdSt; i <= latestLocalInputFrameId; ++i) {
      const inputFrameDownsync = self.recentInputCache.getByFrameId(i);
      if (null == inputFrameDownsync) {
        console.error(`sendInputFrameUpsyncBatch: recentInputCache is NOT having inputFrameId=i: latestLocalInputFrameId=${latestLocalInputFrameId}, recentInputCache=${self._stringifyRecentInputCache(false)}`);
      } else {
        const inputFrameUpsync = {
          inputFrameId: i,
          encoded: inputFrameDownsync.inputList[self.selfPlayerInfo.joinIndex - 1],
        };
        inputFrameUpsyncBatch.push(inputFrameUpsync);
      }
    }

    // console.info(`inputFrameUpsyncBatch: ${JSON.stringify(inputFrameUpsyncBatch)}`);
    const reqData = window.pb.protos.WsReq.encode({
      msgId: Date.now(),
      playerId: self.selfPlayerInfo.id,
      act: window.UPSYNC_MSG_ACT_PLAYER_CMD,
      joinIndex: self.selfPlayerInfo.joinIndex,
      ackingFrameId: self.lastAllConfirmedRenderFrameId,
      ackingInputFrameId: self.lastAllConfirmedInputFrameId,
      inputFrameUpsyncBatch: inputFrameUpsyncBatch,
    }).finish();
    window.sendSafely(reqData);
    self.lastUpsyncInputFrameId = latestLocalInputFrameId;
    if (self.lastUpsyncInputFrameId >= self.recentInputCache.edFrameId) {
      throw `noDelayInputFrameId=${self.lastUpsyncInputFrameId} == latestLocalInputFrameId=${latestLocalInputFrameId} seems not properly dumped #2: recentInputCache=${self._stringifyRecentInputCache(false)}`;
    }
  },

  onEnable() {
    cc.log("+++++++ Map onEnable()");
  },

  onDisable() {
    cc.log("+++++++ Map onDisable()");
  },

  onDestroy() {
    const self = this;
    console.warn("+++++++ Map onDestroy()");
    if (null == self.battleState || ALL_BATTLE_STATES.WAITING == self.battleState) {
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    }
    if (null != window.handleBattleColliderInfo) {
      window.handleBattleColliderInfo = null;
    }
    if (null != window.handleClientSessionError) {
      window.handleClientSessionError = null;
    }
  },

  popupSimplePressToGo(labelString, hideYesButton) {
    const self = this;
    self.state = ALL_MAP_STATES.SHOWING_MODAL_POPUP;

    const canvasNode = self.canvasNode;
    const simplePressToGoDialogNode = cc.instantiate(self.simplePressToGoDialogPrefab);
    simplePressToGoDialogNode.setPosition(cc.v2(0, 0));
    simplePressToGoDialogNode.setScale(1 / canvasNode.scale);
    const simplePressToGoDialogScriptIns = simplePressToGoDialogNode.getComponent("SimplePressToGoDialog");
    const yesButton = simplePressToGoDialogNode.getChildByName("Yes");
    const postDismissalByYes = () => {
      self.transitToState(ALL_MAP_STATES.VISUAL);
      canvasNode.removeChild(simplePressToGoDialogNode);
    }
    simplePressToGoDialogNode.getChildByName("Hint").getComponent(cc.Label).string = labelString;
    yesButton.once("click", simplePressToGoDialogScriptIns.dismissDialog.bind(simplePressToGoDialogScriptIns, postDismissalByYes));
    yesButton.getChildByName("Label").getComponent(cc.Label).string = "OK";

    if (true == hideYesButton) {
      yesButton.active = false;
    }

    self.transitToState(ALL_MAP_STATES.SHOWING_MODAL_POPUP);
    safelyAddChild(self.widgetsAboveAllNode, simplePressToGoDialogNode);
    setLocalZOrder(simplePressToGoDialogNode, 20);
    return simplePressToGoDialogNode;
  },

  alertForGoingBackToLoginScene(labelString, mapIns, shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage) {
    const millisToGo = 3000;
    mapIns.popupSimplePressToGo(cc.js.formatStr("%s will logout in %s seconds.", labelString, millisToGo / 1000));
    setTimeout(() => {
      mapIns.logout(false, shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage);
    }, millisToGo);
  },

  _resetCurrentMatch() {
    const self = this;
    const mapNode = self.node;
    const canvasNode = mapNode.parent;

    // Clearing previous info of all players. [BEGINS]
    self.collisionPlayerIndexPrefix = (1 << 17); // For tracking the movements of players 
    if (null != self.playerRichInfoDict) {
      self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
        if (playerRichInfo.node.parent) {
          playerRichInfo.node.parent.removeChild(playerRichInfo.node);
        }
      });
    }
    self.playerRichInfoDict = new Map();
    // Clearing previous info of all players. [ENDS]

    self.renderFrameId = 0; // After battle started
    self.bulletBattleLocalIdCounter = 0;
    self.lastAllConfirmedRenderFrameId = -1;
    self.lastAllConfirmedInputFrameId = -1;
    self.lastUpsyncInputFrameId = -1;
    self.chaserRenderFrameId = -1; // at any moment, "lastAllConfirmedRenderFrameId <= chaserRenderFrameId <= renderFrameId", but "chaserRenderFrameId" would fluctuate according to "onInputFrameDownsyncBatch"

    self.recentRenderCache = new RingBuffer(self.renderCacheSize);

    self.selfPlayerInfo = null; // This field is kept for distinguishing "self" and "others".
    self.recentInputCache = new RingBuffer((self.renderCacheSize >> 1) + 1);

    self.collisionSys = new collisions.Collisions();

    self.collisionBarrierIndexPrefix = (1 << 16); // For tracking the movements of barriers, though not yet actually used 
    self.collisionBulletIndexPrefix = (1 << 15); // For tracking the movements of bullets 
    self.collisionSysMap = new Map();

    console.log(`collisionSys & collisionSysMap reset`);

    self.transitToState(ALL_MAP_STATES.VISUAL);

    self.battleState = ALL_BATTLE_STATES.WAITING;

    self.countdownNanos = null;
    if (self.countdownLabel) {
      self.countdownLabel.string = "";
    }
    if (self.findingPlayerNode) {
      const findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
      findingPlayerScriptIns.init();
    }
    if (self.playersInfoNode) {
      safelyAddChild(self.widgetsAboveAllNode, self.playersInfoNode);
    }
    if (self.findingPlayerNode) {
      safelyAddChild(self.widgetsAboveAllNode, self.findingPlayerNode);
    }
  },

  onLoad() {
    const self = this;
    window.mapIns = self;
    window.forceBigEndianFloatingNumDecoding = self.forceBigEndianFloatingNumDecoding;

    self.showCriticalCoordinateLabels = false;

    console.warn("+++++++ Map onLoad()");
    window.handleClientSessionError = function() {
      console.warn('+++++++ Common handleClientSessionError()');

      if (ALL_BATTLE_STATES.IN_SETTLEMENT == self.battleState) {
        console.log("Battled ended by settlement");
      } else {
        console.warn("Connection lost, going back to login page");
        window.clearLocalStorageAndBackToLoginScene(true);
      }
    };

    const mapNode = self.node;
    const canvasNode = mapNode.parent;
    cc.director.getCollisionManager().enabled = false;
    // self.musicEffectManagerScriptIns = self.node.getComponent("MusicEffectManager");
    self.musicEffectManagerScriptIns = null;

    /** Init required prefab started. */
    self.confirmLogoutNode = cc.instantiate(self.confirmLogoutPrefab);
    self.confirmLogoutNode.getComponent("ConfirmLogout").mapNode = self.node;

    // Initializes Result panel.
    self.resultPanelNode = cc.instantiate(self.resultPanelPrefab);
    self.resultPanelNode.width = self.canvasNode.width;
    self.resultPanelNode.height = self.canvasNode.height;

    const resultPanelScriptIns = self.resultPanelNode.getComponent("ResultPanel");
    resultPanelScriptIns.mapScriptIns = self;
    resultPanelScriptIns.onAgainClicked = () => {
      self.battleState = ALL_BATTLE_STATES.WAITING;
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      window.initPersistentSessionClient(self.initAfterWSConnected, null /* Deliberately NOT passing in any `expectedRoomId`. -- YFLu */ );
    };
    resultPanelScriptIns.onCloseDelegate = () => {};

    self.gameRuleNode = cc.instantiate(self.gameRulePrefab);
    self.gameRuleNode.width = self.canvasNode.width;
    self.gameRuleNode.height = self.canvasNode.height;

    self.gameRuleScriptIns = self.gameRuleNode.getComponent("GameRule");
    self.gameRuleScriptIns.mapNode = self.node;

    self.findingPlayerNode = cc.instantiate(self.findingPlayerPrefab);
    self.findingPlayerNode.width = self.canvasNode.width;
    self.findingPlayerNode.height = self.canvasNode.height;
    const findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
    findingPlayerScriptIns.init();

    self.playersInfoNode = cc.instantiate(self.playersInfoPrefab);

    self.countdownToBeginGameNode = cc.instantiate(self.countdownToBeginGamePrefab);
    self.countdownToBeginGameNode.width = self.canvasNode.width;
    self.countdownToBeginGameNode.height = self.canvasNode.height;

    self.mainCameraNode = canvasNode.getChildByName("Main Camera");
    self.mainCamera = self.mainCameraNode.getComponent(cc.Camera);
    for (let child of self.mainCameraNode.children) {
      child.setScale(1 / self.mainCamera.zoomRatio);
    }
    self.widgetsAboveAllNode = self.mainCameraNode.getChildByName("WidgetsAboveAll");
    self.mainCameraNode.setPosition(cc.v2());

    /** Init required prefab ended. */

    window.handleBattleColliderInfo = function(parsedBattleColliderInfo) {
      console.log(`Received parsedBattleColliderInfo via ws`);
      // TODO: Upon reconnection, the backend might have already been sending down data that'd trigger "onRoomDownsyncFrame & onInputFrameDownsyncBatch", but frontend could reject those data due to "battleState != PlayerBattleState.ACTIVE".
      Object.assign(self, parsedBattleColliderInfo);
      self.gravityX = parsedBattleColliderInfo.gravityX; // to avoid integer default value 0 accidentally becoming null in "Object.assign(...)"
      self.tooFastDtIntervalMillis = 0.5 * self.rollbackEstimatedDtMillis;

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

          const newBarrierCollider = self.collisionSys.createPolygon(x0, y0, Array.from(boundaryObj, p => {
            return [p.x, p.y];
          }));
          newBarrierCollider.data = {
            hardPushback: true
          };

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
          ++barrierIdCounter;
          const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter);
          self.collisionSysMap.set(collisionBarrierIndex, newBarrierCollider);
        // console.log(`Created new barrier collider: ${collisionBarrierIndex}`);
        }

        self.selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
        Object.assign(self.selfPlayerInfo, {
          id: self.selfPlayerInfo.playerId
        });

        const reqData = window.pb.protos.WsReq.encode({
          msgId: Date.now(),
          act: window.UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK,
        }).finish();
        window.sendSafely(reqData);
        console.log(`Sent UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK via ws`);
      });
    };

    self.initAfterWSConnected = () => {
      const self = window.mapIns;
      self.hideGameRuleNode();
      self.transitToState(ALL_MAP_STATES.WAITING);
      self._inputControlEnabled = false;
    }

    // The player is now viewing "self.gameRuleNode" with button(s) to start an actual battle. -- YFLu
    const expectedRoomId = window.getExpectedRoomIdSync();
    const boundRoomId = window.getBoundRoomIdFromPersistentStorage();

    console.warn("Map.onLoad, expectedRoomId == ", expectedRoomId, ", boundRoomId == ", boundRoomId);

    if (null != expectedRoomId) {
      self.disableGameRuleNode();

      // The player is now possibly viewing "self.gameRuleNode" with no button, and should wait for `self.initAfterWSConnected` to be called. 
      self.battleState = ALL_BATTLE_STATES.WAITING;
      window.initPersistentSessionClient(self.initAfterWSConnected, expectedRoomId);
    } else if (null != boundRoomId) {
      self.disableGameRuleNode();
      self.battleState = ALL_BATTLE_STATES.WAITING;
      window.initPersistentSessionClient(self.initAfterWSConnected, boundRoomId);
    } else {
      self.showPopupInCanvas(self.gameRuleNode);
    // Deliberately left blank. -- YFLu
    }
  },

  disableGameRuleNode() {
    const self = window.mapIns;
    if (null == self.gameRuleNode) {
      return;
    }
    if (null == self.gameRuleScriptIns) {
      return;
    }
    if (null == self.gameRuleScriptIns.modeButton) {
      return;
    }
    self.gameRuleScriptIns.modeButton.active = false;
  },

  hideGameRuleNode() {
    const self = window.mapIns;
    if (null == self.gameRuleNode) {
      return;
    }
    self.gameRuleNode.active = false;
  },

  enableInputControls() {
    this._inputControlEnabled = true;
  },

  disableInputControls() {
    this._inputControlEnabled = false;
  },

  onRoomDownsyncFrame(rdf, accompaniedInputFrameDownsyncBatch) {
    // This function is also applicable to "re-joining".
    const self = window.mapIns;
    if (!self.recentRenderCache) {
      return;
    }
    if (ALL_BATTLE_STATES.IN_SETTLEMENT == self.battleState) {
      return;
    }
    const shouldForceDumping1 = (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.id);
    const shouldForceDumping2 = (rdf.id > self.renderFrameId + self.renderFrameIdLagTolerance);

    const [dumpRenderCacheRet, oldStRenderFrameId, oldEdRenderFrameId] = (shouldForceDumping1 || shouldForceDumping2) ? self.recentRenderCache.setByFrameId(rdf, rdf.id) : [window.RING_BUFF_CONSECUTIVE_SET, null, null];
    if (window.RING_BUFF_FAILED_TO_SET == dumpRenderCacheRet) {
      throw `Failed to dump render cache#1 (maybe recentRenderCache too small)! rdf.id=${rdf.id}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
    }
    if (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START < rdf.id && window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet) {
      /*
      Don't change 
      - lastAllConfirmedRenderFrameId, it's updated only in "rollbackAndChase" (except for when RING_BUFF_NON_CONSECUTIVE_SET) 
      - chaserRenderFrameId, it's updated only in "rollbackAndChase & onInputFrameDownsyncBatch" (except for when RING_BUFF_NON_CONSECUTIVE_SET)
      */
      return dumpRenderCacheRet;
    }

    // The logic below applies to (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.id || window.RING_BUFF_NON_CONSECUTIVE_SET == dumpRenderCacheRet)
    const players = rdf.players;
    self._initPlayerRichInfoDict(players);

    // Show the top status indicators for IN_BATTLE 
    if (self.playersInfoNode) {
      const playersInfoScriptIns = self.playersInfoNode.getComponent("PlayersInfo");
      for (let i in players) {
        playersInfoScriptIns.updateData(players[i]);
      }
    }

    if (null == self.renderFrameId || self.renderFrameId <= rdf.id) {
      // In fact, not having "window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet" should already imply that "self.renderFrameId <= rdf.id", but here we double check and log the anomaly  

      if (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.id) {
        console.log('On battle started! renderFrameId=', rdf.id);
      } else {
        self.hideFindingPlayersGUI(rdf);
        self.onInputFrameDownsyncBatch(accompaniedInputFrameDownsyncBatch); // Important to do this step before setting IN_BATTLE
        console.warn(`Got resync@localRenderFrameId=${self.renderFrameId} -> rdf.id=${rdf.id} & rdf.backendUnconfirmedMask=${rdf.backendUnconfirmedMask}, @lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, @lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, @chaserRenderFrameId=${self.chaserRenderFrameId}, @localRecentInputCache=${mapIns._stringifyRecentInputCache(false)}`);
      }

      self.renderFrameId = rdf.id;
      self.lastRenderFrameIdTriggeredAt = performance.now();
      // In this case it must be true that "rdf.id > chaserRenderFrameId >= lastAllConfirmedRenderFrameId".
      self.lastAllConfirmedRenderFrameId = rdf.id;
      self.chaserRenderFrameId = rdf.id;
      const candidateLastAllConfirmedInputFrame = self._convertToInputFrameId(rdf.id - 1, self.inputDelayFrames);
      if (self.lastAllConfirmedInputFrame < candidateLastAllConfirmedInputFrame) {
        self.lastAllConfirmedInputFrame = candidateLastAllConfirmedInputFrame;
      }

      const canvasNode = self.canvasNode;
      self.ctrl = canvasNode.getComponent("TouchEventsManager");
      self.enableInputControls();
      self.transitToState(ALL_MAP_STATES.VISUAL);
      self.battleState = ALL_BATTLE_STATES.IN_BATTLE;

      if (self.countdownToBeginGameNode && self.countdownToBeginGameNode.parent) {
        self.countdownToBeginGameNode.parent.removeChild(self.countdownToBeginGameNode);
      }

      if (null != self.musicEffectManagerScriptIns) {
        self.musicEffectManagerScriptIns.playBGM();
      }
    } else {
      console.warn(`Anomaly when onRoomDownsyncFrame is called by rdf=${JSON.stringify(rdf)}, recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`);
    }

    // [WARNING] Leave all graphical updates in "update(dt)" by "applyRoomDownsyncFrameDynamics"
    return dumpRenderCacheRet;
  },

  equalInputLists(lhs, rhs) {
    if (null == lhs || null == rhs) return false;
    if (lhs.length != rhs.length) return false;
    for (let i in lhs) {
      if (lhs[i] == rhs[i]) continue;
      return false;
    }
    return true;
  },

  onInputFrameDownsyncBatch(batch) {
    // TODO: find some kind of synchronization mechanism against "_generateInputFrameUpsync"!
    const self = this;
    if (!self.recentInputCache) {
      return;
    }
    if (ALL_BATTLE_STATES.IN_SETTLEMENT == self.battleState) {
      return;
    }

    let firstPredictedYetIncorrectInputFrameId = null;
    for (let k in batch) {
      const inputFrameDownsync = batch[k];
      const inputFrameDownsyncId = inputFrameDownsync.inputFrameId;
      if (inputFrameDownsyncId < self.lastAllConfirmedInputFrameId) {
        continue;
      }
      self.lastAllConfirmedInputFrameId = inputFrameDownsyncId;
      const localInputFrame = self.recentInputCache.getByFrameId(inputFrameDownsyncId);
      if (null != localInputFrame
        &&
        null == firstPredictedYetIncorrectInputFrameId
        &&
        !self.equalInputLists(localInputFrame.inputList, inputFrameDownsync.inputList)
      ) {
        firstPredictedYetIncorrectInputFrameId = inputFrameDownsyncId;
      }
      // [WARNING] Take all "inputFrameDownsync" from backend as all-confirmed, it'll be later checked by "rollbackAndChase". 
      inputFrameDownsync.confirmedList = (1 << self.playerRichInfoDict.size) - 1;
      const [ret, oldStFrameId, oldEdFrameId] = self.recentInputCache.setByFrameId(inputFrameDownsync, inputFrameDownsync.inputFrameId);
      if (window.RING_BUFF_FAILED_TO_SET == ret) {
        throw `Failed to dump input cache (maybe recentInputCache too small)! inputFrameDownsync.inputFrameId=${inputFrameDownsync.inputFrameId}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
      }
    }

    if (null == firstPredictedYetIncorrectInputFrameId) return;
    const inputFrameId1 = firstPredictedYetIncorrectInputFrameId;
    const renderFrameId1 = self._convertToFirstUsedRenderFrameId(inputFrameId1, self.inputDelayFrames); // a.k.a. "firstRenderFrameIdUsingIncorrectInputFrameId"
    if (renderFrameId1 >= self.renderFrameId) return; // No need to rollback when "renderFrameId1 == self.renderFrameId", because the "corresponding delayedInputFrame for renderFrameId1" is NOT YET EXECUTED BY NOW, it just went through "++self.renderFrameId" in "update(dt)" and javascript-runtime is mostly single-threaded in our programmable range.

    if (renderFrameId1 >= self.chaserRenderFrameId) return;

    /*
    A typical case is as follows.
    --------------------------------------------------------
    [self.lastAllConfirmedRenderFrameId]       :              22

    <renderFrameId1>                           :              36


    <self.chaserRenderFrameId>                 :              62

    [self.renderFrameId]                       :              64
    --------------------------------------------------------
    */
    // The actual rollback-and-chase would later be executed in update(dt). 
    console.warn(`Mismatched input detected, resetting chaserRenderFrameId: ${self.chaserRenderFrameId}->${renderFrameId1} by firstPredictedYetIncorrectInputFrameId: ${inputFrameId1}`);
    self.chaserRenderFrameId = renderFrameId1;
  },

  onPlayerAdded(rdf) {
    const self = this;
    // Update the "finding player" GUI and show it if not previously present
    if (!self.findingPlayerNode.parent) {
      self.showPopupInCanvas(self.findingPlayerNode);
    }
    let findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
    findingPlayerScriptIns.updatePlayersInfo(rdf.players);
  },

  logBattleStats() {
    const self = this;
    let s = [];
    s.push(`Battle stats: renderFrameId=${self.renderFrameId}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastUpsyncInputFrameId=${self.lastUpsyncInputFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, chaserRenderFrameId=${self.chaserRenderFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`);

    for (let i = self.recentInputCache.stFrameId; i < self.recentInputCache.edFrameId; ++i) {
      const inputFrameDownsync = self.recentInputCache.getByFrameId(i);
      s.push(JSON.stringify(inputFrameDownsync));
    }

    console.log(s.join('\n'));
  },

  onBattleStopped() {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE != self.battleState) {
      return;
    }
    self.countdownNanos = null;
    self.logBattleStats();
    if (self.musicEffectManagerScriptIns) {
      self.musicEffectManagerScriptIns.stopAllMusic();
    }
    const canvasNode = self.canvasNode;
    const resultPanelNode = self.resultPanelNode;
    const resultPanelScriptIns = resultPanelNode.getComponent("ResultPanel");
    resultPanelScriptIns.showPlayerInfo(self.playerRichInfoDict);
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    self.battleState = ALL_BATTLE_STATES.IN_SETTLEMENT;
    self.showPopupInCanvas(resultPanelNode);

    // Clear player info
    self.playersInfoNode.getComponent("PlayersInfo").clearInfo();
  },

  spawnPlayerNode(joinIndex, vx, vy, playerDownsyncInfo) {
    const self = this;
    const newPlayerNode = cc.instantiate(self.controlledCharacterPrefab)
    const playerScriptIns = newPlayerNode.getComponent("ControlledCharacter");
    if (1 == joinIndex) {
      playerScriptIns.setSpecies("SoldierWaterGhost");
    } else if (2 == joinIndex) {
      playerScriptIns.setSpecies("SoldierFireGhost");
    }

    const [wx, wy] = self.virtualGridToWorldPos(vx, vy);
    newPlayerNode.setPosition(wx, wy);
    playerScriptIns.mapNode = self.node;
    const colliderWidth = playerDownsyncInfo.colliderRadius * 2,
      colliderHeight = playerDownsyncInfo.colliderRadius * 4;
    const [x0, y0] = self.virtualGridToPolygonColliderAnchorPos(vx, vy, colliderWidth, colliderHeight),
      pts = [[0, 0], [colliderWidth, 0], [colliderWidth, colliderHeight], [0, colliderHeight]];

    // [WARNING] The animNode "anchor & offset" are tuned to fit in this collider by "ControlledCharacter prefab & AttackingCharacter.js"! 
    const newPlayerCollider = self.collisionSys.createPolygon(x0, y0, pts);
    const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
    newPlayerCollider.data = playerDownsyncInfo;
    self.collisionSysMap.set(collisionPlayerIndex, newPlayerCollider);

    console.log(`Created new player collider: joinIndex=${joinIndex}, colliderRadius=${playerDownsyncInfo.colliderRadius}`);

    safelyAddChild(self.node, newPlayerNode);
    setLocalZOrder(newPlayerNode, 5);

    newPlayerNode.active = true;
    playerScriptIns.updateCharacterAnim(playerDownsyncInfo, null, true);

    return [newPlayerNode, playerScriptIns];
  },

  update(dt) {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
      const elapsedMillisSinceLastFrameIdTriggered = performance.now() - self.lastRenderFrameIdTriggeredAt;
      if (elapsedMillisSinceLastFrameIdTriggered < self.tooFastDtIntervalMillis) {
        // [WARNING] We should avoid a frontend ticking too fast to prevent cheating, as well as ticking too slow to cause a "resync avalanche" that impacts user experience!
        // console.debug("Avoiding too fast frame@renderFrameId=", self.renderFrameId, ": elapsedMillisSinceLastFrameIdTriggered=", elapsedMillisSinceLastFrameIdTriggered);
        return;
      }
      try {
        let st = performance.now();
        let prevSelfInput = null,
          currSelfInput = null;
        const noDelayInputFrameId = self._convertToInputFrameId(self.renderFrameId, 0); // It's important that "inputDelayFrames == 0" here 
        if (self.shouldGenerateInputFrameUpsync(self.renderFrameId)) {
          [prevSelfInput, currSelfInput] = self._generateInputFrameUpsync(noDelayInputFrameId);
        }

        let t0 = performance.now();
        if (self.shouldSendInputFrameUpsyncBatch(prevSelfInput, currSelfInput, self.lastUpsyncInputFrameId, noDelayInputFrameId)) {
          // TODO: Is the following statement run asynchronously in an implicit manner? Should I explicitly run it asynchronously?
          self.sendInputFrameUpsyncBatch(noDelayInputFrameId);
        }

        let t1 = performance.now();
        // Use "fractional-frame-chasing" to guarantee that "self.update(dt)" is not jammed by a "large range of frame-chasing". See `<proj-root>/ConcerningEdgeCases.md` for the motivation. 
        const prevChaserRenderFrameId = self.chaserRenderFrameId;
        let nextChaserRenderFrameId = (prevChaserRenderFrameId + self.maxChasingRenderFramesPerUpdate);
        if (nextChaserRenderFrameId > self.renderFrameId) {
          nextChaserRenderFrameId = self.renderFrameId;
        }
        self.rollbackAndChase(prevChaserRenderFrameId, nextChaserRenderFrameId, self.collisionSys, self.collisionSysMap, true);
        let t2 = performance.now();

        // Inside the following "self.rollbackAndChase" actually ROLLS FORWARD w.r.t. the corresponding delayedInputFrame, REGARDLESS OF whether or not "self.chaserRenderFrameId == self.renderFrameId" now. 
        const [prevRdf, rdf] = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.collisionSys, self.collisionSysMap, false);
        /*
        const nonTrivialChaseEnded = (prevChaserRenderFrameId < nextChaserRenderFrameId && nextChaserRenderFrameId == self.renderFrameId); 
        if (nonTrivialChaseEnded) {
            console.debug("Non-trivial chase ended, prevChaserRenderFrameId=" + prevChaserRenderFrameId + ", nextChaserRenderFrameId=" + nextChaserRenderFrameId);
        }  
        */
        // [WARNING] Don't try to get "prevRdf(i.e. renderFrameId == latest-1)" by "self.recentRenderCache.getByFrameId(...)" here, as the cache might have been updated by asynchronous "onRoomDownsyncFrame(...)" calls!
        self.applyRoomDownsyncFrameDynamics(rdf, prevRdf);
        self.showDebugBoundaries(rdf);
        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
        self.lastRenderFrameIdTriggeredAt = performance.now();
        let t3 = performance.now();
      } catch (err) {
        console.error("Error during Map.update", err);
        self.onBattleStopped(); // TODO: Popup to ask player to refresh browser
      } finally {
        const countdownSeconds = parseInt(self.countdownNanos / 1000000000);
        if (isNaN(countdownSeconds)) {
          console.warn(`countdownSeconds is NaN for countdownNanos == ${self.countdownNanos}.`);
        }
        if (null != self.countdownLabel) {
          self.countdownLabel.string = countdownSeconds;
        }
      }
    }
  },

  transitToState(s) {
    const self = this;
    self.state = s;
  },

  logout(byClick /* The case where this param is "true" will be triggered within `ConfirmLogout.js`.*/ , shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage) {
    const self = this;
    const localClearance = () => {
      window.clearLocalStorageAndBackToLoginScene(shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage);
    }

    const selfPlayerStr = cc.sys.localStorage.getItem("selfPlayer");
    if (null == selfPlayerStr) {
      localClearance();
      return;
    }
    const selfPlayerInfo = JSON.parse(selfPlayerStr);
    try {
      NetworkUtils.ajax({
        url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.INT_AUTH_TOKEN + constants.ROUTE_PATH.LOGOUT,
        type: "POST",
        data: {
          intAuthToken: selfPlayerInfo.intAuthToken
        },
        success: function(res) {
          if (res.ret != constants.RET_CODE.OK) {
            console.log("Logout failed: ", res);
          }
          localClearance();
        },
        error: function(xhr, status, errMsg) {
          localClearance();
        },
        timeout: function() {
          localClearance();
        }
      });
    } catch (e) {} finally {
      // For Safari (both desktop and mobile).
      localClearance();
    }
  },

  onLogoutClicked(evt) {
    const self = this;
    self.showPopupInCanvas(self.confirmLogoutNode);
  },

  onLogoutConfirmationDismissed() {
    const self = this;
    self.transitToState(ALL_MAP_STATES.VISUAL);
    const canvasNode = self.canvasNode;
    canvasNode.removeChild(self.confirmLogoutNode);
    self.enableInputControls();
  },

  onGameRule1v1ModeClicked(evt, cb) {
    const self = this;
    self.battleState = ALL_BATTLE_STATES.WAITING;
    window.initPersistentSessionClient(self.initAfterWSConnected, null /* Deliberately NOT passing in any `expectedRoomId`. -- YFLu */ );
    self.hideGameRuleNode();
  },

  showPopupInCanvas(toShowNode) {
    const self = this;
    self.disableInputControls();
    self.transitToState(ALL_MAP_STATES.SHOWING_MODAL_POPUP);
    safelyAddChild(self.widgetsAboveAllNode, toShowNode);
    setLocalZOrder(toShowNode, 10);
  },

  hideFindingPlayersGUI(rdf) {
    const self = this;
    if (null == self.findingPlayerNode.parent) return;
    self.findingPlayerNode.parent.removeChild(self.findingPlayerNode);
  },

  onBattleReadyToStart(rdf) {
    const self = this;
    const players = rdf.players;
    self._initPlayerRichInfoDict(players);

    // Show the top status indicators for IN_BATTLE 
    if (self.playersInfoNode) {
      const playersInfoScriptIns = self.playersInfoNode.getComponent("PlayersInfo");
      for (let i in players) {
        playersInfoScriptIns.updateData(players[i]);
      }
    }
    console.log("Calling `onBattleReadyToStart` with:", players);
    if (self.findingPlayerNode) {
      const findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
      findingPlayerScriptIns.hideExitButton();
      findingPlayerScriptIns.updatePlayersInfo(players);
    }

    // Delay to hide the "finding player" GUI, then show a countdown clock
    if (self.countdownToBeginGameNode) {
      window.setTimeout(() => {
        self.hideFindingPlayersGUI();
        const countDownScriptIns = self.countdownToBeginGameNode.getComponent("CountdownToBeginGame");
        countDownScriptIns.setData();
        self.showPopupInCanvas(self.countdownToBeginGameNode);
      }, 1500);
    }
  },

  applyRoomDownsyncFrameDynamics(rdf, prevRdf) {
    const self = this;
    for (let [playerId, playerRichInfo] of self.playerRichInfoDict.entries()) {
      const immediatePlayerInfo = rdf.players[playerId];
      const prevRdfPlayer = (null == prevRdf ? null : prevRdf.players[playerId]);
      const [wx, wy] = self.virtualGridToWorldPos(immediatePlayerInfo.virtualGridX, immediatePlayerInfo.virtualGridY);
      //const justJiggling = (self.jigglingEps1D >= Math.abs(wx - playerRichInfo.node.x) && self.jigglingEps1D >= Math.abs(wy - playerRichInfo.node.y));
      playerRichInfo.node.setPosition(wx, wy);
      playerRichInfo.scriptIns.updateSpeed(immediatePlayerInfo.speed);
      playerRichInfo.scriptIns.updateCharacterAnim(immediatePlayerInfo, prevRdfPlayer, false);
    }

    // Update countdown
    self.countdownNanos = self.battleDurationNanos - self.renderFrameId * self.rollbackEstimatedDtNanos;
    if (self.countdownNanos <= 0) {
      self.onBattleStopped(self.playerRichInfoDict);
    }
  },

  showDebugBoundaries(rdf) {
    const self = this;
    if (self.showCriticalCoordinateLabels) {
      let g = self.g;
      g.clear();

      for (let k in self.collisionSys._bvh._bodies) {
        const body = self.collisionSys._bvh._bodies[k];
        if (!body._polygon) continue;
        if (null != body.data && null != body.data.joinIndex) {
          // character
          if (1 == body.data.joinIndex) {
            g.strokeColor = cc.Color.BLUE;
          } else {
            g.strokeColor = cc.Color.RED;
          }
        } else {
          // barrier
          g.strokeColor = cc.Color.WHITE;
        }
        g.moveTo(body.x, body.y);
        const cnt = body._coords.length;
        for (let j = 0; j < cnt; j += 2) {
          const x = body._coords[j],
            y = body._coords[j + 1];
          g.lineTo(x, y);
        }
        g.lineTo(body.x, body.y);
        g.stroke();
      }
      // For convenience of recovery upon reconnection, active bullets are always created & immediately removed from "collisionSys" within "applyInputFrameDownsyncDynamicsOnSingleRenderFrame"

      for (let k in rdf.meleeBullets) {
        const meleeBullet = rdf.meleeBullets[k];
        if (
          meleeBullet.originatedRenderFrameId + meleeBullet.startupFrames <= rdf.id
          &&
          meleeBullet.originatedRenderFrameId + meleeBullet.startupFrames + meleeBullet.activeFrames > rdf.id
        ) {
          const offender = rdf.players[meleeBullet.offenderPlayerId];
          if (1 == offender.joinIndex) {
            g.strokeColor = cc.Color.BLUE;
          } else {
            g.strokeColor = cc.Color.RED;
          }

          let xfac = 1; // By now, straight Punch offset doesn't respect "y-axis"
          if (0 > offender.dirX) {
            xfac = -1;
          }
          const [offenderWx, offenderWy] = self.virtualGridToWorldPos(offender.virtualGridX, offender.virtualGridY);
          const bulletWx = offenderWx + xfac * meleeBullet.hitboxOffset;
          const bulletWy = offenderWy + 0.5 * meleeBullet.hitboxSize.y;
          const [bulletCx, bulletCy] = self.worldToPolygonColliderAnchorPos(bulletWx, bulletWy, meleeBullet.hitboxSize.x * 0.5, meleeBullet.hitboxSize.y * 0.5),
            pts = [[0, 0], [meleeBullet.hitboxSize.x, 0], [meleeBullet.hitboxSize.x, meleeBullet.hitboxSize.y], [0, meleeBullet.hitboxSize.y]];

          g.moveTo(bulletCx, bulletCy);
          for (let j = 0; j < pts.length; j += 1) {
            g.lineTo(pts[j][0] + bulletCx, pts[j][1] + bulletCy);
          }
          g.lineTo(bulletCx, bulletCy);
          g.stroke();
        }
      }
    }
  },

  getCachedInputFrameDownsyncWithPrediction(inputFrameId) {
    const self = this;
    const inputFrameDownsync = self.recentInputCache.getByFrameId(inputFrameId);
    const lastAllConfirmedInputFrame = self.recentInputCache.getByFrameId(self.lastAllConfirmedInputFrameId);
    if (null != inputFrameDownsync && null != lastAllConfirmedInputFrame && inputFrameId > self.lastAllConfirmedInputFrameId) {
      for (let i = 0; i < inputFrameDownsync.inputList.length; ++i) {
        if (i == (self.selfPlayerInfo.joinIndex - 1)) continue;
        inputFrameDownsync.inputList[i] = (lastAllConfirmedInputFrame.inputList[i] & 15); // Don't predict attack input!
      }
    }

    return inputFrameDownsync;
  },

  // TODO: Write unit-test for this function to compare with its backend counter part
  applyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame, currRenderFrame, collisionSys, collisionSysMap) {
    const self = this;
    const nextRenderFramePlayers = {};
    for (let playerId in currRenderFrame.players) {
      const currPlayerDownsync = currRenderFrame.players[playerId];
      nextRenderFramePlayers[playerId] = {
        id: playerId,
        virtualGridX: currPlayerDownsync.virtualGridX,
        virtualGridY: currPlayerDownsync.virtualGridY,
        dirX: currPlayerDownsync.dirX,
        dirY: currPlayerDownsync.dirY,
        velX: currPlayerDownsync.velX,
        velY: currPlayerDownsync.velY,
        characterState: currPlayerDownsync.characterState,
        inAir: true,
        speed: currPlayerDownsync.speed,
        battleState: currPlayerDownsync.battleState,
        score: currPlayerDownsync.score,
        removed: currPlayerDownsync.removed,
        joinIndex: currPlayerDownsync.joinIndex,
        framesToRecover: (0 < currPlayerDownsync.framesToRecover ? currPlayerDownsync.framesToRecover - 1 : 0),
        hp: currPlayerDownsync.hp,
        maxHp: currPlayerDownsync.maxHp,
      };
    }

    const nextRenderFrameMeleeBullets = [];
    const effPushbacks = new Array(self.playerRichInfoArr.length);
    const hardPushbackNorms = new Array(self.playerRichInfoArr.length);

    // 1. Process player inputs
    /*
    [WARNING] Player input alone WOULD NOT take "characterState" into any "ATK_CHARACTER_STATE_IN_AIR_SET", only after the calculation of "effPushbacks" do we know exactly whether or not a player is "inAir", the finalize the transition of "thatPlayerInNextFrame.characterState". 
    */
    if (null != delayedInputFrame) {
      const delayedInputFrameForPrevRenderFrame = self.getCachedInputFrameDownsyncWithPrediction(self._convertToInputFrameId(currRenderFrame.id - 1, self.inputDelayFrames));
      const inputList = delayedInputFrame.inputList;
      for (let j in self.playerRichInfoArr) {
        const joinIndex = parseInt(j) + 1;
        const playerRichInfo = self.playerRichInfoArr[j];
        const playerId = playerRichInfo.id;
        const [currPlayerDownsync, thatPlayerInNextFrame] = [currRenderFrame.players[playerId], nextRenderFramePlayers[playerId]];
        if (0 < thatPlayerInNextFrame.framesToRecover) {
          // No need to process inputs for this player, but there might be bullet pushbacks on this player  
          continue;
        }

        const decodedInput = self.ctrl.decodeInput(inputList[joinIndex - 1]);
        const prevDecodedInput = (null == delayedInputFrameForPrevRenderFrame ? null : self.ctrl.decodeInput(delayedInputFrameForPrevRenderFrame.inputList[joinIndex - 1]));
        const prevBtnALevel = (null == prevDecodedInput ? 0 : prevDecodedInput.btnALevel);
        const prevBtnBLevel = (null == prevDecodedInput ? 0 : prevDecodedInput.btnBLevel);
        if (1 == decodedInput.btnBLevel && 0 == prevBtnBLevel) {
          const characStateAlreadyInAir = window.ATK_CHARACTER_STATE_IN_AIR_SET.has(thatPlayerInNextFrame.characterState);
          const characStateIsInterruptWaivable = window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(thatPlayerInNextFrame.characterState);
          if (
            !characStateAlreadyInAir
            &&
            characStateIsInterruptWaivable
          ) {
            thatPlayerInNextFrame.velY = self.jumpingInitVelY;
            console.log(`playerId=${playerId}, joinIndex=${joinIndex} triggered a rising-edge of btnB at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}, nextVelY=${thatPlayerInNextFrame.velY}, characStateAlreadyInAir=${characStateAlreadyInAir}, characStateIsInterruptWaivable=${characStateIsInterruptWaivable}`);
          }
        }

        if (1 == decodedInput.btnALevel && 0 == prevBtnALevel) {
          const punchSkillId = 1;
          const punch = window.pb.protos.MeleeBullet.create(self.meleeSkillConfig[punchSkillId]);
          thatPlayerInNextFrame.framesToRecover = punch.recoveryFrames;
          punch.battleLocalId = self.bulletBattleLocalIdCounter++;
          punch.offenderJoinIndex = joinIndex;
          punch.offenderPlayerId = playerId;
          punch.originatedRenderFrameId = currRenderFrame.id;
          nextRenderFrameMeleeBullets.push(punch);
          // console.log(`playerId=${playerId}, joinIndex=${joinIndex} triggered a rising-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);

          thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atk1[0];
          if (false == currPlayerDownsync.inAir) {
            thatPlayerInNextFrame.velX = 0; // prohibits simultaneous movement with Atk1 on the ground
          }
        } else if (0 == decodedInput.btnALevel && 1 == prevBtnALevel) {
          // console.log(`playerId=${playerId} triggered a falling-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
        } else {
          // No bullet trigger, process joystick movement inputs.
          if (0 != decodedInput.dx || 0 != decodedInput.dy) {
            // Update directions and thus would eventually update moving animation accordingly
            thatPlayerInNextFrame.dirX = decodedInput.dx;
            thatPlayerInNextFrame.dirY = decodedInput.dy;
            thatPlayerInNextFrame.velX = decodedInput.dx * currPlayerDownsync.speed;
            thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Walking[0];
          } else {
            thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Idle1[0];
            thatPlayerInNextFrame.velX = 0;
          }
        }
      }
    }

    // 2. Process player movement
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
      effPushbacks[joinIndex - 1] = [0.0, 0.0];
      const playerRichInfo = self.playerRichInfoArr[j];
      const playerId = playerRichInfo.id;
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      const [currPlayerDownsync, thatPlayerInNextFrame] = [currRenderFrame.players[playerId], nextRenderFramePlayers[playerId]];

      // Reset playerCollider position from the "virtual grid position"
      const [newVx, newVy] = [currPlayerDownsync.virtualGridX + currPlayerDownsync.velX, currPlayerDownsync.virtualGridY + currPlayerDownsync.velY];
      [playerCollider.x, playerCollider.y] = self.virtualGridToPolygonColliderAnchorPos(newVx, newVy, self.playerRichInfoArr[joinIndex - 1].colliderRadius, self.playerRichInfoArr[joinIndex - 1].colliderRadius);

      if (currPlayerDownsync.inAir) {
        thatPlayerInNextFrame.velX += self.gravityX;
        thatPlayerInNextFrame.velY += self.gravityY;
      }
    }

    // 3. Add bullet colliders into collision system
    const bulletColliders = new Map(); // Will all be removed at the end of `applyInputFrameDownsyncDynamicsOnSingleRenderFrame` due to the need for being rollback-compatible
    const removedBulletsAtCurrFrame = new Set();
    for (let k in currRenderFrame.meleeBullets) {
      const meleeBullet = currRenderFrame.meleeBullets[k];
      if (
        meleeBullet.originatedRenderFrameId + meleeBullet.startupFrames <= currRenderFrame.id
        &&
        meleeBullet.originatedRenderFrameId + meleeBullet.startupFrames + meleeBullet.activeFrames > currRenderFrame.id
      ) {
        const collisionBulletIndex = self.collisionBulletIndexPrefix + meleeBullet.battleLocalId;
        const collisionOffenderIndex = self.collisionPlayerIndexPrefix + meleeBullet.offenderJoinIndex;
        const offenderCollider = collisionSysMap.get(collisionOffenderIndex);
        const offender = currRenderFrame.players[meleeBullet.offenderPlayerId];

        let xfac = 1; // By now, straight Punch offset doesn't respect "y-axis"
        if (0 > offender.dirX) {
          xfac = -1;
        }
        const [offenderWx, offenderWy] = self.virtualGridToWorldPos(offender.virtualGridX, offender.virtualGridY);
        const bulletWx = offenderWx + xfac * meleeBullet.hitboxOffset;
        const bulletWy = offenderWy + 0.5 * meleeBullet.hitboxSize.y;
        const [bulletCx, bulletCy] = self.worldToPolygonColliderAnchorPos(bulletWx, bulletWy, meleeBullet.hitboxSize.x * 0.5, meleeBullet.hitboxSize.y * 0.5),
          pts = [[0, 0], [meleeBullet.hitboxSize.x, 0], [meleeBullet.hitboxSize.x, meleeBullet.hitboxSize.y], [0, meleeBullet.hitboxSize.y]];
        const newBulletCollider = collisionSys.createPolygon(bulletCx, bulletCy, pts);
        newBulletCollider.data = meleeBullet;
        collisionSysMap.set(collisionBulletIndex, newBulletCollider);
        bulletColliders.set(collisionBulletIndex, newBulletCollider);
      }
    }

    // 4. Invoke collision system stepping
    collisionSys.update();
    const result = collisionSys.createResult(); // Can I reuse a "self.collisionSysResult" object throughout the whole battle?

    // 5. Calc pushbacks for each player (after its movement) w/o bullets
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
      const playerRichInfo = self.playerRichInfoArr[j];
      const playerId = playerRichInfo.id;
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      const potentials = playerCollider.potentials();
      hardPushbackNorms[joinIndex - 1] = self.calcHardPushbacksNorms(playerCollider, potentials, result, self.snapIntoPlatformOverlap, effPushbacks[joinIndex - 1]);

      const [currPlayerDownsync, thatPlayerInNextFrame] = [currRenderFrame.players[playerId], nextRenderFramePlayers[playerId]];
      let fallStopping = false;
      let possiblyFallStoppedOnAnotherPlayer = false;
      for (const potential of potentials) {
        let [isBarrier, isAnotherPlayer, isBullet] = [true == potential.data.hardPushback, null != potential.data.joinIndex, null != potential.data.offenderJoinIndex];
        // ignore bullets for this step
        if (isBullet) continue;
        // Test if the player collides with the wall/another player
        if (!playerCollider.collides(potential, result)) continue;

        const normAlignmentWithGravity = (result.overlap_x * 0 + result.overlap_y * (-1.0));
        const landedOnGravityPushback = (self.snapIntoPlatformThreshold < normAlignmentWithGravity); // prevents false snapping on the lateral sides
        let pushback = [result.overlap * result.overlap_x, result.overlap * result.overlap_y];
        if (landedOnGravityPushback) {
          // kindly note that one player might land on top of another player, and snapping is also required in such case
          pushback = [(result.overlap - self.snapIntoPlatformOverlap) * result.overlap_x, (result.overlap - self.snapIntoPlatformOverlap) * result.overlap_y];
          thatPlayerInNextFrame.inAir = false;
        }
        for (let hardPushbackNorm of hardPushbackNorms[joinIndex - 1]) {
          // remove pushback component on the directions of "hardPushbackNorms[joinIndex-1]" (by now those hardPushbacks are already accounted in "effPushbacks[joinIndex-1]")
          const projectedMagnitude = pushback[0] * hardPushbackNorm[0] + pushback[1] * hardPushbackNorm[1];
          if (isBarrier
            ||
            (isAnotherPlayer && 0 > projectedMagnitude)
          ) {
            // [WARNING] Pushing by another player is different from pushing by barrier!
            // Otherwise the player couldn't be pushed by another player to opposite dir of a side wall 
            pushback[0] -= projectedMagnitude * hardPushbackNorm[0];
            pushback[1] -= projectedMagnitude * hardPushbackNorm[1];
          }
        }
        if (currPlayerDownsync.inAir && landedOnGravityPushback) {
          fallStopping = true;
          if (isAnotherPlayer) {
            possiblyFallStoppedOnAnotherPlayer = true;
          }
        }

        effPushbacks[joinIndex - 1][0] += pushback[0];
        effPushbacks[joinIndex - 1][1] += pushback[1];
      }

      if (fallStopping) {
        thatPlayerInNextFrame.velX = 0;
        thatPlayerInNextFrame.velY = 0;
        thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Idle1[0];
        thatPlayerInNextFrame.framesToRecover = 0;
        if (possiblyFallStoppedOnAnotherPlayer) {
          console.log(`playerId=${playerId}, joinIndex=${joinIndex} possiblyFallStoppedOnAnotherPlayer with effPushback=${effPushbacks[joinIndex - 1]} at renderFrame.id=${currRenderFrame.id}`);
        }
      }
      if (currPlayerDownsync.inAir) {
        thatPlayerInNextFrame.characterState = window.toInAirConjugate(thatPlayerInNextFrame.characterState);
      }
    }

    // 6. Check bullet-anything collisions
    bulletColliders.forEach((bulletCollider, collisionBulletIndex) => {
      const potentials = bulletCollider.potentials();
      const offender = currRenderFrame.players[bulletCollider.data.offenderPlayerId];
      let shouldRemove = false;
      for (const potential of potentials) {
        if (null != potential.data && potential.data.joinIndex == bulletCollider.data.offenderJoinIndex) continue;
        if (!bulletCollider.collides(potential, result)) continue;
        if (null != potential.data && null != potential.data.joinIndex) {
          const playerId = potential.data.id;
          const joinIndex = potential.data.joinIndex;
          let xfac = 1;
          if (0 > offender.dirX) {
            xfac = -1;
          }
          // Only for straight punch, there's no y-pushback 
          let bulletPushback = [-xfac * bulletCollider.data.pushback, 0];
          // console.log(`playerId=${playerId}, joinIndex=${joinIndex} is supposed to be pushed back by meleeBullet for bulletPushback=${JSON.stringify(bulletPushback)} at renderFrame.id=${currRenderFrame.id}`);
          for (let hardPushbackNorm of hardPushbackNorms[joinIndex - 1]) {
            const projectedMagnitude = bulletPushback[0] * hardPushbackNorm[0] + bulletPushback[1] * hardPushbackNorm[1];
            if (0 > projectedMagnitude) {
              // Otherwise when smashing into a wall the atked player would be pushed into the wall first and only got back in the next renderFrame, not what I want here
              bulletPushback[0] -= (projectedMagnitude * hardPushbackNorm[0]);
              bulletPushback[1] -= (projectedMagnitude * hardPushbackNorm[1]);
              //   console.log(`playerId=${playerId}, joinIndex=${joinIndex} reducing bulletPushback=${JSON.stringify(bulletPushback)} by ${JSON.stringify([projectedMagnitude * hardPushbackNorm[0], projectedMagnitude * hardPushbackNorm[1]])} where hardPushbackNorm=${JSON.stringify(hardPushbackNorm)}, projectedMagnitude=${projectedMagnitude} at renderFrame.id=${currRenderFrame.id}`);
            }
          }
          // console.log(`playerId=${playerId}, joinIndex=${joinIndex} is actually pushed back by meleeBullet for bulletPushback=${JSON.stringify(bulletPushback)} at renderFrame.id=${currRenderFrame.id}`);
          effPushbacks[joinIndex - 1][0] += bulletPushback[0];
          effPushbacks[joinIndex - 1][1] += bulletPushback[1];
          const [atkedPlayerInCurFrame, atkedPlayerInNextFrame] = [currRenderFrame.players[potential.data.id], nextRenderFramePlayers[potential.data.id]];
          atkedPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atked1[0];
          if (atkedPlayerInCurFrame.inAir) {
            atkedPlayerInNextFrame.characterState = window.toInAirConjugate(atkedPlayerInNextFrame.characterState);
          }
          const oldFramesToRecover = atkedPlayerInNextFrame.framesToRecover;
          atkedPlayerInNextFrame.framesToRecover = (oldFramesToRecover > bulletCollider.data.hitStunFrames ? oldFramesToRecover : bulletCollider.data.hitStunFrames); // In case the hit player is already stun, we extend it 
        }
        shouldRemove = true;
      }
      if (shouldRemove) {
        removedBulletsAtCurrFrame.add(collisionBulletIndex);
      }
    });

    // [WARNING] Remove bullets from collisionSys ANYWAY for the convenience of rollback
    for (let k in currRenderFrame.meleeBullets) {
      const meleeBullet = currRenderFrame.meleeBullets[k];
      const collisionBulletIndex = self.collisionBulletIndexPrefix + meleeBullet.battleLocalId;
      if (collisionSysMap.has(collisionBulletIndex)) {
        const bulletCollider = collisionSysMap.get(collisionBulletIndex);
        bulletCollider.remove();
        collisionSysMap.delete(collisionBulletIndex);
      }
      if (removedBulletsAtCurrFrame.has(collisionBulletIndex)) continue;
      nextRenderFrameMeleeBullets.push(meleeBullet);
    }

    // 7. Get players out of stuck barriers if there's any
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
      const playerId = self.playerRichInfoArr[j].id;
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      // Update "virtual grid position"
      const thatPlayerInNextFrame = nextRenderFramePlayers[playerId];
      [thatPlayerInNextFrame.virtualGridX, thatPlayerInNextFrame.virtualGridY] = self.polygonColliderAnchorToVirtualGridPos(playerCollider.x - effPushbacks[joinIndex - 1][0], playerCollider.y - effPushbacks[joinIndex - 1][1], self.playerRichInfoArr[j].colliderRadius, self.playerRichInfoArr[j].colliderRadius);
    }

    return window.pb.protos.RoomDownsyncFrame.create({
      id: currRenderFrame.id + 1,
      players: nextRenderFramePlayers,
      meleeBullets: nextRenderFrameMeleeBullets,
    });
  },

  rollbackAndChase(renderFrameIdSt, renderFrameIdEd, collisionSys, collisionSysMap, isChasing) {
    /*
    This function eventually calculates a "RoomDownsyncFrame" where "RoomDownsyncFrame.id == renderFrameIdEd" if not interruptted.
    */
    const self = this;
    let i = renderFrameIdSt,
      prevLatestRdf = null,
      latestRdf = null;

    do {
      latestRdf = self.recentRenderCache.getByFrameId(i); // typed "RoomDownsyncFrame"; [WARNING] When "true == isChasing", this function can be interruptted by "onRoomDownsyncFrame(rdf)" asynchronously anytime, making this line return "null"!
      if (null == latestRdf) {
        console.warn(`Couldn't find renderFrame for i=${i} to rollback, self.renderFrameId=${self.renderFrameId}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, might've been interruptted by onRoomDownsyncFrame`);
        return [prevLatestRdf, latestRdf];
      }
      const j = self._convertToInputFrameId(i, self.inputDelayFrames);
      const delayedInputFrame = self.getCachedInputFrameDownsyncWithPrediction(j);
      if (null == delayedInputFrame) {
        // Shouldn't happen!
        throw `Failed to get cached delayedInputFrame for i=${i}, j=${j}, renderFrameId=${self.renderFrameId}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastUpsyncInputFrameId=${self.lastUpsyncInputFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, chaserRenderFrameId=${self.chaserRenderFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
      }
      prevLatestRdf = latestRdf;
      latestRdf = self.applyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame, prevLatestRdf, collisionSys, collisionSysMap);
      if (
        self._allConfirmed(delayedInputFrame.confirmedList)
        &&
        latestRdf.id > self.lastAllConfirmedRenderFrameId
      ) {
        // We got a more up-to-date "all-confirmed-render-frame".
        self.lastAllConfirmedRenderFrameId = latestRdf.id;
        if (latestRdf.id > self.chaserRenderFrameId) {
          // it must be true that "chaserRenderFrameId >= lastAllConfirmedRenderFrameId", regardeless of the "isChasing" param 
          self.chaserRenderFrameId = latestRdf.id;
        }
      }

      if (true == isChasing) {
        // Move the cursor "self.chaserRenderFrameId", keep in mind that "self.chaserRenderFrameId" is not monotonic!
        self.chaserRenderFrameId = latestRdf.id;
      }
      self.recentRenderCache.setByFrameId(latestRdf, latestRdf.id);
      ++i;
    } while (i < renderFrameIdEd);

    return [prevLatestRdf, latestRdf];
  },

  _initPlayerRichInfoDict(players) {
    const self = this;
    for (let k in players) {
      const playerId = parseInt(k);
      if (self.playerRichInfoDict.has(playerId)) continue; // Skip already put keys
      const immediatePlayerInfo = players[playerId];
      self.playerRichInfoDict.set(playerId, immediatePlayerInfo);

      const [theNode, theScriptIns] = self.spawnPlayerNode(immediatePlayerInfo.joinIndex, immediatePlayerInfo.virtualGridX, immediatePlayerInfo.virtualGridY, immediatePlayerInfo);

      Object.assign(self.playerRichInfoDict.get(playerId), {
        node: theNode,
        scriptIns: theScriptIns,
      });

      if (self.selfPlayerInfo.id == playerId) {
        self.selfPlayerInfo = Object.assign(self.selfPlayerInfo, immediatePlayerInfo);
        theScriptIns.showArrowTipNode();
      }
    }
    self.playerRichInfoArr = new Array(self.playerRichInfoDict.size);
    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      self.playerRichInfoArr[playerRichInfo.joinIndex - 1] = playerRichInfo;
    });
  },

  _stringifyRecentInputCache(usefullOutput) {
    const self = this;
    if (true == usefullOutput) {
      let s = [];
      for (let i = self.recentInputCache.stFrameId; i < self.recentInputCache.edFrameId; ++i) {
        s.push(JSON.stringify(self.recentInputCache.getByFrameId(i)));
      }

      return s.join('\n');
    }
    return `[stInputFrameId=${self.recentInputCache.stFrameId}, edInputFrameId=${self.recentInputCache.edFrameId})`;
  },

  _stringifyRecentRenderCache(usefullOutput) {
    const self = this;
    if (true == usefullOutput) {
      let s = [];
      for (let i = self.recentRenderCache.stFrameId; i < self.recentRenderCache.edFrameId; ++i) {
        s.push(JSON.stringify(self.recentRenderCache.getByFrameId(i)));
      }

      return s.join('\n');
    }
    return `[stRenderFrameId=${self.recentRenderCache.stFrameId}, edRenderFrameId=${self.recentRenderCache.edFrameId})`;
  },

  worldToVirtualGridPos(x, y) {
    // [WARNING] Introduces loss of precision!
    const self = this;
    // In JavaScript floating numbers suffer from seemingly non-deterministic arithmetics, and even if certain libs solved this issue by approaches such as fixed-point-number, they might not be used in other libs -- e.g. the "collision libs" we're interested in -- thus couldn't kill all pains.
    let virtualGridX = Math.round(x * self.worldToVirtualGridRatio);
    let virtualGridY = Math.round(y * self.worldToVirtualGridRatio);
    return [virtualGridX, virtualGridY];
  },

  virtualGridToWorldPos(vx, vy) {
    // No loss of precision
    const self = this;
    let wx = parseFloat(vx) * self.virtualGridToWorldRatio;
    let wy = parseFloat(vy) * self.virtualGridToWorldRatio;
    return [wx, wy];
  },

  worldToPolygonColliderAnchorPos(wx, wy, halfBoundingW, halfBoundingH) {
    return [wx - halfBoundingW, wy - halfBoundingH];
  },

  polygonColliderAnchorToWorldPos(cx, cy, halfBoundingW, halfBoundingH) {
    return [cx + halfBoundingW, cy + halfBoundingH];
  },

  polygonColliderAnchorToVirtualGridPos(cx, cy, halfBoundingW, halfBoundingH) {
    const self = this;
    const [wx, wy] = self.polygonColliderAnchorToWorldPos(cx, cy, halfBoundingW, halfBoundingH);
    return self.worldToVirtualGridPos(wx, wy)
  },

  virtualGridToPolygonColliderAnchorPos(vx, vy, halfBoundingW, halfBoundingH) {
    const self = this;
    const [wx, wy] = self.virtualGridToWorldPos(vx, vy);
    return self.worldToPolygonColliderAnchorPos(wx, wy, halfBoundingW, halfBoundingH)
  },

  calcHardPushbacksNorms(collider, potentials, result, snapIntoPlatformOverlap, effPushback) {
    let ret = [];
    for (const potential of potentials) {
      if (null == potential.data || !(true == potential.data.hardPushback)) continue;
      if (!collider.collides(potential, result)) continue;
      // ALWAY snap into hardPushbacks!
      // [overlay_x, overlap_y] is the unit vector that points into the platform
      const [pushbackX, pushbackY] = [(result.overlap - snapIntoPlatformOverlap) * result.overlap_x, (result.overlap - snapIntoPlatformOverlap) * result.overlap_y];

      ret.push([result.overlap_x, result.overlap_y]);
      effPushback[0] += pushbackX;
      effPushback[1] += pushbackY;
    }

    return ret;
  },
});
