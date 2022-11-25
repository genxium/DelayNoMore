const BaseCharacter = require("./BaseCharacter");

window.ATK_CHARACTER_STATE = {
  Idle1: [0, "Idle1"],
  Walking: [1, "Walking"],
  Atk1: [2, "Atk1"],
  Atked1: [3, "Atked1"],
};

window.ATK_CHARACTER_STATE_ARR = [];
for (let k in window.ATK_CHARACTER_STATE) {
  window.ATK_CHARACTER_STATE_ARR.push(window.ATK_CHARACTER_STATE[k]);
}

cc.Class({
  extends: BaseCharacter,
  properties: {
    animNode: {
      type: cc.Node,
      default: null
    },
  },

  ctor() {
    this.speciesName = null;
    this.hp = 100;
    this.maxHp = 100;
    this.framesToRecover = 0;
  },

  setSpecies(speciesName) {
    this.speciesName = speciesName;
    this.effAnimNode = this.animNode.getChildByName(this.speciesName);
    this.animComp = this.effAnimNode.getComponent(dragonBones.ArmatureDisplay);
    this.animComp.playAnimation(ATK_CHARACTER_STATE.Idle1[1]);
    this.effAnimNode.active = true;
  },

  onLoad() {
    BaseCharacter.prototype.onLoad.call(this);
  },

  updateCharacterAnim(rdfPlayer, prevRdfPlayer, forceAnimSwitch) {
    // Update directions
    if (this.animComp && this.animComp.node) {
      if (0 > rdfPlayer.dirX) {
        this.animComp.node.scaleX = (-1.0);
      } else if (0 < rdfPlayer.dirX) {
        this.animComp.node.scaleX = (1.0);
      }
    }

    // Update per character state
    let newCharacterState = rdfPlayer.characterState;
    let prevCharacterState = (null == prevRdfPlayer ? window.ATK_CHARACTER_STATE.Idle1[0] : prevRdfPlayer.characterState);
    if (newCharacterState != prevCharacterState) {
      // Anim is edge-triggered
      const newAnimName = window.ATK_CHARACTER_STATE_ARR[newCharacterState][1];
      if (newAnimName != this.animComp.animationName) {
        this.animComp.playAnimation(newAnimName);
        console.log(`JoinIndex=${rdfPlayer.joinIndex}, Resetting anim to ${newAnimName}, state changed: (${prevCharacterState}, prevRdfPlayer is null? ${null == prevRdfPlayer}) -> (${newCharacterState})`);
      }
    }
  },
});
