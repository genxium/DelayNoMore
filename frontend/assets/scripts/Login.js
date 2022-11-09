const i18n = require('LanguageData');
i18n.init(window.language); // languageID should be equal to the one we input in New Language ID input field

window.pb = require("./modules/room_downsync_frame_proto_bundle.forcemsg");

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
    }
  },

  // LIFE-CYCLE CALLBACKS:

  onLoad() {

    window.atFirstLocationHref = window.location.href.split('#')[0];
    const self = this;
    self.getRetCodeList();
    self.getRegexList();

    self.phoneNumberTips.active = true;
    self.smsLoginCaptchaButton.active = true;

    self.captchaTips.active = true;
    self.phoneCountryCodeInput.active = true;
    self.phoneNumberInput.active = true;
    self.smsLoginCaptchaInput.active = true;

    self.phoneLabel.active = true;
    self.smsLoginCaptchaLabel.active = true;

    self.loginButton.active = true;
	self.onLoginButtonClicked = self.onLoginButtonClicked.bind(self);
	self.onSMSCaptchaGetButtonClicked = self.onSMSCaptchaGetButtonClicked.bind(self);
    self.smsLoginCaptchaButton.on('click', self.onSMSCaptchaGetButtonClicked);

    self.loadingNode = cc.instantiate(this.loadingPrefab);
    self.smsGetCaptchaNode = self.smsLoginCaptchaButton.getChildByName('smsGetCaptcha');
    self.smsWaitCountdownNode = cc.instantiate(self.smsWaitCountdownPrefab);

    const qDict = window.getQueryParamDict();
    if (null != qDict && qDict["expectedRoomId"]) {
      window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
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
		console.warn("Couldn't find selfPlayer key in local cache");
        reject();
        return;
      }
      const selfPlayer = JSON.parse(cc.sys.localStorage.getItem('selfPlayer'));
	  if (null == selfPlayer) {
		console.warn("Couldn't find selfPlayer object in local cache");
		reject();
		return;
	  } 

	  if (null == selfPlayer.intAuthToken) {
		console.warn("Couldn't find selfPlayer object with key `intAuthToken` in local cache");
		reject();
		return;
	  } 
      if (new Date().getTime() > selfPlayer.expiresAt) {
		console.warn("Couldn't find unexpired selfPlayer `intAuthToken` in local cache");
		reject();
		return;
      }
	  resolve(selfPlayer.intAuthToken);
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
        console.log("Login attempt `useTokenLogin` succeeded.");
        self.onLoggedIn(resp);
      },
      error: function(xhr, status, errMsg) {
        console.warn("Login attempt `useTokenLogin` failed, about to execute `clearBoundRoomIdInBothVolatileAndPersistentStorage`.");
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage()
      },
      timeout: function() {
        console.warn("Login attempt `useTokenLogin` timed out, about to enable interactive controls.");
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

  onLoggedIn(res) {
    const self = this;
    console.log("OnLoggedIn ", JSON.stringify(res))
    if (res.ret === self.retCodeDict.OK) {
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
   	  console.log("OnLoggedIn failed, about to remove `selfPlayer` in local cache.")
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
});
