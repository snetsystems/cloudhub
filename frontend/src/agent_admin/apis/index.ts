import _ from 'lodash'

// Types
import {Minion, MinionsObject} from 'src/agent_admin/type'
import {Source} from 'src/types'
import {MinionState} from 'src/agent_admin/type/minion'

// APIs
import {
  getWheelKeyListAll,
  getLocalServiceEnabledTelegraf,
  getLocalServiceStatusTelegraf,
  getMinionsState,
  getLocalGrainsItem,
} from 'src/shared/apis/saltStack'
import {getAllHosts} from 'src/shared/apis/multiTenant'

// Constants
import {isUserAuthorized, SUPERADMIN_ROLE} from 'src/auth/Authorized'

const EmptyMinion: Minion = {
  host: '',
  ip: '',
  os: '',
  osVersion: '',
  status: '',
  isCheck: false,
  isInstall: false,
  isRunning: false,
  isSaltRuning: false,
}

export const getMinionKeyListAllAdmin = async (
  pUrl: string,
  pToken: string,
  pSource: Source,
  meRole: string
): Promise<MinionsObject> => {
  const minions: MinionsObject = {}
  const info = await Promise.all([
    getWheelKeyListAll(pUrl, pToken),
    getAllHosts(pSource),
  ])

  const keyList = info[0].data.return[0].data.return
  const hosts = _.values(info[1]).map(m => m.name)

  for (const k of keyList.minions) {
    if (!isUserAuthorized(meRole, SUPERADMIN_ROLE)) {
      if (hosts.filter(f => f === k).length > 0)
        minions[k] = {
          host: k,
          status: MinionState.Accept,
          isSaltRuning: false,
        }
    } else {
      minions[k] = {
        host: k,
        status: MinionState.Accept,
        isSaltRuning: false,
      }
    }
  }

  for (const k of keyList.minions_pre)
    if (!isUserAuthorized(meRole, SUPERADMIN_ROLE)) {
      if (hosts.filter(f => f === k).length > 0)
        minions[k] = {
          host: k,
          status: MinionState.UnAccept,
          isSaltRuning: false,
        }
    } else {
      minions[k] = {
        host: k,
        status: MinionState.UnAccept,
        isSaltRuning: false,
      }
    }

  for (const k of keyList.minions_rejected)
    if (!isUserAuthorized(meRole, SUPERADMIN_ROLE)) {
      if (hosts.filter(f => f === k).length > 0)
        minions[k] = {
          ...EmptyMinion,
          host: k,
          status: MinionState.Reject,
          isSaltRuning: false,
        }
    } else {
      minions[k] = {
        ...EmptyMinion,
        host: k,
        status: MinionState.Reject,
        isSaltRuning: false,
      }
    }

  for (const k of keyList.minions_denied)
    if (!isUserAuthorized(meRole, SUPERADMIN_ROLE)) {
      if (hosts.filter(f => f === k).length > 0)
        minions[k] = {
          ...EmptyMinion,
          host: k,
          status: MinionState.Denied,
          isSaltRuning: false,
        }
    } else {
      minions[k] = {
        ...EmptyMinion,
        host: k,
        status: MinionState.Denied,
        isSaltRuning: false,
      }
    }

  const paramKeyList = _.values(minions).map(m => m.host)
  const grainItemInfo = await Promise.all([
    getLocalGrainsItem(pUrl, pToken, paramKeyList.toString()),
  ])
  const ipv4Regexformat: RegExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/
  const exceptLoopbackRegexFormat: RegExp = /^(?!127.0.0.1)/
  const osList = grainItemInfo[0].data.return[0]

  for (const k of _.values(minions).map(m => m.host)) {
    const ipInterfaces = osList[k]?.ip_interfaces
    const ipList: string = _.keys(ipInterfaces)
      .map(item =>
        ipInterfaces[item]
          .filter((ip: string) => ipv4Regexformat.test(ip))
          .filter((ip: string) => exceptLoopbackRegexFormat.test(ip))
      )
      .flat()
      .join(',')

    if (osList[k]) {
      minions[k] = {
        ...minions[k],
        ip: ipList,
        os: osList[k].os,
        osVersion: osList[k].osrelease,
        isSaltRuning: typeof osList[k] !== 'object' ? false : true,
      }
    } else {
      minions[k] = {
        ...minions[k],
        ip: ipList,
        isSaltRuning: false,
      }
    }
  }

  const paramSaltRuningKeyList = _.values(minions)
    .filter(f => f.isSaltRuning !== false)
    .map(m => m.host)

  const telegrafInfo = await getTelegrafInstalledList(
    pUrl,
    pToken,
    paramSaltRuningKeyList.toString()
  )

  const installList = telegrafInfo[0].data.return[0]
  const statusList = telegrafInfo[1].data.return[0]

  for (const k of _.values(minions).map(m => m.host))
    minions[k] = {
      ...minions[k],
      isInstall: installList[k] !== true ? false : true,
      isRunning: statusList[k] !== true ? false : true,
    }

  return minions
}

async function waitForSaltCallCompletion(
  func: (...params: any) => Promise<unknown>,
  check: (data: any) => boolean,
  params: any,
  options = {maxAttempts: 3, retryDelay: 2000, initialDelay: 2000},
  attempt: number = 0
): Promise<any> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  if (attempt === 0) await delay(options.initialDelay)

  const data = await func(...params)

  if (check(data) || attempt >= options.maxAttempts) {
    return data
  }

  await delay(options.retryDelay)
  return waitForSaltCallCompletion(func, check, params, options, attempt + 1)
}

export const updateMinionKeyState = async (
  pUrl: string,
  pToken: string,
  minionId: string,
  minions: MinionsObject
) => {
  const minion = await getMinionsState(pUrl, pToken, minionId)

  switch (minion.minionState) {
    case MinionState.Accept:
      minions[minion.key] = {
        ...minions[minion.key],
        status: minion.minionState,
      }
      await getGrainItem(pUrl, pToken, minion.key, minions)
      return minions
    case MinionState.Delete:
      delete minions[minion.key]
      return minions

    case MinionState.Reject:
    case MinionState.Denied:
      minions[minion.key] = {
        ...minions[minion.key],
        status: minion.minionState,
      }
      return minions

    default:
      return minions
  }
}
export const getTelegrafInstalledList = async (
  pUrl: string,
  pToken: string,
  minionId: string
) => {
  return await Promise.all([
    getLocalServiceEnabledTelegraf(pUrl, pToken, minionId),
    getLocalServiceStatusTelegraf(pUrl, pToken, minionId),
  ])
}

export const getTelegrafState = async (
  pUrl: string,
  pToken: string,
  minionId: string,
  minions: MinionsObject
) => {
  const telegrafInfo = await getTelegrafInstalledList(pUrl, pToken, minionId)
  const installList = telegrafInfo[0].data.return[0]
  const statusList = telegrafInfo[1].data.return[0]

  minions[minionId] = {
    ...minions[minionId],
    isInstall: installList[minionId] !== true ? false : true,
    isRunning: statusList[minionId] !== true ? false : true,
  }

  return minions
}

export const getGrainItem = async (
  pUrl: string,
  pToken: string,
  minionId: string,
  minions: MinionsObject
) => {
  try {
    const grainItemsInfo = await waitForSaltCallCompletion(
      getLocalGrainsItem,
      res => res.data?.return[0][minionId] !== false,
      [pUrl, pToken, minionId]
    )

    const ipv4Regexformat: RegExp = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/
    const exceptLoopbackRegexFormat: RegExp = /^(?!127.0.0.1)/
    const osList = grainItemsInfo.data.return[0]

    const ipInterfaces = osList[minionId]?.ip_interfaces
    const ipList: string = _.keys(ipInterfaces)
      .map(item =>
        ipInterfaces[item]
          .filter(ip => ipv4Regexformat.test(ip))
          .filter(ip => exceptLoopbackRegexFormat.test(ip))
      )
      .flat()
      .join(',')

    minions[minionId] = {
      ...minions[minionId],
      ip: ipList,
      os: osList[minionId].os,
      osVersion: osList[minionId].osrelease,
      isSaltRuning: typeof osList[minionId] !== 'object' ? false : true,
    }

    await getTelegrafState(pUrl, pToken, minionId, minions)

    return minions
  } catch (error) {
    return minions
  }
}

export const getTelegrafInstalled = async (
  pUrl: string,
  pToken: string,
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}
  const {data} = await getLocalServiceEnabledTelegraf(
    pUrl,
    pToken,
    Object.keys(newMinions).toString()
  )

  Object.keys(data.return[0]).forEach(function (k) {
    if (newMinions.hasOwnProperty(k)) {
      newMinions[k] = {
        host: k,
        status: newMinions[k].status,
        isCheck: newMinions[k].isCheck,
        ip: newMinions[k].ip,
        os: newMinions[k].os,
        osVersion: newMinions[k].osVersion,
        isInstall: data.return[0][k] != true ? false : data.return[0][k],
      }
    }
  })
  return newMinions
}

export const getTelegrafServiceStatus = async (
  pUrl: string,
  pToken: string,
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}
  const {data} = await getLocalServiceStatusTelegraf(
    pUrl,
    pToken,
    Object.keys(newMinions).toString()
  )

  Object.keys(data.return[0]).forEach(function (k) {
    if (newMinions.hasOwnProperty(k)) {
      newMinions[k] = {
        host: k,
        status: newMinions[k].status,
        isCheck: newMinions[k].isCheck,
        ip: newMinions[k].ip,
        os: newMinions[k].os,
        osVersion: newMinions[k].osVersion,
        isInstall: newMinions[k].isInstall,
        isRunning: data.return[0][k],
      }
    }
  })

  return newMinions
}
