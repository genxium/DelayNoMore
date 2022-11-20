module.export = cc.Class({
  extends: cc.Component,

  properties: {
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

  ctor() {},

  onLoad() {
    const self = this;
    const canvasNode = self.mapNode.parent;
    self.mapIns = self.mapNode.getComponent("Map");
    const joystickInputControllerScriptIns = canvasNode.getComponent("TouchEventsManager");
    self.ctrl = joystickInputControllerScriptIns;
  },

  scheduleNewDirection(newScheduledDirection, forceAnimSwitch) {
    if (!newScheduledDirection) {
      return;
    }

    if (forceAnimSwitch || null == this.activeDirection || (newScheduledDirection.dx != this.activeDirection.dx || newScheduledDirection.dy != this.activeDirection.dy)) {
      this.activeDirection = newScheduledDirection;
      if (this.animComp && this.animComp.node) {
        if (0 > newScheduledDirection.dx) {
          this.animComp.node.scaleX = (-1.0);
        } else if (0 < newScheduledDirection.dx) {
          this.animComp.node.scaleX = (1.0);
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

});
