const Bullet = require("./Bullet");

cc.Class({
  extends: Bullet,

  ctor() {
    this.lastUsed = -1;
    this.bulletLocalId = -1;
    this.speciesName = null;
  },

  setSpecies(speciesName, fireballBullet, rdf) {
    if (speciesName == this.speciesName) return;
    if (null != this.speciesName) {
      for (let k in this.animNode.children) {
        const child = this.animNode.children[k];
        if (!child.active) continue;
        if (child == this.effAnimNode || child.name == speciesName) continue;
        child.active = false;
      }
    }
    this.speciesName = speciesName;
    this.effAnimNode = this.animNode.getChildByName(this.speciesName);
    this.effAnimNode.active = true;
  },

  onLoad() {},

});
