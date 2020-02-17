import axios from 'axios'

interface Params {
  client?: string
  fun?: string
  arg?: string[] | string
  tgt_type?: string
  tgt?: string[] | string
  match?: string
  include_rejected?: string
  include_denied?: string
  include_accepted?: string
  show_ip?: string
  kwarg?: {
    username?: string
    password?: string
    eauth?: string
    name?: string
    path?: string
    dest?: string
    makedirs?: string
    fun?: string
    cmd?: string
    args?: string[] | string
  }
  username?: string
  password?: string
  eauth?: string
  token_expire?: number
}

const apiRequest = async (pUrl: string, pToken: string, pParams: Params) => {
  const dParams = {token: pToken, eauth: 'pam'}
  const saltMasterUrl = pUrl
  const url = saltMasterUrl + '/'
  const headers = {
    Accept: 'application/json',
    'Content-type': 'application/json',
  }

  const param = JSON.stringify(Object.assign(dParams, pParams))

  console.log({param})

  return axios({
    method: 'POST',
    url,
    headers,
    data: param,
  })
    .then(response => {
      return response
    })
    .catch(error => {
      return error
    })
}

export function getLocalGrainsItem(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  const params = {
    client: 'local',
    tgt: pMinionId,
    fun: 'grains.item',
    arg: [
      'saltversion',
      'master',
      'os_family',
      'os',
      'osrelease',
      'kernel',
      'kernelrelease',
      'kernelversion',
      'virtual',
      'cpuarch',
      'cpu_model',
      'localhost',
      'ip_interfaces',
      'ip6_interfaces',
      'ip4_gw',
      'ip6_gw',
      'dns:nameservers',
      'locale_info',
      'cpu_model',
      'biosversion',
      'mem_total',
      'swap_total',
      'gpus',
      'selinux',
      'path',
    ],
  }

  return apiRequest(pUrl, pToken, params)
}

export function runAcceptKey(pUrl: string, pToken: string, pMinionId: string) {
  const params = {
    client: 'wheel',
    fun: 'key.accept',
    match: pMinionId,
    include_rejected: 'true',
    include_denied: 'true',
  }

  return apiRequest(pUrl, pToken, params)
}

export function runRejectKey(pUrl: string, pToken: string, pMinionId: string) {
  const params = {
    client: 'wheel',
    fun: 'key.reject',
    match: pMinionId,
    include_accepted: 'true',
  }

  return apiRequest(pUrl, pToken, params)
}

export function runDeleteKey(pUrl: string, pToken: string, pMinionId: string) {
  const params = {
    client: 'wheel',
    fun: 'key.delete',
    match: pMinionId,
  }

  return apiRequest(pUrl, pToken, params)
}

export function getWheelKeyListAll(pUrl: string, pToken: string) {
  const params = {
    client: 'wheel',
    fun: 'key.list_all',
  }

  return apiRequest(pUrl, pToken, params)
}

export function getRunnerManageAllowed(pUrl: string, pToken: string) {
  const params = {
    client: 'runner',
    fun: 'manage.allowed',
    show_ip: 'true',
  }

  return apiRequest(pUrl, pToken, params)
}

export function getLocalServiceEnabledTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string[]
) {
  const params: Params = {
    client: 'local',
    fun: 'service.enabled',
    arg: 'telegraf',
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function getLocalServiceStatusTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string[]
) {
  const params: Params = {
    client: 'local',
    fun: 'service.status',
    arg: 'telegraf',
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function runLocalServiceStartTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string | string[]
) {
  const params: Params = {
    client: 'local',
    fun: 'service.start',
    arg: 'telegraf',
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function runLocalServiceStopTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string | string[]
) {
  const params: Params = {
    client: 'local',
    fun: 'service.stop',
    arg: 'telegraf',
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function runLocalServiceReStartTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  const params: Params = {
    client: 'local',
    fun: 'service.restart',
    arg: 'telegraf',
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function runLocalCpGetDirTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string[]
) {
  const params: Params = {
    client: 'local',
    fun: 'cp.get_dir',
    kwarg: {
      path: 'salt://telegraf',
      dest: '/srv/salt/prod',
      makedirs: 'true',
    },
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function runLocalPkgInstallTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string[]
) {
  const params: Params = {
    client: 'local',
    fun: 'pkg.install',
    kwarg: {
      name: '//srv/salt/prod/telegraf/telegraf-1.12.4-1.x86_64.rpm',
    },
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function getLocalGrainsItems(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  const params: Params = {
    client: 'local',
    fun: 'grains.items',
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function getLocalFileRead(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  const params: Params = {
    client: 'local',
    fun: 'file.read',
    tgt_type: '',
    tgt: '',
    kwarg: {
      path: '/etc/telegraf/telegraf.conf',
    },
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function getLocalFileWrite(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pScript: string
) {
  const params: Params = {
    client: 'local',
    fun: 'file.write',
    tgt_type: '',
    tgt: '',
    kwarg: {
      path: '/etc/telegraf/telegraf.conf',
      args: [pScript],
    },
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function getLocalServiceGetRunning(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  const params: Params = {
    client: 'local',
    fun: 'service.get_running',
    tgt_type: '',
    tgt: '',
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest(pUrl, pToken, params)
}

export function getRunnerSaltCmdTelegraf(
  pUrl: string,
  pToken: string,
  pMeasurements: string
) {
  const params = {
    client: 'runner',
    fun: 'salt.cmd',
    kwarg: {
      fun: 'cmd.run',
      cmd: 'telegraf --usage ' + pMeasurements,
    },
  }

  return apiRequest(pUrl, pToken, params)
}

export function getRunnerSaltCmdDirectory(
  pUrl: string,
  pToken: string,
  pDirPath: string
) {
  const params = {
    eauth: 'pam',
    client: 'runner',
    fun: 'salt.cmd',
    kwarg: {
      fun: 'cmd.shell',
      cmd: `ls -lt --time-style=long-iso ${pDirPath} | grep ^- | awk \'{printf "%sT%s %s\\n",$6,$7,$NF}\'`,
    },
  }
  return apiRequest(pUrl, pToken, params)
}

export function getLocalDeliveryToMinion(
  pUrl: string,
  pToken: string,
  pChoosefile: string,
  pMinionId: string,
  pMinionDir: string
) {
  const params = {
    eauth: 'pam',
    client: 'local',
    tgt: '',
    tgt_type: '',
    fun: 'cp.get_file',
    kwarg: {
      path: `salt://${pChoosefile}`,
      dest: pMinionDir,
      makedirs: 'True',
    },
  }

  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }

  return apiRequest(pUrl, pToken, params)
}
