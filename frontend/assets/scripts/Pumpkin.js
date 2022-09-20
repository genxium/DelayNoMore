const Bullet = require("./Bullet");

cc.Class({
  extends: Bullet,
  // LIFE-CYCLE CALLBACKS:
  properties: {
  },

  onLoad() {
    Bullet.prototype.onLoad.call(this);
  },

});
