cc.Class({
  extends: cc.Component,

  properties: {
    BGMEffect: {
      type: cc.AudioClip,
      default: null
    },
    crashedByTrapBullet: {
      type: cc.AudioClip,
      default: null
    },
    highScoreTreasurePicked: {
      type: cc.AudioClip,
      default: null
    },
    treasurePicked: {
      type: cc.AudioClip,
      default: null
    },
    countDown10SecToEnd: {
      type: cc.AudioClip,
      default: null
    },
    mapNode: {
      type: cc.Node,
      default: null
   },
  },

  // LIFE-CYCLE CALLBACKS:

  onLoad() {
    cc.audioEngine.setEffectsVolume(1);
    cc.audioEngine.setMusicVolume(0.5);
  },
  stopAllMusic() {
     cc.audioEngine.stopAll();
  },
  playBGM() {
    if(this.BGMEffect) {
        cc.audioEngine.playMusic(this.BGMEffect, true);
    }
  },
  playCrashedByTrapBullet() {
    if(this.crashedByTrapBullet) {
        cc.audioEngine.playEffect(this.crashedByTrapBullet, false);
    }
  },
  playHighScoreTreasurePicked() {
    if(this.highScoreTreasurePicked) {
        cc.audioEngine.playEffect(this.highScoreTreasurePicked, false);
    }
  },
  playTreasurePicked() {
    if(this.treasurePicked) {
        cc.audioEngine.playEffect(this.treasurePicked, false);
    }
  },
  playCountDown10SecToEnd() {
    if(this.countDown10SecToEnd) {
        cc.audioEngine.playEffect(this.countDown10SecToEnd, false);
    }
  },
});

