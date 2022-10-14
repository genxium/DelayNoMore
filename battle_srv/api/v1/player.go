package v1

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"go.uber.org/zap"
	"io/ioutil"
	"net/http"
	"server/api"
	. "server/common"
	"server/common/utils"
	"server/models"
	"server/storage"
	"strconv"

	. "dnmshared"
)

var Player = playerController{}

type playerController struct {
}

type smsCaptchaReq struct {
	Num         string `json:"phoneNum,omitempty" form:"phoneNum"`
	CountryCode string `json:"phoneCountryCode,omitempty" form:"phoneCountryCode"`
	Captcha     string `json:"smsLoginCaptcha,omitempty" form:"smsLoginCaptcha"`
}

func (req *smsCaptchaReq) extAuthID() string {
	return req.CountryCode + req.Num
}
func (req *smsCaptchaReq) redisKey() string {
	return "/cuisine/sms/captcha/" + req.extAuthID()
}

type wechatShareConfigReq struct {
	Url string `form:"url"`
}

func (p *playerController) GetWechatShareConfig(c *gin.Context) {
	var req wechatShareConfigReq
	err := c.ShouldBindWith(&req, binding.FormPost)
	api.CErr(c, err)
	if err != nil || req.Url == "" {
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}
	config, err := utils.WechatIns.GetJsConfig(req.Url)
	if err != nil {
		Logger.Info("err", zap.Any("", err))
		c.Set(api.RET, Constants.RetCode.WechatServerError)
		return
	}
	resp := struct {
		Ret    int             `json:"ret"`
		Config *utils.JsConfig `json:"jsConfig"`
	}{Constants.RetCode.Ok, config}
	c.JSON(http.StatusOK, resp)
}

func (p *playerController) SMSCaptchaGet(c *gin.Context) {
	var req smsCaptchaReq
	err := c.ShouldBindQuery(&req)
	api.CErr(c, err)
	if err != nil || req.Num == "" || req.CountryCode == "" {
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}
	// Composite a key to access against Redis-server.
	redisKey := req.redisKey()
	ttl, err := storage.RedisManagerIns.TTL(redisKey).Result()
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.UnknownError)
		return
	}
	// Redis剩余时长校验
	if ttl >= ConstVals.Player.CaptchaMaxTTL {
		Logger.Info("There's an existing SmsCaptcha record in Redis-server: ", zap.String("key", redisKey), zap.Duration("ttl", ttl))
		c.Set(api.RET, Constants.RetCode.SmsCaptchaRequestedTooFrequently)
		return
	}
	Logger.Info("A new SmsCaptcha record is needed for: ", zap.String("key", redisKey))
	pass := false
	var succRet int
	if Conf.General.ServerEnv == SERVER_ENV_TEST {
		// 测试环境，优先从数据库校验`player.name`，不通过再走机器人magic name校验
		player, err := models.GetPlayerByName(req.Num)
		if nil == err && nil != player {
			pass = true
			succRet = Constants.RetCode.IsTestAcc
		}
	}

	if !pass {
		// 机器人magic name校验，不通过再走手机号校验
		player, err := models.GetPlayerByName(req.Num)
		if nil == err && nil != player {
			pass = true
			succRet = Constants.RetCode.IsBotAcc
		}
	}

	if !pass {
		if RE_PHONE_NUM.MatchString(req.Num) {
			succRet = Constants.RetCode.Ok
			pass = true
		}
		// Hardecoded 只验证国内手机号格式
		if req.CountryCode == "86" {
			if RE_CHINA_PHONE_NUM.MatchString(req.Num) {
				succRet = Constants.RetCode.Ok
				pass = true
			} else {
				succRet = Constants.RetCode.InvalidRequestParam
				pass = false
			}
		}
	}
	if !pass {
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}
	resp := struct {
		Ret int `json:"ret"`
		smsCaptchaReq
		GetSmsCaptchaRespErrorCode int `json:"getSmsCaptchaRespErrorCode"`
	}{Ret: succRet}
	var captcha string
	if ttl >= 0 {
		// 已有未过期的旧验证码记录，续验证码有效期。
		storage.RedisManagerIns.Expire(redisKey, ConstVals.Player.CaptchaExpire)
		captcha = storage.RedisManagerIns.Get(redisKey).Val()
		if ttl >= ConstVals.Player.CaptchaExpire/4 {
			if succRet == Constants.RetCode.Ok {
				getSmsCaptchaRespErrorCode := sendSMSViaVendor(req.Num, req.CountryCode, captcha)
				if getSmsCaptchaRespErrorCode != 0 {
					resp.Ret = Constants.RetCode.GetSmsCaptchaRespErrorCode
					resp.GetSmsCaptchaRespErrorCode = getSmsCaptchaRespErrorCode
				}
			}
		}
		Logger.Info("Extended ttl of existing SMSCaptcha record in Redis:", zap.String("key", redisKey), zap.String("captcha", captcha))
	} else {
		// 校验通过，进行验证码生成处理
		captcha = strconv.Itoa(utils.Rand.Number(1000, 9999))
		if succRet == Constants.RetCode.Ok {
			getSmsCaptchaRespErrorCode := sendSMSViaVendor(req.Num, req.CountryCode, captcha)
			if getSmsCaptchaRespErrorCode != 0 {
				resp.Ret = Constants.RetCode.GetSmsCaptchaRespErrorCode
				resp.GetSmsCaptchaRespErrorCode = getSmsCaptchaRespErrorCode
			}
		}
		storage.RedisManagerIns.Set(redisKey, captcha, ConstVals.Player.CaptchaExpire)
		Logger.Info("Generated new captcha", zap.String("key", redisKey), zap.String("captcha", captcha))
	}
	if succRet == Constants.RetCode.IsTestAcc {
		resp.Captcha = captcha
	}
	if succRet == Constants.RetCode.IsBotAcc {
		resp.Captcha = captcha
	}
	c.JSON(http.StatusOK, resp)
}

func (p *playerController) SMSCaptchaLogin(c *gin.Context) {
	var req smsCaptchaReq
	err := c.ShouldBindWith(&req, binding.FormPost)
	api.CErr(c, err)
	if err != nil || req.Num == "" || req.CountryCode == "" || req.Captcha == "" {
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}

	redisKey := req.redisKey()
	captcha := storage.RedisManagerIns.Get(redisKey).Val()
	Logger.Info("Comparing captchas", zap.String("key", redisKey), zap.String("whats-in-redis", captcha), zap.String("whats-from-req", req.Captcha))
	if captcha != req.Captcha {
		c.Set(api.RET, Constants.RetCode.SmsCaptchaNotMatch)
		return
	}

	player, err := p.maybeCreateNewPlayer(req)
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}
	now := utils.UnixtimeMilli()
	token := utils.TokenGenerator(32)
	expiresAt := now + 1000*int64(Constants.Player.IntAuthTokenTTLSeconds)
	playerLogin := models.PlayerLogin{
		CreatedAt:    now,
		FromPublicIP: models.NewNullString(c.ClientIP()),
		IntAuthToken: token,
		PlayerID:     int(player.Id),
		DisplayName:  models.NewNullString(player.DisplayName),
		UpdatedAt:    now,
	}
	err = playerLogin.Insert()
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}
	storage.RedisManagerIns.Del(redisKey)
	resp := struct {
		Ret         int    `json:"ret"`
		Token       string `json:"intAuthToken"`
		ExpiresAt   int64  `json:"expiresAt"`
		PlayerID    int    `json:"playerId"`
		DisplayName string `json:"displayName"`
		Name        string `json:"name"`
	}{Constants.RetCode.Ok, token, expiresAt, int(player.Id), player.DisplayName, player.Name}

	c.JSON(http.StatusOK, resp)
}

type wechatLogin struct {
	Authcode string `form:"code"`
}

func (p *playerController) WechatLogin(c *gin.Context) {
	var req wechatLogin
	err := c.ShouldBindWith(&req, binding.FormPost)
	api.CErr(c, err)
	if err != nil || req.Authcode == "" {
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}

	//baseInfo ResAccessToken 获取用户授权access_token的返回结果
	baseInfo, err := utils.WechatIns.GetOauth2Basic(req.Authcode)

	if err != nil {
		Logger.Info("err", zap.Any("", err))
		c.Set(api.RET, Constants.RetCode.WechatServerError)
		return
	}

	userInfo, err := utils.WechatIns.GetMoreInfo(baseInfo.AccessToken, baseInfo.OpenID)

	if err != nil {
		Logger.Info("err", zap.Any("", err))
		c.Set(api.RET, Constants.RetCode.WechatServerError)
		return
	}
	//fserver不会返回openId
	userInfo.OpenID = baseInfo.OpenID

	player, err := p.maybeCreatePlayerWechatAuthBinding(userInfo)
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}

	now := utils.UnixtimeMilli()
	token := utils.TokenGenerator(32)
	expiresAt := now + 1000*int64(Constants.Player.IntAuthTokenTTLSeconds)
	playerLogin := models.PlayerLogin{
		CreatedAt:    now,
		FromPublicIP: models.NewNullString(c.ClientIP()),
		IntAuthToken: token,
		PlayerID:     int(player.Id),
		DisplayName:  models.NewNullString(player.DisplayName),
		UpdatedAt:    now,
		Avatar:       userInfo.HeadImgURL,
	}
	err = playerLogin.Insert()
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}

	resp := struct {
		Ret         int               `json:"ret"`
		Token       string            `json:"intAuthToken"`
		ExpiresAt   int64             `json:"expiresAt"`
		PlayerID    int               `json:"playerId"`
		DisplayName models.NullString `json:"displayName"`
		Avatar      string            `json:"avatar"`
	}{
		Constants.RetCode.Ok,
		token, expiresAt,
		playerLogin.PlayerID,
		playerLogin.DisplayName,
		userInfo.HeadImgURL,
	}
	c.JSON(http.StatusOK, resp)
}

type wechatGameLogin struct {
	Authcode  string `form:"code"`
	AvatarUrl string `form:"avatarUrl"`
	NickName  string `form:"nickName"`
}

func (p *playerController) WechatGameLogin(c *gin.Context) {
	var req wechatGameLogin
	err := c.ShouldBindWith(&req, binding.FormPost)
	if nil != err {
		Logger.Error("WechatGameLogin got an invalid request param error", zap.Error(err))
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}
	if "" == req.Authcode {
		Logger.Warn("WechatGameLogin got an invalid request param", zap.Any("req", req))
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}

	//baseInfo ResAccessToken 获取用户授权access_token的返回结果
	baseInfo, err := utils.WechatGameIns.GetOauth2Basic(req.Authcode)

	if err != nil {
		Logger.Info("err", zap.Any("", err))
		c.Set(api.RET, Constants.RetCode.WechatServerError)
		return
	}

	Logger.Info("baseInfo", zap.Any(":", baseInfo))
	//crate new userInfo from client userInfo
	userInfo := utils.UserInfo{
		Nickname:   req.NickName,
		HeadImgURL: req.AvatarUrl,
	}

	if err != nil {
		Logger.Info("err", zap.Any("", err))
		c.Set(api.RET, Constants.RetCode.WechatServerError)
		return
	}
	//fserver不会返回openId
	userInfo.OpenID = baseInfo.OpenID

	player, err := p.maybeCreatePlayerWechatGameAuthBinding(userInfo)
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}

	now := utils.UnixtimeMilli()
	token := utils.TokenGenerator(32)
	expiresAt := now + 1000*int64(Constants.Player.IntAuthTokenTTLSeconds)
	playerLogin := models.PlayerLogin{
		CreatedAt:    now,
		FromPublicIP: models.NewNullString(c.ClientIP()),
		IntAuthToken: token,
		PlayerID:     int(player.Id),
		DisplayName:  models.NewNullString(player.DisplayName),
		UpdatedAt:    now,
		Avatar:       userInfo.HeadImgURL,
	}
	err = playerLogin.Insert()
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}

	resp := struct {
		Ret         int               `json:"ret"`
		Token       string            `json:"intAuthToken"`
		ExpiresAt   int64             `json:"expiresAt"`
		PlayerID    int               `json:"playerId"`
		DisplayName models.NullString `json:"displayName"`
		Avatar      string            `json:"avatar"`
	}{
		Constants.RetCode.Ok,
		token, expiresAt,
		playerLogin.PlayerID,
		playerLogin.DisplayName,
		userInfo.HeadImgURL,
	}
	c.JSON(http.StatusOK, resp)
}

func (p *playerController) IntAuthTokenLogin(c *gin.Context) {
	token := p.getIntAuthToken(c)
	if "" == token {
		return
	}
	playerLogin, err := models.GetPlayerLoginByToken(token)
	api.CErr(c, err)
	if err != nil || playerLogin == nil {
		c.Set(api.RET, Constants.RetCode.InvalidToken)
		return
	}

	//kobako: 从player获取display name等
	player, err := models.GetPlayerById(playerLogin.PlayerID)
	if err != nil {
		Logger.Error("Get player by id in IntAuthTokenLogin function error: ", zap.Error(err))
		return
	}

	expiresAt := playerLogin.UpdatedAt + 1000*int64(Constants.Player.IntAuthTokenTTLSeconds)
	resp := struct {
		Ret         int    `json:"ret"`
		Token       string `json:"intAuthToken"`
		ExpiresAt   int64  `json:"expiresAt"`
		PlayerID    int    `json:"playerId"`
		DisplayName string `json:"displayName"`
		Avatar      string `json:"avatar"`
		Name        string `json:"name"`
	}{Constants.RetCode.Ok, token, expiresAt,
		playerLogin.PlayerID, player.DisplayName,
		playerLogin.Avatar, player.Name,
	}
	c.JSON(http.StatusOK, resp)
}

func (p *playerController) IntAuthTokenLogout(c *gin.Context) {
	token := p.getIntAuthToken(c)
	if "" == token {
		return
	}
	err := models.DelPlayerLoginByToken(token)
	api.CErr(c, err)
	if err != nil {
		c.Set(api.RET, Constants.RetCode.UnknownError)
		return
	}
	c.Set(api.RET, Constants.RetCode.Ok)
}

func (p *playerController) FetchProfile(c *gin.Context) {
	targetPlayerId := c.GetInt(api.TARGET_PLAYER_ID)
	wallet, err := models.GetPlayerWalletById(targetPlayerId)
	if err != nil {
		api.CErr(c, err)
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}
	player, err := models.GetPlayerById(targetPlayerId)
	if err != nil {
		api.CErr(c, err)
		c.Set(api.RET, Constants.RetCode.MysqlError)
		return
	}
	if wallet == nil || player == nil {
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return
	}
	resp := struct {
		Ret           int                  `json:"ret"`
		TutorialStage int                  `json:"tutorialStage"`
		Wallet        *models.PlayerWallet `json:"wallet"`
	}{Constants.RetCode.Ok, player.TutorialStage, wallet}
	c.JSON(http.StatusOK, resp)
}

func (p *playerController) TokenAuth(c *gin.Context) {
	var req struct {
		Token          string `form:"intAuthToken"`
		TargetPlayerId int    `form:"targetPlayerId"`
	}
	err := c.ShouldBindWith(&req, binding.FormPost)
	if err == nil {
		playerLogin, err := models.GetPlayerLoginByToken(req.Token)
		api.CErr(c, err)
		if err == nil && playerLogin != nil {
			c.Set(api.PLAYER_ID, playerLogin.PlayerID)
			c.Set(api.TARGET_PLAYER_ID, req.TargetPlayerId)
			c.Next()
			return
		}
	}
	Logger.Debug("TokenAuth Failed", zap.String("token", req.Token))
	c.Set(api.RET, Constants.RetCode.InvalidToken)
	c.Abort()
}

// 以下是内部私有函数
func (p *playerController) maybeCreateNewPlayer(req smsCaptchaReq) (*models.Player, error) {
	extAuthID := req.extAuthID()
	if Conf.General.ServerEnv == SERVER_ENV_TEST {
		player, err := models.GetPlayerByName(req.Num)
		if err != nil {
			Logger.Error("Seeking test env player error:", zap.Error(err))
			return nil, err
		}
		if player != nil {
			Logger.Info("Got a test env player:", zap.Any("phonenum", req.Num), zap.Any("playerId", player.Id))
			return player, nil
		}
	} else { //正式环境检查是否为bot用户
		botPlayer, err := models.GetPlayerByName(req.Num)
		if err != nil {
			Logger.Error("Seeking bot player error:", zap.Error(err))
			return nil, err
		}
		if botPlayer != nil {
			Logger.Info("Got a bot player:", zap.Any("phonenum", req.Num), zap.Any("playerId", botPlayer.Id))
			return botPlayer, nil
		}
	}

	bind, err := models.GetPlayerAuthBinding(Constants.AuthChannel.Sms, extAuthID)
	if err != nil {
		return nil, err
	}
	if bind != nil {
		player, err := models.GetPlayerById(bind.PlayerID)
		if err != nil {
			return nil, err
		}
		if player != nil {
			return player, nil
		}
	}
	now := utils.UnixtimeMilli()
	player := models.Player{
		CreatedAt: now,
		UpdatedAt: now,
	}
	return p.createNewPlayer(player, extAuthID, int(Constants.AuthChannel.Sms))

}

func (p *playerController) maybeCreatePlayerWechatAuthBinding(userInfo utils.UserInfo) (*models.Player, error) {
	bind, err := models.GetPlayerAuthBinding(Constants.AuthChannel.Wechat, userInfo.OpenID)
	if err != nil {
		return nil, err
	}
	if bind != nil {
		player, err := models.GetPlayerById(bind.PlayerID)
		if err != nil {
			return nil, err
		}
		if player != nil {
			{ //更新玩家姓名及头像
				updateInfo := models.Player{
					Avatar:      userInfo.HeadImgURL,
					DisplayName: userInfo.Nickname,
				}
				tx := storage.MySQLManagerIns.MustBegin()
				defer tx.Rollback()
				ok, err := models.Update(tx, player.Id, &updateInfo)
				if err != nil && ok != true {
					return nil, err
				} else {
					tx.Commit()
				}
			}
			return player, nil
		}
	}
	now := utils.UnixtimeMilli()
	player := models.Player{
		CreatedAt:   now,
		UpdatedAt:   now,
		DisplayName: userInfo.Nickname,
		Avatar:      userInfo.HeadImgURL,
	}
	return p.createNewPlayer(player, userInfo.OpenID, int(Constants.AuthChannel.Wechat))
}

func (p *playerController) maybeCreatePlayerWechatGameAuthBinding(userInfo utils.UserInfo) (*models.Player, error) {
	bind, err := models.GetPlayerAuthBinding(Constants.AuthChannel.WechatGame, userInfo.OpenID)
	if err != nil {
		return nil, err
	}
	if bind != nil {
		player, err := models.GetPlayerById(bind.PlayerID)
		if err != nil {
			return nil, err
		}
		if player != nil {
			{ //更新玩家姓名及头像
				updateInfo := models.Player{
					Avatar:      userInfo.HeadImgURL,
					DisplayName: userInfo.Nickname,
				}
				tx := storage.MySQLManagerIns.MustBegin()
				defer tx.Rollback()
				ok, err := models.Update(tx, player.Id, &updateInfo)
				if err != nil && ok != true {
					return nil, err
				} else {
					tx.Commit()
				}
			}
			return player, nil
		}
	}
	now := utils.UnixtimeMilli()
	player := models.Player{
		CreatedAt:   now,
		UpdatedAt:   now,
		DisplayName: userInfo.Nickname,
		Avatar:      userInfo.HeadImgURL,
	}
	return p.createNewPlayer(player, userInfo.OpenID, int(Constants.AuthChannel.WechatGame))
}

func (p *playerController) createNewPlayer(player models.Player, extAuthID string, channel int) (*models.Player, error) {
	Logger.Debug("createNewPlayer", zap.String("extAuthID", extAuthID))
	now := utils.UnixtimeMilli()
	tx := storage.MySQLManagerIns.MustBegin()
	defer tx.Rollback()
	err := player.Insert(tx)
	if err != nil {
		return nil, err
	}
	playerAuthBinding := models.PlayerAuthBinding{
		CreatedAt: now,
		UpdatedAt: now,
		Channel:   channel,
		ExtAuthID: extAuthID,
		PlayerID:  int(player.Id),
	}
	err = playerAuthBinding.Insert(tx)
	if err != nil {
		return nil, err
	}
	wallet := models.PlayerWallet{
		CreatedAt: now,
		UpdatedAt: now,
		ID:        int(player.Id),
	}
	err = wallet.Insert(tx)
	if err != nil {
		return nil, err
	}
	tx.Commit()
	return &player, nil
}

type intAuthTokenReq struct {
	Token string `form:"intAuthToken,omitempty"`
}

func (p *playerController) getIntAuthToken(c *gin.Context) string {
	var req intAuthTokenReq
	err := c.ShouldBindWith(&req, binding.FormPost)
	api.CErr(c, err)
	if err != nil || "" == req.Token {
		c.Set(api.RET, Constants.RetCode.InvalidRequestParam)
		return ""
	}
	return req.Token
}

type tel struct {
	Mobile     string `json:"mobile"`
	Nationcode string `json:"nationcode"`
}

type captchaReq struct {
	Ext    string     `json:"ext"`
	Extend string     `json:"extend"`
	Params *[2]string `json:"params"`
	Sig    string     `json:"sig"`
	Sign   string     `json:"sign"`
	Tel    *tel       `json:"tel"`
	Time   int64      `json:"time"`
	Tpl_id int        `json:"tpl_id"`
}

func sendSMSViaVendor(mobile string, nationcode string, captchaCode string) int {
	tel := &tel{
		Mobile:     mobile,
		Nationcode: nationcode,
	}
	var captchaExpireMin string
	//短信有效期hardcode
	if Conf.General.ServerEnv == SERVER_ENV_TEST {
		//测试环境下有效期为20秒 先hardcode了
		captchaExpireMin = "0.5"
	} else {
		captchaExpireMin = strconv.Itoa(int(ConstVals.Player.CaptchaExpire) / 60000000000)
	}
	params := [2]string{captchaCode, captchaExpireMin}
	appkey := "41a5142feff0b38ade02ea12deee9741" // TODO: Should read from config file!
	rand := strconv.Itoa(utils.Rand.Number(1000, 9999))
	now := utils.UnixtimeSec()

	hash := sha256.New()
	hash.Write([]byte("appkey=" + appkey + "&random=" + rand + "&time=" + strconv.FormatInt(now, 10) + "&mobile=" + mobile))
	md := hash.Sum(nil)
	sig := hex.EncodeToString(md)

	reqData := &captchaReq{
		Ext:    "",
		Extend: "",
		Params: &params,
		Sig:    sig,
		Sign:   "洛克互娱",
		Tel:    tel,
		Time:   now,
		Tpl_id: 207399,
	}
	reqDataString, err := json.Marshal(reqData)
	req := bytes.NewBuffer([]byte(reqDataString))
	if err != nil {
		Logger.Info("json marshal", zap.Any("err:", err))
		return -1
	}
	resp, err := http.Post("https://yun.tim.qq.com/v5/tlssmssvr/sendsms?sdkappid=1400150185&random="+rand,
		"application/json",
		req)
	if err != nil {
		Logger.Info("resp", zap.Any("err:", err))
	}
	defer resp.Body.Close()
	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		Logger.Info("body", zap.Any("response body err:", err))
	}
	type bodyStruct struct {
		Result int `json:"result"`
	}
	var body bodyStruct
	json.Unmarshal(respBody, &body)
	return body.Result
}
