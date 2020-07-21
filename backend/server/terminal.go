package server

import (
	"log"
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
        _ = s.session.Close()
    }

    if s.session != nil {
        _ = s.session.Close()
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
    err := s.session.RequestPty(term, 30, 80, modes)

    return err
}

// WebTerminalHandler connects websocket and remote ssh
func (s *Service) WebTerminalHandler(w http.ResponseWriter, r *http.Request) {
	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Websocket upgrade:", err)
		return
	}
	defer ws.Close()

	// Parse to the original query string
	qs, err := url.QueryUnescape(r.URL.RawQuery)
	if err != nil {
		log.Println("error: ", err)
		return
	}

	// query string convert to map
	params, err := url.ParseQuery(qs)
	if err != nil {
		log.Println("error: ", err)
		return
	}

	port, err := strconv.Atoi(params["port"][0])
	if err != nil {
		log.Println("port input error: ", err)
	}

	sh := &ssh{
		user: params["user"][0],
		pwd:  params["pwd"][0],
		addr: params["addr"][0],
		port: port,
	}

	sh, err = sh.Connect()
	if nil != err {
		log.Println("ssh connect:", err)
		_ = ws.Close()
		return
	}

	err = sh.Config(80, 30)
    if err != nil {
        log.Println("ssh config: ", err)
    }

    sshReader, err := sh.session.StdoutPipe()
    if err != nil {
        log.Println("session stdout pipe: ", err)
    }

    sshWriter, err := sh.session.StdinPipe()
    if err != nil {
        log.Println("session stdin pipe: ", err)
	}

	// read from terminal and write to frontend.
    go func() {
        defer func() {
            _ = ws.Close()
            sh.Close()
		}()
		
		for {
			buf := make([]byte, 4096)
			n, err := sshReader.Read(buf)
			if err != nil {
				log.Println(err)
				return
			}
			err = ws.WriteMessage(websocket.BinaryMessage, buf[:n])
			if err != nil {
				log.Println(err)
				return
			}
		}
	}()
	
	// read from frontend and write to terminal.
    go func() {
        defer func() {
            _ = ws.Close()
            sh.Close()
		}()
		
		for {
			// set up io.Reader of websocket
			_, reader, err := ws.NextReader()
			if err != nil {
				log.Println(err)
				return
			}
			// read first byte to determine whether to pass data or resize terminal
			dataTypeBuf := make([]byte, 1)
			_, err = reader.Read(dataTypeBuf)
			if err != nil {
				log.Println(err)
				return
			}

			buf := make([]byte, 1024)
			n, _ := reader.Read(buf)
			_, err = sshWriter.Write(buf[:n])
			if err != nil {
				log.Println(err)
				ws.WriteMessage(websocket.BinaryMessage, []byte(err.Error()))
				return
			}

		}
	}()
	
	// start remote shell.
    err = sh.session.Shell()
    if err != nil {
        log.Println("ssh session shell: ", err)
    }

	// Wait for session to finish
    err = sh.session.Wait()
    if err != nil {
        log.Println("ssh session wait: ", err)
    }
}