// Library
import React, {PureComponent, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import * as d3 from 'd3'
import yaml from 'js-yaml'

// Component
import KubernetesHeader from 'src/hosts/components/KubernetesHeader'
import KubernetesContents from 'src/hosts/components/KubernetesContents'
import {ComponentStatus} from 'src/reusable_ui'
import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

// Actions
import {getMinionKeyAcceptedListAsync} from 'src/hosts/actions'
import {
  getLocalK8sNamespacesAsync,
  getLocalK8sNodesAsync,
  getLocalK8sPodsAsync,
  getLocalK8sDeploymentsAsync,
  getLocalK8sReplicaSetsAsync,
  getLocalK8sReplicationControllersAsync,
  getLocalK8sDaemonSetsAsync,
  getLocalK8sStatefulSetsAsync,
  getLocalK8sJobsAsync,
  getLocalK8sCronJobsAsync,
  getLocalK8sServicesAsync,
  getLocalK8sIngressesAsync,
  getLocalK8sConfigmapsAsync,
  getLocalK8sSecretsAsync,
  getLocalK8sServiceAccountsAsync,
  getLocalK8sClusterRolesAsync,
  getLocalK8sClusterRoleBindingsAsync,
  getLocalK8sRolesAsync,
  getLocalK8sRoleBindingsAsync,
  getLocalK8sPersistentVolumesAsync,
  getLocalK8sPersistentVolumeClaimsAsync,
  getLocalK8sDetailAsync,
} from 'src/hosts/actions/kubernetes'
import {notify as notifyAction} from 'src/shared/actions/notifications'

//Middleware
import {
  getLocalStorage,
  setLocalStorage,
  verifyLocalStorage,
} from 'src/shared/middleware/localStorage'

// Constatns
import {EMPTY_LINKS} from 'src/dashboards/constants/dashboardHeader'
import {kubernetesStatusColor} from 'src/hosts/constants/color'
import {k8sNodeTypeAttrs} from 'src/hosts/constants/kubernetes'

// API
import {
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'
import {getCpuAndLoadForK8s} from 'src/hosts/apis'

// Types
import {Addon} from 'src/types/auth'
import {Source, Layout, TimeRange, Links, RemoteDataState} from 'src/types'
import {DashboardSwitcherLinks} from 'src/types/dashboards'
import {
  TooltipNode,
  TooltipPosition,
  FocuseNode,
  KubernetesProps,
  D3K8sData,
  D3DataDepth1,
  D3DataDepth2,
  D3DataDepth3,
  KubernetesObject,
} from 'src/hosts/types'
import {AddonType} from 'src/shared/constants'
import {SaltStack} from 'src/types/saltstack'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {getCells} from 'src/hosts/utils/getCells'
import {transMemoryToBytes, transToCPUMillCore} from 'src/hosts/utils/transUnit'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Error
import {ErrorHandling} from 'src/shared/decorators/errors'

interface Props extends KubernetesProps {
  source: Source
  addons: Addon[]
  notify: NotificationAction
  manualRefresh: number
  timeRange: TimeRange
  autoRefresh: number
  links: Links
  meRole: string
}

interface State {
  proportions: number[]
  activeEditorTab: string
  script: string
  labelKey: string
  labelValue: string
  selectedNamespace: string
  selectedNode: string
  selectedLimit: string
  filterLabelKey: string
  filterLabelValue: string
  filterNamespace: string
  filterNode: string
  filterLimit: string
  namespaces: string[]
  nodes: string[]
  limits: string[]
  focuseNode: FocuseNode
  pinNode: string[]
  isToolipActive: boolean
  targetPosition: TooltipPosition
  tooltipNode: TooltipNode
  minions: string[]
  selectMinion: string
  selectedAutoRefresh: AutoRefreshOption['milliseconds']
  isOpenMinions: boolean
  isDisabledMinions: boolean
  layouts: Layout[]
  hostLinks: DashboardSwitcherLinks
  kubernetesData: object
  kubernetesD3Data: D3K8sData
  kubernetesObject: KubernetesObject
  remoteDataState: RemoteDataState
}

@ErrorHandling
class KubernetesPage extends PureComponent<Props, State> {
  private height = 40
  private getKubernetesObjectInterval: NodeJS.Timer = null
  private getKubernetesResourceInterval: NodeJS.Timer = null
  private noSelect: string = 'no select'
  private defaultState = {
    proportions: [0.75, 0.25],
    selectMinion: this.noSelect,
    selectedAutoRefresh: 0,
  }

  constructor(props: Props) {
    super(props)

    this.state = {
      ...this.defaultState,

      activeEditorTab: 'Detail',
      script: '',
      selectedNamespace: 'All namespaces',
      selectedNode: 'All nodes',
      selectedLimit: 'Unlimited',
      labelKey: '',
      labelValue: '',
      namespaces: [],
      nodes: [],
      limits: ['Unlimited', '20', '50', '100'],
      filterLabelKey: '',
      filterLabelValue: '',
      filterNamespace: '',
      filterNode: '',
      filterLimit: '',
      focuseNode: {name: null, label: null, type: null},
      pinNode: [],
      isToolipActive: false,
      targetPosition: {
        top: null,
        right: null,
        left: null,
        width: null,
      },
      tooltipNode: {
        name: null,
        cpu: null,
        memory: null,
      },
      minions: [],
      isOpenMinions: false,
      isDisabledMinions: false,
      kubernetesD3Data: {name: null, children: []},
      layouts: [],
      hostLinks: EMPTY_LINKS,
      kubernetesData: null,
      kubernetesObject: null,
      remoteDataState: RemoteDataState.NotStarted,
    }
  }

  public getNodes = async (detail: boolean = true) => {
    const {selectMinion} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail}}

    const target =
      !selectMinion || selectMinion === this.noSelect ? '*' : selectMinion

    const nodes = await this.props.handleGetNodes(
      saltMasterUrl,
      saltMasterToken,
      target,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(nodes.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getPods = async (node: string) => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        fieldselector: `spec.nodeName=${node}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',

        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const pods = await this.props.handleGetPods(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(pods.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getDeployments = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const deployments = await this.props.handleGetDeployments(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(deployments.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getReplicaSets = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const replicaSets = await this.props.handleGetReplicaSets(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(replicaSets.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getReplicationControllers = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const replicationControllers = await this.props.handleGetReplicationControllers(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(replicationControllers.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getDaemonSets = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const daemonSets = await this.props.handleGetDaemonSets(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(daemonSets.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getStatefulSets = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const statefulSets = await this.props.handleGetStatefulSets(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(statefulSets.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getCronJobs = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const cronJobs = await this.props.handleGetCronJobs(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(cronJobs.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getJobs = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const jobs = await this.props.handleGetJobs(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(jobs.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getServices = async flag => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    if (flag) {
      const services = await this.props.handleGetServices(
        saltMasterUrl,
        saltMasterToken,
        selectMinion,
        pParam
      )

      const resultJson = JSON.parse(
        JSON.stringify(
          _.values(yaml.safeLoad(services.data).return[0])[0],
          this.jsonRemoveNull
        )
      )
      return resultJson
    } else {
      return null
    }
  }

  public getIngresses = async flag => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    if (flag) {
      const ingresses = await this.props.handleGetIngresses(
        saltMasterUrl,
        saltMasterToken,
        selectMinion,
        pParam
      )

      const resultJson = JSON.parse(
        JSON.stringify(
          _.values(yaml.safeLoad(ingresses.data).return[0])[0],
          this.jsonRemoveNull
        )
      )

      return resultJson
    } else {
      return null
    }
  }

  public getConfigmaps = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const configmaps = await this.props.handleGetConfigmaps(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(configmaps.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getSecrets = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const secrets = await this.props.handleGetSecrets(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(secrets.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getServiceAccounts = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const serviceAccounts = await this.props.handleGetServiceAccounts(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(serviceAccounts.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getClusterRoles = async () => {
    const {
      selectMinion,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const clusterRoles = await this.props.handleGetClusterRoles(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(clusterRoles.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getClusterRoleBindings = async () => {
    const {
      selectMinion,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const clusterRoleBindings = await this.props.handleGetClusterRoleBindings(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(clusterRoleBindings.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getRoles = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const roles = await this.props.handleGetRoles(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(roles.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getRoleBindings = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const roleBindings = await this.props.handleGetRoleBindings(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(roleBindings.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getPersistentVolumes = async () => {
    const {
      selectMinion,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const persistentVolumes = await this.props.handleGetPersistentVolumes(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(persistentVolumes.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getPersistentVolumeClaims = async () => {
    const {
      selectMinion,
      filterNamespace,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        namespace: `${filterNamespace}`,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit: filterLimit !== '' ? parseInt(filterLimit) : 100,
        detail: true,
      },
    }

    const persistentVolumeClaims = await this.props.handleGetPersistentVolumeClaims(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(persistentVolumeClaims.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public jsonRemoveNull = (key: string, value: any) => {
    if (value !== null && key !== 'managed_fields' && key !== 'annotations')
      return value
  }

  public parentNavigation = d => {
    const {kubernetesData} = this.state
    const findData = []

    findData.push(d.data.name)

    if (_.get(kubernetesData, d.data.owner)) {
      if (d.parent.data.type === 'Ingress') {
        const spec = _.get(kubernetesData, d.data.owner)
        if (_.get(spec, 'rules')) {
          const objKind = _.get(d, 'parent.parent.data.type')
          const objLabel = _.get(d, 'parent.parent.data.label')
          _.map(_.get(spec, 'rules'), rule => {
            _.map(_.get(rule, 'http.paths'), service => {
              findData.push(
                `${objKind}_${objLabel}_Service_${_.get(
                  service,
                  'backend.service_name'
                )}`
              )
            })
          })
        }
      } else {
        const owner = _.get(kubernetesData, d.data.owner)
        _.map(owner, owner => {
          if (owner['kind'] !== d.parent.data.type) {
            const objKind = _.get(d, 'parent.parent.data.type')
            const objLabel = _.get(d, 'parent.parent.data.label')
            findData.push(
              `${objKind}_${objLabel}_${owner['kind']}_${owner['name']}`
            )
            if (
              _.get(
                kubernetesData,
                `${objKind}.${objLabel}.${owner['kind']}.${owner['name']}.metadata.owner_references`
              )
            ) {
              const parentOwner = _.get(
                kubernetesData,
                `${objKind}.${objLabel}.${owner['kind']}.${owner['name']}.metadata.owner_references`
              )
              _.map(parentOwner, parentOwner => {
                if (parentOwner['kind'] !== d.parent.data.type) {
                  findData.push(
                    `${objKind}_${objLabel}_${parentOwner['kind']}_${parentOwner['name']}`
                  )
                }
              })
            }
          }
        })
      }
    }

    if (_.get(d, 'data.child')) {
      if (_.get(kubernetesData, _.get(d, 'data.child'))) {
        const pod = _.get(kubernetesData, _.get(d, 'data.child'))
        _.map(pod, pod => {
          if (_.get(d, 'parent')) {
            if (_.get(d, 'parent.parent')) {
              const objKind = _.get(d, 'parent.parent.data.type')
              const objLabel = _.get(d, 'parent.parent.data.label')

              if (_.get(d, 'parent.data.type') === 'Service') {
                _.map(
                  _.get(kubernetesData, `${objKind}.${objLabel}.Ingress`),
                  ingress => {
                    _.map(_.get(ingress.spec, 'rules'), rule => {
                      _.map(_.get(rule, 'http.paths'), service => {
                        if (
                          _.get(service, 'backend.service_name') ===
                          _.get(d, 'data.label')
                        ) {
                          findData.push(
                            `${objKind}_${objLabel}_Ingress_${_.get(
                              ingress,
                              'metadata.name'
                            )}`
                          )
                        }
                      })
                    })
                  }
                )
              } else {
                _.map(
                  _.get(
                    kubernetesData,
                    `${objKind}.${objLabel}.Node.${pod['node_name']}.Pod.${pod['name']}.metadata.owner_references`
                  ),
                  owner => {
                    findData.push(
                      `${objKind}_${objLabel}_${owner['kind']}_${owner['name']}`
                    )
                  }
                )
              }

              findData.push(
                `${objKind}_${objLabel}_${pod['node_name']}_${pod['name']}`
              )
            }
          }
        })
      }
    }

    const relation = _.map(_.unionBy(findData), (name: string): string =>
      name.replace(/\:/g, '\\:').replace(/\./g, '\\.')
    )

    return relation
  }

  public getMinionKeyAcceptedList = async () => {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    try {
      const minions = await this.props.handleGetMinionKeyAcceptedList(
        saltMasterUrl,
        saltMasterToken
      )

      return minions
    } catch (error) {
      return []
    }
  }

  public getNamespaces = async () => {
    const {selectMinion} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {namespace: '', detail: true},
    }

    const namespaces = await this.props.handleGetNamespaces(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(namespaces.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    return resultJson
  }

  public getK8sObject = async () => {
    this.setState({remoteDataState: RemoteDataState.Loading})

    const info = await Promise.all([
      this.getNamespaces(),
      this.getNodes(),
      this.getServices(true),
      this.getIngresses(true),
      this.getConfigmaps(),
      this.getSecrets(),
      this.getServiceAccounts(),
      this.getClusterRoles(),
      this.getClusterRoleBindings(),
      this.getRoles(),
      this.getRoleBindings(),
      this.getPersistentVolumes(),
      this.getPersistentVolumeClaims(),
    ])

    if (typeof info[0] !== 'object') {
      this.setState({remoteDataState: RemoteDataState.Error})
      return
    }

    let kubernetesData = {}
    const kubernetesD3Data: D3K8sData = {name: 'k8s', children: []}
    const d3Namespaces = {}

    const namespaces = _.reduce(
      !_.isEmpty(this.state.filterNamespace)
        ? _.filter(
            info[0],
            namespace =>
              namespace['metadata']['name'] === this.state.filterNamespace
          )
        : info[0],
      (namespaces: object, namespace) => {
        const namespaceName = _.get(namespace, 'metadata.name')
        namespaces[namespaceName] = {
          metadata: _.get(namespace, 'metadata'),
          spec: _.get(namespace, 'spec'),
          status: _.get(namespace, 'status'),
        }

        d3Namespaces[namespaceName] = {
          name: `Namespace_${namespaceName}`,
          label: namespaceName,
          type: 'Namespace',
          value: 50,
          children: [],
        }

        return namespaces
      },
      {}
    )

    const allNamespaces = _.map(info[0], namespace =>
      _.get(namespace, 'metadata.name')
    )

    _.map(info[2], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const serviceName = _.get(m, 'metadata.name')
      if (
        info[2] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'Service')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          Service: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_Service`,
          label: 'Service',
          type: 'Service',
          children: [],
        }

        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['Service'][serviceName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_Service_${serviceName}`,
        label: serviceName,
        type: 'SVC',
        namespace: `${namespaceName}`,
        value: 10,
      }
      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_Service`,
        })
      ].children.push(d3DataDepth3)
    })

    _.map(info[3], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const ingressName = _.get(m, 'metadata.name')
      if (
        info[3] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'Ingress')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          Ingress: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_Ingress`,
          label: 'Ingress',
          type: 'Ingress',
          children: [],
        }

        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['Ingress'][ingressName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_Ingress_${ingressName}`,
        label: ingressName,
        type: 'IGS',
        namespace: `${namespaceName}`,
        value: 10,
      }

      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_Ingress`,
        })
      ].children.push(d3DataDepth3)
    })

    _.map(info[4], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const configmapName = _.get(m, 'metadata.name')
      if (
        info[4] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'Configmap')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          Configmap: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_Configmap`,
          label: 'Configmap',
          type: 'Configmap',
          children: [],
        }

        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['Configmap'][configmapName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_Configmap_${configmapName}`,
        label: configmapName,
        type: 'CM',
        namespace: `${namespaceName}`,
        value: 10,
      }

      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_Configmap`,
        })
      ].children.push(d3DataDepth3)
    })

    _.map(info[5], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const secretName = _.get(m, 'metadata.name')
      if (
        info[5] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'Secret')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          Secret: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_Secret`,
          label: 'Secret',
          type: 'Secret',
          children: [],
        }

        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['Secret'][secretName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_Secret_${secretName}`,
        label: secretName,
        type: 'SR',
        namespace: `${namespaceName}`,
        value: 10,
      }

      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_Secret`,
        })
      ].children.push(d3DataDepth3)
    })

    _.map(info[6], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const serviceAccountName = _.get(m, 'metadata.name')
      if (
        info[6] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'ServiceAccount')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          ServiceAccount: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_ServiceAccount`,
          label: 'ServiceAccount',
          type: 'ServiceAccount',
          children: [],
        }
        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['ServiceAccount'][serviceAccountName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_ServiceAccount_${serviceAccountName}`,
        label: serviceAccountName,
        type: 'SA',
        namespace: `${namespaceName}`,
        value: 10,
      }

      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_ServiceAccount`,
        })
      ].children.push(d3DataDepth3)
    })

    _.map(info[7], m => {
      const clusterRoleName = _.get(m, 'metadata.name')
      if (
        info[7] !== null &&
        !_.includes(_.keys(kubernetesData), 'ClusterRole')
      ) {
        kubernetesData = {
          ...kubernetesData,
          ClusterRole: {},
        }

        const d3DataDepth1: D3DataDepth1 = {
          name: 'ClusterRole',
          label: 'ClusterRole',
          type: 'ClusterRole',
          children: [],
        }

        kubernetesD3Data.children.push(d3DataDepth1)
      }

      kubernetesData['ClusterRole'][clusterRoleName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth2: D3DataDepth2 = {
        name: `ClusterRole_${clusterRoleName}`,
        label: clusterRoleName,
        type: 'CR',
        value: 10,
      }

      kubernetesD3Data.children[
        _.findIndex(kubernetesD3Data.children, {
          name: 'ClusterRole',
        })
      ].children.push(d3DataDepth2)
    })

    _.map(info[8], m => {
      const clusterRoleBindingName = _.get(m, 'metadata.name')
      if (
        info[8] !== null &&
        !_.includes(_.keys(kubernetesData), 'ClusterRoleBinding')
      ) {
        kubernetesData = {
          ...kubernetesData,
          ClusterRoleBinding: {},
        }

        const d3DataDepth1: D3DataDepth1 = {
          name: 'ClusterRoleBinding',
          label: 'ClusterRoleBinding',
          type: 'ClusterRoleBinding',
          children: [],
        }

        kubernetesD3Data.children.push(d3DataDepth1)
      }

      kubernetesData['ClusterRoleBinding'][clusterRoleBindingName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth2: D3DataDepth2 = {
        name: `ClusterRoleBinding_${clusterRoleBindingName}`,
        label: clusterRoleBindingName,
        type: 'CRB',
        value: 10,
      }

      kubernetesD3Data.children[
        _.findIndex(kubernetesD3Data.children, {
          name: 'ClusterRoleBinding',
        })
      ].children.push(d3DataDepth2)
    })

    _.map(info[9], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const roleName = _.get(m, 'metadata.name')
      if (
        info[9] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'Role')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          Role: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_Role`,
          label: 'Role',
          type: 'Role',
          children: [],
        }
        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['Role'][roleName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_Role_${roleName}`,
        label: roleName,
        type: 'RL',
        namespace: `${namespaceName}`,
        value: 10,
      }
      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_Role`,
        })
      ].children.push(d3DataDepth3)
    })

    _.map(info[10], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const roleBindingName = _.get(m, 'metadata.name')
      if (
        info[10] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'RoleBinding')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          RoleBinding: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_RoleBinding`,
          label: 'RoleBinding',
          type: 'RoleBinding',
          children: [],
        }

        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['RoleBinding'][roleBindingName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_RoleBinding_${roleBindingName}`,
        label: roleBindingName,
        type: 'RB',
        namespace: `${namespaceName}`,
        value: 10,
      }

      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_RoleBinding`,
        })
      ].children.push(d3DataDepth3)
    })

    _.map(info[11], m => {
      const persistentVolumeName = _.get(m, 'metadata.name')
      if (
        info[11] !== null &&
        !_.includes(_.keys(kubernetesData), 'PersistentVolume')
      ) {
        kubernetesData = {
          ...kubernetesData,
          PersistentVolume: {},
        }

        const d3DataDepth1: D3DataDepth1 = {
          name: 'PersistentVolume',
          label: 'PersistentVolume',
          type: 'PersistentVolume',
          children: [],
        }

        kubernetesD3Data.children.push(d3DataDepth1)
      }

      kubernetesData['PersistentVolume'][persistentVolumeName] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth2: D3DataDepth2 = {
        name: `PersistentVolume_${persistentVolumeName}`,
        label: persistentVolumeName,
        type: 'PV',
        value: 10,
      }

      kubernetesD3Data.children[
        _.findIndex(kubernetesD3Data.children, {
          name: 'PersistentVolume',
        })
      ].children.push(d3DataDepth2)
    })

    _.map(info[12], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const persistentVolumeClaimName = _.get(m, 'metadata.name')
      if (
        info[12] !== null &&
        !_.includes(_.keys(namespaces[namespaceName]), 'PersistentVolumeClaim')
      ) {
        namespaces[namespaceName] = {
          ...namespaces[namespaceName],
          PersistentVolumeClaim: {},
        }

        const d3DataDepth2: D3DataDepth2 = {
          name: `Namespace_${namespaceName}_PersistentVolumeClaim`,
          label: 'PersistentVolumeClaim',
          type: 'PersistentVolumeClaim',
          children: [],
        }

        d3Namespaces[namespaceName].children.push(d3DataDepth2)
      }

      namespaces[namespaceName]['PersistentVolumeClaim'][
        persistentVolumeClaimName
      ] = {
        metadata: _.get(m, 'metadata'),
        spec: _.get(m, 'spec'),
        status: _.get(m, 'status'),
      }

      const d3DataDepth3: D3DataDepth3 = {
        name: `Namespace_${namespaceName}_PersistentVolumeClaim_${persistentVolumeClaimName}`,
        label: persistentVolumeClaimName,
        type: 'PVC',
        namespace: `${namespaceName}`,
        value: 10,
      }

      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_PersistentVolumeClaim`,
        })
      ].children.push(d3DataDepth3)
    })

    const nodes = _.reduce(
      !_.isEmpty(this.state.filterNode)
        ? _.filter(
            info[1],
            node => node['metadata']['name'] === this.state.filterNode
          )
        : info[1],
      (nodes: object, node) => {
        nodes[_.get(node, 'metadata.name')] = {
          metadata: _.get(node, 'metadata'),
          spec: _.get(node, 'spec'),
          status: _.get(node, 'status'),
        }

        return nodes
      },
      {}
    )

    const allNodes = _.map(info[1], node => _.get(node, 'metadata.name'))

    const podsPromises = _.map(_.keys(nodes), this.getPods)
    const pods = await Promise.all(podsPromises)

    const etcObject = await Promise.all([
      this.getDeployments(),
      this.getReplicaSets(),
      this.getReplicationControllers(),
      this.getDaemonSets(),
      this.getStatefulSets(),
      this.getCronJobs(),
      this.getJobs(),
    ])

    const deployments = _.reduce(
      etcObject[0],
      (deployments: object, deployment) => {
        deployments[_.get(deployment, 'metadata.name')] = {
          metadata: _.get(deployment, 'metadata'),
          spec: _.get(deployment, 'spec'),
          status: _.get(deployment, 'status'),
        }

        return deployments
      },
      {}
    )

    const replicaSets = _.reduce(
      etcObject[1],
      (replicaSets: object, replicaSet) => {
        replicaSets[_.get(replicaSet, 'metadata.name')] = {
          metadata: _.get(replicaSet, 'metadata'),
          spec: _.get(replicaSet, 'spec'),
          status: _.get(replicaSet, 'status'),
        }

        return replicaSets
      },
      {}
    )

    const replicationControllers = _.reduce(
      etcObject[2],
      (replicationControllers: object, replicationController) => {
        replicationControllers[
          _.get(replicationController, 'metadata.name')
        ] = {
          metadata: _.get(replicationController, 'metadata'),
          spec: _.get(replicationController, 'spec'),
          status: _.get(replicationController, 'status'),
        }

        return replicationControllers
      },
      {}
    )

    const daemonSets = _.reduce(
      etcObject[3],
      (daemonSets: object, daemonSet) => {
        daemonSets[_.get(daemonSet, 'metadata.name')] = {
          metadata: _.get(daemonSet, 'metadata'),
          spec: _.get(daemonSet, 'spec'),
          status: _.get(daemonSet, 'status'),
        }

        return daemonSets
      },
      {}
    )

    const statefulSets = _.reduce(
      etcObject[4],
      (statefulSets: object, statefulSet) => {
        statefulSets[_.get(statefulSet, 'metadata.name')] = {
          metadata: _.get(statefulSet, 'metadata'),
          spec: _.get(statefulSet, 'spec'),
          status: _.get(statefulSet, 'status'),
        }

        return statefulSets
      },
      {}
    )

    const cronJobs = _.reduce(
      etcObject[5],
      (cronJobs: object, cronJob) => {
        cronJobs[_.get(cronJob, 'metadata.name')] = {
          metadata: _.get(cronJob, 'metadata'),
          spec: _.get(cronJob, 'spec'),
          status: _.get(cronJob, 'status'),
        }

        return cronJobs
      },
      {}
    )

    const jobs = _.reduce(
      etcObject[6],
      (jobs: object, job) => {
        jobs[_.get(job, 'metadata.name')] = {
          metadata: _.get(job, 'metadata'),
          spec: _.get(job, 'spec'),
          status: _.get(job, 'status'),
        }

        return jobs
      },
      {}
    )

    _.map(pods, pods => {
      _.map(pods, pod => {
        const namespace = _.get(pod, 'metadata.namespace')
        const ownerReferences = _.get(pod, 'metadata.owner_references')
        const podName = _.get(pod, 'metadata.name')
        const nodeName = _.get(pod, 'spec.node_name')
        const podContainers = _.get(pod, 'spec.containers')
        const podStatus = _.get(pod, 'status.phase')

        let podCPU = 0
        let podMemory = 0

        _.map(podContainers, podCont => {
          podCPU =
            podCPU +
            transToCPUMillCore(_.get(podCont, 'resources.limits.cpu'), 'pod')
          podMemory =
            podMemory +
            transMemoryToBytes(_.get(podCont, 'resources.limits.memory'))
        })

        if (!_.includes(_.keys(namespaces[namespace]), 'Node'))
          namespaces[namespace] = {
            ...namespaces[namespace],
            Node: {},
          }
        _.map(ownerReferences, po => {
          const ownerKind = _.get(po, 'kind')
          const ownerName = _.get(po, 'name')
          if (ownerKind === 'ReplicaSet') {
            if (
              replicaSets !== null &&
              !_.includes(_.keys(namespaces[namespace]), 'ReplicaSet')
            ) {
              namespaces[namespace] = {
                ...namespaces[namespace],
                ReplicaSet: {},
              }

              d3Namespaces[namespace].children.push({
                name: `Namespace_${namespace}_ReplicaSet`,
                label: 'ReplicaSet',
                type: 'ReplicaSet',
                children: [],
              })
            }
            if (
              !_.includes(
                _.keys(namespaces[namespace]['ReplicaSet']),
                ownerName
              )
            ) {
              namespaces[namespace]['ReplicaSet'][ownerName] = {
                metadata: replicaSets[ownerName].metadata,
                spec: replicaSets[ownerName].spec,
                status: replicaSets[ownerName].status,
                Pod: [],
              }
              namespaces[namespace]['ReplicaSet'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              d3Namespaces[namespace].children[
                _.findIndex(d3Namespaces[namespace].children, {
                  name: `Namespace_${namespace}_ReplicaSet`,
                })
              ].children.push({
                name: `Namespace_${namespace}_ReplicaSet_${ownerName}`,
                owner: `Namespace.${namespace}.ReplicaSet.${ownerName}.metadata.owner_references`,
                child: `Namespace.${namespace}.ReplicaSet.${ownerName}.Pod`,
                label: ownerName,
                type: 'RS',
                namespace: `${namespace}`,
                status:
                  _.get(replicaSets[ownerName], 'status.available_replicas') !==
                  _.get(replicaSets[ownerName], 'status.replicas')
                    ? 'Ready'
                    : 'Succeeded',
                value: 10,
              })

              _.map(
                _.get(replicaSets[ownerName], 'metadata.owner_references'),
                ro => {
                  const ownerName = _.get(ro, 'name')
                  if (
                    !_.includes(_.keys(namespaces[namespace]), 'Deployment')
                  ) {
                    namespaces[namespace] = {
                      ...namespaces[namespace],
                      Deployment: {},
                    }
                    d3Namespaces[namespace].children.push({
                      name: `Namespace_${namespace}_Deployment`,
                      label: 'Deployment',
                      type: 'Deployment',
                      children: [],
                    })
                  }
                  if (
                    !_.includes(
                      _.keys(namespaces[namespace]['Deployment']),
                      ownerName
                    )
                  ) {
                    namespaces[namespace]['Deployment'][ownerName] = {
                      metadata: _.get(deployments[ownerName], 'metadata'),
                      spec: _.get(deployments[ownerName], 'spec'),
                      status: _.get(deployments[ownerName], 'status'),
                      Pod: [],
                    }
                    namespaces[namespace]['Deployment'][ownerName]['Pod'].push({
                      name: podName,
                      node_name: nodeName,
                      namespaces: namespace,
                    })

                    d3Namespaces[namespace].children[
                      _.findIndex(d3Namespaces[namespace].children, {
                        name: `Namespace_${namespace}_Deployment`,
                      })
                    ].children.push({
                      name: `Namespace_${namespace}_Deployment_${ownerName}`,
                      label: ownerName,
                      child: `Namespace.${namespace}.Deployment.${ownerName}.Pod`,
                      type: 'DP',
                      namespace: `${namespace}`,
                      status:
                        _.get(
                          deployments[ownerName],
                          'status.available_replicas'
                        ) !== _.get(deployments[ownerName], 'status.replicas')
                          ? 'Ready'
                          : 'Succeeded',
                      value: 10,
                    })
                  } else {
                    namespaces[namespace]['Deployment'][ownerName]['Pod'].push({
                      name: podName,
                      node_name: nodeName,
                      namespaces: namespace,
                    })
                  }
                }
              )
            } else {
              namespaces[namespace]['ReplicaSet'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              _.map(
                _.get(replicaSets[ownerName], 'metadata.owner_references'),
                ro => {
                  const name = _.get(ro, 'name')
                  if (
                    !_.includes(_.keys(namespaces[namespace]), 'Deployment')
                  ) {
                    namespaces[namespace] = {
                      ...namespaces[namespace],
                      Deployment: {},
                    }

                    d3Namespaces[namespace].children.push({
                      name: `Namespace_${namespace}_Deployment`,
                      label: 'Deployment',
                      type: 'Deployment',
                      children: [],
                    })
                  }
                  if (
                    !_.includes(
                      _.keys(namespaces[namespace]['Deployment']),
                      name
                    )
                  ) {
                    namespaces[namespace]['Deployment'][name] = {
                      metadata: deployments[name].metadata,
                      spec: deployments[name].spec,
                      status: deployments[name].status,
                      Pod: [],
                    }
                    namespaces[namespace]['Deployment'][name]['Pod'].push({
                      name: podName,
                      node_name: nodeName,
                      namespaces: namespace,
                    })

                    d3Namespaces[namespace].children[
                      _.findIndex(d3Namespaces[namespace].children, {
                        name: `Namespace_${namespace}_Deployment`,
                      })
                    ].children.push({
                      name: `Namespace_${namespace}_Deployment_${name}`,
                      label: name,
                      child: `Namespace.${namespace}.Deployment.${name}.Pod`,
                      type: 'DP',
                      namespace: `${namespace}`,
                      status:
                        _.get(
                          deployments[ownerName],
                          'status.available_replicas'
                        ) !== _.get(deployments[ownerName], 'status.replicas')
                          ? 'Ready'
                          : 'Succeeded',
                      value: 10,
                    })
                  } else {
                    namespaces[namespace]['Deployment'][name]['Pod'].push({
                      name: podName,
                      node_name: nodeName,
                      namespaces: namespace,
                    })
                  }
                }
              )
            }
          } else if (ownerKind === 'ReplicationController') {
            if (
              replicationControllers !== null &&
              !_.includes(
                _.keys(namespaces[namespace]),
                'ReplicationController'
              )
            ) {
              namespaces[namespace] = {
                ...namespaces[namespace],
                ReplicationController: {},
              }

              d3Namespaces[namespace].children.push({
                name: `Namespace_${namespace}_ReplicationController`,
                label: 'ReplicationController',
                type: 'ReplicationController',
                children: [],
              })
            }
            if (
              !_.includes(
                _.keys(namespaces[namespace]['ReplicationController']),
                ownerName
              )
            ) {
              namespaces[namespace]['ReplicationController'][ownerName] = {
                metadata: _.get(replicationControllers[ownerName], 'metadata'),
                spec: _.get(replicationControllers[ownerName], 'spec'),
                status: _.get(replicationControllers[ownerName], 'status'),
                Pod: [],
              }
              namespaces[namespace]['ReplicationController'][ownerName][
                'Pod'
              ].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              d3Namespaces[namespace].children[
                _.findIndex(d3Namespaces[namespace].children, {
                  name: `Namespace_${namespace}_ReplicationController`,
                })
              ].children.push({
                name: `Namespace_${namespace}_ReplicationController_${ownerName}`,
                label: ownerName,
                type: 'RC',
                namespace: `${namespace}`,
                child: `Namespace.${namespace}.ReplicationController.${ownerName}.Pod`,
                status:
                  _.get(
                    replicationControllers[ownerName],
                    'status.available_replicas'
                  ) !==
                  _.get(replicationControllers[ownerName], 'status.replicas')
                    ? 'Ready'
                    : 'Succeeded',
                value: 10,
              })
            } else {
              namespaces[namespace]['ReplicationController'][ownerName][
                'Pod'
              ].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })
            }
          } else if (ownerKind === 'DaemonSet') {
            if (
              daemonSets !== null &&
              !_.includes(_.keys(namespaces[namespace]), 'DaemonSet')
            ) {
              namespaces[namespace] = {
                ...namespaces[namespace],
                DaemonSet: {},
              }

              d3Namespaces[namespace].children.push({
                name: `Namespace_${namespace}_DaemonSet`,
                label: 'DaemonSet',
                type: 'DaemonSet',
                children: [],
              })
            }
            if (
              !_.includes(_.keys(namespaces[namespace]['DaemonSet']), ownerName)
            ) {
              namespaces[namespace]['DaemonSet'][ownerName] = {
                metadata: _.get(daemonSets[ownerName], 'metadata'),
                spec: _.get(daemonSets[ownerName], 'spec'),
                status: _.get(daemonSets[ownerName], 'status'),
                Pod: [],
              }
              namespaces[namespace]['DaemonSet'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              d3Namespaces[namespace].children[
                _.findIndex(d3Namespaces[namespace].children, {
                  name: `Namespace_${namespace}_DaemonSet`,
                })
              ].children.push({
                name: `Namespace_${namespace}_DaemonSet_${ownerName}`,
                label: ownerName,
                type: 'DS',
                namespace: `${namespace}`,
                child: `Namespace.${namespace}.DaemonSet.${ownerName}.Pod`,
                status:
                  _.get(daemonSets[ownerName], 'status.numberUnavailable') &&
                  _.get(daemonSets[ownerName], 'status.numberUnavailable') > 0
                    ? 'Ready'
                    : 'Succeeded',
                value: 10,
              })
            } else {
              namespaces[namespace]['DaemonSet'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })
            }
          } else if (ownerKind === 'StatefulSet') {
            if (
              statefulSets !== null &&
              !_.includes(_.keys(namespaces[namespace]), 'StatefulSet')
            ) {
              namespaces[namespace] = {
                ...namespaces[namespace],
                StatefulSet: {},
              }

              d3Namespaces[namespace].children.push({
                name: `Namespace_${namespace}_StatefulSet`,
                label: 'StatefulSet',
                type: 'StatefulSet',
                children: [],
              })
            }
            if (
              !_.includes(
                _.keys(namespaces[namespace]['StatefulSet']),
                ownerName
              )
            ) {
              namespaces[namespace]['StatefulSet'][ownerName] = {
                metadata: _.get(statefulSets[ownerName], 'metadata'),
                spec: _.get(statefulSets[ownerName], 'spec'),
                status: _.get(statefulSets[ownerName], 'status'),
                Pod: [],
              }
              namespaces[namespace]['StatefulSet'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              d3Namespaces[namespace].children[
                _.findIndex(d3Namespaces[namespace].children, {
                  name: `Namespace_${namespace}_StatefulSet`,
                })
              ].children.push({
                name: `Namespace_${namespace}_StatefulSet_${ownerName}`,
                label: ownerName,
                type: 'SS',
                namespace: `${namespace}`,
                child: `Namespace.${namespace}.StatefulSet.${ownerName}.Pod`,
                status:
                  _.get(statefulSets[ownerName], 'status.replicas') !==
                  _.get(statefulSets[ownerName], 'status.currentReplicas')
                    ? 'Ready'
                    : 'Succeeded',
                value: 10,
              })
            } else {
              namespaces[namespace]['StatefulSet'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })
            }
          } else if (ownerKind === 'Job') {
            if (
              jobs !== null &&
              !_.includes(_.keys(namespaces[namespace]), 'Job')
            ) {
              namespaces[namespace] = {
                ...namespaces[namespace],
                Job: {},
              }

              d3Namespaces[namespace].children.push({
                name: `Namespace_${namespace}_Job`,
                label: 'Job',
                type: 'Job',
                children: [],
              })
            }
            if (!_.includes(_.keys(namespaces[namespace]['Job']), ownerName)) {
              namespaces[namespace]['Job'][ownerName] = {
                metadata: _.get(jobs[ownerName], 'metadata'),
                spec: _.get(jobs[ownerName], 'spec'),
                status: _.get(jobs[ownerName], 'status'),
                Pod: [],
              }
              namespaces[namespace]['Job'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              d3Namespaces[namespace].children[
                _.findIndex(d3Namespaces[namespace].children, {
                  name: `Namespace_${namespace}_Job`,
                })
              ].children.push({
                name: `Namespace_${namespace}_Job_${ownerName}`,
                label: ownerName,
                type: 'Job',
                namespace: `${namespace}`,
                owner: `Namespace.${namespace}.Job.${ownerName}.metadata.owner_references`,
                child: `Namespace.${namespace}.Job.${ownerName}.Pod`,
                status:
                  _.get(jobs[ownerName], 'status.failed') &&
                  _.get(jobs[ownerName], 'status.failed ') > 0
                    ? 'Ready'
                    : 'Succeeded',
                value: 10,
              })

              _.map(_.get(jobs[ownerName], 'metadata.owner_references'), ro => {
                const name = _.get(ro, 'name')
                if (!_.includes(_.keys(namespaces[namespace]), 'CronJob')) {
                  namespaces[namespace] = {
                    ...namespaces[namespace],
                    CronJob: {},
                  }

                  d3Namespaces[namespace].children.push({
                    name: `Namespace_${namespace}_CronJob`,
                    label: 'CronJob',
                    type: 'CronJob',
                    children: [],
                  })
                }
                if (
                  !_.includes(_.keys(namespaces[namespace]['CronJob']), name)
                ) {
                  namespaces[namespace]['CronJob'][name] = {
                    metadata: _.get(cronJobs[name], 'metadata'),
                    spec: _.get(cronJobs[name], 'spec'),
                    status: _.get(cronJobs[name], 'status'),
                    Pod: [],
                  }
                  namespaces[namespace]['CronJob'][name]['Pod'].push({
                    name: podName,
                    node_name: nodeName,
                    namespaces: namespace,
                  })

                  d3Namespaces[namespace].children[
                    _.findIndex(d3Namespaces[namespace].children, {
                      name: `Namespace_${namespace}_CronJob`,
                    })
                  ].children.push({
                    name: `Namespace_${namespace}_CronJob_${name}`,
                    label: name,
                    type: 'CJ',
                    namespace: `${namespace}`,
                    child: `Namespace.${namespace}.CronJob.${name}.Pod`,
                    status:
                      _.get(jobs[ownerName], 'status.failed') &&
                      _.get(jobs[ownerName], 'status.failed ') > 0
                        ? 'Ready'
                        : 'Succeeded',
                    value: 10,
                  })
                } else {
                  namespaces[namespace]['CronJob'][name]['Pod'].push({
                    name: podName,
                    node_name: nodeName,
                    namespaces: namespace,
                  })
                }
              })
            } else {
              namespaces[namespace]['Job'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              _.map(jobs[ownerName].metadata.owner_references, ro => {
                const name = _.get(ro, 'name')
                if (!_.includes(_.keys(namespaces[namespace]), 'CronJob')) {
                  namespaces[namespace] = {
                    ...namespaces[namespace],
                    CronJob: {},
                  }

                  d3Namespaces[namespace].children.push({
                    name: `Namespace_${namespace}_CronJob`,
                    label: 'CronJob',
                    type: 'CronJob',
                    children: [],
                  })
                }
                if (
                  !_.includes(_.keys(namespaces[namespace]['CronJob']), name)
                ) {
                  namespaces[namespace]['CronJob'][name] = {
                    metadata: _.get(cronJobs[name], 'metadata'),
                    spec: _.get(cronJobs[name], 'spec'),
                    status: _.get(cronJobs[name], 'status'),
                    Pod: [],
                  }
                  namespaces[namespace]['CronJob'][name]['Pod'].push({
                    name: podName,
                    node_name: nodeName,
                    namespaces: namespace,
                  })

                  d3Namespaces[namespace].children[
                    _.findIndex(d3Namespaces[namespace].children, {
                      name: `Namespace_${namespace}_CronJob`,
                    })
                  ].children.push({
                    name: `Namespace_${namespace}_CronJob_${name}`,
                    label: name,
                    type: 'CJ',
                    namespace: `${namespace}`,
                    child: `Namespace.${namespace}.CronJob.${name}.Pod`,
                    status:
                      _.get(jobs[ownerName], 'status.failed') &&
                      _.get(jobs[ownerName], 'status.failed ') > 0
                        ? 'Ready'
                        : 'Succeeded',
                    value: 10,
                  })
                } else {
                  namespaces[namespace]['CronJob'][name]['Pod'].push({
                    name: podName,
                    node_name: nodeName,
                  })
                }
              })
            }
          }
        })

        if (!_.includes(_.keys(namespaces[namespace]['Node']), nodeName)) {
          namespaces[namespace]['Node'][nodeName] = {
            metadata: _.get(nodes[nodeName], 'metadata'),
            spec: _.get(nodes[nodeName], 'spec'),
            status: _.get(nodes[nodeName], 'status'),
            Pod: {},
          }
          d3Namespaces[namespace].children.push({
            name: `Namespace_${namespace}_${nodeName}`,
            label: nodeName,
            type: 'Node',
            data: {
              cpu: `${transToCPUMillCore(
                _.get(nodes[nodeName], 'status.allocatable.cpu'),
                'node'
              )}`,
              memory: `${transMemoryToBytes(
                _.get(nodes[nodeName], 'status.allocatable.memory')
              )}`,
            },
            children: [],
          })
        }

        if (
          !_.includes(
            _.keys(namespaces[namespace]['Node'][nodeName]['Pod']),
            podName
          )
        ) {
          namespaces[namespace]['Node'][nodeName]['Pod'][podName] = {
            metadata: _.get(pod, 'metadata'),
            spec: _.get(pod, 'spec'),
            status: _.get(pod, 'status'),
          }

          d3Namespaces[namespace].children[
            _.findIndex(d3Namespaces[namespace].children, {
              name: `Namespace_${namespace}_${nodeName}`,
            })
          ].children.push({
            name: `Namespace_${namespace}_${nodeName}_${podName}`,
            label: podName,
            owner: `Namespace.${namespace}.Node.${nodeName}.Pod.${podName}.metadata.owner_references`,
            type: 'Pod',
            namespace: `${namespace}`,
            data: {
              cpu: `${
                podCPU !== 0
                  ? podCPU
                  : transToCPUMillCore(
                      _.get(nodes[nodeName], 'status.allocatable.cpu'),
                      'node'
                    )
              }`,
              memory: `${
                podMemory !== 0
                  ? podMemory
                  : transMemoryToBytes(
                      _.get(nodes[nodeName], 'status.allocatable.memory')
                    )
              }`,
            },
            time: new Date().getSeconds(),
            status: `${podStatus}`,
            value: 10,
          })
        }

        if (_.includes(_.keys(namespaces[namespace]), 'Service')) {
          const podService = _.values(_.get(pod, 'metadata.labels'))[0]
          const serviceInfo = _.filter(
            namespaces[namespace]['Service'],
            f => _.values(_.get(f.spec, 'selector'))[0] === podService
          )[0]

          if (serviceInfo !== undefined) {
            const serviceName = _.get(serviceInfo, 'metadata.name')
            if (
              !_.includes(
                _.keys(namespaces[namespace]['Service'][serviceName]),
                'Pod'
              )
            ) {
              namespaces[namespace]['Service'][serviceName] = {
                ...namespaces[namespace]['Service'][serviceName],
                Pod: [],
              }
              namespaces[namespace]['Service'][serviceName].Pod.push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })

              const serviceIndex = _.findIndex(
                d3Namespaces[namespace].children,
                {
                  name: `Namespace_${namespace}_Service`,
                }
              )

              const serviceChildrenIndex = _.findIndex(
                d3Namespaces[namespace].children[serviceIndex].children,
                {
                  name: `Namespace_${namespace}_Service_${serviceName}`,
                }
              )

              d3Namespaces[namespace].children[serviceIndex].children[
                serviceChildrenIndex
              ] = {
                ...d3Namespaces[namespace].children[serviceIndex].children[
                  serviceChildrenIndex
                ],
                child: `Namespace.${namespace}.Service.${serviceName}.Pod`,
              }
            } else {
              namespaces[namespace]['Service'][serviceName].Pod.push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
              })
            }

            if (_.includes(_.keys(namespaces[namespace]), 'Ingress')) {
              _.map(namespaces[namespace]['Ingress'], ingress => {
                const ingressName = _.get(ingress, 'metadata.name')
                _.map(_.get(ingress.spec, 'rules'), rule => {
                  _.map(_.get(rule, 'http.paths'), service => {
                    if (
                      _.get(service, 'backend.service_name') === serviceName
                    ) {
                      if (
                        !_.includes(
                          _.keys(namespaces[namespace]['Ingress'][ingressName]),
                          'Pod'
                        )
                      ) {
                        namespaces[namespace]['Ingress'][ingressName] = {
                          ...namespaces[namespace]['Ingress'][ingressName],
                          Pod: [],
                        }
                        namespaces[namespace]['Ingress'][ingressName].Pod.push({
                          name: podName,
                          node_name: nodeName,
                          namespaces: namespace,
                        })

                        const ingressIndex = _.findIndex(
                          d3Namespaces[namespace].children,
                          {
                            name: `Namespace_${namespace}_Ingress`,
                          }
                        )

                        const ingressChildrenIndex = _.findIndex(
                          d3Namespaces[namespace].children[ingressIndex]
                            .children,
                          {
                            name: `Namespace_${namespace}_Ingress_${ingressName}`,
                          }
                        )

                        d3Namespaces[namespace].children[ingressIndex].children[
                          ingressChildrenIndex
                        ] = {
                          ...d3Namespaces[namespace].children[ingressIndex]
                            .children[ingressChildrenIndex],
                          owner: `Namespace.${namespace}.Ingress.${ingressName}.spec`,
                          child: `Namespace.${namespace}.Ingress.${ingressName}.Pod`,
                        }
                      } else {
                        namespaces[namespace]['Ingress'][ingressName].Pod.push({
                          name: podName,
                          node_name: nodeName,
                          namespaces: namespace,
                        })
                      }
                    }
                  })
                })
              })
            }
          }
        }
      })
    })

    kubernetesData['Namespace'] = namespaces

    _.forEach(d3Namespaces, m => {
      kubernetesD3Data.children.push(m)
    })

    this.setState({
      kubernetesData,
      kubernetesD3Data,
      nodes: allNodes,
      namespaces: allNamespaces,
      remoteDataState: RemoteDataState.Done,
    })
  }

  public setD3K8sSeries() {
    const {kubernetesObject} = this.state
    const node = d3.select('svg').selectAll('g')

    if (!(node.data().length > 0)) return

    let d3NodeObject = {}
    _.forEach(node.select(`circle[data-type=${'Node'}]`).data(), s => {
      d3NodeObject[s.data.label] = {
        ...d3NodeObject[s.data.label],
        name: s.data.label,
        cpu: s.data.data.cpu,
        memory: s.data.data.memory,
      }
    })

    let d3PodObject = {}
    const pod = node.select(`path[data-type=${'Pod'}]`)
    _.forEach(pod.data(), s => {
      d3PodObject[s.data.label] = {
        ...d3PodObject[s.data.label],
        name: s.data.label,
        cpu: s.data.data.cpu,
        memory: s.data.data.memory,
      }
    })

    _.forEach(
      _.filter(
        d3NodeObject,
        f =>
          !_.map(
            _.filter(kubernetesObject, k8sObj => k8sObj['type'] === 'Node'),
            m => m['name']
          ).includes(f['name'])
      ),
      d3ModNod => {
        node.select(`circle[label=${d3ModNod['name']}]`).attr('fill', 'gray')
      }
    )

    _.forEach(
      _.filter(
        d3PodObject,
        f =>
          !_.map(
            _.filter(kubernetesObject, k8sObj => k8sObj['type'] === 'Pod'),
            m => m['name']
          ).includes(f['name'])
      ),
      d3ModPod => {
        node.select(`path[label=${d3ModPod['name']}]`).attr('fill', 'gray')
      }
    )
    try {
      _.forEach(kubernetesObject, m => {
        if (m['type'] === 'Node') {
          if (
            _.find(
              node.select(`circle[data-type=${'Node'}]`).data(),
              nodeData => nodeData.data.label === m['name']
            )
          ) {
            const cpuUsage =
              (parseFloat(m['cpu']) /
                parseFloat(
                  node
                    .select(`circle[data-label=${m['name']}]`)
                    .attr('data-limit-cpu')
                )) *
              100
            const memoryUsage =
              (parseFloat(m['memory']) /
                parseFloat(
                  node
                    .select(`circle[data-label=${m['name']}]`)
                    .attr('data-limit-memory')
                )) *
              100

            node
              .select(`circle[data-label=${m['name']}]`)
              .attr('data-cpu', `${cpuUsage}`)
            node
              .select(`circle[data-label=${m['name']}]`)
              .attr('data-memory', `${memoryUsage}`)
            const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
            node
              .select(`circle[data-label=${m['name']}]`)
              .attr('fill', kubernetesStatusColor(pick / 100))
          }
        } else {
          if (
            _.find(
              node.select(`path[data-type=${'Pod'}]`).data(),
              podData => podData.data.label === m['name']
            )
          ) {
            const cpuUsage =
              (parseFloat(m['cpu']) /
                parseFloat(
                  node
                    .select(`path[data-label=${m['name']}]`)
                    .attr('data-limit-cpu')
                )) *
              100
            const memoryUsage =
              (parseFloat(m['memory']) /
                parseFloat(
                  node
                    .select(`path[data-label=${m['name']}]`)
                    .attr('data-limit-memory')
                )) *
              100

            node
              .select(`path[data-label=${m['name']}]`)
              .attr('data-cpu', `${cpuUsage}`)
            node
              .select(`path[data-label=${m['name']}]`)
              .attr('data-memory', `${memoryUsage}`)

            const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
            node
              .select(`path[data-label=${m['name']}]`)
              .attr('fill', kubernetesStatusColor(pick / 100))
          }
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  public async fetchK8sData() {
    const {source} = this.props
    const tempVars = generateForHosts(source)

    try {
      const kubernetesObject = await getCpuAndLoadForK8s(
        source.links.proxy,
        source.telegraf,
        tempVars
      )

      this.setState({kubernetesObject})
    } catch (error) {
      console.error(error)
    }
  }

  public getFirstMinion = (minions: string[]) => {
    return _.isEmpty(minions) ? this.noSelect : minions[0]
  }

  public async componentDidMount() {
    verifyLocalStorage(
      getLocalStorage,
      setLocalStorage,
      'kubernetes',
      this.defaultState
    )

    let getLocal = getLocalStorage('kubernetes')

    getLocal = {
      ...this.defaultState,
      ...getLocal,
    }

    const {
      proportions,
      selectedAutoRefresh,
      selectMinion: storedSelectMinion,
    } = getLocal

    const minions = await this.getMinionKeyAcceptedList()

    const selectMinion = _.includes(minions, storedSelectMinion)
      ? storedSelectMinion
      : this.getFirstMinion(minions)

    this.handleKubernetesResourceAutoRefresh()

    this.setState({
      minions,
      selectMinion,
      proportions,
      selectedAutoRefresh,
      remoteDataState: RemoteDataState.Loading,
    })
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {autoRefresh, manualRefresh} = this.props
    const {
      kubernetesObject,
      kubernetesData,
      focuseNode,
      selectedAutoRefresh,
      selectMinion,
      filterNamespace,
      filterLimit,
      filterNode,
      filterLabelKey,
      filterLabelValue,
    } = this.state

    if (
      prevState.selectMinion !== selectMinion &&
      this.noSelect !== selectMinion &&
      selectedAutoRefresh === 0
    ) {
      this.debouncedHandleKubernetesRefresh()
    }

    if (prevProps.manualRefresh !== manualRefresh) {
      this.handleKubernetesResourceRefresh()
    }

    if (prevProps.autoRefresh !== autoRefresh) {
      this.handleKubernetesResourceAutoRefresh()
    }

    if (
      JSON.stringify(prevState.kubernetesData) !==
      JSON.stringify(kubernetesData)
    ) {
      this.fetchK8sData()
    }

    if (
      JSON.stringify(prevState.kubernetesObject) !==
      JSON.stringify(kubernetesObject)
    ) {
      this.setD3K8sSeries()
    }

    if (focuseNode.name && prevState.focuseNode.name !== focuseNode.name) {
      d3.selectAll(`path`).classed('kubernetes-focuse', false)
      d3.select(`path[data-name=${this.state.focuseNode.name}]`).classed(
        'kubernetes-focuse',
        true
      )
    }

    if (prevState.pinNode !== this.state.pinNode) {
      const {pinNode} = this.state
      d3.selectAll(`path`).classed('kubernetes-pin', false)
      _.forEach(pinNode, pin => {
        d3.select(`[data-name=${pin}]`).classed('kubernetes-pin', true)
      })
    }

    if (prevProps.autoRefresh !== autoRefresh) {
      GlobalAutoRefresher.poll(autoRefresh)
    }

    if (
      prevState.selectedAutoRefresh !== selectedAutoRefresh ||
      prevState.selectMinion !== selectMinion
    ) {
      this.handleKubernetesAutoRefresh()
    }

    if (prevState.focuseNode.name !== focuseNode.name) {
      const layouts = await this.fillteredLayouts()
      this.setState({
        layouts,
      })
    }

    if (prevState.selectedAutoRefresh !== selectedAutoRefresh) {
      const getLocal = getLocalStorage('kubernetes')
      setLocalStorage('kubernetes', {...getLocal, selectedAutoRefresh})
    }

    if (prevState.selectMinion !== selectMinion) {
      const getLocal = getLocalStorage('kubernetes')
      setLocalStorage('kubernetes', {...getLocal, selectMinion})
    }

    if (
      prevState.filterNamespace !== filterNamespace ||
      prevState.filterNode !== filterNode ||
      prevState.filterLabelKey !== filterLabelKey ||
      prevState.filterLabelValue !== filterLabelValue ||
      prevState.filterLimit !== filterLimit
    ) {
      this.getK8sObject()
    }
  }

  public componentWillUnmount() {
    this.clearKubernetesObjectInterval()
    this.clearKubernetesResourceInterval()
  }

  public render() {
    const {source, manualRefresh, timeRange} = this.props
    const {
      selectedNamespace,
      selectedNode,
      selectedLimit,
      labelKey,
      labelValue,
      namespaces,
      nodes,
      limits,
      proportions,
      activeEditorTab,
      script,
      focuseNode,
      pinNode,
      isToolipActive,
      targetPosition,
      tooltipNode,
      minions,
      selectMinion,
      isOpenMinions,
      isDisabledMinions,
      selectedAutoRefresh,
      layouts,
    } = this.state

    const layoutCells = getCells(layouts, source)
    const tempVars = generateForHosts(source)

    return (
      <>
        <KubernetesHeader
          handleChooseNamespace={this.onChooseNamespace}
          handleChooseNode={this.onChooseNodes}
          handleChooseLimit={this.onChooseLimit}
          handleChangeLabelkey={this.onChangeLabelKey}
          handleChangeLabelValue={this.onChangeLabelValue}
          handleClickFilter={this.onClickFilter}
          selectedNamespace={selectedNamespace}
          selectedNode={selectedNode}
          selectedLimit={selectedLimit}
          labelKey={labelKey}
          labelValue={labelValue}
          namespaces={['All namespaces', ...namespaces]}
          nodes={['All nodes', ...nodes]}
          limits={limits}
          height={this.height}
          minions={minions}
          selectMinion={selectMinion}
          handleChoosMinion={this.onChooseMinion}
          isOpenMinions={isOpenMinions}
          isDisabledMinions={isDisabledMinions}
          minionsStatus={
            isDisabledMinions
              ? ComponentStatus.Loading
              : ComponentStatus.Default
          }
          handleCloseMinionsDropdown={this.handleCloseMinionsDropdown}
          onClickMinionsDropdown={this.onClickMinionsDropdown}
          handleChooseKubernetesAutoRefresh={
            this.handleChooseKubernetesAutoRefresh
          }
          handleKubernetesRefresh={this.debouncedHandleKubernetesRefresh}
          selectedAutoRefresh={selectedAutoRefresh}
        />
        <KubernetesContents
          proportions={proportions}
          activeTab={activeEditorTab}
          handleOnSetActiveEditorTab={this.onSetActiveEditorTab}
          handleOnClickVisualizePod={this.onClickVisualizePod}
          handleResize={this.handleResize}
          focuseNode={focuseNode}
          pinNode={pinNode}
          script={script}
          height={this.height}
          isToolipActive={isToolipActive}
          targetPosition={targetPosition}
          tooltipNode={tooltipNode}
          handleOpenTooltip={this.handleOpenTooltip}
          handleCloseTooltip={this.handleCloseTooltip}
          kubernetesObject={this.state.kubernetesObject}
          kubernetesD3Data={this.state.kubernetesD3Data}
          handleDBClick={this.onDBClick}
          source={source}
          sources={[source]}
          cells={layoutCells}
          templates={tempVars}
          timeRange={timeRange}
          manualRefresh={manualRefresh}
          host={''}
          selectMinion={selectMinion}
          remoteDataState={this.state.remoteDataState}
        />
      </>
    )
  }

  private fillteredLayouts = async () => {
    const {focuseNode} = this.state
    const {
      data: {layouts},
    } = await getLayouts()

    const {host, measurements} = await this.fetchHostsAndMeasurements(layouts)

    let findMeasurement = []
    if (focuseNode.type === 'Node') {
      findMeasurement = [`kubernetes_node`]
    } else if (focuseNode.type === 'Pod') {
      findMeasurement = [`kubernetes_pod`]
    }

    const focusedApp = 'kubernetes'
    let filteredLayouts = _.filter(layouts, layout => {
      return focusedApp
        ? layout.app === focusedApp &&
            _.filter(findMeasurement, (m: string): boolean =>
              _.includes(layout.measurement, m)
            ).length > 0
        : host.apps &&
            _.includes(host.apps, layout.app) &&
            _.includes(measurements, layout.measurement)
    }).sort((x, y) => {
      return x.measurement < y.measurement
        ? -1
        : x.measurement > y.measurement
        ? 1
        : 0
    })

    const makeWhere = (where: string) => {
      _.forEach(filteredLayouts, layout => {
        _.forEach(layout.cells, cell => {
          _.forEach(cell.queries, query => {
            if (query['wheres']) {
              query['wheres'].push(`"${where}"='${focuseNode.label}'`)
            } else {
              query['wheres'] = []
              query['wheres'].push(`"${where}"='${focuseNode.label}'`)
            }
          })
        })
      })
    }

    if (focuseNode.type === 'Node') {
      makeWhere('node_name')
    } else if (focuseNode.type === 'Pod') {
      makeWhere('pod_name')
    }

    return filteredLayouts
  }

  private async fetchHostsAndMeasurements(layouts: Layout[]) {
    const {source} = this.props
    const fetchMeasurements = getMeasurementsForHost(source, '')
    const fetchHosts = getAppsForHost(
      source.links.proxy,
      '',
      layouts,
      source.telegraf
    )

    const [host, measurements] = await Promise.all([
      fetchHosts,
      fetchMeasurements,
    ])

    return {host, measurements}
  }

  private clearKubernetesObjectInterval = () => {
    window.clearTimeout(this.getKubernetesObjectInterval)
    this.getKubernetesObjectInterval = null
  }

  private clearKubernetesResourceInterval = () => {
    window.clearTimeout(this.getKubernetesResourceInterval)
    this.getKubernetesResourceInterval = null
  }

  private handleKubernetesRefresh = async () => {
    await this.getK8sObject()
  }

  private handleKubernetesResourceRefresh = async () => {
    await this.fetchK8sData()
  }

  private debouncedHandleKubernetesRefresh = _.debounce(
    this.handleKubernetesRefresh,
    500
  )

  private handleKubernetesAutoRefresh = async () => {
    const {selectMinion, selectedAutoRefresh} = this.state

    this.clearKubernetesObjectInterval()
    if (selectMinion === null || selectedAutoRefresh === 0) return

    await this.getK8sObject()
    this.getKubernetesObjectInterval = setTimeout(() => {
      this.handleKubernetesAutoRefresh()
    }, selectedAutoRefresh)
  }

  private handleKubernetesResourceAutoRefresh = async () => {
    const {autoRefresh} = this.props
    this.clearKubernetesResourceInterval()

    if (autoRefresh === 0) return
    await this.fetchK8sData()
    this.getKubernetesResourceInterval = setTimeout(() => {
      this.handleKubernetesResourceAutoRefresh()
    }, autoRefresh)
  }

  private handleChooseKubernetesAutoRefresh = ({
    milliseconds,
  }: {
    milliseconds: AutoRefreshOption['milliseconds']
  }) => {
    this.setState({selectedAutoRefresh: milliseconds})
  }

  private onClickMinionsDropdown = async () => {
    const {isOpenMinions, selectMinion} = this.state

    if (!isOpenMinions) {
      this.setState({isDisabledMinions: true})
      const minions: string[] = _.uniq(await this.getMinionKeyAcceptedList())
      if (_.indexOf(minions, selectMinion) === -1) {
        this.setState({selectMinion: null})
      }

      this.handleOpenMinionsDropdown()
      this.setState({minions, isDisabledMinions: false})
    } else {
      this.handleCloseMinionsDropdown()
    }
  }

  private handleOpenMinionsDropdown = () => {
    this.setState({isOpenMinions: true})
  }

  private handleCloseMinionsDropdown = () => {
    this.setState({isOpenMinions: false})
  }

  private onChooseNamespace = (namespace: {text: string}) => {
    this.setState({
      selectedNamespace: namespace.text,
    })
  }

  private onChooseNodes = (node: {text: string}) => {
    this.setState({selectedNode: node.text})
  }

  private onChooseLimit = (limit: {text: string}) => {
    this.setState({selectedLimit: limit.text})
  }

  private onChangeLabelKey = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({labelKey: e.target.value})
  }

  private onChangeLabelValue = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({labelValue: e.target.value})
  }

  private onSetActiveEditorTab = (activeEditorTab: string): void => {
    this.setState({
      activeEditorTab,
    })
  }

  private onClickFilter = (): void => {
    const {
      selectedNamespace,
      selectedNode,
      labelKey,
      labelValue,
      selectedLimit,
    } = this.state
    this.setState({
      filterNamespace:
        selectedNamespace !== 'All namespaces' ? selectedNamespace : '',
      filterNode: selectedNode !== 'All nodes' ? selectedNode : '',
      filterLabelKey: labelKey !== 'Unlimited' ? labelKey : '',
      filterLabelValue: labelValue,
      filterLimit: selectedLimit,
    })
  }

  private onClickVisualizePod = async (data: any) => {
    const {selectMinion} = this.state
    const focuseNodeName = _.get(data, 'data.name')
    const focuseNodeLabel = _.get(data, 'data.label')
    const focuseNodeType = _.get(data, 'data.type')
    const focuseNamespace = _.get(data, 'data.namespace')

    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    let pParam: SaltStack = {}

    pParam = k8sNodeTypeAttrs?.[focuseNodeType]?.saltParam

    if (pParam !== undefined) {
      let kwarg = null

      if (
        k8sNodeTypeAttrs?.[focuseNodeType]?.saltParam.kwarg.hasOwnProperty(
          'namespace'
        )
      ) {
        kwarg = {namespace: focuseNamespace, name: focuseNodeLabel}
      } else {
        kwarg = {name: focuseNodeLabel}
      }
      pParam = {
        ...k8sNodeTypeAttrs?.[focuseNodeType]?.saltParam,
        kwarg,
      }
    }

    if (_.isEmpty(pParam)) return

    const k8sDetail = await this.props.handleGetK8sDetail(
      saltMasterUrl,
      saltMasterToken,
      selectMinion,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(k8sDetail.data).return[0])[0],
        this.jsonRemoveNull
      )
    )

    if (focuseNodeName) {
      this.setState({
        focuseNode: {
          name: focuseNodeName.replace(/\:/g, '\\:').replace(/\./g, '\\.'),
          label: focuseNodeLabel,
          type: k8sNodeTypeAttrs?.[focuseNodeType]?.name,
        },
        script: resultJson,
      })
    }
  }

  private onDBClick = (data: any) => {
    this.handlePinNode(data)
  }

  private handlePinNode = (data: any) => {
    if (
      data.depth === 3 ||
      (data.depth === 2 &&
        (data.data.type === 'CR' || data.data.type === 'CRB'))
    ) {
      const pinNode = this.parentNavigation(data)
      const target = d3.select(`[data-name=${pinNode[0]}]`)
      const isNull = _.isNull(_.flatMapDeep(target._groups)[0])
      const isPin = isNull || target.classed('kubernetes-pin')
      this.setState({pinNode: isPin ? [] : pinNode})
    } else {
      this.setState({pinNode: []})
    }
  }

  private debouncedResizeTrigger = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 250)

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
    setLocalStorage('kubernetes', {
      proportions,
    })
    this.debouncedResizeTrigger()
  }

  private handleOpenTooltip = (target: HTMLElement) => {
    const {width, top, right, left} = target.getBoundingClientRect()
    this.setState({
      isToolipActive: true,
      targetPosition: {width, top, right, left},
      tooltipNode: {
        name: target.getAttribute('data-label'),
        cpu: parseInt(target.getAttribute('data-cpu')),
        memory: parseInt(target.getAttribute('data-memory')),
      },
    })
  }

  private handleCloseTooltip = () => {
    this.setState({
      isToolipActive: false,
      targetPosition: {top: null, right: null, left: null, width: null},
    })
  }

  private onChooseMinion = (minion: {text: string}) => {
    this.setState({selectMinion: minion.text})
  }
}

const mstp = ({links: {addons}, auth: {me}}) => {
  const meRole = _.get(me, 'role', null)
  return {
    meRole,
    addons,
  }
}

const mdtp = {
  handleGetMinionKeyAcceptedList: getMinionKeyAcceptedListAsync,
  handleGetNamespaces: getLocalK8sNamespacesAsync,
  handleGetNodes: getLocalK8sNodesAsync,
  handleGetPods: getLocalK8sPodsAsync,
  handleGetDeployments: getLocalK8sDeploymentsAsync,
  handleGetReplicaSets: getLocalK8sReplicaSetsAsync,
  handleGetReplicationControllers: getLocalK8sReplicationControllersAsync,
  handleGetDaemonSets: getLocalK8sDaemonSetsAsync,
  handleGetStatefulSets: getLocalK8sStatefulSetsAsync,
  handleGetCronJobs: getLocalK8sCronJobsAsync,
  handleGetJobs: getLocalK8sJobsAsync,
  handleGetServices: getLocalK8sServicesAsync,
  handleGetIngresses: getLocalK8sIngressesAsync,
  handleGetConfigmaps: getLocalK8sConfigmapsAsync,
  handleGetSecrets: getLocalK8sSecretsAsync,
  handleGetServiceAccounts: getLocalK8sServiceAccountsAsync,
  handleGetClusterRoles: getLocalK8sClusterRolesAsync,
  handleGetClusterRoleBindings: getLocalK8sClusterRoleBindingsAsync,
  handleGetRoles: getLocalK8sRolesAsync,
  handleGetRoleBindings: getLocalK8sRoleBindingsAsync,
  handleGetPersistentVolumes: getLocalK8sPersistentVolumesAsync,
  handleGetPersistentVolumeClaims: getLocalK8sPersistentVolumeClaimsAsync,
  handleGetK8sDetail: getLocalK8sDetailAsync,
  notify: notifyAction,
}

export default connect(mstp, mdtp, null)(KubernetesPage)
