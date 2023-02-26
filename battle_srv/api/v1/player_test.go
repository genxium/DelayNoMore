package v1

import (
	"encoding/json"
	"net/http"
	"net/url"
	. "server/common"
	"testing"
	"time"

	"github.com/hashicorp/go-cleanhttp"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

var httpClient = cleanhttp.DefaultPooledClient()

func fakeSMSCaptchReq(num string) smsCaptchReq {
	if num == "" {
		num = "15625296200"
	}
	return smsCaptchReq{
		Num:         num,
		CountryCode: "086",
	}
}

type dbTestPlayer struct {
	Name                  string `db:"name"`
	MagicPhoneCountryCode string `db:"magic_phone_country_code"`
	MagicPhoneNum         string `db:"magic_phone_num"`
}

type smsCaptchaGetResp struct {
	Ret     int    `json:"ret"`
	Captcha string `json:"smsLoginCaptcha"`
}

func init() {
	MustParseConfig()
	MustParseConstants()
}

// 添加ServerEnv=TEST可以缩减sleep时间
// battle_srv$ ServerEnv=TEST go test --count=1 -v server/api/v1 -run SMSCaptchaGet*

func Test_SMSCaptchaGet_frequentlyAndValidSend(t *testing.T) {
	req := fakeSMSCaptchReq("")
	resp := mustDoSmsCaptchaGetReq(req, t)
	if resp.Ret != Constants.RetCode.Ok {
		t.Fail()
	}
	time.Sleep(time.Second * 1)
	resp = mustDoSmsCaptchaGetReq(req, t)
	if resp.Ret != Constants.RetCode.SmsCaptchaRequestedTooFrequently {
		t.Fail()
	}
	t.Log("Sleep in a period of sms valid resend seconds")
	period := Constants.Player.SmsValidResendPeriodSeconds
	time.Sleep(time.Duration(period) * time.Second)
	t.Log("Sleep finished")
	resp = mustDoSmsCaptchaGetReq(req, t)
	if resp.Ret != Constants.RetCode.Ok {
		t.Fail()
	}
}

func Test_SMSCaptchaGet_illegalPhone(t *testing.T) {
	resp := mustDoSmsCaptchaGetReq(fakeSMSCaptchReq("fake"), t)
	if resp.Ret != Constants.RetCode.InvalidRequestParam {
		t.Fail()
	}
}

func Test_SMSCaptchaGet_testAcc(t *testing.T) {
	player, err := getTestPlayer()
	if nil == err && nil != player {
		resp := mustDoSmsCaptchaGetReq(fakeSMSCaptchReq(player.Name), t)
		if resp.Ret != Constants.RetCode.IsTestAcc {
			t.Fail()
		}
	} else {
		t.Skip("请准备test_env.sqlite和先插入测试用户数据")
	}
}

func Test_SMSCaptchaGet_expired(t *testing.T) {
	req := fakeSMSCaptchReq("")
	resp := mustDoSmsCaptchaGetReq(req, t)
	if resp.Ret != Constants.RetCode.Ok {
		t.Fail()
	}

	t.Log("Sleep in a period of sms expired seconds")
	period := Constants.Player.SmsExpiredSeconds
	time.Sleep(time.Duration(period) * time.Second)
	t.Log("Sleep finished")

	req = fakeSMSCaptchReq("")
	resp = mustDoSmsCaptchaGetReq(req, t)
	if resp.Ret != Constants.RetCode.Ok {
		t.Fail()
	}
}

func mustDoSmsCaptchaGetReq(req smsCaptchReq, t *testing.T) smsCaptchaGetResp {
	api := "http://localhost:9992/api/player/v1/SmsCaptcha/get?"
	parameters := url.Values{}
	parameters.Add("phoneNum", req.Num)
	parameters.Add("phoneCountryCode", req.CountryCode)
	resp, err := httpClient.Get(api + parameters.Encode())
	if resp != nil {
		defer resp.Body.Close()
	}
	if err != nil {
		t.Error("mustDoSmsCaptchaGetReq http err", err)
		t.FailNow()
	}
	if resp.StatusCode != http.StatusOK {
		t.Error("code!=200, resp code", resp.StatusCode)
		t.FailNow()
	}
	var respJson smsCaptchaGetResp
	err = json.NewDecoder(resp.Body).Decode(&respJson)
	if err != nil {
		t.Error("mustDoSmsCaptchaGetReq json decode err", err)
		t.FailNow()
	}
	return respJson
}

func getTestPlayer() (*dbTestPlayer, error) {
	db, err := sqlx.Connect("sqlite3", Conf.General.TestEnvSQLitePath)
	if err != nil {
		return nil, err
	}
	defer db.Close()
	p := new(dbTestPlayer)
	err = db.Get(p, "SELECT name, magic_phone_country_code, magic_phone_num FROM test_player limit 1")
	if err != nil {
		return nil, err
	}
	return p, err
}
