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
    myAvatarNode: {
      type: cc.Node,
      default: null,
    },
    myNameNode: {
      type: cc.Node,
      default: null,
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
    this.showMyAvatar();
    this.showMyName();
  },

  showMyName() {
    const selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
    let name = 'No name';
    if (null == selfPlayerInfo.displayName || "" == selfPlayerInfo.displayName) {
      name = selfPlayerInfo.name;
    } else {
      name = selfPlayerInfo.displayName;
    }
    if (!this.myNameNode) return;
    const myNameNodeLabel = this.myNameNode.getComponent(cc.Label);
    if (!myNameNodeLabel || null == name) return;
    myNameNodeLabel.string = name;
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

  showMyAvatar() {
    const self = this;
    const selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
    let remoteUrl = selfPlayerInfo.avatar;
    if (remoteUrl == null || remoteUrl == '') {
      cc.log(`No avatar to show for myself, check storage.`);
      return;
    } else {
      cc.loader.load({
        url: remoteUrl,
        type: 'jpg'
      }, function(err, texture) {
        if (err != null || texture == null) {
          console.log(err);
        } else {
          const sf = new cc.SpriteFrame();
          sf.setTexture(texture);
          self.myAvatarNode.getComponent(cc.Sprite).spriteFrame = sf;
        }
      });
    }
  },

  showRibbon(winnerInfo, ribbonNode) {
    const selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
    const texture = (selfPlayerInfo.playerId == winnerInfo.id) ? "textures/resultPanel/WinRibbon" : "textures/resultPanel/loseRibbon";
    cc.loader.loadRes(texture, cc.SpriteFrame, function(err, spriteFrame) {
      if (err) {
        console.log(err);
        return;
      }
      ribbonNode.getComponent(cc.Sprite).spriteFrame = spriteFrame;
    });

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
