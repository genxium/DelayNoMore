cc.Class({
  extends: cc.Component,
  properties: {
    panelNode: {
      type: cc.Node,
      default: null
    },
    chosenFlag: {
      type: cc.Sprite,
      default: null
    },
    avatarNode: {
      type: cc.Button,
      default: null
    },
    animNode: {
      type: cc.Node,
      default: null
    },
    speciesId: {
      type: cc.Integer,
      default: 0
    },
  },

  ctor() {},

  setInteractable(enabled) {
    this.avatarNode.interactable = enabled;
  },

  onLoad() {
    const avatarNodeClickEventHandler = new cc.Component.EventHandler();
    avatarNodeClickEventHandler.target = this.panelNode;
    avatarNodeClickEventHandler.component = "GameRule";
    avatarNodeClickEventHandler.handler = "onSpeciesSelected";
    avatarNodeClickEventHandler.customEventData = this.speciesId;
    this.avatarNode.clickEvents.push(avatarNodeClickEventHandler);
  },
});

