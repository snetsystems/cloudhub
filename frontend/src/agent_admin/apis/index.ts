import axios, { AxiosResponse } from 'axios'
import { Minion } from 'src/types'

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
	//app: [],
}

const apiRequest = (pMethod, pRoute, pParams) => {
	const dParams = {
		username: 'saltdev',
		password: 'saltdev',
		eauth: 'pam',
	}

	Object.assign(dParams, pParams)

	console.log(dParams)
	console.log(pParams)

	const url = 'http://localhost:8000/run' + pRoute
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

export const getMinionKeyListAllAsync = async (): Promise<MinionsObject> => {
	const minions: MinionsObject = {}

	const info = await Promise.all([getWheelKeyListAll(), getRunnerManageAllowed(), getLocalGrainsItems('')])

	console.log(info)
	console.log(info[0].data.return[0].data.return.minions)

	const info2 = await Promise.all([
		getLocalServiceEnabledTelegraf(info[0].data.return[0].data.return.minions),
		getLocalServiceStatusTelegraf(info[0].data.return[0].data.return.minions),
	])

	const keyList = info[0].data.return[0].data.return.minions
	const ipList = info[1].data.return[0]
	const osList = info[2].data.return[0]

	const installList = info2[0].data.return[0]
	const statusList = info2[1].data.return[0]

	console.log('list', keyList, ipList, osList, installList, statusList)

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

	console.log(minions)

	return minions
}

export const getMinionKeyListAll = async (): Promise<MinionsObject> => {
	const minions: MinionsObject = {}

	const wheelKeyListAllPromise = getWheelKeyListAll()
	//const getRunnerManageAllowedPromise = getRunnerManageAllowed()

	return wheelKeyListAllPromise.then((pWheelKeyListAllData) => {
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

		for (const k of pWheelKeyListAllData.data.return[0].data.return.minions_rejected)
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

	return wheelKeyListAllPromise.then((pWheelKeyListAllData) => {
		for (const k of pWheelKeyListAllData.data.return[0].data.return.minions)
			minions[k] = {
				...EmptyMionin,
				host: k,
				status: 'Accept',
			}

		return minions
	})
}

export const getMinionsIP = async (minions: MinionsObject): Promise<MinionsObject> => {
	const newMinions = { ...minions }

	console.log('getMinionsIP')

	const getRunnerManageAllowedPromise = getRunnerManageAllowed()
	return getRunnerManageAllowedPromise.then((pRunnerManageAllowedData) => {
		Object.keys(pRunnerManageAllowedData.data.return[0]).forEach(function (k) {
			console.log(k, pRunnerManageAllowedData.data.return[0][k])
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

export const getMinionsOS = async (minions: MinionsObject): Promise<MinionsObject> => {
	const newMinions = { ...minions }

	console.log('getMinionsOS')

	const getLocalGrainsItemsPromise = getLocalGrainsItems('')

	return getLocalGrainsItemsPromise.then((pLocalGrainsItemsData) => {
		Object.keys(pLocalGrainsItemsData.data.return[0]).forEach(function (k) {
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

export const getTelegrafInstalled = async (minions: MinionsObject): Promise<MinionsObject> => {
	const newMinions = { ...minions }
	const pMinionid = ''

	console.log('getTelegrafInstalled')
	console.log(Object.keys(newMinions))

	const getLocalServiceEnabledTelegrafPromise = getLocalServiceEnabledTelegraf(Object.keys(newMinions))

	return getLocalServiceEnabledTelegrafPromise.then((pLocalServiceEnabledTelegrafData) => {
		console.log(pLocalServiceEnabledTelegrafData.data.return[0])
		Object.keys(pLocalServiceEnabledTelegrafData.data.return[0]).forEach(function (k) {
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
		})
		return newMinions
	})
}

export const getTelegrafServiceStatus = async (minions: MinionsObject): Promise<MinionsObject> => {
	const newMinions = { ...minions }
	const pMinionid = ''

	console.log('getTelegrafServiceStatus')
	console.log(Object.keys(newMinions))

	const getLocalServiceStatusTelegrafPromise = getLocalServiceStatusTelegraf(Object.keys(newMinions))

	return getLocalServiceStatusTelegrafPromise.then((pLocalServiceStatusTelegrafData) => {
		console.log(pLocalServiceStatusTelegrafData.data.return[0])
		Object.keys(pLocalServiceStatusTelegrafData.data.return[0]).forEach(function (k) {
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
		})
		return newMinions
	})
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

export function getLocalServiceEnabledTelegraf(pMinionId) {
	const params = {
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
	return apiRequest('POST', '/', params)

	// const dParams = {
	//   username: 'salt',
	//   password: 'salt',
	//   eauth: 'pam',
	// }

	// Object.assign(dParams, params)

	// const url = 'http://192.168.56.105:8000/run' + '/'
	// const headers = {
	//   Accept: 'application/json',
	//   'Content-type': 'application/json',
	// }

	// const param = JSON.stringify(dParams)

	// console.log(JSON.stringify(dParams))

	// return axios({
	//   method: 'POST',
	//   url: url,
	//   headers: headers,
	//   data: param,
	// })
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
	// const dParams = {
	//   username: 'salt',
	//   password: 'salt',
	//   eauth: 'pam',
	// }

	// Object.assign(dParams, params)

	// const url = 'http://192.168.56.105:8000/run' + '/'
	// const headers = {
	//   Accept: 'application/json',
	//   'Content-type': 'application/json',
	// }

	// const param = JSON.stringify(dParams)

	// console.log(JSON.stringify(dParams))

	// return axios({
	//   method: 'POST',
	//   url: url,
	//   headers: headers,
	//   data: param,
	// })
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

export function runLocalServiceReStartTelegraf(pMinionId) {
	const params = {
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

export function getLocalFileRead(pMinionId) {
	const params = {
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
	return apiRequest('POST', '/', params)
}

export function getLocalFileWrite(pMinionId, pScript) {
	const params = {
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
	return apiRequest('POST', '/', params)
}

export function getLocalServiceGetRunning(pMinionId) {
	const params = {
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
	return apiRequest('POST', '/', params)
}

export function getRunnerSaltCmdTelegraf(pMeasurements) {
	const params = {
		client: 'runner',
		fun: 'salt.cmd',
		kwarg: {
			fun: 'cmd.run',
			cmd: 'telegraf --usage ' + pMeasurements,
		},
	}

	return apiRequest('POST', '/', params)
}
