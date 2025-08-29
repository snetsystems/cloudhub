// Libraries
import _ from 'lodash'
import yaml from 'js-yaml'
import AJAX from 'src/utils/ajax'
import path from 'path'

// APIs
import {createActivityLog} from 'src/shared/apis'

// Types
import {Ipmi, IpmiCell} from 'src/types'
import {CloudServiceProvider, CSPFileWriteParam} from 'src/hosts/types'
import {OpenStackApiInfo, OpenStackCallParams} from 'src/clouds/types/openstack'
import {MinionState, MinionStateType} from 'src/agent_admin/type/minion'

interface Params {
  token?: string
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
    sources?: string
    args?: string[] | string
    url?: string
    method?: string
    api_host?: string
    api_user?: string
    api_pass?: string
    region?: string
    keyid?: string
    key?: string
    group_ids?: string | string[]
    volume_ids?: string | string[]
    instance_types?: string | string[]
    detail?: any
    namespace?: any
    fieldselector?: any
    labelselector?: any
    limit?: number
    namespaces?: string[]
    dir_path?: string
    mode?: string
    name_or_id?: string
  }
  username?: string
  password?: string
  eauth?: string
  token_expire?: number
  provider?: string
  func?: string
}

const activityData = [
  {action: 'key.accept', message: `Execute 'accept'.`},
  {action: 'key.reject', message: `Execute 'reject'.`},
  {action: 'key.delete', message: `Execute 'delete'.`},
  {action: 'service.start', message: `Execute 'telegraf service start'.`},
  {action: 'service.stop', message: `Execute 'telegraf service stop'.`},
  {action: 'pkg.install', message: `Execute 'telegraf package install'.`},
  {action: 'file.write', message: `Execute 'telegraf config apply'.`},
  {action: 'ipmi.set_power', message: `Execute 'IPMI power state change'.`},
  {action: 'service.restart', message: `Execute 'telegraf service restart'.`},
  {action: 'service.reload', message: `Execute 'telegraf service reload'.`},
  {action: 'file.mkdir', message: `Execute 'file mkdir'.`},
  {action: 'file.remove', message: `Execute 'file remove'.`},
  {action: 'file.set_mode', message: `Execute 'file set_mode'.`},
  {action: 'group.adduser', message: `Execute 'group.adduser'.`},
  {action: 'grant_role', message: `Execute 'grant_role'.`},
]

const apiRequest = async (
  pUrl: string,
  pToken: string,
  pParams: Params,
  pAccept?: string
) => {
  const activity = _.find(
    activityData,
    f =>
      f.action ===
      (_.get(pParams?.kwarg, 'fun') ||
        _.get(pParams?.kwarg, 'endpoint_func') ||
        _.get(pParams, 'fun'))
  )

  try {
    const dParams = {token: pToken, eauth: 'pam'}
    const saltMasterUrl = pUrl
    const url = saltMasterUrl + '/'
    const headers = {
      Accept: pAccept ? pAccept : 'application/json',
      'Content-type': 'application/json',
    }

    const param = Object.assign(dParams, pParams)
    const ajaxResult = await AJAX({
      method: 'POST',
      url: url,
      headers,
      data: param,
    })

    if (!_.isEmpty(activity)) {
      saltActivityLog(activity, ajaxResult)
    }

    return ajaxResult
  } catch (error) {
    if (!_.isEmpty(activity)) {
      saltActivityLog(activity, error)
    }

    console.error(error)
    throw error
  }
}

const apiRequestMulti = async (
  pUrl: string,
  pParams: Params[],
  pAccept?: string
) => {
  try {
    const saltMasterUrl = pUrl
    const url = saltMasterUrl + '?type=array'
    const headers = {
      Accept: pAccept ? pAccept : 'application/json',
      'Content-type': 'application/json',
    }

    const param = pParams

    const ajaxResult = await AJAX({
      method: 'POST',
      url: url,
      headers,
      data: param,
    })

    _.reduce(
      pParams,
      (_acc, pParam: Params) => {
        const activity = _.find(
          activityData,
          f =>
            f.action ===
            (_.get(pParam?.kwarg, 'fun') ||
              _.get(pParam?.kwarg, 'endpoint_func') ||
              _.get(pParam, 'fun'))
        )

        if (!_.isEmpty(activity)) {
          saltActivityLog(activity, ajaxResult)
        }

        return activity
      },
      {}
    )

    return ajaxResult
  } catch (error) {
    _.reduce(
      pParams,
      (_acc, pParam: Params) => {
        const activity = _.find(
          activityData,
          f =>
            f.action ===
            (_.get(pParam.kwarg, 'fun') ||
              _.get(pParam?.kwarg, 'endpoint_func') ||
              _.get(pParam, 'fun'))
        )

        if (!_.isEmpty(activity)) {
          saltActivityLog(activity, error)
        }

        return activity
      },
      {}
    )

    console.error(error)
    throw error
  }
}

export async function getLocalGrainsItem(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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
      tgt_type: 'list',
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalNVidiaGPUMigLgip(pUrl: string, pToken: string) {
  try {
    const params: Params = {
      client: 'local',
      tgt: 'G@gpus:vendor:nvidia',
      fun: 'cmd.run',
      kwarg: {
        cmd: 'nvidia-smi mig -lgip',
      },
      tgt_type: 'compound',
    }

    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalNvidiaGrainsItemForGPU(
  pUrl: string,
  pToken: string
) {
  try {
    const params = {
      client: 'local',
      tgt: 'G@gpus:vendor:nvidia',
      fun: 'grains.item',
      arg: ['os', 'osrelease', 'localhost', 'gpus'],
      tgt_type: 'compound',
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runAcceptKey(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
    const params = {
      client: 'wheel',
      fun: 'key.accept',
      match: pMinionId,
      include_rejected: 'true',
      include_denied: 'true',
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runRejectKey(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
    const params = {
      client: 'wheel',
      fun: 'key.reject',
      match: pMinionId,
      include_accepted: 'true',
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runDeleteKey(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
    const params = {
      client: 'wheel',
      fun: 'key.delete',
      match: pMinionId,
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getWheelKeyListAll(pUrl: string, pToken: string) {
  try {
    const params = {
      client: 'wheel',
      fun: 'key.list_all',
    }
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getMinionsState(
  pUrl: string,
  pToken: string,
  minionId: string
) {
  try {
    const result: {key: string; minionState: MinionStateType} = {
      key: minionId,
      minionState: MinionState.Delete,
    }
    const params = {
      client: 'wheel',
      fun: 'key.name_match',
      match: minionId,
    }

    const response = await apiRequest(pUrl, pToken, params)
    const responseData = response.data.return[0].data.return

    const stateMappings: Record<string, MinionStateType> = {
      minions: MinionState.Accept,
      minions_pre: MinionState.UnAccept,
      minions_rejected: MinionState.Reject,
      minions_denied: MinionState.Denied,
    }

    for (const key in stateMappings) {
      if (responseData[key]?.length > 0) {
        result.minionState = stateMappings[key]
        break
      }
    }

    return result
  } catch (error) {
    throw error
  }
}

export async function getRunnerManageAllowed(pUrl: string, pToken: string) {
  try {
    const params = {
      client: 'runner',
      fun: 'manage.allowed',
      show_ip: 'true',
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalServiceEnabledTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalServiceStatusTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalServiceStartTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalServiceStopTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalServiceReStartTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalServiceReloadTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
    const params: Params = {
      client: 'local',
      fun: 'service.reload',
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

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalNVidiaInfoXML(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
    const params: Params = {
      client: 'local',
      fun: 'cmd.run',
      kwarg: {
        cmd: `nvidia-smi -q -x`,
      },
    }

    if (pMinionId) {
      params.tgt_type = 'list'
      params.tgt = pMinionId
    } else {
      params.tgt_type = 'glob'
      params.tgt = '*'
    }
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalServiceTestTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pSelectedPlugin?: string,
  pConfPath = '/etc/telegraf/telegraf.conf'
) {
  try {
    const inputFilter =
      pSelectedPlugin === 'All' ? '' : `--input-filter ${pSelectedPlugin}`
    const testConfigCommand = `--config ${pConfPath}`
    const params: Params = {
      client: 'local',
      fun: 'cmd.run',
      kwarg: {
        cmd: `telegraf ${testConfigCommand} --test ${inputFilter}`,
      },
    }

    if (pMinionId) {
      params.tgt_type = 'list'
      params.tgt = pMinionId
    } else {
      params.tgt_type = 'glob'
      params.tgt = '*'
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalServiceDebugTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pSelectedPlugin?: string,
  pConfPath = '/etc/telegraf/telegraf.conf'
) {
  try {
    const params: Params = {
      client: 'local',
      fun: 'cmd.run',
      kwarg: {
        cmd: `telegraf --test --config ${pConfPath} --input-filter ${pSelectedPlugin}`,
      },
    }

    if (pMinionId) {
      params.tgt_type = 'list'
      params.tgt = pMinionId
    } else {
      params.tgt_type = 'glob'
      params.tgt = '*'
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalCpGetDirTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalPkgInstallTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pSelectCollector: string
) {
  try {
    const params: Params = {
      client: 'local',
      fun: 'pkg.install',
      kwarg: {
        sources: `[{"telegraf": "salt://telegraf/${pSelectCollector}"}]`,
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

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalGrainsItems(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalFileRead(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pDirPath: string = '/etc/telegraf/telegraf.conf'
) {
  try {
    const params: Params = {
      client: 'local',
      fun: 'file.read',
      tgt_type: '',
      tgt: '',
      kwarg: {
        path: pDirPath,
      },
    }

    if (pMinionId) {
      params.tgt_type = 'list'
      params.tgt = pMinionId
    } else {
      params.tgt_type = 'glob'
      params.tgt = '*'
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalFileWrite(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pScript: string,
  pConfPath = '/etc/telegraf/telegraf.conf'
) {
  try {
    const params: Params = {
      client: 'local',
      fun: 'file.write',
      tgt_type: '',
      tgt: '',
      kwarg: {
        path: pConfPath,
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

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalServiceGetRunning(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
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

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRunnerSaltCmdTelegraf(
  pUrl: string,
  pToken: string,
  pMeasurements: string
) {
  try {
    const params = {
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'cmd.run',
        cmd: 'telegraf --usage ' + pMeasurements,
        runas: 'telegraf',
      },
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRunnerSaltCmdTelegrafPlugin(
  pUrl: string,
  pToken: string,
  pCmd: string
) {
  try {
    const params = {
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'cmd.shell',
        cmd: pCmd,
        runas: 'telegraf',
      },
    }

    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function runLocalGroupAdduser(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
    const params: Params = {
      client: 'local',
      fun: 'group.adduser',
      tgt_type: '',
      tgt: '',
      arg: ['root', 'telegraf'],
    }
    if (pMinionId) {
      params.tgt_type = 'list'
      params.tgt = pMinionId
    } else {
      params.tgt_type = 'glob'
      params.tgt = '*'
    }
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRunnerSaltCmdDirectory(
  pUrl: string,
  pToken: string,
  pDirPath: string
) {
  try {
    const params = {
      eauth: 'pam',
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'cmd.shell',
        cmd: `ls -lt --time-style=long-iso ${pDirPath} | grep ^- | awk \'{printf "%sT%s %s\\n",$6,$7,$NF}\'`,
      },
    }
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalSaltCmdDirectory(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pDirPath: string
) {
  try {
    const params = {
      eauth: 'pam',
      client: 'local',
      tgt: pMinionId,
      tgt_type: 'glob',
      fun: 'cmd.shell',
      kwarg: {
        cmd: `ls -lt --time-style=long-iso ${pDirPath} | grep ^- | awk \'{printf "%sT%s %s\\n",$6,$7,$NF}\'`,
      },
    }
    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalDeliveryToMinion(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pMinionDir: string,
  pChoosefile: string
) {
  try {
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

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalHttpQuery(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  apiURL: string,
  apiMethod: string
) {
  try {
    const params = {
      eauth: 'pam',
      client: 'local',
      fun: 'http.query',
      tgt_type: '',
      tgt: '',
      kwarg: {
        url: apiURL,
        method: apiMethod,
      },
    }

    if (pMinionId) {
      params.tgt_type = 'list'
      params.tgt = pMinionId
    } else {
      params.tgt_type = 'glob'
      params.tgt = '*'
    }

    return await apiRequest(pUrl, pToken, params)
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getWheelKeyAcceptedList(pUrl: string, pToken: string) {
  try {
    const params = {
      eauth: 'pam',
      client: 'wheel',
      fun: 'key.list',
      match: 'accepted',
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalVSphereInfoAll(
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'vsphere.vsphere_info_all',
      tgt: tgt,
      kwarg: {
        host: address,
        username: user,
        password,
        port,
        protocol,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getTicketRemoteConsole(
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'vsphere.get_ticket',
      tgt: tgt,
      kwarg: {
        host: address,
        username: user,
        password: password,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sNamespaces(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.namespaces',
      tgt: pMinionId,
      kwarg: {
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sNodes(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.nodes',
      tgt: pMinionId,
      kwarg: {
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}
export async function getIpmiGetPower(
  pUrl: string,
  pToken: string,
  pIpmis: IpmiCell
) {
  try {
    let params = {
      eauth: 'pam',
      client: 'local',
      fun: 'ipmi.get_power',
      tgt_type: 'glob',
      tgt: pIpmis.target,
      kwarg: {
        api_host: pIpmis.host,
        api_user: pIpmis.user,
        api_pass: pIpmis.pass,
      },
    }

    const result = await apiRequest(pUrl, pToken, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sPods(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.pods',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        fieldselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('fieldselector')
            ? pParam.kwarg.fieldselector
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sDeployments(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.deployments',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sReplicaSets(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.replica_sets',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sReplicationControllers(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.replication_controllers',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export enum IpmiSetPowerStatus {
  PowerOn = 'power_on',
  PowerOff = 'power_off',
  Reset = 'reset',
  Shutdown = 'shutdown',
}

export async function setIpmiSetPower(
  pUrl: string,
  pToken: string,
  pIpmi: Ipmi,
  pState: IpmiSetPowerStatus
) {
  try {
    const params = {
      eauth: 'pam',
      client: 'local',
      fun: 'ipmi.set_power',
      tgt_type: 'glob',
      tgt: pIpmi.target,
      kwarg: {
        state: pState,
        api_host: pIpmi.host,
        api_user: pIpmi.user,
        api_pass: pIpmi.pass,
      },
    }

    const result = await apiRequest(pUrl, pToken, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sDaemonSets(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.daemon_sets',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sStatefulSets(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.stateful_sets',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sJobs(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.jobs',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getIpmiGetSensorData(
  pUrl: string,
  pToken: string,
  pIpmi: Ipmi
) {
  try {
    const params = {
      eauth: 'pam',
      client: 'local',
      fun: 'ipmi.get_sensor_data',
      tgt_type: 'glob',
      tgt: pIpmi.target,
      kwarg: {
        api_host: pIpmi.host,
        api_user: pIpmi.user,
        api_pass: pIpmi.pass,
      },
    }

    const result = await apiRequest(pUrl, pToken, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sCronJobs(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.cron_jobs',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sServices(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.services',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sIngresses(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.ingresses',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sConfigmaps(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.configmaps',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalBotoEc2DescribeInstances(
  pUrl: string,
  pToken: string,
  pCSPs: any[]
): Promise<any> {
  try {
    let params = []

    _.map(pCSPs, pCSP => {
      const param = {
        token: pToken,
        eauth: 'pam',
        client: 'runner',
        fun: 'salt.cmd',
        kwarg: {
          fun: 'boto_ec2.describe_instances',
          region: pCSP.namespace,
          keyid: pCSP.accesskey,
          key: pCSP.secretkey,
        },
      }
      params = [...params, param]
    })

    const result = await apiRequestMulti(pUrl, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRunnerCloudActionListInstances(
  pUrl: string,
  pToken: string,
  pCSPs: any[]
): Promise<any> {
  try {
    let params = []

    _.map(pCSPs, pCSP => {
      const param = {
        token: pToken,
        eauth: 'pam',
        client: 'runner',
        fun: 'cloud.action',
        func: 'list_instances',
        provider: pCSP.namespace,
      }
      params = [...params, param]
    })

    const result = await apiRequestMulti(pUrl, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRunnerCloudActionOSPProject(
  pUrl: string,
  pToken: string,
  pCallInfo: object
): Promise<any> {
  try {
    let requestList = []

    const pCallParams = ({
      saltFunction,
      pToken,
      saltOptions,
    }: OpenStackCallParams) => {
      const param = {
        token: pToken,
        eauth: 'pam',
        client: 'runner',
        fun: 'cloud.action',
        func: saltFunction,
      }
      const options = saltOptions || null
      return {
        ...param,
        ...options,
      }
    }

    _.map(pCallInfo, (pCSP, namespace) => {
      _.map(pCSP, async (apiInfo: OpenStackApiInfo, groupname) => {
        _.map(apiInfo.apiList, async saltFunction => {
          const param = pCallParams({
            saltFunction: saltFunction,
            pToken: pToken,
            saltOptions: apiInfo.options,
          }) as Params

          const openstackReq = async () => {
            return {
              namespace: namespace,
              groupname: groupname,
              res: await apiRequest(pUrl, pToken, param, 'application/x-yaml'),
            }
          }
          requestList.push(openstackReq)
        })
      })
    })

    const result = _.groupBy(
      await Promise.all(requestList.map(async req => req())),
      e => {
        return e.namespace
      }
    )

    const getJsonFromSaltRes = saltRes => {
      const convertRes = _.reduce(
        saltRes,
        (acc, salt) => {
          const namesapce = _.reduce(
            salt,
            (_acc, _salt) => {
              try {
                const loadSalt = yaml.safeLoad(_salt.res.data).return[0]

                if (typeof loadSalt === 'string') {
                  return
                }

                const saltInfo = _.values(_.values(loadSalt)[0])[0]

                _acc[_salt.groupname] = {
                  ..._acc[_salt.groupname],
                  ...saltInfo,
                }

                return _acc
              } catch (error) {
                return
              }
            },

            {}
          )
          if (namesapce) {
            acc[salt[0].namespace] = namesapce
          }

          return acc
        },
        {}
      )
      return convertRes
    }
    const saltRes = getJsonFromSaltRes(result)
    return saltRes
  } catch (error) {
    throw error
  }
}

export async function getCSPListInstances(
  pUrl: string,
  pToken: string,
  pCSPs: any[]
): Promise<any> {
  try {
    let params = []

    _.map(pCSPs, pCSP => {
      if (pCSP.provider === CloudServiceProvider.AWS) {
        const param = {
          token: pToken,
          eauth: 'pam',
          client: 'runner',
          fun: 'salt.cmd',
          kwarg: {
            fun: 'boto_ec2.describe_instances',
            region: pCSP.namespace,
            keyid: pCSP.accesskey,
            key: pCSP.secretkey,
          },
        }
        params = [...params, param]
      } else if (pCSP.provider === CloudServiceProvider.GCP) {
        const param = {
          token: pToken,
          eauth: 'pam',
          client: 'runner',
          fun: 'cloud.action',
          func: 'list_instances',
          provider: pCSP.namespace,
        }
        params = [...params, param]
      }
    })

    const result = await apiRequestMulti(pUrl, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sSecrets(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.secrets',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sServiceAccounts(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.service_accounts',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sClusterRoles(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.cluster_roles',
      tgt: pMinionId,
      kwarg: {
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}
export async function getLocalBotoSecgroupGetAllSecurityGroups(
  pUrl: string,
  pToken: string,
  pCSP: any,
  pGroupIds?: string[]
): Promise<any> {
  try {
    const param = {
      token: pToken,
      eauth: 'pam',
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'boto_secgroup.get_all_security_groups',
        region: pCSP.namespace,
        keyid: pCSP.accesskey,
        key: pCSP.secretkey,
        group_ids: pGroupIds,
      },
    }

    const result = await apiRequest(pUrl, pToken, param, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sClusterRoleBindings(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.cluster_role_bindings',
      tgt: pMinionId,
      kwarg: {
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sRoles(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.roles',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sRoleBindings(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.role_bindings',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}
export async function getLocalBoto2DescribeVolumes(
  pUrl: string,
  pToken: string,
  pCSP: any,
  pVolumeIds?: string[]
): Promise<any> {
  try {
    const param = {
      token: pToken,
      eauth: 'pam',
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'boto_ec2.describe_volumes',
        region: pCSP.namespace,
        keyid: pCSP.accesskey,
        key: pCSP.secretkey,
        volume_ids: pVolumeIds,
      },
    }

    const result = await apiRequest(pUrl, pToken, param, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sPersistentVolumes(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.persistent_volumes',
      tgt: pMinionId,
      kwarg: {
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalBoto2DescribeInstanceTypes(
  pUrl: string,
  pToken: string,
  pCSP: any,
  pTypes?: string[]
): Promise<any> {
  try {
    const param = {
      token: pToken,
      eauth: 'pam',
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'boto_ec2.describe_instance_types',
        region: pCSP.namespace,
        keyid: pCSP.accesskey,
        key: pCSP.secretkey,
        instance_types: pTypes,
      },
    }

    const result = await apiRequest(pUrl, pToken, param, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sPersistentVolumeClaims(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.persistent_volume_claims',
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        labelselector: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('labelselector')
            ? pParam.kwarg.labelselector
            : ''
          : '',
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
        limit: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('limit')
            ? pParam.kwarg.limit
            : null
          : null,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sDetail(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: Params
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: pParam.fun,
      tgt: pMinionId,
      kwarg: {
        namespace: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('namespace')
            ? pParam.kwarg.namespace
            : ''
          : '',
        name: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('name')
            ? pParam.kwarg.name
            : ''
          : '',
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalDirectoryMake(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pDirPath: string
) {
  try {
    const params: Params = {
      eauth: 'pam',
      client: 'local',
      fun: 'file.mkdir',
      arg: pDirPath,
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

    const makeDirectoryResponse = await apiRequest(
      pUrl,
      pToken,
      params,
      'application/x-yaml'
    )

    return yaml.safeLoad(makeDirectoryResponse.data).return
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getCSPRunnerFileWrite(
  pUrl: string,
  pToken: string,
  pFileWrite: CSPFileWriteParam
) {
  try {
    const mkdir = {
      eauth: 'pam',
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'file.mkdir',
        dir_path: pFileWrite.path,
      },
    }

    const mkdirRes = await apiRequest(pUrl, pToken, mkdir, 'application/x-yaml')

    if (!yaml.safeLoad(mkdirRes.data).return) {
      return false
    }

    const write = {
      eauth: 'pam',
      client: 'runner',
      fun: 'salt.cmd',
      kwarg: {
        fun: 'file.write',
        path: path.join(pFileWrite.path, pFileWrite.fileName),
        args: [pFileWrite.script],
      },
    }

    const writeRes = await apiRequest(pUrl, pToken, write, 'application/x-yaml')

    if (_.includes(yaml.safeLoad(writeRes.data).return, 'Exception')) {
      return false
    }

    const fileExtensionRegex = new RegExp(`.pem$`)

    if (pFileWrite.fileName.match(fileExtensionRegex)) {
      const setMode = {
        eauth: 'pam',
        client: 'runner',
        fun: 'salt.cmd',
        kwarg: {
          fun: 'file.set_mode',
          path: path.join(pFileWrite.path, pFileWrite.fileName),
          mode: '0600',
        },
      }

      const setModeRes = await apiRequest(
        pUrl,
        pToken,
        setMode,
        'application/x-yaml'
      )

      if (yaml.safeLoad(setModeRes.data).return[0] !== setMode.kwarg.mode) {
        return false
      }
    }

    return true
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getRunnerFileRead(
  pUrl: string,
  pToken: string,
  pParams: any[]
): Promise<any> {
  try {
    let params = []

    _.map(pParams, pParam => {
      const param = {
        token: pToken,
        eauth: 'pam',
        client: 'runner',
        fun: 'salt.cmd',
        kwarg: {
          fun: 'file.read',
          path: pParam,
        },
      }
      params = [...params, param]
    })

    const result = await apiRequestMulti(pUrl, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function setRunnerFileRemove(
  pUrl: string,
  pToken: string,
  pParams: any[]
): Promise<any> {
  try {
    let params = []

    _.map(pParams, pParam => {
      const param = {
        token: pToken,
        eauth: 'pam',
        client: 'runner',
        fun: 'salt.cmd',
        kwarg: {
          fun: 'file.remove',
          path: pParam,
        },
      }
      params = [...params, param]
    })

    const result = await apiRequestMulti(pUrl, params, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

const saltActivityLog = async (
  activity: object,
  result: object
): Promise<void> => {
  if (_.get(result, 'status') === 200) {
    createActivityLog(
      'SaltProxy',
      `${_.get(activity, 'message')} result:${JSON.stringify(
        _.get(result, 'headers.content-type') === 'application/x-yaml'
          ? _.get(yaml.safeLoad(_.get(result, 'data')), 'return')[0]
          : _.get(result, 'data.return')[0]
      )}`
    )
  } else {
    createActivityLog(
      'SaltProxy',
      `Sever ${_.get(result, 'status')} error: ${_.get(result, 'statusText')}.`
    )
  }
}

export const createOspProject = async params => {
  try {
    const {pToken, pUrl, provider, namespace, projectdomain} = params

    const param = {
      token: pToken,
      eauth: 'pam',
      client: 'runner',
      fun: 'cloud.action',
      func: 'call',
      provider: provider,
      kwarg: {
        endpoint_func: 'create_project',
        name: namespace,
        domain_id: projectdomain,
      },
    }

    const result = await apiRequest(pUrl, pToken, param, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const deleteOspProject = async params => {
  try {
    const {pToken, pUrl, provider, namespace, projectdomain} = params

    const param = {
      token: pToken,
      eauth: 'pam',
      client: 'runner',
      fun: 'cloud.action',
      func: 'call',
      provider: provider,
      kwarg: {
        endpoint_func: 'delete_project',
        name_or_id: namespace,
        domain_id: projectdomain,
      },
    }

    const result = await apiRequest(pUrl, pToken, param, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const grantRoleOspProject = async params => {
  try {
    const {pToken, pUrl, provider, namespace, user} = params

    const param = {
      token: pToken,
      eauth: 'pam',
      client: 'runner',
      fun: 'cloud.action',
      func: 'call',
      provider: provider,
      kwarg: {
        endpoint_func: 'grant_role',
        name_or_id: provider,
        user: user,
        project: namespace,
      },
    }

    const result = await apiRequest(pUrl, pToken, param, 'application/x-yaml')

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalSaltCmdTelegraf(
  pUrl: string,
  pToken: string,
  pCmd: string,
  pMinionId: string
) {
  try {
    const params = {
      client: 'local',
      fun: 'cmd.run',
      kwarg: {
        cmd: pCmd,
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

    const result = await apiRequest(pUrl, pToken, params)

    return result
  } catch (error) {
    console.error(error)
    throw error
  }
}

async function kubernetesProxyRequest(
  endpoint: string,
  queryParams?: Record<string, string>
) {
  try {
    const proxyUrl = `/cloudhub/v1/kubernetes/proxy${endpoint}`

    let finalUrl = proxyUrl
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams()
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) {
          params.append(key, value)
        }
      })
      finalUrl = `${proxyUrl}?${params.toString()}`
    }

    const ajaxResult = await AJAX({
      method: 'GET',
      url: finalUrl,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    return ajaxResult.data
  } catch (error) {
    console.error('Kubernetes Proxy API error:', error)
    throw error
  }
}

async function k8sListWithNamespaces(
  clusterPath: string,
  nsPathTemplate: string,
  namespaces?: string[],
  queryParams?: Record<string, string>
) {
  if (Array.isArray(namespaces) && namespaces.length > 0) {
    const results = await Promise.all(
      namespaces.map(ns =>
        kubernetesProxyRequest(nsPathTemplate.replace('{ns}', ns), queryParams)
      )
    )

    const mergedItems = results.flatMap(res => {
      const body =
        res && typeof res === 'object' && 'data' in res
          ? (res as any).data
          : res
      return body?.items || []
    })

    return {items: mergedItems}
  }

  return await kubernetesProxyRequest(clusterPath, queryParams)
}

function convertToSaltStackFormat(data: any, resourceType: string) {
  const body =
    data && typeof data === 'object' && 'data' in data
      ? (data as any).data
      : data
  if (!body?.items) return body

  const toSnakeForUI = (type: string, item: any) => {
    const obj = _.cloneDeep(item)

    if (obj.metadata) {
      const m = obj.metadata
      if (m.resourceVersion && !m.resource_version)
        m.resource_version = m.resourceVersion
      if (m.creationTimestamp && !m.creation_timestamp)
        m.creation_timestamp = m.creationTimestamp
      if (m.ownerReferences && !m.owner_references)
        m.owner_references = m.ownerReferences
      if (m.managedFields && !m.managed_fields)
        m.managed_fields = m.managedFields
    }

    if (type === 'pods' && obj.spec) {
      if (obj.spec.nodeName && !obj.spec.node_name)
        obj.spec.node_name = obj.spec.nodeName
      if (Array.isArray(obj.spec.volumes)) {
        obj.spec.volumes = obj.spec.volumes.map(v => {
          const vol = _.cloneDeep(v)
          if (vol.persistentVolumeClaim) {
            vol.persistent_volume_claim = vol.persistentVolumeClaim
            if (
              vol.persistent_volume_claim.claimName &&
              !vol.persistent_volume_claim.claim_name
            ) {
              vol.persistent_volume_claim.claim_name =
                vol.persistent_volume_claim.claimName
            }
          }
          return vol
        })
      }
    }

    if (type === 'services' && obj.spec) {
      if (obj.spec.clusterIP && !obj.spec.cluster_ip)
        obj.spec.cluster_ip = obj.spec.clusterIP
    }

    if (obj.status) {
      if (
        obj.status.availableReplicas !== undefined &&
        obj.status.available_replicas === undefined
      ) {
        obj.status.available_replicas = obj.status.availableReplicas
      }
    }

    if (type === 'ingresses' && obj.spec?.rules) {
      obj.spec.rules = obj.spec.rules.map((rule: any) => {
        const r = _.cloneDeep(rule)
        if (r.http?.paths) {
          r.http.paths = r.http.paths.map((p: any) => {
            const path = _.cloneDeep(p)
            const svcName =
              path.backend?.service?.name || path.backend?.serviceName
            if (svcName && !path.backend?.service_name) {
              path.backend = {...path.backend, service_name: svcName}
            }
            return path
          })
        }
        return r
      })
    }

    if (type === 'persistentvolumeclaims' && obj.spec) {
      if (obj.spec.volumeName && !obj.spec.volume_name)
        obj.spec.volume_name = obj.spec.volumeName
    }

    if (type === 'persistentvolumes' && obj.spec) {
      if (obj.spec.accessModes && !obj.spec.access_modes)
        obj.spec.access_modes = obj.spec.accessModes
    }

    return obj
  }

  return body.items.map((it: any) => toSnakeForUI(resourceType, it))
}

export async function getKubernetesNamespacesProxy(pParam: Params) {
  try {
    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest('/api/v1/namespaces', queryParams)
    return convertToSaltStackFormat(data, 'namespaces')
  } catch (error) {
    console.error('Kubernetes Namespaces Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesPodsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/pods`
      : '/api/v1/pods'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/api/v1/pods',
          '/api/v1/namespaces/{ns}/pods',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'pods')
  } catch (error) {
    console.error('Kubernetes Pods Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesServicesProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/services`
      : '/api/v1/services'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/api/v1/services',
          '/api/v1/namespaces/{ns}/services',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'services')
  } catch (error) {
    console.error('Kubernetes Services Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesDeploymentsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/deployments`
      : '/apis/apps/v1/deployments'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'deployments')
  } catch (error) {
    console.error('Kubernetes Deployments Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesReplicaSetsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/replicasets`
      : '/apis/apps/v1/replicasets'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'replicasets')
  } catch (error) {
    console.error('Kubernetes ReplicaSets Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesReplicationControllersProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/replicationcontrollers`
      : '/api/v1/replicationcontrollers'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'replicationcontrollers')
  } catch (error) {
    console.error('Kubernetes ReplicationControllers Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesDaemonSetsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/daemonsets`
      : '/apis/apps/v1/daemonsets'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'daemonsets')
  } catch (error) {
    console.error('Kubernetes DaemonSets Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesStatefulSetsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/apps/v1/namespaces/${namespace}/statefulsets`
      : '/apis/apps/v1/statefulsets'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'statefulsets')
  } catch (error) {
    console.error('Kubernetes StatefulSets Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesJobsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/batch/v1/namespaces/${namespace}/jobs`
      : '/apis/batch/v1/jobs'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'jobs')
  } catch (error) {
    console.error('Kubernetes Jobs Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesCronJobsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/apis/batch/v1/namespaces/${namespace}/cronjobs`
      : '/apis/batch/v1/cronjobs'

    const queryParams: Record<string, string> = {}
    if (pParam.kwarg?.limit) queryParams.limit = pParam.kwarg.limit.toString()
    if (pParam.kwarg?.fieldselector)
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    if (pParam.kwarg?.labelselector)
      queryParams.labelSelector = pParam.kwarg.labelselector

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'cronjobs')
  } catch (error) {
    console.error('Kubernetes CronJobs Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesNodesProxy(pParam: Params) {
  try {
    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest('/api/v1/nodes', queryParams)
    return convertToSaltStackFormat(data, 'nodes')
  } catch (error) {
    console.error('Kubernetes Nodes Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesIngressesProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/apis/networking.k8s.io/v1/namespaces/${namespace}/ingresses`
      : '/apis/networking.k8s.io/v1/ingresses'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/apis/networking.k8s.io/v1/ingresses',
          '/apis/networking.k8s.io/v1/namespaces/{ns}/ingresses',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'ingresses')
  } catch (error) {
    console.error('Kubernetes Ingresses Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesServiceAccountsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/serviceaccounts`
      : '/api/v1/serviceaccounts'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/api/v1/serviceaccounts',
          '/api/v1/namespaces/{ns}/serviceaccounts',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'serviceaccounts')
  } catch (error) {
    console.error('Kubernetes ServiceAccounts Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesRolesProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/roles`
      : '/apis/rbac.authorization.k8s.io/v1/roles'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/apis/rbac.authorization.k8s.io/v1/roles',
          '/apis/rbac.authorization.k8s.io/v1/namespaces/{ns}/roles',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'roles')
  } catch (error) {
    console.error('Kubernetes Roles Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesRoleBindingsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const namespaces = (pParam.kwarg?.namespaces as string[]) || []
    const endpoint = namespace
      ? `/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings`
      : '/apis/rbac.authorization.k8s.io/v1/rolebindings'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await (namespaces.length
      ? k8sListWithNamespaces(
          '/apis/rbac.authorization.k8s.io/v1/rolebindings',
          '/apis/rbac.authorization.k8s.io/v1/namespaces/{ns}/rolebindings',
          namespaces,
          queryParams
        )
      : kubernetesProxyRequest(endpoint, queryParams))
    return convertToSaltStackFormat(data, 'rolebindings')
  } catch (error) {
    console.error('Kubernetes RoleBindings Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesPersistentVolumesProxy(pParam: Params) {
  try {
    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(
      '/api/v1/persistentvolumes',
      queryParams
    )
    return convertToSaltStackFormat(data, 'persistentvolumes')
  } catch (error) {
    console.error('Kubernetes PersistentVolumes Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesPersistentVolumeClaimsProxy(pParam: Params) {
  try {
    const namespace = pParam.kwarg?.namespace || ''
    const endpoint = namespace
      ? `/api/v1/namespaces/${namespace}/persistentvolumeclaims`
      : '/api/v1/persistentvolumeclaims'

    const queryParams: Record<string, string> = {}

    if (pParam.kwarg?.limit) {
      queryParams.limit = pParam.kwarg.limit.toString()
    }

    if (pParam.kwarg?.fieldselector) {
      queryParams.fieldSelector = pParam.kwarg.fieldselector
    }

    if (pParam.kwarg?.labelselector) {
      queryParams.labelSelector = pParam.kwarg.labelselector
    }

    const data = await kubernetesProxyRequest(endpoint, queryParams)
    return convertToSaltStackFormat(data, 'persistentvolumeclaims')
  } catch (error) {
    console.error('Kubernetes PersistentVolumeClaims Proxy API error:', error)
    throw error
  }
}

export async function getKubernetesNamespacesMultiProxy(pParam: Params) {
  try {
    const namespaceNames = pParam.kwarg?.namespaces || [
      'default',
      'kube-system',
    ]

    const promises = namespaceNames.map(async (name: string) => {
      try {
        const data = await kubernetesProxyRequest(`/api/v1/namespaces/${name}`)
        const body =
          data && typeof data === 'object' && 'data' in data ? data.data : data

        return {
          name: body.metadata?.name,
          uid: body.metadata?.uid,
          resource_version: body.metadata?.resourceVersion,
          creation_timestamp: body.metadata?.creationTimestamp,
          labels: body.metadata?.labels || {},
        }
      } catch (error) {
        console.warn(`Failed to fetch namespace ${name}:`, error)
        return null
      }
    })

    const results = await Promise.all(promises)

    return results.filter(result => result !== null)
  } catch (error) {
    console.error('Kubernetes Multi Proxy API error:', error)
    throw error
  }
}
