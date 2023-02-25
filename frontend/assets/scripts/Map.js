const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const RingBuffer = require('./RingBuffer');
const NetworkDoctor = require('./NetworkDoctor');
const PriorityQueue = require("./PriorityQueue");

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

window.onUdpMessage = (args) => {
  const self = window.mapIns;
  const ui8Arr = args;
  //cc.log(`#1 Js called back by CPP: onUdpMessage: args=${args}, typeof(args)=${typeof (args)}, argslen=${args.length}, ui8Arr=${ui8Arr}`);
  const req = window.pb.protos.WsReq.decode(ui8Arr);
  if (req) {
    //cc.log(`#2 Js called back by CPP for upsync: onUdpMessage: ${JSON.stringify(req)}`);
    if (req.act && window.UPSYNC_MSG_ACT_PLAYER_CMD == req.act) {
      let effCnt = 0;
      const peerJoinIndex = req.joinIndex;
      if (peerJoinIndex == self.selfPlayerInfo.joinIndex) return;
      const batch = req.inputFrameUpsyncBatch;
      self.onPeerInputFrameUpsync(peerJoinIndex, batch, true);
    }
  }
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
    fireballPrefab: {
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
    forceBigEndianFloatingNumDecoding: {
      default: false,
    },
    renderFrameIdLagTolerance: {
      type: cc.Integer,
      default: 4 // implies (renderFrameIdLagTolerance >> inputScaleFrames) count of inputFrameIds
    },
    inputFrameFrontLabel: {
      type: cc.Label,
      default: null
    },
    sendingQLabel: {
      type: cc.Label,
      default: null
    },
    inputFrameDownsyncQLabel: {
      type: cc.Label,
      default: null
    },
    peerInputFrameUpsyncQLabel: {
      type: cc.Label,
      default: null
    },
    rollbackFramesLabel: {
      type: cc.Label,
      default: null
    },
    skippedRenderFrameCntLabel: {
      type: cc.Label,
      default: null
    }
  },

  _inputFrameIdDebuggable(inputFrameId) {
    return (0 == inputFrameId % 10);
  },

  _allConfirmed(confirmedList) {
    return (confirmedList + 1) == (1 << this.playerRichInfoDict.size);
  },

  getOrPrefabInputFrameUpsync(inputFrameId, canConfirmSelf) {
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
    const joinIndex = self.selfPlayerInfo.joinIndex;
    const selfJoinIndexMask = (1 << (joinIndex - 1));
    const existingInputFrame = gopkgs.GetInputFrameDownsync(self.recentInputCache, inputFrameId);
    const previousInputFrameDownsync = gopkgs.GetInputFrameDownsync(self.recentInputCache, (inputFrameId - 1));
    previousSelfInput = (null == previousInputFrameDownsync ? null : gopkgs.GetInput(previousInputFrameDownsync, joinIndex - 1));
    if (
      null != existingInputFrame
      &&
      (true != canConfirmSelf)
    ) {
      // This could happen upon either [type#1] or [type#2] forceConfirmation, where "refRenderFrame" is accompanied by some "inputFrameDownsyncs". The check here also guarantees that we don't override history 
      //console.log(`noDelayInputFrameId=${inputFrameId} already exists in recentInputCache: recentInputCache=${self._stringifyRecentInputCache(false)}`);
      return [previousSelfInput, gopkgs.GetInput(existingInputFrame, joinIndex - 1)];
    }

    const prefabbedInputList = new Array(self.playerRichInfoDict.size).fill(0);
    // the returned "gopkgs.NewInputFrameDownsync.InputList" is immutable, thus we can only modify the values in "prefabbedInputList"
    for (let k = 0; k < window.boundRoomCapacity; ++k) {
      if (null != existingInputFrame) {
        // When "null != existingInputFrame", it implies that "true == canConfirmSelf" here, we just have to assign "prefabbedInputList[(joinIndex-1)]" specifically and copy all others
        prefabbedInputList[k] = gopkgs.GetInput(existingInputFrame, k);
      } else if (self.lastIndividuallyConfirmedInputFrameId[k] <= inputFrameId) {
        prefabbedInputList[k] = self.lastIndividuallyConfirmedInputList[k];
        // Don't predict "btnA & btnB"!
        prefabbedInputList[k] = (prefabbedInputList[k] & 15);
      } else if (null != previousInputFrameDownsync) {
        // When "self.lastIndividuallyConfirmedInputFrameId[k] > inputFrameId", don't use it to predict a historical input!
        prefabbedInputList[k] = gopkgs.GetInput(previousInputFrameDownsync, k);
        // Don't predict "btnA & btnB"!
        prefabbedInputList[k] = (prefabbedInputList[k] & 15);
      }
    }

    // [WARNING] Do not blindly use "selfJoinIndexMask" here, as the "actuallyUsedInput for self" couldn't be confirmed while prefabbing, otherwise we'd have confirmed a wrong self input by "_markConfirmationIfApplicable()"!
    let initConfirmedList = 0;
    if (null != existingInputFrame) {
      // When "null != existingInputFrame", it implies that "true == canConfirmSelf" here
      initConfirmedList = (existingInputFrame.GetConfirmedList() | selfJoinIndexMask);
    }
    currSelfInput = self.ctrl.getEncodedInput(); // When "null == existingInputFrame", it'd be safe to say that the realtime "self.ctrl.getEncodedInput()" is for the requested "inputFrameId"
    prefabbedInputList[(joinIndex - 1)] = currSelfInput;
    while (self.recentInputCache.GetEdFrameId() <= inputFrameId) {
      // Fill the gap
      const gapInputFrameId = self.recentInputCache.GetEdFrameId();
      self.recentInputCache.DryPut();
      let ifdHolder = gopkgs.GetInputFrameDownsync(self.recentInputCache, gapInputFrameId);
      if (null == ifdHolder) {
        // Lazy heap alloc, calling "gopkgs.NewInputFrameDownsync" would trigger not only heap alloc but also "gopherjs $externalize", neither is efficient T_T 
        const prefabbedInputFrameDownsync = gopkgs.NewInputFrameDownsync(gapInputFrameId, prefabbedInputList, initConfirmedList);
        // console.log(`Prefabbed inputFrameId=${prefabbedInputFrameDownsync.GetInputFrameId()}`);
        self.recentInputCache.SetByFrameId(prefabbedInputFrameDownsync, gapInputFrameId);
      } else {
        gopkgs.SetInputFrameId(ifdHolder, gapInputFrameId);
        for (let k = 0; k < window.boundRoomCapacity; ++k) {
          gopkgs.SetInput(ifdHolder, k, prefabbedInputList[k]);
        }
        gopkgs.SetConfirmedList(ifdHolder, initConfirmedList);
      }
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
    if (batchInputFrameIdSt < self.recentInputCache.GetStFrameId()) {
      // Upon resync, "self.lastUpsyncInputFrameId" might not have been updated properly.
      batchInputFrameIdSt = self.recentInputCache.GetStFrameId();
    }
    self.networkDoctor.logSending(batchInputFrameIdSt, latestLocalInputFrameId);
    for (let i = batchInputFrameIdSt; i <= latestLocalInputFrameId; ++i) {
      const inputFrameDownsync = self.recentInputCache.GetByFrameId(i);
      if (null == inputFrameDownsync) {
        console.error(`sendInputFrameUpsyncBatch: recentInputCache is NOT having inputFrameId=i: latestLocalInputFrameId=${latestLocalInputFrameId}, recentInputCache=${self._stringifyRecentInputCache(false)}`);
      } else {
        const inputFrameUpsync = {
          inputFrameId: i,
          encoded: inputFrameDownsync.InputList[self.selfPlayerInfo.joinIndex - 1],
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
      authKey: self.selfPlayerInfo.udpTunnelAuthKey,
    }).finish();
    if (cc.sys.isNative) {
      DelayNoMore.UdpSession.broadcastInputFrameUpsync(reqData, window.boundRoomCapacity, self.selfPlayerInfo.joinIndex);
    }
    window.sendSafely(reqData);
    self.lastUpsyncInputFrameId = latestLocalInputFrameId;
    if (self.lastUpsyncInputFrameId >= self.recentInputCache.GetEdFrameId()) {
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

  popupSimplePressToGo(labelString, hideYesButton, additionalOnDismissalCb) {
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
      if (additionalOnDismissalCb) {
        additionalOnDismissalCb();
      }
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
        if (playerRichInfo.node && playerRichInfo.node.parent) {
          playerRichInfo.node.parent.removeChild(playerRichInfo.node);
        }
      });
    }
    self.playerRichInfoDict = new Map();
    // Clearing previous info of all players. [ENDS]

    // Clearing cached fireball rendering nodes [BEGINS]
    if (null != self.cachedFireballs) {
      while (!self.cachedFireballs.isEmpty()) {
        const v = self.cachedFireballs.pop();
        if (v && v.node && v.node.parent) {
          v.node.parent.removeChild(v.node);
        }
      }
    } else {
      self.cachedFireballs = new PriorityQueue();
    }
    for (let k = 0; k < 1000; k++) {
      const newFireballNode = cc.instantiate(self.fireballPrefab);
      const newFireball = newFireballNode.getComponent("Fireball");
      newFireballNode.setPosition(cc.v2(Number.MAX_VALUE, Number.MAX_VALUE));
      safelyAddChild(self.node, newFireballNode);
      setLocalZOrder(newFireballNode, 10);
      newFireball.lastUsed = -1;
      newFireball.bulletLocalId = -1;
      const initLookupKey = -(k + 1); // there's definitely no suck "bulletLocalId"
      self.cachedFireballs.push(newFireball.lastUsed, newFireball, initLookupKey);
    }
    // Clearing cached fireball rendering nodes [ENDS]

    self.renderFrameId = 0; // After battle started
    self.bulletBattleLocalIdCounter = 0;
    self.lastAllConfirmedInputFrameId = -1;
    self.lastUpsyncInputFrameId = -1;
    self.chaserRenderFrameId = -1; // at any moment, "chaserRenderFrameId <= renderFrameId", but "chaserRenderFrameId" would fluctuate according to "onInputFrameDownsyncBatch"

    self.lastIndividuallyConfirmedInputFrameId = new Array(window.boundRoomCapacity).fill(-1);
    self.lastIndividuallyConfirmedInputList = new Array(window.boundRoomCapacity).fill(0);

    self.collisionHolder = gopkgs.NewCollisionHolder();
    // [WARNING] For "effPushbacks", "hardPushbackNormsArr" and "jumpedOrNotList", use array literal instead of "new Array" for compliance when passing into "gopkgs.ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs"!
    self.effPushbacks = [];
    for (let i = 0; i < window.boundRoomCapacity; i++) self.effPushbacks.push(gopkgs.NewVec2DJs(0, 0));
    self.hardPushbackNormsArr = [];
    for (let i = 0; i < window.boundRoomCapacity; i++) {
      const single = [];
      for (let j = 0; j < 5; j++) {
        single.push(gopkgs.NewVec2DJs(0, 0));
      }
      self.hardPushbackNormsArr.push(single);
    }
    self.jumpedOrNotList = [];
    for (let i = 0; i < window.boundRoomCapacity; i++) self.jumpedOrNotList.push(false);
    self.dynamicRectangleColliders = gopkgs.NewDynamicRectangleColliders(64);

    self.recentRenderCache = gopkgs.NewRingBufferJs(self.renderCacheSize);

    self.recentInputCache = gopkgs.NewRingBufferJs((self.renderCacheSize >> 1) + 1);

    self.gopkgsCollisionSys = gopkgs.NewCollisionSpaceJs((self.spaceOffsetX << 1), (self.spaceOffsetY << 1), self.collisionMinStep, self.collisionMinStep);
    self.gopkgsCollisionSysMap = {}; // [WARNING] Don't use "JavaScript Map" which could cause loss of type information when passing through Golang transpiled functions!

    self.collisionBarrierIndexPrefix = (1 << 16); // For tracking the movements of barriers, though not yet actually used 
    self.collisionBulletIndexPrefix = (1 << 15); // For tracking the movements of bullets 

    console.log(`collisionSys & collisionSysMap reset`);

    self.transitToState(ALL_MAP_STATES.VISUAL);

    self.battleState = ALL_BATTLE_STATES.WAITING;

    self.othersForcedDownsyncRenderFrameDict = new Map();
    self.rdfIdToActuallyUsedInput = new Map();

    self.networkDoctor = new NetworkDoctor(20);
    self.allowSkippingRenderFrameFlag = true;
    self.skipRenderFrameFlag = false;

    self.allowRollbackOnPeerUpsync = true;

    self.countdownNanos = null;
  },

  initDebugDrawers() {
    const self = this;
    if (self.showCriticalCoordinateLabels) {
      const drawer1 = new cc.Node();
      drawer1.setPosition(cc.v2(0, 0))
      safelyAddChild(self.node, drawer1);
      setLocalZOrder(drawer1, 999);
      const g1 = drawer1.addComponent(cc.Graphics);
      g1.lineWidth = 2;
      self.g1 = g1;

      const collisionSpaceObjs = gopkgs.GetCollisionSpaceObjsJs(self.gopkgsCollisionSys); // This step is slow according to Chrome profiling, and we only need draw it once for those static barriers
      for (let k in collisionSpaceObjs) {
        const body = collisionSpaceObjs[k];
        let padding = 0;
        if (null != body.GetData() && null != body.GetData().GetJoinIndex) {
          // character
          if (1 == body.GetData().GetJoinIndex()) {
            g1.strokeColor = cc.Color.BLUE;
          } else {
            g1.strokeColor = cc.Color.RED;
          }
          padding = self.snapIntoPlatformOverlap;
        } else {
          // barrier
          g1.strokeColor = cc.Color.WHITE;
        }
        const points = body.GetShape().Points;
        const [bodyX, bodyY] = body.Position();
        const wpos = [bodyX - self.spaceOffsetX, bodyY - self.spaceOffsetY];
        g1.moveTo(wpos[0], wpos[1]);
        const cnt = points.length;
        for (let j = 0; j < cnt; j += 1) {
          const x = wpos[0] + points[j][0],
            y = wpos[1] + points[j][1];
          g1.lineTo(x, y);
        }
        g1.lineTo(wpos[0], wpos[1]);
        g1.stroke();
      }

      const drawer2 = new cc.Node();
      drawer2.setPosition(cc.v2(0, 0))
      safelyAddChild(self.node, drawer2);
      setLocalZOrder(drawer2, 999);
      const g2 = drawer2.addComponent(cc.Graphics);
      g2.lineWidth = 2;
      self.g2 = g2;
    }
  },

  onLoad() {
    cc.game.setFrameRate(59.9);
    cc.view.setOrientation(cc.macro.ORIENTATION_LANDSCAPE);
    cc.view.enableAutoFullScreen(true);

    const self = this;
    window.mapIns = self;
    window.forceBigEndianFloatingNumDecoding = self.forceBigEndianFloatingNumDecoding;

    self.showCriticalCoordinateLabels = false;
    self.showNetworkDoctorInfo = true;

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
    findingPlayerScriptIns.init(self);

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
      self.inputFrameUpsyncDelayTolerance = parsedBattleColliderInfo.inputFrameUpsyncDelayTolerance;

      const tiledMapIns = self.node.getComponent(cc.TiledMap);

      // It's easier to just use the "barrier"s extracted by the backend (all anchor points in world coordinates), but I'd like to verify frontend tmx parser logic as well.
      const fullPathOfTmxFile = cc.js.formatStr("map/%s/map", parsedBattleColliderInfo.stageName);
      cc.loader.loadRes(fullPathOfTmxFile, cc.TiledMapAsset, (err, tmxAsset) => {
        if (null != err) {
          console.error(`Error occurred when loading tiled stage ${parsedBattleColliderInfo.stageName}`, err);
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
        if (self.countdownLabel) {
          self.countdownLabel.string = "";
        }
        self.hideGameRuleNode();
        self.showFindingPlayerGUI(null);

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

          ++barrierIdCounter;
          const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter);
          self.gopkgsCollisionSysMap[collisionBarrierIndex] = newBarrierCollider;
        }
        self.initDebugDrawers();
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
    //self.gameRuleNode.active = false;
    self.gameRuleNode.setPosition(cc.v2(Number.MAX_VALUE, Number.MAX_VALUE));
  },

  enableInputControls() {
    this._inputControlEnabled = true;
  },

  disableInputControls() {
    this._inputControlEnabled = false;
  },

  onRoomDownsyncFrame(pbRdf /* pb.RoomDownsyncFrame */ , accompaniedInputFrameDownsyncBatch /* pb.InputFrameDownsyncBatch */ ) {
    const jsPlayersArr = new Array(pbRdf.playersArr.length).fill(null);
    for (let k = 0; k < pbRdf.playersArr.length; ++k) {
      const pbPlayer = pbRdf.playersArr[k];
      const jsPlayer = gopkgs.NewPlayerDownsyncJs(pbPlayer.id, pbPlayer.virtualGridX, pbPlayer.virtualGridY, pbPlayer.dirX, pbPlayer.dirY, pbPlayer.velX, pbPlayer.velY, pbPlayer.framesToRecover, pbPlayer.framesInChState, pbPlayer.activeSkillId, pbPlayer.activeSkillHit, pbPlayer.framesInvinsible, pbPlayer.speed, pbPlayer.battleState, pbPlayer.characterState, pbPlayer.joinIndex, pbPlayer.hp, pbPlayer.maxHp, pbPlayer.colliderRadius, pbPlayer.inAir, pbPlayer.onWall, pbPlayer.onWallNormX, pbPlayer.onWallNormY, pbPlayer.capturedByInertia, pbPlayer.bulletTeamId, pbPlayer.chCollisionTeamId, pbPlayer.revivalVirtualGridX, pbPlayer.revivalVirtualGridY);
      jsPlayersArr[k] = jsPlayer;
    }
    const jsMeleeBulletsArr = new Array(pbRdf.meleeBullets.length).fill(null);
    for (let k = 0; k < pbRdf.meleeBullets.length; ++k) {
      const pbBullet = pbRdf.meleeBullets[k];
      const jsMeleeBullet = gopkgs.NewMeleeBulletJs(pbBullet.bulletLocalId, pbBullet.originatedRenderFrameId, pbBullet.offenderJoinIndex, pbBullet.startupFrames, pbBullet.cancellableStFrame, pbBullet.cancellableEdFrame, pbBullet.activeFrames, pbBullet.hitStunFrames, pbBullet.blockStunFrames, pbBullet.pushbackVelX, pbBullet.pushbackVelY, pbBullet.damage, pbBullet.selfLockVelX, pbBullet.selfLockVelY, pbBullet.hitboxOffsetX, pbBullet.hitboxOffsetY, pbBullet.hitboxSizeX, pbBullet.hitboxSizeY, pbBullet.blowUp, pbBullet.teamId, pbBullet.blState, pbBullet.framesInBlState, pbBullet.explosionFrames, pbBullet.speciesId);
      jsMeleeBulletsArr[k] = jsMeleeBullet;
    }
    const jsFireballBulletsArr = new Array(pbRdf.fireballBullets.length).fill(null);
    for (let k = 0; k < pbRdf.fireballBullets.length; ++k) {
      const pbBullet = pbRdf.fireballBullets[k];
      const jsFireballBullet = gopkgs.NewFireballBulletJs(pbBullet.bulletLocalId, pbBullet.originatedRenderFrameId, pbBullet.offenderJoinIndex, pbBullet.startupFrames, pbBullet.cancellableStFrame, pbBullet.cancellableEdFrame, pbBullet.activeFrames, pbBullet.hitStunFrames, pbBullet.blockStunFrames, pbBullet.pushbackVelX, pbBullet.pushbackVelY, pbBullet.damage, pbBullet.selfLockVelX, pbBullet.selfLockVelY, pbBullet.hitboxOffsetX, pbBullet.hitboxOffsetY, pbBullet.hitboxSizeX, pbBullet.hitboxSizeY, pbBullet.blowUp, pbBullet.teamId, pbBullet.virtualGridX, pbBullet.virtualGridY, pbBullet.dirX, pbBullet.dirY, pbBullet.velX, pbBullet.velY, pbBullet.speed, pbBullet.blState, pbBullet.framesInBlState, pbBullet.explosionFrames, pbBullet.speciesId);
      jsFireballBulletsArr[k] = jsFireballBullet;
    }

    // This function is also applicable to "re-joining".
    const rdf = gopkgs.NewRoomDownsyncFrameJs(pbRdf.id, jsPlayersArr, pbRdf.bulletLocalIdCounter, jsMeleeBulletsArr, jsFireballBulletsArr); // TODO: Check whether a "proper" preallocated rdf is available and reuse it to avoid redundant heap alloc. By "proper" I mean "pbRdf.id" should yield a "non window.RING_BUFF_FAILED_TO_SET" result, yet currently it's a bit difficult to sort out the following codes for efficient reuse, thus I'm keeping it as-is. 
    const self = window.mapIns;
    self.onInputFrameDownsyncBatch(accompaniedInputFrameDownsyncBatch); // Important to do this step before setting IN_BATTLE
    if (!self.recentRenderCache) {
      return;
    }
    if (ALL_BATTLE_STATES.IN_SETTLEMENT == self.battleState) {
      return;
    }
    const rdfId = rdf.GetId();
    const shouldForceDumping1 = (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdfId);
    let shouldForceDumping2 = (rdfId >= self.renderFrameId + self.renderFrameIdLagTolerance);
    let shouldForceResync = pbRdf.shouldForceResync;
    const notSelfUnconfirmed = (0 == (pbRdf.backendUnconfirmedMask & (1 << (self.selfPlayerInfo.joinIndex - 1))));
    if (notSelfUnconfirmed) {
      shouldForceDumping2 = false;
      shouldForceResync = false;
      self.othersForcedDownsyncRenderFrameDict.set(rdfId, rdf);
    }
    /*
    TODO
    
    If "BackendUnconfirmedMask" is non-all-1 and contains the current player, show a label/button to hint manual reconnection. Note that the continuity of "recentInputCache" is not a good indicator, because due to network delay upon a [type#1 forceConfirmation] a player might just lag in upsync networking and have all consecutive inputFrameIds locally. 
    */

    const [dumpRenderCacheRet, oldStRenderFrameId, oldEdRenderFrameId] = (shouldForceDumping1 || shouldForceDumping2 || shouldForceResync) ? self.recentRenderCache.SetByFrameId(rdf, rdfId) : [window.RING_BUFF_CONSECUTIVE_SET, null, null];
    if (window.RING_BUFF_FAILED_TO_SET == dumpRenderCacheRet) {
      throw `Failed to dump render cache#1 (maybe recentRenderCache too small)! rdf.GetId()=${rdfId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
    }
    if (!shouldForceResync && (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START < rdfId && window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet)) {
      /*
      Don't change 
      - chaserRenderFrameId, it's updated only in "rollbackAndChase & onInputFrameDownsyncBatch" (except for when RING_BUFF_NON_CONSECUTIVE_SET)
      */
      return dumpRenderCacheRet;
    }

    // The logic below applies to (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdfId || window.RING_BUFF_NON_CONSECUTIVE_SET == dumpRenderCacheRet)
    if (null == pbRdf.speciesIdList) {
      console.error(`pbRdf.speciesIdList is required for starting or resyncing battle!`);
    }
    self.chConfigsOrderedByJoinIndex = gopkgs.GetCharacterConfigsOrderedByJoinIndex(pbRdf.speciesIdList);
    self._initPlayerRichInfoDict(rdf);

    if (shouldForceDumping1 || shouldForceDumping2 || shouldForceResync) {
      // In fact, not having "window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet" should already imply that "self.renderFrameId <= rdfId", but here we double check and log the anomaly  

      if (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdfId) {
        console.log('On battle started! renderFrameId=', rdfId);
      } else {
        self.hideFindingPlayersGUI();
        console.warn('On battle resynced! renderFrameId=', rdf.GetId());
      }

      self.renderFrameId = rdfId;
      self.lastRenderFrameIdTriggeredAt = performance.now();
      // In this case it must be true that "rdfId > chaserRenderFrameId".
      self.chaserRenderFrameId = rdfId;
      self.networkDoctor.logRollbackFrames(0);

      const canvasNode = self.canvasNode;
      self.ctrl = canvasNode.getComponent("TouchEventsManager");
      self.enableInputControls();
      self.transitToState(ALL_MAP_STATES.VISUAL);

      const selfPlayerRichInfo = self.playerRichInfoDict.get(self.selfPlayerInfo.id);
      const newMapPos = cc.v2().sub(selfPlayerRichInfo.node.position);
      self.node.setPosition(newMapPos);
      self.battleState = ALL_BATTLE_STATES.IN_BATTLE;
    }

    // [WARNING] "cc.Node.removeChild" would trigger massive update of rendering nodes, thus a performance impact at the beginning of battle, avoid it by just moving the widget to infinitely far away!  
    if (self.countdownToBeginGameNode && self.countdownToBeginGameNode.parent) {
      self.countdownToBeginGameNode.setPosition(cc.v2(Number.MAX_VALUE, Number.MAX_VALUE));
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
    if (null == lhs && null != rhs) return false;
    if (null != lhs && null == rhs) return false;
    if (lhs.GetVirtualGridX() != rhs.GetVirtualGridX()) return false;
    if (lhs.GetVirtualGridY() != rhs.GetVirtualGridY()) return false;
    if (lhs.GetDirX() != rhs.GetDirX()) return false;
    if (lhs.GetDirY() != rhs.GetDirY()) return false;
    if (lhs.GetVelX() != rhs.GetVelX()) return false;
    if (lhs.GetVelY() != rhs.GetVelY()) return false;
    if (lhs.GetSpeed() != rhs.GetSpeed()) return false;
    if (lhs.GetHp() != rhs.GetHp()) return false;
    if (lhs.GetMaxHp() != rhs.GetMaxHp()) return false;
    if (lhs.GetCharacterState() != rhs.GetCharacterState()) return false;
    if (lhs.GetInAir() != rhs.GetInAir()) return false;
    if (lhs.GetOnWall() != rhs.GetOnWall()) return false;
    if (lhs.GetFramesToRecover() != rhs.GetFramesToRecover()) return false;
    if (lhs.GetFramesInChState() != rhs.GetFramesInChState()) return false;
    return true;
  },

  equalMeleeBullets(lhs, rhs) {
    if (null == lhs || null == rhs) return false;
    if (null == lhs && null != rhs) return false;
    if (null != lhs && null == rhs) return false;
    if (lhs.GetBulletLocalId() != rhs.GetBulletLocalId()) return false;
    if (lhs.GetOffenderJoinIndex() != rhs.GetOffenderJoinIndex()) return false;
    if (lhs.GetOriginatedRenderFrameId() != rhs.GetOriginatedRenderFrameId()) return false;
    return true;
  },

  equalFireballBullets(lhs, rhs) {
    if (null == lhs || null == rhs) return false;
    if (null == lhs && null != rhs) return false;
    if (null != lhs && null == rhs) return false;
    if (lhs.GetBulletLocalId() != rhs.GetBulletLocalId()) return false;
    if (lhs.GetOffenderJoinIndex() != rhs.GetOffenderJoinIndex()) return false;
    if (lhs.GetOriginatedRenderFrameId() != rhs.GetOriginatedRenderFrameId()) return false;

    if (lhs.GetVirtualGridX() != rhs.GetVirtualGridX()) return false;
    if (lhs.GetVirtualGridY() != rhs.GetVirtualGridY()) return false;
    if (lhs.GetDirX() != rhs.GetDirX()) return false;
    if (lhs.GetDirY() != rhs.GetDirY()) return false;
    if (lhs.GetVelX() != rhs.GetVelX()) return false;
    if (lhs.GetVelY() != rhs.GetVelY()) return false;
    if (lhs.GetSpeed() != rhs.GetSpeed()) return false;

    return true;
  },

  equalRoomDownsyncFrames(lhs, rhs) {
    if (null == lhs || null == rhs) return false;
    for (let k = 0; k < window.boundRoomCapacity; k++) {
      const lp = gopkgs.GetPlayer(lhs, k);
      const rp = gopkgs.GetPlayer(rhs, k);
      if (!this.equalPlayers(lp, rp)) return false;
    }
    for (let k = 0;; k++) {
      const lblt = gopkgs.GetMeleeBullet(lhs, k);
      const rblt = gopkgs.GetMeleeBullet(rhs, k);
      if (null == lblt && null == rblt) break;
      if (!this.equalMeleeBullets(lblt, rblt)) return false;
    }
    for (let k = 0;; k++) {
      const lblt = gopkgs.GetFireballBullet(lhs, k);
      const rblt = gopkgs.GetFireballBullet(rhs, k);
      if (null == lblt && null == rblt) break;
      if (!this.equalFireballBullets(lblt, rblt)) return false;
    }
    return true;
  },

  _markConfirmationIfApplicable() {
    const self = this;
    let newAllConfirmedCnt = 0;
    while (self.recentInputCache.GetStFrameId() <= self.lastAllConfirmedInputFrameId && self.lastAllConfirmedInputFrameId < self.recentInputCache.GetEdFrameId()) {
      const inputFrameDownsync = self.recentInputCache.GetByFrameId(self.lastAllConfirmedInputFrameId);
      if (null == inputFrameDownsync) break;
      if (self._allConfirmed(inputFrameDownsync.ConfirmedList)) break;
      ++self.lastAllConfirmedInputFrameId;
      ++newAllConfirmedCnt;
    }
    return newAllConfirmedCnt;
  },

  onInputFrameDownsyncBatch(batch /* []*pb.InputFrameDownsync */ ) {
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

    self.networkDoctor.logInputFrameDownsync(batch[0].inputFrameId, batch[batch.length - 1].inputFrameId);
    let firstPredictedYetIncorrectInputFrameId = null;
    for (let k in batch) {
      const inputFrameDownsync = batch[k];
      const inputFrameDownsyncId = inputFrameDownsync.inputFrameId;
      if (inputFrameDownsyncId <= self.lastAllConfirmedInputFrameId) {
        continue;
      }
      // [WARNING] Now that "inputFrameDownsyncId > self.lastAllConfirmedInputFrameId", we should make an update immediately because unlike its backend counterpart "Room.LastAllConfirmedInputFrameId", the frontend "mapIns.lastAllConfirmedInputFrameId" might inevitably get gaps among discrete values due to "either type#1 or type#2 forceConfirmation" -- and only "onInputFrameDownsyncBatch" can catch this! 
      self.lastAllConfirmedInputFrameId = inputFrameDownsyncId;

      const localInputFrame = self.recentInputCache.GetByFrameId(inputFrameDownsyncId);
      if (null != localInputFrame
        &&
        null == firstPredictedYetIncorrectInputFrameId
        &&
        !self.equalInputLists(localInputFrame.InputList, inputFrameDownsync.inputList)
      ) {
        firstPredictedYetIncorrectInputFrameId = inputFrameDownsyncId;
      }
      // [WARNING] Take all "inputFrameDownsync" from backend as all-confirmed, it'll be later checked by "rollbackAndChase". 
      inputFrameDownsync.confirmedList = (1 << self.playerRichInfoDict.size) - 1;
      const inputFrameDownsyncLocal = gopkgs.NewInputFrameDownsync(inputFrameDownsync.inputFrameId, inputFrameDownsync.inputList, inputFrameDownsync.confirmedList); // "battle.InputFrameDownsync" in "jsexport"
      for (let j in self.playerRichInfoArr) {
        const jj = parseInt(j);
        if (inputFrameDownsync.inputFrameId > self.lastIndividuallyConfirmedInputFrameId[jj]) {
          self.lastIndividuallyConfirmedInputFrameId[jj] = inputFrameDownsync.inputFrameId;
          self.lastIndividuallyConfirmedInputList[jj] = inputFrameDownsync.inputList[jj];
        }
      }
      //console.log(`Confirmed inputFrameId=${inputFrameDownsync.inputFrameId}`);
      const [ret, oldStFrameId, oldEdFrameId] = self.recentInputCache.SetByFrameId(inputFrameDownsyncLocal, inputFrameDownsync.inputFrameId);
      if (window.RING_BUFF_FAILED_TO_SET == ret) {
        throw `Failed to dump input cache (maybe recentInputCache too small)! inputFrameDownsync.inputFrameId=${inputFrameDownsync.inputFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}; recentRenderCache=${self._stringifyRecentRenderCache(false)}, recentInputCache=${self._stringifyRecentInputCache(false)}`;
      }
    }
    self._markConfirmationIfApplicable();
    self._handleIncorrectlyRenderedPrediction(firstPredictedYetIncorrectInputFrameId, batch, false);
  },

  _handleIncorrectlyRenderedPrediction(firstPredictedYetIncorrectInputFrameId, batch, fromUDP) {
    if (null == firstPredictedYetIncorrectInputFrameId) return;
    const self = this;
    const renderFrameId1 = gopkgs.ConvertToFirstUsedRenderFrameId(firstPredictedYetIncorrectInputFrameId) - 1;
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
    if (CC_DEBUG) {
      // Printing of this message might induce a performance impact.
      console.log(`Mismatched input detected, resetting chaserRenderFrameId: ${self.chaserRenderFrameId}->${renderFrameId1} by 
firstPredictedYetIncorrectInputFrameId: ${firstPredictedYetIncorrectInputFrameId}
lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}
recentInputCache=${self._stringifyRecentInputCache(false)}
batchInputFrameIdRange=[${batch[0].inputFrameId}, ${batch[batch.length - 1].inputFrameId}]
fromUDP=${fromUDP}`);
    }
    self.chaserRenderFrameId = renderFrameId1;
    let rollbackFrames = (self.renderFrameId - self.chaserRenderFrameId);
    if (0 > rollbackFrames) {
      rollbackFrames = 0;
    }
    self.networkDoctor.logRollbackFrames(rollbackFrames);
  },

  onPeerInputFrameUpsync(peerJoinIndex, batch, fromUDP) {
    // TODO: find some kind of synchronization mechanism against "getOrPrefabInputFrameUpsync"!
    // See `<proj-root>/ConcerningEdgeCases.md` for why this method exists.
    if (null == batch) {
      return;
    }
    const self = this;
    if (!self.recentInputCache) {
      return;
    }
    if (ALL_BATTLE_STATES.IN_BATTLE != self.battleState) {
      return;
    }

    let effCnt = 0;
    //console.log(`Received peer inputFrameUpsync batch w/ inputFrameId in [${batch[0].inputFrameId}, ${batch[batch.length - 1].inputFrameId}] for prediction assistance`);
    let firstPredictedYetIncorrectInputFrameId = null;
    const renderedInputFrameIdUpper = gopkgs.ConvertToDelayedInputFrameId(self.renderFrameId);
    for (let k in batch) {
      const inputFrame = batch[k]; // could be either "pb.InputFrameDownsync" or "pb.InputFrameUpsync", depending on "fromUDP"
      const inputFrameId = inputFrame.inputFrameId;
      const peerEncodedInput = (true == fromUDP ? inputFrame.encoded : inputFrame.inputList[peerJoinIndex - 1]);
      if (false == self.allowRollbackOnPeerUpsync && inputFrameId <= renderedInputFrameIdUpper) {
        // [WARNING] Avoid obfuscating already rendered history, even at "inputFrameId == renderedInputFrameIdUpper", due to the use of "INPUT_SCALE_FRAMES" some previous render frames might already be rendered with "inputFrameId"!   
        continue;
      }
      if (inputFrameId <= self.lastAllConfirmedInputFrameId) {
        // [WARNING] Don't reject it by "inputFrameId <= self.lastIndividuallyConfirmedInputFrameId[peerJoinIndex-1]", the arrival of UDP packets might not reserve their sending order!
        continue;
      }
      const peerJoinIndexMask = (1 << (peerJoinIndex - 1));
      self.getOrPrefabInputFrameUpsync(inputFrameId, false); // Make sure that inputFrame exists locally
      const existingInputFrame = self.recentInputCache.GetByFrameId(inputFrameId);
      if (0 < (existingInputFrame.ConfirmedList & peerJoinIndexMask)) {
        continue;
      }
      if (inputFrameId > self.lastIndividuallyConfirmedInputFrameId[peerJoinIndex - 1]) {
        self.lastIndividuallyConfirmedInputFrameId[peerJoinIndex - 1] = inputFrameId;
        self.lastIndividuallyConfirmedInputList[peerJoinIndex - 1] = peerEncodedInput;
      }
      effCnt += 1;
      // the returned "gopkgs.NewInputFrameDownsync.InputList" is immutable, thus we can only modify the values in "newInputList" and "newConfirmedList"!
      let newInputList = existingInputFrame.InputList.slice();
      newInputList[peerJoinIndex - 1] = peerEncodedInput;
      let newConfirmedList = (existingInputFrame.ConfirmedList | peerJoinIndex);
      const newInputFrameDownsyncLocal = gopkgs.NewInputFrameDownsync(inputFrameId, newInputList, newConfirmedList);
      //console.log(`Updated encoded input of peerJoinIndex=${peerJoinIndex} to ${peerEncodedInput} for inputFrameId=${inputFrameId}/renderedInputFrameIdUpper=${renderedInputFrameIdUpper} from ${JSON.stringify(inputFrame)}; newInputFrameDownsyncLocal=${self.gopkgsInputFrameDownsyncStr(newInputFrameDownsyncLocal)}; existingInputFrame=${self.gopkgsInputFrameDownsyncStr(existingInputFrame)}`);
      self.recentInputCache.SetByFrameId(newInputFrameDownsyncLocal, inputFrameId);

      if (true == self.allowRollbackOnPeerUpsync) {
        // Reaching here implies that "true == self.allowRollbackOnPeerUpsync".
        // Shall we update the "chaserRenderFrameId" if the rendered history was wrong? It doesn't seem to impact eventual correctness if we allow the update of "chaserRenderFrameId" upon "inputFrameId <= renderedInputFrameIdUpper" here, however UDP upsync doesn't reserve order from a same sender and there might be multiple other senders, hence it might result in unnecessarily frequent chasing.
        if (
          null == firstPredictedYetIncorrectInputFrameId
          &&
          existingInputFrame.InputList[peerJoinIndex - 1] != peerEncodedInput
        ) {
          firstPredictedYetIncorrectInputFrameId = inputFrameId;
        }
      }
    }
    if (0 < effCnt) {
      //self._markConfirmationIfApplicable();
      self.networkDoctor.logPeerInputFrameUpsync(batch[0].inputFrameId, batch[batch.length - 1].inputFrameId);
    }
    if (true == self.allowRollbackOnPeerUpsync) {
      self._handleIncorrectlyRenderedPrediction(firstPredictedYetIncorrectInputFrameId, batch, fromUDP);
    }
  },

  onPlayerAdded(rdf /* pb.RoomDownsyncFrame */ ) {
    const self = this;
    self.showFindingPlayerGUI(rdf);
  },

  onBattleStopped() {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE != self.battleState) {
      return;
    }
    window.closeWSConnection(constants.RET_CODE.BATTLE_STOPPED, "");
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
  },

  spawnPlayerNode(joinIndex, vx, vy, playerDownsyncInfo) {
    const self = this;
    const newPlayerNode = cc.instantiate(self.controlledCharacterPrefab)
    const playerScriptIns = newPlayerNode.getComponent("ControlledCharacter");
    const chConfig = self.chConfigsOrderedByJoinIndex[joinIndex - 1];
    playerScriptIns.setSpecies(chConfig.GetSpeciesName());

    if (1 == joinIndex) {
      newPlayerNode.color = cc.Color.RED;
    } else {
      newPlayerNode.color = cc.Color.BLUE;
    }

    const [wx, wy] = gopkgs.VirtualGridToWorldPos(vx, vy);
    newPlayerNode.setPosition(wx, wy);
    playerScriptIns.mapNode = self.node;

    console.log(`Created new player node: joinIndex=${joinIndex}`);

    safelyAddChild(self.node, newPlayerNode);
    setLocalZOrder(newPlayerNode, 5);

    newPlayerNode.active = true;
    playerScriptIns.updateCharacterAnim(playerDownsyncInfo, null, true);

    return [newPlayerNode, playerScriptIns];
  },

  update(dt) {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
      /*
      [WARNING] Different devices might differ in the rate of calling "update(dt)", and the game engine is responsible of keeping this rate statistically constant. 

      Significantly different rates of calling "update(dt)" among players in a same battle would result in frequent [type#1 forceConfirmation], if you have any doubt on troubles caused by this, sample the FPS curve from all players in that battle. 

      Kindly note that Significantly different network bandwidths or delay fluctuations would result in frequent [type#1 forceConfirmation] too, but CAUSE FROM DIFFERENT LOCAL "update(dt)" RATE SHOULD BE THE FIRST TO INVESTIGATE AND ELIMINATE -- because we have control on it, but no one has control on the internet. 
      */
      if (self.allowSkippingRenderFrameFlag && self.skipRenderFrameFlag) {
        self.networkDoctor.logSkippedRenderFrameCnt();
        self.skipRenderFrameFlag = false;
        return;
      }
      try {
        let st = performance.now();
        if (cc.sys.isNative) {
          DelayNoMore.UdpSession.pollUdpRecvRingBuff();
        }
        const noDelayInputFrameId = gopkgs.ConvertToNoDelayInputFrameId(self.renderFrameId);
        let prevSelfInput = null,
          currSelfInput = null;
        if (gopkgs.ShouldGenerateInputFrameUpsync(self.renderFrameId)) {
          [prevSelfInput, currSelfInput] = self.getOrPrefabInputFrameUpsync(noDelayInputFrameId, true);
          self.networkDoctor.logInputFrameIdFront(noDelayInputFrameId);
        }

        const delayedInputFrameId = gopkgs.ConvertToDelayedInputFrameId(self.renderFrameId);
        if (null == self.recentInputCache.GetByFrameId(delayedInputFrameId)) {
          // Possible edge case after resync, kindly note that it's OK to prefab a "future inputFrame" here, because "sendInputFrameUpsyncBatch" would be capped by "noDelayInputFrameId from self.renderFrameId". 
          self.getOrPrefabInputFrameUpsync(delayedInputFrameId, false);
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

        let rollbackFrames = (self.renderFrameId - self.chaserRenderFrameId);
        if (0 > rollbackFrames) {
          rollbackFrames = 0;
        }
        self.networkDoctor.logRollbackFrames(rollbackFrames);
        let prevRdf = latestRdfResults[0],
          rdf = latestRdfResults[1];
        /*
        const nonTrivialChaseEnded = (prevChaserRenderFrameId < nextChaserRenderFrameId && nextChaserRenderFrameId == self.renderFrameId); 
        if (nonTrivialChaseEnded) {
            console.debug("Non-trivial chase ended, prevChaserRenderFrameId=" + prevChaserRenderFrameId + ", nextChaserRenderFrameId=" + nextChaserRenderFrameId);
        }  
        */
        // [WARNING] Don't try to get "prevRdf(i.e. renderFrameId == latest-1)" by "self.recentRenderCache.GetByFrameId(...)" here, as the cache might have been updated by asynchronous "onRoomDownsyncFrame(...)" calls!
        if (self.othersForcedDownsyncRenderFrameDict.has(rdf.GetId())) {
          const delayedInputFrameId = gopkgs.ConvertToDelayedInputFrameId(rdf.GetId());
          const othersForcedDownsyncRenderFrame = self.othersForcedDownsyncRenderFrameDict.get(rdf.GetId());
          if (self.lastAllConfirmedInputFrameId >= delayedInputFrameId && !self.equalRoomDownsyncFrames(othersForcedDownsyncRenderFrame, rdf)) {
            console.warn(`Mismatched render frame@rdf.id=${rdf.GetId()} w/ inputFrameId=${delayedInputFrameId}:
rdf=${JSON.stringify(rdf)}
othersForcedDownsyncRenderFrame=${JSON.stringify(othersForcedDownsyncRenderFrame)}`);
            rdf = othersForcedDownsyncRenderFrame;
            self.othersForcedDownsyncRenderFrameDict.delete(rdf.GetId());
          }
        }
        self.applyRoomDownsyncFrameDynamics(rdf, prevRdf);
        self.showDebugBoundaries(rdf);
        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
        self.lastRenderFrameIdTriggeredAt = performance.now();
        let t3 = performance.now();
        const [skipRenderFrameFlag, inputFrameIdFront, sendingFps, srvDownsyncFps, peerUpsyncFps, doctorRollbackFrames, skippedRenderFrameCnt] = self.networkDoctor.isTooFast(self);
        if (self.allowSkippingRenderFrameFlag) {
          self.skipRenderFrameFlag = skipRenderFrameFlag;
        }
        if (self.showNetworkDoctorInfo) {
          self.showNetworkDoctorLabels(inputFrameIdFront, sendingFps, srvDownsyncFps, peerUpsyncFps, doctorRollbackFrames, skippedRenderFrameCnt);
        }
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
      window.closeWSConnection(constants.RET_CODE.BATTLE_STOPPED, "");
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

  onGameRule1v1ModeClicked(chosenSpeciesId) {
    const self = this;
    self.battleState = ALL_BATTLE_STATES.WAITING;
    window.chosenSpeciesId = chosenSpeciesId; // TODO: Find a better way to pass it into "self.initAfterWSConnected"!
    window.initPersistentSessionClient(self.initAfterWSConnected, null /* Deliberately NOT passing in any `expectedRoomId`. -- YFLu */ );
  },

  showPopupInCanvas(toShowNode) {
    const self = this;
    toShowNode.active = true;
    self.disableInputControls();
    self.transitToState(ALL_MAP_STATES.SHOWING_MODAL_POPUP);
    safelyAddChild(self.widgetsAboveAllNode, toShowNode);
    setLocalZOrder(toShowNode, 10);
  },

  showFindingPlayerGUI(rdf) {
    const self = this;
    // Update the "finding player" GUI and show it if not previously present
    if (!self.findingPlayerNode.parent) {
      self.showPopupInCanvas(self.findingPlayerNode);
    }
    if (null != rdf) {
      const findingPlayerScriptIns = self.findingPlayerNode.getComponent("FindingPlayer");
      findingPlayerScriptIns.updatePlayersInfo(rdf.playersArr);
    }
  },

  hideFindingPlayersGUI(rdf) {
    const self = this;
    // [WARNING] "cc.Node.removeChild" would trigger massive update of rendering nodes, thus a performance impact at the beginning of battle, avoid it by just moving the widget to infinitely far away!  
    if (self.findingPlayerNode && self.findingPlayerNode.parent) {
      self.findingPlayerNode.setPosition(cc.v2(Number.MAX_VALUE, Number.MAX_VALUE));
    }
  },

  onBattleReadyToStart(rdf /* pb.RoomDownsyncFrame */ ) {
    const self = this;
    const players = rdf.playersArr;

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
    for (let k = 0; k < window.boundRoomCapacity; k++) {
      const currPlayerDownsync = gopkgs.GetPlayer(rdf, k);
      const prevRdfPlayer = (null == prevRdf ? null : gopkgs.GetPlayer(prevRdf, k));
      const chConfig = self.chConfigsOrderedByJoinIndex[k];
      const [wx, wy] = gopkgs.VirtualGridToWorldPos(currPlayerDownsync.GetVirtualGridX(), currPlayerDownsync.GetVirtualGridY());
      const playerRichInfo = self.playerRichInfoArr[k];
      playerRichInfo.node.setPosition(wx, wy);
      playerRichInfo.scriptIns.updateSpeed(currPlayerDownsync.GetSpeed());
      playerRichInfo.scriptIns.updateCharacterAnim(currPlayerDownsync, prevRdfPlayer, false, chConfig);
      playerRichInfo.scriptIns.hpBar.progress = (currPlayerDownsync.GetHp() * 1.0) / currPlayerDownsync.GetMaxHp();
    }

    // Move all to infinitely far away first
    for (let k in self.cachedFireballs.list) {
      const pqNode = self.cachedFireballs.list[k];
      const fireball = pqNode.value;
      fireball.node.setPosition(cc.v2(Number.MAX_VALUE, Number.MAX_VALUE));
    }
    for (let k = 0;; k++) {
      const meleeBullet = gopkgs.GetMeleeBullet(rdf, k);
      if (null == meleeBullet) {
        break;
      }
      const isExploding = (window.BULLET_STATE.Exploding == meleeBullet.GetBlState() && meleeBullet.GetFramesInBlState() < meleeBullet.GetExplosionFrames());
      if (isExploding) {
        let pqNode = self.cachedFireballs.popAny(meleeBullet.GetBulletLocalId());
        let speciesName = `MeleeExplosion`;
        let animName = `MeleeExplosion${meleeBullet.GetSpeciesId()}`;

        const offender = gopkgs.GetPlayer(rdf, meleeBullet.GetOffenderJoinIndex() - 1);
        let xfac = 1; // By now, straight Punch offset doesn't respect "y-axis"
        if (0 > offender.GetDirX()) {
          xfac = -1;
        }
        const [wx, wy] = gopkgs.VirtualGridToWorldPos(offender.GetVirtualGridX() + xfac * meleeBullet.GetHitboxOffsetX(), offender.GetVirtualGridY());

        if (null == pqNode) {
          pqNode = self.cachedFireballs.pop();
        //console.log(`@rdf.GetId()=${rdf.GetId()}, origRdfId=${meleeBullet.GetOriginatedRenderFrameId()}, startupFrames=${meleeBullet.GetStartupFrames()}, using a new fireball node for rendering for bulletLocalId=${meleeBullet.GetBulletLocalId()} at wpos=(${wx},${wy})`);
        } else {
          //console.log(`@rdf.GetId()=${rdf.GetId()}, origRdfId=${meleeBullet.GetOriginatedRenderFrameId()}, startupFrames=${meleeBullet.GetStartupFrames()}, using a cached fireball node for rendering for bulletLocalId=${meleeBullet.GetBulletLocalId()} at wpos=(${wx},${wy})`);
        }
        const cachedFireball = pqNode.value;
        cachedFireball.setSpecies(speciesName, meleeBullet, rdf);
        const newAnimIdx = meleeBullet.GetSpeciesId() - 1;
        cachedFireball.updateAnim(animName, meleeBullet.GetFramesInBlState(), offender.GetDirX(), false, rdf, newAnimIdx);
        cachedFireball.lastUsed = self.renderFrameId;
        cachedFireball.bulletLocalId = meleeBullet.GetBulletLocalId();
        cachedFireball.node.setPosition(cc.v2(wx, wy));

        self.cachedFireballs.push(cachedFireball.lastUsed, cachedFireball, meleeBullet.GetBulletLocalId());
      } else {
        //console.log(`@rdf.GetId()=${rdf.GetId()}, origRdfId=${meleeBullet.GetOriginatedRenderFrameId()}, startupFrames=${meleeBullet.GetStartupFrames()}, activeFrames=${meleeBullet.GetActiveFrames()}, not rendering melee node for bulletLocalId=${meleeBullet.GetBulletLocalId()}`);
      }
    }
    for (let k = 0;; k++) {
      const fireballBullet = gopkgs.GetFireballBullet(rdf, k);
      if (null == fireballBullet) {
        break;
      }
      const isExploding = (window.BULLET_STATE.Exploding == fireballBullet.GetBlState());
      if (gopkgs.IsGeneralBulletActive(fireballBullet.GetBlState(), fireballBullet.GetOriginatedRenderFrameId(), fireballBullet.GetStartupFrames(), fireballBullet.GetActiveFrames(), rdf.GetId()) || isExploding) {
        let pqNode = self.cachedFireballs.popAny(fireballBullet.GetBulletLocalId());
        let speciesName = `Fireball${fireballBullet.GetSpeciesId()}`;
        let animName = (isExploding ? `Fireball${fireballBullet.GetSpeciesId()}Explosion` : speciesName);

        const [wx, wy] = gopkgs.VirtualGridToWorldPos(fireballBullet.GetVirtualGridX(), fireballBullet.GetVirtualGridY());

        if (null == pqNode) {
          pqNode = self.cachedFireballs.pop();
        //console.log(`@rdf.GetId()=${rdf.GetId()}, origRdfId=${fireballBullet.GetOriginatedRenderFrameId()}, startupFrames=${fireballBullet.GetStartupFrames()}, using a new fireball node for rendering for bulletLocalId=${fireballBullet.GetBulletLocalId()} at wpos=(${wx},${wy})`);
        } else {
          //console.log(`@rdf.GetId()=${rdf.GetId()}, origRdfId=${fireballBullet.GetOriginatedRenderFrameId()}, startupFrames=${fireballBullet.GetStartupFrames()}, using a cached fireball node for rendering for bulletLocalId=${fireballBullet.GetBulletLocalId()} at wpos=(${wx},${wy})`);
        }
        const cachedFireball = pqNode.value;
        cachedFireball.setSpecies(speciesName, fireballBullet, rdf);
        const spontaneousLooping = !isExploding;
        const newAnimIdx = (spontaneousLooping ? 0 : 1);
        cachedFireball.updateAnim(animName, fireballBullet.GetFramesInBlState(), fireballBullet.GetDirX(), spontaneousLooping, rdf, newAnimIdx);
        cachedFireball.lastUsed = self.renderFrameId;
        cachedFireball.bulletLocalId = fireballBullet.GetBulletLocalId();
        cachedFireball.node.setPosition(cc.v2(wx, wy));

        self.cachedFireballs.push(cachedFireball.lastUsed, cachedFireball, fireballBullet.GetBulletLocalId());
      } else {
        //console.log(`@rdf.GetId()=${rdf.GetId()}, origRdfId=${fireballBullet.GetOriginatedRenderFrameId()}, startupFrames=${fireballBullet.GetStartupFrames()}, activeFrames=${fireballBullet.GetActiveFrames()}, not rendering fireball node for bulletLocalId=${fireballBullet.GetBulletLocalId()}`);
      }
    }

    // Update countdown
    self.countdownNanos = self.battleDurationNanos - self.renderFrameId * self.rollbackEstimatedDtNanos;
    if (self.countdownNanos <= 0) {
      self.onBattleStopped(self.playerRichInfoDict);
    }
  },

  rollbackAndChase(renderFrameIdSt, renderFrameIdEd, collisionSys, collisionSysMap, isChasing) {
    const self = this;
    let prevLatestRdf = null,
      latestRdf = null;
    for (let i = renderFrameIdSt; i < renderFrameIdEd; i++) {
      const currRdf = gopkgs.GetRoomDownsyncFrame(self.recentRenderCache, i); // typed "RoomDownsyncFrame"; [WARNING] When "true == isChasing" and using Firefox, this function could be interruptted by "onRoomDownsyncFrame(rdf)" asynchronously anytime, making this line return "null"!
      if (null == currRdf) {
        throw `Couldn't find renderFrame for i=${i} to rollback (are you using Firefox?), self.renderFrameId=${self.renderFrameId}, lastAllConfirmedInputFrameId=${self.lastAllConfirmedInputFrameId}, might've been interruptted by onRoomDownsyncFrame`;
      }
      const j = gopkgs.ConvertToDelayedInputFrameId(i);
      const delayedInputFrame = gopkgs.GetInputFrameDownsync(self.recentInputCache, j);

      if (self.frameDataLoggingEnabled) {
        const actuallyUsedInputClone = delayedInputFrame.GetInputList();
        const inputFrameDownsyncClone = {
          inputFrameId: j,
          inputList: actuallyUsedInputClone,
          confirmedList: delayedInputFrame.ConfirmedList,
        };
        self.rdfIdToActuallyUsedInput.set(i, inputFrameDownsyncClone);
      }
      const renderRes = gopkgs.ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(self.recentInputCache, i, collisionSys, collisionSysMap, self.spaceOffsetX, self.spaceOffsetY, self.chConfigsOrderedByJoinIndex, self.recentRenderCache, self.collisionHolder, self.effPushbacks, self.hardPushbackNormsArr, self.jumpedOrNotList, self.dynamicRectangleColliders, self.lastIndividuallyConfirmedInputFrameId, self.lastIndividuallyConfirmedInputList);
      const nextRdf = gopkgs.GetRoomDownsyncFrame(self.recentRenderCache, i + 1);

      if (true == isChasing) {
        // [WARNING] Move the cursor "self.chaserRenderFrameId" when "true == isChasing", keep in mind that "self.chaserRenderFrameId" is not monotonic!
        self.chaserRenderFrameId = nextRdf.GetId();
      } else if (nextRdf.GetId() == self.chaserRenderFrameId + 1) {
        self.chaserRenderFrameId = nextRdf.GetId(); // To avoid redundant calculation 
      }
      prevLatestRdf = currRdf;
      latestRdf = nextRdf;
    }

    return [prevLatestRdf, latestRdf];
  },

  _initPlayerRichInfoDict(rdf) {
    const self = this;
    for (let k = 0; k < window.boundRoomCapacity; k++) {
      const immediatePlayerInfo = gopkgs.GetPlayer(rdf, k);
      const playerId = immediatePlayerInfo.GetId();
      if (self.playerRichInfoDict.has(playerId)) continue; // Skip already put keys
      self.playerRichInfoDict.set(playerId, immediatePlayerInfo);
      const joinIndex = immediatePlayerInfo.GetJoinIndex();
      const vx = immediatePlayerInfo.GetVirtualGridX();
      const vy = immediatePlayerInfo.GetVirtualGridY();
      const nodeAndScriptIns = self.spawnPlayerNode(joinIndex, vx, vy, immediatePlayerInfo);

      Object.assign(self.playerRichInfoDict.get(playerId), {
        node: nodeAndScriptIns[0],
        scriptIns: nodeAndScriptIns[1],
      });

      const selfPlayerId = self.selfPlayerInfo.id;
      if (selfPlayerId == playerId) {
        self.selfPlayerInfo.joinIndex = joinIndex; // Update here in case of any change during WAITING phase
        nodeAndScriptIns[1].showArrowTipNode();
      }
    }
    self.playerRichInfoArr = new Array(self.playerRichInfoDict.size);
    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      self.playerRichInfoArr[playerRichInfo.GetJoinIndex() - 1] = playerRichInfo;
    });
  },

  _stringifyRecentInputCache(usefullOutput) {
    const self = this;
    if (true == usefullOutput) {
      let s = [];
      for (let i = self.recentInputCache.GetStFrameId(); i < self.recentInputCache.GetEdFrameId(); ++i) {
        s.push(JSON.stringify(self.recentInputCache.GetByFrameId(i)));
      }

      return s.join('\n');
    }
    return `[stInputFrameId=${self.recentInputCache.GetStFrameId()}, edInputFrameId=${self.recentInputCache.GetEdFrameId()})`;
  },

  _stringifyGopkgRoomDownsyncFrame(rdf) {
    let s = [];
    s.push(`{`);
    s.push(`  id: ${rdf.GetId()}`);
    s.push(`  players: [`);
    for (let k in rdf.GetPlayersArr()) {
      const player = rdf.GetPlayersArr()[k];
      s.push(`    {joinIndex: ${player.GetJoinIndex()}, id: ${player.Id}, vx: ${player.GetVirtualGridX()}, vy: ${player.GetVirtualGridY()}, velX: ${player.GetVelX()}, velY: ${player.GetVelY()}}`);
    }
    s.push(`  ]`);
    s.push(`}`);
    return s.join("\n");
  },

  _stringifyRecentRenderCache(usefullOutput) {
    const self = this;
    if (true == usefullOutput) {
      let s = [];
      for (let i = self.recentRenderCache.GetStFrameId(); i < self.recentRenderCache.GetEdFrameId(); ++i) {
        const rdf = self.recentRenderCache.GetByFrameId(i);
        s.push(self._stringifyGopkgRoomDownsyncFrame(rdf));
      }

      return s.join("\n");
    }
    return `[stRenderFrameId=${self.recentRenderCache.GetStFrameId()}, edRenderFrameId=${self.recentRenderCache.GetEdFrameId()})`;
  },

  playerDownsyncStr(playerDownsync) {
    if (null == playerDownsync) return "";
    return `{${playerDownsync.GetJoinIndex()},${playerDownsync.GetVirtualGridX()},${playerDownsync.GetVirtualGridY()},${playerDownsync.GetVelX()},${playerDownsync.GetVelY()},${playerDownsync.GetFramesToRecover()},${playerDownsync.GetInAir() ? 1 : 0},${playerDownsync.GetOnWall() ? 1 : 0}}`;
  },

  fireballDownsyncStr(fireball) {
    if (null == fireball) return "";
    return `{${fireball.GetBulletLocalId()},${fireball.GetOriginatedRenderFrameId()},${fireball.GetOffenderJoinIndex()},${fireball.GetVirtualGridX()},${fireball.GetVirtualGridY()},${fireball.GetVelX()},${fireball.GetVelY()},${fireball.GetDirX()},${fireball.GetDirY()},${fireball.GetHitboxSizeX()},${fireball.GetHitboxSizeY()}}`;
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

  gopkgsInputFrameDownsyncStr(inputFrameDownsync) {
    if (null == inputFrameDownsync) return "{}";
    const self = this;
    let s = [];
    s.push(`InputFrameId:${inputFrameDownsync.InputFrameId}`);
    let ss = [];
    for (let k = 0; k < window.boundRoomCapacity; ++k) {
      ss.push(`"${inputFrameDownsync.InputList[k]}"`);
    }
    s.push(`InputList:[${ss.join(',')}]`);
    s.push(`ConfirmedList:${inputFrameDownsync.ConfirmedList}`);

    return `{${s.join(',')}}`;
  },

  _stringifyRdfIdToActuallyUsedInput() {
    const self = this;
    let s = [];
    for (let i = self.recentRenderCache.GetStFrameId(); i < self.recentRenderCache.GetEdFrameId(); i++) {
      const actuallyUsedInputClone = self.rdfIdToActuallyUsedInput.get(i);
      const rdf = self.recentRenderCache.GetByFrameId(i);
      const playersStrBldr = [];
      for (let k in rdf.GetPlayersArr()) {
        playersStrBldr.push(self.playerDownsyncStr(rdf.GetPlayersArr()[k]));
      }
      const fireballsStrBldr = [];
      for (let k in rdf.FireballBullets) {
        fireballsStrBldr.push(self.fireballDownsyncStr(rdf.FireballBullets[k]));
      }
      s.push(`rdfId:${i}
players:[${playersStrBldr.join(',')}]
fireballs:[${fireballsStrBldr.join(',')}]
actuallyUsedinputList:{${self.inputFrameDownsyncStr(actuallyUsedInputClone)}}`);
    }

    return s.join('\n');
  },

  stringifyColliderCenterInWorld(playerCollider, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding) {
    return `{${(playerCollider.x + leftPadding + halfBoundingW).toFixed(2)}, ${(playerCollider.y + bottomPadding + halfBoundingH).toFixed(2)}}`;
  },

  showDebugBoundaries(rdf) {
    const self = this;
    // Hardcoded paddings for now
    const leftPadding = 0.1,
      rightPadding = 0.1,
      topPadding = 0.1,
      bottomPadding = 0.1;
    if (self.showCriticalCoordinateLabels && self.g2) {
      let g2 = self.g2;
      g2.clear();

      for (let k = 0; k < window.boundRoomCapacity; k++) {
        const player = gopkgs.GetPlayer(rdf, k);
        if (1 == player.GetJoinIndex()) {
          g2.strokeColor = cc.Color.BLUE;
        } else {
          g2.strokeColor = cc.Color.RED;
        }

        let [colliderWidth, colliderHeight] = [player.GetColliderRadius() * 2, player.GetColliderRadius() * 4];
        switch (player.GetCharacterState()) {
          case ATK_CHARACTER_STATE.LayDown1[0]:
            [colliderWidth, colliderHeight] = [player.GetColliderRadius() * 4, player.GetColliderRadius() * 2];
            break;
          case ATK_CHARACTER_STATE.BlownUp1[0]:
          case ATK_CHARACTER_STATE.InAirIdle1NoJump[0]:
          case ATK_CHARACTER_STATE.InAirIdle1ByJump[0]:
          case ATK_CHARACTER_STATE.OnWall[0]:
            [colliderWidth, colliderHeight] = [player.GetColliderRadius() * 2, player.GetColliderRadius() * 2];
            break;
        }

        const [halfColliderWidth, halfColliderHeight] = gopkgs.VirtualGridToWorldPos((colliderWidth >> 1), (colliderHeight >> 1));

        const [wx, wy] = gopkgs.VirtualGridToWorldPos(player.GetVirtualGridX(), player.GetVirtualGridY());
        const [cx, cy] = gopkgs.WorldToPolygonColliderBLPos(wx, wy, halfColliderWidth, halfColliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, 0, 0);
        const pts = [[0, 0], [leftPadding + halfColliderWidth * 2 + rightPadding, 0], [leftPadding + halfColliderWidth * 2 + rightPadding, bottomPadding + halfColliderHeight * 2 + topPadding], [0, bottomPadding + halfColliderHeight * 2 + topPadding]];

        g2.moveTo(cx, cy);
        for (let j = 0; j < pts.length; j += 1) {
          g2.lineTo(pts[j][0] + cx, pts[j][1] + cy);
        }
        g2.lineTo(cx, cy);
        g2.stroke();
      }

      for (let k = 0;; k++) {
        const meleeBullet = gopkgs.GetMeleeBullet(rdf, k);
        if (null == meleeBullet) {
          break;
        }
        if (gopkgs.IsGeneralBulletActive(meleeBullet.GetBlState(), meleeBullet.GetOriginatedRenderFrameId(), meleeBullet.GetStartupFrames(), meleeBullet.GetActiveFrames(), rdf.GetId())) {
          const offender = gopkgs.GetPlayer(rdf, meleeBullet.GetOffenderJoinIndex() - 1);
          if (1 == offender.GetJoinIndex()) {
            g2.strokeColor = cc.Color.BLUE;
          } else {
            g2.strokeColor = cc.Color.RED;
          }

          let xfac = 1; // By now, straight Punch offset doesn't respect "y-axis"
          if (0 > offender.GetDirX()) {
            xfac = -1;
          }
          const [bulletWx, bulletWy] = gopkgs.VirtualGridToWorldPos(offender.GetVirtualGridX() + xfac * meleeBullet.GetHitboxOffsetX(), offender.GetVirtualGridY());
          const [halfColliderWidth, halfColliderHeight] = gopkgs.VirtualGridToWorldPos((meleeBullet.GetHitboxSizeX() >> 1), (meleeBullet.GetHitboxSizeY() >> 1));
          const [bulletCx, bulletCy] = gopkgs.WorldToPolygonColliderBLPos(bulletWx, bulletWy, halfColliderWidth, halfColliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, 0, 0);
          const pts = [[0, 0], [leftPadding + halfColliderWidth * 2 + rightPadding, 0], [leftPadding + halfColliderWidth * 2 + rightPadding, bottomPadding + halfColliderHeight * 2 + topPadding], [0, bottomPadding + halfColliderHeight * 2 + topPadding]];

          g2.moveTo(bulletCx, bulletCy);
          for (let j = 0; j < pts.length; j += 1) {
            g2.lineTo(pts[j][0] + bulletCx, pts[j][1] + bulletCy);
          }
          g2.lineTo(bulletCx, bulletCy);
          g2.stroke();
        }
      }

      for (let k = 0;; k++) {
        const fireballBullet = gopkgs.GetFireballBullet(rdf, k);
        if (null == fireballBullet) {
          break;
        }
        if (gopkgs.IsGeneralBulletActive(fireballBullet.GetBlState(), fireballBullet.GetOriginatedRenderFrameId(), fireballBullet.GetStartupFrames(), fireballBullet.GetActiveFrames(), rdf.GetId())) {
          const offender = gopkgs.GetPlayer(rdf, fireballBullet.GetOffenderJoinIndex() - 1);
          if (1 == offender.GetJoinIndex()) {
            g2.strokeColor = cc.Color.BLUE;
          } else {
            g2.strokeColor = cc.Color.RED;
          }

          const [bulletWx, bulletWy] = gopkgs.VirtualGridToWorldPos(fireballBullet.GetVirtualGridX(), fireballBullet.GetVirtualGridY());
          const [halfColliderWidth, halfColliderHeight] = gopkgs.VirtualGridToWorldPos((fireballBullet.GetHitboxSizeX() >> 1), (fireballBullet.GetHitboxSizeY() >> 1));
          const [bulletCx, bulletCy] = gopkgs.WorldToPolygonColliderBLPos(bulletWx, bulletWy, halfColliderWidth, halfColliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, 0, 0);
          const pts = [[0, 0], [leftPadding + halfColliderWidth * 2 + rightPadding, 0], [leftPadding + halfColliderWidth * 2 + rightPadding, bottomPadding + halfColliderHeight * 2 + topPadding], [0, bottomPadding + halfColliderHeight * 2 + topPadding]];

          g2.moveTo(bulletCx, bulletCy);
          for (let j = 0; j < pts.length; j += 1) {
            g2.lineTo(pts[j][0] + bulletCx, pts[j][1] + bulletCy);
          }
          g2.lineTo(bulletCx, bulletCy);
          g2.stroke();
        }
      }
    }
  },

  showNetworkDoctorLabels(inputFrameIdFront, sendingFps, srvDownsyncFps, peerUpsyncFps, rollbackFrames, skippedRenderFrameCnt) {
    const self = this;
    if (self.inputFrameFrontLabel) {
      self.inputFrameFrontLabel.string = `inputFrameId front: ${inputFrameIdFront}`;
    }
    if (self.sendingQLabel) {
      self.sendingQLabel.string = `fps sending: ${sendingFps}`;
      if (sendingFps < self.networkDoctor.inputRateThreshold) {
        self.sendingQLabel.node.color = cc.Color.RED;
      } else {
        self.sendingQLabel.node.color = cc.Color.WHITE;
      }
    }
    if (self.inputFrameDownsyncQLabel) {
      self.inputFrameDownsyncQLabel.string = `fps srv-downsync: ${srvDownsyncFps}`;
      if (srvDownsyncFps < self.networkDoctor.inputRateThreshold) {
        self.inputFrameDownsyncQLabel.node.color = cc.Color.RED;
      } else {
        self.inputFrameDownsyncQLabel.node.color = cc.Color.WHITE;
      }
    }
    if (self.peerInputFrameUpsyncQLabel) {
      self.peerInputFrameUpsyncQLabel.string = `fps peer-upsync: ${peerUpsyncFps}`;
      if (peerUpsyncFps > self.networkDoctor.peerUpsyncFps) {
        self.peerInputFrameUpsyncQLabel.node.color = cc.Color.RED;
      } else {
        self.peerInputFrameUpsyncQLabel.node.color = cc.Color.WHITE;
      }
    }
    if (self.rollbackFramesLabel) {
      self.rollbackFramesLabel.string = `rollbackFrames: ${rollbackFrames}`
      if (rollbackFrames > self.networkDoctor.rollbackFramesThreshold) {
        self.rollbackFramesLabel.node.color = cc.Color.RED;
      } else {
        self.rollbackFramesLabel.node.color = cc.Color.WHITE;
      }
    }
    if (self.skippedRenderFrameCntLabel) {
      self.skippedRenderFrameCntLabel.string = `frames skipped: ${skippedRenderFrameCnt}`
    }
  },
});
