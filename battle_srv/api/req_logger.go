package api

import (
	"bytes"
	. "dnmshared"
	"github.com/gin-gonic/gin"
	"io"
	"io/ioutil"
)

func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		buf, _ := ioutil.ReadAll(c.Request.Body)
		rdr1 := ioutil.NopCloser(bytes.NewBuffer(buf))
		rdr2 := ioutil.NopCloser(bytes.NewBuffer(buf)) // We have to create a new Buffer, because rdr1 will be read.

		if s := readBody(rdr1); s != "" {
			Logger.Debug(s) // Print the request body.
		}

		c.Request.Body = rdr2
		c.Next()
	}
}

func readBody(reader io.Reader) string {
	buf := new(bytes.Buffer)
	buf.ReadFrom(reader)

	s := buf.String()
	return s
}
