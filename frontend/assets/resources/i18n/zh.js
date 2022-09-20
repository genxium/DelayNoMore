'use strict';

if (!window.i18n) {
  window.i18n = {};
}

if (!window.i18n.languages) {
  window.i18n.languages = {};
}

window.i18n.languages['zh'] = {
  resultPanel: {
    winnerLabel: "Winner",
    loserLabel: "Loser",
    timeLabel: "Time:",
    timeTip: "(the last time to pick up the treasure) ",
    awardLabel: "Award:",
    againBtnLabel: "再来一局",
    homeBtnLabel: "回到首页",
  },
  gameRule:{
    tip: "玩家在规定时间内得分高则获胜。要注意躲避防御塔的攻击，被击中会被定住5秒的哦。开始游戏吧~",
    mode: "1v1 模式",
  },
  login: {
    "tips": {
      "LOGOUT": '登出',
      "LOGIN_TOKEN_EXPIRED": '登入状态已过期，请重新登入',
      "PHONE_COUNTRY_CODE_ERR": '电话号码的国家号不正确',
      "CAPTCHA_ERR": '格式有误',
      "PHONE_ERR": '电话号码的格式不对',
      "SMS_CAPTCHA_FREQUENT_REQUIRE": '请求过于频繁，请稍候再试',
      "SMS_CAPTCHA_NOT_MATCH": '验证码不正确',
      "TEST_USER": '测试账号',
      "INCORRECT_PHONE_NUMBER": '电话号码不正确',
      "LOGGED_IN_SUCCESSFULLY": "登入成功，正在加载中...",

      "PLEASE_AUTHORIZE_WECHAT_LOGIN_FIRST": "请先点击屏幕进行微信授权登录",
      "WECHAT_AUTHORIZED_AND_INT_AUTH_TOKEN_LOGGING_IN": "微信授权登录成功，正在登入...",
      "WECHAT_LOGIN_FAILED_TAP_SCREEN_TO_RETRY": "微信授权登录失败，请点击屏幕重试",
      "AUTO_LOGIN_FAILED_WILL_USE_MANUAL_LOGIN": "自动登入失败，请点击屏幕空白处手动授权登入...",
      "AUTO_LOGIN_1": "正在自动登入",
      "AUTO_LOGIN_2": "正在自动登入...",
    },
  },
  findingPlayer: {
    exit: "退出",
    tip: "我们正在为你匹配另一位玩家，请稍等",
    finding: "等等我，马上到...",
  },
  gameTip: {
    start: "游戏开始!",
    resyncing: "正在重连，请稍等...",
  },
};
