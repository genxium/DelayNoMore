package common

type constants struct {
	AuthChannel struct {
		Sms        int `json:"SMS"`
		Wechat     int `json:"WECHAT"`
		WechatGame int `json:"WECHAT_GAME"`
	} `json:"AUTH_CHANNEL"`
	Player struct {
		Diamond                     int `json:"DIAMOND"`
		Energy                      int `json:"ENERGY"`
		Gold                        int `json:"GOLD"`
		IntAuthTokenTTLSeconds      int `json:"INT_AUTH_TOKEN_TTL_SECONDS"`
		SmsExpiredSeconds           int `json:"SMS_EXPIRED_SECONDS"`
		SmsValidResendPeriodSeconds int `json:"SMS_VALID_RESEND_PERIOD_SECONDS"`
	} `json:"PLAYER"`
	RetCode struct {
		ActiveWatchdog                                   int    `json:"ACTIVE_WATCHDOG"`
		BattleStopped                                    int    `json:"BATTLE_STOPPED"`
		ClientMismatchedRenderFrame                      int    `json:"CLIENT_MISMATCHED_RENDER_FRAME"`
		Duplicated                                       int    `json:"DUPLICATED"`
		FailedToCreate                                   int    `json:"FAILED_TO_CREATE"`
		FailedToDelete                                   int    `json:"FAILED_TO_DELETE"`
		FailedToUpdate                                   int    `json:"FAILED_TO_UPDATE"`
		GetSmsCaptchaRespErrorCode                       int    `json:"GET_SMS_CAPTCHA_RESP_ERROR_CODE"`
		IncorrectCaptcha                                 int    `json:"INCORRECT_CAPTCHA"`
		IncorrectHandle                                  int    `json:"INCORRECT_HANDLE"`
		IncorrectPassword                                int    `json:"INCORRECT_PASSWORD"`
		IncorrectPhoneCountryCode                        int    `json:"INCORRECT_PHONE_COUNTRY_CODE"`
		IncorrectPhoneNumber                             int    `json:"INCORRECT_PHONE_NUMBER"`
		InsufficientMemToAllocateConnection              int    `json:"INSUFFICIENT_MEM_TO_ALLOCATE_CONNECTION"`
		InvalidEmailLiteral                              int    `json:"INVALID_EMAIL_LITERAL"`
		InvalidRequestParam                              int    `json:"INVALID_REQUEST_PARAM"`
		InvalidToken                                     int    `json:"INVALID_TOKEN"`
		IsBotAcc                                         int    `json:"IS_BOT_ACC"`
		IsTestAcc                                        int    `json:"IS_TEST_ACC"`
		LackOfDiamond                                    int    `json:"LACK_OF_DIAMOND"`
		LackOfEnergy                                     int    `json:"LACK_OF_ENERGY"`
		LackOfGold                                       int    `json:"LACK_OF_GOLD"`
		LocallyNoAvailableRoom                           int    `json:"LOCALLY_NO_AVAILABLE_ROOM"`
		LocallyNoSpecifiedRoom                           int    `json:"LOCALLY_NO_SPECIFIED_ROOM"`
		MapNotUnlocked                                   int    `json:"MAP_NOT_UNLOCKED"`
		MysqlError                                       int    `json:"MYSQL_ERROR"`
		NewHandleConflict                                int    `json:"NEW_HANDLE_CONFLICT"`
		NonexistentAct                                   int    `json:"NONEXISTENT_ACT"`
		NonexistentActHandler                            int    `json:"NONEXISTENT_ACT_HANDLER"`
		NotImplementedYet                                int    `json:"NOT_IMPLEMENTED_YET"`
		NoAssociatedEmail                                int    `json:"NO_ASSOCIATED_EMAIL"`
		Ok                                               int    `json:"OK"`
		PasswordResetCodeGenerationPerEmailTooFrequently int    `json:"PASSWORD_RESET_CODE_GENERATION_PER_EMAIL_TOO_FREQUENTLY"`
		PlayerCheating                                   int    `json:"PLAYER_CHEATING"`
		PlayerNotAddableToRoom                           int    `json:"PLAYER_NOT_ADDABLE_TO_ROOM"`
		PlayerNotFound                                   int    `json:"PLAYER_NOT_FOUND"`
		PlayerNotReaddableToRoom                         int    `json:"PLAYER_NOT_READDABLE_TO_ROOM"`
		SamePlayerAlreadyInSameRoom                      int    `json:"SAME_PLAYER_ALREADY_IN_SAME_ROOM"`
		SendEmailTimeout                                 int    `json:"SEND_EMAIL_TIMEOUT"`
		SmsCaptchaNotMatch                               int    `json:"SMS_CAPTCHA_NOT_MATCH"`
		SmsCaptchaRequestedTooFrequently                 int    `json:"SMS_CAPTCHA_REQUESTED_TOO_FREQUENTLY"`
		TradeCreationTooFrequently                       int    `json:"TRADE_CREATION_TOO_FREQUENTLY"`
		UnknownError                                     int    `json:"UNKNOWN_ERROR"`
		WechatServerError                                int    `json:"WECHAT_SERVER_ERROR"`
		Comment                                          string `json:"__comment__"`
	} `json:"RET_CODE"`
	Ws struct {
		IntervalToPing        int `json:"INTERVAL_TO_PING"`
		WillKickIfInactiveFor int `json:"WILL_KICK_IF_INACTIVE_FOR"`
	} `json:"WS"`
}
