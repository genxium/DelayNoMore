const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const OnlineMap = require('./Map');

const PunchAtkConfig = {
  // for offender
  startupFrames: 18,
  activeFrames: 42,
  recoveryFrames: 60, // usually but not always "startupFrames+activeFrames"
  recoveryFramesOnBlock: 60, // usually but not always the same as "recoveryFrames" 
  recoveryFramesOnHit: 60, // usually but not always the same as "recoveryFrames"
  moveforward: {
    x: 0,
    y: 0,
  },
  hitboxOffset: 12.0, // should be about the radius of the PlayerCollider 
  hitboxSize: {
    x: 32.0,
    y: 32.0,
  },

  // for defender
  hitStunFrames: 18,
  blockStunFrames: 9,
  pushback: 11.0,
  releaseTriggerType: 1, // 1: rising-edge, 2: falling-edge  
  damage: 5
};

cc.Class({
  extends: OnlineMap,

  onDestroy() {
    console.warn("+++++++ Map onDestroy()");
  },

  spawnPlayerNode(joinIndex, vx, vy, playerRichInfo) {
    const self = this;
    const newPlayerNode = cc.instantiate(self.controlledCharacterPrefab)
    const playerScriptIns = newPlayerNode.getComponent("ControlledCharacter");
    if (1 == joinIndex) {
      playerScriptIns.setSpecies("SoldierWaterGhost");
    } else if (2 == joinIndex) {
      playerScriptIns.setSpecies("SoldierFireGhost");
      playerScriptIns.animComp.node.scaleX = (-1.0);
    }
    const wpos = self.virtualGridToWorldPos(vx, vy);

    newPlayerNode.setPosition(cc.v2(wpos[0], wpos[1]));

    playerScriptIns.mapNode = self.node;
    const cpos = self.virtualGridToPlayerColliderPos(vx, vy, playerRichInfo);
    const d = playerRichInfo.colliderRadius * 2,
      x0 = cpos[0],
      y0 = cpos[1];
    let pts = [[0, 0], [d, 0], [d, d], [0, d]];

    const newPlayerCollider = self.collisionSys.createPolygon(x0, y0, pts);
    const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
    newPlayerCollider.collisionPlayerIndex = parseInt(collisionPlayerIndex);
    newPlayerCollider.playerId = parseInt(playerRichInfo.id);
    self.collisionSysMap.set(collisionPlayerIndex, newPlayerCollider);

    safelyAddChild(self.node, newPlayerNode);
    setLocalZOrder(newPlayerNode, 5);

    newPlayerNode.active = true;
    playerScriptIns.updateCharacterAnim({
      dx: playerRichInfo.dir.dx,
      dy: playerRichInfo.dir.dy
    }, playerRichInfo, true);

    return [newPlayerNode, playerScriptIns];
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

    self.rollbackEstimatedDt = 0.016667;
    self.rollbackEstimatedDtMillis = 16.667;
    self.rollbackEstimatedDtNanos = 16666666;

    self.worldToVirtualGridRatio = 1000;
    self.virtualGridToWorldRatio = 1.0 / self.worldToVirtualGridRatio;

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

      const startRdf = {
        id: window.MAGIC_ROOM_DOWNSYNC_FRAME_ID.BATTLE_START,
        players: {
          10: {
            id: 10,
            joinIndex: 1,
            virtualGridX: 0,
            virtualGridY: 0,
            speed: 2 * self.worldToVirtualGridRatio,
            colliderRadius: 12,
            characterState: window.ATK_CHARACTER_STATE.Idle1[0],
            framesToRecover: 0,
            dir: {
              dx: 0,
              dy: 0
            }
          },
          11: {
            id: 11,
            joinIndex: 2,
            virtualGridX: 80 * self.worldToVirtualGridRatio,
            virtualGridY: 40 * self.worldToVirtualGridRatio,
            speed: 2 * self.worldToVirtualGridRatio,
            colliderRadius: 12,
            characterState: window.ATK_CHARACTER_STATE.Idle1[0],
            framesToRecover: 0,
            dir: {
              dx: 0,
              dy: 0
            }
          },
        }
      };
      self.selfPlayerInfo = {
        id: 10
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

        const rdf = self.rollbackAndChase(self.renderFrameId, self.renderFrameId + 1, self.collisionSys, self.collisionSysMap, false);
        self.applyRoomDownsyncFrameDynamics(rdf);
        let t3 = performance.now();
      } catch (err) {
        console.error("Error during Map.update", err);
      } finally {
        ++self.renderFrameId; // [WARNING] It's important to increment the renderFrameId AFTER all the operations above!!!
      }
    }
  },

  // Overriding this function to test experimental dynamics
  applyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame, currRenderFrame, collisionSys, collisionSysMap) {
    const self = this;
    const nextRenderFramePlayers = {}
    for (let playerId in currRenderFrame.players) {
      const currPlayerDownsync = currRenderFrame.players[playerId];
      nextRenderFramePlayers[playerId] = {
        id: playerId,
        virtualGridX: currPlayerDownsync.virtualGridX,
        virtualGridY: currPlayerDownsync.virtualGridY,
        dir: {
          dx: currPlayerDownsync.dir.dx,
          dy: currPlayerDownsync.dir.dy,
        },
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
    for (let j in self.playerRichInfoArr) {
      const joinIndex = parseInt(j) + 1;
      bulletPushbacks[joinIndex - 1] = [0.0, 0.0];
      effPushbacks[joinIndex - 1] = [0.0, 0.0];
      const playerRichInfo = self.playerRichInfoArr[j];
      const playerId = playerRichInfo.id;
      const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
      const playerCollider = collisionSysMap.get(collisionPlayerIndex);
      const player = currRenderFrame.players[playerId];

      const newVx = player.virtualGridX;
      const newVy = player.virtualGridY;
      const newCpos = self.virtualGridToPlayerColliderPos(newVx, newVy, self.playerRichInfoArr[joinIndex - 1]);
      playerCollider.x = newCpos[0];
      playerCollider.y = newCpos[1];
    }

    // Check bullet-anything collisions first, because the pushbacks caused by bullets might later be reverted by player-barrier collision 
    const colliderBullets = new Map(); // Will all be removed at the end of `applyInputFrameDownsyncDynamicsOnSingleRenderFrame` due to the need for being rollback-compatible
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

        const xfac = Math.sign(offender.dir.dx),
          yfac = 0; // By now, straight Punch offset doesn't respect "y-axis" 
        const x0 = offenderCollider.x + xfac * meleeBullet.hitboxOffset,
          y0 = offenderCollider.y + yfac * meleeBullet.hitboxOffset;
        const pts = [[0, 0], [xfac * meleeBullet.hitboxSize.x, 0], [xfac * meleeBullet.hitboxSize.x, meleeBullet.hitboxSize.y], [0, meleeBullet.hitboxSize.y]];
        const newBulletCollider = collisionSys.createPolygon(x0, y0, pts);
        newBulletCollider.collisionBulletIndex = collisionBulletIndex;
        newBulletCollider.offenderPlayerId = meleeBullet.offenderPlayerId;
        newBulletCollider.pushback = meleeBullet.pushback;
        newBulletCollider.hitStunFrames = meleeBullet.hitStunFrames;
        collisionSysMap.set(collisionBulletIndex, newBulletCollider);
        colliderBullets.set(collisionBulletIndex, newBulletCollider);
        console.log(`A meleeBullet=${JSON.stringify(meleeBullet)} is added to collisionSys at renderFrame.id=${currRenderFrame.id} as start-up frames ended and active frame is not yet ended`);
      }
    }

    collisionSys.update();
    const result1 = collisionSys.createResult(); // Can I reuse a "self.collisionSysResult" object throughout the whole battle?

    colliderBullets.forEach((bulletCollider, collisionBulletIndex) => {
      const potentials = bulletCollider.potentials();
      let shouldRemove = false;
      for (const potential of potentials) {
        if (null != potential.playerId && potential.playerId == bulletCollider.offenderPlayerId) continue;
        if (!bulletCollider.collides(potential, result1)) continue;
        if (null != potential.playerId) {
          const joinIndex = potential.collisionPlayerIndex - self.collisionPlayerIndexPrefix;
          bulletPushbacks[joinIndex - 1][0] += result1.overlap_x * bulletCollider.pushback;
          bulletPushbacks[joinIndex - 1][1] += result1.overlap_y * bulletCollider.pushback;
          const thatAckedPlayerInNextFrame = nextRenderFramePlayers[potential.playerId];
          thatAckedPlayerInNextFrame.characterState = window.ATK_CHARACTER_STATE.Atked1[0];
          const oldFrameToRecover = thatAckedPlayerInNextFrame.framesToRecover;
          thatAckedPlayerInNextFrame.framesToRecover = oldFrameToRecover > bulletCollider.hitStunFrames ? oldFrameToRecover : bulletCollider.hitStunFrames; // In case the hit player is already stun, we take the larger "hitStunFrames" 
        }
        shouldRemove = true;
      }
      if (shouldRemove) {
        removedBulletsAtCurrFrame.add(collisionBulletIndex);
      }
    });

    for (let k in currRenderFrame.meleeBullets) {
      const meleeBullet = currRenderFrame.meleeBullets[k];
      // [WARNING] remove from collisionSys ANYWAY for the convenience of rollback
      const collisionBulletIndex = self.collisionBulletIndexPrefix + meleeBullet.battleLocalId;
      if (collisionSysMap.has(collisionBulletIndex)) {
        const bulletCollider = collisionSysMap.get(collisionBulletIndex);
        bulletCollider.remove();
        collisionSysMap.delete(collisionBulletIndex);
      }
      if (removedBulletsAtCurrFrame.has(collisionBulletIndex)) continue;
      toRet.meleeBullets.push(meleeBullet);
    }

    if (null != delayedInputFrame) {
      const delayedInputFrameForPrevRenderFrame = self.getCachedInputFrameDownsyncWithPrediction(self._convertToInputFrameId(currRenderFrame.id - 1, self.inputDelayFrames));
      const inputList = delayedInputFrame.inputList;
      // Process player inputs
      for (let j in self.playerRichInfoArr) {
        const joinIndex = parseInt(j) + 1;
        effPushbacks[joinIndex - 1] = [0.0, 0.0];
        const playerRichInfo = self.playerRichInfoArr[j];
        const playerId = playerRichInfo.id;
        const collisionPlayerIndex = self.collisionPlayerIndexPrefix + joinIndex;
        const playerCollider = collisionSysMap.get(collisionPlayerIndex);
        const player = currRenderFrame.players[playerId];
        if (0 < nextRenderFramePlayers[playerId].framesToRecover) {
          // No need to process inputs for this player, but there might be bullet pushbacks on this player  
          if (0 != bulletPushbacks[joinIndex - 1][0] || 0 != bulletPushbacks[joinIndex - 1][1]) {
            playerCollider.x += bulletPushbacks[joinIndex - 1][0];
            playerCollider.y += bulletPushbacks[joinIndex - 1][1];
            console.log(`playerId=${playerId}, joinIndex=${joinIndex} is pushbacked back by ${bulletPushbacks[joinIndex - 1]} by bullet impacts, now its framesToRecover is ${player.framesToRecover}`);
          }
          continue;
        }

        const decodedInput = self.ctrl.decodeInput(inputList[joinIndex - 1]);

        const prevDecodedInput = (null == delayedInputFrameForPrevRenderFrame ? null : self.ctrl.decodeInput(delayedInputFrameForPrevRenderFrame.inputList[joinIndex - 1]));
        const prevBtnALevel = (null == prevDecodedInput ? 0 : prevDecodedInput.btnALevel);

        if (1 == decodedInput.btnALevel && 0 == prevBtnALevel) {
          console.log(`playerId=${playerId} triggered a rising-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
          nextRenderFramePlayers[playerId].framesToRecover = PunchAtkConfig.recoveryFrames;
          const punch = window.pb.protos.MeleeBullet.create(PunchAtkConfig);
          punch.battleLocalId = self.bulletBattleLocalIdCounter++;
          punch.offenderJoinIndex = joinIndex;
          punch.offenderPlayerId = playerId;
          punch.originatedRenderFrameId = currRenderFrame.id;
          toRet.meleeBullets.push(punch);
          console.log(`A rising-edge of meleeBullet=${JSON.stringify(punch)} is created at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);

          nextRenderFramePlayers[playerId].characterState = window.ATK_CHARACTER_STATE.Atk1[0];
        } else if (0 == decodedInput.btnALevel && 1 == prevBtnALevel) {
          console.log(`playerId=${playerId} triggered a falling-edge of btnA at renderFrame.id=${currRenderFrame.id}, delayedInputFrame.id=${delayedInputFrame.inputFrameId}`);
        } else {
          // No trigger, process movement inputs
          if (0 != decodedInput.dx || 0 != decodedInput.dy) {
            // Update directions and thus would eventually update moving animation accordingly
            nextRenderFramePlayers[playerId].dir.dx = decodedInput.dx;
            nextRenderFramePlayers[playerId].dir.dy = decodedInput.dy;
            nextRenderFramePlayers[playerId].characterState = window.ATK_CHARACTER_STATE.Walking[0];
          } else {
            nextRenderFramePlayers[playerId].characterState = window.ATK_CHARACTER_STATE.Idle1[0];
          }
          const movement = self.virtualGridToWorldPos(decodedInput.dx + player.speed * decodedInput.dx, decodedInput.dy + player.speed * decodedInput.dy);
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
        nextRenderFramePlayers[playerId].virtualGridX = newVpos[0];
        nextRenderFramePlayers[playerId].virtualGridY = newVpos[1];
      }

    }

    return toRet;
  },
});
