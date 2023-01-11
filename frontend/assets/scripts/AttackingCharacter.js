const BaseCharacter = require("./BaseCharacter");

window.ATK_CHARACTER_STATE = {
  Idle1: [0, "Idle1"],
  Walking: [1, "Walking"],
  Atk1: [2, "Atk1"],
  Atked1: [3, "Atked1"],
  InAirIdle1NoJump: [4, "InAirIdle1NoJump"],
  InAirIdle1ByJump: [5, "InAirIdle1ByJump"], // The cycling part of it would be exactly "InAirIdle1NoJump"
  InAirAtk1: [6, "InAirAtk1"],
  InAirAtked1: [7, "InAirAtked1"],
  BlownUp1: [8, "BlownUp1"],
  LayDown1: [9, "LayDown1"], // The last frame of "LayDown1" should have a simliar boundingbox with the first frame of "GetUp1", otherwise the animation would seem odd
  GetUp1: [10, "GetUp1"],
  Atk2: [11, "Atk2"],
  Atk3: [12, "Atk3"],
  Atk4: [13, "Atk4"],
  Atk5: [14, "Atk5"],
  Dashing: [15, "Dashing"],
  OnWall: [16, "OnWall"],
};

window.ATK_CHARACTER_STATE_ARR = [];
for (let k in window.ATK_CHARACTER_STATE) {
  window.ATK_CHARACTER_STATE_ARR.push(window.ATK_CHARACTER_STATE[k]);
}

window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET = new Set();
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.Idle1[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.Walking[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.InAirIdle1NoJump[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.InAirIdle1ByJump[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.BlownUp1[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.LayDown1[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.GetUp1[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.Dashing[0]);
window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.add(window.ATK_CHARACTER_STATE.OnWall[0]);

window.ATK_CHARACTER_STATE_IN_AIR_SET = new Set();
window.ATK_CHARACTER_STATE_IN_AIR_SET.add(window.ATK_CHARACTER_STATE.InAirIdle1NoJump[0]);
window.ATK_CHARACTER_STATE_IN_AIR_SET.add(window.ATK_CHARACTER_STATE.InAirIdle1ByJump[0]);
window.ATK_CHARACTER_STATE_IN_AIR_SET.add(window.ATK_CHARACTER_STATE.InAirAtk1[0]);
window.ATK_CHARACTER_STATE_IN_AIR_SET.add(window.ATK_CHARACTER_STATE.InAirAtked1[0]);
window.ATK_CHARACTER_STATE_IN_AIR_SET.add(window.ATK_CHARACTER_STATE.BlownUp1[0]);
window.ATK_CHARACTER_STATE_IN_AIR_SET.add(window.ATK_CHARACTER_STATE.OnWall[0]);

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
    this.inAir = true;
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

  updateCharacterAnim(rdfPlayer, prevRdfPlayer, forceAnimSwitch, chConfig) {
    // As this function might be called after many frames of a rollback, it's possible that the playing animation was predicted, different from "prevRdfPlayer.CharacterState" but same as "newCharacterState". More granular checks are needed to determine whether we should interrupt the playing animation.  

    let newCharacterState = rdfPlayer.CharacterState;

    // Update directions
    if (this.animComp && this.animComp.node) {
      if (0 > rdfPlayer.DirX) {
        this.animNode.scaleX = (-1.0);
      } else if (0 < rdfPlayer.DirX) {
        this.animNode.scaleX = (1.0);
      }
      if (ATK_CHARACTER_STATE.OnWall[0] == newCharacterState) {
        this.animNode.scaleX *= (-1.0);
      }
    }

    let newAnimName = window.ATK_CHARACTER_STATE_ARR[newCharacterState][1];
    let playingAnimName = null;
    let underlyingAnimationCtrl = null;

    if (this.animComp instanceof dragonBones.ArmatureDisplay) {
      underlyingAnimationCtrl = this.animComp._armature.animation; // ALWAYS use the dragonBones api instead of ccc's wrapper!
      playingAnimName = underlyingAnimationCtrl.lastAnimationName;
    } else {
      underlyingAnimationCtrl = this.animComp.currentClip;
      playingAnimName = (!underlyingAnimationCtrl ? null : underlyingAnimationCtrl.name);
    }

    // It turns out that "prevRdfPlayer.CharacterState" is not useful in this function :)
    if (newAnimName == playingAnimName && window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(newCharacterState)) {
      // No need to interrupt
      // console.warn(`JoinIndex=${rdfPlayer.joinIndex}, not interrupting ${newAnimName} while the playing anim is also ${playingAnimName}, player rdf changed from: ${null == prevRdfPlayer ? null : JSON.stringify(prevRdfPlayer)}, to: ${JSON.stringify(rdfPlayer)}`);
      return;
    }

    if (this.animComp instanceof dragonBones.ArmatureDisplay) {
      this._interruptPlayingAnimAndPlayNewAnimDragonBones(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName, underlyingAnimationCtrl, playingAnimName, chConfig);
    } else {
      this._interruptPlayingAnimAndPlayNewAnimFrameAnim(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName, playingAnimName, chConfig);
    }
  },

  _interruptPlayingAnimAndPlayNewAnimDragonBones(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName, underlyingAnimationCtrl, playingAnimName, chConfig) {
    if (window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(newCharacterState)) {
      // No "framesToRecover"
      // console.warn(`#DragonBones JoinIndex=${rdfPlayer.joinIndex}, ${playingAnimName} -> ${newAnimName}`);
      underlyingAnimationCtrl.gotoAndPlayByFrame(newAnimName, 0, -1);
    } else {
      const animationData = underlyingAnimationCtrl._animations[newAnimName];
      let frameIdxInAnim = rdfPlayer.FramesInChState;
      underlyingAnimationCtrl.gotoAndPlayByFrame(newAnimName, frameIdxInAnim, 1);
    }
  },

  _interruptPlayingAnimAndPlayNewAnimFrameAnim(rdfPlayer, prevRdfPlayer, newCharacterState, newAnimName, playingAnimName, chConfig) {
    if (window.ATK_CHARACTER_STATE_INTERRUPT_WAIVE_SET.has(newCharacterState)) {
      // No "framesToRecover"
      //console.warn(`#FrameAnim JoinIndex=${rdfPlayer.joinIndex}, ${playingAnimName} -> ${newAnimName}`);
      this.animComp.play(newAnimName, 0);
      return;
    }
    // The "playTimes" counterpart is managed by each "cc.AnimationClip.wrapMode", already preset in the editor.
    const targetClip = this.animComp.getClips()[newCharacterState]; // The clips follow the exact order in ATK_CHARACTER_STATE
    let frameIdxInAnim = rdfPlayer.FramesInChState;
    if (window.ATK_CHARACTER_STATE.InAirIdle1ByJump == newCharacterState && null != chConfig) {
      frameIdxInAnim = chConfig.InAirIdleFrameIdxTurningPoint + (frameIdxInAnim - chConfig.InAirIdleFrameIdxTurningPoint) % chConfig.InAirIdleFrameIdxTurnedCycle; // TODO: Anyway to avoid using division here?
    }
    let fromTime = (frameIdxInAnim / targetClip.sample); // TODO: Anyway to avoid using division here?
    this.animComp.play(newAnimName, fromTime);
  },

});
