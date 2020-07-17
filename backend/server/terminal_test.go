package server
import (
    "net/http"
    "net/http/httptest"
    "strings"
    "testing"
    
    "github.com/gavv/httpexpect"
)

// wsHttpHandlerTester Websocket Connection Tester
func wsHttpHandlerTester(t *testing.T) *httpexpect.Expect {
    s := httptest.NewServer(http.HandlerFunc(func(rw http.ResponseWriter, r *http.Request) {
        t.Logf("Hello, client")
	}))
    defer s.Close()
    
	u := "ws" + strings.TrimPrefix(s.URL, "http")
	querystring := "?user=root&pwd=root&addr=192.168.56.103&prot=22"
	u = u + "/cloudhub/v1/WebTerminalHandler" + querystring
    
    sv := &Service{}
    return httpexpect.WithConfig(httpexpect.Config{
		BaseURL:         u,
		WebsocketDialer: httpexpect.NewWebsocketDialer(http.HandlerFunc(sv.WebTerminalHandler)),
		Reporter:        httpexpect.NewAssertReporter(t),
		Printers: []httpexpect.Printer{
			httpexpect.NewDebugPrinter(t, true),
		},
	})
}

func Test_WebTerminalHandler(t *testing.T) {
	e := wsHttpHandlerTester(t)

	ws := e.GET("/path").WithWebsocketUpgrade().
		Expect().
		Status(http.StatusSwitchingProtocols).
		Websocket()
	defer ws.Disconnect()

	ws.WriteText("hi").
		Expect().
		TextMessage().Body().Equal("hi")
}