window.BULLET_STATE = {
  Startup: 0,
  Active: 1,
  Exploding: 2,
};

cc.Class({
  extends: cc.Component,

  properties: {
    animNode: {
      type: cc.Node,
      default: null
    },
  },

  updateAnim(newAnimName, frameIdxInAnim, dirX, spontaneousLooping, rdf, newAnimIdx) {
    this.animComp = this.effAnimNode.getComponent(cc.Animation);
    // Update directions
    if (this.animComp && this.animComp.node) {
      if (0 > dirX) {
        this.animNode.scaleX = (-1.0);
      } else if (0 < dirX) {
        this.animNode.scaleX = (1.0);
      }
    }

    const currentClip = this.animComp.currentClip;
    if (true == spontaneousLooping && (null != currentClip && currentClip.name == newAnimName)) {
      return;
    }
    const targetClip = this.animComp.getClips()[newAnimIdx]; 
    let fromTime = (frameIdxInAnim / targetClip.sample); // TODO: Anyway to avoid using division here?
    this.animComp.play(newAnimName, fromTime);
  },
});
