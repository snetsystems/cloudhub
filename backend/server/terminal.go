package server

import (
	"io"
	"net"
	"net/http"
	"time"
	"net/url"
	"strconv"

	"github.com/gorilla/websocket"
	gossh "golang.org/x/crypto/ssh"
)

var upgrader = websocket.Upgrader{
    ReadBufferSize:  1024,
    WriteBufferSize: 1024,
}

const (
	term = "xterm-256color"
    protocol = "tcp"
    sshEcho = 1
    sshTtyOpIspeed = 14400
	sshTtyOpOspeed = 14400
	wsTimeout = 30 * time.Minute
	sshConnfailCloseMessage = "Connection failed to establish because the connected host did not respond. Please check the connection information again"
)

type ssh struct {
	user    string
	pwd     string
	addr    string
	port    int
	client  *gossh.Client
	session *gossh.Session
}


// connect to the ssh.
func (s *ssh) Connect() (*ssh, error) {
	auth := []gossh.AuthMethod{
		gossh.Password(s.pwd),
	}

	config := &gossh.ClientConfig{
		User:    s.user,
        Auth:    auth,
        Timeout: 30 * time.Second,
        HostKeyCallback: func(hostname string, remote net.Addr, key gossh.PublicKey) error { return nil },
	}

	// connect to ths ssh.
	client, err := gossh.Dial(protocol, s.addr+":"+strconv.Itoa(s.port), config)
	if nil != err {
		return nil, err
	}

	// create session.
	session, err := client.NewSession()
	if nil != err {
		return nil, err
	}
	s.client = client
	s.session = session
	return s, nil
}


// close ssh session
func (s *ssh) Close() {
    if s.session != nil {
		s.session.Close()
		s.client.Close()
	}
	
}


// config the terminal modes.
func (s *ssh) Config(cols, rows int) error {
    modes := gossh.TerminalModes{
        gossh.ECHO:          sshEcho,     // enable echoing
        gossh.TTY_OP_ISPEED: sshTtyOpIspeed, // input speed = 14.4 kbaud
        gossh.TTY_OP_OSPEED: sshTtyOpOspeed, // output speed = 14.4 kbaud
    }

    // request pseudo terminal.
    err := s.session.RequestPty(term, 50, 150, modes)

    return err
}


func setQuit(ch chan bool) {
	ch <- true
}


// FromWsClientToSSH Send websocket client message to ssh
func FromWsClientToSSH(sh *ssh, ws *websocket.Conn, s *Service, sshWriter io.WriteCloser, exitCh chan bool) {
	for {
		// set up io.Reader of websocket
		_, reader, err := ws.NextReader()
		if err != nil {
			setQuit(exitCh)
			s.Logger.
				WithField("component", "terminal > FromWsClientToSSH").
				Info("Close ssh terminal")
			return
		}

		// read first byte to determine whether to pass data or resize terminal
		dataTypeBuf := make([]byte, 1)
		_, err = reader.Read(dataTypeBuf)
		if err != nil {
			s.Logger.
				WithField("component", "terminal > FromWsClientToSSH > reader.Read").
				Error(err.Error())
			return
		}

		buf := make([]byte, 1024)
		n, _ := reader.Read(buf)
		_, err = sshWriter.Write(buf[:n])
		if err != nil {
			ws.WriteMessage(websocket.BinaryMessage, []byte(err.Error()))
			s.Logger.
				WithField("component", "terminal > FromWsClientToSSH > sshWriter.Write").
				Error(err.Error())
			return
		}
	}
}


// FromSSHtoWsClient Send ssh messages to websocket client
func FromSSHtoWsClient(sh *ssh, ws *websocket.Conn, s *Service, sshReader io.Reader, exitCh chan bool) {
	for {
		buf := make([]byte, 4096)
		n, err := sshReader.Read(buf)
		if err != nil {
			setQuit(exitCh)
			s.Logger.
				WithField("component", "terminal > FromSSHtoWsClient").
				Info("Close ssh terminal")
			return
		}
		err = ws.WriteMessage(websocket.BinaryMessage, buf[:n])
		if err != nil {
			s.Logger.
				WithField("component", "terminal > FromSSHtoWsClient > ws.WriteMessage").
				Error(err.Error())
			return
		}

		ws.SetReadDeadline(time.Now().Add(wsTimeout))
	}
}


// SessionWait Wait for session to finish
func (s *ssh) SessionWait(sv *Service, exitCh chan bool) {
	if err := s.session.Wait(); err != nil {
		setQuit(exitCh)
		sv.Logger.
			WithField("component", "terminal > ws.SessionWait").
			Error(err.Error())
	}
}


// WebTerminalHandler connects websocket and remote ssh
func (s *Service) WebTerminalHandler(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > upgrader.Upgrade").
			Error(err.Error())
		return
	}
	defer ws.Close()

	ws.SetReadDeadline(time.Now().Add(wsTimeout))

	// Parse to the original query string
	qs, err := url.QueryUnescape(r.URL.RawQuery)
	if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > url.QueryUnescape").
			Error(err.Error())
		return
	}

	// query string convert to map
	params, err := url.ParseQuery(qs)
	if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > url.ParseQuery").
			Error(err.Error())
		return
	}

	port, err := strconv.Atoi(params["port"][0])
	if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > strconv.Atoi").
			Error(err.Error())
		return
	}

	sh := &ssh{
		user: params["user"][0],
		pwd:  params["pwd"][0],
		addr: params["addr"][0],
		port: port,
	}

	sh, err = sh.Connect()
	if nil != err {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > sh.Connect").
			Error(err.Error())
		
		msg := websocket.FormatCloseMessage(4501, err.Error())
		err = ws.WriteMessage(websocket.CloseMessage, msg)
		if err != nil {
			msg = websocket.FormatCloseMessage(4501, sshConnfailCloseMessage)
			ws.WriteMessage(websocket.CloseMessage, msg)
		}
		_ = ws.Close()
		return
	}
	defer sh.Close()

	err = sh.Config(80, 30)
    if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > sh.Config").
			Error(err.Error())
		return
	}

    sshReader, err := sh.session.StdoutPipe()
    if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > sh.session.StdoutPipe").
			Error(err.Error())
		return
    }

    sshWriter, err := sh.session.StdinPipe()
    if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > sh.session.StdinPipe").
			Error(err.Error())
		return
	}

	// start remote shell.
	err = sh.session.Shell()
	if err != nil {
		s.Logger.
			WithField("component", "terminal > WebTerminalHandler > sh.session.Shell").
			Error(err.Error())
		return
	}

	quitChan := make(chan bool, 3)
	go FromWsClientToSSH(sh, ws, s, sshWriter, quitChan)
	go FromSSHtoWsClient(sh, ws, s, sshReader, quitChan)
	go sh.SessionWait(s, quitChan)

	<-quitChan
}