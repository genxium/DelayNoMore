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

window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET = new Set();
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.Idle1[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.Walking[0]);

/*
Kindly note that the use of dragonBones anim is an informed choice for the feasibility of "gotoAndPlayByFrame", which is a required feature by "Map.rollbackAndChase". You might find that "cc.Animation" -- the traditional frame anim -- can also suffice this requirement, yet if we want to develop 3D frontend in the future, working with skeletal anim will make a smoother transition.

Moreover, frame anim doesn't support "compositie playing" and consumes more memory (yet less CPU) than a same skeletal anim, thus should only be used properly.

I've also spent sometime in extending "ccc wrapped dragoneBones.ArmatureDisplay" for enabling "gotoAndPlayByFrame" in CACHE mode (in REALTIME mode it's just the same as what's done here), but the debugging is an unexpected brainteaser -- not worth the time.
*/
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
  },

  onLoad() {
    BaseCharacter.prototype.onLoad.call(this);
    this.effAnimNode = this.animNode.getChildByName(this.speciesName);
    this.animComp = this.effAnimNode.getComponent(dragonBones.ArmatureDisplay);
    if (!this.animComp) {
      this.animComp = this.effAnimNode.getComponent(cc.Animation);
    }
    this.effAnimNode.active = true;
  },

  updateCharacterAnim(rdfPlayer, prevRdfPlayer, forceAnimSwitch) {
    if (this.animComp instanceof dragonBones.ArmatureDisplay) {
      const underlyingAnimationCtrl = this.animComp._armature.animation; // ALWAYS use the dragonBones api instead of ccc's wrapper!
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
      const newAnimName = window.ATK_CHARACTER_STATE_ARR[newCharacterState][1];
      const playingAnimName = underlyingAnimationCtrl.lastAnimationName;
      const isPlaying = underlyingAnimationCtrl.isPlaying;

      // As this function might be called after many frames of a rollback, it's possible that the playing animation was predicted, different from "prevRdfPlayer.characterState" but same as "newCharacterState". More granular checks are needed to determine whether we should interrupt the playing animation.  
      // It turns out that "prevRdfPlayer.characterState" is not useful in this function :)
      if (newAnimName == playingAnimName && window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(newCharacterState)) {
        // No need to interrupt
        // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, not interrupting ${newAnimName} while the playing anim is also ${playingAnimName}, player rdf changed from: ${null == prevRdfPlayer ? null : JSON.stringify(prevRdfPlayer)}, , to: ${JSON.stringify(rdfPlayer)}`);
        return;
      }
      this._interruptPlayingAnimAndPlayNewAnimDragonBones(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName, underlyingAnimationCtrl);
    }
  },

  _interruptPlayingAnimAndPlayNewAnimFrame(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName, underlyingAnimationCtrl) {
    if (window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(newCharacterState)) {
      // No "framesToRecover"
      // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, playing new ${newAnimName} from the beginning: while the playing anim is ${playAnimation}, player rdf changed from: ${null == prevRdfPlayer ? null : JSON.stringify(prevRdfPlayer)}, , to: ${JSON.stringify(rdfPlayer)}`);
      underlyingAnimationCtrl.gotoAndPlayByFrame(newAnimName, 0, -1);
      return;
    }
    const animationData = underlyingAnimationCtrl._animations[newAnimName];
    let fromAnimFrame = (animationData.frameCount - rdfPlayer.framesToRecover);
    if (fromAnimFrame > 0) {
    } else if (fromAnimFrame < 0) {
      // For Atk1 or Atk2, it's possible that the "meleeBullet.recoveryFrames" is configured to be slightly larger than corresponding animation duration frames
      fromAnimFrame = 0;
    }
    underlyingAnimationCtrl.gotoAndPlayByFrame(newAnimName, fromAnimFrame, 1);
  },

  _interruptPlayingAnimAndPlayNewAnimDragonBones(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName, underlyingAnimationCtrl) {
    if (ATK_CHARACTER_STATE.Idle1[0] == newCharacterState || ATK_CHARACTER_STATE.Walking[0] == newCharacterState) {
      // No "framesToRecover"
      // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, playing new ${newAnimName} from the beginning: while the playing anim is ${playAnimation}, player rdf changed from: ${null == prevRdfPlayer ? null : JSON.stringify(prevRdfPlayer)}, , to: ${JSON.stringify(rdfPlayer)}`);
      underlyingAnimationCtrl.gotoAndPlayByFrame(newAnimName, 0, -1);
    } else {
      const animationData = underlyingAnimationCtrl._animations[newAnimName];
      let fromAnimFrame = (animationData.frameCount - rdfPlayer.framesToRecover);
      if (fromAnimFrame > 0) {
      } else if (fromAnimFrame < 0) {
        // For Atk1 or Atk2, it's possible that the "meleeBullet.recoveryFrames" is configured to be slightly larger than corresponding animation duration frames
        fromAnimFrame = 0;
      }
      underlyingAnimationCtrl.gotoAndPlayByFrame(newAnimName, fromAnimFrame, 1);
    }
  },
});
