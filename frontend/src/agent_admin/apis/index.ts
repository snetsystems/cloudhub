import {Minion} from 'src/agent_admin/type'
import {
  getWheelKeyListAll,
  getRunnerManageAllowed,
  getLocalServiceEnabledTelegraf,
  getLocalServiceStatusTelegraf,
  getLocalGrainsItems,
} from 'src/shared/apis/saltStack'

interface MinionsObject {
  [x: string]: Minion
}

const EmptyMionin: Minion = {
  host: '',
  ip: '',
  os: '',
  osVersion: '',
  status: '',
  isCheck: false,
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

export const getMinionKeyListAll = async (
  pUrl: string,
  pToken: string
): Promise<MinionsObject> => {
  const minions: MinionsObject = {}
  const wheelKeyListAllPromise = getWheelKeyListAll(pUrl, pToken)

  return wheelKeyListAllPromise.then(pWheelKeyListAllData => {
    for (const k of pWheelKeyListAllData.data.return[0].data.return.minions)
      minions[k] = {
        ...EmptyMionin,
        host: k,
        status: 'Accept',
      }

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

export const getMinionAcceptKeyListAll = async (
  pUrl: string,
  pToken: string
): Promise<MinionsObject> => {
  const minions: MinionsObject = {}
  const wheelKeyListAllPromise = getWheelKeyListAll(pUrl, pToken)

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
  const getLocalGrainsItemsPromise = getLocalGrainsItems(pUrl, pToken, '')

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
    Object.keys(newMinions)
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
    Object.keys(newMinions)
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
