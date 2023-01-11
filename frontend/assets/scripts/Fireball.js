cc.Class({
  extends: cc.Component,

  ctor() {
    this.lastUsed = -1;
    this.bulletLocalId = -1;
    this.speciesName = null;
  },

  setSpecies(speciesName) {
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
  },

  onLoad() {
  },
});
