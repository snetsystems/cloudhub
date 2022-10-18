import _ from 'lodash'
import {AxiosResponse} from 'axios'
import yaml from 'js-yaml'
import AJAX from 'src/utils/ajax'

// APIs
import {
  getWheelKeyAcceptedList,
  getLocalVSphereInfoAll,
  getTicketRemoteConsole,
} from 'src/shared/apis/saltStack'
import {getCpuAndLoadForK8s} from 'src/clouds/apis/kubernetes'

export {getCpuAndLoadForK8s}

export const getMinionKeyAcceptedList = async (
  pUrl: string,
  pToken: string
): Promise<String[]> => {
  const info = await Promise.all([getWheelKeyAcceptedList(pUrl, pToken)])
  const minions = _.get(
    yaml.safeLoad(info[0].data),
    'return[0].data.return.minions',
    []
  )

  return minions
}

export const getVSphereInfoSaltApi = async (
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string
): Promise<any> => {
  const info = await Promise.all([
    getLocalVSphereInfoAll(
      pUrl,
      pToken,
      tgt,
      address,
      user,
      password,
      port,
      protocol
    ),
  ])

  const vSphere = yaml.safeLoad(info[0].data)
  return vSphere
}

export const getTicketRemoteConsoleApi = async (
  pUrl: string,
  pToken: string,
  tgt: string,
  address: string,
  user: string,
  password: string
): Promise<String[]> => {
  const info = await Promise.all([
    getTicketRemoteConsole(pUrl, pToken, tgt, address, user, password),
  ])
  const ticket = yaml.safeLoad(info[0].data)
  return ticket
}

const calcInterval = (interval: string) => {
  if (interval.indexOf('s') > -1) {
    return parseInt(interval) * 1000
  }
  if (interval.indexOf('m') > -1) {
    return parseInt(interval) * (1000 * 60)
  }
}

export const getVSpheresApi = async () => {
  let data
  try {
    const {
      data: {vspheres},
    }: AxiosResponse<any> = await AJAX({
      url: '/cloudhub/v1/vspheres',
      method: 'GET',
    })

    data = {...vspheres}
    return data
  } catch (error) {}
  return
}

export const getVSphereApi = async (id: number) => {
  let info = await AJAX({
    url: `/cloudhub/v1/vspheres/${id}`,
    method: 'GET',
  })
  const vSphere = _.get(info, 'data', [])
  return vSphere
}

export const addVSphereApi = async (
  tgt: string,
  address: string,
  user: string,
  password: string,
  port: string,
  protocol: string,
  interval: string,
  sourceID: string
) => {
  return await AJAX({
    url: '/cloudhub/v1/vspheres',
    method: 'POST',
    data: {
      host: address,
      username: user,
      password,
      protocol,
      port: parseInt(port),
      interval: calcInterval(interval),
      datasource: sourceID,
      minion: tgt,
    },
  })
}

export const updateVSphereApi = async ({
  id,
  tgt,
  address,
  user,
  password,
  port,
  protocol,
  interval,
  sourceID,
}: {
  id: number
  tgt: string
  address: string
  user: string
  password: string
  port: string
  protocol: string
  interval: string
  sourceID: string
}) => {
  let data = {}
  if (tgt) {
    data = {...data, minion: tgt}
  }

  if (address) {
    data = {...data, host: address}
  }

  if (user) {
    data = {...data, username: user}
  }

  if (password) {
    data = {...data, password}
  }

  if (port) {
    data = {...data, port: parseInt(port)}
  }

  if (protocol) {
    data = {...data, protocol}
  }

  if (interval) {
    data = {...data, interval: calcInterval(interval)}
  }

  if (sourceID) {
    data = {...data, datasource: sourceID}
  }

  return await AJAX({
    url: `/cloudhub/v1/vspheres/${id}`,
    method: 'PATCH',
    data,
  })
}

export const deleteVSphereApi = async (id: number) => {
  return await AJAX({
    url: `/cloudhub/v1/vspheres/${id}`,
    method: 'DELETE',
  })
}
