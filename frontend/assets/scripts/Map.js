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
      default: 5
    },
  },
    
  _inputFrameIdDebuggable(inputFrameId) {
    return (0 == inputFrameId%10);
  },

  _dumpToRenderCache: function(roomDownsyncFrame) {
    const self = this;
    const minToKeepRenderFrameId = self.lastAllConfirmedRenderFrameId; 
    while (self.recentInputCache.stFrameId < minToKeepRenderFrameId) {
      self.recentRenderCache.pop();
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
    const minToKeepInputFrameId = self._convertToInputFrameId(self.lastAllConfirmedRenderFrameId, self.inputDelayFrames); // [WARNING] This could be different from "self.lastAllConfirmedInputFrameId". We'd like to keep the corresponding inputFrame for "self.lastAllConfirmedRenderFrameId" such that a rollback could place "self.chaserRenderFrameId = self.lastAllConfirmedRenderFrameId" for the worst case incorrect prediction.
    while (self.recentInputCache.stFrameId < minToKeepInputFrameId) {
      self.recentInputCache.pop();
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

  _convertToRenderFrameId(inputFrameId, inputDelayFrames) {
    return ((inputFrameId << this.inputScaleFrames) + inputDelayFrames);
  },

  _shouldGenerateInputFrameUpsync(renderFrameId) {
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
    For a 2-player-battle, this "shouldUpsyncForEarlyAllConfirmedOnServer" can be omitted, however for more players in a same battle, to avoid a "long time non-moving player" jamming the downsync of other moving players, we should use this flag.
    */
    if (null == currSelfInput) return false;
    const shouldUpsyncForEarlyAllConfirmedOnServer = (currInputFrameId - lastUpsyncInputFrameId >= this.inputFrameUpsyncDelayTolerance); 
    return shouldUpsyncForEarlyAllConfirmedOnServer || (prevSelfInput != currSelfInput);
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
    
      let findingPlayerScriptIns = null;
      window.handleRoomDownsyncFrame = function(rdf) {
        if (ALL_BATTLE_STATES.WAITING != self.battleState
          && ALL_BATTLE_STATES.IN_BATTLE != self.battleState
          && ALL_BATTLE_STATES.IN_SETTLEMENT != self.battleState) {
          return;
        }
        // Right upon establishment of the "PersistentSessionClient", we should receive an initial signal "BattleColliderInfo" earlier than any "RoomDownsyncFrame" containing "PlayerMeta" data. 
        const refFrameId = rdf.refFrameId;
        switch (refFrameId) {
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.PLAYER_ADDED_AND_ACKED:
          self._initPlayerRichInfoDict(rdf.players, rdf.playerMetas);
          // 显示匹配玩家
          findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
          if (!self.findingPlayerNode.parent) {
            self.showPopupInCanvas(self.findingPlayerNode);
          }
          findingPlayerScriptIns.updatePlayersInfo(rdf.playerMetas);
          return;
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.PLAYER_READDED_AND_ACKED:
          self._initPlayerRichInfoDict(rdf.players, rdf.playerMetas);
          // In this case, we're definitely in an active battle, thus the "self.findingPlayerNode" should be hidden if being presented. 
          if (self.findingPlayerNode && self.findingPlayerNode.parent) {
            self.findingPlayerNode.parent.removeChild(self.findingPlayerNode);
            self.transitToState(ALL_MAP_STATES.VISUAL);
            if (self.playersInfoNode) {
              for (let playerId in rdf.playerMetas) {
                const playerMeta = rdf.playerMetas[playerId];
                const playersInfoScriptIns = self.playersInfoNode.getComponent("PlayersInfo");
                playersInfoScriptIns.updateData(playerMeta);
              }
            }
          }
          return;
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_READY_TO_START:
          // 显示倒计时
          self.playersMatched(rdf.playerMetas);
          // 隐藏返回按钮
          findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
          findingPlayerScriptIns.hideExitButton();
          return;
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START:
          self.onBattleStarted(rdf); 
          return; 
        }

        const frameId = rdf.id;
        self.lastAllConfirmedRenderFrameId = frameId;
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
          const renderFrameId2 = self.renderFrameId;
          const inputFrameId2 = self._convertToInputFrameId(renderFrameId2, self.inputDelayFrames);
          const inputFrameId1 = firstPredictedYetIncorrectInputFrameId;
          const renderFrameId1 = self._convertToRenderFrameId(inputFrameId1, self.inputDelayFrames); // a.k.a. "firstRenderFrameIdUsingIncorrectInputFrameId"
          if (renderFrameId1 < renderFrameId2) {
            /*
            A typical case is as follows.
            --------------------------------------------------------
            [lastAllConfirmedRenderFrameId]       :              22

            <renderFrameId1>                      :              36


            [chaserRenderFrameId]                 :              62

            <renderFrameId2>                      :              64
            --------------------------------------------------------
            */
            console.warn("Mismatched input detected!: inputFrameId1:", inputFrameId1, ", renderFrameId1:", renderFrameId1);
            // The actual rollback-and-replay would later be executed in update(dt). 
            self.chaserRenderFrameId = renderFrameId1;
          } else {
            // No need to rollback when "renderFrameId1 == renderFrameId2", because the "delayedInputFrame for renderFrameId2" is not yet executed by now, it just went through "++self.renderFrameId" in "update(dt)" and javascript-runtime is mostly single-threaded in our programmable range. 
            console.log("Mismatched input yet no rollback needed: [inputFrameId1:", inputFrameId1, ", inputFrameId2:", inputFrameId2, "), [renderFrameId1:", renderFrameId1, ", renderFrameId2:", renderFrameId2, "). ");
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

  onBattleStarted(rdf) {
    // This function is also applicable to "re-joining".
    const players = rdf.players;
    const playerMetas = rdf.playerMetas;
    console.log('On battle started!');
    const self = window.mapIns;
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
    self.chaserRenderFrameId = MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START;
    self.applyRoomDownsyncFrameDynamics(rdf);
    self._dumpToRenderCache(rdf);
    self.battleState = ALL_BATTLE_STATES.IN_BATTLE; // Starts the increment of "self.renderFrameId" in "self.update(dt)"
  },

  logBattleStats() {
    const self = this;
    let s = [];
    s.push("Battle stats: lastUpsyncInputFrameId=" + self.lastUpsyncInputFrameId + ", lastAllConfirmedInputFrameId=" + self.lastAllConfirmedInputFrameId);
    
    self.recentInputCache.forEach((inputFrameDownsync, inputFrameId) => {
      s.push(JSON.stringify(inputFrameDownsync));
    });

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

    const newPlayerColliderLatest = self.latestCollisionSys.createCircle(x, y, currentSelfColliderCircle);
    const newPlayerColliderChaser = self.chaserCollisionSys.createCircle(x, y, currentSelfColliderCircle);
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
    try {
      if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
        let prevSelfInput = null, currSelfInput = null;
        const noDelayInputFrameId = self._convertToInputFrameId(self.renderFrameId, 0); // It's important that "inputDelayFrames == 0" here 
        if (self._shouldGenerateInputFrameUpsync(self.renderFrameId)) {
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
        if (self.chaserRenderFrameId <= self.renderFrameId) {
          let chaserUpperRenderFrameId = (self.chaserRenderFrameId + self.maxChasingRenderFramesPerUpdate); 
          if (chaserUpperRenderFrameId > self.renderFrameId) chaserUpperRenderFrameId = self.renderFrameId; 
          self.rollbackAndReplay(self.chaserRenderFrameId, chaserUpperRenderFrameId, self.chaserCollisionSys, self.chaserCollisionSysMap);
          self.chaserRenderFrameId = chaserUpperRenderFrameId; // Move the cursor "self.chaserRenderFrameId", keep in mind that "self.chaserRenderFrameId" is not monotonic!
        }
        let t2 = performance.now(); 

        // Inside "self.rollbackAndReplay", the "self.latestCollisionSys" is ALWAYS ROLLED BACK to "self.recentRenderCache.get(self.renderFrameId)" before being applied dynamics from corresponding inputFrameDownsync, REGARDLESS OF whether or not "self.chaserRenderFrameId == self.renderFrameId" now. 
        const rdf = self.rollbackAndReplay(self.renderFrameId, self.renderFrameId+1, self.latestCollisionSys, self.latestCollisionSysMap);

        self.applyRoomDownsyncFrameDynamics(rdf);
        let t3 = performance.now(); 

        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
      }
      const mapNode = self.node;
      const canvasNode = mapNode.parent;
      const canvasParentNode = canvasNode.parent;
      if (null != window.boundRoomId) {
        self.boundRoomIdLabel.string = window.boundRoomId;
      }

      // update countdown
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
    } catch (err) {
      console.error("Error during Map.update", err);
    }
    if (null != self.ctrl) {
      self.ctrl.justifyMapNodePosAndScale(self.ctrl.linearSpeedBase, self.ctrl.zoomingSpeedBase);
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

  playersMatched(playerMetas) {
    console.log("Calling `playersMatched` with:", playerMetas);

    const self = this;
    const findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
    findingPlayerScriptIns.updatePlayersInfo(playerMetas);
    window.setTimeout(() => {
      if (null != self.findingPlayerNode.parent) {
        self.findingPlayerNode.parent.removeChild(self.findingPlayerNode);
        self.transitToState(ALL_MAP_STATES.VISUAL);
        const playersInfoScriptIns = self.playersInfoNode.getComponent("PlayersInfo");
        for (let i in playerMetas) {
          const playerMeta = playerMetas[i];
          playersInfoScriptIns.updateData(playerMeta);
        }
      }
      const countDownScriptIns = self.countdownToBeginGameNode.getComponent("CountdownToBeginGame");
      countDownScriptIns.setData();
      self.showPopupInCanvas(self.countdownToBeginGameNode);
      return;
    }, 2000);
  },

  _createRoomDownsyncFrameLocally(renderFrameId, collisionSys, collisionSysMap) {
    const self = this;
    const prevRenderFrameId = renderFrameId-1; 
    const inputFrameForPrevRenderFrame = (
      0 > prevRenderFrameId 
      ?   
      null
      :
      self.getCachedInputFrameDownsyncWithPrediction(self._convertToInputFrameId(prevRenderFrameId, self.inputDelayFrames))
    );

    // TODO: Find a better way to assign speeds instead of using "speedRefRenderFrameId".
    const speedRefRenderFrameId = prevRenderFrameId;
    const speedRefRenderFrame = (
      0 > prevRenderFrameId 
      ?   
      null
      :
      self.recentRenderCache.getByFrameId(prevRenderFrameId)
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
        dir: self.ctrl.decodeDirection(null == inputFrameForPrevRenderFrame ? 0 : inputFrameForPrevRenderFrame.inputList[joinIndex-1]),
        speed: (null == speedRefRenderFrame ? playerRichInfo.speed : speedRefRenderFrame.players[playerRichInfo.id].speed),
        joinIndex: joinIndex 
      };
    });
    if (
      null != inputFrameForPrevRenderFrame && self._allConfirmed(inputFrameForPrevRenderFrame.confirmedList) 
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
    if (-1 != self.lastAllConfirmedInputFrameId && inputFrameId > self.lastAllConfirmedInputFrameId) {
      const lastAllConfirmedInputFrame = self.recentInputCache.getByFrameId(self.lastAllConfirmedInputFrameId); 
      for (let i = 0; i < inputFrameDownsync.inputList.length; ++i) {
        if (i == self.selfPlayerInfo.joinIndex-1) continue;
        inputFrameDownsync.inputList[i] = lastAllConfirmedInputFrame.inputList[i]; 
      }
    } 

    return inputFrameDownsync;
  },

  rollbackAndReplay(renderFrameIdSt, renderFrameIdEd, collisionSys, collisionSysMap) {
    if (renderFrameSt == renderFrameIdEd) {
      console.warn("Unexpected input!");
      return;
    }

    const self = this;
    const renderFrameSt = self.recentRenderCache.getByFrameId(renderFrameIdSt); // typed "RoomDownsyncFrame"
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

    const result = collisionSys.createResult(); // Can I reuse a "self.latestCollisionSysResult" object throughout the whole battle?
    /*
    This function eventually calculates a "RoomDownsyncFrame" where "RoomDownsyncFrame.id == renderFrameIdEd".
    */
    for (let i = renderFrameSt; i < renderFrameIdEd; ++i) {
      const renderFrame = self.recentRenderCache.getByFrameId(i); // typed "RoomDownsyncFrame"
      const j = self._convertToInputFrameId(i, self.inputDelayFrames);
      const inputs = self.recentInputCache.getByFrameId(j).inputList; 
      self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
        const joinIndex = playerRichInfo.joinIndex; 
        const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
        const playerCollider = collisionSysMap.get(collisionPlayerIndex);
        const player = renderFrame.players[playerId];
        const decodedInput = self.ctrl.decodeDirection(inputs[joinIndex-1]);
        playerCollider.x += player.speed*decodedInput.dx*self.rollbackEstimatedDt;
        playerCollider.y += player.speed*decodedInput.dy*self.rollbackEstimatedDt;
      });

      collisionSys.update();
        
      self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
        const joinIndex = playerRichInfo.joinIndex; 
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
      });
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
  },

  _stringifyRecentInputCache(usefullOutput) {
    if (true == usefullOutput) {
      let s = [];
      self.recentInputCache.forEach((inputFrameDownsync, inputFrameId) => {
        s.push(JSON.stringify(inputFrameDownsync));
      });

      return s.join('\n');
    }
    return "[stInputFrameId=" + self.recentInputCacheSt + ", edInputFrameId=" + self.recentInputCacheEd + ")";
  },

  _stringifyRollbackResult(renderFrameId, delayedInputFrameDownsync) {
    const self = this;
    const s = (
      null == delayedInputFrameDownsync 
      ? 
      {
        renderFrameId: renderFrameId,
        players: {}
      }
      :
      {
        renderFrameId: renderFrameId,
        players: {},
        delayedInputFrameDownsync: delayedInputFrameDownsync,   
      }
    );
    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      const joinIndex = playerRichInfo.joinIndex; 
      const playerNode = playerRichInfo.node; 
      const playerScriptIns = playerRichInfo.scriptIns;
      s.players[playerRichInfo.id] = {
        id: playerRichInfo.id,
        x: playerNode.position.x,
        y: playerNode.position.y,
      };
    });

    return JSON.stringify(s);
  },
});
