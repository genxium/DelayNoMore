window.LOW_SCORE_TREASURE_TYPE = 1;
window.HIGH_SCORE_TREASURE_TYPE = 2;

window.LOW_SCORE_TREASURE_SCORE = 100;
window.HIGH_SCORE_TREASURE_SCORE = 200;

cc.Class({
  extends: cc.Component,

  properties: {
  },

  setData (treasureInfo) {
    const self = this;
    this.score = treasureInfo.score;
    this.type = treasureInfo.type;

    this.treasureInfo = treasureInfo;

    const spriteComponent = this.node.getComponent(cc.Sprite);
    const targetGid = (window.LOW_SCORE_TREASURE_TYPE == treasureInfo.type ? window.battleEntityTypeNameToGlobalGid["LowScoreTreasure"] : window.battleEntityTypeNameToGlobalGid["HighScoreTreasure"])
    spriteComponent.spriteFrame = window.getOrCreateSpriteFrameForGid(targetGid).spriteFrame;
  },

  start() {},
})
