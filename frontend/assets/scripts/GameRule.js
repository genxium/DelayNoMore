cc.Class({
  extends: cc.Component,

  properties: {
    modeButton: {
      type: cc.Button,
      default: null
    },
    mapNode: {
      type: cc.Node,
      default: null
    },
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {
    const modeBtnClickEventHandler = new cc.Component.EventHandler();
    modeBtnClickEventHandler.target = this.mapNode; 
    modeBtnClickEventHandler.component = "Map";
    modeBtnClickEventHandler.handler = "onGameRule1v1ModeClicked";
    this.modeButton.clickEvents.push(modeBtnClickEventHandler);
  }
  
});
