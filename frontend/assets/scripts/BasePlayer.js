module.export = cc.Class({
  extends: cc.Component,

  properties: {
    animComp: {
      type: cc.Animation,
      default: null,
    },
    lastMovedAt: {
      type: cc.Float,
      default: 0 // In "GMT milliseconds"
    }
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
      '02': 'Top',
      '0-2': 'Bottom',
      '-20': 'Left',
      '20': 'Right',
      '-11': 'TopLeft',
      '11': 'TopRight',
      '-1-1': 'BottomLeft',
      '1-1': 'BottomRight'
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

  update(dt) {},

  lateUpdate(dt) {},

  _generateRandomDirection() {
    return ALL_DISCRETE_DIRECTIONS_CLOCKWISE[Math.floor(Math.random() * ALL_DISCRETE_DIRECTIONS_CLOCKWISE.length)];
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
    const self = this;
    self.attacked = true;
  },

  stopFrozenDisplay() {
    const self = this;
    self.attacked = false;
  },
});
