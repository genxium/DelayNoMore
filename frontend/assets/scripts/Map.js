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
  PLAYER_ADDED_AND_ACKED: -98,
  PLAYER_READDED_AND_ACKED: -97,

  BATTLE_READY_TO_START: -1,
  BATTLE_START: 0,
};

cc.Class({
  extends: cc.Component,

  properties: {
    canvasNode: {
      type: cc.Node,
      default: null,
    },
    tiledAnimPrefab: {
      type: cc.Prefab,
      default: null,
    },
    player1Prefab: {
      type: cc.Prefab,
      default: null,
    },
    player2Prefab: {
      type: cc.Prefab,
      default: null,
    },
    treasurePrefab: {
      type: cc.Prefab,
      default: null,
    },
    trapPrefab: {
      type: cc.Prefab,
      default: null,
    },
    speedShoePrefab: {
      type: cc.Prefab,
      default: null,
    },
    polygonBoundaryBarrierPrefab: {
      type: cc.Prefab,
      default: null,
    },
    keyboardInputControllerNode: {
      type: cc.Node,
      default: null
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
    trapBulletPrefab: {
      type: cc.Prefab,
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
    guardTowerPrefab: {
      type: cc.Prefab,
      default: null
    },
    forceBigEndianFloatingNumDecoding: {
      default: false,
    },
    backgroundMapTiledIns: {
      type: cc.TiledMap,
      default: null
    },
    rollbackEstimatedDt: {
      type: cc.Float,
      default: 1.0/60 
    },
    maxChasingRenderFramesPerUpdate: {
      type: cc.Integer,
      default: 10
    },
  },
    
  _inputFrameIdDebuggable(inputFrameId) {
    return (0 == inputFrameId%10);
  },

  _dumpToRenderCache: function(roomDownsyncFrame) {
    const self = this;
    const minToKeepRenderFrameId = self.lastAllConfirmedRenderFrameId; 
    while (0 < self.recentRenderCache.cnt && self.recentRenderCache.stFrameId < minToKeepRenderFrameId) {
      self.recentRenderCache.pop();
    }
    if (self.recentRenderCache.stFrameId < minToKeepRenderFrameId) {
      console.warn("Weird dumping of RENDER frame: self.renderFrame=", self.renderFrame, ", self.recentInputCache=", self._stringifyRecentInputCache(false), ", self.recentRenderCache=", self._stringifyRecentRenderCache(false), ", self.lastAllConfirmedRenderFrameId=", self.lastAllConfirmedRenderFrameId, ", self.lastAllConfirmedInputFrameId=", self.lastAllConfirmedInputFrameId);
    }
    const existing = self.recentRenderCache.getByFrameId(roomDownsyncFrame.id); 
    if (null != existing) {
      existing.players = roomDownsyncFrame.players;   
      existing.sentAt = roomDownsyncFrame.sentAt;   
      existing.countdownNanos = roomDownsyncFrame.countdownNanos;   
      existing.treasures = roomDownsyncFrame.treasures;   
      existing.bullets = roomDownsyncFrame.bullets;   
      existing.speedShoes = roomDownsyncFrame.speedShoes;   
      existing.guardTowers = roomDownsyncFrame.guardTowers;   
      existing.playerMetas = roomDownsyncFrame.playerMetas;   
    } else {
      self.recentRenderCache.put(roomDownsyncFrame);
    }
  },

  _dumpToInputCache: function(inputFrameDownsync) {
    const self = this;
    let minToKeepInputFrameId = self._convertToInputFrameId(self.lastAllConfirmedRenderFrameId, self.inputDelayFrames); // [WARNING] This could be different from "self.lastAllConfirmedInputFrameId". We'd like to keep the corresponding inputFrame for "self.lastAllConfirmedRenderFrameId" such that a rollback could place "self.chaserRenderFrameId = self.lastAllConfirmedRenderFrameId" for the worst case incorrect prediction.
    if (minToKeepInputFrameId > self.lastAllConfirmedInputFrameId) minToKeepInputFrameId = self.lastAllConfirmedInputFrameId;
    while (0 < self.recentInputCache.cnt && self.recentInputCache.stFrameId < minToKeepInputFrameId) {
      self.recentInputCache.pop();
    }
    if (self.recentInputCache.stFrameId < minToKeepInputFrameId) {
      console.warn("Weird dumping of INPUT frame: self.renderFrame=", self.renderFrame, ", self.recentInputCache=", self._stringifyRecentInputCache(false), ", self.recentRenderCache=", self._stringifyRecentRenderCache(false), ", self.lastAllConfirmedRenderFrameId=", self.lastAllConfirmedRenderFrameId, ", self.lastAllConfirmedInputFrameId=", self.lastAllConfirmedInputFrameId);
    }
    const existing = self.recentInputCache.getByFrameId(inputFrameDownsync.inputFrameId); 
    if (null != existing) {
      existing.inputList = inputFrameDownsync.inputList;   
      existing.confirmedList = inputFrameDownsync.confirmedList;   
    } else {
      self.recentInputCache.put(inputFrameDownsync);
    }
  },

  _convertToInputFrameId(renderFrameId, inputDelayFrames) {
    if (renderFrameId < inputDelayFrames) return 0;
    return ((renderFrameId - inputDelayFrames) >> this.inputScaleFrames);
  },

  _convertToFirstUsedRenderFrameId(inputFrameId, inputDelayFrames) {
    return ((inputFrameId << this.inputScaleFrames) + inputDelayFrames);
  },

  shouldGenerateInputFrameUpsync(renderFrameId) {
    return ((renderFrameId & ((1 << this.inputScaleFrames)-1)) == 0);
  },

  _allConfirmed(confirmedList) {
    return (confirmedList+1) == (1 << this.playerRichInfoDict.size);
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
    const discreteDir = self.ctrl.getDiscretizedDirection();
    const previousInputFrameDownsyncWithPrediction = self.getCachedInputFrameDownsyncWithPrediction(inputFrameId); 
    const prefabbedInputList = (null == previousInputFrameDownsyncWithPrediction ? new Array(self.playerRichInfoDict.size).fill(0) : previousInputFrameDownsyncWithPrediction.inputList.slice());  
    prefabbedInputList[(joinIndex-1)] = discreteDir.encodedIdx;
    const prefabbedInputFrameDownsync =  {
      inputFrameId: inputFrameId,
      inputList: prefabbedInputList, 
      confirmedList: (1 << (self.selfPlayerInfo.joinIndex-1))
    };

    self._dumpToInputCache(prefabbedInputFrameDownsync); // A prefabbed inputFrame, would certainly be adding a new inputFrame to the cache, because server only downsyncs "all-confirmed inputFrames" 

    const previousSelfInput = (null == previousInputFrameDownsyncWithPrediction ? null : previousInputFrameDownsyncWithPrediction.inputList[joinIndex-1]); 
    return [previousSelfInput, discreteDir.encodedIdx];
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

  sendInputFrameUpsyncBatch(inputFrameId) {
    // [WARNING] Why not just send the latest input? Because different player would have a different "inputFrameId" of changing its last input, and that could make the server not recognizing any "all-confirmed inputFrame"!
    const self = this;
    let inputFrameUpsyncBatch = [];
    for (let i = self.lastUpsyncInputFrameId+1; i <= inputFrameId; ++i) {
      const inputFrameDownsync = self.recentInputCache.getByFrameId(i);
      if (null == inputFrameDownsync) {
        console.warn("sendInputFrameUpsyncBatch: recentInputCache is NOT having inputFrameId=", i, "; recentInputCache=", self._stringifyRecentInputCache(false));
      } else {
        const inputFrameUpsync = {
          inputFrameId: i,
          encodedDir: inputFrameDownsync.inputList[self.selfPlayerInfo.joinIndex-1],
        };
        inputFrameUpsyncBatch.push(inputFrameUpsync);
      }
    } 
    const reqData = window.WsReq.encode({
      msgId: Date.now(),
      playerId: self.selfPlayerInfo.id,
      act: window.UPSYNC_MSG_ACT_PLAYER_CMD,
      joinIndex: self.selfPlayerInfo.joinIndex,
      ackingFrameId: self.lastAllConfirmedRenderFrameId,
      ackingInputFrameId: self.lastAllConfirmedInputFrameId,
      inputFrameUpsyncBatch: inputFrameUpsyncBatch,
    }).finish();
    window.sendSafely(reqData);
    self.lastUpsyncInputFrameId = inputFrameId;
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
    if (null != window.handleRoomDownsyncFrame) {
      window.handleRoomDownsyncFrame = null;
    }
    if (null != window.handleInputFrameDownsyncBatch) {
      window.handleInputFrameDownsyncBatch = null;
    }
    if (null != window.handleBattleColliderInfo) {
      window.handleBattleColliderInfo = null;
    }
    if (null != window.handleClientSessionCloseOrError) {
      window.handleClientSessionCloseOrError = null;
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
    self.countdownLabel.string = "";
    self.countdownNanos = null;

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
    self.lastAllConfirmedRenderFrameId = -1;
    self.lastAllConfirmedInputFrameId = -1;
    self.chaserRenderFrameId = -1; // at any moment, "lastAllConfirmedRenderFrameId <= chaserRenderFrameId <= renderFrameId", but "chaserRenderFrameId" would fluctuate according to "handleInputFrameDownsyncBatch"

    self.inputDelayFrames = 8;
    self.inputScaleFrames = 2;
    self.lastUpsyncInputFrameId = -1;
    self.inputFrameUpsyncDelayTolerance = 2;

    self.recentRenderCache = new RingBuffer(1024);

    self.selfPlayerInfo = null; // This field is kept for distinguishing "self" and "others".
    self.recentInputCache = new RingBuffer(1024); 

    self.latestCollisionSys = new collisions.Collisions();
    self.chaserCollisionSys = new collisions.Collisions();

    self.collisionBarrierIndexPrefix = (1 << 16); // For tracking the movements of barriers, though not yet actually used 
    self.latestCollisionSysMap = new Map();
    self.chaserCollisionSysMap = new Map();
    
    self.transitToState(ALL_MAP_STATES.VISUAL);

    self.battleState = ALL_BATTLE_STATES.WAITING;

    if (self.findingPlayerNode) {
      const findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
      findingPlayerScriptIns.init();
    }
    safelyAddChild(self.widgetsAboveAllNode, self.playersInfoNode);
    safelyAddChild(self.widgetsAboveAllNode, self.findingPlayerNode);
  },

  onLoad() {
    const self = this;
    window.mapIns = self;
    window.forceBigEndianFloatingNumDecoding = self.forceBigEndianFloatingNumDecoding;

    console.warn("+++++++ Map onLoad()");
    window.handleClientSessionCloseOrError = function() {
      console.warn('+++++++ Common handleClientSessionCloseOrError()');

      if (ALL_BATTLE_STATES.IN_SETTLEMENT == self.battleState) { //如果是游戏时间结束引起的断连
        console.log("游戏结束引起的断连, 不需要回到登录页面");
      } else {
        console.warn("意外断连，即将回到登录页面");
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
    resultPanelScriptIns.onCloseDelegate = () => {

    };

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

    self.clientUpsyncFps = 60;

    window.handleBattleColliderInfo = function(parsedBattleColliderInfo) {
      self.battleColliderInfo = parsedBattleColliderInfo; 
      const tiledMapIns = self.node.getComponent(cc.TiledMap);

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
        self.node.setContentSize(newMapSize.width*newTileSize.width, newMapSize.height*newTileSize.height);
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
          const x0 = boundaryObj[0].x, y0 = boundaryObj[0].y; 
          let pts = [];
          // TODO: Simplify this redundant coordinate conversion within "extractBoundaryObjects", but since this routine is only called once per battle, not urgent.
          for (let i = 0; i < boundaryObj.length; ++i) {
            pts.push([boundaryObj[i].x-x0, boundaryObj[i].y-y0]);
          } 
          const newBarrierLatest = self.latestCollisionSys.createPolygon(x0, y0, pts);
          const newBarrierChaser = self.chaserCollisionSys.createPolygon(x0, y0, pts);
          ++barrierIdCounter;
          const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter); 
          self.latestCollisionSysMap.set(collisionBarrierIndex, newBarrierLatest); 
          self.chaserCollisionSysMap.set(collisionBarrierIndex, newBarrierChaser); 
        }

        self.selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
        Object.assign(self.selfPlayerInfo, {
          id: self.selfPlayerInfo.playerId
        });

        const fullPathOfBackgroundMapTmxFile = cc.js.formatStr("map/%s/BackgroundMap/map", parsedBattleColliderInfo.stageName);
        cc.loader.loadRes(fullPathOfBackgroundMapTmxFile, cc.TiledMapAsset, (err, backgroundMapTmxAsset) => {
          if (null != err) {
            console.error(err);
            return;
          }

          self.backgroundMapTiledIns.tmxAsset = null;
          self.backgroundMapTiledIns.node.removeAllChildren();
          self.backgroundMapTiledIns.tmxAsset = backgroundMapTmxAsset;
          const newBackgroundMapSize = self.backgroundMapTiledIns.getMapSize();
          const newBackgroundMapTileSize = self.backgroundMapTiledIns.getTileSize();
          self.backgroundMapTiledIns.node.setContentSize(newBackgroundMapSize.width*newBackgroundMapTileSize.width, newBackgroundMapSize.height*newBackgroundMapTileSize.height);
          self.backgroundMapTiledIns.node.setPosition(cc.v2(0, 0));

          const reqData = window.WsReq.encode({
            msgId: Date.now(),
            act: window.UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK,
          }).finish();
          window.sendSafely(reqData);
        });
      });
    };

    self.initAfterWSConnected = () => {
      const self = window.mapIns;
      self.hideGameRuleNode();
      self.transitToState(ALL_MAP_STATES.WAITING);
      self._inputControlEnabled = false;
    
      let findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
      window.handleRoomDownsyncFrame = function(rdf) {
        if (ALL_BATTLE_STATES.WAITING != self.battleState
          && ALL_BATTLE_STATES.IN_BATTLE != self.battleState
          && ALL_BATTLE_STATES.IN_SETTLEMENT != self.battleState) {
          return;
        }

        const frameId = rdf.id;
        // Right upon establishment of the "PersistentSessionClient", we should receive an initial signal "BattleColliderInfo" earlier than any "RoomDownsyncFrame" containing "PlayerMeta" data. 
        const refFrameId = rdf.refFrameId;
        switch (refFrameId) {
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.PLAYER_ADDED_AND_ACKED:
          // Update the "finding player" GUI and show it if not previously present
          if (!self.findingPlayerNode.parent) {
            self.showPopupInCanvas(self.findingPlayerNode);
          }
          findingPlayerScriptIns.updatePlayersInfo(rdf.playerMetas);
          return;
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_READY_TO_START:
          self.onBattleReadyToStart(rdf.playerMetas, false);
          return;
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START:
          self.onBattleStartedOrResynced(rdf); 
          return; 
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.PLAYER_READDED_AND_ACKED:
          self.onBattleReadyToStart(rdf.playerMetas, true);
          self.onBattleStartedOrResynced(rdf);
          return;
        }

        // TODO: Inject a NetworkDoctor as introduced in https://app.yinxiang.com/shard/s61/nl/13267014/5c575124-01db-419b-9c02-ec81f78c6ddc/.
      }; 

      window.handleInputFrameDownsyncBatch = function(batch) {
        if (ALL_BATTLE_STATES.IN_BATTLE != self.battleState
          && ALL_BATTLE_STATES.IN_SETTLEMENT != self.battleState) {
          return;
        }

        // console.log("Received inputFrameDownsyncBatch=", batch, ", now correspondingLastLocalInputFrame=", self.recentInputCache.getByFrameId(batch[batch.length-1].inputFrameId)); 
        let firstPredictedYetIncorrectInputFrameId = null;
        let firstPredictedYetIncorrectInputFrameJoinIndex = null;
        for (let k in batch) {
          const inputFrameDownsync = batch[k]; 
          const inputFrameDownsyncId = inputFrameDownsync.inputFrameId;
          const localInputFrame = self.recentInputCache.getByFrameId(inputFrameDownsyncId); 
          if (null == localInputFrame) {
            console.warn("handleInputFrameDownsyncBatch: recentInputCache is NOT having inputFrameDownsyncId=", inputFrameDownsyncId, "; now recentInputCache=", self._stringifyRecentInputCache(false));
          } else {
            if (null == firstPredictedYetIncorrectInputFrameId) {
              for (let i in localInputFrame.inputList) {
                if (localInputFrame.inputList[i] != inputFrameDownsync.inputList[i]) {
                  firstPredictedYetIncorrectInputFrameId = inputFrameDownsyncId;
                  firstPredictedYetIncorrectInputFrameJoinIndex = (parseInt(i)+1);
                  break;
                } 
              } 
            }
          }
          self.lastAllConfirmedInputFrameId = inputFrameDownsyncId;  
          self._dumpToInputCache(inputFrameDownsync);
        }

        if (null != firstPredictedYetIncorrectInputFrameId) {
          const inputFrameId1 = firstPredictedYetIncorrectInputFrameId;
          const renderFrameId1 = self._convertToFirstUsedRenderFrameId(inputFrameId1, self.inputDelayFrames); // a.k.a. "firstRenderFrameIdUsingIncorrectInputFrameId"
          if (renderFrameId1 < self.renderFrameId) {
            /*
            A typical case is as follows.
            --------------------------------------------------------
            [self.lastAllConfirmedRenderFrameId]       :              22

            <renderFrameId1>                           :              36


            <self.chaserRenderFrameId>                 :              62

            [self.renderFrameId]                       :              64
            --------------------------------------------------------
            */
            if (renderFrameId1 < self.chaserRenderFrameId) {
              // The actual rollback-and-chase would later be executed in update(dt). 
              console.warn("Mismatched input detected, resetting chaserRenderFrameId: inputFrameId1:", inputFrameId1, ", renderFrameId1:", renderFrameId1, ", chaserRenderFrameId before reset: ", self.chaserRenderFrameId);
              self.chaserRenderFrameId = renderFrameId1; 
            } else {
              // Deliberately left blank, chasing is ongoing.
            }
          } else {
            // No need to rollback when "renderFrameId1 == self.renderFrameId", because the "corresponding delayedInputFrame for renderFrameId2" is NOT YET EXECUTED BY NOW, it just went through "++self.renderFrameId" in "update(dt)" and javascript-runtime is mostly single-threaded in our programmable range. 
          }
        }
      };
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
      window.initPersistentSessionClient(self.initAfterWSConnected, expectedRoomId);
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

  onBattleStartedOrResynced(rdf) {
    // This function is also applicable to "re-joining".
    console.log('On battle started or resynced! renderFrameId=', rdf.id);
    const self = window.mapIns;
    self.renderFrameId = rdf.id;
    self.lastAllConfirmedRenderFrameId = rdf.id;  
    self.chaserRenderFrameId = rdf.id;

    const players = rdf.players;
    const playerMetas = rdf.playerMetas;
    self._initPlayerRichInfoDict(players, playerMetas);

    // Show the top status indicators for IN_BATTLE 
    const playersInfoScriptIns = self.playersInfoNode.getComponent("PlayersInfo");
    for (let i in playerMetas) {
      const playerMeta = playerMetas[i];
      playersInfoScriptIns.updateData(playerMeta);
    }

    if (null != rdf.countdownNanos) {
      self.countdownNanos = rdf.countdownNanos;
    }
    if (null != self.musicEffectManagerScriptIns) {
      self.musicEffectManagerScriptIns.playBGM();
    }
    const canvasNode = self.canvasNode;
    self.ctrl = canvasNode.getComponent("TouchEventsManager");
    self.enableInputControls();
    if (self.countdownToBeginGameNode.parent) {
      self.countdownToBeginGameNode.parent.removeChild(self.countdownToBeginGameNode);
    }
    self.transitToState(ALL_MAP_STATES.VISUAL);
    self.applyRoomDownsyncFrameDynamics(rdf);
    self._dumpToRenderCache(rdf);
    self.battleState = ALL_BATTLE_STATES.IN_BATTLE; // Starts the increment of "self.renderFrameId" in "self.update(dt)"
    if (null != window.boundRoomId) {
      self.boundRoomIdLabel.string = window.boundRoomId;
    }
  },

  logBattleStats() {
    const self = this;
    let s = [];
    s.push("Battle stats: lastUpsyncInputFrameId=" + self.lastUpsyncInputFrameId + ", lastAllConfirmedInputFrameId=" + self.lastAllConfirmedInputFrameId);
    
    for (let i = self.recentInputCache.stFrameId; i < self.recentInputCache.edFrameId; ++i) {
      const inputFrameDownsync = self.recentInputCache.getByFrameId(i);  
      s.push(JSON.stringify(inputFrameDownsync));
    } 

    console.log(s.join('\n'));
  },

  onBattleStopped() {
    const self = this;
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

  spawnPlayerNode(joinIndex, x, y) {
    const self = this;
    const newPlayerNode = 1 == joinIndex ? cc.instantiate(self.player1Prefab) : cc.instantiate(self.player2Prefab); // hardcoded for now, car color determined solely by joinIndex
    newPlayerNode.setPosition(cc.v2(x, y));
    newPlayerNode.getComponent("SelfPlayer").mapNode = self.node;
    const currentSelfColliderCircle = newPlayerNode.getComponent(cc.CircleCollider);

    const newPlayerColliderLatest = self.latestCollisionSys.createCircle(x, y, currentSelfColliderCircle.radius);
    const newPlayerColliderChaser = self.chaserCollisionSys.createCircle(x, y, currentSelfColliderCircle.radius);
    const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
    self.latestCollisionSysMap.set(collisionPlayerIndex, newPlayerColliderLatest);
    self.chaserCollisionSysMap.set(collisionPlayerIndex, newPlayerColliderChaser);

    safelyAddChild(self.node, newPlayerNode);
    setLocalZOrder(newPlayerNode, 5);

    newPlayerNode.active = true;
    const playerScriptIns = newPlayerNode.getComponent("SelfPlayer");
    playerScriptIns.scheduleNewDirection({dx: 0, dy: 0}, true);

    return [newPlayerNode, playerScriptIns];
  },

  update(dt) {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
      try {
          let prevSelfInput = null, currSelfInput = null;
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
          if (nextChaserRenderFrameId > self.renderFrameId) nextChaserRenderFrameId = self.renderFrameId; 
          self.rollbackAndChase(prevChaserRenderFrameId, nextChaserRenderFrameId, self.chaserCollisionSys, self.chaserCollisionSysMap);
          self.chaserRenderFrameId = nextChaserRenderFrameId; // Move the cursor "self.chaserRenderFrameId", keep in mind that "self.chaserRenderFrameId" is not monotonic!
          let t2 = performance.now(); 

          // Inside "self.rollbackAndChase", the "self.latestCollisionSys" is ALWAYS ROLLED BACK to "self.recentRenderCache.get(self.renderFrameId)" before being applied dynamics from corresponding inputFrameDownsync, REGARDLESS OF whether or not "self.chaserRenderFrameId == self.renderFrameId" now. 
          const rdf = self.rollbackAndChase(self.renderFrameId, self.renderFrameId+1, self.latestCollisionSys, self.latestCollisionSysMap);

          self.applyRoomDownsyncFrameDynamics(rdf);
          let t3 = performance.now(); 
          /*
          if (prevChaserRenderFrameId < nextChaserRenderFrameId) {
            console.log("Took ", t1-t0, " milliseconds to send upsync cmds, ", t2-t1, " milliseconds to chase renderFrameIds=[", prevChaserRenderFrameId, ", ", nextChaserRenderFrameId, "], @renderFrameId=", self.renderFrameId); 
          }
          */
      } catch (err) {
        console.error("Error during Map.update", err);
      } finally {
        // Update countdown
        if (null != self.countdownNanos) {
          self.countdownNanos -= self.rollbackEstimatedDt*1000000000;
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
        data: { intAuthToken: selfPlayerInfo.intAuthToken },
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

  onBattleReadyToStart(playerMetas, isSelfRejoining) {
    console.log("Calling `onBattleReadyToStart` with:", playerMetas);
    const self = this;
    const findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
    findingPlayerScriptIns.hideExitButton();
    findingPlayerScriptIns.updatePlayersInfo(playerMetas);

    const hideFindingPlayersGUI = function() {
      if (null == self.findingPlayerNode.parent) return;
      self.findingPlayerNode.parent.removeChild(self.findingPlayerNode);
    };

    if (true == isSelfRejoining) {
        hideFindingPlayersGUI();
    } else { 
      // Delay to hide the "finding player" GUI, then show a countdown clock
      window.setTimeout(() => {
        hideFindingPlayersGUI();
        const countDownScriptIns = self.countdownToBeginGameNode.getComponent("CountdownToBeginGame");
        countDownScriptIns.setData();
        self.showPopupInCanvas(self.countdownToBeginGameNode);
      }, 1500);
    }
  },

  _createRoomDownsyncFrameLocally(renderFrameId, collisionSys, collisionSysMap) {
    const self = this;
    const prevRenderFrameId = renderFrameId-1; 
    const inputFrameAppliedOnPrevRenderFrame = (
      0 > prevRenderFrameId 
      ?   
      null
      :
      self.getCachedInputFrameDownsyncWithPrediction(self._convertToInputFrameId(prevRenderFrameId, self.inputDelayFrames))
    );

    // TODO: Find a better way to assign speeds instead of using "speedRefRenderFrameId".
    const speedRefRenderFrameId = prevRenderFrameId;
    const speedRefRenderFrame = (
      0 > speedRefRenderFrameId
      ?   
      null
      :
      self.recentRenderCache.getByFrameId(speedRefRenderFrameId)
    );

    const rdf = {
      id: renderFrameId,
      refFrameId: renderFrameId,
      players: {} 
    };
    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      const joinIndex = playerRichInfo.joinIndex; 
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      rdf.players[playerRichInfo.id] = {
        id: playerRichInfo.id,
        x: playerCollider.x,
        y: playerCollider.y,
        dir: self.ctrl.decodeDirection(null == inputFrameAppliedOnPrevRenderFrame ? 0 : inputFrameAppliedOnPrevRenderFrame.inputList[joinIndex-1]),
        speed: (null == speedRefRenderFrame ? playerRichInfo.speed : speedRefRenderFrame.players[playerRichInfo.id].speed),
        joinIndex: joinIndex 
      };
    });
    if (
      null != inputFrameAppliedOnPrevRenderFrame && self._allConfirmed(inputFrameAppliedOnPrevRenderFrame.confirmedList) 
      && 
      self.lastAllConfirmedRenderFrameId >= prevRenderFrameId
      &&
      rdf.id > self.lastAllConfirmedRenderFrameId
    ) {
      self.lastAllConfirmedRenderFrameId = rdf.id; 
    }
    self._dumpToRenderCache(rdf); 
    return rdf;
  },

  applyRoomDownsyncFrameDynamics(rdf) {
    const self = this;

    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      const immediatePlayerInfo = rdf.players[playerId];
      playerRichInfo.node.setPosition(immediatePlayerInfo.x, immediatePlayerInfo.y);
      playerRichInfo.scriptIns.scheduleNewDirection(immediatePlayerInfo.dir, true);
      playerRichInfo.scriptIns.updateSpeed(immediatePlayerInfo.speed); 
    });
  }, 

  getCachedInputFrameDownsyncWithPrediction(inputFrameId) {
    const self = this;
    let inputFrameDownsync = self.recentInputCache.getByFrameId(inputFrameId);
    if (null != inputFrameDownsync && -1 != self.lastAllConfirmedInputFrameId && inputFrameId > self.lastAllConfirmedInputFrameId) {
      const lastAllConfirmedInputFrame = self.recentInputCache.getByFrameId(self.lastAllConfirmedInputFrameId); 
      for (let i = 0; i < inputFrameDownsync.inputList.length; ++i) {
        if (i == self.selfPlayerInfo.joinIndex-1) continue;
        inputFrameDownsync.inputList[i] = lastAllConfirmedInputFrame.inputList[i]; 
      }
    } 

    return inputFrameDownsync;
  },

  rollbackAndChase(renderFrameIdSt, renderFrameIdEd, collisionSys, collisionSysMap) {
    if (renderFrameSt >= renderFrameIdEd) {
      return;
    }

    const self = this;
    const renderFrameSt = self.recentRenderCache.getByFrameId(renderFrameIdSt); // typed "RoomDownsyncFrame"
    if (null == renderFrameSt) {
      console.error("Couldn't find renderFrameId=", renderFrameIdSt, " to rollback, recentRenderCache=", self._stringifyRecentRenderCache(false));
    }
    /* 
    Reset "position" of players in "collisionSys" according to "renderFrameSt". The easy part is that we don't have path-dependent-integrals to worry about like that of thermal dynamics.
    */
    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      const joinIndex = playerRichInfo.joinIndex; 
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      const player = renderFrameSt.players[playerId];
      playerCollider.x = player.x;
      playerCollider.y = player.y;
    });

    // [WARNING] Traverse in the order of joinIndices to guarantee determinism.

    /*
    This function eventually calculates a "RoomDownsyncFrame" where "RoomDownsyncFrame.id == renderFrameIdEd".
    */
    for (let i = renderFrameIdSt; i < renderFrameIdEd; ++i) {
      const renderFrame = self.recentRenderCache.getByFrameId(i); // typed "RoomDownsyncFrame"
      const j = self._convertToInputFrameId(i, self.inputDelayFrames);
      const inputList = self.getCachedInputFrameDownsyncWithPrediction(j).inputList; 
      for (let j in self.playerRichInfoArr) {
        const joinIndex = parseInt(j) + 1; 
        const playerId = self.playerRichInfoArr[j].id; 
        const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
        const playerCollider = collisionSysMap.get(collisionPlayerIndex);
        const player = renderFrame.players[playerId];
        const encodedInput = inputList[joinIndex-1];
        const decodedInput = self.ctrl.decodeDirection(encodedInput);
        const baseChange = player.speed*self.rollbackEstimatedDt*decodedInput.speedFactor;
        playerCollider.x += baseChange*decodedInput.dx;
        playerCollider.y += baseChange*decodedInput.dy;
        /*
        if (0 < encodedInput) {
          console.log("playerId=", playerId, "@renderFrameId=", i, ", delayedInputFrameId=", j, ", baseChange=", baseChange, ": x=", playerCollider.x, ", y=", playerCollider.y);
        }
        */
      }

      collisionSys.update();
      const result = collisionSys.createResult(); // Can I reuse a "self.latestCollisionSysResult" object throughout the whole battle?
        
      for (let i in self.playerRichInfoArr) {
        const joinIndex = parseInt(i) + 1; 
        const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
        const playerCollider = collisionSysMap.get(collisionPlayerIndex);
        const potentials = playerCollider.potentials();
        for (const barrier of potentials) {
          // Test if the player collides with the wall
          if (!playerCollider.collides(barrier, result)) continue;
          // Push the player out of the wall
          playerCollider.x -= result.overlap * result.overlap_x;
          playerCollider.y -= result.overlap * result.overlap_y;
        }
      }
    }
  
    return self._createRoomDownsyncFrameLocally(renderFrameIdEd, collisionSys, collisionSysMap);
  }, 
  
  _initPlayerRichInfoDict(players, playerMetas) {
    const self = this;
    for (let k in players) {
      const playerId = parseInt(k);
      if (self.playerRichInfoDict.has(playerId)) continue; // Skip already put keys
      const immediatePlayerInfo = players[playerId];
      const immediatePlayerMeta = playerMetas[playerId];
      const nodeAndScriptIns = self.spawnPlayerNode(immediatePlayerInfo.joinIndex, immediatePlayerInfo.x, immediatePlayerInfo.y);
      self.playerRichInfoDict.set(playerId, immediatePlayerInfo); 

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
      self.playerRichInfoArr[playerRichInfo.joinIndex-1] = playerRichInfo;
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
    return "[stInputFrameId=" + self.recentInputCache.stFrameId + ", edInputFrameId=" + self.recentInputCache.edFrameId + ")";
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
    return "[stRenderFrameId=" + self.recentRenderCache.stFrameId + ", edRenderFrameId=" + self.recentRenderCache.edFrameId + ")";
  },

});
