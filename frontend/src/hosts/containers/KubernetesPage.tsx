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
import {getKubernetesAllNodesAsync} from 'src/hosts/actions'
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
} from 'src/hosts/actions/kubernetes'

//Middleware
import {
  getLocalStorage,
  setLocalStorage,
  verifyLocalStorage,
} from 'src/shared/middleware/localStorage'

// Constatns
import {EMPTY_LINKS} from 'src/dashboards/constants/dashboardHeader'

// API
import {
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'
import {getCpuAndLoadForK8s} from 'src/hosts/apis'

// Types
import {Addon} from 'src/types/auth'
import {Source, Layout, TimeRange, Links} from 'src/types'
import {DashboardSwitcherLinks} from 'src/types/dashboards'
import {
  KubernetesItem,
  TooltipNode,
  TooltipPosition,
  FocuseNode,
  KubernetesProps,
  D3K8sData,
  D3DataDepth1,
  D3DataDepth2,
  D3DataDepth3,
} from 'src/hosts/types'
import {timeRanges} from 'src/shared/data/timeRanges'
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

// dummy
// import dummyData from 'src/hosts/containers/d3K8sData'

interface Props extends KubernetesProps {
  source: Source
  getKubernetesAllNodes: (url: string, token: string) => Promise<string[]>
  addons: Addon[]
  notify: NotificationAction
  manualRefresh: number
  timeRange: TimeRange
  //merge
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
  namespaces: string[]
  nodes: string[]
  limits: string[]
  focuseNode: FocuseNode
  pinNode: FocuseNode[]
  isToolipActive: boolean
  tooltipPosition: TooltipPosition
  tooltipNode: TooltipNode
  minions: string[]
  selectMinion: string
  selectedAutoRefresh: AutoRefreshOption['milliseconds']
  isOpenMinions: boolean
  isDisabledMinions: boolean
  kubernetesItem: KubernetesItem
  kubernetesRelationItem: string[]
  layouts: Layout[]
  hostLinks: DashboardSwitcherLinks
  // merge
  d3DummyData: object
  minionsObject: string[]
  target: string
  k8sData: object
  d3K8sData: D3K8sData
  k8sObject: object
}

@ErrorHandling
class KubernetesPage extends PureComponent<Props, State> {
  private height = 40
  private interval: NodeJS.Timer = null
  private intervalID: number = null
  private dummyData = require('src/hosts/containers/d3node.json')
  constructor(props: Props) {
    super(props)

    this.state = {
      proportions: [0.75, 0.25],
      activeEditorTab: 'Basic',
      script: '',
      selectedNamespace: 'All namespaces',
      selectedNode: 'All nodes',
      selectedLimit: 'Unlimited',
      labelKey: '',
      labelValue: '',
      namespaces: ['ns1', 'ns2', 'ns3'],
      nodes: ['n1', 'n2', 'n3'],
      limits: ['Unlimited', '20', '50', '100'],
      focuseNode: {name: null, label: null, type: null},
      pinNode: [],
      isToolipActive: false,
      tooltipPosition: {
        top: null,
        right: null,
        left: null,
      },
      tooltipNode: {
        name: null,
        cpu: null,
        memory: null,
      },
      minions: [],
      selectMinion: 'no select',
      selectedAutoRefresh: 0,
      isOpenMinions: false,
      isDisabledMinions: false,
      kubernetesItem: null,
      kubernetesRelationItem: null,
      layouts: [],
      hostLinks: EMPTY_LINKS,
      // merge
      d3DummyData: null,
      minionsObject: [],
      target: 'k8s-master01',
      k8sData: null,
      k8sObject: null,
      d3K8sData: {name: null, children: []},
    }
  }

  public getNodes = async () => {
    console.log('getNodes')
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {
      kwarg: {
        detail: true,
        fieldselector: `spec.nodeName=${node}`,
        namespace: '',
      },
    }

    const pods = await this.props.handleGetPods(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const deployments = await this.props.handleGetDeployments(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const replicaSets = await this.props.handleGetReplicaSets(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const replicationControllers = await this.props.handleGetReplicationControllers(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const daemonSets = await this.props.handleGetDaemonSets(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const statefulSets = await this.props.handleGetStatefulSets(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const cronJobs = await this.props.handleGetCronJobs(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const jobs = await this.props.handleGetJobs(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    if (flag) {
      const services = await this.props.handleGetServices(
        saltMasterUrl,
        saltMasterToken,
        target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    if (flag) {
      const ingresses = await this.props.handleGetIngresses(
        saltMasterUrl,
        saltMasterToken,
        target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const configmaps = await this.props.handleGetConfigmaps(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const secrets = await this.props.handleGetSecrets(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const serviceAccounts = await this.props.handleGetServiceAccounts(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const clusterRoles = await this.props.handleGetClusterRoles(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const clusterRoleBindings = await this.props.handleGetClusterRoleBindings(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const roles = await this.props.handleGetRoles(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const roleBindings = await this.props.handleGetRoleBindings(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const persistentVolumes = await this.props.handleGetPersistentVolumes(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {detail: true}}

    const persistentVolumeClaims = await this.props.handleGetPersistentVolumeClaims(
      saltMasterUrl,
      saltMasterToken,
      target,
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
    const {k8sData} = this.state
    const findData = []

    findData.push(d.data.name)

    console.log(d)
    console.log(d.data.owner)

    if (_.get(k8sData, d.data.owner)) {
      if (d.parent.data.type === 'Ingress') {
        const spec = _.get(k8sData, d.data.owner)
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
        const owner = _.get(k8sData, d.data.owner)
        _.map(owner, owner => {
          console.log(owner['kind'])
          if (owner['kind'] !== d.parent.data.type) {
            const objKind = _.get(d, 'parent.parent.data.type')
            const objLabel = _.get(d, 'parent.parent.data.label')
            findData.push(
              `${objKind}_${objLabel}_${owner['kind']}_${owner['name']}`
            )
            if (
              _.get(
                k8sData,
                `${objKind}.${objLabel}.${owner['kind']}.${owner['name']}.metadata.owner_references`
              )
            ) {
              const parentOwner = _.get(
                k8sData,
                `${objKind}.${objLabel}.${owner['kind']}.${owner['name']}.metadata.owner_references`
              )
              _.map(parentOwner, parentOwner => {
                console.log(parentOwner['kind'])
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
      if (_.get(k8sData, _.get(d, 'data.child'))) {
        const pod = _.get(k8sData, _.get(d, 'data.child'))
        _.map(pod, pod => {
          if (_.get(d, 'parent')) {
            if (_.get(d, 'parent.parent')) {
              const objKind = _.get(d, 'parent.parent.data.type')
              const objLabel = _.get(d, 'parent.parent.data.label')

              if (_.get(d, 'parent.data.type') === 'Service') {
                _.map(
                  _.get(k8sData, `${objKind}.${objLabel}.Ingress`),
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
                    k8sData,
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
                `${objKind}_${objLabel}_Node_${pod['node_name']}_Pod_${pod['name']}`
              )
            }
          }
        })
      }
    }

    console.log(_.unionBy(findData))

    // console.log(d.parent.parent)
    // console.log(_.get(k8sData, d.data.owner))
  }

  public getMinionKeyAcceptedList = async () => {
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token

    const minionListObject = await this.props.handleGetMinionKeyAcceptedList(
      saltMasterUrl,
      saltMasterToken
    )

    this.setState({
      minionsObject: minionListObject,
    })
  }

  public getNamespaces = async () => {
    console.log('getNamespaces')
    const {target} = this.state
    const addon = this.props.addons.find(addon => {
      return addon.name === AddonType.salt
    })

    const saltMasterUrl = addon.url
    const saltMasterToken = addon.token
    const pParam: SaltStack = {kwarg: {namespace: '', detail: true}}

    const namespaces = await this.props.handleGetNamespaces(
      saltMasterUrl,
      saltMasterToken,
      target,
      pParam
    )

    const resultJson = JSON.parse(
      JSON.stringify(
        _.values(yaml.safeLoad(namespaces.data).return[0])[0],
        this.jsonRemoveNull
      )
    )
    console.log('resultJson: ', resultJson)
    return resultJson
  }

  public getK8sOjbect = async () => {
    console.time('salt1')
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
    console.timeEnd('salt1')

    console.time('dataProc1')
    let k8sData = {}
    const d3K8sData: D3K8sData = {name: 'k8s', children: []}
    const d3Namespaces = {}

    const namespaces = _.reduce(
      info[0],
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

    _.map(info[2], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const serviceName = _.get(m, 'metadata.name')
      if (
        info[2] !== null &&
        !Object.keys(namespaces[namespaceName]).includes('Service')
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
        !Object.keys(namespaces[namespaceName]).includes('Ingress')
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
        !Object.keys(namespaces[namespaceName]).includes('Configmap')
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
        !Object.keys(namespaces[namespaceName]).includes('Secret')
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
        !Object.keys(namespaces[namespaceName]).includes('ServiceAccount')
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
      if (info[7] !== null && !Object.keys(k8sData).includes('ClusterRole')) {
        k8sData = {
          ...k8sData,
          ClusterRole: {},
        }

        const d3DataDepth1: D3DataDepth1 = {
          name: 'ClusterRole',
          label: 'ClusterRole',
          type: 'ClusterRole',
          children: [],
        }

        d3K8sData.children.push(d3DataDepth1)
      }

      k8sData['ClusterRole'][clusterRoleName] = {
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

      d3K8sData.children[
        _.findIndex(d3K8sData.children, {
          name: 'ClusterRole',
        })
      ].children.push(d3DataDepth2)
    })

    _.map(info[8], m => {
      const clusterRoleBindingName = _.get(m, 'metadata.name')
      if (
        info[8] !== null &&
        !Object.keys(k8sData).includes('ClusterRoleBinding')
      ) {
        k8sData = {
          ...k8sData,
          ClusterRoleBinding: {},
        }

        const d3DataDepth1: D3DataDepth1 = {
          name: 'ClusterRoleBinding',
          label: 'ClusterRoleBinding',
          type: 'ClusterRoleBinding',
          children: [],
        }

        d3K8sData.children.push(d3DataDepth1)
      }

      k8sData['ClusterRoleBinding'][clusterRoleBindingName] = {
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

      d3K8sData.children[
        _.findIndex(d3K8sData.children, {
          name: 'ClusterRoleBinding',
        })
      ].children.push(d3DataDepth2)
    })

    _.map(info[9], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const roleName = _.get(m, 'metadata.name')
      if (
        info[9] !== null &&
        !Object.keys(namespaces[namespaceName]).includes('Role')
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
        !Object.keys(namespaces[namespaceName]).includes('RoleBinding')
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
        !Object.keys(k8sData).includes('PersistentVolume')
      ) {
        k8sData = {
          ...k8sData,
          PersistentVolume: {},
        }

        const d3DataDepth1: D3DataDepth1 = {
          name: 'PersistentVolume',
          label: 'PersistentVolume',
          type: 'PersistentVolume',
          children: [],
        }

        d3K8sData.children.push(d3DataDepth1)
      }

      k8sData['PersistentVolume'][persistentVolumeName] = {
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

      d3K8sData.children[
        _.findIndex(d3K8sData.children, {
          name: 'PersistentVolume',
        })
      ].children.push(d3DataDepth2)
    })

    _.map(info[12], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const persistentVolumeClaimName = _.get(m, 'metadata.name')
      if (
        info[12] !== null &&
        !Object.keys(namespaces[namespaceName]).includes(
          'PersistentVolumeClaim'
        )
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
        value: 10,
      }

      d3Namespaces[namespaceName].children[
        _.findIndex(d3Namespaces[namespaceName].children, {
          name: `Namespace_${namespaceName}_PersistentVolumeClaim`,
        })
      ].children.push(d3DataDepth3)
    })

    const nodes = _.reduce(
      info[1],
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

    console.timeEnd('dataProc1')

    console.time('salt2')
    const podsPromises = Object.keys(nodes).map(this.getPods)
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
    console.timeEnd('salt2')

    console.time('dataProc2')
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

        if (!Object.keys(namespaces[namespace]).includes('Node'))
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
              !Object.keys(namespaces[namespace]).includes('ReplicaSet')
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
              !Object.keys(namespaces[namespace]['ReplicaSet']).includes(
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
                    !Object.keys(namespaces[namespace]).includes('Deployment')
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
                    !Object.keys(namespaces[namespace]['Deployment']).includes(
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
                    !Object.keys(namespaces[namespace]).includes('Deployment')
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
                    !Object.keys(namespaces[namespace]['Deployment']).includes(
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
              !Object.keys(namespaces[namespace]).includes(
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
              !Object.keys(
                namespaces[namespace]['ReplicationController']
              ).includes(ownerName)
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
              !Object.keys(namespaces[namespace]).includes('DaemonSet')
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
              !Object.keys(namespaces[namespace]['DaemonSet']).includes(
                ownerName
              )
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
              !Object.keys(namespaces[namespace]).includes('StatefulSet')
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
              !Object.keys(namespaces[namespace]['StatefulSet']).includes(
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
              !Object.keys(namespaces[namespace]).includes('Job')
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
            if (
              !Object.keys(namespaces[namespace]['Job']).includes(ownerName)
            ) {
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
                if (!Object.keys(namespaces[namespace]).includes('CronJob')) {
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
                  !Object.keys(namespaces[namespace]['CronJob']).includes(name)
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
                if (!Object.keys(namespaces[namespace]).includes('CronJob')) {
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
                  !Object.keys(namespaces[namespace]['CronJob']).includes(name)
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

        if (!Object.keys(namespaces[namespace]['Node']).includes(nodeName)) {
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
          !Object.keys(namespaces[namespace]['Node'][nodeName]['Pod']).includes(
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

        if (Object.keys(namespaces[namespace]).includes('Service')) {
          const podService = _.values(_.get(pod, 'metadata.labels'))[0]
          const serviceInfo = _.filter(
            namespaces[namespace]['Service'],
            f => _.values(_.get(f.spec, 'selector'))[0] === podService
          )[0]

          if (serviceInfo !== undefined) {
            const serviceName = _.get(serviceInfo, 'metadata.name')
            if (
              !Object.keys(
                namespaces[namespace]['Service'][serviceName]
              ).includes('Pod')
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

            if (Object.keys(namespaces[namespace]).includes('Ingress')) {
              _.map(namespaces[namespace]['Ingress'], ingress => {
                const ingressName = _.get(ingress, 'metadata.name')
                _.map(_.get(ingress.spec, 'rules'), rule => {
                  _.map(_.get(rule, 'http.paths'), service => {
                    if (
                      _.get(service, 'backend.service_name') === serviceName
                    ) {
                      if (
                        !Object.keys(
                          namespaces[namespace]['Ingress'][ingressName]
                        ).includes('Pod')
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

    k8sData['Namespace'] = namespaces

    _.map(d3Namespaces, m => {
      d3K8sData.children.push(m)
    })

    console.timeEnd('dataProc2')

    this.setState({k8sData: k8sData, d3K8sData: d3K8sData})

    // console.log(k8sData)
    console.log(d3K8sData)
    // console.log(JSON.stringify(d3K8sData))
  }
  public setD3K8sSeries() {
    const {k8sObject} = this.state
    const node = d3.select('svg').selectAll('g')

    let d3NodeObject = {}
    node
      .select(`circle[type=${'Node'}]`)
      .data()
      .forEach(s => {
        d3NodeObject[s.data.label] = {
          ...d3NodeObject[s.data.label],
          name: s.data.label,
          cpu: s.data.data.cpu,
          memory: s.data.data.memory,
        }
      })

    let d3PodObject = {}
    node
      .select(`path[type=${'Pod'}]`)
      .data()
      .forEach(s => {
        d3PodObject[s.data.label] = {
          ...d3PodObject[s.data.label],
          name: s.data.label,
          cpu: s.data.data.cpu,
          memory: s.data.data.memory,
        }
      })

    _.map(
      _.filter(
        d3NodeObject,
        f =>
          !_.map(
            _.filter(k8sObject, k8sObj => k8sObj['type'] === 'Node'),
            m => m['name']
          ).includes(f['name'])
      ),
      d3ModNod => {
        node.select(`circle[label=${d3ModNod['name']}]`).attr('fill', 'gray')
      }
    )

    _.map(
      _.filter(
        d3PodObject,
        f =>
          !_.map(
            _.filter(k8sObject, k8sObj => k8sObj['type'] === 'Pod'),
            m => m['name']
          ).includes(f['name'])
      ),
      d3ModPod => {
        node.select(`path[label=${d3ModPod['name']}]`).attr('fill', 'gray')
      }
    )

    _.map(k8sObject, m => {
      if (m['type'] === 'Node') {
        const cpuUsage =
          (parseFloat(m['cpu']) /
            parseFloat(
              node.select(`circle[label=${m['name']}]`).attr('limit-cpu')
            )) *
          100
        const memoryUsage =
          (parseFloat(m['memory']) /
            parseFloat(
              node.select(`circle[label=${m['name']}]`).attr('limit-memory')
            )) *
          100

        node
          .select(`circle[label=${m['name']}]`)
          .attr('data-cpu', `${cpuUsage}`)
        node
          .select(`circle[label=${m['name']}]`)
          .attr('data-memory', `${memoryUsage}`)
        node.select(`circle[label=${m['name']}]`).attr('fill', 'yellow')
      } else {
        const cpuUsage =
          (parseFloat(m['cpu']) /
            parseFloat(
              node.select(`path[label=${m['name']}]`).attr('limit-cpu')
            )) *
          100
        const memoryUsage =
          (parseFloat(m['memory']) /
            parseFloat(
              node.select(`path[label=${m['name']}]`).attr('limit-memory')
            )) *
          100

        node.select(`path[label=${m['name']}]`).attr('data-cpu', `${cpuUsage}`)
        node
          .select(`path[label=${m['name']}]`)
          .attr('data-memory', `${memoryUsage}`)
        node.select(`path[label=${m['name']}]`).attr('fill', 'red')
      }
    })
  }

  public async fetchK8sData() {
    const {source} = this.props

    const tempVars = generateForHosts(source)

    try {
      const k8sObject = await getCpuAndLoadForK8s(
        source.links.proxy,
        source.telegraf,
        tempVars
      )

      this.setState({k8sObject: k8sObject})
    } catch (error) {
      console.error(error)
    }
  }

  public async componentDidMount() {
    // verifyLocalStorage(getLocalStorage, setLocalStorage, 'KubernetesState', {
    //   proportions: [0.75, 0.25],
    // })

    // const getLocal = getLocalStorage('KubernetesState')
    // const {proportions} = getLocal
    // this.onClickMinionsDropdown()
    // this.setState({
    //   proportions,
    // })

    const {autoRefresh} = this.props
    await this.fetchK8sData()
    await this.getK8sOjbect()

    if (autoRefresh) {
      this.intervalID = window.setInterval(
        () => this.fetchK8sData(),
        autoRefresh
      )
    }

    this.intervalID = window.setInterval(() => this.getK8sOjbect(), 30000)
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {autoRefresh} = this.props
    const {k8sObject, d3K8sData} = this.state

    // if (
    //   prevState.d3K8sData !== null &&
    //   JSON.stringify(prevState.d3K8sData) !== JSON.stringify(d3K8sData)
    // ) {
    // console.log('this.drawChart()')
    // this.drawChart()
    // }

    if (
      prevState.k8sObject !== null &&
      JSON.stringify(prevState.k8sObject) !== JSON.stringify(k8sObject)
    ) {
      this.setD3K8sSeries()
    }

    if (prevProps.autoRefresh !== autoRefresh) {
      GlobalAutoRefresher.poll(autoRefresh)
    }
    // const {selectedAutoRefresh, selectMinion, focuseNode} = this.state
    // if (
    //   prevState.selectedAutoRefresh !== selectedAutoRefresh ||
    //   prevState.selectMinion !== selectMinion
    // ) {
    //   this.handleKubernetesAutoRefresh()
    // }
    // if (prevState.focuseNode.name !== focuseNode.name) {
    //   const layouts = await this.fillteredLayouts()
    //   this.setState({
    //     layouts,
    //   })
    // }
  }

  public componentWillUnmount() {
    this.clearInterval()
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
            _.filter(findMeasurement, m => _.includes(layout.measurement, m))
              .length > 0
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
      tooltipPosition,
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
          namespaces={namespaces}
          nodes={nodes}
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
          handleOnClickPodName={this.onClickPodName}
          handleOnClickVisualizePod={this.onClickVisualizePod}
          handleResize={this.handleResize}
          focuseNode={focuseNode}
          pinNode={pinNode}
          script={script}
          height={this.height}
          isToolipActive={isToolipActive}
          toolipPosition={tooltipPosition}
          tooltipNode={tooltipNode}
          handleOpenTooltip={this.handleOpenTooltip}
          handleCloseTooltip={this.handleCloseTooltip}
          kubernetesItem={this.state.kubernetesItem}
          kubernetesRelationItem={this.state.kubernetesRelationItem}
          handleDBClick={this.onDBClick}
          source={source}
          sources={[source]}
          cells={layoutCells}
          templates={tempVars}
          timeRange={timeRange}
          manualRefresh={manualRefresh}
          host={''}
          selectMinion={selectMinion}
        />
      </>
    )
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

  private clearInterval = () => {
    window.clearTimeout(this.interval)
    this.interval = null
  }

  private fetchKubernetesData = async (
    url: string,
    token: string,
    minion: string
  ) => {
    console.log('--- fetch start---')
    console.table({url, token, minion})

    this.setState({
      kubernetesItem: this.dummyData,
    })

    console.log('--- fetch end ---')
  }

  private handleKubernetesRefresh = () => {
    const {addons} = this.props
    const {selectMinion} = this.state
    const salt = _.find(addons, addon => addon.name === 'salt')
    this.fetchKubernetesData(salt.url, salt.token, selectMinion)
  }

  private debouncedHandleKubernetesRefresh = _.debounce(
    this.handleKubernetesRefresh,
    500
  )

  private handleKubernetesAutoRefresh = () => {
    const {selectMinion, selectedAutoRefresh} = this.state

    this.clearInterval()
    if (selectMinion === null || selectedAutoRefresh === 0) return

    const {addons} = this.props
    const salt = _.find(addons, addon => addon.name === 'salt')

    this.fetchKubernetesData(salt.url, salt.token, selectMinion)
    this.interval = setTimeout(() => {
      this.handleKubernetesAutoRefresh()
    }, selectedAutoRefresh)
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
    const {getKubernetesAllNodes} = this.props

    if (!isOpenMinions) {
      this.setState({isDisabledMinions: true})
      const salt = _.find(this.props.addons, addon => addon.name === 'salt')
      const minions = _.uniq(await getKubernetesAllNodes(salt.url, salt.token))
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
    this.setState({selectedNamespace: namespace.text})
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
    console.log('onClick Filter')
  }

  private onClickPodName = (): void => {
    console.log('onClick Pod Name')
  }

  private onClickVisualizePod = (target: SVGSVGElement): void => {
    const focuseNodeName = d3.select(target).attr('data-name')
    const focuseNodeLabel = d3.select(target).attr('data-label')
    const focuseNodeType = d3.select(target).attr('data-type')

    this.setState({
      focuseNode: {
        name: focuseNodeName,
        label: focuseNodeLabel,
        type: focuseNodeType,
      },
    })
  }

  private onDBClick = (target: SVGSVGElement) => {
    this.handlePinNode(target)
  }

  private handlePinNode = async (target: SVGSVGElement) => {
    const targetName = d3.select(target).attr('data-name')
    const targetLabel = d3.select(target).attr('data-label')
    const targetType = d3.select(target).attr('data-type')
    console.log('targetName: ', targetName)
    console.log('targetLabel: ', targetLabel)
    console.log('targetType: ', targetType)
    // const getRelationNode = await
    // return
    /*
        {
          name: targetName,
          label: targetLabel,
          type: targetType,
        },
        {
          name:
            'Namespace_ingress-nginx_Configmaps_ingress-controller-leader-nginx',
          label: 'ingress-controller-leader-nginx',
          type: 'Pod',
        },
        {
          name: 'Namespace_kube-public_Configmaps_cluster-info',
          label: 'cluster-info',
          type: 'Pod',
        },
    */
    // this.setState({
    //   pinNode: [],
    // })
  }

  private fetchPodData = async () => {
    console.log('hello')
  }

  private debounceFetchPodData = _.debounce(this.fetchPodData, 100)

  private debouncedResizeTrigger = _.debounce(() => {
    WindowResizeEventTrigger()
  }, 250)

  private handleResize = (proportions: number[]) => {
    this.setState({proportions})
    setLocalStorage('KubernetesState', {
      proportions,
    })
    this.debouncedResizeTrigger()
  }

  private handleOpenTooltip = (target: HTMLElement) => {
    const {top, right, left} = target.getBoundingClientRect()
    this.setState({
      isToolipActive: true,
      tooltipPosition: {top, right, left},
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
      tooltipPosition: {top: null, right: null, left: null},
    })
  }

  private onChooseMinion = (minion: {text: string}) => {
    this.setState({selectMinion: minion.text})
  }
}

const mstp = ({auth: {me}}) => {
  const meRole = _.get(me, 'role', null)
  return {
    meRole,
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
}

export default connect(mstp, mdtp)(KubernetesPage)
