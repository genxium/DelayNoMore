cc.Class({
  extends: cc.Component,

  properties: {
    firstPlayerInfoNode: {
      type: cc.Node,
      default: null
    },
    secondPlayerInfoNode: {
      type: cc.Node,
      default: null
    },
    findingAnimNode: {
      type: cc.Node,
      default: null
    },
    exitBtnNode: {
      type: cc.Node,
      default: null
    }
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {},

  init(mapIns) {
    this.mapIns = mapIns;
    if (null != this.firstPlayerInfoNode) {
      this.firstPlayerInfoNode.active = false;
    }
    if (null != this.secondPlayerInfoNode) {
      this.secondPlayerInfoNode.active = false;
    }
    this.playersInfoNode = {};
    Object.assign(this.playersInfoNode, {
      1: this.firstPlayerInfoNode
    });
    Object.assign(this.playersInfoNode, {
      2: this.secondPlayerInfoNode
    });

    if (null != this.findingAnimNode) {
      this.findingAnimNode.active = true;
    }

    window.firstPlayerInfoNode = this.firstPlayerInfoNode;
  },

  hideExitButton() {
    if (null == this.exitBtnNode != null) {
      return;
    }
    this.exitBtnNode.active = false;
  },

  exitBtnOnClick(evt) {
    this.mapIns.hideFindingPlayersGUI();
    cc.log(`FindingPlayers.exitBtnOnClick`);
    window.closeWSConnection(constants.RET_CODE.BATTLE_STOPPED, "");
    window.clearLocalStorageAndBackToLoginScene(false);
  },

  updatePlayersInfo(playerMetas) {
    if (null == playerMetas) return;
    for (let i in playerMetas) {
      const playerMeta = playerMetas[i];
      const playerInfoNode = this.playersInfoNode[playerMeta.joinIndex];
      if (null == playerInfoNode) {
        cc.error("There's no playerInfoNode for joinIndex == ", joinIndex, ", as `this.playerInfoNode` is currently ", this.playersInfoNode);
      }
      playerInfoNode.active = true;
      if (2 == playerMeta.joinIndex) {
        if (null != this.findingAnimNode) {
          this.findingAnimNode.active = false;
        }
      }
    }

    for (let i in playerMetas) {
      const playerMeta = playerMetas[i];
      console.log("Showing playerMeta:", playerMeta);
      const playerInfoNode = this.playersInfoNode[playerMeta.joinIndex];

      function isEmptyString(str) {
        return str == null || str == ''
      }

      const nameNode = playerInfoNode.getChildByName("name");
      const nameToDisplay = (() => {
        if (!isEmptyString(playerMeta.displayName)) {
          return playerMeta.displayName
        } else if (!isEmptyString(playerMeta.name)) {
          return playerMeta.name
        } else {
          return ""
        }
      })();
      nameNode.getComponent(cc.Label).string = nameToDisplay;
    }
  },
});
