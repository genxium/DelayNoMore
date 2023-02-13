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
    loadingNode: {
      default: null,
      type: cc.Node
    },
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {
  },

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
    for (let cell of this.characterSelectCells) {
      const comp = cell.getComponent("CharacterSelectCell");
      comp.setInteractable(false);
    }
    this.modeButton.node.active = false;
    this.loadingNode.active = true;
    this.loadingNode.runAction(
      cc.repeatForever(cc.rotateBy(1.0, 360))
    );
    this.mapNode.getComponent("Map").onGameRule1v1ModeClicked(this.chosenSpeciesId);
  },
});
