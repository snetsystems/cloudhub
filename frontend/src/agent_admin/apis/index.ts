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

  for (const k of _.values(minions).map(m => m.host)) {
    if (osList[k] !== undefined) {
      minions[k] = {
        ...minions[k],
        ip: ipList[k],
        os: osList[k].os,
        osVersion: osList[k].osrelease,
        isSaltRuning: typeof osList[k] !== 'object' ? false : true,
      }
    } else {
      minions[k] = {
        ...minions[k],
        ip: ipList[k],
        isSaltRuning: false,
      }
    }
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

  Object.keys(data.return[0]).forEach(function(k) {
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

  Object.keys(data.return[0]).forEach(function(k) {
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
