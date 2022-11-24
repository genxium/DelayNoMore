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

  updateCharacterAnim(newScheduledDirection, rdfPlayer, forceAnimSwitch) {
    if (0 == rdfPlayer.framesToRecover) {
      // Update directions
      if (forceAnimSwitch || null == this.activeDirection || (null != newScheduledDirection && (newScheduledDirection.dx != this.activeDirection.dx || newScheduledDirection.dy != this.activeDirection.dy))) {
        this.activeDirection = newScheduledDirection;
        if (this.animComp && this.animComp.node) {
          if (0 > newScheduledDirection.dx) {
            this.animComp.node.scaleX = (-1.0);
          } else if (0 < newScheduledDirection.dx) {
            this.animComp.node.scaleX = (1.0);
          }
        }
      }
    }

    // Update per character state
    let newCharacterState = rdfPlayer.characterState;
    const newAnimName = window.ATK_CHARACTER_STATE_ARR[newCharacterState][1];
    if (newAnimName != this.animComp.animationName) {
      this.animComp.playAnimation(newAnimName);
    // console.log(`JoinIndex=${this.joinIndex}, Resetting anim to ${newAnimName}, dir changed: (${oldDx}, ${oldDy}) -> (${newScheduledDirection.dx}, ${newScheduledDirection.dy})`);
    }
  },
});
