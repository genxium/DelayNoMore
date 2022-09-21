module.export = cc.Class({
  extends: cc.Component,

  properties: {
    animComp: {
      type: cc.Animation,
      default: null,
    },
    baseSpeed: {
      type: cc.Float,
      default: 300,
    },
    speed: {
      type: cc.Float,
      default: 300
    },
    lastMovedAt: {
      type: cc.Float,
      default: 0 // In "GMT milliseconds"
    },
    eps: {
      default: 0.10,
      type: cc.Float
    },
    magicLeanLowerBound: {
      default: 0.414, // Tangent of (PI/8).
      type: cc.Float
    },
    magicLeanUpperBound: {
      default: 2.414, // Tangent of (3*PI/8).
      type: cc.Float
    },
  },

  // LIFE-CYCLE CALLBACKS:
  start() {
    const self = this;
    self.contactedControlledPlayers = [];
    self.contactedNPCPlayers = [];
    self.coveringShelterZReducers = [];

    self.computedNewDifferentPosLocalToParentWithinCurrentFrame = null;
    self.actionMangerSingleton = new cc.ActionManager();
    self.activeDirection = {
      dx: 0,
      dy: 0
    };
  },

  onLoad() {
    const self = this;
    self.clips = {
      '01': 'Top',
      '0-1': 'Bottom',
      '-20': 'Left',
      '20': 'Right',
      '-21': 'TopLeft',
      '21': 'TopRight',
      '-2-1': 'BottomLeft',
      '2-1': 'BottomRight'
    };
    const canvasNode = self.mapNode.parent;
    self.mapIns = self.mapNode.getComponent("Map");
    self.contactedBarriers = [];
    const joystickInputControllerScriptIns = canvasNode.getComponent("TouchEventsManager");
    self.ctrl = joystickInputControllerScriptIns;
    self.animComp = self.node.getComponent(cc.Animation);
    self.animComp.play();
  },

  scheduleNewDirection(newScheduledDirection, forceAnimSwitch) {
    if (!newScheduledDirection) {
      return;
    }

    if (forceAnimSwitch || null == this.activeDirection || (newScheduledDirection.dx != this.activeDirection.dx || newScheduledDirection.dy != this.activeDirection.dy)) {
      this.activeDirection = newScheduledDirection;
      this.activeDirection = newScheduledDirection;
      const clipKey = newScheduledDirection.dx.toString() + newScheduledDirection.dy.toString();
      const clips = (this.attacked ? this.attackedClips : this.clips); 
      let clip = clips[clipKey];
      if (!clip) {
        // Keep playing the current anim.
        if (0 !== newScheduledDirection.dx || 0 !== newScheduledDirection.dy) {
          cc.warn('Clip for clipKey === ' + clipKey + ' is invalid: ' + clip + '.');
        }
      } else {
        this.animComp.play(clip);
        if (this.attacked) {
          cc.log(`Attacked, switching to play clipKey = ${clipKey}, clip == ${clip}, this.activeDirection == ${JSON.stringify(this.activeDirection)}, this.activeDirection == ${JSON.stringify(this.activeDirection)}.`);
        }
      }
    }
  },

  _addCoveringShelterZReducer(comp) {
    const self = this;
    for (let coveringShelterZReducer of self.coveringShelterZReducers) {
      if (coveringShelterZReducer._id == comp._id) {
        return false;
      }
    }
    self.coveringShelterZReducers.push(comp);
    return true;
  },

  _removeCoveringShelterZReducer(comp) {
    const self = this;
    self.coveringShelterZReducers = self.coveringShelterZReducers.filter((coveringShelterZReducer) => {
      return coveringShelterZReducer._id != comp._id;
    });
    return true;
  },

  _addContactedBarrier(collider) {
    const self = this;
    if (!self.contactedBarriers) {
      cc.log("self.contactedBarriers is null or undefined" + self.contactedBarriers)
    }
    for (let contactedBarrier of self.contactedBarriers) {
      if (contactedBarrier._id == collider._id) {
        return false;
      }
    }
    self.contactedBarriers.push(collider);
    return true;
  },

  _removeContactedBarrier(collider) {
    const self = this;
    self.contactedBarriers = self.contactedBarriers.filter((contactedBarrier) => {
      return contactedBarrier._id != collider._id;
    });
    return true;
  },

  _addContactedControlledPlayers(comp) {
    const self = this;
    for (let aComp of self.contactedControlledPlayers) {
      if (aComp.uuid == comp.uuid) {
        return false;
      }
    }
    self.contactedControlledPlayers.push(comp);
    return true;
  },

  _removeContactedControlledPlayer(comp) {
    const self = this;
    self.contactedControlledPlayers = self.contactedControlledPlayers.filter((aComp) => {
      return aComp.uuid != comp.uuid;
    });
    return true;
  },

  _addContactedNPCPlayers(comp) {
    const self = this;
    for (let aComp of self.contactedNPCPlayers) {
      if (aComp.uuid == comp.uuid) {
        return false;
      }
    }
    self.contactedNPCPlayers.push(comp);
    return true;
  },

  _removeContactedNPCPlayer(comp) {
    const self = this;
    self.contactedNPCPlayers = self.contactedNPCPlayers.filter((aComp) => {
      return aComp.uuid != comp.uuid;
    });
    return true;
  },

  _canMoveBy(vecToMoveBy) {
    const self = this;
    const computedNewDifferentPosLocalToParentWithinCurrentFrame = self.node.position.add(vecToMoveBy);
    self.computedNewDifferentPosLocalToParentWithinCurrentFrame = computedNewDifferentPosLocalToParentWithinCurrentFrame;

    if (tileCollisionManager.isOutOfMapNode(self.mapNode, computedNewDifferentPosLocalToParentWithinCurrentFrame)) {
      return false;
    }

    const currentSelfColliderCircle = self.node.getComponent(cc.CircleCollider);
    let nextSelfColliderCircle = null;
    if (0 < self.contactedBarriers.length) {
      /* To avoid unexpected buckling. */
      const mutatedVecToMoveBy = vecToMoveBy.mul(5); // To help it escape the engaged `contactedBarriers`.
      nextSelfColliderCircle = {
        position: self.node.position.add(mutatedVecToMoveBy).add(currentSelfColliderCircle.offset),
        radius: currentSelfColliderCircle.radius,
      };
    } else {
      nextSelfColliderCircle = {
        position: computedNewDifferentPosLocalToParentWithinCurrentFrame.add(currentSelfColliderCircle.offset),
        radius: currentSelfColliderCircle.radius,
      };
    }

    for (let contactedBarrier of self.contactedBarriers) {
      let contactedBarrierPolygonLocalToParentWithinCurrentFrame = [];
      for (let p of contactedBarrier.points) {
        contactedBarrierPolygonLocalToParentWithinCurrentFrame.push(contactedBarrier.node.position.add(p));
      }
      if (cc.Intersection.pointInPolygon(nextSelfColliderCircle.position, contactedBarrierPolygonLocalToParentWithinCurrentFrame)) {
        // Make sure that the player is "leaving" the PolygonCollider.
        return false;  
      }
      if (cc.Intersection.polygonCircle(contactedBarrierPolygonLocalToParentWithinCurrentFrame, nextSelfColliderCircle)) {
        if (null == self.firstContactedEdge) {
          return false; 
        }
        if (null != self.firstContactedEdge && self.firstContactedEdge.associatedBarrier != contactedBarrier) {
          const res = self._calculateTangentialMovementAttrs(nextSelfColliderCircle, contactedBarrier);
          if (null == res.contactedEdge) {
            // Otherwise, the current movement is going to transit smoothly onto the next PolygonCollider.
            return false; 
          }
        }
      }
    }

    return true;

    /*
     * In a subclass, use 
     * 
     * _canMoveBy(vecToMoveBy) {
     *   BasePlayer.prototype._canMoveBy.call(this, vecToMoveBy);
     *   // Customized codes.
     * }
     *
     * Reference http://www.cocos2d-x.org/docs/creator/manual/en/scripting/reference/class.html#override
     */
  },

  _calculateTangentialMovementAttrs(currentSelfColliderCircle, contactedBarrier) {
    /*
     * Theoretically when the `contactedBarrier` is a convex polygon and the `PlayerCollider` is a circle, there can be only 1 `contactedEdge` for each `contactedBarrier`. Except only for around the corner.
     *
     * We should avoid the possibility of players hitting the "corners of convex polygons" by map design wherever & whenever possible.
     *
     */
    const self = this;
    const sDir = self.activeDirection;
    const currentSelfColliderCircleCentrePos = (currentSelfColliderCircle.position ? currentSelfColliderCircle.position : self.node.position.add(currentSelfColliderCircle.offset));
    const currentSelfColliderCircleRadius = currentSelfColliderCircle.radius;
    let contactedEdgeCandidateList = [];
    let skinDepthThreshold = 0.45*currentSelfColliderCircleRadius;
    for (let i = 0; i < contactedBarrier.points.length; ++i) {
      const stPoint = contactedBarrier.points[i].add(contactedBarrier.offset).add(contactedBarrier.node.position);
      const edPoint = (i == contactedBarrier.points.length - 1 ? contactedBarrier.points[0].add(contactedBarrier.offset).add(contactedBarrier.node.position) : contactedBarrier.points[1 + i].add(contactedBarrier.offset).add(contactedBarrier.node.position));
      const tmpVSt = stPoint.sub(currentSelfColliderCircleCentrePos);
      const tmpVEd = edPoint.sub(currentSelfColliderCircleCentrePos);
      const crossProdScalar = tmpVSt.cross(tmpVEd);
      if (0 < crossProdScalar) {
        // If moving parallel along `st <-> ed`, the trajectory of `currentSelfColliderCircleCentrePos` will cut inside the polygon. 
        continue; 
      } 
      const dis = cc.Intersection.pointLineDistance(currentSelfColliderCircleCentrePos, stPoint, edPoint, true); 
      if (dis > currentSelfColliderCircleRadius) continue;
      if (dis < skinDepthThreshold) continue;
      contactedEdgeCandidateList.push({
        st: stPoint, 
        ed: edPoint,
        associatedBarrier: contactedBarrier,
      });
    }
    let contactedEdge = null;
    let contactedEdgeDir = null;
    let largestInnerProdAbs = Number.MIN_VALUE;

    if (0 < contactedEdgeCandidateList.length) {
      const sDirMag = Math.sqrt(sDir.dx * sDir.dx + sDir.dy * sDir.dy);
      for (let contactedEdgeCandidate of contactedEdgeCandidateList) {  
        const tmp = contactedEdgeCandidate.ed.sub(contactedEdgeCandidate.st);
        const contactedEdgeDirCandidate = {
          dx: tmp.x,
          dy: tmp.y,
        };
        const contactedEdgeDirCandidateMag = Math.sqrt(contactedEdgeDirCandidate.dx * contactedEdgeDirCandidate.dx + contactedEdgeDirCandidate.dy * contactedEdgeDirCandidate.dy);
        const innerDotProd = (sDir.dx * contactedEdgeDirCandidate.dx + sDir.dy * contactedEdgeDirCandidate.dy)/(sDirMag * contactedEdgeDirCandidateMag); 
        const innerDotProdThresholdMag = 0.7;
        if ((0 > innerDotProd && innerDotProd > -innerDotProdThresholdMag) || (0 < innerDotProd && innerDotProd < innerDotProdThresholdMag)) {
          // Intentionally left blank, in this case the player is trying to escape from the `contactedEdge`.    
          continue;
        } else if (innerDotProd > 0) {
          const abs = Math.abs(innerDotProd);
          if (abs > largestInnerProdAbs) {
            contactedEdgeDir = contactedEdgeDirCandidate; 
            contactedEdge = contactedEdgeCandidate;
          }
        } else {
          const abs = Math.abs(innerDotProd);
          if (abs > largestInnerProdAbs) {
            contactedEdgeDir = {
              dx: -contactedEdgeDirCandidate.dx,
              dy: -contactedEdgeDirCandidate.dy,
            };
            contactedEdge = contactedEdgeCandidate; 
          }
        }
      }
    } 
    return {
      contactedEdgeDir: contactedEdgeDir,
      contactedEdge: contactedEdge, 
    }; 
  },

  _calculateVecToMoveByWithChosenDir(elapsedTime, sDir) {
    if (0 == sDir.dx && 0 == sDir.dy) {
      return cc.v2();
    }
    const self = this;
    const distanceToMove = (self.speed * elapsedTime);
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
    // Note that `sDir` used in this method MUST BE a copy in RAM.
    let sDir = {
      dx: self.activeDirection.dx,
      dy: self.activeDirection.dy,
    };

    if (0 == sDir.dx && 0 == sDir.dy) {
      return cc.v2();
    }

    self.firstContactedEdge = null; // Reset everytime (temporary algorithm design, might change later).
    if (0 < self.contactedBarriers.length) {
      /*
       * Hardcoded to take care of only the 1st `contactedEdge` of the 1st `contactedBarrier` for now. Each `contactedBarrier` must be "counterclockwisely convex polygonal", otherwise sliding doesn't work! 
       *
       */
      const contactedBarrier = self.contactedBarriers[0]; 
      const currentSelfColliderCircle = self.node.getComponent(cc.CircleCollider);
      const res = self._calculateTangentialMovementAttrs(currentSelfColliderCircle, contactedBarrier);
      if (res.contactedEdge) {
        self.firstContactedEdge = res.contactedEdge; 
        sDir = res.contactedEdgeDir;
      }
    } 
    return self._calculateVecToMoveByWithChosenDir(elapsedTime, sDir);
  },

  update(dt) {
    const self = this;
    const vecToMoveBy = self._calculateVecToMoveBy(self.mapIns.rollbackEstimatedDt); // To be consistent w.r.t. rollback dynamics
    // console.log("activeDirection=", self.activeDirection, "vecToMoveBy=", vecToMoveBy, ", computedNewDifferentPosLocalToParentWithinCurrentFrame=", self.computedNewDifferentPosLocalToParentWithinCurrentFrame);
    if (self._canMoveBy(vecToMoveBy)) {
      self.node.position = self.computedNewDifferentPosLocalToParentWithinCurrentFrame;
    }
  },

  lateUpdate(dt) {
    const self = this;
    self.activeDirection.dx = self.activeDirection.dx;
    self.activeDirection.dy = self.activeDirection.dy;
    const now = new Date().getTime();
    self.lastMovedAt = now;
  },

  onCollisionEnter(other, self) {
    const playerScriptIns = self.node.getComponent("SelfPlayer");
    switch (other.node.name) {
      case "NPCPlayer":
        if ("NPCPlayer" != self.node.name) {
          other.node.getComponent('NPCPlayer').showProfileTrigger();
        }
        playerScriptIns._addContactedNPCPlayers(other);
        break;
      case "PolygonBoundaryBarrier":
        playerScriptIns._addContactedBarrier(other);
        break;
      case "PolygonBoundaryShelter":
        break;
      case "PolygonBoundaryShelterZReducer":
        playerScriptIns._addCoveringShelterZReducer(other);
        if (1 == playerScriptIns.coveringShelterZReducers.length) {
          setLocalZOrder(self.node, 2);
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
    const playerScriptIns = self.getComponent("SelfPlayer");
    switch (other.node.name) {
      case "NPCPlayer":
        other.node.getComponent('NPCPlayer').hideProfileTrigger();
        playerScriptIns._removeContactedNPCPlayer(other);
        break;
      case "PolygonBoundaryBarrier":
        playerScriptIns._removeContactedBarrier(other);
        break;
      case "PolygonBoundaryShelter":
        break;
      case "PolygonBoundaryShelterZReducer":
        playerScriptIns._removeCoveringShelterZReducer(other);
        if (0 == playerScriptIns.coveringShelterZReducers.length) {
          setLocalZOrder(self.node, 5);
        }
        break;
      default:
        break;
    }
  },

  _generateRandomDirection() {
    return ALL_DISCRETE_DIRECTIONS_CLOCKWISE[Math.floor(Math.random() * ALL_DISCRETE_DIRECTIONS_CLOCKWISE.length)];
  },

  _generateRandomDirectionExcluding(toExcludeDx, toExcludeDy) {
    let randomDirectionList = [];
    let exactIdx = null;
    for (let ii = 0; ii < ALL_DISCRETE_DIRECTIONS_CLOCKWISE.length; ++ii) {
      if (toExcludeDx != ALL_DISCRETE_DIRECTIONS_CLOCKWISE[ii].dx || toExcludeDy != ALL_DISCRETE_DIRECTIONS_CLOCKWISE[ii].dy) continue;
      exactIdx = ii;
      break;
    }
    if (null == exactIdx) {
      return this._generateRandomDirection();
    }

    for (let ii = 0; ii < ALL_DISCRETE_DIRECTIONS_CLOCKWISE.length; ++ii) {
      if (ii == exactIdx || ((ii - 1) % ALL_DISCRETE_DIRECTIONS_CLOCKWISE.length) == exactIdx || ((ii + 1) % ALL_DISCRETE_DIRECTIONS_CLOCKWISE.length) == exactIdx) continue;
      randomDirectionList.push(ALL_DISCRETE_DIRECTIONS_CLOCKWISE[ii]);
    }
    return randomDirectionList[Math.floor(Math.random() * randomDirectionList.length)]
  },

  updateSpeed(proposedSpeed) {
    if (0 == proposedSpeed && 0 < this.speed) {
      this.startFrozenDisplay(); 
    } 
    if (0 < proposedSpeed && 0 == this.speed) {
      this.stopFrozenDisplay(); 
    } 
    this.speed = proposedSpeed; 
  },

  startFrozenDisplay() {
    const self =  this;
    self.attacked = true;
  },

  stopFrozenDisplay() {
    const self = this;
    self.attacked = false;
  },
});
