cc.Class({
  extends: cc.Component,

  properties: {
    listNode: {
      type: cc.Node,
      default: null,
    }
  },

  // LIFE-CYCLE CALLBACKS:
  updateData(playerMeta) {
    const joinIndex = playerMeta.joinIndex;
    const playerNode = this.listNode.getChildByName("player" + joinIndex);
    if (!playerNode) {
      return;
    }
    const playerNameLabelNode = playerNode.getChildByName("name");

    function isEmptyString(str) {
      return str == null || str == ''
    }

    const nameToDisplay = (() => {
      if (!isEmptyString(playerMeta.displayName)) {
        return playerMeta.displayName;
      } else if (!isEmptyString(playerMeta.name)) {
        return playerMeta.name;
      } else {
        return ""
      }
    })();

    playerNameLabelNode.getComponent(cc.Label).string = nameToDisplay;

    const score = (playerMeta.score ? playerMeta.score : 0);
    const playerScoreLabelNode = playerNode.getChildByName("score");
    playerScoreLabelNode.getComponent(cc.Label).string = score;
  },

  onLoad() {},

  clearInfo() {
    for (let i = 1; i < 3; i++) {
      const playerNode = this.listNode.getChildByName('player' + i);
      const playerScoreLabelNode = playerNode.getChildByName("score");
      const playerNameLabelNode = playerNode.getChildByName("name");
      playerScoreLabelNode.getComponent(cc.Label).string = '';
      playerNameLabelNode.getComponent(cc.Label).string = '';
    }
  },

});
