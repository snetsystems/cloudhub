import React, {useState, useRef, useEffect, ChangeEvent} from 'react'
import {useQuery} from '@apollo/react-hooks'
import {Terminal} from 'xterm'
import {FitAddon} from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import _ from 'lodash'

import ShellForm from 'src/shared/components/ShellForm'

import {Notification} from 'src/types/notifications'

// Constants
import {GET_ROUTER_DEVICEINTERFACES_INFO} from 'src/addon/128t/constants'
import {notifyConnectShellFailed} from 'src/shared/copy/notifications'

export interface ShellProps {
  nodename?: string
  addr?: string
  user?: string
  pwd?: string
  port?: string
  isConn?: boolean
}

interface Node {
  name: string
  enabled: boolean
  deviceInterfaces: {
    nodes: NetworkInterfaces[]
  }
}

interface NetworkInterfaces {
  networkInterfaces: {
    nodes: Addresses[]
  }
}

interface Addresses {
  name: string
  addresses: {
    nodes: IpAddress[]
  }
}

interface IpAddress {
  ipAddress: string
}

interface DefaultProps {
  notify?: (message: Notification) => void
}

interface Variables {
  name: string
}

type Props = DefaultProps & ShellProps

var socket: WebSocket = null
const Shell = (props: Props) => {
  let termRef = useRef<HTMLDivElement>()
  let term: Terminal = null

  const [addr, setAddr] = useState(props.addr ? props.addr : '')
  const [user, setUser] = useState(props.user ? props.user : '')
  const [pwd, setPwd] = useState(props.pwd ? props.pwd : '')
  const [port, setPort] = useState(props.port ? props.port : '22')
  const [isConn, setIsConn] = useState(props.isConn ? props.isConn : false)

  const {data} = useQuery<Response, Variables>(
    GET_ROUTER_DEVICEINTERFACES_INFO,
    {
      variables: {
        name: props.nodename ? props.nodename : '',
      },
      errorPolicy: 'all',
      pollInterval: 10000,
    }
  )

  const handleChangeAddress = (e: ChangeEvent<HTMLInputElement>): void => {
    setAddr(e.target.value)
  }

  const handleChangeID = (e: ChangeEvent<HTMLInputElement>): void => {
    setUser(e.target.value)
  }

  const handleChangePassword = (e: ChangeEvent<HTMLInputElement>): void => {
    setPwd(e.target.value)
  }

  const handleChangePort = (e: ChangeEvent<HTMLInputElement>): void => {
    setPort(e.target.value)
  }

  const handleOpenTerminal = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'

    const urlParam =
      'user=' + user + '&pwd=' + pwd + '&addr=' + addr + '&port=' + port
    const socketURL =
      protocol +
      window.location.hostname +
      '/cloudhub/v1/WebTerminalHandler?' +
      encodeURIComponent(urlParam)

    socket = new WebSocket(socketURL)
    socket.binaryType = 'arraybuffer'

    const fitAddon = new FitAddon()
    const decoder = new TextDecoder('utf-8')

    socket.onopen = function() {
      setIsConn(true)

      term = new Terminal({
        screenReaderMode: true,
        cursorBlink: true,
      })

      term.writeln('Connecting ...')

      term.onData(ondata =>
        socket.send(new TextEncoder().encode('\x00' + ondata))
      )

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

      socket.onclose = function(e) {
        if (e.code === 4501) {
          props.notify(notifyConnectShellFailed(e))
        }
        setIsConn(false)
        term.dispose()
      }

      socket.onerror = function(error) {
        if (typeof console.log == 'function') {
          console.error(error)
        }
      }
    }
  }

  // Set 128T minion internet protocol
  useEffect(() => {
    if (data) {
      const nodes: Node[] = _.get(data, 'allNodes.nodes')
      if (nodes) {
        const node = nodes[0]
        const networkInterfaces: NetworkInterfaces[] = _.get(
          node,
          'deviceInterfaces.nodes'
        )

        const addresses: Addresses[] = _.reduce(
          networkInterfaces,
          (addresses: Addresses[], networkInterface: NetworkInterfaces) => {
            const addressesNode: Addresses[] = _.reduce(
              _.get(networkInterface, 'networkInterfaces.nodes'),
              (addresses: Addresses[], value) => {
                addresses = [...addresses, value]
                return addresses
              },
              []
            )
            addressesNode.map((m: Addresses) => addresses.push(m))
            return addresses
          },
          []
        )

        const ipAddress: IpAddress[] = _.reduce(
          addresses.filter(f => f.name.toLowerCase().indexOf('wan') > -1),
          (ipAddress: IpAddress[], address: Addresses) => {
            const ipAddresses: IpAddress[] = _.reduce(
              _.get(address, 'addresses.nodes'),
              (ipAddress: IpAddress[], value) => {
                ipAddress = [...ipAddress, value]
                return ipAddress
              },
              []
            )
            ipAddresses.map((m: IpAddress) => ipAddress.push(m))
            return ipAddress
          },
          []
        )

        if (ipAddress.length > 0 && ipAddress[0].ipAddress) {
          setAddr(ipAddress[0].ipAddress)
        }
      }
    }
  }, [data])

  useEffect(() => {
    return () => {
      setIsConn(false)
      if (socket) {
        socket.close()
        socket = null
      }

      if (term) {
        term.dispose()
      }
    }
  }, [])

  return (
    <div id="terminalContainer">
      {isConn ? (
        <div id="terminal" ref={termRef}></div>
      ) : (
        <div>
          <ShellForm
            addr={addr}
            user={user}
            pwd={pwd}
            port={port}
            handleOpenTerminal={handleOpenTerminal}
            handleChangeAddress={handleChangeAddress}
            handleChangeID={handleChangeID}
            handleChangePassword={handleChangePassword}
            handleChangePort={handleChangePort}
          />
        </div>
      )}
    </div>
  )
}

export default Shell
