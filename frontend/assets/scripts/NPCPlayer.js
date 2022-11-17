const COLLISION_WITH_PLAYER_STATE = {
  WALKING_COLLIDABLE: 0,
  STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM: 1,
  STILL_NEAR_SELF_PLAYER_ONLY_PLAYED_ANIM: 2,
  STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM: 3,
  STILL_NEAR_OTHER_PLAYER_ONLY_PLAYED_ANIM: 4,
  STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM: 5,
  STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM: 6,
  WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER: 7,
  STILL_NEAR_NOBODY_PLAYING_ANIM: 8,
};

const STILL_NEAR_SELF_PLAYER_STATE_SET = new Set();
STILL_NEAR_SELF_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM);
STILL_NEAR_SELF_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYED_ANIM);
STILL_NEAR_SELF_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM);
STILL_NEAR_SELF_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM);

const STILL_NEAR_OTHER_PLAYER_STATE_SET = new Set();
STILL_NEAR_OTHER_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM);
STILL_NEAR_OTHER_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYED_ANIM);
STILL_NEAR_OTHER_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM);
STILL_NEAR_OTHER_PLAYER_STATE_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM);

const STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET = new Set();
STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM);
STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYED_ANIM);
STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM);
STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYED_ANIM);
STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM);
STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM);
STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.add(COLLISION_WITH_PLAYER_STATE.STILL_NEAR_NOBODY_PLAYING_ANIM);

function transitWalkingConditionallyCollidableToUnconditionallyCollidable(currentCollisionWithPlayerState) {
  switch (currentCollisionWithPlayerState) {
    case COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER:
      return COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE;
  }

  return currentCollisionWithPlayerState;
}

function transitUponSelfPlayerLeftProximityArea(currentCollisionWithPlayerState) {
  switch (currentCollisionWithPlayerState) {
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM:
      return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_NOBODY_PLAYING_ANIM;

    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYED_ANIM:
      return COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE;

    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM:
      return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM;

    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM:
      return COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER;
  }
  return currentCollisionWithPlayerState;
}

function transitDueToNoBodyInProximityArea(currentCollisionWithPlayerState) {
  switch (currentCollisionWithPlayerState) {
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM:
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM:
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM:
      return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_NOBODY_PLAYING_ANIM;

    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYED_ANIM:
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYED_ANIM:
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM:
      return COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER;
  }
  return currentCollisionWithPlayerState;
}

function transitToPlayingStunnedAnim(currentCollisionWithPlayerState, dueToSelfPlayer, dueToOtherPlayer) {
  if (dueToSelfPlayer) {
    switch (currentCollisionWithPlayerState) {
      case COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE:
      case COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER:
        return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM;
    }
  }

  if (dueToOtherPlayer) {
    switch (currentCollisionWithPlayerState) {
      case COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE:
        return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM;
    }
  }
  // TODO: Any error to throw?
  return currentCollisionWithPlayerState;
}

function transitDuringPlayingStunnedAnim(currentCollisionWithPlayerState, dueToSelfPlayerComesIntoProximity, dueToOtherPlayerComesIntoProximity) {
  if (dueToSelfPlayerComesIntoProximity) {
    switch (currentCollisionWithPlayerState) {
      case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM:
        return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM;

      case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_NOBODY_PLAYING_ANIM:
        return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM;
    }
  }

  if (dueToOtherPlayerComesIntoProximity) {
    switch (currentCollisionWithPlayerState) {
      case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM:
        return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM;

      case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_NOBODY_PLAYING_ANIM:
        return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM;
    }
  }
  // TODO: Any error to throw?
  return currentCollisionWithPlayerState;
}

function transitStunnedAnimPlayingToPlayed(currentCollisionWithPlayerState, forceNotCollidableWithOtherPlayer) {
  switch (currentCollisionWithPlayerState) {
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYING_ANIM:
      return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_ONLY_PLAYED_ANIM;

    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYING_ANIM:
      return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYED_ANIM;

    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYING_ANIM:
      return COLLISION_WITH_PLAYER_STATE.STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM;

    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_NOBODY_PLAYING_ANIM:
      return (true == forceNotCollidableWithOtherPlayer ? COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER : COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE);
  }
  // TODO: Any error to throw?
  return currentCollisionWithPlayerState;
}

function transitStunnedAnimPlayedToWalking(currentCollisionWithPlayerState) {
  /*
  * Intentionally NOT transiting for 
  *
  * - STILL_NEAR_SELF_PLAYER_NEAR_OTHER_PLAYER_PLAYED_ANIM, or 
  * - STILL_NEAR_SELF_PLAYER_ONLY_PLAYED_ANIM,
  *
  * which should be transited upon leaving of "SelfPlayer".
  */
  switch (currentCollisionWithPlayerState) {
    case COLLISION_WITH_PLAYER_STATE.STILL_NEAR_OTHER_PLAYER_ONLY_PLAYED_ANIM:
      return COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER;
  }
  // TODO: Any error to throw?
  return currentCollisionWithPlayerState;
}

const BasePlayer = require("./BasePlayer"); 

cc.Class({
  extends: BasePlayer,

  // LIFE-CYCLE CALLBACKS:
  start() {
    BasePlayer.prototype.start.call(this);

    this.scheduleNewDirection(this._generateRandomDirection());
  },

  onLoad() {
    BasePlayer.prototype.onLoad.call(this);
    const self = this;

    this.collisionWithPlayerState = COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE;

    this.clips = {
      '01': 'FlatHeadSisterRunTop',
      '0-1': 'FlatHeadSisterRunBottom',
      '-20': 'FlatHeadSisterRunLeft',
      '20': 'FlatHeadSisterRunRight',
      '-21': 'FlatHeadSisterRunTopLeft',
      '21': 'FlatHeadSisterRunTopRight',
      '-2-1': 'FlatHeadSisterRunBottomLeft',
      '2-1': 'FlatHeadSisterRunBottomRight'
    };


    self.onStunnedAnimPlayedSafe = () => {
      const oldCollisionWithPlayerState = self.collisionWithPlayerState;
      self.collisionWithPlayerState = transitStunnedAnimPlayingToPlayed(this.collisionWithPlayerState, true);
      if (oldCollisionWithPlayerState == self.collisionWithPlayerState || !self.node) return;
      
      self.scheduleNewDirection(self._generateRandomDirection()); 
      self.collisionWithPlayerState = transitStunnedAnimPlayedToWalking(self.collisionWithPlayerState);
      setTimeout(() => {
        self.collisionWithPlayerState = transitWalkingConditionallyCollidableToUnconditionallyCollidable(self.collisionWithPlayerState);
      }, 5000);
    };

    self.onStunnedAnimPlayedSafeAction = cc.callFunc(self.onStunnedAnimPlayedSafe, self);

    self.playStunnedAnim = () => {
      let colliededAction1 = cc.rotateTo(0.2, -15);
      let colliededAction2 = cc.rotateTo(0.3, 15);
      let colliededAction3 = cc.rotateTo(0.2, 0);
     
      self.node.runAction(cc.sequence(
        cc.callFunc(() => {
          self.player.pause()
        }, self), 
        colliededAction1, 
        colliededAction2, 
        colliededAction3, 
        cc.callFunc(() => {
          self.player.resume()
        }, self), 
        self.onStunnedAnimPlayedSafeAction
      ));

      // NOTE: Use <cc.Animation>.on('stop', self.onStunnedAnimPlayedSafe) if necessary.
    }
  },

  _canMoveBy(vecToMoveBy) {
    if (COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE_WITH_SELF_PLAYER_BUT_NOT_OTHER_PLAYER != this.collisionWithPlayerState && COLLISION_WITH_PLAYER_STATE.WALKING_COLLIDABLE != this.collisionWithPlayerState) {
      return false;
    }

    const superRet = BasePlayer.prototype._canMoveBy.call(this, vecToMoveBy);
    const self = this;

    const computedNewDifferentPosLocalToParentWithinCurrentFrame = self.node.position.add(vecToMoveBy);

    const currentSelfColliderCircle = self.node.getComponent("cc.CircleCollider"); 
    let nextSelfColliderCircle = null;
    if (0 < self.contactedBarriers.length || 0 < self.contactedNPCPlayers.length || 0 < self.contactedControlledPlayers) {
      /* To avoid unexpected buckling. */
      const mutatedVecToMoveBy = vecToMoveBy.mul(2);
      nextSelfColliderCircle = {
        position: self.node.position.add(vecToMoveBy.mul(2)).add(currentSelfColliderCircle.offset),  
        radius: currentSelfColliderCircle.radius,
      };
    } else {
      nextSelfColliderCircle = {
        position: computedNewDifferentPosLocalToParentWithinCurrentFrame.add(currentSelfColliderCircle.offset),  
        radius: currentSelfColliderCircle.radius,
      };
    }

    for (let aCircleCollider of self.contactedControlledPlayers) {
      let contactedCircleLocalToParentWithinCurrentFrame = {
        position: aCircleCollider.node.position.add(aCircleCollider.offset),  
        radius: aCircleCollider.radius,
      };
      if (cc.Intersection.circleCircle(contactedCircleLocalToParentWithinCurrentFrame, nextSelfColliderCircle)) {
        return false;
      }
    }

    return superRet;
  },

  update(dt) {
    BasePlayer.prototype.update.call(this, dt);
  },

  onCollisionEnter(other, self) {
    BasePlayer.prototype.onCollisionEnter.call(this, other, self);
    const playerScriptIns = self.getComponent(self.node.name);
    switch (other.node.name) {
      case "SelfPlayer":
        playerScriptIns._addContactedControlledPlayers(other);
        if (1 == playerScriptIns.contactedControlledPlayers.length) {
          // When "SelfPlayer" comes into proximity area.
          if (!STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.has(playerScriptIns.collisionWithPlayerState)) {
            playerScriptIns.collisionWithPlayerState = transitToPlayingStunnedAnim(playerScriptIns.collisionWithPlayerState, true, false);
            playerScriptIns.playStunnedAnim();
          } else {
            playerScriptIns.collisionWithPlayerState = transitDuringPlayingStunnedAnim(playerScriptIns.collisionWithPlayerState, true, false);
          }
        }
        break;
      case "NPCPlayer":
        if (1 == playerScriptIns.contactedNPCPlayers.length) {
          // When one of the other "OtherPlayer"s comes into proximity area.
          if (!STILL_SHOULD_NOT_PLAY_STUNNED_ANIM_SET.has(playerScriptIns.collisionWithPlayerState)) {
            const oldState = playerScriptIns.collisionWithPlayerState; 
            playerScriptIns.collisionWithPlayerState = transitToPlayingStunnedAnim(oldState, false, true);
            if (playerScriptIns.collisionWithPlayerState != oldState) {
              playerScriptIns.playStunnedAnim();
            }
          } else {
            playerScriptIns.collisionWithPlayerState = transitDuringPlayingStunnedAnim(playerScriptIns.collisionWithPlayerState, false, true);
          }
        }
        break;
      default:
        break;
    }
  },

  onCollisionStay(other, self) {
    // TBD.
  },

  onCollisionExit(other, self) {
    BasePlayer.prototype.onCollisionExit.call(this, other, self);
    const playerScriptIns = self.getComponent(self.node.name);
    switch (other.node.name) {
      case "SelfPlayer":
        playerScriptIns._removeContactedControlledPlayer(other);
        if (0 == playerScriptIns.contactedControlledPlayers.length) {
          // Special release step.
          if (STILL_NEAR_SELF_PLAYER_STATE_SET.has(playerScriptIns.collisionWithPlayerState)) {
            playerScriptIns.collisionWithPlayerState = transitUponSelfPlayerLeftProximityArea(playerScriptIns.collisionWithPlayerState);
          }
        }
        if (0 == playerScriptIns.contactedControlledPlayers.length && 0 == playerScriptIns.contactedNPCPlayers.length) {
          transitDueToNoBodyInProximityArea(playerScriptIns.collisionWithPlayerState);
        }
        break;
      case "NPCPlayer":
        if (0 == playerScriptIns.contactedControlledPlayers.length && 0 == playerScriptIns.contactedNPCPlayers.length) {
          transitDueToNoBodyInProximityArea(playerScriptIns.collisionWithPlayerState);
        }
        break;
      default:
        break;
    } 
  },
});
