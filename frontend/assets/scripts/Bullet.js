 module.export = cc.Class({
  extends: cc.Component,

  properties: {
    localIdInBattle: {
      default: null, 
    },
    linearSpeed: {
      default: 0.0,
    },
  },
    
  ctor() {
    this.ctrl = null;
    this.activeDirection = null;
  },

  onLoad() {
  },

  _calculateVecToMoveByWithChosenDir(elapsedTime, sDir) {
    if (0 == sDir.dx && 0 == sDir.dy) {
      return cc.v2();
    }
    const self = this;
    const distanceToMove = (self.linearSpeed * elapsedTime);
    const denominator = Math.sqrt(sDir.dx * sDir.dx + sDir.dy * sDir.dy);
    const unitProjDx = (sDir.dx / denominator);
    const unitProjDy = (sDir.dy / denominator);
    return cc.v2(
      distanceToMove * unitProjDx,
      distanceToMove * unitProjDy,
    );
  },

  _calculateVecToMoveBy(elapsedTime) {
    const self = this;
    if (null == self.activeDirection) {
      return null;
    }
    // Note that `sDir` used in this method MUST BE a copy in RAM.
    let sDir = {
      dx: self.activeDirection.dx,
      dy: self.activeDirection.dy,
    };

    if (0 == sDir.dx && 0 == sDir.dy) {
      return cc.v2();
    }

    return self._calculateVecToMoveByWithChosenDir(elapsedTime, sDir);
  },

  _canMoveBy(vecToMoveBy) {
    return true;
  },

  update(dt) {
    // Used only for EXTRAPOLATING the position of this bullet. The position might be corrected within `setData` as well.
    const self = this;
    if (null != self.bulletMaxDist) {
      const dxMoved = self.node.position.x - self.startAtPoint.x;
      const dyMoved = self.node.position.y - self.startAtPoint.y;
      const distanceMoved = Math.sqrt(dxMoved * dxMoved + dyMoved * dyMoved)
      self.node.opacity = 255*(1 - distanceMoved/self.bulletMaxDist);
    }

    const vecToMoveBy = self._calculateVecToMoveBy(dt);
    if (null == vecToMoveBy) {
      return;
    }
    if (self._canMoveBy(vecToMoveBy)) {
      self.node.position = self.node.position.add(vecToMoveBy);
    }
  },

  _calculateAngle(dx, dy) {
    if (dx == 0) {
      if (dy > 0) {
        return 90;
      }
      if (dy < 0) {
        return -90;
      }
    } 

    if (dx > 0) {
      if (dy == 0) {
        return 0;
      }
      if (dy > 0) {
        return 45;
      }
      if (dy < 0) {
        return -45;
      }
    } 

    if (dx < 0) {
      if (dy == 0) {
        return 180;
      }
      if (dy > 0) {
        return 135;
      }
      if (dy < 0) {
        return -135;
      }
    }

    return null;
  },

  setData(bulletLocalIdInBattle, bulletInfo, dtFromMapUpdate) {
    const targetNode = this.node;

    if (true == bulletInfo.removed) {
      return false;
    }

    if (null == bulletInfo.startAtPoint || null == bulletInfo.endAtPoint) {
      console.error(`Init bullet direction error, startAtPoint:${bulletInfo.startAtPoint}, endAtPoint:${bulletInfo.endAtPoint}`);
      return false;
    } 

    this.localIdInBattle = bulletLocalIdInBattle;
    this.linearSpeed = bulletInfo.linearSpeed * 1000000000; // The `bullet.LinearSpeed` on server-side is denoted in pts/nanoseconds. 

    const dx = bulletInfo.endAtPoint.x - bulletInfo.startAtPoint.x;
    const dy = bulletInfo.endAtPoint.y - bulletInfo.startAtPoint.y;

    const discretizedDir = this.ctrl.discretizeDirection(dx, dy, this.ctrl.joyStickEps); 
    const baseAngle = 0;
    const angleToRotate = baseAngle - this._calculateAngle(discretizedDir.dx, discretizedDir.dy);
    if (null == angleToRotate) {
      return false;
    }
    set2dRotation(targetNode, angleToRotate); 

    const newPos = cc.v2(
      bulletInfo.x,
      bulletInfo.y
    );

    if (null == this.activeDirection) {
      // Initialization.
      this.startAtPoint = bulletInfo.startAtPoint;
      this.endAtPoint = bulletInfo.endAtPoint;
      this.bulletMaxDist = 600.0; // Hardcoded temporarily, matching that in "<backend>/models/room.go". -- YFLu, 2019-09-05.
      targetNode.setPosition(newPos);
      this.activeDirection = {
        dx: 0,
        dy: 0,
      };
      return true;
    } 

    const oldPos = cc.v2(
      targetNode.x,
      targetNode.y,
    );
    const toMoveByVec = newPos.sub(oldPos);
    const toMoveByVecMag = toMoveByVec.mag();
    const toTeleportDisThreshold = (this.linearSpeed * dtFromMapUpdate * 100);
    const notToMoveDisThreshold = (this.linearSpeed * dtFromMapUpdate * 0.5);
    if (toMoveByVecMag < notToMoveDisThreshold) {
      // To stop extrapolated moving.
      this.activeDirection = {
        dx: 0,
        dy: 0,
      };
    } else {
      if (toMoveByVecMag > toTeleportDisThreshold) {
        console.log("Bullet ", bulletLocalIdInBattle, " is teleporting! Having toMoveByVecMag == ", toMoveByVecMag, ", toTeleportDisThreshold == ", toTeleportDisThreshold);
        // To stop extrapolated moving.
        this.activeDirection = {
          dx: 0,
          dy: 0
        };
        // Deliberately NOT using `cc.Action`. -- YFLu, 2019-09-04
        targetNode.setPosition(newPos);
      } else {
        // The common case which is suitable for interpolation.
        const normalizedDir = {
          dx: toMoveByVec.x / toMoveByVecMag,
          dy: toMoveByVec.y / toMoveByVecMag,
        };
        if (isNaN(normalizedDir.dx) || isNaN(normalizedDir.dy)) {
          this.activeDirection = {
            dx: 0,
            dy: 0,
          };
        } else {
          this.activeDirection = normalizedDir;
        }
      }
    }

    return true;
  },
});
