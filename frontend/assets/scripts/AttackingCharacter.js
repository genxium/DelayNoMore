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
    const newAnimName = window.ATK_CHARACTER_STATE_ARR[newCharacterState][1];

    // As this function might be called after many frames of a rollback, it's possible that the playing animation was predicted, different from "prevCharacterState" but same as "newCharacterState". More granular checks are needed to determine whether we should interrupt the playing animation.  
    if (newCharacterState != prevCharacterState) {
      if (newAnimName == this.animComp.animationName) {
        if (ATK_CHARACTER_STATE.Idle1[0] == newCharacterState || ATK_CHARACTER_STATE.Walking[0] == newCharacterState) {
          // No need to interrupt
          // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, not interrupting ${newAnimName} while the playing anim is also ${this.animComp.animationName}, player rdf changed from: ${null == prevRdfPlayer ? null : JSON.stringify(prevRdfPlayer)}, , to: ${JSON.stringify(rdfPlayer)}`);
          return;
        }
      }
      this._interruptPlayingAnimAndPlayNewAnim(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName);
    } else {
      // newCharacterState == prevCharacterState
      if (newAnimName != this.animComp.animationName) {
        // the playing animation was falsely predicted
        this._interruptPlayingAnimAndPlayNewAnim(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName);
      }
    }
  },

  _interruptPlayingAnimAndPlayNewAnim(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName) {
    if (ATK_CHARACTER_STATE.Idle1[0] == newCharacterState || ATK_CHARACTER_STATE.Walking[0] == newCharacterState) {
      // No "framesToRecover"
      // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, playing new ${newAnimName} from the beginning: while the playing anim is ${this.animComp.animationName}, player rdf changed from: ${null == prevRdfPlayer ? null : JSON.stringify(prevRdfPlayer)}, , to: ${JSON.stringify(rdfPlayer)}`);
      this.animComp.playAnimation(newAnimName);
    } else {
      const animationData = this.animComp._armature.animation._animations[newAnimName];
      let fromAnimFrame = (animationData.frameCount - rdfPlayer.framesToRecover);
      if (fromAnimFrame > 0) {
        // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, playing ${newAnimName} from the middle: rdfPlayer.framesToRecover=${rdfPlayer.framesToRecover} while the playing anim is ${this.animComp.animationName}, player rdf changed from: ${null == prevRdfPlayer ? null : JSON.stringify(prevRdfPlayer)}`);
      } else if (fromAnimFrame < 0) {
        // For Atk1 or Atk2, it's possible that the "meleeBullet.recoveryFrames" is configured to be slightly larger than corresponding animation duration frames
        fromAnimFrame = 0;
      }
      // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, playing ${newAnimName} from the middle: fromAnimFrame=${fromAnimFrame}, animFrameCount=${animationData.frameCount}, rdfPlayer.framesToRecover=${rdfPlayer.framesToRecover} while the playing anim is ${this.animComp.animationName}`);
      this.animComp._armature.animation.gotoAndPlayByFrame(newAnimName, fromAnimFrame);
    }
  },
});
