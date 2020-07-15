package server

import (
	"log"
	"net"
	"net/http"
	"strconv"
	"time"
	"net/url"
	// "encoding/json"
	// "github.com/gorilla/Schema"

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

type urlParams struct {
    User	string	`json:"user"`
	Pwd		string	`json:"pwd"`
	addr	string	`json:"addr"`
	// port	string
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

	
	params, _ := url.ParseQuery(r.URL.RawQuery)
	url, err := url.QueryUnescape(r.URL.RawQuery)
	// temp, _ := url.ParseRequestURI(url)
	// u, err1 := url.ParseRequestURI("http://golang.org/index.html?#page1")
	// log.Printf("hi/there?: err=%+v url=%+v\n", err1, u)
	
	log.Println("params", params)
	log.Println("url", url)
	// log.Println("temp", temp)
	paramUser := r.FormValue("user") 
	paramPwd := r.FormValue("pwd")
	paramAddr := r.FormValue("addr")
	paramPort, _ := strconv.Atoi(r.FormValue("port"))

	sh := &ssh{
		user: paramUser,
		pwd:  paramPwd,
		addr: paramAddr,
		port: paramPort,
	}
	
	sh, err = sh.Connect()
	if nil != err {
		log.Println("ssh connect:", err)
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
			n, err := reader.Read(buf)
			if err != nil {
				log.Println(err)
				return
			}
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