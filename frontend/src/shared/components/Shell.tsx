import React, {
  useState,
  useRef,
  useEffect,
  ChangeEvent,
  MouseEvent,
} from 'react'
import {useQuery} from '@apollo/react-hooks'
import {Terminal} from 'xterm'
import {FitAddon} from 'xterm-addon-fit'
import ReactObserver from 'react-resize-observer'
import 'xterm/css/xterm.css'
import _ from 'lodash'

import ShellForm from 'src/shared/components/ShellForm'

import {Notification} from 'src/types/notifications'

// Constants
import {GET_ROUTER_DEVICEINTERFACES_INFO} from 'src/addon/128t/constants'
import {notifyConnectShellFailed} from 'src/shared/copy/notifications'
import {ShellInfo} from 'src/types'

export interface ShellProps {
  shells?: ShellInfo[]
  nodename?: string
  host?: string
  addr?: string
  isConn?: boolean
  isNewEditor?: boolean
  isExistInLinks?: boolean
  tabkey?: number
  handleShellUpdate: (shell: ShellInfo) => void
  handleShellRemove: (nodename: ShellInfo['nodename']) => void
  onTabNameRefresh: () => void
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

const Shell = (props: Props) => {
  let termRef = useRef<HTMLDivElement>()
  let newTabshell: ShellInfo = null
  const [preHost, setPreHost] = useState(props.nodename ? props.nodename : '')
  const [host, setHost] = useState(props.nodename ? props.nodename : '')
  const [addr, setAddr] = useState(props.addr ? props.addr : '')
  const [user, setUser] = useState('')
  const [pwd, setPwd] = useState('')
  const [port, setPort] = useState('22')
  const [getIP, setGetIP] = useState(null)
  const [socket, setSocket] = useState<WebSocket>(null)
  const [term, setTerm] = useState<Terminal>(null)
  const [fit, setFit] = useState<FitAddon>(null)

  const fitAddon = new FitAddon()
  const decoder = new TextDecoder('utf-8')

  const data = ((isUsing128T: boolean): Response => {
    if (isUsing128T) {
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
      return data
    }
  })(props.isExistInLinks)

  const handleChangeHost = (e: ChangeEvent<HTMLInputElement>): void => {
    if (!preHost) {
      setPreHost(host)
    }
    setHost(e.target.value)
  }

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

  const handleOpenTerminal = (newTabshell: ShellInfo): void => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://'

    const urlParam =
      'user=' + user + '&pwd=' + pwd + '&addr=' + addr + '&port=' + port

    const socketURL =
      protocol +
      window.location.hostname +
      '/cloudhub/v1/WebTerminalHandler?' +
      encodeURIComponent(urlParam)

    let _socket = new WebSocket(socketURL)
    _socket.binaryType = 'arraybuffer'
    newTabshell = newTabshell
    setSocket(_socket)
  }
  // debouncefit
  const onTerminalResize = _.debounce(() => {
    if (!term || !fit) return

    const dims = fit.proposeDimensions()
    term.resize(dims.cols, dims.rows)

    fit.fit()
  }, 100)

  // input string send to target
  const onTerminalSendString = (str: string) => {
    socket.send(new TextEncoder().encode('\x00' + str))
  }

  // terminal init
  const initTerm = () => {
    if (!term) return
    term.writeln('Connecting ...')
    term.loadAddon(fitAddon)
    term.open(termRef.current)

    setFit(fitAddon)
    const dims = fitAddon.proposeDimensions()

    socket.send(
      new TextEncoder().encode(
        '\x01' +
          JSON.stringify({
            cols: dims.cols,
            rows: dims.rows,
          })
      )
    )

    fitAddon.fit()

    term.onData((data: string) => onTerminalSendString(data))

    // resize call
    term.onResize(evt => {
      socket.send(
        new TextEncoder().encode(
          '\x01' +
            JSON.stringify({
              cols: evt.cols,
              rows: evt.rows,
            })
        )
      )
    })

    // custom key event handler
    term.attachCustomKeyEventHandler(function (e) {
      if (term.getSelection() && e.ctrlKey && e.keyCode == 67) {
        document.execCommand('copy')
        return false
      }

      if (e.ctrlKey && e.keyCode == 86) {
        document.execCommand('paste')
        return false
      }

      if (e.ctrlKey && e.keyCode == 68) {
        return false
      }
    })

    let shellInfo: ShellInfo
    if (newTabshell) {
      shellInfo = Object.assign(newTabshell, {
        preNodename: preHost,
      })
    } else {
      shellInfo = {
        addr: addr,
        nodename: host,
        preNodename: preHost,
      }
    }

    props.handleShellUpdate(shellInfo)
    props.onTabNameRefresh()

    socket.onmessage = function (evt) {
      if (evt.data instanceof ArrayBuffer) {
        term.write(decoder.decode(evt.data))
      } else {
        alert(evt.data)
      }
    }

    socket.onclose = function (e) {
      if (e.code === 1007) {
        props.notify(notifyConnectShellFailed(e))
      }

      if (socket) {
        socket.close()
        setSocket(null)
      }

      if (term) {
        term.dispose()
        setTerm(null)
      }

      if (fit) {
        fit.dispose()
        setFit(null)
      }
    }

    socket.onerror = function (error) {
      if (typeof console.log == 'function') {
        console.error(error)
      }
    }
  }

  useEffect(() => {
    initTerm()
  }, [term])

  // set socket After
  useEffect(() => {
    if (socket) {
      socket.onopen = function () {
        if (term) {
          term.dispose()
        }

        setTerm(
          new Terminal({
            convertEol: true,
          })
        )
      }
    }
    return () => {
      if (socket) {
        socket.close()
        setSocket(null)
      }

      if (term) {
        term.dispose()
        setTerm(null)
      }
    }
  }, [socket])

  // Set 128T minion internet protocol
  useEffect(() => {
    if (data) {
      const networkInterfaces: NetworkInterfaces[] = _.get(
        data,
        'allNodes.nodes[0].deviceInterfaces.nodes'
      )
      if (networkInterfaces) {
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
          addresses,
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
          setGetIP(ipAddress[0].ipAddress)
        }
      }
    }
  }, [data])

  useEffect(() => {
    setHost(props.nodename)
  }, [props.nodename])

  return (
    <div className={`terminal-container`}>
      {term ? (
        <div className={`terminal-wrap`}>
          <div
            id={`terminal-${host}`}
            ref={termRef}
            onMouseDown={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            style={{height: '100%'}}
          />
          <ReactObserver
            onResize={() => {
              onTerminalResize()
            }}
          />
        </div>
      ) : (
        <div>
          <ShellForm
            shells={props.shells}
            host={host}
            addr={addr}
            user={user}
            pwd={pwd}
            port={port}
            getIP={getIP}
            tabkey={props.tabkey}
            isNewEditor={props.isNewEditor}
            handleOpenTerminal={handleOpenTerminal}
            handleChangeHost={handleChangeHost}
            handleChangeAddress={handleChangeAddress}
            handleChangeID={handleChangeID}
            handleChangePassword={handleChangePassword}
            handleChangePort={handleChangePort}
            handleShellUpdate={props.handleShellUpdate}
            handleShellRemove={props.handleShellRemove}
          />
        </div>
      )}
    </div>
  )
}

export default Shell
