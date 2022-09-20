const BasePlayer = require("./BasePlayer"); 

cc.Class({
  extends: BasePlayer,
  // LIFE-CYCLE CALLBACKS:
  properties: {
    arrowTipNode: {
      type: cc.Node,
      default: null
    }
  },
  start() {
    BasePlayer.prototype.start.call(this);
  },

  onLoad() {
    BasePlayer.prototype.onLoad.call(this);
    this.attackedClips = {
      '01': 'attackedLeft',
      '0-1': 'attackedRight',
      '-20': 'attackedLeft',
      '20': 'attackedRight',
      '-21': 'attackedLeft',
      '21': 'attackedRight',
      '-2-1': 'attackedLeft',
      '2-1': 'attackedRight'
    };
    this.arrowTipNode.active = false;
  },

  showArrowTipNode() {
    const self = this;
    if (null == self.arrowTipNode) {
      return;
    }
    self.arrowTipNode.active = true;
    window.setTimeout(function(){
      if (null == self.arrowTipNode) {
        return;
      }
      self.arrowTipNode.active = false;
    }, 3000)
  },

  update(dt) {
    BasePlayer.prototype.update.call(this, dt);
  },

});
