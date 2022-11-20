const BaseCharacter = require("./BaseCharacter");

window.ATK_CHARACTER_STATE = {
  Idle1: [0, "Idle1"],
  Walking: [1, "Walking"],
  Atk1: [2, "Atk1"],
};

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
    BaseCharacter.prototype.scheduleNewDirection.call(this, newScheduledDirection, forceAnimSwitch);
    if (ATK_CHARACTER_STATE.Atk1[0] == this.characterState) {
      return;
    }

    let newCharacterState = ATK_CHARACTER_STATE.Idle1[0];
    if (0 != newScheduledDirection.dx || 0 != newScheduledDirection.dy) {
      newCharacterState = ATK_CHARACTER_STATE.Walking[0];
    }

    if (newCharacterState != this.characterState) {
      switch (newCharacterState) {
        case ATK_CHARACTER_STATE.Idle1[0]:
          this.animComp.playAnimation(ATK_CHARACTER_STATE.Idle1[1]);
          break;
        case ATK_CHARACTER_STATE.Walking[0]:
          this.animComp.playAnimation(ATK_CHARACTER_STATE.Walking[1]);
          break;
        default:
          break;
      }
      this.characterState = newCharacterState;
    }
  },
});
