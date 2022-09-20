const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

const WECHAT_ON_HIDE_TARGET_ACTION = {
  SHARE_CHAT_MESSAGE: 8,
  CLOSE: 3,
};

const pbStructRoot = require('./modules/room_downsync_frame_proto_bundle.forcemsg.js');
window.RoomDownsyncFrame = pbStructRoot.treasurehunterx.RoomDownsyncFrame;
window.BattleColliderInfo = pbStructRoot.treasurehunterx.BattleColliderInfo;

cc.Class({
  extends: cc.Component,

  properties: {
    cavasNode: {
      default: null,
      type: cc.Node
    },
    backgroundNode: {
      default: null,
      type: cc.Node
    },
    loadingPrefab: {
      default: null,
      type: cc.Prefab
    },
    tipsLabel: {
      default: null,
      type: cc.Label,
    },

    downloadProgress: {
      default: null,
      type: cc.ProgressBar,
    },
    writtenBytes: {
      default: null,
      type: cc.Label,
    },
    expectedToWriteBytes: {
      default: null,
      type: cc.Label,
    },

    handlerProgress: {
      default: null,
      type: cc.ProgressBar,
    },
    handledUrlsCount: {
      default: null,
      type: cc.Label,
    },
    toHandledUrlsCount: {
      default: null,
      type: cc.Label,
    },
  },

  
  // LIFE-CYCLE CALLBACKS:
  onLoad() {
    wx.onShow((res) => {
      console.log("+++++ wx onShow(), onShow.res ", res);
      window.expectedRoomId = res.query.expectedRoomId;
    });
    wx.onHide((res) => {
      // Reference https://developers.weixin.qq.com/minigame/dev/api/wx.exitMiniProgram.html.
      console.log("+++++ wx onHide(), onHide.res: ", res);
      if (
         WECHAT_ON_HIDE_TARGET_ACTION == res.targetAction
         ||
         "back" == res.mode // After "WeChat v7.0.4 on iOS" 
         || 
         "close" == res.mode
      ) {
        window.clearLocalStorageAndBackToLoginScene();
      } else {
        // Deliberately left blank.
      }
    });

    const self = this;
    self.getRetCodeList();
    self.getRegexList();

    self.showTips(i18n.t("login.tips.AUTO_LOGIN_1"));
    self.checkIntAuthTokenExpire().then(
      () => {
        self.showTips(i18n.t("login.tips.AUTO_LOGIN_2"));
        const intAuthToken = JSON.parse(cc.sys.localStorage.getItem('selfPlayer')).intAuthToken;
        self.useTokenLogin(intAuthToken);
      },
      () => {
        // 调用wx.login然后请求登录。
        wx.authorize({
          scope: "scope.userInfo",
          success() {
            self.showTips(i18n.t("login.tips.WECHAT_AUTHORIZED_AND_INT_AUTH_TOKEN_LOGGING_IN"));
            wx.login({
              success(res) {
                console.log("wx login success, res: ", res);
                const code = res.code;

                wx.getUserInfo({
                  success(res) {
                    const userInfo = res.userInfo;
                    console.log("Get user info ok: ", userInfo);
                    self.useWxCodeMiniGameLogin(code, userInfo);
                  },
                  fail(err) {
                    console.error(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"), err);
                    self.showTips(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"));
                    self.createAuthorizeThenLoginButton();
                  },
                })
              },
              fail(err) {
                if (err) {
                  console.error(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"), err);
                  self.showTips(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"));
                  self.createAuthorizeThenLoginButton();
                }
              },
            });
          },
          fail(err) {
            console.error(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"), err);
            self.showTips(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"));
            self.createAuthorizeThenLoginButton();
          }
        })
      }
    );
  },

  createAuthorizeThenLoginButton(tips) {
    const self = this;

    let sysInfo = wx.getSystemInfoSync();
    //获取微信界面大小
    let width = sysInfo.screenWidth;
    let height = sysInfo.screenHeight;

    let button = wx.createUserInfoButton({
      type: 'text',
      text: '',
      style: {
        left: 0,
        top: 0,
        width: width,
        height: height,
        backgroundColor: '#00000000', //最后两位为透明度
        color: '#ffffff',
        fontSize: 20,
        textAlign: "center",
        lineHeight: height,
      },
    });
    button.onTap((res) => {
      console.log(res);
      if (null != res.userInfo) {
        const userInfo = res.userInfo;
        self.showTips(i18n.t("login.tips.WECHAT_AUTHORIZED_AND_INT_AUTH_TOKEN_LOGGING_IN"));

        wx.login({
          success(res) {
            console.log('wx.login success, res:', res);
            const code = res.code;
            self.useWxCodeMiniGameLogin(code, userInfo);
            button.destroy();
          },
          fail(err) {
            console.err(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"), err);
            self.showTips(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"));
          },
        });
      } else {
        self.showTips(i18n.t("login.tips.PLEASE_AUTHORIZE_WECHAT_LOGIN_FIRST"));
      }
    })

  },

  onDestroy() {
    console.log("+++++++ WechatGameLogin onDestroy()");
  },

  showTips(text) {
    if (this.tipsLabel != null) {
      this.tipsLabel.string = text;
    } else {
      console.log('Login scene showTips failed')
    }
  },

  getRetCodeList() {
    const self = this;
    self.retCodeDict = constants.RET_CODE;
  },

  getRegexList() {
    const self = this;
    self.regexList = {
      EMAIL: /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      PHONE: /^\+?[0-9]{8,14}$/,
      STREET_META: /^.{5,100}$/,
      LNG_LAT_TEXT: /^[0-9]+(\.[0-9]{4,6})$/,
      SEO_KEYWORD: /^.{2,50}$/,
      PASSWORD: /^.{6,50}$/,
      SMS_CAPTCHA_CODE: /^[0-9]{4}$/,
      ADMIN_HANDLE: /^.{4,50}$/,
    };
  },

  onSMSCaptchaGetButtonClicked(evt) {
    var timerEnable = true;
    const self = this;
    if (!self.checkPhoneNumber('getCaptcha')) {
      return;
    }
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER +
        constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.SMS_CAPTCHA + constants.ROUTE_PATH.GET,
      type: 'GET',
      data: {
        phoneCountryCode: self.phoneCountryCodeInput.getComponent(cc.EditBox).string,
        phoneNum: self.phoneNumberInput.getComponent(cc.EditBox).string
      },
      success: function(res) {
        switch (res.ret) {
          case constants.RET_CODE.OK:
            self.phoneNumberTips.getComponent(cc.Label).string = '';
            self.captchaTips.getComponent(cc.Label).string = '';
            break;
          case constants.RET_CODE.DUPLICATED:
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.DUPLICATED");
            break;
          case constants.RET_CODE.INCORRECT_PHONE_COUNTRY_CODE:
          case constants.RET_CODE.INCORRECT_PHONE_NUMBER:
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.PHONE_ERR");
            break;
          case constants.RET_CODE.IS_TEST_ACC:
            self.smsLoginCaptchaInput.getComponent(cc.EditBox).string = res.smsLoginCaptcha;
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.TEST_USER");
            timerEnable = false;
            // clearInterval(self.countdownTimer);
            break;
          case constants.RET_CODE.SMS_CAPTCHA_REQUESTED_TOO_FREQUENTLY:
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_FREEQUENT_REQUIRE");
          default:
            break;
        }
        if (timerEnable)
          self.countdownTime(self);
      }
    });
  },

  countdownTime(self) {
    self.smsLoginCaptchaButton.off('click', self.onSMSCaptchaGetButtonClicked);
    self.smsLoginCaptchaButton.removeChild(self.smsGetCaptchaNode);
    self.smsWaitCountdownNode.parent = self.smsLoginCaptchaButton;
    var total = 20; // Magic number
    self.countdownTimer = setInterval(function() {
      if (total === 0) {
        self.smsWaitCountdownNode.parent.removeChild(self.smsWaitCountdownNode);
        self.smsGetCaptchaNode.parent = self.smsLoginCaptchaButton;
        self.smsWaitCountdownNode.getChildByName('WaitTimeLabel').getComponent(cc.Label).string = 20;
        self.smsLoginCaptchaButton.on('click', self.onSMSCaptchaGetButtonClicked);
        clearInterval(self.countdownTimer);
      } else {
        total--;
        self.smsWaitCountdownNode.getChildByName('WaitTimeLabel').getComponent(cc.Label).string = total;
      }
    }, 1000)

  },

  checkIntAuthTokenExpire() {
    return new Promise((resolve, reject) => {
      if (!cc.sys.localStorage.getItem("selfPlayer")) {
        reject();
        return;
      }
      const selfPlayer = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
      (selfPlayer.intAuthToken && new Date().getTime() < selfPlayer.expiresAt) ? resolve() : reject();
    })
  },

  checkPhoneNumber(type) {
    const self = this;
    const phoneNumberRegexp = self.regexList.PHONE;
    var phoneNumberString = self.phoneNumberInput.getComponent(cc.EditBox).string;
    if (phoneNumberString) {
      return true;
      if (!phoneNumberRegexp.test(phoneNumberString)) {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.PHONE_ERR");
        return false;
      } else {
        return true;
      }
    } else {
      if (type === 'getCaptcha' || type === 'login') {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.PHONE_ERR");
      }
      return false;
    }
  },

  checkCaptcha(type) {
    const self = this;
    const captchaRegexp = self.regexList.SMS_CAPTCHA_CODE;
    var captchaString = self.smsLoginCaptchaInput.getComponent(cc.EditBox).string;

    if (captchaString) {
      if (self.smsLoginCaptchaInput.getComponent(cc.EditBox).string.length !== 4 || (!captchaRegexp.test(captchaString))) {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.CAPTCHA_ERR");
        return false;
      } else {
        return true;
      }
    } else {
      if (type === 'login') {
        self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.CAPTCHA_ERR");
      }
      return false;
    }
  },

  useTokenLogin(_intAuthToken) {
    var self = this;
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.INT_AUTH_TOKEN + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: {
        intAuthToken: _intAuthToken
      },
      success: function(resp) {
        self.onLoggedIn(resp);
      },
      error: function(xhr, status, errMsg) {
        console.log("Login attempt `useTokenLogin` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage()

        self.showTips(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"));
        self.createAuthorizeThenLoginButton();
      },
      timeout: function() {
        self.enableInteractiveControls(true);
      },
    });
  },

  enableInteractiveControls(enabled) {},

  onLoginButtonClicked(evt) {
    const self = this;
    if (!self.checkPhoneNumber('login') || !self.checkCaptcha('login')) {
      return;
    }
    self.loginParams = {
      phoneCountryCode: self.phoneCountryCodeInput.getComponent(cc.EditBox).string,
      phoneNum: self.phoneNumberInput.getComponent(cc.EditBox).string,
      smsLoginCaptcha: self.smsLoginCaptchaInput.getComponent(cc.EditBox).string
    };
    self.enableInteractiveControls(false);

    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER +
        constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.SMS_CAPTCHA + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: self.loginParams,
      success: function(resp) {
        self.onLoggedIn(resp);
      },
      error: function(xhr, status, errMsg) {
        console.log("Login attempt `onLoginButtonClicked` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage()
      },
      timeout: function() {
        self.enableInteractiveControls(true);
      }
    });
  },
  onWechatLoggedIn(res) {
    const self = this;
    if (constants.RET_CODE.OK == res.ret) {
      //根据服务器返回信息设置selfPlayer
      self.enableInteractiveControls(false);
      const date = Number(res.expiresAt);
      const selfPlayer = {
        expiresAt: date,
        playerId: res.playerId,
        intAuthToken: res.intAuthToken,
        displayName: res.displayName,
        avatar: res.avatar,
      }
      cc.sys.localStorage.setItem('selfPlayer', JSON.stringify(selfPlayer));

      self.useTokenLogin(res.intAuthToken);
    } else {
      cc.sys.localStorage.removeItem("selfPlayer");
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();

      self.showTips(i18n.t("login.tips.WECHAT_LOGIN_FAILED_TAP_SCREEN_TO_RETRY") + ", errorCode = " + res.ret);
      self.createAuthorizeThenLoginButton();
    }
  },

  onLoggedIn(res) {
    const self = this;
    console.log("OnLoggedIn: ", res);
    if (constants.RET_CODE.OK == res.ret) {
      if (window.isUsingX5BlinkKernelOrWebkitWeChatKernel()) {
        window.initWxSdk = self.initWxSdk.bind(self);
        window.initWxSdk();
      }
      self.enableInteractiveControls(false);
      const date = Number(res.expiresAt);
      const selfPlayer = {
        expiresAt: date,
        playerId: res.playerId,
        intAuthToken: res.intAuthToken,
        avatar: res.avatar,
        displayName: res.displayName,
        name: res.name,
      }
      cc.sys.localStorage.setItem("selfPlayer", JSON.stringify(selfPlayer));
      console.log("cc.sys.localStorage.selfPlayer = ", cc.sys.localStorage.getItem("selfPlayer"));
      if (self.countdownTimer) {
        clearInterval(self.countdownTimer);
      }

      cc.director.loadScene('default_map');
    } else {
      console.warn('onLoggedIn failed!')
      cc.sys.localStorage.removeItem("selfPlayer");
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      self.enableInteractiveControls(true);
      switch (res.ret) {
        case constants.RET_CODE.DUPLICATED:
          this.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.DUPLICATED");
          break;
        case constants.RET_CODE.TOKEN_EXPIRED:
          this.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.LOGIN_TOKEN_EXPIRED");
          break;
        case constants.RET_CODE.SMS_CAPTCHA_NOT_MATCH:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case constants.RET_CODE.INCORRECT_CAPTCHA:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case constants.RET_CODE.SMS_CAPTCHA_CODE_NOT_EXISTING:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case constants.RET_CODE.INCORRECT_PHONE_NUMBER:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.INCORRECT_PHONE_NUMBER");
          break;
        case constants.RET_CODE.INVALID_REQUEST_PARAM:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.INCORRECT_PHONE_NUMBER");
          break;
        case constants.RET_CODE.INCORRECT_PHONE_COUNTRY_CODE:
        case constants.RET_CODE.INCORRECT_PHONE_NUMBER:
          this.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.INCORRECT_PHONE_NUMBER");
          break;
        default:
          break;
      }

      self.showTips(i18n.t("login.tips.AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN"));
      self.createAuthorizeThenLoginButton();
    }
  },

  useWXCodeLogin(_code) {
    const self = this;
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.WECHAT + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: {
        code: _code
      },
      success: function(res) {
        self.onWechatLoggedIn(res);
      },
      error: function(xhr, status, errMsg) {
        console.log("Login attempt `onLoginButtonClicked` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        cc.sys.localStorage.removeItem("selfPlayer");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
        self.showTips(i18n.t("login.tips.WECHAT_LOGIN_FAILED_TAP_SCREEN_TO_RETRY") + ", errorMsg =" + errMsg);
      },
      timeout: function() {
        console.log("Login attempt `onLoginButtonClicked` timed out, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        cc.sys.localStorage.removeItem("selfPlayer");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
        self.showTips(i18n.t("login.tips.WECHAT_LOGIN_FAILED_TAP_SCREEN_TO_RETRY") + ", errorMsg =" + errMsg);
      },
    });
  },

  // 对比useWxCodeLogin函数只是请求了不同url
  useWxCodeMiniGameLogin(_code, _userInfo) {
    const self = this;
    NetworkUtils.ajax({
      url: backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.WECHATGAME + constants.ROUTE_PATH.LOGIN,
      type: "POST",
      data: {
        code: _code,
        avatarUrl: _userInfo.avatarUrl,
        nickName: _userInfo.nickName,
      },
      success: function(res) {
        self.onWechatLoggedIn(res);
      },
      error: function(xhr, status, errMsg) {
        console.log("Login attempt `onLoginButtonClicked` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        cc.sys.localStorage.removeItem("selfPlayer");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
        self.showTips(i18n.t("login.tips.WECHAT_LOGIN_FAILED_TAP_SCREEN_TO_RETRY") + ", errorMsg =" + errMsg);
        self.createAuthorizeThenLoginButton();
      },
      timeout: function() {
        console.log("Login attempt `onLoginButtonClicked` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        cc.sys.localStorage.removeItem("selfPlayer");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
        self.showTips(i18n.t("login.tips.WECHAT_LOGIN_FAILED_TAP_SCREEN_TO_RETRY"));
        self.createAuthorizeThenLoginButton();
      },
    });
  },

  getWechatCode(evt) {
    let self = this;
    self.showTips("");
    const wechatServerEndpoint = wechatAddress.PROTOCOL + "://" + wechatAddress.HOST + ((null != wechatAddress.PORT && "" != wechatAddress.PORT.trim()) ? (":" + wechatAddress.PORT) : "");
    const url = wechatServerEndpoint + constants.WECHAT.AUTHORIZE_PATH + "?" + wechatAddress.APPID_LITERAL + "&" + constants.WECHAT.REDIRECT_RUI_KEY + NetworkUtils.encode(window.location.href) + "&" + constants.WECHAT.RESPONSE_TYPE + "&" + constants.WECHAT.SCOPE + constants.WECHAT.FIN;
    console.log("To visit wechat auth addr: ", url);
    window.location.href = url;
  },

  initWxSdk() {
    const selfPlayer = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
    const origUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    /*
    * The `shareLink` must 
    * - have its 2nd-order-domain registered as trusted 2nd-order under the targetd `res.jsConfig.app_id`, and
    * - extracted from current window.location.href.   
    */
    const shareLink = origUrl;
    const updateAppMsgShareDataObj = {
      type: 'link', // 分享类型,music、video或link，不填默认为link
      dataUrl: '', // 如果type是music或video，则要提供数据链接，默认为空
      title: document.title, // 分享标题
      desc: 'Let\'s play together!', // 分享描述
      link: shareLink + (cc.sys.localStorage.getItem('boundRoomId') ? "" : ("?expectedRoomId=" + cc.sys.localStorage.getItem('boundRoomId'))),
      imgUrl: origUrl + "/favicon.ico", // 分享图标
      success: function() {
        // 设置成功
      }
    };
    const menuShareTimelineObj = {
      title: document.title, // 分享标题
      link: shareLink + (cc.sys.localStorage.getItem('boundRoomId') ? "" : ("?expectedRoomId=" + cc.sys.localStorage.getItem('boundRoomId'))),
      imgUrl: origUrl + "/favicon.ico", // 分享图标
      success: function() {}
    };

    const wxConfigUrl = (window.isUsingWebkitWechatKernel() ? window.atFirstLocationHref : window.location.href);

    //接入微信登录接口
    NetworkUtils.ajax({
      "url": backendAddress.PROTOCOL + '://' + backendAddress.HOST + ':' + backendAddress.PORT + constants.ROUTE_PATH.API + constants.ROUTE_PATH.PLAYER + constants.ROUTE_PATH.VERSION + constants.ROUTE_PATH.WECHAT + constants.ROUTE_PATH.JSCONFIG,
      type: "POST",
      data: {
        "url": wxConfigUrl,
        "intAuthToken": selfPlayer.intAuthToken,
      },
      success: function(res) {
        if (constants.RET_CODE.OK != res.ret) {
          console.warn("Failed to get `wsConfig`: ", res);
          return;
        }
        const jsConfig = res.jsConfig;
        const configData = {
          debug: CC_DEBUG, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
          appId: jsConfig.app_id, // 必填，公众号的唯一标识
          timestamp: jsConfig.timestamp.toString(), // 必填，生成签名的时间戳
          nonceStr: jsConfig.nonce_str, // 必填，生成签名的随机串
          jsApiList: ['onMenuShareAppMessage', 'onMenuShareTimeline'],
          signature: jsConfig.signature, // 必填，签名
        };
        console.log("config url: ", wxConfigUrl);
        console.log("wx.config: ", configData);
        wx.config(configData);
        console.log("Current window.location.href: ", window.location.href);
        wx.ready(function() {
          console.log("Here is wx.ready.")
          wx.onMenuShareAppMessage(updateAppMsgShareDataObj);
          wx.onMenuShareTimeline(menuShareTimelineObj);
        });
        wx.error(function(res) {
          console.error("wx config fails and error is ", JSON.stringify(res));
        });
      },
      error: function(xhr, status, errMsg) {
        console.error("Failed to get `wsConfig`: ", errMsg);
      },
    });
  },

  update(dt) {
    const self = this;
    if (null != wxDownloader && 0 < wxDownloader.totalBytesExpectedToWriteForAllTasks) {
      self.writtenBytes.string = wxDownloader.totalBytesWrittenForAllTasks;
      self.expectedToWriteBytes.string = wxDownloader.totalBytesExpectedToWriteForAllTasks;
      self.downloadProgress.progress = 1.0*wxDownloader.totalBytesWrittenForAllTasks/wxDownloader.totalBytesExpectedToWriteForAllTasks;
    }
    const totalUrlsToHandle = (wxDownloader.immediateHandleItemCount + wxDownloader.immediateReadFromLocalCount + wxDownloader.immediatePackDownloaderCount);
    const totalUrlsHandled = (wxDownloader.immediateHandleItemCompleteCount + wxDownloader.immediateReadFromLocalCompleteCount + wxDownloader.immediatePackDownloaderCompleteCount);
    if (null != wxDownloader && 0 < totalUrlsToHandle) {
      self.handledUrlsCount.string = totalUrlsHandled;
      self.toHandledUrlsCount.string = totalUrlsToHandle;
      self.handlerProgress.progress = 1.0*totalUrlsHandled/totalUrlsToHandle;
    }
  }
});
