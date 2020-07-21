import React, {useRef, useEffect} from 'react'
import {Terminal} from 'xterm'
import {FitAddon} from 'xterm-addon-fit'
import 'xterm/css/xterm.css'

const Shell = () => {
  let termRef = useRef<HTMLDivElement>()
  let term: Terminal = null
  let socket: WebSocket = null
  const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
  const user = 'root'
  const pwd = 'root'
  const addr = '192.168.56.103'
  const port = 22
  const urlParam =
    'user=' + user + '&pwd=' + pwd + '&addr=' + addr + '&port=' + port
  const socketURL =
    protocol +
    window.location.hostname +
    '/cloudhub/v1/WebTerminalHandler?' +
    encodeURIComponent(urlParam)
  useEffect(() => {
    socket = new WebSocket(socketURL)
    socket.binaryType = 'arraybuffer'

    const fitAddon = new FitAddon()
    const decoder = new TextDecoder('utf-8')

    socket.onopen = function() {
      term = new Terminal({
        screenReaderMode: true,
        cursorBlink: true,
      })

      term.onData(data => socket.send(new TextEncoder().encode('\x00' + data)))

      term.onResize(evt =>
        socket.send(
          new TextEncoder().encode(
            '\x01' + JSON.stringify({cols: evt.cols, rows: evt.rows})
          )
        )
      )

      term.attachCustomKeyEventHandler(function(e) {
        // Text Block + Ctrl + C
        if (term.getSelection() && e.ctrlKey && e.keyCode == 67) {
          document.execCommand('copy')
          return false
        }
      })

      term.open(termRef.current)
      term.loadAddon(fitAddon)

      socket.onmessage = function(evt) {
        if (evt.data instanceof ArrayBuffer) {
          term.write(decoder.decode(evt.data))
        } else {
          alert(evt.data)
        }
      }

      socket.onclose = function() {
        term.write('Session terminated')
        term.dispose()
      }

      socket.onerror = function(error) {
        if (typeof console.log == 'function') {
          console.error(error)
        }
      }
    }
  })

  useEffect(() => {
    return () => {
      if (socket) {
        socket.close()
      }

      if (term) {
        term.dispose()
      }
    }
  }, [])

  return (
    <div id="terminalContainer">
      <div id="terminal" ref={termRef}></div>
    </div>
  )
}

export default Shell
