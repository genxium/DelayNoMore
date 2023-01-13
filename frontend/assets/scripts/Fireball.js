cc.Class({
  extends: cc.Component,

  properties: {
    animNode: {
      type: cc.Node,
      default: null
    },
  },

  ctor() {
    this.lastUsed = -1;
    this.bulletLocalId = -1;
    this.speciesName = null;
  },

  setSpecies(speciesName, fireballBullet, rdf) {
    if (speciesName == this.speciesName) return;
    if (null != this.speciesName) {
      for (let k in this.animNode.children) {
        const child = this.children[k];
        if (!child.active) continue;
        if (child == effAnimNode || child.name == speciesName) continue;
        child.active = false;
      }
    }
    this.speciesName = speciesName;
    this.effAnimNode = this.animNode.getChildByName(this.speciesName);
    this.effAnimNode.active = true;
    //this.updateAnim(speciesName, fireballBullet, rdf);
  },

  onLoad() {},

  updateAnim(speciesName, fireballBullet, rdf) {
    this.animComp = this.effAnimNode.getComponent(cc.Animation);
    // Update directions
    if (this.animComp && this.animComp.node) {
      if (0 > fireballBullet.DirX) {
        this.animNode.scaleX = (-1.0);
      } else if (0 < fireballBullet.DirX) {
        this.animNode.scaleX = (1.0);
      }
    }

    this.animComp.play(speciesName);
  },
});
