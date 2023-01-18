const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field
cc.Class({
  extends: cc.Component,
  properties: {
    onCloseDelegate: {
      type: cc.Object,
      default: null
    },
    onAgainClicked: {
      type: cc.Object,
      default: null
    },
    rankingNodes: {
      type: [cc.Node],
      default: [],
    },
    winNode: {
      type: cc.Node,
      default: null,
    },
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {
  },

  againBtnOnClick(evt) {
    this.onClose();
    if (!this.onAgainClicked) return;
    this.onAgainClicked();
  },

  homeBtnOnClick(evt) {
    this.onClose();
    window.clearLocalStorageAndBackToLoginScene();
  },

  showPlayerInfo(playerRichInfoDict) {
    this.showRanking(playerRichInfoDict);
  },

  showRanking(playerRichInfoDict) {
    const self = this;
    const sortablePlayers = [];

    for (let playerId in playerRichInfoDict) {
      const p = playerRichInfoDict[playerId];
      p.id = playerId;
      if (null == p.score) {
        p.score = playerRichInfoDict[playerId].score;
      }
      if (null == p.score) {
        p.score = 0;
      }
      sortablePlayers.push(p);
    }
    const sortedPlayers = sortablePlayers.sort((a, b) => {
      if (a.score != b.score) {
        return (b.score - a.score);
      } else {
        return (a.id > b.id);
      }
    });

    const selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
    for (let k in sortedPlayers) {
      const p = sortedPlayers[k]; 
      const nameToDisplay = (() => {
        function isEmptyString(str) {
          return str == null || str == '';
        }
        if (!isEmptyString(p.displayName)) {
          return p.displayName;
        } else if (!isEmptyString(p.name)) {
          return p.name;
        } else {
          return "";
        }
      })();

      if (selfPlayerInfo.playerId == p.id) {
        const rank = k + 1;
        if (1 != rank && null != self.winNode) {
          self.winNode.active = false;
        }
      }

      self.rankingNodes[k].getChildByName('name').getComponent(cc.Label).string = nameToDisplay;
      self.rankingNodes[k].getChildByName('score').getComponent(cc.Label).string = playerRichInfoDict[p.id].score;
    } 
  },

  onClose(evt) {
    if (this.node.parent) {
      this.node.parent.removeChild(this.node);
    }
    if (!this.onCloseDelegate) {
      return;
    }
    this.onCloseDelegate();
  }
});
