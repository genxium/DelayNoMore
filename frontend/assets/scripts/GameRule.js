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
    characterSelectCells: {
      type: cc.Node,
      default: []
    },
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {
    const modeBtnClickEventHandler = new cc.Component.EventHandler();
    modeBtnClickEventHandler.target = this.mapNode;
    modeBtnClickEventHandler.component = "Map";
    modeBtnClickEventHandler.handler = "onGameRule1v1ModeClicked";
    this.modeButton.clickEvents.push(modeBtnClickEventHandler);
  },

  onSpeciesSelected(evt, val) {
    for (let cell of this.characterSelectCells) {
      const comp = cell.getComponent("CharacterSelectCell");
      if (comp.speciesId != val) {
        comp.chosenFlag.node.active = false;
      } else {
        comp.chosenFlag.node.active = true;
      }
    }
  },
});
