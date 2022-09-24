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
    myAvatarNode: {
      type: cc.Node,
      default: null
    },
    exitBtnNode: {
      type: cc.Node,
      default: null
    }
  },

  // LIFE-CYCLE CALLBACKS:
  onLoad() {
  },

  init() {
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
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    window.closeWSConnection();
    cc.director.loadScene('login');
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

    //显示自己的头像名称以及他人的头像名称
    for (let i in playerMetas) {
      const playerMeta = playerMetas[i];
      console.log("Showing playerMeta:", playerMeta);
      const playerInfoNode = this.playersInfoNode[playerMeta.joinIndex];

      (() => { //远程加载头像
        let remoteUrl = playerMeta.avatar;
        if (remoteUrl == null || remoteUrl == '') {
          cc.log(`No avatar to show for :`);
          cc.log(playerMeta);
          remoteUrl = 'http://wx.qlogo.cn/mmopen/PiajxSqBRaEJUWib5D85KXWHumaxhU4E9XOn9bUpCNKF3F4ibfOj8JYHCiaoosvoXCkTmOQE1r2AKKs8ObMaz76EdA/0'
        }
        cc.loader.load({
          url: remoteUrl,
          type: 'jpg'
        }, function(err, texture) {
          if (null != err ) {
            console.error(err);
          } else {
            if (null == texture) {
              return;
            }
            const sf = new cc.SpriteFrame();
            sf.setTexture(texture);
            playerInfoNode.getChildByName('avatarMask').getChildByName('avatar').getComponent(cc.Sprite).spriteFrame = sf;
          }
        });
      })();

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
