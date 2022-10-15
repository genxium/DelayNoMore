package dnmshared

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Logger *zap.Logger
var LoggerConfig zap.Config

func init() {
	LoggerConfig = zap.NewDevelopmentConfig()
	LoggerConfig.Level.SetLevel(zap.InfoLevel)
	LoggerConfig.Development = false
	LoggerConfig.Sampling = &zap.SamplingConfig{
		Initial:    100,
		Thereafter: 100,
	}
	LoggerConfig.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	var err error
	Logger, err = LoggerConfig.Build()
	if nil != err {
		panic(err)
	}
}
