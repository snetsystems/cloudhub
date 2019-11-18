import axios, {AxiosResponse} from 'axios'
import {Minion} from 'src/types'

interface MinionsObject {
  [x: string]: Minion
}

const EmptyMionin: Minion = {
  host: '',
  ip: '',
  os: '',
  osVersion: '',
  status: '',
  //app: [],
}

const apiRequest = (pMethod, pRoute, pParams) => {
  const dParams = {
    username: 'salt',
    password: 'salt',
    eauth: 'pam',
  }

  Object.assign(dParams, pParams)

  console.log(dParams)
  console.log(pParams)

  const url = 'http://192.168.56.105:8000/run' + pRoute
  const headers = {
    Accept: 'application/json',
    'Content-type': 'application/json',
  }

  // return axios({
  //   method: pMethod,
  //   url: url,
  //   headers: headers,
  //   data: {
  //     username: dParams.username,
  //     password: dParams.password,
  //     eauth: dParams.eauth,
  //     client: pParams.client,
  //     fun: pParams.fun,
  //   },
  // })
  const param = JSON.stringify(dParams)

  console.log(JSON.stringify(dParams))

  return axios({
    method: pMethod,
    url: url,
    headers: headers,
    data: param,
  })
}

export const getMinionKeyListAll = async (): Promise<MinionsObject> => {
  const minions: MinionsObject = {}

  const wheelKeyListAllPromise = getWheelKeyListAll()
  //const getRunnerManageAllowedPromise = getRunnerManageAllowed()

  return wheelKeyListAllPromise.then(pWheelKeyListAllData => {
    for (const k of pWheelKeyListAllData.data.return[0].data.return.minions)
      minions[k] = {
        ...EmptyMionin,
        host: k,
        status: 'Accept',
      }

    // getRunnerManageAllowedPromise.then(pRunnerManageAllowedData => {
    //   Object.keys(pRunnerManageAllowedData.data.return[0]).forEach(function(
    //     key
    //   ) {
    //     console.log(key, pRunnerManageAllowedData.data.return[0][key])
    //     minions[key] = {
    //       ...EmptyMionin,
    //       ip: pRunnerManageAllowedData.data.return[0][key],
    //     }
    //   })

    //   console.log(minions)
    // })

    for (const k of pWheelKeyListAllData.data.return[0].data.return.minions_pre)
      minions[k] = {
        ...EmptyMionin,
        host: k,
        status: 'UnAccept',
      }

    for (const k of pWheelKeyListAllData.data.return[0].data.return
      .minions_rejected)
      minions[k] = {
        ...EmptyMionin,
        host: k,
        status: 'ReJect',
      }

    return minions
  })
}

export const getMinionAcceptKeyListAll = async (): Promise<MinionsObject> => {
  const minions: MinionsObject = {}

  const wheelKeyListAllPromise = getWheelKeyListAll()
  //const getRunnerManageAllowedPromise = getRunnerManageAllowed()

  return wheelKeyListAllPromise.then(pWheelKeyListAllData => {
    for (const k of pWheelKeyListAllData.data.return[0].data.return.minions)
      minions[k] = {
        ...EmptyMionin,
        host: k,
        status: 'Accept',
      }

    return minions
  })
}

export const getMinionsIP = async (
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}

  console.log('getMinionsIP')

  const getRunnerManageAllowedPromise = getRunnerManageAllowed()
  return getRunnerManageAllowedPromise.then(pRunnerManageAllowedData => {
    Object.keys(pRunnerManageAllowedData.data.return[0]).forEach(function(k) {
      console.log(k, pRunnerManageAllowedData.data.return[0][k])
      newMinions[k] = {
        host: k,
        status: newMinions[k].status,
        ip: pRunnerManageAllowedData.data.return[0][k],
      }
    })
    return newMinions
  })
}

export const getMinionsOS = async (
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}

  console.log('getMinionsOS')

  const getLocalGrainsItemsPromise = getLocalGrainsItems('')

  return getLocalGrainsItemsPromise.then(pLocalGrainsItemsData => {
    Object.keys(pLocalGrainsItemsData.data.return[0]).forEach(function(k) {
      if (newMinions.hasOwnProperty(k)) {
        newMinions[k] = {
          host: k,
          status: newMinions[k].status,
          ip: newMinions[k].ip,
          os: pLocalGrainsItemsData.data.return[0][k].os,
          osVersion: pLocalGrainsItemsData.data.return[0][k].osrelease,
        }
      }
    })
    return newMinions
  })
}

export const getTelegrafInstalled = async (
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}
  const pMinionid = ''

  console.log('getTelegrafInstalled')
  console.log(Object.keys(newMinions))

  const getLocalServiceEnableTelegrafPromise = getLocalServiceEnableTelegraf(
    Object.keys(newMinions)
  )

  return getLocalServiceEnableTelegrafPromise.then(
    pLocalServiceEnableTelegrafData => {
      console.log(pLocalServiceEnableTelegrafData.data.return[0])
      Object.keys(pLocalServiceEnableTelegrafData.data.return[0]).forEach(
        function(k) {
          if (newMinions.hasOwnProperty(k)) {
            newMinions[k] = {
              host: k,
              status: newMinions[k].status,
              ip: newMinions[k].ip,
              os: newMinions[k].os,
              osVersion: newMinions[k].osVersion,
              isInstall:
                pLocalServiceEnableTelegrafData.data.return[0][k] != true
                  ? false
                  : pLocalServiceEnableTelegrafData.data.return[0][k],
            }
          }
        }
      )
      return newMinions
    }
  )
}

export const getTelegrafServiceStatus = async (
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}
  const pMinionid = ''

  console.log('getTelegrafServiceStatus')
  console.log(Object.keys(newMinions))

  const getLocalServiceStatusTelegrafPromise = getLocalServiceStatusTelegraf(
    Object.keys(newMinions)
  )

  return getLocalServiceStatusTelegrafPromise.then(
    pLocalServiceStatusTelegrafData => {
      console.log(pLocalServiceStatusTelegrafData.data.return[0])
      Object.keys(pLocalServiceStatusTelegrafData.data.return[0]).forEach(
        function(k) {
          if (newMinions.hasOwnProperty(k)) {
            newMinions[k] = {
              host: k,
              status: newMinions[k].status,
              ip: newMinions[k].ip,
              os: newMinions[k].os,
              osVersion: newMinions[k].osVersion,
              isInstall: newMinions[k].isInstall,
              isRunning: pLocalServiceStatusTelegrafData.data.return[0][k],
            }
          }
        }
      )
      return newMinions
    }
  )
}

export function getLocalGrainsItem(pMinionId) {
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

  return apiRequest('POST', '/', params)
}

export function runAcceptKey(pMinionId) {
  const params = {
    client: 'wheel',
    fun: 'key.accept',
    match: pMinionId,
    include_rejected: 'true',
    include_denied: 'true',
  }

  return apiRequest('POST', '/', params)
}

export function runRejectKey(pMinionId) {
  const params = {
    client: 'wheel',
    fun: 'key.reject',
    match: pMinionId,
    include_accepted: 'true',
  }

  return apiRequest('POST', '/', params)
}

export function runDeleteKey(pMinionId) {
  const params = {
    client: 'wheel',
    fun: 'key.delete',
    match: pMinionId,
  }

  return apiRequest('POST', '/', params)
}

export function getWheelKeyListAll() {
  const params = {
    client: 'wheel',
    fun: 'key.list_all',
  }

  return apiRequest('POST', '/', params)
}

export function getRunnerManageAllowed() {
  const params = {
    client: 'runner',
    fun: 'manage.allowed',
    show_ip: 'true',
  }

  return apiRequest('POST', '/', params)
}

export function getLocalServiceEnableTelegraf(pMinionId) {
  const params = {
    client: 'local',
    fun: 'service.enable',
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
  return apiRequest('POST', '/', params)
}

export function getLocalServiceStatusTelegraf(pMinionId) {
  const params = {
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
  return apiRequest('POST', '/', params)
}

export function runLocalServiceStartTelegraf(pMinionId) {
  const params = {
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
  return apiRequest('POST', '/', params)
}

export function runLocalServiceStopTelegraf(pMinionId) {
  const params = {
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
  return apiRequest('POST', '/', params)
}

export function runLocalCpGetDirTelegraf(pMinionId) {
  const params = {
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
  return apiRequest('POST', '/', params)
}

export function runLocalPkgInstallTelegraf(pMinionId) {
  const params = {
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
  return apiRequest('POST', '/', params)
}

export function getLocalBeaconsList(pMinionId) {
  const params = {
    client: 'local',
    fun: 'beacons.list',
    kwarg: {return_yaml: false},
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
  return apiRequest('POST', '/', params)
}

export function getLocalGrainsItems(pMinionId) {
  const params = {
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
  return apiRequest('POST', '/', params)
}

export function getLocalPillarItems(pMinionId) {
  const params = {
    client: 'local',
    fun: 'pillar.items',
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
  return apiRequest('POST', '/', params)
}

export function getLocalPillarObfuscate(pMinionId) {
  const params = {
    client: 'local',
    fun: 'pillar.obfuscate',
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
  return apiRequest('POST', '/', params)
}

export function getLocalScheduleList(pMinionId) {
  const params = {
    client: 'local',
    fun: 'schedule.list',
    tgt_type: '',
    tgt: '',
    kwarg: {return_yaml: false},
  }
  if (pMinionId) {
    params.tgt_type = 'list'
    params.tgt = pMinionId
  } else {
    params.tgt_type = 'glob'
    params.tgt = '*'
  }
  return apiRequest('POST', '/', params)
}

export function getRunnerJobsActive() {
  const params = {
    client: 'runner',
    fun: 'jobs.active',
  }
  return apiRequest('POST', '/', params)
}

export function getRunnerJobsListJob(pJobId) {
  const params = {
    client: 'runner',
    fun: 'jobs.list_job',
    jid: pJobId,
  }
  return apiRequest('POST', '/', params)
}

export function getRunnerJobsListJobs() {
  const params = {
    client: 'runner',
    fun: 'jobs.list_jobs',
  }
  return apiRequest('POST', '/', params)
}

export function getWheelConfigValues() {
  const params = {
    client: 'wheel',
    fun: 'config.values',
  }
  return apiRequest('POST', '/', params)
}

export function getWheelKeyFinger(pMinionId) {
  const params = {
    client: 'wheel',
    fun: 'key.finger',
    match: '',
  }
  if (pMinionId) {
    params.match = pMinionId
  } else {
    params.match = '*'
  }
  return apiRequest('POST', '/', params)
}
