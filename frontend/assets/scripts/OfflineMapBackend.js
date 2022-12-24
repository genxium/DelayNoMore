const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const OnlineMap = require('./Map');

cc.Class({
  extends: OnlineMap,

  onDestroy() {
    console.warn("+++++++ Map onDestroy()");
  },

  onLoad() {
    const self = this;
    window.mapIns = self;
    self.showCriticalCoordinateLabels = true;

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

    self.inputDelayFrames = 8;
    self.inputScaleFrames = 2;
    self.inputFrameUpsyncDelayTolerance = 2;

    self.renderCacheSize = 1024;
    self.serverFps = 60;
    self.rollbackEstimatedDt = 0.016667;
    self.rollbackEstimatedDtMillis = 16.667;
    self.rollbackEstimatedDtNanos = 16666666;
    self.tooFastDtIntervalMillis = 0.5 * self.rollbackEstimatedDtMillis;

    self.worldToVirtualGridRatio = 1000;
    self.virtualGridToWorldRatio = 1.0 / self.worldToVirtualGridRatio;
    self.meleeSkillConfig = {
      1: {
        // for offender
        startupFrames: 10,
        activeFrames: 20,
        recoveryFrames: 34, // usually but not always "startupFrames+activeFrames", I hereby set it to be 1 frame more than the actual animation to avoid critical transition, i.e. when the animation is 1 frame from ending but "rdfPlayer.framesToRecover" is already counted 0 and the player triggers an other same attack, making an effective bullet trigger but no animation is played due to same animName is still playing
        recoveryFramesOnBlock: 34,
        recoveryFramesOnHit: 34,
        moveforward: {
          x: 0,
          y: 0,
        },
        hitboxOffset: 12.0, // should be about the radius of the PlayerCollider 
        hitboxSize: {
          x: 23.0,
          y: 32.0,
        },

        // for defender
        hitStunFrames: 18,
        blockStunFrames: 9,
        pushback: 8.0,
        releaseTriggerType: 1, // 1: rising-edge, 2: falling-edge  
        damage: 5
      }
    };

    /* 
    [WARNING] As when a character is standing on a barrier, if not carefully curated there MIGHT BE a bouncing sequence of "[(inAir -> dropIntoBarrier ->), (notInAir -> pushedOutOfBarrier ->)], [(inAir -> ..."

    Moreover, "snapIntoPlatformOverlap" should be small enough such that the walking "velX" or jumping initial "velY" can escape from it by 1 renderFrame (when jumping is triggered, the character is waived from snappig for 1 renderFrame).
    */
    self.snapIntoPlatformOverlap = 0.1;
    self.snapIntoPlatformThreshold = 0.5; // a platform must be "horizontal enough" for a character to "stand on"
    self.jumpingInitVelY = 7 * self.worldToVirtualGridRatio; // unit: (virtual grid length/renderFrame)
    [self.gravityX, self.gravityY] = [0, -0.5 * self.worldToVirtualGridRatio]; // unit: (virtual grid length/renderFrame^2)

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

      self._resetCurrentMatch();
      const spaceW = newMapSize.width * newTileSize.width;
      const spaceH = newMapSize.height * newTileSize.height;
      self.spaceOffsetX = (spaceW >> 1);
      self.spaceOffsetY = (spaceH >> 1);
      const minStep = 8;
      self.gopkgsCollisionSys = gopkgs.NewCollisionSpaceJs(spaceW, spaceH, minStep, minStep);
      self.gopkgsCollisionSysMap = {}; // [WARNING] Don't use "JavaScript Map" which could cause loss of type information when passing through Golang transpiled functions!

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

      const startPlayer1 = gopkgs.NewPlayerDownsyncJs(10, self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[0].x, boundaryObjs.playerStartingPositions[0].y)[0], self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[0].x, boundaryObjs.playerStartingPositions[0].y)[1], 0, 0, 0, 0, 1 * self.worldToVirtualGridRatio, 0, window.ATK_CHARACTER_STATE.InAirIdle1[0], 1, 100, 100, true, 12);

      const startPlayer2 = gopkgs.NewPlayerDownsyncJs(11, self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[1].x, boundaryObjs.playerStartingPositions[1].y)[0], self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[1].x, boundaryObjs.playerStartingPositions[1].y)[1], 0, 0, 0, 0, 1 * self.worldToVirtualGridRatio, 0, window.ATK_CHARACTER_STATE.InAirIdle1[0], 2, 100, 100, true, 12);

      const startRdf = gopkgs.NewRoomDownsyncFrameJs(window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START, [startPlayer1, startPlayer2], []);

      self.selfPlayerInfo = {
        Id: 11,
        JoinIndex: 2,
        // For compatibility
        id: 11,
        joinIndex: 2,
      };
      self.onRoomDownsyncFrame(startRdf);

      self.battleState = ALL_BATTLE_STATES.IN_BATTLE;
    });

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
          const prevAndCurrInputs = self.getOrPrefabInputFrameUpsync(noDelayInputFrameId);
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

  onRoomDownsyncFrame(rdf, accompaniedInputFrameDownsyncBatch) {
    // This function is also applicable to "re-joining".
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
    let shouldForceResync = rdf.ShouldForceResync;
    const notSelfUnconfirmed = (0 == (rdf.BackendUnconfirmedMask & (1 << (self.selfPlayerInfo.joinIndex - 1))));
    if (notSelfUnconfirmed) {
      shouldForceDumping2 = false;
      shouldForceResync = false;
      self.othersForcedDownsyncRenderFrameDict.set(rdf.Id, rdf);
    }
    /*
    TODO
    
    If "BackendUnconfirmedMask" is non-all-1 and contains the current player, show a label/button to hint manual reconnection. Note that the continuity of "recentInputCache" is not a good indicator, because due to network delay upon a [type#1 forceConfirmation] a player might just lag in upsync networking and have all consecutive inputFrameIds locally. 
    */

    const [dumpRenderCacheRet, oldStRenderFrameId, oldEdRenderFrameId] = (shouldForceDumping1 || shouldForceDumping2 || shouldForceResync) ? self.recentRenderCache.setByFrameId(rdf, rdf.id) : [window.RING_BUFF_CONSECUTIVE_SET, null, null];
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
    self._initPlayerRichInfoDict(gopkgs.GetPlayersArrJs(rdf));

    if (shouldForceDumping1 || shouldForceDumping2 || shouldForceResync) {
      // In fact, not having "window.RING_BUFF_CONSECUTIVE_SET == dumpRenderCacheRet" should already imply that "self.renderFrameId <= rdf.id", but here we double check and log the anomaly  

      if (window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START == rdf.Id) {
        console.log('On battle started! renderFrameId=', rdf.Id);
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
    // [WARNING] Leave all graphical updates in "update(dt)" by "applyRoomDownsyncFrameDynamics"
    return dumpRenderCacheRet;
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

      const delayedInputFrameJs = gopkgs.NewInputFrameDownsyncJs(j, delayedInputFrame.inputList, delayedInputFrame.confirmedList);
      const jPrev = self._convertToInputFrameId(i - 1, self.inputDelayFrames);
      const delayedInputFrameForPrevRenderFrame = self.recentInputCache.getByFrameId(jPrev);
      const delayedInputFrameForPrevRenderFrameJs = gopkgs.NewInputFrameDownsyncJs(jPrev, delayedInputFrameForPrevRenderFrame.inputList, delayedInputFrameForPrevRenderFrame.confirmedList);
      const nextRdf = gopkgs.ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(delayedInputFrameJs, delayedInputFrameForPrevRenderFrameJs, currRdf, collisionSys, collisionSysMap, self.gravityX, self.gravityY, self.jumpingInitVelY, self.inputDelayFrames, self.inputScaleFrames, self.spaceOffsetX, self.spaceOffsetY, self.snapIntoPlatformOverlap, self.snapIntoPlatformThreshold, self.worldToVirtualGridRatio, self.virtualGridToWorldRatio);

      if (true == isChasing) {
        // [WARNING] Move the cursor "self.chaserRenderFrameId" when "true == isChasing", keep in mind that "self.chaserRenderFrameId" is not monotonic!
        self.chaserRenderFrameId = nextRdf.id;
      } else if (nextRdf.id == self.chaserRenderFrameId + 1) {
        self.chaserRenderFrameId = nextRdf.id; // To avoid redundant calculation 
      }
      self.recentRenderCache.setByFrameId(nextRdf, nextRdf.id);
      prevLatestRdf = currRdf;
      latestRdf = nextRdf;
    }

    return [prevLatestRdf, latestRdf];
  },

  _initPlayerRichInfoDict(playersArr) {
    const self = this;
    for (let k in playersArr) {
      const immediatePlayerInfo = playersArr[k];
      const playerId = immediatePlayerInfo.Id;
      if (self.playerRichInfoDict.has(playerId)) continue; // Skip already put keys
      self.playerRichInfoDict.set(playerId, immediatePlayerInfo);

      const nodeAndScriptIns = self.spawnPlayerNode(immediatePlayerInfo.JoinIndex, immediatePlayerInfo.VirtualGridX, immediatePlayerInfo.VirtualGridY, immediatePlayerInfo);

      Object.assign(self.playerRichInfoDict.get(playerId), {
        node: nodeAndScriptIns[0],
        scriptIns: nodeAndScriptIns[1],
      });

      if (self.selfPlayerInfo.Id == playerId) {
        self.selfPlayerInfo = Object.assign(self.selfPlayerInfo, immediatePlayerInfo);
        nodeAndScriptIns[1].showArrowTipNode();
      }
    }
    self.playerRichInfoArr = new Array(self.playerRichInfoDict.size);
    self.playerRichInfoDict.forEach((playerRichInfo, playerId) => {
      self.playerRichInfoArr[playerRichInfo.JoinIndex - 1] = playerRichInfo;
    });
  },

  applyRoomDownsyncFrameDynamics(rdf, prevRdf) {
    const self = this;
    const playersArr = gopkgs.GetPlayersArrJs(rdf);
    for (let k in playersArr) {
      const currPlayerDownsync = playersArr[k];
      const prevRdfPlayer = (null == prevRdf ? null : gopkgs.GetPlayersArrJs(prevRdf)[k]);
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
    const halfColliderWidth = playerDownsyncInfo.ColliderRadius,
      halfColliderHeight = playerDownsyncInfo.ColliderRadius + playerDownsyncInfo.ColliderRadius; // avoid multiplying
    const colliderWidth = halfColliderWidth + halfColliderWidth,
      colliderHeight = halfColliderHeight + halfColliderHeight; // avoid multiplying
    const newPlayerCollider = gopkgs.GenerateRectColliderJs(wx, wy, colliderWidth, colliderHeight, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.snapIntoPlatformOverlap, self.spaceOffsetX, self.spaceOffsetY, playerDownsyncInfo, "Player");
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
});
