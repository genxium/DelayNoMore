cc.Class({
    extends: cc.Component,

    properties: {
      mapNode: {
        type: cc.Node,
        default: null
      },
      speed: {
        type: cc.Float,
        default: 500
      }, 
    },

    onLoad () {
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
      const selfPlayerRichInfo = self.mapScriptIns.playerRichInfoDict.get(self.mapScriptIns.selfPlayerInfo.id);
      if (!selfPlayerRichInfo) return;
      const selfPlayerNode = selfPlayerRichInfo.node; 
      if (!selfPlayerNode) return;
      const pDiff = selfPlayerNode.position.sub(self.mainCamera.node.position); 
      pDiff.normalizeSelf();
      const newCamPos = self.mainCamera.node.position.add(pDiff.mul(dt*self.speed));
      self.mainCamera.node.setPosition(newCamPos);
    }
});
