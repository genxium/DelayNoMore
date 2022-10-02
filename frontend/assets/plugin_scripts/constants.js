"use strict";

var _ROUTE_PATH;

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

var constants = {
  BGM: {
    DIR_PATH: "resources/musicEffect/",
    FILE_NAME: {
      TREASURE_PICKEDUP: "TreasurePicked",
      CRASHED_BY_TRAP_BULLET: "CrashedByTrapBullet",
      HIGH_SCORE_TREASURE_PICKED:"HighScoreTreasurePicked",
      COUNT_DOWN_10SEC_TO_END:"countDown10SecToEnd",
      BGM: "BGM" 
    }
  },
  ROUTE_PATH: (_ROUTE_PATH = {
    PLAYER: "/player",
    JSCONFIG: "/jsconfig",
    API: "/api",
    VERSION: "/v1",
    SMS_CAPTCHA: "/SmsCaptcha",
    INT_AUTH_TOKEN: "/IntAuthToken",
    LOGIN: "/login",
    LOGOUT: "/logout",
    GET: "/get",
    TUTORIAL: "/tutorial",
    REPORT: "/report",
    LIST: "/list",
    READ: "/read",
    PROFILE: "/profile",
    FETCH: "/fetch",
  }, _defineProperty(_ROUTE_PATH, "LOGIN", "/login"), _defineProperty(_ROUTE_PATH, "RET_CODE", "/retCode"), _defineProperty(_ROUTE_PATH, "REGEX", "/regex"), _defineProperty(_ROUTE_PATH, "SMS_CAPTCHA", "/SmsCaptcha"), _defineProperty(_ROUTE_PATH, "GET", "/get"), _ROUTE_PATH),
  REQUEST_QUERY: {
    ROOM_ID: "roomId",
    TOKEN: "/token"
  },
  GAME_SYNC: {
    SERVER_UPSYNC: 30,
    CLIENT_UPSYNC: 30
  },
  RET_CODE: {
    /**
    * NOTE: The "RET_CODE"s from 1000-1015 are reserved for the websocket "WebsocketStdCloseCode"s.
    *
    * References
    * - https://tools.ietf.org/html/rfc6455#section-7.4
    * - https://godoc.org/github.com/gorilla/websocket#pkg-constants.
    */
    "__comment__": "基础",
    "OK": 9000,
    "UNKNOWN_ERROR": 9001,
    "INVALID_REQUEST_PARAM": 9002,
    "IS_TEST_ACC": 9003,
    "MYSQL_ERROR": 9004,
    "NONEXISTENT_ACT": 9005,
    "LACK_OF_DIAMOND": 9006,
    "LACK_OF_GOLD": 9007,
    "LACK_OF_ENERGY": 9008,
    "NONEXISTENT_ACT_HANDLER": 9009,
    "LOCALLY_NO_AVAILABLE_ROOM": 9010,
    "LOCALLY_NO_SPECIFIED_ROOM": 9011,
    "PLAYER_NOT_ADDABLE_TO_ROOM": 9012,
    "PLAYER_NOT_READDABLE_TO_ROOM": 9013,
    "PLAYER_NOT_FOUND": 9014,
    "PLAYER_CHEATING": 9015,
  

    "__comment__": "SMS",
    "SMS_CAPTCHA_REQUESTED_TOO_FREQUENTLY": 5001,
    "SMS_CAPTCHA_NOT_MATCH": 5002,
    "INVALID_TOKEN": 2001,

    "DUPLICATED": 2002,
    "INCORRECT_HANDLE": 2004,
    "NONEXISTENT_HANDLE": 2005,
    "INCORRECT_PASSWORD": 2006,
    "INCORRECT_CAPTCHA": 2007,
    "INVALID_EMAIL_LITERAL": 2008,
    "NO_ASSOCIATED_EMAIL": 2009,
    "SEND_EMAIL_TIMEOUT": 2010,
    "INCORRECT_PHONE_COUNTRY_CODE": 2011,
    "NEW_HANDLE_CONFLICT": 2013,
    "FAILED_TO_UPDATE": 2014,
    "FAILED_TO_DELETE": 2015,
    "FAILED_TO_CREATE": 2016,
    "INCORRECT_PHONE_NUMBER": 2018,
    "PASSWORD_RESET_CODE_GENERATION_PER_EMAIL_TOO_FREQUENTLY": 4000,
    "TRADE_CREATION_TOO_FREQUENTLY": 4002,
    "MAP_NOT_UNLOCKED": 4003,

    "NOT_IMPLEMENTED_YET": 65535
  },
  ALERT: {
    TIP_NODE: 'captchaTips',
    TIP_LABEL: {
      INCORRECT_PHONE_COUNTRY_CODE: '国家号不正确',
      CAPTCHA_ERR: '验证码不正确',
      PHONE_ERR: '手机号格式不正确',
      TOKEN_EXPIRED: 'token已过期!',
      SMS_CAPTCHA_FREEQUENT_REQUIRE: '请求过于频繁',
      SMS_CAPTCHA_NOT_MATCH: '验证码不正确',
      TEST_USER: '该账号为测试账号',
      INCORRECT_PHONE_NUMBER: '手机号不正确',
      LOG_OUT: '您已在其他地方登陆',
      GAME_OVER: '游戏结束,您的得分是',
    },
    CONFIRM_BUTTON_LABEL: {
      RESTART: '重新开始'
    }
  },
  PLAYER: '玩家',
  ONLINE: '在线',
  NOT_ONLINE: '',
  SPEED: {
    NORMAL: 100,
    PAUSE: 0
  },
  COUNTDOWN_LABEL: {
    BASE: '倒计时 ',
    MINUTE: '00',
    SECOND: '30'
  },
  SCORE_LABEL: {
    BASE: '分数 ',
    PLUS_SCORE: 5,
    MINUS_SECOND: 5,
    INIT_SCORE: 0
  },
  TUTORIAL_STAGE: {
    NOT_YET_STARTED: 0,
    ENDED: 1,
  },
};
window.constants = constants;
