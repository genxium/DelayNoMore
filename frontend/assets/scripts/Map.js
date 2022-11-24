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

  dumpToRenderCache: function(rdf) {
    const self = this;
    const minToKeepRenderFrameId = self.lastAllConfirmedRenderFrameId;
    while (0 < self.recentRenderCache.cnt && self.recentRenderCache.stFrameId < minToKeepRenderFrameId) {
      self.recentRenderCache.pop();
    }
    const ret = self.recentRenderCache.setByFrameId(rdf, rdf.id);
    return ret;
  },

  dumpToInputCache: function(inputFrameDownsync) {
    const self = this;
    let minToKeepInputFrameId = self._convertToInputFrameId(self.lastAllConfirmedRenderFrameId, self.inputDelayFrames) - self.spAtkLookupFrames; // [WARNING] This could be different from "self.lastAllConfirmedInputFrameId". We'd like to keep the corresponding delayedInputFrame for "self.lastAllConfirmedRenderFrameId" such that a rollback could place "self.chaserRenderFrameId = self.lastAllConfirmedRenderFrameId" for the worst case incorrect prediction.
    if (minToKeepInputFrameId > self.lastAllConfirmedInputFrameId) {
      minToKeepInputFrameId = self.lastAllConfirmedInputFrameId;
    }
    while (0 < self.recentInputCache.cnt && self.recentInputCache.stFrameId < minToKeepInputFrameId) {
      self.recentInputCache.pop();
    }
    const ret = self.recentInputCache.setByFrameId(inputFrameDownsync, inputFrameDownsync.inputFrameId);
    if (-1 < self.lastAllConfirmedInputFrameId && self.recentInputCache.stFrameId > self.lastAllConfirmedInputFrameId) {
      console.error("Invalid input cache dumped! lastAllConfirmedRenderFrameId=", self.lastAllConfirmedRenderFrameId, ", lastAllConfirmedInputFrameId=", self.lastAllConfirmedInputFrameId, ", recentRenderCache=", self._stringifyRecentRenderCache(false), ", recentInputCache=", self._stringifyRecentInputCache(false));
    }
    return ret;
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
      return [null, null];
    }

    const joinIndex = self.selfPlayerInfo.joinIndex;
    const previousInputFrameDownsyncWithPrediction = self.getCachedInputFrameDownsyncWithPrediction(inputFrameId);
    const previousSelfInput = (null == previousInputFrameDownsyncWithPrediction ? null : previousInputFrameDownsyncWithPrediction.inputList[joinIndex - 1]);

    // If "forceConfirmation" is active on backend, we shouldn't override the already downsynced "inputFrameDownsync"s.  
    const existingInputFrame = self.recentInputCache.getByFrameId(inputFrameId);
    if (null != existingInputFrame && self._allConfirmed(existingInputFrame.confirmedList)) {
      return [previousSelfInput, existingInputFrame.inputList[joinIndex - 1]];
    }
    const prefabbedInputList = (null == previousInputFrameDownsyncWithPrediction ? new Array(self.playerRichInfoDict.size).fill(0) : previousInputFrameDownsyncWithPrediction.inputList.slice());
    const currSelfInput = self.ctrl.getEncodedInput();
    prefabbedInputList[(joinIndex - 1)] = currSelfInput;
    const prefabbedInputFrameDownsync = {
      inputFrameId: inputFrameId,
      inputList: prefabbedInputList,
      confirmedList: (1 << (self.selfPlayerInfo.joinIndex - 1))
    };

    self.dumpToInputCache(prefabbedInputFrameDownsync); // A prefabbed inputFrame, would certainly be adding a new inputFrame to the cache, because server only downsyncs "all-confirmed inputFrames" 

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
        console.error("sendInputFrameUpsyncBatch: recentInputCache is NOT having inputFrameId=", i, ": latestLocalInputFrameId=", latestLocalInputFrameId, ", recentInputCache=", self._stringifyRecentInputCache(false));
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
    self.recentInputCache = new RingBuffer((self.renderCacheSize >> 2) + 1);

    self.collisionSys = new collisions.Collisions();

    self.collisionBarrierIndexPrefix = (1 << 16); // For tracking the movements of barriers, though not yet actually used 
    self.collisionBulletIndexPrefix = (1 << 15); // For tracking the movements of bullets 
    self.collisionSysMap = new Map();

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
      Object.assign(self, parsedBattleColliderInfo);

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

        self.selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
        Object.assign(self.selfPlayerInfo, {
          id: self.selfPlayerInfo.playerId
        });

        const reqData = window.pb.protos.WsReq.encode({
          msgId: Date.now(),
          act: window.UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK,
        }).finish();
        window.sendSafely(reqData);
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

  onRoomDownsyncFrame(rdf) {
    // This function is also applicable to "re-joining".
    const self = window.mapIns;
    if (rdf.id < self.lastAllConfirmedRenderFrameId) {
      return window.RING_BUFF_FAILED_TO_SET;
    }

    const dumpRenderCacheRet = self.dumpToRenderCache(rdf);
    if (window.RING_BUFF_FAILED_TO_SET == dumpRenderCacheRet) {
      console.error("Something is wrong while setting the RingBuffer by frameId!");
      return dumpRenderCacheRet;
    }
    if (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START < rdf.id && window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet) {
      /*
      Don't change 
      - lastAllConfirmedRenderFrameId, it's updated only in "rollbackAndChase" (except for when RING_BUFF_NON_CONSECUTIVE_SET) 
      - chaserRenderFrameId, it's updated only in "rollbackAndChase & onInputFrameDownsyncBatch" (except for when RING_BUFF_NON_CONSECUTIVE_SET)
      */
      return dumpRenderCacheRet;
    }

    // The logic below applies to ( || window.RING_BUFF_NON_CONSECUTIVE_SET == dumpRenderCacheRet)
    if (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.id) {
      console.log('On battle started! renderFrameId=', rdf.id);
    } else {
      console.log('On battle resynced! renderFrameId=', rdf.id);
    }

    const players = rdf.players;
    self._initPlayerRichInfoDict(players);

    // Show the top status indicators for IN_BATTLE 
    if (self.playersInfoNode) {
      const playersInfoScriptIns = self.playersInfoNode.getComponent("PlayersInfo");
      for (let i in players) {
        playersInfoScriptIns.updateData(players[i]);
      }
    }

    self.renderFrameId = rdf.id;
    self.lastRenderFrameIdTriggeredAt = performance.now();
    // In this case it must be true that "rdf.id > chaserRenderFrameId >= lastAllConfirmedRenderFrameId".
    self.lastAllConfirmedRenderFrameId = rdf.id;
    self.chaserRenderFrameId = rdf.id;

    if (null != rdf.countdownNanos) {
      self.countdownNanos = rdf.countdownNanos;
    }
    if (null != self.musicEffectManagerScriptIns) {
      self.musicEffectManagerScriptIns.playBGM();
    }
    const canvasNode = self.canvasNode;
    self.ctrl = canvasNode.getComponent("TouchEventsManager");
    self.enableInputControls();
    if (self.countdownToBeginGameNode && self.countdownToBeginGameNode.parent) {
      self.countdownToBeginGameNode.parent.removeChild(self.countdownToBeginGameNode);
    }
    self.transitToState(ALL_MAP_STATES.VISUAL);
    self.battleState = ALL_BATTLE_STATES.IN_BATTLE;
    self.applyRoomDownsyncFrameDynamics(rdf);

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
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE != self.battleState
      && ALL_BATTLE_STATES.IN_SETTLEMENT != self.battleState) {
      return;
    }

    let firstPredictedYetIncorrectInputFrameId = null;
    for (let k in batch) {
      const inputFrameDownsync = batch[k];
      const inputFrameDownsyncId = inputFrameDownsync.inputFrameId;
      if (inputFrameDownsyncId < self.lastAllConfirmedInputFrameId) {
        continue;
      }
      const localInputFrame = self.recentInputCache.getByFrameId(inputFrameDownsyncId);
      if (null != localInputFrame
        &&
        null == firstPredictedYetIncorrectInputFrameId
        &&
        !self.equalInputLists(localInputFrame.inputList, inputFrameDownsync.inputList)
      ) {
        firstPredictedYetIncorrectInputFrameId = inputFrameDownsyncId;
      }
      self.lastAllConfirmedInputFrameId = inputFrameDownsyncId;
      // [WARNING] Take all "inputFrameDownsync" from backend as all-confirmed, it'll be later checked by "rollbackAndChase". 
      inputFrameDownsync.confirmedList = (1 << self.playerRichInfoDict.size) - 1;
      self.dumpToInputCache(inputFrameDownsync);
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
    s.push(`Battle stats: renderFrameId=${self.renderFrameId}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastUpsyncInputFrameId=${self.lastUpsyncInputFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, chaserRenderFrameId=${self.chaserRenderFrameId}`);

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
      if (0 == playerDownsyncInfo.dirX && 0 == playerDownsyncInfo.dirY) {
        playerScriptIns.animComp.node.scaleX = (-1.0);
      }
    }

    const wpos = self.virtualGridToWorldPos(vx, vy);

    newPlayerNode.setPosition(cc.v2(wpos[0], wpos[1]));
    playerScriptIns.mapNode = self.node;
    const cpos = self.virtualGridToPlayerColliderPos(vx, vy, playerDownsyncInfo);
    const d = playerDownsyncInfo.colliderRadius * 2,
      x0 = cpos[0],
      y0 = cpos[1];
    let pts = [[0, 0], [d, 0], [d, d], [0, d]];

    const newPlayerCollider = self.collisionSys.createPolygon(x0, y0, pts);
    const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
    newPlayerCollider.data = playerDownsyncInfo;
    self.collisionSysMap.set(collisionPlayerIndex, newPlayerCollider);

    safelyAddChild(self.node, newPlayerNode);
    setLocalZOrder(newPlayerNode, 5);

    newPlayerNode.active = true;
    playerScriptIns.updateCharacterAnim({
      dx: playerDownsyncInfo.dirX,
      dy: playerDownsyncInfo.dirY,
    }, playerDownsyncInfo, true);

    return [newPlayerNode, playerScriptIns];
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
        const rdf = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.collisionSys, self.collisionSysMap, false);
        /*
        const nonTrivialChaseEnded = (prevChaserRenderFrameId < nextChaserRenderFrameId && nextChaserRenderFrameId == self.renderFrameId); 
        if (nonTrivialChaseEnded) {
            console.debug("Non-trivial chase ended, prevChaserRenderFrameId=" + prevChaserRenderFrameId + ", nextChaserRenderFrameId=" + nextChaserRenderFrameId);
        }  
        */
        self.applyRoomDownsyncFrameDynamics(rdf);
        let t3 = performance.now();
      } catch (err) {
        console.error("Error during Map.update", err);
      } finally {
        // Update countdown
        if (null != self.countdownNanos) {
          self.countdownNanos = self.battleDurationNanos - self.renderFrameId * self.rollbackEstimatedDtNanos;
          if (self.countdownNanos <= 0) {
            self.onBattleStopped(self.playerRichInfoDict);
            return;
          }

          const countdownSeconds = parseInt(self.countdownNanos / 1000000000);
          if (isNaN(countdownSeconds)) {
            console.warn(`countdownSeconds is NaN for countdownNanos == ${self.countdownNanos}.`);
          }
          self.countdownLabel.string = countdownSeconds;
        }
        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
        self.lastRenderFrameIdTriggeredAt = performance.now();
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
    if (null != rdf) {
      self._initPlayerRichInfoDict(rdf.players);
    }
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

  applyRoomDownsyncFrameDynamics(rdf) {
    const self = this;
    const delayedInputFrameForPrevRenderFrame = self.getCachedInputFrameDownsyncWithPrediction(self._convertToInputFrameId(rdf.id - 1, self.inputDelayFrames));

    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      const immediatePlayerInfo = rdf.players[playerId];
      const wpos = self.virtualGridToWorldPos(immediatePlayerInfo.virtualGridX, immediatePlayerInfo.virtualGridY);
      const dx = (wpos[0] - playerRichInfo.node.x);
      const dy = (wpos[1] - playerRichInfo.node.y);
      //const justJiggling = (self.jigglingEps1D >= Math.abs(dx) && self.jigglingEps1D >= Math.abs(dy));
      playerRichInfo.node.setPosition(wpos[0], wpos[1]);
      // TODO: check "rdf.players[playerId].characterState" instead, might have to play Atk/Atked anim!
      if (null != delayedInputFrameForPrevRenderFrame) {
        const decodedInput = self.ctrl.decodeInput(delayedInputFrameForPrevRenderFrame.inputList[playerRichInfo.joinIndex - 1]);
        playerRichInfo.scriptIns.updateCharacterAnim(decodedInput, immediatePlayerInfo, false);
      } else {
        playerRichInfo.scriptIns.updateCharacterAnim(null, immediatePlayerInfo, false);
      }
      playerRichInfo.scriptIns.updateSpeed(immediatePlayerInfo.speed);
    });
  },

  getCachedInputFrameDownsyncWithPrediction(inputFrameId) {
    const self = this;
    let inputFrameDownsync = self.recentInputCache.getByFrameId(inputFrameId);
    if (null != inputFrameDownsync && -1 != self.lastAllConfirmedInputFrameId && inputFrameId > self.lastAllConfirmedInputFrameId) {
      const lastAllConfirmedInputFrame = self.recentInputCache.getByFrameId(self.lastAllConfirmedInputFrameId);
      for (let i = 0; i < inputFrameDownsync.inputList.length; ++i) {
        if (i == self.selfPlayerInfo.joinIndex - 1) continue;
        inputFrameDownsync.inputList[i] = lastAllConfirmedInputFrame.inputList[i];
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
        characterState: currPlayerDownsync.characterState,
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

    const toRet = {
      id: currRenderFrame.id + 1,
      players: nextRenderFramePlayers,
      meleeBullets: []
    };

    const bulletPushbacks = new Array(self.playerRichInfoArr.length); // Guaranteed determinism regardless of traversal order
    const effPushbacks = new Array(self.playerRichInfoArr.length); // Guaranteed determinism regardless of traversal order

    // Reset playerCollider position from the "virtual grid position"
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
      bulletPushbacks[joinIndex - 1] = [0.0, 0.0];
      effPushbacks[joinIndex - 1] = [0.0, 0.0];
      const playerRichInfo = self.playerRichInfoArr[j];
      const playerId = playerRichInfo.id;
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      const currPlayerDownsync = currRenderFrame.players[playerId];

      const newVx = currPlayerDownsync.virtualGridX;
      const newVy = currPlayerDownsync.virtualGridY;
      const newCpos = self.virtualGridToPlayerColliderPos(newVx, newVy, self.playerRichInfoArr[joinIndex - 1]);
      playerCollider.x = newCpos[0];
      playerCollider.y = newCpos[1];
    }

    // Check bullet-anything collisions first, because the pushbacks caused by bullets might later be reverted by player-barrier collision 
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

        let xfac = 1,
          yfac = 0; // By now, straight Punch offset doesn't respect "y-axis"
        if (0 > offender.dirX) {
          xfac = -1;
        }
        const x0 = offenderCollider.x + xfac * meleeBullet.hitboxOffset,
          y0 = offenderCollider.y + yfac * meleeBullet.hitboxOffset;
        const pts = [[0, 0], [xfac * meleeBullet.hitboxSize.x, 0], [xfac * meleeBullet.hitboxSize.x, meleeBullet.hitboxSize.y], [0, meleeBullet.hitboxSize.y]];
        const newBulletCollider = collisionSys.createPolygon(x0, y0, pts);
        newBulletCollider.data = meleeBullet;
        collisionSysMap.set(collisionBulletIndex, newBulletCollider);
        bulletColliders.set(collisionBulletIndex, newBulletCollider);
      // console.log(`A meleeBullet is added to collisionSys at renderFrame.id=${currRenderFrame.id} as start-up frames ended and active frame is not yet ended: ${JSON.stringify(meleeBullet)}`);
      }
    }

    collisionSys.update();
    const result1 = collisionSys.createResult(); // Can I reuse a "self.collisionSysResult" object throughout the whole battle?

    bulletColliders.forEach((bulletCollider, collisionBulletIndex) => {
      const potentials = bulletCollider.potentials();
      const offender = currRenderFrame.players[bulletCollider.data.offenderPlayerId];
      let shouldRemove = false;
      for (const potential of potentials) {
        if (null != potential.data && potential.data.joinIndex == bulletCollider.data.offenderJoinIndex) continue;
        if (!bulletCollider.collides(potential, result1)) continue;
        if (null != potential.data && null !== potential.data.joinIndex) {
          const joinIndex = potential.data.joinIndex;
          let xfac = 1;
          if (0 > offender.dirX) {
            xfac = -1;
          }
          bulletPushbacks[joinIndex - 1][0] += xfac * bulletCollider.data.pushback; // Only for straight punch, there's no y-pushback
          bulletPushbacks[joinIndex - 1][1] += 0;
          const thatAckedPlayerInNextFrame = nextRenderFramePlayers[potential.data.id];
          thatAckedPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atked1[0];
          const oldFramesToRecover = thatAckedPlayerInNextFrame.framesToRecover;
          thatAckedPlayerInNextFrame.framesToRecover = (oldFramesToRecover > bulletCollider.data.hitStunFrames ? oldFramesToRecover : bulletCollider.data.hitStunFrames); // In case the hit player is already stun, we extend it 
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
      toRet.meleeBullets.push(meleeBullet);
    }

    // Process player inputs
    if (null != delayedInputFrame) {
      const delayedInputFrameForPrevRenderFrame = self.getCachedInputFrameDownsyncWithPrediction(self._convertToInputFrameId(currRenderFrame.id - 1, self.inputDelayFrames));
      const inputList = delayedInputFrame.inputList;
      for (let j in self.playerRichInfoArr) {
        const joinIndex = parseInt(j) + 1;
        effPushbacks[joinIndex - 1] = [0.0, 0.0];
        const playerRichInfo = self.playerRichInfoArr[j];
        const playerId = playerRichInfo.id;
        const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
        const playerCollider = collisionSysMap.get(collisionPlayerIndex);
        const currPlayerDownsync = currRenderFrame.players[playerId];
        const thatPlayerInNextFrame = nextRenderFramePlayers[playerId];
        if (0 < thatPlayerInNextFrame.framesToRecover) {
          // No need to process inputs for this player, but there might be bullet pushbacks on this player  
          playerCollider.x += bulletPushbacks[joinIndex - 1][0];
          playerCollider.y += bulletPushbacks[joinIndex - 1][1];
          if (0 != bulletPushbacks[joinIndex - 1][0] || 0 != bulletPushbacks[joinIndex - 1][1]) {
            console.log(`playerId=${playerId}, joinIndex=${joinIndex} is pushbacked back by ${bulletPushbacks[joinIndex - 1]} by bullet impacts, now its framesToRecover is ${currPlayerDownsync.framesToRecover}`);
          }
          continue;
        }

        const decodedInput = self.ctrl.decodeInput(inputList[joinIndex - 1]);

        const prevDecodedInput = (null == delayedInputFrameForPrevRenderFrame ? null : self.ctrl.decodeInput(delayedInputFrameForPrevRenderFrame.inputList[joinIndex - 1]));
        const prevBtnALevel = (null == prevDecodedInput ? 0 : prevDecodedInput.btnALevel);

        if (1 == decodedInput.btnALevel && 0 == prevBtnALevel) {
          // console.log(`playerId=${playerId} triggered a rising-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
          if (self.bulletTriggerEnabled) {
            thatPlayerInNextFrame.framesToRecover = window.PunchAtkConfig.recoveryFrames;
            const punch = window.pb.protos.MeleeBullet.create(window.PunchAtkConfig);
            punch.battleLocalId = self.bulletBattleLocalIdCounter++;
            punch.offenderJoinIndex = joinIndex;
            punch.offenderPlayerId = playerId;
            punch.originatedRenderFrameId = currRenderFrame.id;
            toRet.meleeBullets.push(punch);
            console.log(`A rising-edge of meleeBullet is created at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}: ${self._stringifyRecentInputCache(true)}`);

            thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atk1[0];
          }
        } else if (0 == decodedInput.btnALevel && 1 == prevBtnALevel) {
          // console.log(`playerId=${playerId} triggered a falling-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
        } else {
          // No bullet trigger, process movement inputs
          if (0 != decodedInput.dx || 0 != decodedInput.dy) {
            // Update directions and thus would eventually update moving animation accordingly
            thatPlayerInNextFrame.dirX = decodedInput.dx;
            thatPlayerInNextFrame.dirY = decodedInput.dy;
            thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Walking[0];
          } else {
            thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Idle1[0];
          }
          const movement = self.virtualGridToWorldPos(decodedInput.dx + currPlayerDownsync.speed * decodedInput.dx, decodedInput.dy + currPlayerDownsync.speed * decodedInput.dy);
          playerCollider.x += movement[0];
          playerCollider.y += movement[1];
        }
      }

      collisionSys.update(); // by now all "bulletCollider"s are removed
      const result2 = collisionSys.createResult(); // Can I reuse a "self.collisionSysResult" object throughout the whole battle?

      for (let j in self.playerRichInfoArr) {
        const joinIndex = parseInt(j) + 1;
        const playerId = self.playerRichInfoArr[j].id;
        const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
        const playerCollider = collisionSysMap.get(collisionPlayerIndex);
        const potentials = playerCollider.potentials();
        for (const potential of potentials) {
          // Test if the player collides with the wall
          if (!playerCollider.collides(potential, result2)) continue;
          // Push the player out of the wall
          effPushbacks[joinIndex - 1][0] += result2.overlap * result2.overlap_x;
          effPushbacks[joinIndex - 1][1] += result2.overlap * result2.overlap_y;
        }
      }

      for (let j in self.playerRichInfoArr) {
        const joinIndex = parseInt(j) + 1;
        const playerId = self.playerRichInfoArr[j].id;
        const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
        const playerCollider = collisionSysMap.get(collisionPlayerIndex);
        const newVpos = self.playerColliderAnchorToVirtualGridPos(playerCollider.x - effPushbacks[joinIndex - 1][0], playerCollider.y - effPushbacks[joinIndex - 1][1], self.playerRichInfoArr[j]);
        const thatPlayerInNextFrame = nextRenderFramePlayers[playerId];
        thatPlayerInNextFrame.virtualGridX = newVpos[0];
        thatPlayerInNextFrame.virtualGridY = newVpos[1];
      }

    }

    return toRet;
  },

  rollbackAndChase(renderFrameIdSt, renderFrameIdEd, collisionSys, collisionSysMap, isChasing) {
    /*
    This function eventually calculates a "RoomDownsyncFrame" where "RoomDownsyncFrame.id == renderFrameIdEd" if not interruptted.
    */
    const self = this;
    let latestRdf = self.recentRenderCache.getByFrameId(renderFrameIdSt); // typed "RoomDownsyncFrame"
    if (null == latestRdf) {
      console.error(`Couldn't find renderFrameId=${renderFrameIdSt}, to rollback, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`);
      return latestRdf;
    }

    if (renderFrameIdSt >= renderFrameIdEd) {
      return latestRdf;
    }

    for (let i = renderFrameIdSt; i < renderFrameIdEd; ++i) {
      const currRenderFrame = self.recentRenderCache.getByFrameId(i); // typed "RoomDownsyncFrame"; [WARNING] When "true == isChasing", this function can be interruptted by "onRoomDownsyncFrame(rdf)" asynchronously anytime, making this line return "null"!
      if (null == currRenderFrame) {
        console.warn(`Couldn't find renderFrame for i=${i} to rollback, self.renderFrameId=${self.renderFrameId}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, might've been interruptted by onRoomDownsyncFrame`);
        return latestRdf;
      }
      const j = self._convertToInputFrameId(i, self.inputDelayFrames);
      const delayedInputFrame = self.getCachedInputFrameDownsyncWithPrediction(j);
      if (null == delayedInputFrame) {
        console.warn(`Failed to get cached delayedInputFrame for i=${i}, j=${j}, self.renderFrameId=${self.renderFrameId}, lastAllConfirmedRenderFrameId=${self.lastAllConfirmedRenderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}`);
        return latestRdf;
      }

      latestRdf = self.applyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame, currRenderFrame, collisionSys, collisionSysMap);
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
      self.dumpToRenderCache(latestRdf);
    }

    return latestRdf;
  },

  _initPlayerRichInfoDict(players) {
    const self = this;
    for (let k in players) {
      const playerId = parseInt(k);
      if (self.playerRichInfoDict.has(playerId)) continue; // Skip already put keys
      const immediatePlayerInfo = players[playerId];
      self.playerRichInfoDict.set(playerId, immediatePlayerInfo);

      const nodeAndScriptIns = self.spawnPlayerNode(immediatePlayerInfo.joinIndex, immediatePlayerInfo.virtualGridX, immediatePlayerInfo.virtualGridY, self.playerRichInfoDict.get(playerId));

      Object.assign(self.playerRichInfoDict.get(playerId), {
        node: nodeAndScriptIns[0],
        scriptIns: nodeAndScriptIns[1]
      });

      if (self.selfPlayerInfo.id == playerId) {
        self.selfPlayerInfo = Object.assign(self.selfPlayerInfo, immediatePlayerInfo);
        nodeAndScriptIns[1].showArrowTipNode();
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

  playerWorldToCollisionPos(wx, wy, playerRichInfo) {
    return [wx - playerRichInfo.colliderRadius, wy - playerRichInfo.colliderRadius];
  },

  playerColliderAnchorToWorldPos(cx, cy, playerRichInfo) {
    return [cx + playerRichInfo.colliderRadius, cy + playerRichInfo.colliderRadius];
  },

  playerColliderAnchorToVirtualGridPos(cx, cy, playerRichInfo) {
    const self = this;
    const wpos = self.playerColliderAnchorToWorldPos(cx, cy, playerRichInfo);
    return self.worldToVirtualGridPos(wpos[0], wpos[1])
  },

  virtualGridToPlayerColliderPos(vx, vy, playerRichInfo) {
    const self = this;
    const wpos = self.virtualGridToWorldPos(vx, vy);
    return self.playerWorldToCollisionPos(wpos[0], wpos[1], playerRichInfo)
  },
});
