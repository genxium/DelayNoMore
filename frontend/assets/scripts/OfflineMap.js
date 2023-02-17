const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const OnlineMap = require('./Map');

cc.Class({
  extends: OnlineMap,

  onDestroy() {
    console.warn("+++++++ Map onDestroy()");
  },

  onLoad() {
    cc.game.setFrameRate(59.9);
    cc.view.setOrientation(cc.macro.ORIENTATION_LANDSCAPE);
    cc.view.enableAutoFullScreen(true);
    const self = this;
    window.mapIns = self;
    self.showCriticalCoordinateLabels = false;
    self.showNetworkDoctorInfo = true;

    const mapNode = self.node;
    const canvasNode = mapNode.parent;

    self.mainCameraNode = self.canvasNode.getChildByName("Main Camera");
    self.mainCamera = self.mainCameraNode.getComponent(cc.Camera);
    for (let child of self.mainCameraNode.children) {
      child.setScale(1 / self.mainCamera.zoomRatio);
    }
    self.widgetsAboveAllNode = self.mainCameraNode.getChildByName("WidgetsAboveAll");
    self.mainCameraNode.setPosition(cc.v2());

    /** Init required prefab ended. */

    self.inputFrameUpsyncDelayTolerance = 2;
    self.collisionMinStep = 8;

    self.renderCacheSize = 128;
    self.serverFps = 60;
    self.rollbackEstimatedDt = 0.016667;
    self.rollbackEstimatedDtMillis = 16.667;
    self.rollbackEstimatedDtNanos = 16666666;
    self.tooFastDtIntervalMillis = 0.5 * self.rollbackEstimatedDtMillis;

    const tiledMapIns = self.node.getComponent(cc.TiledMap);

    const fullPathOfTmxFile = cc.js.formatStr("map/%s/map", "dungeon");
    cc.loader.loadRes(fullPathOfTmxFile, cc.TiledMapAsset, (err, tmxAsset) => {
      if (null != err) {
        console.error(err);
        return;
      }

      tiledMapIns.tmxAsset = null;
      mapNode.removeAllChildren();

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

      self.spaceOffsetX = ((newMapSize.width * newTileSize.width) >> 1);
      self.spaceOffsetY = ((newMapSize.height * newTileSize.height) >> 1);

      window.boundRoomCapacity = 2;
      self._resetCurrentMatch();
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

        // console.log("Created barrier: ", newBarrierCollider);
        ++barrierIdCounter;
        const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter);
        self.gopkgsCollisionSysMap[collisionBarrierIndex] = newBarrierCollider;
      }
      self.initDebugDrawers();

      const p1Vpos = gopkgs.WorldToVirtualGridPos(boundaryObjs.playerStartingPositions[0].x, boundaryObjs.playerStartingPositions[0].y);
      const p2Vpos = gopkgs.WorldToVirtualGridPos(boundaryObjs.playerStartingPositions[1].x, boundaryObjs.playerStartingPositions[1].y);
      const colliderRadiusV = gopkgs.WorldToVirtualGridPos(12.0, 0);

      const speciesIdList = [1, 0];
      const chConfigsOrderedByJoinIndex = gopkgs.GetCharacterConfigsOrderedByJoinIndex(speciesIdList);

      const startRdf = window.pb.protos.RoomDownsyncFrame.create({
        id: window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START,
        playersArr: [
          window.pb.protos.PlayerDownsync.create({
            id: 10,
            joinIndex: 1,
            virtualGridX: p1Vpos[0],
            virtualGridY: p1Vpos[1],
            revivalVirtualGridX: p1Vpos[0],
            revivalVirtualGridY: p1Vpos[1],
            speed: chConfigsOrderedByJoinIndex[0].GetSpeed(),
            colliderRadius: colliderRadiusV[0],
            characterState: window.ATK_CHARACTER_STATE.InAirIdle1NoJump[0],
            framesToRecover: 0,
            dirX: +2,
            dirY: 0,
            velX: 0,
            velY: 0,
            inAir: true,
            onWall: false,
            hp: 100,
            maxHp: 100,
          }),
          window.pb.protos.PlayerDownsync.create({
            id: 11,
            joinIndex: 2,
            virtualGridX: p2Vpos[0],
            virtualGridY: p2Vpos[1],
            revivalVirtualGridX: p2Vpos[0],
            revivalVirtualGridY: p2Vpos[1],
            speed: chConfigsOrderedByJoinIndex[1].GetSpeed(),
            colliderRadius: colliderRadiusV[0],
            characterState: window.ATK_CHARACTER_STATE.InAirIdle1NoJump[0],
            framesToRecover: 0,
            dirX: -2,
            dirY: 0,
            velX: 0,
            velY: 0,
            inAir: true,
            onWall: false,
            hp: 100,
            maxHp: 100,
          }),
        ],
        speciesIdList: speciesIdList,
      });

      self.selfPlayerInfo = {
        id: 10,
        joinIndex: 1,
      };
      if (cc.sys.isNative) {
        window.onUdpMessage = (args) => {
          const len = args.length;
          const ui8Arr = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            ui8Arr[i] = args.charCodeAt(i);
          }
          cc.log(`#1 Js called back by CPP: onUdpMessage: args=${args}, typeof(args)=${typeof (args)}, argslen=${args.length}, ui8Arr=${ui8Arr}`);
          const echoed = window.pb.protos.HolePunchUpsync.decode(ui8Arr);
          cc.log(`#2 Js called back by CPP: onUdpMessage: ${JSON.stringify(echoed)}`);
        };
        const res1 = DelayNoMore.UdpSession.openUdpSession(8888 + self.selfPlayerInfo.joinIndex);
        const holePunchData = window.pb.protos.HolePunchUpsync.encode({
          boundRoomId: 22,
          intAuthToken: "foobar",
          authKey: Math.floor(Math.random() * 65535),
        }).finish()
        //const res2 = DelayNoMore.UdpSession.punchToServer("127.0.0.1", 3000, holePunchData, 19999, holePunchData);
        const res3 = DelayNoMore.UdpSession.upsertPeerUdpAddr([window.pb.protos.PeerUdpAddr.create({
          ip: "192.168.31.194",
          port: 6789,
          authKey: 123456,
        }), window.pb.protos.PeerUdpAddr.create({
          ip: "192.168.1.101",
          port: 8771,
          authKey: 654321,
        })], 2, self.selfPlayerInfo.JoinIndex);
      //const res4 = DelayNoMore.UdpSession.closeUdpSession();
      }
      self.onRoomDownsyncFrame(startRdf);

      self.battleState = ALL_BATTLE_STATES.IN_BATTLE;
    });

  },

  update(dt) {
    const self = this;
    if (ALL_BATTLE_STATES.IN_BATTLE == self.battleState) {
      try {
        let st = performance.now();
        let prevSelfInput = null,
          currSelfInput = null;
        const noDelayInputFrameId = gopkgs.ConvertToNoDelayInputFrameId(self.renderFrameId); // It's important that "inputDelayFrames == 0" here 
        if (gopkgs.ShouldGenerateInputFrameUpsync(self.renderFrameId)) {
          const prevAndCurrInputs = self.getOrPrefabInputFrameUpsync(noDelayInputFrameId, true);
          prevSelfInput = prevAndCurrInputs[0];
          currSelfInput = prevAndCurrInputs[1];
        }

        const [prevRdf, rdf] = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.gopkgsCollisionSys, self.gopkgsCollisionSysMap, false);
        self.applyRoomDownsyncFrameDynamics(rdf, prevRdf);
        self.showDebugBoundaries(rdf);
        ++self.renderFrameId;
        self.lastRenderFrameIdTriggeredAt = performance.now();
        let t3 = performance.now();
      } catch (err) {
        console.error("Error during Map.update", err);
      }
    }
  },

});
