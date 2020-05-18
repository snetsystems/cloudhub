import _ from 'lodash'

// Types
import {Minion, MinionsObject} from 'src/agent_admin/type'
import {Source} from 'src/types'

// APIs
import {
  getWheelKeyListAll,
  getRunnerManageAllowed,
  getLocalServiceEnabledTelegraf,
  getLocalServiceStatusTelegraf,
  getLocalGrainsItems,
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

export const getMinionKeyListAllAsync = async (
  pUrl: string,
  pToken: string
): Promise<MinionsObject> => {
  const minions: MinionsObject = {}
  const info = await Promise.all([
    getWheelKeyListAll(pUrl, pToken),
    getRunnerManageAllowed(pUrl, pToken),
    getLocalGrainsItems(pUrl, pToken, ''),
  ])

  const info2 = await Promise.all([
    getLocalServiceEnabledTelegraf(
      pUrl,
      pToken,
      info[0].data.return[0].data.return.minions
    ),
    getLocalServiceStatusTelegraf(
      pUrl,
      pToken,
      info[0].data.return[0].data.return.minions
    ),
  ])

  const keyList = info[0].data.return[0].data.return.minions
  const ipList = info[1].data.return[0]
  const osList = info[2].data.return[0]

  const installList = info2[0].data.return[0]
  const statusList = info2[1].data.return[0]

  for (const k of keyList)
    minions[k] = {
      host: k,
      status: 'Accept',
      isCheck: false,
      ip: ipList[k],
      os: osList[k].os,
      osVersion: osList[k].osrelease,
      isInstall: installList[k] != true ? false : installList[k],
      isRunning: statusList[k],
    }

  return minions
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
          status: 'Accept',
          isSaltRuning: false,
        }
    } else {
      minions[k] = {
        host: k,
        status: 'Accept',
        isSaltRuning: false,
      }
    }
  }

  for (const k of keyList.minions_pre)
    if (!isUserAuthorized(meRole, SUPERADMIN_ROLE)) {
      if (hosts.filter(f => f === k).length > 0)
        minions[k] = {
          host: k,
          status: 'UnAccept',
          isSaltRuning: false,
        }
    } else {
      minions[k] = {
        host: k,
        status: 'UnAccept',
        isSaltRuning: false,
      }
    }

  for (const k of keyList.minions_rejected)
    if (!isUserAuthorized(meRole, SUPERADMIN_ROLE)) {
      if (hosts.filter(f => f === k).length > 0)
        minions[k] = {
          ...EmptyMinion,
          host: k,
          status: 'Reject',
          isSaltRuning: false,
        }
    } else {
      minions[k] = {
        ...EmptyMinion,
        host: k,
        status: 'Reject',
        isSaltRuning: false,
      }
    }

  const paramKeyList = _.values(minions).map(m => m.host)

  const info1 = await Promise.all([
    getRunnerManageAllowed(pUrl, pToken),
    getLocalGrainsItems(pUrl, pToken, paramKeyList.toString()),
  ])

  const ipList = info1[0].data.return[0]
  const osList = info1[1].data.return[0]

  for (const k of _.values(minions).map(m => m.host))
    minions[k] = {
      ...minions[k],
      ip: ipList[k],
      os: osList[k].os,
      osVersion: osList[k].osrelease,
      isSaltRuning: typeof osList[k] !== 'object' ? false : true,
    }

  const paramSaltRuningKeyList = _.values(minions)
    .filter(f => f.isSaltRuning !== false)
    .map(m => m.host)

  const info2 = await Promise.all([
    getLocalServiceEnabledTelegraf(
      pUrl,
      pToken,
      paramSaltRuningKeyList.toString()
    ),
    getLocalServiceStatusTelegraf(
      pUrl,
      pToken,
      paramSaltRuningKeyList.toString()
    ),
  ])

  const installList = info2[0].data.return[0]
  const statusList = info2[1].data.return[0]

  for (const k of _.values(minions).map(m => m.host))
    minions[k] = {
      ...minions[k],
      isInstall: installList[k] !== true ? false : true,
      isRunning: statusList[k] !== true ? false : true,
    }

  return minions
}

export const getMinionKeyListAll = async (
  pUrl: string,
  pToken: string
): Promise<MinionsObject> => {
  const minions: MinionsObject = {}
  const wheelKeyListAllPromise = getWheelKeyListAll(pUrl, pToken)

  return wheelKeyListAllPromise.then(pWheelKeyListAllData => {
    for (const k of pWheelKeyListAllData.data.return[0].data.return.minions)
      minions[k] = {
        ...EmptyMinion,
        host: k,
        status: 'Accept',
      }

    for (const k of pWheelKeyListAllData.data.return[0].data.return.minions_pre)
      minions[k] = {
        ...EmptyMinion,
        host: k,
        status: 'UnAccept',
      }

    for (const k of pWheelKeyListAllData.data.return[0].data.return
      .minions_rejected)
      minions[k] = {
        ...EmptyMinion,
        host: k,
        status: 'Reject',
      }

    return minions
  })
}

export const getMinionsIP = async (
  pUrl: string,
  pToken: string,
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}

  const getRunnerManageAllowedPromise = getRunnerManageAllowed(pUrl, pToken)
  return getRunnerManageAllowedPromise.then(pRunnerManageAllowedData => {
    Object.keys(pRunnerManageAllowedData.data.return[0]).forEach(function(k) {
      newMinions[k] = {
        host: k,
        status: newMinions[k].status,
        isCheck: newMinions[k].isCheck,
        ip: pRunnerManageAllowedData.data.return[0][k],
      }
    })
    return newMinions
  })
}

export const getMinionsOS = async (
  pUrl: string,
  pToken: string,
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}
  const getLocalGrainsItemsPromise = getLocalGrainsItems(
    pUrl,
    pToken,
    _.values(newMinions)
      .map(m => m.host)
      .toString()
  )

  return getLocalGrainsItemsPromise.then(pLocalGrainsItemsData => {
    Object.keys(pLocalGrainsItemsData.data.return[0]).forEach(function(k) {
      if (newMinions.hasOwnProperty(k)) {
        newMinions[k] = {
          host: k,
          status: newMinions[k].status,
          isCheck: newMinions[k].isCheck,
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
  pUrl: string,
  pToken: string,
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}
  const getLocalServiceEnabledTelegrafPromise = getLocalServiceEnabledTelegraf(
    pUrl,
    pToken,
    Object.keys(newMinions).toString()
  )

  return getLocalServiceEnabledTelegrafPromise.then(
    pLocalServiceEnabledTelegrafData => {
      Object.keys(pLocalServiceEnabledTelegrafData.data.return[0]).forEach(
        function(k) {
          if (newMinions.hasOwnProperty(k)) {
            newMinions[k] = {
              host: k,
              status: newMinions[k].status,
              isCheck: newMinions[k].isCheck,
              ip: newMinions[k].ip,
              os: newMinions[k].os,
              osVersion: newMinions[k].osVersion,
              isInstall:
                pLocalServiceEnabledTelegrafData.data.return[0][k] != true
                  ? false
                  : pLocalServiceEnabledTelegrafData.data.return[0][k],
            }
          }
        }
      )
      return newMinions
    }
  )
}

export const getTelegrafServiceStatus = async (
  pUrl: string,
  pToken: string,
  minions: MinionsObject
): Promise<MinionsObject> => {
  const newMinions = {...minions}
  const getLocalServiceStatusTelegrafPromise = getLocalServiceStatusTelegraf(
    pUrl,
    pToken,
    Object.keys(newMinions).toString()
  )

  return getLocalServiceStatusTelegrafPromise.then(
    pLocalServiceStatusTelegrafData => {
      Object.keys(pLocalServiceStatusTelegrafData.data.return[0]).forEach(
        function(k) {
          if (newMinions.hasOwnProperty(k)) {
            newMinions[k] = {
              host: k,
              status: newMinions[k].status,
              isCheck: newMinions[k].isCheck,
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
