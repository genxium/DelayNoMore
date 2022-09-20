'use strict';

if (!window.i18n) {
  window.i18n = {};
}

if (!window.i18n.languages) {
  window.i18n.languages = {};
}

window.i18n.languages['en'] = {
  resultPanel: {
    winnerLabel: "Winner",
    loserLabel: "Loser",
    timeLabel: "Time:",
    timeTip: "(the last time to pick up the treasure) ",
    awardLabel: "Award:",
    againBtnLabel: "Again",
    homeBtnLabel: "Home",
  },
  gameRule: {
    tip: "经典吃豆人玩法，加入了实时对战元素。金豆100分，煎蛋200分，玩家在规定时间内得分高则获胜。要注意躲避防御塔攻击，被击中会被定住5秒的哦。开始游戏吧~",
    mode: "1v1 模式",
  },
  login: {
    "tips": {
      "LOGOUT": 'Logout',
      "DUPLICATED": 'Login id conflict, please retry',
      "LOGIN_TOKEN_EXPIRED": 'Previous login status expired',
      "PHONE_COUNTRY_CODE_ERR": 'Incorrect phone country code',
      "CAPTCHA_ERR": 'Incorrect format',
      "PHONE_ERR": 'Incorrect phone number format',
      "SMS_CAPTCHA_FREQUENT_REQUIRE": 'Request too often',
      "SMS_CAPTCHA_NOT_MATCH": 'Incorrect verification code',
      "TEST_USER": 'test account',
      "INCORRECT_PHONE_NUMBER": 'Incorrect phone number',
      "LOGGED_IN_SUCCESSFULLY": "Logged in successfully, please wait...",

      "PLEASE_AUTHORIZE_WECHAT_LOGIN_FIRST": "Please tap the screen to authorize WeChat login first",
      "WECHAT_AUTHORIZED_AND_INT_AUTH_TOKEN_LOGGING_IN": "WeChat authorized, logging in...",
      "WECHAT_LOGIN_FAILED_TAP_SCREEN_TO_RETRY": "WeChat login failed, tap the screen to retry",
      "AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN": "Auto login failed, creating manual login button",
      "AUTO_LOGIN_1": "Automatically logging in",
      "AUTO_LOGIN_2": "Automatically logging in...",
    },
  },
  findingPlayer: {
    exit: "Exit",
    tip: "我们正在为你匹配另一位玩家，请稍等",
    finding: "等等我，马上到...",
  },
  gameTip: {
    start: "Start!",
    resyncing: "Resyncing your battle, please wait...",
  },

};
