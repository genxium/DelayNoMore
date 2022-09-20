cc.Class({
  extends: cc.Component,

  properties: {
    countdownSeconds : {
      type: cc.Label,
      default: null
    },
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {
  },

  setData() {
    this.startedMillis = Date.now();
    this.durationMillis = 3000;  
  },

  update() {
    const currentGMTMillis = Date.now();
    const elapsedMillis = currentGMTMillis - this.startedMillis;
    let remainingMillis = this.durationMillis - elapsedMillis;
    if (remainingMillis <= 0) {
       remainingMillis = 0;  
    }
    let remaingHint = "" + Math.round(remainingMillis / 1000 ); 
    if (remaingHint != this.countdownSeconds.string) {
      this.countdownSeconds.string = remaingHint;
    }
  }
});
