module.export = cc.Class({
  extends: cc.Component,

  properties: {
    lastMovedAt: {
      type: cc.Float,
      default: 0 // In "GMT milliseconds"
    }
  },

  ctor() {
    this.activeDirection = {
      dx: 0,
      dy: 0
    };
  },

  onLoad() {
    const self = this;
    const canvasNode = self.mapNode.parent;
    self.mapIns = self.mapNode.getComponent("Map");
    const joystickInputControllerScriptIns = canvasNode.getComponent("TouchEventsManager");
    self.ctrl = joystickInputControllerScriptIns;
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
