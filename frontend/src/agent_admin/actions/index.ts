import {Dispatch} from 'redux'
import {AxiosResponse} from 'axios'
import yaml from 'js-yaml'
import {errorThrown} from 'src/shared/actions/errors'

// Types
import {MinionsObject} from 'src/agent_admin/type'
import {Source} from 'src/types'

// APIs
import {
  getMinionKeyListAllAdmin,
  // getMinionKeyListAll,
  // getMinionsIP,
  // getMinionsOS,
} from 'src/agent_admin/apis'

// SaltStack
import {
  getLocalGrainsItem,
  runAcceptKey,
  runRejectKey,
  runDeleteKey,
  runLocalServiceStartTelegraf,
  runLocalServiceStopTelegraf,
  runLocalPkgInstallTelegraf,
  runLocalGroupAdduser,
  getLocalFileRead,
  getLocalFileWrite,
  runLocalServiceReStartTelegraf,
  runLocalServiceTestTelegraf,
  getLocalServiceGetRunning,
  getRunnerSaltCmdTelegraf,
  getRunnerSaltCmdDirectory,
  getRunnerSaltCmdTelegrafPlugin,
  getLocalSaltCmdDirectory,
} from 'src/shared/apis/saltStack'

export enum ActionType {
  MinionKeyListAllAdmin = 'GET_MINION_KEY_LIST_ALL_ADMIN',
  MinionKeyListAll = 'GET_MINION_KEY_LIST_ALL',
  MinionsIP = 'GET_MINION_IP',
  MinionsOS = 'GET_MINION_OS',
  LocalGrainsItem = 'LOCAL_GRAINS_ITEM',
  RunAcceptKey = 'RUN_ACCEEPT_KEY',
  RunRejectKey = 'RUN_REJECT_KEY',
  RunDeleteKey = 'RUN_DELETE_KEY',
  // --
  RunLocalServiceStartTelegraf = 'RUN_LOCAL_SERVICE_START_TELEGRAF',
  RunLocalServiceStopTelegraf = 'RUN_LOCAL_SERVICE_STOP_TELEGRAF',
  RunLocalPkgInstallTelegraf = 'RUN_LOCAL_PKG_INSTALL_TELEGRAF',
  RunLocalGroupAdduser = 'RUN_LOCAL_GROUP_ADD_USER',
  GetLocalFileRead = 'GET_LOCAL_FILE_READ',
  GetLocalFileWrite = 'GET_LOCAL_FILE_WRITE',
  RunLocalServiceReStartTelegraf = 'RUN_LOCAL_SERVICE_RESTART_TELEGRAF',
  RunLocalServiceTestTelegraf = 'RUN_LOCAL_SERVICE_TEST_TELEGRAF',
  GetLocalServiceGetRunning = 'GET_LOCAL_SERVICE_GET_RUNNING',
  GetRunnerSaltCmdTelegraf = 'GET_RUNNER_SALT_CMD_TELEGRAF',
  GetRunnerSaltCmdDirectory = 'GET_RUNNER_SALT_CMD_DIRECTORY',
  GetRunnerSaltCmdTelegrafPlugin = 'GET_RUNNER_SALT_CMD_TELEGRAF_PLUGIN',
  GetLocalSaltCmdDirectory = 'GET_LOCAL_SALT_CMD_DIRECTORY',
}

interface MinionKeyListAllAdminAction {
  type: ActionType.MinionKeyListAllAdmin
}

interface MinionKeyListAllAction {
  type: ActionType.MinionKeyListAll
}

interface MinionIPAction {
  type: ActionType.MinionsIP
}

interface MinionOSAction {
  type: ActionType.MinionsOS
}

interface LocalGrainsItemAction {
  type: ActionType.LocalGrainsItem
}

interface RunAcceptKeyAction {
  type: ActionType.RunAcceptKey
}

interface RunRejectKeyAction {
  type: ActionType.RunRejectKey
}

interface RunDeleteKeyAction {
  type: ActionType.RunDeleteKey
}

interface RunLocalServiceStartTelegrafAction {
  type: ActionType.RunLocalServiceStartTelegraf
}
interface RunLocalServiceStopTelegrafAction {
  type: ActionType.RunLocalServiceStopTelegraf
}
interface RunLocalPkgInstallTelegrafAction {
  type: ActionType.RunLocalPkgInstallTelegraf
}
interface RunLocalGroupAdduserAction {
  type: ActionType.RunLocalGroupAdduser
}
interface GetLocalFileReadAction {
  type: ActionType.GetLocalFileRead
}
interface GetLocalFileWriteAction {
  type: ActionType.GetLocalFileWrite
}
interface RunLocalServiceReStartTelegrafAction {
  type: ActionType.RunLocalServiceReStartTelegraf
}
interface RunLocalServiceTestTelegrafAction {
  type: ActionType.RunLocalServiceTestTelegraf
}
interface GetLocalServiceGetRunningAction {
  type: ActionType.GetLocalServiceGetRunning
}
interface GetRunnerSaltCmdTelegrafAction {
  type: ActionType.GetRunnerSaltCmdTelegraf
}
interface GetRunnerSaltCmdDirectoryAction {
  type: ActionType.GetRunnerSaltCmdDirectory
}
interface GetRunnerSaltCmdTelegrafPluginAction {
  type: ActionType.GetRunnerSaltCmdTelegrafPlugin
}

interface GetLocalSaltCmdDirectoryAction {
  type: ActionType.GetLocalSaltCmdDirectory
}

export type Action =
  | MinionKeyListAllAdminAction
  | MinionKeyListAllAction
  | MinionIPAction
  | MinionOSAction
  | LocalGrainsItemAction
  | RunAcceptKeyAction
  | RunRejectKeyAction
  | RunDeleteKeyAction
  // --
  | RunLocalServiceStartTelegrafAction
  | RunLocalServiceStopTelegrafAction
  | RunLocalPkgInstallTelegrafAction
  | RunLocalGroupAdduserAction
  | GetLocalFileReadAction
  | GetLocalFileWriteAction
  | RunLocalServiceReStartTelegrafAction
  | RunLocalServiceTestTelegrafAction
  | GetLocalServiceGetRunningAction
  | GetRunnerSaltCmdTelegrafAction
  | GetRunnerSaltCmdDirectoryAction
  | GetRunnerSaltCmdTelegrafPluginAction
  | GetLocalSaltCmdDirectoryAction

export const loadMinionKeyListAllAdmin = (): MinionKeyListAllAdminAction => ({
  type: ActionType.MinionKeyListAllAdmin,
})

export const loadMinionKeyListAll = (): MinionKeyListAllAction => ({
  type: ActionType.MinionKeyListAll,
})

export const loadMinionIP = (): MinionIPAction => ({
  type: ActionType.MinionsIP,
})

export const loadMinionOS = (): MinionOSAction => ({
  type: ActionType.MinionsOS,
})

export const loadLocalGrainsItem = (): LocalGrainsItemAction => ({
  type: ActionType.LocalGrainsItem,
})

export const cmdRunAcceptKey = (): RunAcceptKeyAction => ({
  type: ActionType.RunAcceptKey,
})

export const cmdRunRejectKey = (): RunRejectKeyAction => ({
  type: ActionType.RunRejectKey,
})

export const cmdRunDeleteKey = (): RunDeleteKeyAction => ({
  type: ActionType.RunDeleteKey,
})

export const cmdRunLocalServiceStartTelegraf = (): RunLocalServiceStartTelegrafAction => ({
  type: ActionType.RunLocalServiceStartTelegraf,
})

export const cmdRunLocalServiceStopTelegraf = (): RunLocalServiceStopTelegrafAction => ({
  type: ActionType.RunLocalServiceStopTelegraf,
})

export const cmdRunLocalPkgInstallTelegraf = (): RunLocalPkgInstallTelegrafAction => ({
  type: ActionType.RunLocalPkgInstallTelegraf,
})

export const cmdRunLocalGroupAdduser = (): RunLocalGroupAdduserAction => ({
  type: ActionType.RunLocalGroupAdduser,
})

export const loadGetLocalFileRead = (): GetLocalFileReadAction => ({
  type: ActionType.GetLocalFileRead,
})

export const cmdGetLocalFileWrite = (): GetLocalFileWriteAction => ({
  type: ActionType.GetLocalFileWrite,
})

export const cmdRunLocalServiceReStartTelegraf = (): RunLocalServiceReStartTelegrafAction => ({
  type: ActionType.RunLocalServiceReStartTelegraf,
})

export const cmdRunLocalServiceTestTelegraf = (): RunLocalServiceTestTelegrafAction => ({
  type: ActionType.RunLocalServiceTestTelegraf,
})

export const cmdGetLocalServiceGetRunning = (): GetLocalServiceGetRunningAction => ({
  type: ActionType.GetLocalServiceGetRunning,
})

export const cmdGetRunnerSaltCmdTelegraf = (): GetRunnerSaltCmdTelegrafAction => ({
  type: ActionType.GetRunnerSaltCmdTelegraf,
})

export const loadGetRunnerSaltCmdDirectory = (): GetRunnerSaltCmdDirectoryAction => ({
  type: ActionType.GetRunnerSaltCmdDirectory,
})

export const loadGetRunnerSaltCmdTelegrafPlugin = (): GetRunnerSaltCmdTelegrafPluginAction => ({
  type: ActionType.GetRunnerSaltCmdTelegrafPlugin,
})

export const loadGetLocalSaltCmdDirectory = (): GetLocalSaltCmdDirectoryAction => ({
  type: ActionType.GetLocalSaltCmdDirectory,
})

export const getMinionKeyListAllAdminAsync = (
  pUrl: string,
  pToken: string,
  pSource: Source,
  meRole: string
) => async (dispatch: Dispatch<Action>): Promise<MinionsObject> => {
  try {
    const minions: MinionsObject = await getMinionKeyListAllAdmin(
      pUrl,
      pToken,
      pSource,
      meRole
    )

    dispatch(loadMinionKeyListAllAdmin())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalGrainsItemAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await getLocalGrainsItem(
      pUrl,
      pToken,
      pMinions
    )

    dispatch(loadLocalGrainsItem())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runAcceptKeyAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await runAcceptKey(pUrl, pToken, pMinions)

    dispatch(cmdRunAcceptKey())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runRejectKeyAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await runRejectKey(pUrl, pToken, pMinions)

    dispatch(cmdRunRejectKey())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runDeleteKeyAsync = (
  pUrl: string,
  pToken: string,
  pMinions: string
) => async (dispatch: Dispatch<Action>): Promise<AxiosResponse> => {
  try {
    const minions: AxiosResponse = await runDeleteKey(pUrl, pToken, pMinions)

    dispatch(cmdRunDeleteKey())
    return minions
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runLocalServiceStartTelegrafAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getLocalServiceStartTelegrafPromise = await runLocalServiceStartTelegraf(
      pUrl,
      pToken,
      pMinionId
    )
    dispatch(cmdRunLocalServiceStartTelegraf())
    return getLocalServiceStartTelegrafPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runLocalServiceStopTelegrafAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getLocalServiceStopTelegrafPromise = await runLocalServiceStopTelegraf(
      pUrl,
      pToken,
      pMinionId
    )
    dispatch(cmdRunLocalServiceStopTelegraf())
    return getLocalServiceStopTelegrafPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runLocalPkgInstallTelegrafAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pSelectCollector: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const runLocalPkgInstallTelegrafPromise = await runLocalPkgInstallTelegraf(
      pUrl,
      pToken,
      pMinionId,
      pSelectCollector
    )
    dispatch(cmdRunLocalPkgInstallTelegraf())
    return runLocalPkgInstallTelegrafPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runLocalGroupAdduserAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const runLocalGroupAdduserPromise = await runLocalGroupAdduser(
      pUrl,
      pToken,
      pMinionId
    )

    dispatch(cmdRunLocalGroupAdduser())
    return runLocalGroupAdduserPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalFileReadAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pDirPath?: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getLocalFileReadPromise = await getLocalFileRead(
      pUrl,
      pToken,
      pMinionId,
      pDirPath
    )
    dispatch(loadGetLocalFileRead())
    return getLocalFileReadPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalFileWriteAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pScript: string,
  pDirPath?: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getLocalFileWritePromise = await getLocalFileWrite(
      pUrl,
      pToken,
      pMinionId,
      pScript,
      pDirPath
    )
    dispatch(cmdGetLocalFileWrite())
    return getLocalFileWritePromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runLocalServiceReStartTelegrafAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const runLocalServiceReStartTelegrafPromise = await runLocalServiceReStartTelegraf(
      pUrl,
      pToken,
      pMinionId
    )
    dispatch(cmdRunLocalServiceReStartTelegraf())
    return runLocalServiceReStartTelegrafPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const runLocalServiceTestTelegrafAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pSelectedPlugin?: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const runLocalServiceTestTelegrafPromise = await runLocalServiceTestTelegraf(
      pUrl,
      pToken,
      pMinionId,
      pSelectedPlugin
    )

    dispatch(cmdRunLocalServiceTestTelegraf())
    return yaml.safeLoad(runLocalServiceTestTelegrafPromise.data)
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalServiceGetRunningAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getLocalServiceGetRunningPromise = await getLocalServiceGetRunning(
      pUrl,
      pToken,
      pMinionId
    )
    dispatch(cmdGetLocalServiceGetRunning())
    return getLocalServiceGetRunningPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getRunnerSaltCmdTelegrafAsync = (
  pUrl: string,
  pToken: string,
  pMeasurements: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getRunnerSaltCmdTelegrafPromise = await getRunnerSaltCmdTelegraf(
      pUrl,
      pToken,
      pMeasurements
    )
    dispatch(cmdGetRunnerSaltCmdTelegraf())
    return getRunnerSaltCmdTelegrafPromise
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getRunnerSaltCmdDirectoryAsync = (
  pUrl: string,
  pToken: string,
  pDirPath: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getDirectoryItems = await getRunnerSaltCmdDirectory(
      pUrl,
      pToken,
      pDirPath
    )

    dispatch(loadGetRunnerSaltCmdDirectory())

    return getDirectoryItems
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getLocalSaltCmdDirectoryAsync = (
  pUrl: string,
  pToken: string,
  pMinionId: string,
  pDirPath: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const getDirectoryItems = await getLocalSaltCmdDirectory(
      pUrl,
      pToken,
      pMinionId,
      pDirPath
    )

    dispatch(loadGetLocalSaltCmdDirectory())

    return getDirectoryItems
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}

export const getRunnerSaltCmdTelegrafPluginAsync = (
  pUrl: string,
  pToken: string
) => async (dispatch: Dispatch<Action>) => {
  try {
    const telegrafPlugin = await getRunnerSaltCmdTelegrafPlugin(pUrl, pToken)

    dispatch(loadGetRunnerSaltCmdTelegrafPlugin())
    return yaml.safeLoad(telegrafPlugin.data)
  } catch (error) {
    console.error(error)
    dispatch(errorThrown(error))
  }
}
