module.export = cc.Class({
  extends: cc.Component,

  properties: {
    animComp: {
      type: cc.Animation,
      default: null,
    },
    baseSpeed: {
      type: cc.Float,
      default: 50,
    },
    speed: {
      type: cc.Float,
      default: 50
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

  update(dt) {
  },

  lateUpdate(dt) {
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
