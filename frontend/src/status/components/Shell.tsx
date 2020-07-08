import React, {PureComponent, createRef} from 'react'
import {Terminal} from 'xterm'
import {FitAddon} from 'xterm-addon-fit'
import {AttachAddon} from 'xterm-addon-attach'
// import * as attach from 'xterm/lib/addons/attach/attach'
import 'xterm/css/xterm.css'

interface Props {}
interface State {
  isConnect: boolean
}

class Shell extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      isConnect: false,
    }
  }

  private term: Terminal = null
  private socket: WebSocket = null

  private termRef = createRef<HTMLDivElement>()

  private initTerminal = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'
    let socketURL =
      protocol + window.location.hostname + '/cloudhub/v1/websocketHandler'

    this.socket = new WebSocket(socketURL)

    const attachAddon = new AttachAddon(this.socket)
    const fitAddon = new FitAddon()

    this.term = new Terminal({
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      bellStyle: 'sound',
      cursorBlink: true,
    })

    this.socket.onopen = (event: Event) => {
      this.setState({isConnect: true})
      console.log('socket open', event)
      this.handleSend()
    }

    this.socket.onmessage = event => {
      console.log('socket onmessage', event)
    }

    this.socket.onclose = event => {
      console.log('socket onclose', event)
    }

    this.socket.onerror = event => {
      console.log('socket onerror', event)
    }

    fitAddon.fit()

    this.term.loadAddon(attachAddon)
    this.term.loadAddon(fitAddon)

    console.log(this.termRef.current)
    this.term.open(this.termRef.current)
  }

  public componentDidMount() {
    if (!this.term) {
      this.initTerminal()
    }
  }

  public componentWillUnmount() {
    console.log('componentWillUnmount')
    if (this.term) {
      this.term.dispose()
      // this.socket.close(2, '')
      this.term = null
    }
  }

  private handleSend() {
    if (!this.state.isConnect) return

    const sendData = {event: 'req', data: {comment: 'Hello World!'}}
    this.socket.send(JSON.stringify(sendData))
  }

  render() {
    return <div id="terminal" ref={this.termRef}></div>
  }
}

export default Shell
