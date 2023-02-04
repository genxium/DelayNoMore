cc.Class({
  extends: cc.Component,

  properties: {
    mapNode: {
      type: cc.Node,
      default: null
    },
    speed: {
      type: cc.Float,
      default: 100
    },
  },

  onLoad() {
    this.mainCamera = this.mapNode.parent.getChildByName("Main Camera").getComponent(cc.Camera);
    this.mapScriptIns = this.mapNode.getComponent("Map");
  },

  start() {},

  update(dt) {
    const self = this;
    if (!self.mainCamera) return;
    if (!self.mapScriptIns) return;
    if (!self.mapScriptIns.selfPlayerInfo) return;
    if (!self.mapScriptIns.playerRichInfoDict) return;
    const selfPlayerRichInfo = self.mapScriptIns.playerRichInfoDict.get(self.mapScriptIns.selfPlayerInfo.Id);
    if (!selfPlayerRichInfo) return;
    const selfPlayerNode = selfPlayerRichInfo.node;
    if (!selfPlayerNode) return;
    const dst = cc.v2().sub(selfPlayerNode.position);
    const pDiff = dst.sub(self.mapNode.position);
    const stepLength = dt * self.speed;
    if (stepLength > pDiff.mag()) {
      self.mapNode.setPosition(dst);
    } else {
      pDiff.normalizeSelf();
      const newMapPos = self.mapNode.position.add(pDiff.mul(dt * self.speed));
      self.mapNode.setPosition(newMapPos);
    }
  }
});
