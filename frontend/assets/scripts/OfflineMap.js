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
    self.showCriticalCoordinateLabels = false;

    cc.director.getCollisionManager().enabled = false;

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

    self.worldToVirtualGridRatio = 1000;
    self.virtualGridToWorldRatio = 1.0 / self.worldToVirtualGridRatio;
    self.meleeSkillConfig = {
      1: {
        // for offender
        startupFrames: 10,
        activeFrames: 3,
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

    Moreover, "snapIntoPlatformOverlap" should be small enough such that the jumping initial "velY" can escape from it by 1 renderFrame (when jumping is triggered, the character is waived from snappig for 1 renderFrame).
    */
    self.snapIntoPlatformOverlap = 0.1;
    self.snapIntoPlatformThreshold = 0.5; // a platform must be "horizontal enough" for a character to "stand on"
    self.jumpingInitVelY = 6 * self.worldToVirtualGridRatio; // unit: (virtual grid length/renderFrame)
    [self.gravityX, self.gravityY] = [0, -Math.ceil(4 * self.jumpingInitVelY / self.serverFps)]; // unit: (virtual grid length/renderFrame^2)

    const tiledMapIns = self.node.getComponent(cc.TiledMap);

    const fullPathOfTmxFile = cc.js.formatStr("map/%s/map", "dungeon");
    cc.loader.loadRes(fullPathOfTmxFile, cc.TiledMapAsset, (err, tmxAsset) => {
      if (null != err) {
        console.error(err);
        return;
      }

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

      let barrierIdCounter = 0;
      const boundaryObjs = tileCollisionManager.extractBoundaryObjects(self.node);
      for (let boundaryObj of boundaryObjs.barriers) {
        const x0 = boundaryObj.anchor.x,
          y0 = boundaryObj.anchor.y;

        const newBarrier = self.collisionSys.createPolygon(x0, y0, Array.from(boundaryObj, p => {
          return [p.x, p.y];
        }));

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
        // console.log("Created barrier: ", newBarrier);
        ++barrierIdCounter;
        const collisionBarrierIndex = (self.collisionBarrierIndexPrefix + barrierIdCounter);
        self.collisionSysMap.set(collisionBarrierIndex, newBarrier);
      }

      const startRdf = window.pb.protos.RoomDownsyncFrame.create({
        id: window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START,
        players: {
          10: window.pb.protos.PlayerDownsync.create({
            id: 10,
            joinIndex: 1,
            virtualGridX: self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[0].x, boundaryObjs.playerStartingPositions[0].y)[0],
            virtualGridY: self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[0].x, boundaryObjs.playerStartingPositions[0].y)[1],
            speed: 1 * self.worldToVirtualGridRatio,
            colliderRadius: 12,
            characterState: window.ATK_CHARACTER_STATE.InAirIdle1[0],
            framesToRecover: 0,
            dirX: 0,
            dirY: 0,
            velX: 0,
            velY: 0,
            inAir: true,
          }),
          11: window.pb.protos.PlayerDownsync.create({
            id: 11,
            joinIndex: 2,
            virtualGridX: self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[1].x, boundaryObjs.playerStartingPositions[1].y)[0],
            virtualGridY: self.worldToVirtualGridPos(boundaryObjs.playerStartingPositions[1].x, boundaryObjs.playerStartingPositions[1].y)[1],
            speed: 1 * self.worldToVirtualGridRatio,
            colliderRadius: 12,
            characterState: window.ATK_CHARACTER_STATE.InAirIdle1[0],
            framesToRecover: 0,
            dirX: 0,
            dirY: 0,
            velX: 0,
            velY: 0,
            inAir: true,
          }),
        }
      });
      self.selfPlayerInfo = {
        id: 11
      };
      self._initPlayerRichInfoDict(startRdf.players);
      self.onRoomDownsyncFrame(startRdf);

      self.battleState = ALL_BATTLE_STATES.IN_BATTLE;
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

        const [prevRdf, rdf] = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.collisionSys, self.collisionSysMap, false);
        self.applyRoomDownsyncFrameDynamics(rdf, prevRdf);
        let t3 = performance.now();
      } catch (err) {
        console.error("Error during Map.update", err);
      } finally {
        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
      }
    }
  },

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
        inAir: true, // will be updated if collided with a barrier with "0 > pushbackY"
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

    // Guaranteed determinism regardless of traversal order
    const jumpTriggered = new Array(self.playerRichInfoArr.length);
    const movements = new Array(self.playerRichInfoArr.length);
    const bulletPushbacks = new Array(self.playerRichInfoArr.length);
    const effPushbacks = new Array(self.playerRichInfoArr.length);

    // Reset playerCollider position from the "virtual grid position"
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
      jumpTriggered[joinIndex - 1] = false;
      movements[joinIndex - 1] = [0.0, 0.0];
      bulletPushbacks[joinIndex - 1] = [0.0, 0.0];
      effPushbacks[joinIndex - 1] = [0.0, 0.0];
      const playerRichInfo = self.playerRichInfoArr[j];
      const playerId = playerRichInfo.id;
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      const currPlayerDownsync = currRenderFrame.players[playerId];
      const thatPlayerInNextFrame = nextRenderFramePlayers[playerId];

      const newVx = currPlayerDownsync.virtualGridX;
      const newVy = currPlayerDownsync.virtualGridY;
      [playerCollider.x, playerCollider.y] = self.virtualGridToPolygonColliderAnchorPos(newVx, newVy, self.playerRichInfoArr[joinIndex - 1].colliderRadius, self.playerRichInfoArr[joinIndex - 1].colliderRadius);

      // Process gravity before anyother interaction, by now "currPlayerDownsync.velX & velY" are properly snapped to be parallel to the edge of its standing platform if necessary
      [movements[joinIndex - 1][0], movements[joinIndex - 1][1]] = self.virtualGridToWorldPos(currPlayerDownsync.velX, currPlayerDownsync.velY);
      playerCollider.x += movements[joinIndex - 1][0];
      playerCollider.y += movements[joinIndex - 1][1];
      if (currPlayerDownsync.inAir) {
        thatPlayerInNextFrame.velX += self.gravityX;
        thatPlayerInNextFrame.velY += self.gravityY;
      }
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
      // console.log(`A meleeBullet is added to collisionSys at currRenderFrame.id=${currRenderFrame.id} as start-up frames ended and active frame is not yet ended: ${JSON.stringify(meleeBullet)}`);
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
          const thatAckedPlayerInCurFrame = currRenderFrame.players[potential.data.id];
          const thatAckedPlayerInNextFrame = nextRenderFramePlayers[potential.data.id];
          thatAckedPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atked1[0];
          if (thatAckedPlayerInCurFrame.inAir) {
            thatAckedPlayerInNextFrame.characterState = window.toInAirConjugate(thatAckedPlayerInNextFrame.characterState);
          }
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
      nextRenderFrameMeleeBullets.push(meleeBullet);
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
            console.log(`playerId=${playerId}, joinIndex=${joinIndex} is pushbacked back by ${bulletPushbacks[joinIndex - 1]} by bullet impacts, now its framesToRecover is ${thatPlayerInNextFrame.framesToRecover}`);
          }
          continue;
        }

        const decodedInput = self.ctrl.decodeInput(inputList[joinIndex - 1]);
        const prevDecodedInput = (null == delayedInputFrameForPrevRenderFrame ? null : self.ctrl.decodeInput(delayedInputFrameForPrevRenderFrame.inputList[joinIndex - 1]));
        const prevBtnALevel = (null == prevDecodedInput ? 0 : prevDecodedInput.btnALevel);
        const prevBtnBLevel = (null == prevDecodedInput ? 0 : prevDecodedInput.btnBLevel);
        /*
        [WARNING] Player input alone WOULD NOT take "characterState" into any "ATK_CHARACTER_STATE_IN_AIR_SET", only after the calculation of "effPushbacks" do we know exactly whether or not a player is "inAir", the finalize the transition of "thatPlayerInNextFrame.characterState". 
        */
        if (1 == decodedInput.btnBLevel && 0 == prevBtnBLevel) {
          const characStateAlreadyInAir = window.ATK_CHARACTER_STATE_IN_AIR_SET.has(thatPlayerInNextFrame.characterState);
          const characStateIsInterruptWaivable = window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(thatPlayerInNextFrame.characterState);
          if (
            !characStateAlreadyInAir
            &&
            characStateIsInterruptWaivable
          ) {
            thatPlayerInNextFrame.velY = self.jumpingInitVelY;
            jumpTriggered[joinIndex - 1] = true;
            console.log(`playerId=${playerId}, joinIndex=${joinIndex} triggered a rising-edge of btnB at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}, nextVelY=${thatPlayerInNextFrame.velY}, characStateAlreadyInAir=${characStateAlreadyInAir}, characStateIsInterruptWaivable=${characStateIsInterruptWaivable}`);
          }
        }

        if (1 == decodedInput.btnALevel && 0 == prevBtnALevel) {
          // console.log(`playerId=${playerId} triggered a rising-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
          if (self.bulletTriggerEnabled) {
            const punchSkillId = 1;
            const punch = window.pb.protos.MeleeBullet.create(self.meleeSkillConfig[punchSkillId]);
            thatPlayerInNextFrame.framesToRecover = punch.recoveryFrames;
            punch.battleLocalId = self.bulletBattleLocalIdCounter++;
            punch.offenderJoinIndex = joinIndex;
            punch.offenderPlayerId = playerId;
            punch.originatedRenderFrameId = currRenderFrame.id;
            nextRenderFrameMeleeBullets.push(punch);
            // console.log(`A rising-edge of meleeBullet is created at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}: ${self._stringifyRecentInputCache(true)}`);
            // console.log(`A rising-edge of meleeBullet is created at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);

            thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atk1[0];
            if (false == currPlayerDownsync.inAir) {
              thatPlayerInNextFrame.velX = 0; // prohibits simultaneous movement with Atk1 on the ground
            }
          }
        } else if (0 == decodedInput.btnALevel && 1 == prevBtnALevel) {
          // console.log(`playerId=${playerId} triggered a falling-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
        } else {
          // No bullet trigger, process joystick movement inputs (except for jumping).
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
        if (currPlayerDownsync.inAir) {
          thatPlayerInNextFrame.characterState = window.toInAirConjugate(thatPlayerInNextFrame.characterState);
        }
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
      const currPlayerDownsync = currRenderFrame.players[playerId];
      const thatPlayerInNextFrame = nextRenderFramePlayers[playerId];
      let fallStopping = false;
      let [snappedIntoPlatformEx, snappedIntoPlatformEy] = [null, null];
      for (const potential of potentials) {
        // Test if the player collides with the wall
        if (!playerCollider.collides(potential, result2)) continue;
        // Push the player out of the wall
        let [pushbackX, pushbackY] = [result2.overlap * result2.overlap_x, result2.overlap * result2.overlap_y];
        if (null == potential.data) {
          // "null == potential.data" implies a barrier
          const normAlignmentWithGravity = (result2.overlap_x * 0 + result2.overlap_y * (-1.0));
          const flatEnough = (self.snapIntoPlatformThreshold < normAlignmentWithGravity); // prevents false snapping on the lateral sides
          const remainsNotInAir = (!currPlayerDownsync.inAir && flatEnough);
          const localFallStopping = (currPlayerDownsync.inAir && flatEnough);
          if (remainsNotInAir || localFallStopping) {
            fallStopping |= localFallStopping;
            [pushbackX, pushbackY] = [(result2.overlap - self.snapIntoPlatformOverlap) * result2.overlap_x, (result2.overlap - self.snapIntoPlatformOverlap) * result2.overlap_y]
            // [overlay_x, overlap_y] is the unit vector that points into the platform; FIXME: Should only assign to [snappedIntoPlatformEx, snappedIntoPlatformEy] at most once!
            snappedIntoPlatformEx = -result2.overlap_y;
            snappedIntoPlatformEy = result2.overlap_x;
            if (snappedIntoPlatformEx * currPlayerDownsync.dirX + snappedIntoPlatformEy * currPlayerDownsync.dirY) {
              [snappedIntoPlatformEx, snappedIntoPlatformEy] = [-snappedIntoPlatformEx, -snappedIntoPlatformEy];
            }
          }
        }
        // What if we're on the edge of 2 barriers? Would adding up make an unexpected bounce?
        effPushbacks[joinIndex - 1][0] += pushbackX;
        effPushbacks[joinIndex - 1][1] += pushbackY;
      }
      if (false == jumpTriggered[joinIndex - 1] && null != snappedIntoPlatformEx && null != snappedIntoPlatformEy) {
        thatPlayerInNextFrame.inAir = false;
        if (fallStopping) {
          thatPlayerInNextFrame.velY = 0;
          thatPlayerInNextFrame.velX = 0;
          thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Idle1[0];
          thatPlayerInNextFrame.framesToRecover = 0;
        }
        const dotProd = thatPlayerInNextFrame.velX * snappedIntoPlatformEx + thatPlayerInNextFrame.velY * snappedIntoPlatformEy;
        [thatPlayerInNextFrame.velX, thatPlayerInNextFrame.velY] = [dotProd * snappedIntoPlatformEx, dotProd * snappedIntoPlatformEy];
      }
    }

    // Get players out of stuck barriers if there's any
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
      const playerId = self.playerRichInfoArr[j].id;
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      const thatPlayerInNextFrame = nextRenderFramePlayers[playerId];
      [thatPlayerInNextFrame.virtualGridX, thatPlayerInNextFrame.virtualGridY] = self.polygonColliderAnchorToVirtualGridPos(playerCollider.x - effPushbacks[joinIndex - 1][0], playerCollider.y - effPushbacks[joinIndex - 1][1], self.playerRichInfoArr[j].colliderRadius, self.playerRichInfoArr[j].colliderRadius);
    }

    return window.pb.protos.RoomDownsyncFrame.create({
      id: currRenderFrame.id + 1,
      players: nextRenderFramePlayers,
      meleeBullets: nextRenderFrameMeleeBullets,
    });
  },

  applyRoomDownsyncFrameDynamics(rdf, prevRdf) {
    const self = this;
    OnlineMap.prototype.applyRoomDownsyncFrameDynamics.call(self, rdf, prevRdf);
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
});
