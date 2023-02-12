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

  onSpeciesSelected(val) {
    for (let cell of this.characterSelectCells) {
      const comp = cell.getComponent("CharacterSelectCell");
      if (cell.speciesId != val) {
        cell.chosenFlag.active = false;
      } else {
        cell.chosenFlag.active = true;
      }
    }
  },
});
