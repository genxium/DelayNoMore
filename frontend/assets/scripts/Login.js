const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

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
    interactiveControls: {
      default: null,
      type: cc.Node
    },
    phoneLabel: {
      default: null,
      type: cc.Node
    },
    smsLoginCaptchaLabel: {
      default: null,
      type: cc.Node
    },
    phoneCountryCodeInput: {
      default: null,
      type: cc.Node
    },
    phoneNumberInput: {
      type: cc.Node,
      default: null
    },
    phoneNumberTips: {
      type: cc.Node,
      default: null
    },
    smsLoginCaptchaInput: {
      type: cc.Node,
      default: null
    },
    smsLoginCaptchaButton: {
      type: cc.Node,
      default: null
    },
    captchaTips: {
      type: cc.Node,
      default: null
    },
    loginButton: {
      type: cc.Node,
      default: null
    },
    smsWaitCountdownPrefab: {
      default: null,
      type: cc.Prefab
    },
    loadingPrefab: {
      default: null,
      type: cc.Prefab
    },
    wechatLoginTips: {
      default: null,
      type: cc.Label,
    },
  },

  // LIFE-CYCLE CALLBACKS:

  onLoad() {

    //kobako: 腾讯统计代码
    //WARN: 打包到微信小游戏的时候会导致出错
    /*
    (function() {
        var mta = document.createElement("script");
        mta.src = "//pingjs.qq.com/h5/stats.js?v2.0.4";
        mta.setAttribute("name", "MTAH5");
        mta.setAttribute("sid", "500674632");
        var s = document.getElementsByTagName("script")[0];
        s.parentNode.insertBefore(mta, s);
    })();
    */

    window.atFirstLocationHref = window.location.href.split('#')[0];
    const self = this;
    self.getRetCodeList();
    self.getRegexList();

    const isUsingX5BlinkKernelOrWebkitWeChatKernel = window.isUsingX5BlinkKernelOrWebkitWeChatKernel();
    //const isUsingX5BlinkKernelOrWebkitWeChatKernel = true;
    if (!CC_DEBUG) {
      self.phoneNumberTips.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;
      self.smsLoginCaptchaButton.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;

      self.captchaTips.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;
      self.phoneCountryCodeInput.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;
      self.phoneNumberInput.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;
      self.smsLoginCaptchaInput.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;

      self.phoneLabel.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;
      self.smsLoginCaptchaLabel.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;

      self.loginButton.active = !isUsingX5BlinkKernelOrWebkitWeChatKernel;
    }
    self.checkPhoneNumber = self.checkPhoneNumber.bind(self);
    self.checkIntAuthTokenExpire = self.checkIntAuthTokenExpire.bind(self);
    self.checkCaptcha = self.checkCaptcha.bind(self);
    self.onSMSCaptchaGetButtonClicked = self.onSMSCaptchaGetButtonClicked.bind(self);
    self.smsLoginCaptchaButton.on('click', self.onSMSCaptchaGetButtonClicked);

    self.loadingNode = cc.instantiate(this.loadingPrefab);
    self.smsGetCaptchaNode = self.smsLoginCaptchaButton.getChildByName('smsGetCaptcha');
    self.smsWaitCountdownNode = cc.instantiate(self.smsWaitCountdownPrefab);

    const qDict = window.getQueryParamDict();
    if (null != qDict && qDict["expectedRoomId"]) {
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    }

    cc.loader.loadRes("pbfiles/room_downsync_frame", function(err, textAsset /* cc.TextAsset */ ) {
      if (err) {
        cc.error(err.message || err);
        return;
      }
      if (false == (cc.sys.platform == cc.sys.WECHAT_GAME)) {
        // Otherwise, `window.RoomDownsyncFrame` is already assigned.
        let protoRoot = new protobuf.Root;
        window.protobuf.parse(textAsset.text, protoRoot);
        window.RoomDownsyncFrame = protoRoot.lookupType("treasurehunterx.RoomDownsyncFrame"); 
        window.BattleColliderInfo = protoRoot.lookupType("treasurehunterx.BattleColliderInfo"); 
        window.WsReq = protoRoot.lookupType("treasurehunterx.WsReq"); 
        window.WsResp = protoRoot.lookupType("treasurehunterx.WsResp"); 
      }
      self.checkIntAuthTokenExpire().then(
        () => {
          const intAuthToken = JSON.parse(cc.sys.localStorage.getItem('selfPlayer')).intAuthToken;
          self.useTokenLogin(intAuthToken);
        },
        () => {
          window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
          if ( (CC_DEBUG || isUsingX5BlinkKernelOrWebkitWeChatKernel) ) {
            if (null != qDict && qDict["code"]) {
              const code = qDict["code"];
              console.log("Got the wx authcode: ", code, "while at full url: " + window.location.href);
              self.useWXCodeLogin(code);
            } else {
              if (isUsingX5BlinkKernelOrWebkitWeChatKernel) {
                self.getWechatCode(null);
              } else {
                // Deliberately left blank.
              }
            }
          }
        }
      );
    });
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
          case self.retCodeDict.OK:
            self.phoneNumberTips.getComponent(cc.Label).string = '';
            self.captchaTips.getComponent(cc.Label).string = '';
            break;
          case self.retCodeDict.DUPLICATED:
            self.phoneNumberTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.LOG_OUT;
            break;
          case self.retCodeDict.INCORRECT_PHONE_COUNTRY_CODE_OR_NUMBER:
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.PHONE_ERR");
            break;
          case self.retCodeDict.IS_TEST_ACC:
            self.smsLoginCaptchaInput.getComponent(cc.EditBox).string = res.smsLoginCaptcha;
            self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.TEST_USER");
            timerEnable = false;
            // clearInterval(self.countdownTimer);
            break;
          case self.retCodeDict.SMS_CAPTCHA_REQUESTED_TOO_FREQUENTLY:
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
      if (!cc.sys.localStorage.getItem('selfPlayer')) {
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
      if ('login' == type) {
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
      },
      timeout: function() {
        self.enableInteractiveControls(true);
      },
    });
  },

  enableInteractiveControls(enabled) {
    this.smsLoginCaptchaButton.getComponent(cc.Button).interactable = enabled;
    this.loginButton.getComponent(cc.Button).interactable = enabled;
    this.phoneCountryCodeInput.getComponent(cc.EditBox).enabled = enabled;
    this.phoneNumberInput.getComponent(cc.EditBox).enabled = enabled;
    this.smsLoginCaptchaInput.getComponent(cc.EditBox).enabled = enabled;
    if (enabled) {
      setVisible(this.interactiveControls);
    } else {
      setInvisible(this.interactiveControls);
    }
  },

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
    if (res.ret === self.retCodeDict.OK) {
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

      const qDict = window.getQueryParamDict();
      const expectedRoomId = qDict["expectedRoomId"];
      if (null != expectedRoomId) {
        console.log("onWechatLoggedIn using expectedRoomId == " + expectedRoomId);
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      }
      // To remove "code=XXX" in "query string".
      window.history.replaceState(qDict, null, window.location.pathname);
      self.useTokenLogin(res.intAuthToken);
    } else {
      cc.sys.localStorage.removeItem("selfPlayer");
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      self.wechatLoginTips.string = constants.ALERT.TIP_LABEL.WECHAT_LOGIN_FAILS + ", errorCode = " + res.ret;
      // To remove "code=XXX" in "query string".
      window.history.replaceState({}, null, window.location.pathname);
    }
  },

  onLoggedIn(res) {
    const self = this;
    cc.log(`OnLoggedIn ${JSON.stringify(res)}.`)
    if (res.ret === self.retCodeDict.OK) {
      if(window.isUsingX5BlinkKernelOrWebkitWeChatKernel()) {
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
      cc.sys.localStorage.setItem('selfPlayer', JSON.stringify(selfPlayer));
      console.log("cc.sys.localStorage.selfPlayer = ", cc.sys.localStorage.getItem('selfPlayer'));
      if (self.countdownTimer) {
        clearInterval(self.countdownTimer);
      }
      const inputControls = self.backgroundNode.getChildByName("InteractiveControls");
      self.backgroundNode.removeChild(inputControls);
      safelyAddChild(self.backgroundNode, self.loadingNode);
      self.loadingNode.getChildByName('loadingSprite').runAction(
        cc.repeatForever(cc.rotateBy(1.0, 360))
      );
      cc.director.loadScene('default_map');
    } else {
      cc.sys.localStorage.removeItem("selfPlayer");
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
      self.enableInteractiveControls(true);
      switch (res.ret) {
        case self.retCodeDict.DUPLICATED:
          this.phoneNumberTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.LOG_OUT;
          break;
        case this.retCodeDict.TOKEN_EXPIRED:
          this.captchaTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.TOKEN_EXPIRED;
          break;
        case this.retCodeDict.SMS_CAPTCHA_NOT_MATCH:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case this.retCodeDict.INCORRECT_CAPTCHA:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case this.retCodeDict.SMS_CAPTCHA_CODE_NOT_EXISTING:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.SMS_CAPTCHA_NOT_MATCH");
          break;
        case this.retCodeDict.INCORRECT_PHONE_NUMBER:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.INCORRECT_PHONE_NUMBER");
          break;
        case this.retCodeDict.INVALID_REQUEST_PARAM:
          self.captchaTips.getComponent(cc.Label).string = i18n.t("login.tips.INCORRECT_PHONE_NUMBER");
          break;
        case this.retCodeDict.INCORRECT_PHONE_COUNTRY_CODE:
          this.captchaTips.getComponent(cc.Label).string = constants.ALERT.TIP_LABEL.INCORRECT_PHONE_COUNTRY_CODE;
          break;
        default:
          break;
      }
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
        console.log("Login attempt `useWXCodeLogin` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        cc.sys.localStorage.removeItem("selfPlayer");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
        self.wechatLoginTips.string = constants.ALERT.TIP_LABEL.WECHAT_LOGIN_FAILS + ", errorMsg =" + errMsg;
        window.history.replaceState({}, null, window.location.pathname);
      },
    });
  },

  getWechatCode(evt) {
    let self = this;
    self.wechatLoginTips.string = "";
    const wechatServerEndpoint = wechatAddress.PROTOCOL + "://" + wechatAddress.HOST + ((null != wechatAddress.PORT && "" != wechatAddress.PORT.trim()) ? (":" + wechatAddress.PORT) : "");
    const url = wechatServerEndpoint + constants.WECHAT.AUTHORIZE_PATH + "?" + wechatAddress.APPID_LITERAL + "&" + constants.WECHAT.REDIRECT_RUI_KEY + NetworkUtils.encode(window.location.href) + "&" + constants.WECHAT.RESPONSE_TYPE + "&" + constants.WECHAT.SCOPE + constants.WECHAT.FIN;
    console.log("To visit wechat auth addr: " + url);
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
          console.log("cannot get the wsConfig. retCode == " + res.ret);
          return;
        }
        const jsConfig = res.jsConfig;
        console.log(updateAppMsgShareDataObj);
        const configData = {
          debug: CC_DEBUG, // 开启调试模式,调用的所有api的返回值会在客户端alert出来，若要查看传入的参数，可以在pc端打开，参数信息会通过log打出，仅在pc端时才会打印。
          appId: jsConfig.app_id, // 必填，公众号的唯一标识
          timestamp: jsConfig.timestamp.toString(), // 必填，生成签名的时间戳
          nonceStr: jsConfig.nonce_str, // 必填，生成签名的随机串
          jsApiList: ['onMenuShareAppMessage', 'onMenuShareTimeline'],
          signature: jsConfig.signature, // 必填，签名
        };
        console.log("config url: " + wxConfigUrl);
        console.log("wx.config: ");
        console.log(configData);
        wx.config(configData);
        console.log("Current window.location.href: " + window.location.href);
        wx.ready(function() {
          console.log("Here is wx.ready.")
          wx.onMenuShareAppMessage(updateAppMsgShareDataObj);
          wx.onMenuShareTimeline(menuShareTimelineObj);
        });
        wx.error(function(res) {
          console.error("wx config fails and error is " + JSON.stringify(res));
        });
      },
      error: function(xhr, status, errMsg) {
        console.log("cannot get the wsConfig. errMsg == " + errMsg);
      },
    });
  },
});
