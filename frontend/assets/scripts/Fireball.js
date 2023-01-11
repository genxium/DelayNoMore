cc.Class({
  extends: cc.Component,

  ctor() {
    this.lastUsed = -1;
    this.bulletLocalId = -1;
    this.speciesName = null;
  },

  setSpecies(speciesName, fireballBullet, rdf) {
    if (speciesName == this.speciesName) return;
    this.speciesName = speciesName;
    this.effAnimNode = this.node.getChildByName(this.speciesName);
    this.animComp = this.effAnimNode.getComponent(cc.Animation);
    this.effAnimNode.active = true;
    for (let k in this.children) {
      const child = this.children[k];
      if (!child.active) continue;
      if (child == effAnimNode || child.name == speciesName) continue;
      child.active = false;
    }
    this.updateAnim(speciesName, fireballBullet, rdf);
  },

  onLoad() {},

  updateAnim(speciesName, fireballBullet, rdf) {
    // Update directions
    if (this.animComp && this.animComp.node) {
      if (0 > fireballBullet.DirX) {
        this.effAnimNode.scaleX = (-1.0);
      } else if (0 < fireballBullet.DirX) {
        this.effAnimNode.scaleX = (1.0);
      }
    }

    this.animComp.play(speciesName);
  },
});
