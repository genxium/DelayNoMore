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
    this.characterState = ATK_CHARACTER_STATE.Idle1[0];
  },

  scheduleNewDirection(newScheduledDirection, forceAnimSwitch) {
    const oldDx = this.activeDirection.dx, oldDy = this.activeDirection.dy; 
    BaseCharacter.prototype.scheduleNewDirection.call(this, newScheduledDirection, forceAnimSwitch);
    if (ATK_CHARACTER_STATE.Atk1[0] == this.characterState) {
      return;
    }

    let newCharacterState = ATK_CHARACTER_STATE.Idle1[0];
    if (0 != newScheduledDirection.dx || 0 != newScheduledDirection.dy) {
      newCharacterState = ATK_CHARACTER_STATE.Walking[0];
    }

    if (newCharacterState != this.characterState) {
      this.characterState = newCharacterState;
      const newAnimName = window.ATK_CHARACTER_STATE_ARR[newCharacterState][1];
      if (newAnimName != this.animComp.animationName) {
        this.animComp.playAnimation(newAnimName);
    	// console.log(`JoinIndex=${this.joinIndex}, Resetting anim to ${newAnimName}, dir changed: (${oldDx}, ${oldDy}) -> (${newScheduledDirection.dx}, ${newScheduledDirection.dy})`);
      }
    }
  },
});
