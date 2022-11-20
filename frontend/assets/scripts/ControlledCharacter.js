const AttackingCharacter = require("./AttackingCharacter");

cc.Class({
  extends: AttackingCharacter,
  properties: {
    arrowTipNode: {
      type: cc.Node,
      default: null
    },
    coordLabel: {
      type: cc.Label,
      default: null
    }
  },

  onLoad() {
    AttackingCharacter.prototype.onLoad.call(this);
    this.arrowTipNode.active = false;

    if (!this.mapIns.showCriticalCoordinateLabels) {
      this.coordLabel.node.active = false;
    }
  },

  showArrowTipNode() {
    const self = this;
    if (null == self.arrowTipNode) {
      return;
    }
    self.arrowTipNode.active = true;
    window.setTimeout(function() {
      if (null == self.arrowTipNode) {
        return;
      }
      self.arrowTipNode.active = false;
    }, 3000)
  },

  update(dt) {
    AttackingCharacter.prototype.update.call(this, dt);
    if (this.mapIns.showCriticalCoordinateLabels) {
      this.coordLabel.string = `(${this.node.x.toFixed(2)}, ${this.node.y.toFixed(2)})`;
    }
  },

});
