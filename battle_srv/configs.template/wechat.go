package configs

type WechatConfig struct {
	ApiProtocol string
	ApiGateway  string
	AppID       string
	AppSecret   string
}

// Fserver
var WechatConfigIns = WechatConfig{
	ApiProtocol: "http",
	ApiGateway:  "119.29.236.44:8089",
	AppID:       "wx5432dc1d6164d4e",
	AppSecret:   "secret1",
}

/*
// Production
var WechatConfigIns = WechatConfig {
  ApiProtocol: "https",
	ApiGateway:  "api.weixin.qq.com",
	AppID:       "wxe7063ab415266544",
	AppSecret:   "secret1",
}
*/

var WechatGameConfigIns = WechatConfig{
	ApiProtocol: "https",
	ApiGateway:  "api.weixin.qq.com",
	AppID:       "wxf497c910a2a25edc",
	AppSecret:   "secret1",
}
