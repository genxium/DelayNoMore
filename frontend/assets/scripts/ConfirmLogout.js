cc.Class({
  extends: cc.Component,

  properties: {
    mapNode: {
      type: cc.Node,
      default: null, 
    }
  },

  onButtonClick(event, customData) {
    const mapScriptIns = this.mapNode.getComponent('Map');
    switch (customData) {
      case 'confirm':
        mapScriptIns.logout.bind(mapScriptIns)(true, false);
        break;
      case 'cancel':
        mapScriptIns.onLogoutConfirmationDismissed.bind(mapScriptIns)();
        break;
      default:
        break;
    }
  },
  // LIFE-CYCLE CALLBACKS:

  onLoad() {
  
  }
});
