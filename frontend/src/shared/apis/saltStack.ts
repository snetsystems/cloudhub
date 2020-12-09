import AJAX from 'src/utils/ajax'
import {SaltStack} from 'src/types/saltstack'

const apiRequest = async (
  pUrl: string,
  pToken: string,
  pParams: SaltStack,
  pAccept?: string
) => {
  try {
    const dParams = {token: pToken, eauth: 'pam'}
    const saltMasterUrl = pUrl
    const url = saltMasterUrl + '/'
    const headers = {
      Accept: pAccept ? pAccept : 'application/json',
      'Content-type': 'application/json',
    }

    const param = JSON.stringify(Object.assign(dParams, pParams))
    return await AJAX({
      method: 'POST',
      url: url,
      headers,
      data: param,
    })
  } catch (error) {
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
    const params: SaltStack = {
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
    const params: SaltStack = {
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
    const params: SaltStack = {
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
    const params: SaltStack = {
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
    const params: SaltStack = {
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

export async function runLocalCpGetDirTelegraf(
  pUrl: string,
  pToken: string,
  pMinionId: string
) {
  try {
    const params: SaltStack = {
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
    const params: SaltStack = {
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
    const params: SaltStack = {
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
  pMinionId: string
) {
  try {
    const params: SaltStack = {
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
  pScript: string
) {
  try {
    const params: SaltStack = {
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
    const params: SaltStack = {
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
      },
    }

    return await apiRequest(pUrl, pToken, params)
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
    const params: SaltStack = {
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
  pParam: SaltStack
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
  pParam: SaltStack
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
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sPods(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sDaemonSets(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sCronJobs(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sSecrets(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.cluster_roles',
      tgt: pMinionId,
      kwarg: {
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sClusterRoleBindings(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: SaltStack
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.cluster_role_bindings',
      tgt: pMinionId,
      kwarg: {
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
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
  pParam: SaltStack
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
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sPersistentVolumes(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: SaltStack
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.persistent_volumes',
      tgt: pMinionId,
      kwarg: {
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}

export async function getLocalK8sPersistentVolumeClaims(
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pParam: SaltStack
) {
  try {
    const params = {
      token: pToken,
      eauth: 'pam',
      client: 'local',
      fun: 'kubernetes.persistent_volume_claims',
      tgt: pMinionId,
      kwarg: {
        detail: pParam.hasOwnProperty('kwarg')
          ? pParam.kwarg.hasOwnProperty('detail')
            ? pParam.kwarg.detail
            : false
          : false,
      },
    }
    return await apiRequest(pUrl, pToken, params, 'application/x-yaml')
  } catch (error) {
    console.error(error)
    throw error
  }
}
