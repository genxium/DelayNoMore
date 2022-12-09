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

      const startRdf = window.pb.protos.RoomDownsyncFrame.create({
        id: window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START,
        players: {
          10: window.pb.protos.PlayerDownsync.create({
            id: 10,
            joinIndex: 1,
            virtualGridX: -50 * self.worldToVirtualGridRatio,
            virtualGridY: -400 * self.worldToVirtualGridRatio,
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
            virtualGridX: 100 * self.worldToVirtualGridRatio,
            virtualGridY: -350 * self.worldToVirtualGridRatio,
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

    const movements = new Array(self.playerRichInfoArr.length); // Guaranteed determinism regardless of traversal order
    const bulletPushbacks = new Array(self.playerRichInfoArr.length); // Guaranteed determinism regardless of traversal order
    const effPushbacks = new Array(self.playerRichInfoArr.length); // Guaranteed determinism regardless of traversal order

    // Reset playerCollider position from the "virtual grid position"
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
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

      // Process gravity before anyother interaction
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
        const bulletWy = offenderWy;
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
          const thatAckedPlayerInNextFrame = nextRenderFramePlayers[potential.data.id];
          if (!window.ATK_CHARACTER_STATE_IN_AIR_SET.has(thatAckedPlayerInNextFrame.characterState)) {
            thatAckedPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atked1[0];
          } else {
            thatAckedPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.InAirAtked1[0];
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

            if (!window.ATK_CHARACTER_STATE_IN_AIR_SET.has(currPlayerDownsync.characterState)) {
              thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atk1[0];
            } else {
              thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.InAirAtk1[0];
            }
          }
        } else if (0 == decodedInput.btnALevel && 1 == prevBtnALevel) {
          // console.log(`playerId=${playerId} triggered a falling-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
        } else {
          // No bullet trigger, process movement inputs
          if (1 == decodedInput.btnBLevel && 0 == prevBtnBLevel) {
            const characStateAlreadyInAir = window.ATK_CHARACTER_STATE_IN_AIR_SET.has(thatPlayerInNextFrame.characterState);
            const characStateIsInterruptWaivable = window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(thatPlayerInNextFrame.characterState);
            console.log(`playerId=${playerId} triggered a rising-edge of btnB at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}, characStateAlreadyInAir=${characStateAlreadyInAir}, characStateIsInterruptWaivable=${characStateIsInterruptWaivable}`);
            if (
              !characStateAlreadyInAir
              &&
              characStateIsInterruptWaivable
            ) {
              thatPlayerInNextFrame.velY = currPlayerDownsync.speed * 4;
              thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.InAirIdle1[0];
              if (window.ATK_CHARACTER_STATE.Walking[0] == currPlayerDownsync.characterState) {
                console.warn(`curRenderFrameId=${currRenderFrame.id}, playerId=${playerId}, joinIndex=${joinIndex} characterState set to AirIdle1 by jumping`);
              }
            }
          } else {
            if (0 != decodedInput.dx || 0 != decodedInput.dy) {
              // Update directions and thus would eventually update moving animation accordingly
              thatPlayerInNextFrame.dirX = decodedInput.dx;
              thatPlayerInNextFrame.dirY = decodedInput.dy;
              if (!window.ATK_CHARACTER_STATE_IN_AIR_SET.has(thatPlayerInNextFrame.characterState)) {
                thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Walking[0];
                thatPlayerInNextFrame.velX = currPlayerDownsync.speed * decodedInput.dx;
                if (window.ATK_CHARACTER_STATE.Idle1[0] == currPlayerDownsync.characterState || window.ATK_CHARACTER_STATE.InAirIdle1[0] == currPlayerDownsync.characterState) {
                  console.warn(`curRenderFrameId=${currRenderFrame.id}, playerId=${playerId}, joinIndex=${joinIndex} characterState set to Walking by dir input`);
                }
              } else {
                // There's no characterState of "InAirWalking" :)
                thatPlayerInNextFrame.velX = currPlayerDownsync.speed * decodedInput.dx;
              }
            } else {
              if (!window.ATK_CHARACTER_STATE_IN_AIR_SET.has(thatPlayerInNextFrame.characterState)) {
                thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Idle1[0];
                thatPlayerInNextFrame.velX = 0;
                if (window.ATK_CHARACTER_STATE.Walking[0] == currPlayerDownsync.characterState) {
                  console.warn(`curRenderFrameId=${currRenderFrame.id}, playerId=${playerId}, joinIndex=${joinIndex} characterState set to Idle1 by no dir input`);
                }
              } else {
                thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.InAirIdle1[0];
                if (window.ATK_CHARACTER_STATE.Walking[0] == currPlayerDownsync.characterState) {
                  console.warn(`curRenderFrameId=${currRenderFrame.id}, playerId=${playerId}, joinIndex=${joinIndex} characterState set to AirIdle1 by no dir input but already in air`);
                }
              // let inertia carry "velX" when in air
              }
            }
          }
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
      let remainsNotInAir = false;
      for (const potential of potentials) {
        // Test if the player collides with the wall
        if (!playerCollider.collides(potential, result2)) continue;
        // Push the player out of the wall
        let [pushbackX, pushbackY] = [result2.overlap * result2.overlap_x, result2.overlap * result2.overlap_y];
        if (null == potential.data) {
          // "null == potential.data" implies a barrier
          const localFallStopping = (currPlayerDownsync.inAir && 0 > pushbackY); // prevents false fall-stopping on the lateral sides  
          const localRemainsNotInAir = (!currPlayerDownsync.inAir);
          // [WARNING] As when a character is standing on a barrier, if not carefully curated there MIGHT BE a bouncing sequence of "[(inAir -> dropIntoBarrier ->), (notInAir -> pushedOutOfBarrier ->)], [(inAir -> ..."  
          if (localFallStopping) {
            pushbackY = 0.95 * pushbackY;
            fallStopping = true;
          }
          if (localRemainsNotInAir) {
            pushbackY = 0;
            remainsNotInAir = true;
          }
        }
        // What if we're on the edge of 2 barriers? Would adding up make an unexpected bounce?
        effPushbacks[joinIndex - 1][0] += pushbackX;
        effPushbacks[joinIndex - 1][1] += pushbackY;
      }
      if (fallStopping) {
        thatPlayerInNextFrame.velX = 0;
        thatPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Idle1[0];
        thatPlayerInNextFrame.velY = 0;
        thatPlayerInNextFrame.inAir = false;
        if (window.ATK_CHARACTER_STATE.Walking[0] == currPlayerDownsync.characterState) {
          console.warn(`curRenderFrameId=${currRenderFrame.id}, playerId=${playerId}, joinIndex=${joinIndex} characterState set to Idle1 by fallStopping`);
        }
      }
      if (remainsNotInAir) {
        thatPlayerInNextFrame.inAir = false;
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
});
