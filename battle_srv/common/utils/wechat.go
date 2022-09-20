package utils

import (
	"bytes"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"io"
	"io/ioutil"
	"math/rand"
	"net/http"
	. "server/common"
	. "server/configs"
	"sort"
	"time"
)

var WechatIns *wechat
var WechatGameIns *wechat

func InitWechat(conf WechatConfig) {
	WechatIns = NewWechatIns(&conf, Constants.AuthChannel.Wechat)
}

func InitWechatGame(conf WechatConfig) {
	WechatGameIns = NewWechatIns(&conf, Constants.AuthChannel.WechatGame)
}

func NewWechatIns(conf *WechatConfig, channel int) *wechat {
	newWechat := &wechat{
		config:  conf,
		channel: channel,
	}
	return newWechat
}

const ()

type wechat struct {
	config  *WechatConfig
	channel int
}

// CommonError 微信返回的通用错误json
type CommonError struct {
	ErrCode int64  `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

// ResAccessToken 获取用户授权access_token的返回结果
type resAccessToken struct {
	CommonError

	AccessToken  string `json:"access_token"`
	ExpiresIn    int64  `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	OpenID       string `json:"openid"`
	Scope        string `json:"scope"`
}

// Config 返回给用户jssdk配置信息
type JsConfig struct {
	AppID     string `json:"app_id"`
	Timestamp int64  `json:"timestamp"`
	NonceStr  string `json:"nonce_str"`
	Signature string `json:"signature"`
}

// resTicket 请求jsapi_tikcet返回结果
type resTicket struct {
	CommonError

	Ticket    string `json:"ticket"`
	ExpiresIn int64  `json:"expires_in"`
}

func (w *wechat) GetJsConfig(uri string) (config *JsConfig, err error) {
	config = new(JsConfig)
	var ticketStr string
	ticketStr, err = w.getTicket()
	if err != nil {
		return
	}
	nonceStr := randomStr(16)
	timestamp := UnixtimeSec()
	str := fmt.Sprintf("jsapi_ticket=%s&noncestr=%s&timestamp=%d&url=%s", ticketStr, nonceStr, timestamp, uri)
	sigStr := signature(str)

	config.AppID = w.config.AppID
	config.NonceStr = nonceStr
	config.Timestamp = timestamp
	config.Signature = sigStr
	return
}

//TODO add cache, getTicket 获取jsapi_ticket
func (w *wechat) getTicket() (ticketStr string, err error) {
	var ticket resTicket
	ticket, err = w.getTicketFromServer()
	if err != nil {
		return
	}
	ticketStr = ticket.Ticket
	return
}

func (w *wechat) GetOauth2Basic(authcode string) (result resAccessToken, err error) {
	var accessTokenURL string
	if w.channel == Constants.AuthChannel.WechatGame {
		accessTokenURL = w.config.ApiProtocol + "://" + w.config.ApiGateway + "/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code"
	}
	if w.channel == Constants.AuthChannel.Wechat {
		accessTokenURL = w.config.ApiProtocol + "://" + w.config.ApiGateway + "/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code"
	}
	urlStr := fmt.Sprintf(accessTokenURL, w.config.AppID, w.config.AppSecret, authcode)
	Logger.Info("urlStr", zap.Any(":", urlStr))
	response, err := get(urlStr)
	if err != nil {
		return
	}
	err = json.Unmarshal(response, &result)
	if err != nil {
		Logger.Info("GetOauth2Basic marshal error", zap.Any("err", err))
		return
	}
	if result.ErrCode != 0 {
		err = fmt.Errorf("GetOauth2Basic error : errcode=%v , errmsg=%v", result.ErrCode, result.ErrMsg)
		return
	}
	return
}

//UserInfo 用户授权获取到用户信息
type UserInfo struct {
	CommonError
	OpenID     string   `json:"openid"`
	Nickname   string   `json:"nickname"`
	Sex        int32    `json:"sex"`
	Province   string   `json:"province"`
	City       string   `json:"city"`
	Country    string   `json:"country"`
	HeadImgURL string   `json:"headimgurl"`
	Privilege  []string `json:"privilege"`
	Unionid    string   `json:"unionid"`
}

func (w *wechat) GetMoreInfo(accessToken string, openId string) (result UserInfo, err error) {
	userInfoURL := w.config.ApiProtocol + "://" + w.config.ApiGateway + "/sns/userinfo?appid=%s&access_token=%s&openid=%s&lang=zh_CN"
	urlStr := fmt.Sprintf(userInfoURL, w.config.AppID, accessToken, openId)
	response, err := get(urlStr)
	if err != nil {
		return
	}
	err = json.Unmarshal(response, &result)
	if err != nil {
		Logger.Info("GetMoreInfo marshal error", zap.Any("err", err))
		return
	}
	if result.ErrCode != 0 {
		err = fmt.Errorf("GetMoreInfo error : errcode=%v , errmsg=%v", result.ErrCode, result.ErrMsg)
		return
	}
	return
}

//HTTPGet get 请求
func get(uri string) ([]byte, error) {
	response, err := http.Get(uri)
	if err != nil {
		return nil, err
	}

	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http get error : uri=%v , statusCode=%v", uri, response.StatusCode)
	}
	body, err := ioutil.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	return body, err
}

//PostJSON post json 数据请求
func post(uri string, obj interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(obj)
	if err != nil {
		return nil, err
	}

	jsonData = bytes.Replace(jsonData, []byte("\\u003c"), []byte("<"), -1)
	jsonData = bytes.Replace(jsonData, []byte("\\u003e"), []byte(">"), -1)
	jsonData = bytes.Replace(jsonData, []byte("\\u0026"), []byte("&"), -1)

	body := bytes.NewBuffer(jsonData)
	response, err := http.Post(uri, "application/json;charset=utf-8", body)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("http get error : uri=%v , statusCode=%v", uri, response.StatusCode)
	}
	return ioutil.ReadAll(response.Body)
}

//Signature sha1签名
func signature(params ...string) string {
	sort.Strings(params)
	h := sha1.New()
	for _, s := range params {
		io.WriteString(h, s)
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}

//RandomStr 随机生成字符串
func randomStr(length int) string {
	str := "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
	bytes := []byte(str)
	result := []byte{}
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	for i := 0; i < length; i++ {
		result = append(result, bytes[r.Intn(len(bytes))])
	}
	return string(result)
}

//getTicketFromServer 强制从服务器中获取ticket
func (w *wechat) getTicketFromServer() (ticket resTicket, err error) {
	var accessToken string
	accessToken, err = w.getAccessTokenFromServer()
	if err != nil {
		return
	}

	getTicketURL := w.config.ApiProtocol + "://" + w.config.ApiGateway + "/cgi-bin/ticket/getticket?access_token=%s&type=jsapi"
	var response []byte
	url := fmt.Sprintf(getTicketURL, accessToken)
	response, err = get(url)
	err = json.Unmarshal(response, &ticket)
	if err != nil {
		return
	}
	if ticket.ErrCode != 0 {
		err = fmt.Errorf("getTicket Error : errcode=%d , errmsg=%s", ticket.ErrCode, ticket.ErrMsg)
		return
	}

	//jsAPITicketCacheKey := fmt.Sprintf("jsapi_ticket_%s", w.config.AppID)
	//expires := ticket.ExpiresIn - 1500
	//set
	//err = js.Cache.Set(jsAPITicketCacheKey, ticket.Ticket, time.Duration(expires)*time.Second)
	return
}

//GetAccessTokenFromServer 强制从微信服务器获取token
func (w *wechat) getAccessTokenFromServer() (accessToken string, err error) {
	AccessTokenURL := w.config.ApiProtocol + "://" + w.config.ApiGateway + "/cgi-bin/token"
	url := fmt.Sprintf("%s?grant_type=client_credential&appid=%s&secret=%s", AccessTokenURL, w.config.AppID, w.config.AppSecret)
	var body []byte
	body, err = get(url)
	if err != nil {
		return
	}
	var r resAccessToken
	err = json.Unmarshal(body, &r)
	if err != nil {
		return
	}
	if r.ErrMsg != "" {
		err = fmt.Errorf("get access_token error : errcode=%v , errormsg=%v", r.ErrCode, r.ErrMsg)
		return
	}

	//accessTokenCacheKey := fmt.Sprintf("access_token_%s", w.config.AppID)
	//expires := r.ExpiresIn - 1500
	//set to redis err = ctx.Cache.Set(accessTokenCacheKey, r.AccessToken, time.Duration(expires)*time.Second)
	accessToken = r.AccessToken
	return
}
