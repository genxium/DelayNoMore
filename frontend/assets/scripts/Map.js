const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

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
  BATTLE_READY_TO_START: -99,
  PLAYER_ADDED_AND_ACKED: -98,
  PLAYER_READDED_AND_ACKED: -97,
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
    polygonBoundaryShelterPrefab: {
      type: cc.Prefab,
      default: null,
    },
    polygonBoundaryShelterZReducerPrefab: {
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
    rollbackInMainUpdate: {
      default: true
    },
  },
    
  _inputFrameIdDebuggable(inputFrameId) {
    return (0 == inputFrameId%10);
  },

  _dumpToFullFrameCache: function(fullFrame) {
    const self = this;
    while (self.recentFrameCacheCurrentSize >= self.recentFrameCacheMaxCount) {
      const toDelFrameId = Object.keys(self.recentFrameCache)[0];
      delete self.recentFrameCache[toDelFrameId];
      --self.recentFrameCacheCurrentSize;
    }
    self.recentFrameCache[fullFrame.id] = fullFrame;
    ++self.recentFrameCacheCurrentSize;
  },

  _dumpToInputCache: function(inputFrameDownsync) {
    const self = this;
    while (self.recentInputCacheCurrentSize >= self.recentInputCacheMaxCount) {
      const toDelFrameId = Object.keys(self.recentInputCache)[0];
      // console.log("Deleting toDelFrameId=", toDelFrameId, " from recentInputCache");
      delete self.recentInputCache[toDelFrameId];
      --self.recentInputCacheCurrentSize;
    }
    self.recentInputCache[inputFrameDownsync.inputFrameId] = inputFrameDownsync;
    ++self.recentInputCacheCurrentSize;
  },

  _convertToInputFrameId(renderFrameId, inputDelayFrames) {
    if (renderFrameId < inputDelayFrames) return 0;
    return ((renderFrameId - inputDelayFrames) >> this.inputScaleFrames);
  },

  _convertToRenderFrameId(inputFrameId, inputDelayFrames) {
    return ((inputFrameId << this.inputScaleFrames) + inputDelayFrames);
  },

  _shouldGenerateInputFrameUpsync(renderFrameId) {
    return ((renderFrameId & 3) == 0); // 3 is 0x0011
  },

  _generateInputFrameUpsync(inputFrameId) {
    const instance = this;
    if (
      null == instance.ctrl ||
      null == instance.selfPlayerInfo
    ) {
      return [null, null];
    }

    const discreteDir = instance.ctrl.getDiscretizedDirection();
    let prefabbedInputList = null;
    let selfPlayerLastInputFrameInput = 0;
    if (0 == instance.lastLocalInputFrameId) {
        prefabbedInputList = new Array(Object.keys(instance.playersNode).length).fill(0);
    } else {
        if (null == instance.recentInputCache || null == instance.recentInputCache[instance.lastLocalInputFrameId-1]) {
            console.warn("_generateInputFrameUpsync: recentInputCache is NOT having inputFrameId=", instance.lastLocalInputFrameId-1, "; recentInputCache=", instance._stringifyRecentInputCache(false));
            prefabbedInputList = new Array(Object.keys(instance.playersNode).length).fill(0); 
        } else {
            prefabbedInputList = Array.from(instance.recentInputCache[instance.lastLocalInputFrameId-1].inputList); 
            selfPlayerLastInputFrameInput = prefabbedInputList[(instance.selfPlayerInfo.joinIndex-1)]; // it's an integer, thus making a copy here, not impacted by later assignments 
        }
    }

    prefabbedInputList[(instance.selfPlayerInfo.joinIndex-1)] = discreteDir.encodedIdx;

    const prefabbedInputFrameDownsync = {
        inputFrameId: inputFrameId,
        inputList: prefabbedInputList, 
        confirmedList: (1 << (instance.selfPlayerInfo.joinIndex-1))
    };

    instance._dumpToInputCache(prefabbedInputFrameDownsync); // A prefabbed inputFrame, would certainly be adding a new inputFrame to the cache, because server only downsyncs "all-confirmed inputFrames" 

    return [selfPlayerLastInputFrameInput, discreteDir.encodedIdx];
  },
  
  _shouldSendInputFrameUpsyncBatch(prevSelfInput, currSelfInput, lastUpsyncInputFrameId, currInputFrameId) {
    /*
    For a 2-player-battle, this "shouldUpsyncForEarlyAllConfirmedOnServer" can be omitted, however for more players in a same battle, to avoid a "long time non-moving player" jamming the downsync of other moving players, we should use this flag.
    */
    if (null == currSelfInput) return false;
    const shouldUpsyncForEarlyAllConfirmedOnServer = (currInputFrameId - lastUpsyncInputFrameId >= this.inputFrameUpsyncDelayTolerance); 
    return shouldUpsyncForEarlyAllConfirmedOnServer || (prevSelfInput != currSelfInput);
  }, 

  _sendInputFrameUpsyncBatch(inputFrameId) {
    // [WARNING] Why not just send the latest input? Because different player would have a different "inputFrameId" of changing its last input, and that could make the server not recognizing any "all-confirmed inputFrame"!
    const instance = this;
    let inputFrameUpsyncBatch = [];
    for (let i = instance.lastUpsyncInputFrameId+1; i <= inputFrameId; ++i) {
        const inputFrameDownsync = instance.recentInputCache[i];
        if (null == inputFrameDownsync) {
          console.warn("_sendInputFrameUpsyncBatch: recentInputCache is NOT having inputFrameId=", i, "; recentInputCache=", JSON.stringify(instance.recentInputCache));
        } else {
          const inputFrameUpsync = {
            inputFrameId: i,
            encodedDir: inputFrameDownsync.inputList[instance.selfPlayerInfo.joinIndex-1],
          };
          inputFrameUpsyncBatch.push(inputFrameUpsync);
        }
    } 
    const reqData = window.WsReq.encode({
      msgId: Date.now(),
      playerId: instance.selfPlayerInfo.id,
      act: window.UPSYNC_MSG_ACT_PLAYER_CMD,
      joinIndex: instance.selfPlayerInfo.joinIndex,
      ackingFrameId: instance.lastRoomDownsyncFrameId,
      ackingInputFrameId: instance.lastDownsyncInputFrameId,
      inputFrameUpsyncBatch: inputFrameUpsyncBatch,
    }).finish();
    window.sendSafely(reqData);
    instance.lastUpsyncInputFrameId = inputFrameId;
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
    if (self.inputControlTimer) {
      clearInterval(self.inputControlTimer);
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
    for (let joinIndex in self.playersNode) {
        const node = self.playersNode[joinIndex];
        if (node.parent) {
          node.parent.removeChild(node);
        }
    }
    self.playerRichInfoDict = {};
    // Clearing previous info of all players. [ENDS]

    self.lastRoomDownsyncFrameId = 0;
    self.renderFrameId = 0; // After battle started
    self.inputDelayFrames = 8;
    self.inputScaleFrames = 3;
    self.lastLocalInputFrameId = 0;
    self.lastDownsyncInputFrameId = -1;
    self.lastAllConfirmedInputFrameId = -1;
    self.lastUpsyncInputFrameId = -1;
    self.inputFrameUpsyncDelayTolerance = 3;

    self.recentFrameCache = {};
    self.recentFrameCacheCurrentSize = 0;
    self.recentFrameCacheMaxCount = 1024;

    self.selfPlayerInfo = null; // This field is kept for distinguishing "self" and "others".
    self.recentInputCache = {}; // TODO: Use a ringbuf instead
    self.recentInputCacheCurrentSize = 0;
    self.recentInputCacheMaxCount = 1024;
    self.toRollbackRenderFrameId1 = null;
    self.toRollbackRenderFrameId2 = null;
    self.toRollbackInputFrameId1 = null;
    self.toRollbackInputFrameId2 = null;
    
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
    cc.director.getCollisionManager().enabled = true;
    cc.director.getCollisionManager().enabledDebugDraw = CC_DEBUG;
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

    self.playersNode = {};
    const player1Node = cc.instantiate(self.player1Prefab);
    const player2Node = cc.instantiate(self.player2Prefab);
    Object.assign(self.playersNode, {
      1: player1Node
    });
    Object.assign(self.playersNode, {
      2: player2Node
    });

    /** Init required prefab ended. */

    self.clientUpsyncFps = 60;

    window.handleBattleColliderInfo = function(parsedBattleColliderInfo) {
      console.log(parsedBattleColliderInfo);

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
        - It's important to assign new "tmxAsset" before "extractBoundaryObjects => initMapNodeByTiledBoundaries", to ensure that the correct tilesets are used.
        - To ensure clearance, put destruction of the "cc.TiledMap" component preceding that of "mapNode.destroyAllChildren()".

        -- YFLu, 2019-09-07

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

        const boundaryObjs = tileCollisionManager.extractBoundaryObjects(self.node);
        tileCollisionManager.initMapNodeByTiledBoundaries(self, mapNode, boundaryObjs);
      

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
        case window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_READY_TO_START:
          // 显示倒计时
          self.playersMatched(rdf.playerMetas);
          // 隐藏返回按钮
          findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
          findingPlayerScriptIns.hideExitButton();
          return;
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
        }

        const frameId = rdf.id;
        if (0 == self.lastRoomDownsyncFrameId) {
          if (1 == frameId) {
            // No need to prompt upon rejoined.
            self.popupSimplePressToGo(i18n.t("gameTip.start"));
          }

          self.onBattleStarted(rdf); 
        }

        self._dumpToFullFrameCache(rdf); 
        self.lastRoomDownsyncFrameId = frameId;
        // TODO: Inject a NetworkDoctor as introduced in https://app.yinxiang.com/shard/s61/nl/13267014/5c575124-01db-419b-9c02-ec81f78c6ddc/.
      }; 

      window.handleInputFrameDownsyncBatch = function(batch) {
        if (ALL_BATTLE_STATES.IN_BATTLE != self.battleState
          && ALL_BATTLE_STATES.IN_SETTLEMENT != self.battleState) {
          return;
        }

        // console.log("Received inputFrameDownsyncBatch=", batch, ", now correspondingLastLocalInputFrame=", self.recentInputCache[batch[batch.length-1].inputFrameId]); 
        let firstPredictedYetIncorrectInputFrameId = null;
        let firstPredictedYetIncorrectInputFrameJoinIndex = null;
        for (let k in batch) {
          const inputFrameDownsync = batch[k]; 
          const inputFrameDownsyncId = inputFrameDownsync.inputFrameId;
          const localInputFrame = self.recentInputCache[inputFrameDownsyncId]; 
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
          self._dumpToInputCache(inputFrameDownsync);
          // [WARNING] Currently "lastDownsyncInputFrameId" and "lastAllConfirmedInputFrameId" are identical, but they (their definitions) are prone to changes in the future
          self.lastDownsyncInputFrameId = inputFrameDownsyncId; 
          self.lastAllConfirmedInputFrameId = inputFrameDownsyncId; 
        }

        if (null != firstPredictedYetIncorrectInputFrameId) {
          const renderFrameId2 = self.renderFrameId;
          const inputFrameId2 = self._convertToInputFrameId(renderFrameId2, self.inputDelayFrames);
          const inputFrameId1 = firstPredictedYetIncorrectInputFrameId;
          const renderFrameId1 = self._convertToRenderFrameId(inputFrameId1, self.inputDelayFrames); // a.k.a. "firstRenderFrameIdUsingIncorrectInputFrameId"
          if (renderFrameId1 < renderFrameId2) {
            // No need to rollback when "renderFrameId1 == renderFrameId2", because the "delayedInputFrame for renderFrameId2" is not yet executed by now, it just went through "++self.renderFrameId" in "update(dt)" and js-runtime is mostly single-threaded in our programmable range. 
            console.warn("Mismatched input detected!: [inputFrameId1:", inputFrameId1, ", inputFrameId2:", inputFrameId2, "), [renderFrameId1:", renderFrameId1, ", renderFrameId2:", renderFrameId2, "). ");
            if (true == self.rollbackInMainUpdate) {
              // The actual rollback-and-replay would later be executed in update(dt). 
              if (null == self.toRollbackRenderFrameId1) {
                self.toRollbackRenderFrameId1 = renderFrameId1;
                self.toRollbackRenderFrameId2 = renderFrameId2;
                self.toRollbackInputFrameId1 = inputFrameId1;
                self.toRollbackInputFrameId2 = inputFrameId2;
              } else {
                // Just extend the ending indices
                self.toRollbackRenderFrameId2 = renderFrameId2;
                self.toRollbackInputFrameId2 = inputFrameId2;
              }
            } else {
              self._rollbackAndReplay(inputFrameId1, renderFrameId1, inputFrameId2, renderFrameId2);
            }

          } else {
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

    self._applyRoomDownsyncFrameDynamics(rdf);
    self.battleState = ALL_BATTLE_STATES.IN_BATTLE; // Starts the increment of "self.renderFrameId" in "self.update(dt)"
  },

  logBattleStats() {
    const self = this;
    let s = [];
    s.push("Battle stats: lastUpsyncInputFrameId=" + self.lastUpsyncInputFrameId + ", lastDownsyncInputFrameId=" + self.lastDownsyncInputFrameId + ", lastAllConfirmedInputFrameId=" + self.lastAllConfirmedInputFrameId + ", lastDownsyncInputFrameId=" + self.lastDownsyncInputFrameId);

    for (let inputFrameDownsyncId in self.recentInputCache) {
        const inputFrameDownsync = self.recentInputCache[inputFrameDownsyncId];
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
    const instance = this;
    const newPlayerNode = instance.playersNode[joinIndex];
    newPlayerNode.setPosition(cc.v2(x, y));
    newPlayerNode.getComponent("SelfPlayer").mapNode = instance.node;

    safelyAddChild(instance.node, newPlayerNode);
    setLocalZOrder(newPlayerNode, 5);

    newPlayerNode.active = true;
    const playerScriptIns = newPlayerNode.getComponent("SelfPlayer");
    playerScriptIns.scheduleNewDirection({dx: 0, dy: 0}, true);

    return [newPlayerNode, playerScriptIns];
  },

  update(dt) {
    const self = this;
    try {
      let inputs = new Array(Object.keys(self.playersNode).length).fill({
          dx: 0, 
          dy: 0
      });
      if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
        let prevSelfInput = null, currSelfInput = null;
        const noDelayInputFrameId = self._convertToInputFrameId(self.renderFrameId, 0); // It's important that "inputDelayFrames == 0" here 
        if (self._shouldGenerateInputFrameUpsync(self.renderFrameId)) {
          const prevAndCurrInputs = self._generateInputFrameUpsync(noDelayInputFrameId); 
          prevSelfInput = prevAndCurrInputs[0];
          currSelfInput = prevAndCurrInputs[1]; 
        }
        if (self._shouldSendInputFrameUpsyncBatch(prevSelfInput, currSelfInput, self.lastUpsyncInputFrameId, noDelayInputFrameId)) {
          // TODO: Is the following statement run asynchronously in an implicit manner? Should I explicitly run it asynchronously?
          self._sendInputFrameUpsyncBatch(noDelayInputFrameId);
        }
        
        if (true == self.rollbackInMainUpdate) {
          if (null != self.toRollbackRenderFrameId1) {
            self._rollbackAndReplay(self.toRollbackInputFrameId1, self.toRollbackRenderFrameId1, self.toRollbackInputFrameId2, self.toRollbackRenderFrameId2);
            self.toRollbackRenderFrameId1 = null;
            self.toRollbackRenderFrameId2 = null;
            self.toRollbackInputFrameId1 = null;
            self.toRollbackInputFrameId2 = null;
          }
        }

        const delayedInputFrameId = self._convertToInputFrameId(self.renderFrameId, self.inputDelayFrames); // The "inputFrameId" to use at current "renderFrameId"
        const delayedInputFrameDownsync = self.recentInputCache[delayedInputFrameId];
        if (null == delayedInputFrameDownsync) {
          console.warn("update(dt): recentInputCache is NOT having inputFrameId=", delayedInputFrameId, "; recentInputCache=", instance._stringifyRecentInputCache(false));
        } else {
          self._applyInputFrameDownsyncDynamics(delayedInputFrameDownsync, false);
        } 
        const rdf = self._createRoomDownsyncFrameLocally();
        self._dumpToFullFrameCache(rdf); 
        /*
        if (null != delayedInputFrameDownsync && null != delayedInputFrameDownsync.inputList && 0 < delayedInputFrameDownsync.inputList[self.selfPlayerInfo.joinIndex-1]) {
          console.log("My critical status: renderFrame=", JSON.stringify(rdf), ", delayedInputFrameDownsync=", JSON.stringify(delayedInputFrameDownsync));
        }
        */
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

  _createRoomDownsyncFrameLocally() {
    const self = this;
    const rdf = {
        id: self.renderFrameId,
        refFrameId: self.renderFrameId,
        players: {},
        countdownNanos: self.countdownNanos 
    };

    for (let playerId in self.playerRichInfoDict) {
      const playerRichInfo = self.playerRichInfoDict[playerId]; 
      const joinIndex = playerRichInfo.joinIndex; 
      const playerNode = playerRichInfo.node; 
      const playerScriptIns = playerRichInfo.scriptIns;
      rdf.players[playerRichInfo.id] = {
        id: playerRichInfo.id,
        x: playerNode.position.x,
        y: playerNode.position.y,
        dir: playerScriptIns.activeDirection,
        speed: playerScriptIns.speed,
        joinIndex: joinIndex 
      };
    }
    return rdf;
  },

  _applyRoomDownsyncFrameDynamics(rdf) {
    const self = this;

    for (let playerId in self.playerRichInfoDict) {
      const playerRichInfo = self.playerRichInfoDict[playerId]; 
      const immediatePlayerInfo = rdf.players[playerId];
      playerRichInfo.node.setPosition(immediatePlayerInfo.x, immediatePlayerInfo.y);
      playerRichInfo.scriptIns.scheduleNewDirection(immediatePlayerInfo.dir, true);
      playerRichInfo.scriptIns.updateSpeed(immediatePlayerInfo.speed); 
    }
  }, 

  _applyInputFrameDownsyncDynamics(inputFrameDownsync, invokeUpdateToo) {
    // This application DOESN'T use a "full physics engine", but only "collider detection" of "box2d", thus when resetting room state, there's no need of resetting "momentums". 
    const self = this;
    const inputs = inputFrameDownsync.inputList; 
    // Update controlled player nodes 
    for (let playerId in self.playerRichInfoDict) {
      const playerRichInfo = self.playerRichInfoDict[playerId];
      const joinIndex = playerRichInfo.joinIndex; 
      const playerScriptIns = playerRichInfo.scriptIns;
      const decodedInput = self.ctrl.decodeDirection(inputs[joinIndex-1]);
      playerScriptIns.scheduleNewDirection(decodedInput, true);
      if (invokeUpdateToo) {
        playerScriptIns.update(self.rollbackEstimatedDt);
      }
    }
    
    if (invokeUpdateToo) {
      // [WARNING] CocosCreator v2.2.1 uses a singleton "CCDirector" to schedule "tree descendent updates" and "collision detections" in different timers, thus the following manual trigger of collision detection might not produce the same outcome for the "selfPlayer" as the other peers. Moreover, the aforementioned use of different timers is an intrinsic source of error! 

      cc.director._collisionManager.update(self.rollbackEstimatedDt); // Just to avoid unexpected wall penetration, no guarantee on determinism
    }
  }, 
  
  _rollbackAndReplay(inputFrameId1, renderFrameId1, inputFrameId2, renderFrameId2) {
    const self = this;
    const rdf1 = self.recentFrameCache[renderFrameId1];
    if (null == rdf1) {
      const recentFrameCacheKeys = Object.keys(self.recentFrameCache);
      console.error("renderFrameId1=", renderFrameId1, "doesn't exist in recentFrameCache ", self._stringifyRecentFrameCache(false), ": COULDN'T ROLLBACK!");
      return;
    }

    let t0 = performance.now(); 
    self._applyRoomDownsyncFrameDynamics(rdf1);
    // DON'T apply inputFrameDownsync dynamics for exactly "renderFrameId2", see the comment around the invocation of "_rollbackAndReplay". 
    for (let renderFrameId = renderFrameId1; renderFrameId < renderFrameId2; ++renderFrameId) {
      const delayedInputFrameId = self._convertToInputFrameId(renderFrameId, self.inputDelayFrames);
      const delayedInputFrameDownsync = self.recentInputCache[delayedInputFrameId];
      self._applyInputFrameDownsyncDynamics(delayedInputFrameDownsync, true);
      // console.log("_rollbackAndReplay, AFTER:", self._stringifyRollbackResult(renderFrameId, delayedInputFrameDownsync));
    } 
    let t1 = performance.now(); 
    console.log("Executed rollback-and-replay: [inputFrameId1:", inputFrameId1, ", inputFrameId2:", inputFrameId2, "), [renderFrameId1:", renderFrameId1, ", renderFrameId2:", renderFrameId2, "). It took", t1-t0, "milliseconds");
  },

  _initPlayerRichInfoDict(players, playerMetas) {
    const self = this;
    for (let k in players) {
      const playerId = parseInt(k);
      if (self.playerRichInfoDict.hasOwnProperty(playerId)) continue;
      const immediatePlayerInfo = players[playerId];
      const immediatePlayerMeta = playerMetas[playerId];
      const nodeAndScriptIns = self.spawnPlayerNode(immediatePlayerInfo.joinIndex, immediatePlayerInfo.x, immediatePlayerInfo.y);
      self.playerRichInfoDict[playerId] = immediatePlayerInfo; 

      Object.assign(self.playerRichInfoDict[playerId], {
        node: nodeAndScriptIns[0],
        scriptIns: nodeAndScriptIns[1]
      });

      if (self.selfPlayerInfo.id == playerId) {
        self.selfPlayerInfo = Object.assign(self.selfPlayerInfo, immediatePlayerInfo); 
        nodeAndScriptIns[1].showArrowTipNode();
      }
    }
  },

  _stringifyRecentFrameCache(usefullOutput) {
    if (true == usefullOutput) {

      let s = [];
      for (let renderFrameId in self.recentFrameCache) {
          const roomDownsyncFrame = self.recentFrameCache[renderFrameId];
          s.push(JSON.stringify(roomDownsyncFrame));
      }

      return s.join('\n');
    }
    const keys = Object.keys(this.recentFrameCache);
    return "[stRenderFrameId=" + keys[0] + ", edRenderFrameId=" + keys[keys.length-1] + "]";
  },

  _stringifyRecentInputCache(usefullOutput) {
    if (true == usefullOutput) {
      return JSON.stringify(this.recentInputCache);
    }
    const keys = Object.keys(this.recentInputCache);
    return "[stInputFrameId=" + keys[0] + ", edInputFrameId=" + keys[keys.length-1] + "]";
  },

  _stringifyRollbackResult(renderFrameId, delayedInputFrameDownsync) {
    // Slightly different from "_createRoomDownsyncFrameLocally" 
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
    let players = {};
    for (let playerId in self.playerRichInfoDict) {
      const playerRichInfo = self.playerRichInfoDict[playerId]; 
      const joinIndex = playerRichInfo.joinIndex; 
      const playerNode = playerRichInfo.node; 
      const playerScriptIns = playerRichInfo.scriptIns;
      s.players[playerRichInfo.id] = {
        id: playerRichInfo.id,
        x: playerNode.position.x,
        y: playerNode.position.y,
      };
    }

    return JSON.stringify(s);
  },
});
