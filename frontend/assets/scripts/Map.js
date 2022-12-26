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
  NONE: -1,
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
    closeOnForcedtoResyncNotSelf: {
      default: true
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

  _convertToLastUsedRenderFrameId(inputFrameId, inputDelayFrames) {
    return ((inputFrameId << this.inputScaleFrames) + inputDelayFrames + (1 << this.inputScaleFrames) - 1);
  },

  shouldGenerateInputFrameUpsync(renderFrameId) {
    return ((renderFrameId & ((1 << this.inputScaleFrames) - 1)) == 0);
  },

  _allConfirmed(confirmedList) {
    return (confirmedList + 1) == (1 << this.playerRichInfoDict.size);
  },

  getOrPrefabInputFrameUpsync(inputFrameId) {
    // TODO: find some kind of synchronization mechanism against "onInputFrameDownsyncBatch"!
    const self = this;
    if (
      null == self.ctrl ||
      null == self.selfPlayerInfo
    ) {
      throw `noDelayInputFrameId=${inputFrameId} couldn't be generated: recentInputCache=${self._stringifyRecentInputCache(false)}`;
    }

    let previousSelfInput = null,
      currSelfInput = null;
    const joinIndex = self.selfPlayerInfo.joinIndex || self.selfPlayerInfo.JoinIndex;
    const existingInputFrame = self.recentInputCache.getByFrameId(inputFrameId);
    const previousInputFrameDownsyncWithPrediction = self.getCachedInputFrameDownsyncWithPrediction(inputFrameId - 1);
    previousSelfInput = (null == previousInputFrameDownsyncWithPrediction ? null : previousInputFrameDownsyncWithPrediction.inputList[joinIndex - 1]);
    if (null != existingInputFrame) {
      // This could happen upon either [type#1] or [type#2] forceConfirmation, where "refRenderFrame" is accompanied by some "inputFrameDownsyncs". The check here also guarantees that we don't override history 
      console.log(`noDelayInputFrameId=${inputFrameId} already exists in recentInputCache: recentInputCache=${self._stringifyRecentInputCache(false)}`);
      return [previousSelfInput, existingInputFrame.inputList[joinIndex - 1]];
    }

    const prefabbedInputList = (null == previousInputFrameDownsyncWithPrediction ? new Array(self.playerRichInfoDict.size).fill(0) : previousInputFrameDownsyncWithPrediction.inputList.slice());
    currSelfInput = self.ctrl.getEncodedInput(); // When "null == existingInputFrame", it'd be safe to say that the realtime "self.ctrl.getEncodedInput()" is for the requested "inputFrameId"
    prefabbedInputList[(joinIndex - 1)] = currSelfInput;
    while (self.recentInputCache.edFrameId <= inputFrameId) {
      // Fill the gap
      const prefabbedInputFrameDownsync = window.pb.protos.InputFrameDownsync.create({
        inputFrameId: self.recentInputCache.edFrameId,
        inputList: prefabbedInputList,
        confirmedList: (1 << (joinIndex - 1))
      });
      // console.log(`Prefabbed inputFrameId=${prefabbedInputFrameDownsync.inputFrameId}`);
      self.recentInputCache.put(prefabbedInputFrameDownsync);
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
    if (null == self.battleState || ALL_BATTLE_STATES.IN_BATTLE != self.battleState) {
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    }
    if (null != window.handleBattleColliderInfo) {
      window.handleBattleColliderInfo = null;
    }
  },

  onManualRejoinRequired(labelString) {
    const self = this;
    self.battleState = ALL_BATTLE_STATES.NONE; // Effectively stops "update(dt)" 
    self.showPopupInCanvas(self.gameRuleNode);
    self.popupSimplePressToGo(labelString, false);
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
    self.lastAllConfirmedInputFrameId = -1;
    self.lastUpsyncInputFrameId = -1;
    self.chaserRenderFrameId = -1; // at any moment, "chaserRenderFrameId <= renderFrameId", but "chaserRenderFrameId" would fluctuate according to "onInputFrameDownsyncBatch"

    self.recentRenderCache = new RingBuffer(self.renderCacheSize);

    self.selfPlayerInfo = null; // This field is kept for distinguishing "self" and "others".
    self.recentInputCache = new RingBuffer((self.renderCacheSize >> 1) + 1);

    const spaceW = self.stageDiscreteW * self.stageTileW;
    const spaceH = self.stageDiscreteH * self.stageTileH;
    self.spaceOffsetX = (spaceW >> 1);
    self.spaceOffsetY = (spaceH >> 1);
    self.gopkgsCollisionSys = gopkgs.NewCollisionSpaceJs(spaceW, spaceH, self.collisionMinStep, self.collisionMinStep);
    self.gopkgsCollisionSysMap = {}; // [WARNING] Don't use "JavaScript Map" which could cause loss of type information when passing through Golang transpiled functions!

    self.collisionBarrierIndexPrefix = (1 << 16); // For tracking the movements of barriers, though not yet actually used 
    self.collisionBulletIndexPrefix = (1 << 15); // For tracking the movements of bullets 

    console.log(`collisionSys & collisionSysMap reset`);

    self.transitToState(ALL_MAP_STATES.VISUAL);

    self.battleState = ALL_BATTLE_STATES.WAITING;

    self.othersForcedDownsyncRenderFrameDict = new Map();
    self.rdfIdToActuallyUsedInput = new Map();

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

    const mapNode = self.node;
    const canvasNode = mapNode.parent;
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

        if (self.showCriticalCoordinateLabels) {
          const drawer = new cc.Node();
          drawer.setPosition(cc.v2(0, 0))
          safelyAddChild(self.node, drawer);
          setLocalZOrder(drawer, 999);
          const g = drawer.addComponent(cc.Graphics);
          g.lineWidth = 2;
          self.g = g;
        }

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
          const gopkgsBoundaryAnchor = gopkgs.NewVec2DJs(boundaryObj.anchor.x, boundaryObj.anchor.y);
          const gopkgsBoundaryPts = Array.from(boundaryObj, p => {
            return gopkgs.NewVec2DJs(p.x, p.y);
          });
          const gopkgsBoundary = gopkgs.NewPolygon2DJs(gopkgsBoundaryAnchor, gopkgsBoundaryPts);
          const gopkgsBarrier = gopkgs.NewBarrierJs(gopkgsBoundary);

          const newBarrierCollider = gopkgs.GenerateConvexPolygonColliderJs(gopkgsBoundary, self.spaceOffsetX, self.spaceOffsetY, gopkgsBarrier, "Barrier");
          self.gopkgsCollisionSys.Add(newBarrierCollider);

          if (false && self.showCriticalCoordinateLabels) {
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
          // console.log("Created barrier: ", newBarrierCollider);
          ++barrierIdCounter;
          const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter);
          self.gopkgsCollisionSysMap[collisionBarrierIndex] = newBarrierCollider;
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

  onRoomDownsyncFrame(pbRdf /* pb.RoomDownsyncFrame */ , accompaniedInputFrameDownsyncBatch /* pb.InputFrameDownsyncBatch */ ) {
    const jsPlayersArr = new Array().fill(null);
    for (let k in pbRdf.playersArr) {
      const pbPlayer = pbRdf.playersArr[k];
      const jsPlayer = gopkgs.NewPlayerDownsyncJs(pbPlayer.id, pbPlayer.virtualGridX, pbPlayer.virtualGridY, pbPlayer.dirX, pbPlayer.dirY, pbPlayer.velX, pbPlayer.velY, pbPlayer.speed, pbPlayer.battleState, pbPlayer.characterState, pbPlayer.joinIndex, pbPlayer.hp, pbPlayer.maxHp, pbPlayer.inAir, pbPlayer.colliderRadius);
      jsPlayersArr[k] = jsPlayer;
    }
    const jsMeleeBulletsArr = [];
    for (let k in pbRdf.meleeBullets) {
      const pbBullet = pbRdf.meleeBullets[k];
      const jsBullet = gopkgs.NewMeleeBullet(pbBullet.battleLocalId, pbBullet.startupFrames, pbBullet.activeFrames, pbBullet.recoveryFrames, pbBullet.recoveryFramesOnBlock, pbBullet.recoveryFramesOnHit, pbBullet.hitStunFrames, pbBullet.blockStunFrames, pbBullet.releaseTriggerType, pbBullet.damage, pbBullet.offenderJoinIndex, pbBullet.offenderPlayerId, pbBullet.pushback, pbBullet.hitboxOffset, pbBullet.selfMoveforwardX, pbBullet.selfMoveforwardY, pbBullet.hitboxSizeX, pbBullet.hitboxSizeY);
      jsMeleeBulletsArr.push(jsBullet);
    }

    // This function is also applicable to "re-joining".
    const rdf = gopkgs.NewRoomDownsyncFrameJs(pbRdf.id, jsPlayersArr, jsMeleeBulletsArr);
    const self = window.mapIns;
    self.onInputFrameDownsyncBatch(accompaniedInputFrameDownsyncBatch); // Important to do this step before setting IN_BATTLE
    if (!self.recentRenderCache) {
      return;
    }
    if (ALL_BATTLE_STATES.IN_SETTLEMENT == self.battleState) {
      return;
    }
    const shouldForceDumping1 = (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.Id);
    let shouldForceDumping2 = (rdf.Id >= self.renderFrameId + self.renderFrameIdLagTolerance);
    let shouldForceResync = pbRdf.shouldForceResync;
    const notSelfUnconfirmed = (0 == (pbRdf.backendUnconfirmedMask & (1 << (self.selfPlayerInfo.joinIndex - 1))));
    if (notSelfUnconfirmed) {
      shouldForceDumping2 = false;
      shouldForceResync = false;
      self.othersForcedDownsyncRenderFrameDict.set(rdf.Id, rdf);
    }
    /*
    TODO
    
    If "BackendUnconfirmedMask" is non-all-1 and contains the current player, show a label/button to hint manual reconnection. Note that the continuity of "recentInputCache" is not a good indicator, because due to network delay upon a [type#1 forceConfirmation] a player might just lag in upsync networking and have all consecutive inputFrameIds locally. 
    */

    const [dumpRenderCacheRet, oldStRenderFrameId, oldEdRenderFrameId] = (shouldForceDumping1 || shouldForceDumping2 || shouldForceResync) ? self.recentRenderCache.setByFrameId(rdf, rdf.Id) : [window.RING_BUFF_CONSECUTIVE_SET, null, null];
    if (window.RING_BUFF_FAILED_TO_SET == dumpRenderCacheRet) {
      throw `Failed to dump render cache#1 (maybe recentRenderCache too small)! rdf.id=${rdf.id}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
    }
    if (!shouldForceResync && (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START < rdf.id && window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet)) {
      /*
      Don't change 
      - chaserRenderFrameId, it's updated only in "rollbackAndChase & onInputFrameDownsyncBatch" (except for when RING_BUFF_NON_CONSECUTIVE_SET)
      */
      return dumpRenderCacheRet;
    }

    // The logic below applies to (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.id || window.RING_BUFF_NON_CONSECUTIVE_SET == dumpRenderCacheRet)
    self._initPlayerRichInfoDict(rdf.PlayersArr);

    // Show the top status indicators for IN_BATTLE 
    if (self.playersInfoNode) {
      const playersInfoScriptIns = self.playersInfoNode.getComponent("PlayersInfo");
      for (let i in pbRdf.playersArr) {
        playersInfoScriptIns.updateData(pbRdf.playersArr[i]);
      }
    }

    if (shouldForceDumping1 || shouldForceDumping2 || shouldForceResync) {
      // In fact, not having "window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet" should already imply that "self.renderFrameId <= rdf.id", but here we double check and log the anomaly  

      if (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.Id) {
        console.log('On battle started! renderFrameId=', rdf.Id);
      } else {
        self.hideFindingPlayersGUI();
        console.warn('On battle resynced! renderFrameId=', rdf.Id);
      }
      self.renderFrameId = rdf.Id;
      self.lastRenderFrameIdTriggeredAt = performance.now();
      // In this case it must be true that "rdf.id > chaserRenderFrameId".
      self.chaserRenderFrameId = rdf.Id;

      const canvasNode = self.canvasNode;
      self.ctrl = canvasNode.getComponent("TouchEventsManager");
      self.enableInputControls();
      self.transitToState(ALL_MAP_STATES.VISUAL);
      self.battleState = ALL_BATTLE_STATES.IN_BATTLE;
    }

    if (self.countdownToBeginGameNode && self.countdownToBeginGameNode.parent) {
      self.countdownToBeginGameNode.parent.removeChild(self.countdownToBeginGameNode);
    }

    if (null != self.musicEffectManagerScriptIns) {
      self.musicEffectManagerScriptIns.playBGM();
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

  equalPlayers(lhs, rhs) {
    if (null == lhs || null == rhs) return false;
    if (lhs.virtualGridX != rhs.virtualGridX) return false;
    if (lhs.virtualGridY != rhs.virtualGridY) return false;
    if (lhs.dirX != rhs.dirX) return false;
    if (lhs.dirY != rhs.dirY) return false;
    if (lhs.velX != rhs.velX) return false;
    if (lhs.velY != rhs.velY) return false;
    if (lhs.speed != rhs.speed) return false;
    if (lhs.framesToRecover != rhs.framesToRecover) return false;
    if (lhs.hp != rhs.hp) return false;
    if (lhs.maxHp != rhs.maxHp) return false;
    if (lhs.characterState != rhs.characterState) return false;
    if (lhs.inAir != rhs.inAir) return false;
    return true;
  },

  equalMeleeBullets(lhs, rhs) {
    if (null == lhs || null == rhs) return false;
    if (lhs.battleLocalId != rhs.battleLocalId) return false;
    if (lhs.offenderPlayerId != rhs.offenderPlayerId) return false;
    if (lhs.offenderJoinIndex != rhs.offenderJoinIndex) return false;
    if (lhs.originatedRenderFrameId != rhs.originatedRenderFrameId) return false;
    return true;
  },

  equalRoomDownsyncFrames(lhs, rhs) {
    if (null == lhs || null == rhs) return false;
    for (let k in lhs.players) {
      if (!this.equalPlayers(lhs.players[k], rhs.players[k])) return false;
    }
    for (let k in lhs.meleeBullets) {
      if (!this.equalMeleeBullets(lhs.meleeBullets[k], rhs.meleeBullets[k])) return false;
    }
    return true;
  },

  onInputFrameDownsyncBatch(batch) {
    // TODO: find some kind of synchronization mechanism against "getOrPrefabInputFrameUpsync"!
    if (null == batch) {
      return;
    }
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
      if (inputFrameDownsyncId <= self.lastAllConfirmedInputFrameId) {
        continue;
      }
      // [WARNING] Take all "inputFrameDownsync" from backend as all-confirmed, it'll be later checked by "rollbackAndChase". 
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
      inputFrameDownsync.confirmedList = (1 << self.playerRichInfoDict.size) - 1;
      //console.log(`Confirmed inputFrameId=${inputFrameDownsync.inputFrameId}`);
      const [ret, oldStFrameId, oldEdFrameId] = self.recentInputCache.setByFrameId(inputFrameDownsync, inputFrameDownsync.inputFrameId);
      if (window.RING_BUFF_FAILED_TO_SET == ret) {
        throw `Failed to dump input cache (maybe recentInputCache too small)! inputFrameDownsync.inputFrameId=${inputFrameDownsync.inputFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
      }
    }

    if (null == firstPredictedYetIncorrectInputFrameId) return;
    const renderFrameId1 = self._convertToFirstUsedRenderFrameId(firstPredictedYetIncorrectInputFrameId, self.inputDelayFrames) - 1;
    if (renderFrameId1 >= self.chaserRenderFrameId) return;

    /*
    A typical case is as follows.
    --------------------------------------------------------
    <renderFrameId1>                           :              36


    <self.chaserRenderFrameId>                 :              62

    [self.renderFrameId]                       :              64
    --------------------------------------------------------
    */
    // The actual rollback-and-chase would later be executed in update(dt). 
    console.warn(`Mismatched input detected, resetting chaserRenderFrameId: ${self.chaserRenderFrameId}->${renderFrameId1} by firstPredictedYetIncorrectInputFrameId: ${firstPredictedYetIncorrectInputFrameId}
lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}
recentInputCache=${self._stringifyRecentInputCache(false)}
batchInputFrameIdRange=[${batch[0].inputFrameId}, ${batch[batch.length - 1].inputFrameId}]`);
    self.chaserRenderFrameId = renderFrameId1;
  },

  onPlayerAdded(rdf /* pb.RoomDownsyncFrame */ ) {
    const self = this;
    // Update the "finding player" GUI and show it if not previously present
    if (!self.findingPlayerNode.parent) {
      self.showPopupInCanvas(self.findingPlayerNode);
    }
    let findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
    findingPlayerScriptIns.updatePlayersInfo(rdf.playersArr);
  },

  onBattleStopped() {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE != self.battleState) {
      return;
    }
    self._stringifyRdfIdToActuallyUsedInput();
    window.closeWSConnection(constants.RET_CODE.BATTLE_STOPPED);
    self.battleState = ALL_BATTLE_STATES.IN_SETTLEMENT;
    self.countdownNanos = null;
    if (self.musicEffectManagerScriptIns) {
      self.musicEffectManagerScriptIns.stopAllMusic();
    }
    const canvasNode = self.canvasNode;
    const resultPanelNode = self.resultPanelNode;
    const resultPanelScriptIns = resultPanelNode.getComponent("ResultPanel");
    resultPanelScriptIns.showPlayerInfo(self.playerRichInfoDict);
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
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
      playerScriptIns.setSpecies("UltramanTiga");
    }

    const [wx, wy] = self.virtualGridToWorldPos(vx, vy);
    newPlayerNode.setPosition(wx, wy);
    playerScriptIns.mapNode = self.node;
    const colliderRadius = playerDownsyncInfo.colliderRadius || playerDownsyncInfo.ColliderRadius;
    const halfColliderWidth = colliderRadius,
      halfColliderHeight = colliderRadius + colliderRadius; // avoid multiplying
    const colliderWidth = halfColliderWidth + halfColliderWidth,
      colliderHeight = halfColliderHeight + halfColliderHeight; // avoid multiplying

    const [cx, cy] = gopkgs.WorldToPolygonColliderBLPos(wx, wy, halfColliderWidth, halfColliderHeight, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.spaceOffsetX, self.spaceOffsetY);
    const gopkgsBoundaryAnchor = gopkgs.NewVec2DJs(cx, cy);
    const gopkgsBoundaryPts = [
      gopkgs.NewVec2DJs(0, 0),
      gopkgs.NewVec2DJs(self.snapIntoPlatformOverlap + colliderWidth + self.snapIntoPlatformOverlap, 0),
      gopkgs.NewVec2DJs(self.snapIntoPlatformOverlap + colliderWidth + self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap + colliderHeight + self.snapIntoPlatformOverlap),
      gopkgs.NewVec2DJs(0, self.snapIntoPlatformOverlap + colliderHeight + self.snapIntoPlatformOverlap)
    ];
    const gopkgsBoundary = gopkgs.NewPolygon2DJs(gopkgsBoundaryAnchor, gopkgsBoundaryPts);
    const newPlayerCollider = gopkgs.GenerateConvexPolygonColliderJs(gopkgsBoundary, self.spaceOffsetX, self.spaceOffsetY, playerDownsyncInfo, "Player");
    //const newPlayerCollider = gopkgs.GenerateRectColliderJs(wx, wy, colliderWidth, colliderHeight, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.spaceOffsetX, self.spaceOffsetY, playerDownsyncInfo, "Player");
    self.gopkgsCollisionSys.Add(newPlayerCollider);
    const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
    self.gopkgsCollisionSysMap[collisionPlayerIndex] = newPlayerCollider;

    console.log(`Created new player collider: joinIndex=${joinIndex}, colliderRadius=${playerDownsyncInfo.ColliderRadius}`);

    safelyAddChild(self.node, newPlayerNode);
    setLocalZOrder(newPlayerNode, 5);

    newPlayerNode.active = true;
    playerDownsyncInfo.characterState = playerDownsyncInfo.CharacterState;
    playerDownsyncInfo.dirX = playerDownsyncInfo.DirX;
    playerDownsyncInfo.dirY = playerDownsyncInfo.DirY;
    playerDownsyncInfo.framesToRecover = playerDownsyncInfo.FrameToRecover;
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
          [prevSelfInput, currSelfInput] = self.getOrPrefabInputFrameUpsync(noDelayInputFrameId);
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
        if (prevChaserRenderFrameId < nextChaserRenderFrameId) {
          // Do not execute "rollbackAndChase" when "prevChaserRenderFrameId == nextChaserRenderFrameId", otherwise if "nextChaserRenderFrameId == self.renderFrameId" we'd be wasting computing power once. 
          self.rollbackAndChase(prevChaserRenderFrameId, nextChaserRenderFrameId, self.gopkgsCollisionSys, self.gopkgsCollisionSysMap, true);
        }
        let t2 = performance.now();

        // Inside the following "self.rollbackAndChase" actually ROLLS FORWARD w.r.t. the corresponding delayedInputFrame, REGARDLESS OF whether or not "self.chaserRenderFrameId == self.renderFrameId" now. 
        const latestRdfResults = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.gopkgsCollisionSys, self.gopkgsCollisionSysMap, false);
        let prevRdf = latestRdfResults[0],
          rdf = latestRdfResults[1];
        /*
        const nonTrivialChaseEnded = (prevChaserRenderFrameId < nextChaserRenderFrameId && nextChaserRenderFrameId == self.renderFrameId); 
        if (nonTrivialChaseEnded) {
            console.debug("Non-trivial chase ended, prevChaserRenderFrameId=" + prevChaserRenderFrameId + ", nextChaserRenderFrameId=" + nextChaserRenderFrameId);
        }  
        */
        // [WARNING] Don't try to get "prevRdf(i.e. renderFrameId == latest-1)" by "self.recentRenderCache.getByFrameId(...)" here, as the cache might have been updated by asynchronous "onRoomDownsyncFrame(...)" calls!
        if (self.othersForcedDownsyncRenderFrameDict.has(rdf.id)) {
          const delayedInputFrameId = self._convertToInputFrameId(rdf.id, 0);
          const othersForcedDownsyncRenderFrame = self.othersForcedDownsyncRenderFrameDict.get(rdf.id);
          if (self.lastAllConfirmedInputFrameId >= delayedInputFrameId && !self.equalRoomDownsyncFrames(othersForcedDownsyncRenderFrame, rdf)) {
            console.warn(`Mismatched render frame@rdf.id=${rdf.id} w/ inputFrameId=${delayedInputFrameId}:
rdf=${JSON.stringify(rdf)}
othersForcedDownsyncRenderFrame=${JSON.stringify(othersForcedDownsyncRenderFrame)}
${self._stringifyRdfIdToActuallyUsedInput()}`);
            // closeWSConnection(constants.RET_CODE.CLIENT_MISMATCHED_RENDER_FRAME, "");
            // self.onManualRejoinRequired("[DEBUG] CLIENT_MISMATCHED_RENDER_FRAME");
            rdf = othersForcedDownsyncRenderFrame;
            self.othersForcedDownsyncRenderFrameDict.delete(rdf.id);
          }
        }
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
    toShowNode.active = true;
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

  onBattleReadyToStart(rdf /* pb.RoomDownsyncFrame */ ) {
    const self = this;
    const players = rdf.playersArr;

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
    const playersArr = rdf.PlayersArr;
    for (let k in playersArr) {
      const currPlayerDownsync = playersArr[k];
      const prevRdfPlayer = (null == prevRdf ? null : prevRdf.PlayersArr[k]);
      const [wx, wy] = self.virtualGridToWorldPos(currPlayerDownsync.VirtualGridX, currPlayerDownsync.VirtualGridY);
      const playerRichInfo = self.playerRichInfoArr[k];
      playerRichInfo.node.setPosition(wx, wy);
      playerRichInfo.scriptIns.updateSpeed(currPlayerDownsync.Speed);
      currPlayerDownsync.characterState = currPlayerDownsync.CharacterState;
      currPlayerDownsync.dirX = currPlayerDownsync.DirX;
      currPlayerDownsync.dirY = currPlayerDownsync.DirY;
      currPlayerDownsync.framesToRecover = currPlayerDownsync.FrameToRecover;
      playerRichInfo.scriptIns.updateCharacterAnim(currPlayerDownsync, prevRdfPlayer, false);
    }

    // Update countdown
    self.countdownNanos = self.battleDurationNanos - self.renderFrameId * self.rollbackEstimatedDtNanos;
    if (self.countdownNanos <= 0) {
      self.onBattleStopped(self.playerRichInfoDict);
    }
  },

  getCachedInputFrameDownsyncWithPrediction(inputFrameId) {
    const self = this;
    const inputFrameDownsync = self.recentInputCache.getByFrameId(inputFrameId);
    if (null != inputFrameDownsync && inputFrameId > self.lastAllConfirmedInputFrameId) {
      const lastAllConfirmedInputFrame = self.recentInputCache.getByFrameId(self.lastAllConfirmedInputFrameId);
      if (null != lastAllConfirmedInputFrame) {
        for (let i = 0; i < inputFrameDownsync.inputList.length; ++i) {
          if (i == (self.selfPlayerInfo.joinIndex - 1)) continue;
          inputFrameDownsync.inputList[i] = (lastAllConfirmedInputFrame.inputList[i] & 15); // Don't predict attack input!
        }
      }
    }

    return inputFrameDownsync;
  },

  rollbackAndChase(renderFrameIdSt, renderFrameIdEd, collisionSys, collisionSysMap, isChasing) {
    const self = this;
    let prevLatestRdf = null,
      latestRdf = null;
    for (let i = renderFrameIdSt; i < renderFrameIdEd; i++) {
      const currRdf = self.recentRenderCache.getByFrameId(i); // typed "RoomDownsyncFrame"; [WARNING] When "true == isChasing" and using Firefox, this function could be interruptted by "onRoomDownsyncFrame(rdf)" asynchronously anytime, making this line return "null"!
      if (null == currRdf) {
        throw `Couldn't find renderFrame for i=${i} to rollback (are you using Firefox?), self.renderFrameId=${self.renderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, might've been interruptted by onRoomDownsyncFrame`;
      }
      const j = self._convertToInputFrameId(i, self.inputDelayFrames);
      const delayedInputFrame = self.recentInputCache.getByFrameId(j); // Don't make prediction here, the inputFrameDownsyncs in recentInputCache was already predicted while prefabbing
      if (null == delayedInputFrame) {
        // Shouldn't happen!
        throw `Failed to get cached delayedInputFrame for i=${i}, j=${j}, renderFrameId=${self.renderFrameId}, lastUpsyncInputFrameId=${self.lastUpsyncInputFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, chaserRenderFrameId=${self.chaserRenderFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
      }

      const jPrev = self._convertToInputFrameId(i - 1, self.inputDelayFrames);
      const delayedInputFrameForPrevRenderFrame = self.recentInputCache.getByFrameId(jPrev);
      const actuallyUsedInputClone = delayedInputFrame.inputList.slice();
      const inputFrameDownsyncClone = {
        inputFrameId: delayedInputFrame.inputFrameId,
        inputList: actuallyUsedInputClone,
        confirmedList: delayedInputFrame.confirmedList,
      };
      self.rdfIdToActuallyUsedInput.set(currRdf.Id, inputFrameDownsyncClone);
      const nextRdf = gopkgs.ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(delayedInputFrame.inputList, (null == delayedInputFrameForPrevRenderFrame ? null : delayedInputFrameForPrevRenderFrame.inputList), currRdf, collisionSys, collisionSysMap, self.gravityX, self.gravityY, self.jumpingInitVelY, self.inputDelayFrames, self.inputScaleFrames, self.spaceOffsetX, self.spaceOffsetY, self.snapIntoPlatformOverlap, self.snapIntoPlatformThreshold, self.worldToVirtualGridRatio, self.virtualGridToWorldRatio);

      if (true == isChasing) {
        // [WARNING] Move the cursor "self.chaserRenderFrameId" when "true == isChasing", keep in mind that "self.chaserRenderFrameId" is not monotonic!
        self.chaserRenderFrameId = nextRdf.Id;
      } else if (nextRdf.Id == self.chaserRenderFrameId + 1) {
        self.chaserRenderFrameId = nextRdf.Id; // To avoid redundant calculation 
      }
      self.recentRenderCache.setByFrameId(nextRdf, nextRdf.Id);
      prevLatestRdf = currRdf;
      latestRdf = nextRdf;
    }

    return [prevLatestRdf, latestRdf];
  },

  _initPlayerRichInfoDict(playersArr) {
    const self = this;
    for (let k in playersArr) {
      const immediatePlayerInfo = playersArr[k];
      const playerId = immediatePlayerInfo.id || immediatePlayerInfo.Id;
      if (self.playerRichInfoDict.has(playerId)) continue; // Skip already put keys
      self.playerRichInfoDict.set(playerId, immediatePlayerInfo);
      const joinIndex = immediatePlayerInfo.joinIndex || immediatePlayerInfo.JoinIndex;
      const vx = immediatePlayerInfo.virtualGridX || immediatePlayerInfo.VirtualGridX;
      const vy = immediatePlayerInfo.virtualGridY || immediatePlayerInfo.VirtualGridY;
      const nodeAndScriptIns = self.spawnPlayerNode(joinIndex, vx, vy, immediatePlayerInfo);

      Object.assign(self.playerRichInfoDict.get(playerId), {
        node: nodeAndScriptIns[0],
        scriptIns: nodeAndScriptIns[1],
      });

      const selfPlayerId = self.selfPlayerInfo.id || self.selfPlayerInfo.Id;
      if (selfPlayerId == playerId) {
        self.selfPlayerInfo.joinIndex = immediatePlayerInfo.joinIndex || immediatePlayerInfo.JoinIndex;
        nodeAndScriptIns[1].showArrowTipNode();
      }
    }
    self.playerRichInfoArr = new Array(self.playerRichInfoDict.size);
    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      self.playerRichInfoArr[playerRichInfo.JoinIndex - 1] = playerRichInfo;
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

  _stringifyGopkgRoomDownsyncFrame(rdf) {
    let s = [];
    s.push(`{`);
    s.push(`  id: ${rdf.Id}`);
    s.push(`  players: [`);
    for (let k in rdf.PlayersArr) {
      const player = rdf.PlayersArr[k];
      s.push(`    {joinIndex: ${player.JoinIndex}, id: ${player.Id}, vx: ${player.VirtualGridX}, vy: ${player.VirtualGridY}, velX: ${player.VelX}, velY: ${player.VelY}}`);
    }
    s.push(`  ]`);
    s.push(`}`);
    return s.join("\n");
  },

  _stringifyRecentRenderCache(usefullOutput) {
    const self = this;
    if (true == usefullOutput) {
      let s = [];
      for (let i = self.recentRenderCache.stFrameId; i < self.recentRenderCache.edFrameId; ++i) {
        const rdf = self.recentRenderCache.getByFrameId(i);
        s.push(self._stringifyGopkgRoomDownsyncFrame(rdf));
      }

      return s.join("\n");
    }
    return `[stRenderFrameId=${self.recentRenderCache.stFrameId}, edRenderFrameId=${self.recentRenderCache.edFrameId})`;
  },

  playerDownsyncStr(playerDownsync) {
    if (null == playerDownsync) return "";
    return `{${playerDownsync.JoinIndex},${playerDownsync.VirtualGridX},${playerDownsync.VirtualGridY},${playerDownsync.VelX},${playerDownsync.VelY},${playerDownsync.InAir ? 1 : 0}}`;
  },

  inputFrameDownsyncStr(inputFrameDownsync) {
    if (null == inputFrameDownsync) return "";
    const self = this;
    let s = [];
    s.push(`InputFrameId:${inputFrameDownsync.inputFrameId}`);
    let ss = [];
    for (let k in inputFrameDownsync.inputList) {
      ss.push(`"${inputFrameDownsync.inputList[k]}"`);
    }
    s.push(`InputList:[${ss.join(',')}]`);
    // The "confirmedList" is not worth comparing, because frontend might actually use a non-all-confirmed inputFrame during its history, as long as it's correctly predicted.
    //s.push(`ConfirmedList:${inputFrameDownsync.confirmedList}`); 

    return s.join(',');
  },

  _stringifyRdfIdToActuallyUsedInput() {
    const self = this;
    let s = [];
    for (let i = self.recentRenderCache.stFrameId; i < self.recentRenderCache.edFrameId; i++) {
      const actuallyUsedInputClone = self.rdfIdToActuallyUsedInput.get(i);
      const rdf = self.recentRenderCache.getByFrameId(i);
      const playersStrBldr = [];
      for (let k in rdf.PlayersArr) {
        playersStrBldr.push(self.playerDownsyncStr(rdf.PlayersArr[k]));
      }
      s.push(`rdfId:${i}
players:[${playersStrBldr.join(',')}]
actuallyUsedinputList:{${self.inputFrameDownsyncStr(actuallyUsedInputClone)}}`);
    }

    return s.join('\n');
  },

  stringifyColliderCenterInWorld(playerCollider, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding) {
    return `{${(playerCollider.x + leftPadding + halfBoundingW).toFixed(2)}, ${(playerCollider.y + bottomPadding + halfBoundingH).toFixed(2)}}`;
  },

  virtualGridToWorldPos(vx, vy) {
    // No loss of precision
    const self = this;
    return [vx * self.virtualGridToWorldRatio, vy * self.virtualGridToWorldRatio];
  },

  showDebugBoundaries(rdf) {
    const self = this;
    const leftPadding = self.snapIntoPlatformOverlap,
      rightPadding = self.snapIntoPlatformOverlap,
      topPadding = self.snapIntoPlatformOverlap,
      bottomPadding = self.snapIntoPlatformOverlap;
    if (self.showCriticalCoordinateLabels) {
      let g = self.g;
      g.clear();

      const collisionSpaceObjs = gopkgs.GetCollisionSpaceObjsJs(self.gopkgsCollisionSys);
      for (let k in collisionSpaceObjs) {
        const body = collisionSpaceObjs[k];
        let padding = 0;
        if (null != body.Data && null != body.Data.JoinIndex) {
          // character
          if (1 == body.Data.JoinIndex) {
            g.strokeColor = cc.Color.BLUE;
          } else {
            g.strokeColor = cc.Color.RED;
          }
          padding = self.snapIntoPlatformOverlap;
        } else {
          // barrier
          g.strokeColor = cc.Color.WHITE;
        }
        const points = body.Shape.Points;
        const wpos = [body.X - self.spaceOffsetX, body.Y - self.spaceOffsetY];
        g.moveTo(wpos[0], wpos[1]);
        const cnt = points.length;
        for (let j = 0; j < cnt; j += 1) {
          const x = wpos[0] + points[j][0],
            y = wpos[1] + points[j][1];
          g.lineTo(x, y);
        }
        g.lineTo(wpos[0], wpos[1]);
        g.stroke();
      }
    }
  },
});
