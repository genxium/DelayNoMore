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
    chosenSpeciesId: {
      type: cc.Integer,
      default: 0
    },
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {},

  onSpeciesSelected(evt, val) {
    for (let cell of this.characterSelectCells) {
      const comp = cell.getComponent("CharacterSelectCell");
      if (comp.speciesId != val) {
        comp.chosenFlag.node.active = false;
      } else {
        comp.chosenFlag.node.active = true;
        this.chosenSpeciesId = val;
      }
    }
  },

  onModeButtonClicked(evt) {
    this.mapNode.getComponent("Map").onGameRule1v1ModeClicked(this.chosenSpeciesId);
  },
});
