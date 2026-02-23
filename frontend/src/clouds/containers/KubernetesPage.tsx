// Library
import React, {PureComponent, ChangeEvent} from 'react'
import {connect} from 'react-redux'
import _ from 'lodash'
import * as d3 from 'd3'

// Component
import KubernetesHeader from 'src/clouds/components/KubernetesHeader'
import KubernetesContents from 'src/clouds/components/KubernetesContents'

import {AutoRefreshOption} from 'src/shared/components/dropdown_auto_refresh/autoRefreshOptions'

// Kubernetes Proxy API
import {
  getKubernetesNamespacesProxy,
  getKubernetesNodesProxy,
  getKubernetesPodsProxy,
  getKubernetesServicesProxy,
  getKubernetesIngressesProxy,
  getKubernetesServiceAccountsProxy,
  getKubernetesRolesProxy,
  getKubernetesRoleBindingsProxy,
  getKubernetesPersistentVolumesProxy,
  getKubernetesPersistentVolumeClaimsProxy,
  getKubernetesConfigMapsProxy,
  getKubernetesSecretsProxy,
  getKubernetesDeploymentsProxy,
  getKubernetesReplicaSetsProxy,
  getKubernetesReplicationControllersProxy,
  getKubernetesDaemonSetsProxy,
  getKubernetesStatefulSetsProxy,
  getKubernetesCronJobsProxy,
  getKubernetesJobsProxy,
  getKubernetesDetailProxy,
  getKubernetesCustomObjectDetail,
} from 'src/shared/apis/proxy'
import {notify as notifyAction} from 'src/shared/actions/notifications'

//Middleware
import {
  getLocalStorage,
  setLocalStorage,
  verifyLocalStorage,
} from 'src/shared/middleware/localStorage'

// Constatns
import {EMPTY_LINKS} from 'src/dashboards/constants/dashboardHeader'
import {kubernetesStatusColor} from 'src/clouds/constants/color'
import {k8sNodeTypeAttrs} from 'src/clouds/constants/kubernetes'
import {k8sApps} from 'src/hosts/constants/apps'

// API
import {
  getLayouts,
  getAppsForHost,
  getMeasurementsForHost,
} from 'src/hosts/apis'
import {getCpuAndLoadForK8s} from 'src/clouds/apis'

// Types
import {Addon} from 'src/types/auth'
import {
  Source,
  Layout,
  TimeRange,
  RemoteDataState,
  NotificationAction,
} from 'src/types'
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
} from 'src/clouds/types'

// Utils
import {WindowResizeEventTrigger} from 'src/shared/utils/trigger'
import {generateForHosts} from 'src/utils/tempVars'
import {getCells} from 'src/hosts/utils/getCells'
import {
  transMemoryToBytes,
  transToCPUMillCore,
} from 'src/clouds/utils/transUnit'
import {GlobalAutoRefresher} from 'src/utils/AutoRefresher'

// Error
import {ErrorHandling} from 'src/shared/decorators/errors'
import {
  notifyNamespaceRequired,
  notifySelectedNamespacesAreNotValid,
} from 'src/shared/copy/notifications'
import {setSelectedPersistentVolume} from 'src/clouds/actions/kubernetesProxy'

interface Props {
  source: Source
  manualRefresh: number
  timeRange: TimeRange
  autoRefresh: number
  meRole?: string
  addons?: Addon[]
  notify?: NotificationAction
  setSelectedPersistentVolume?: (persistentVolumeName: string[] | null) => void
}

interface State {
  proportions: number[]
  activeEditorTab: string
  script: string
  labelKey: string
  labelValue: string
  selectedNamespaces: string[]
  selectedNode: string
  selectedLimit: string
  filterLabelKey: string
  filterLabelValue: string
  filterNamespace: string[]
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
  selectedAutoRefresh: AutoRefreshOption['milliseconds']
  layouts: Layout[]
  hostLinks: DashboardSwitcherLinks
  kubernetesData: object
  kubernetesD3Data: D3K8sData
  kubernetesObject: KubernetesObject
  remoteDataState: RemoteDataState
  volumeMapping: {
    [key: string]: string
  }
  highlightVolumes: string[]
  searchName: string
  searchNameApplied: string
}

@ErrorHandling
class KubernetesPage extends PureComponent<Props, State> {
  private height = 40
  private getKubernetesObjectInterval: NodeJS.Timer = null
  private getKubernetesResourceInterval: NodeJS.Timer = null
  private defaultState = {
    proportions: [0.75, 0.25],
    selectedAutoRefresh: 0,
  }

  constructor(props: Props) {
    super(props)

    this.state = {
      ...this.defaultState,

      activeEditorTab: 'Detail',
      script: '',
      selectedNamespaces: ['All namespaces'],
      selectedNode: 'All nodes',
      selectedLimit: '20',
      labelKey: '',
      labelValue: '',
      namespaces: [],
      nodes: [],
      limits: ['20', '50', '100', 'Unlimited'],
      filterLabelKey: '',
      filterLabelValue: '',
      filterNamespace: [],
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

      kubernetesD3Data: {name: null, children: []},
      layouts: [],
      hostLinks: EMPTY_LINKS,
      kubernetesData: null,
      kubernetesObject: null,
      remoteDataState: RemoteDataState.NotStarted,
      highlightVolumes: [],
      volumeMapping: {},
      searchName: '',
      searchNameApplied: '',
    }
  }

  public getNodes = async (detail: boolean = true) => {
    const pParam: any = {kwarg: {detail}}

    try {
      const nodes = await getKubernetesNodesProxy(pParam)
      return nodes
    } catch (error) {
      console.error(error)
      return null
    }
  }

  public getPodsForNode = async (
    node: string,
    selectedNamespaces: string[],
    isAllNamespaces: boolean = false
  ) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    if (isAllNamespaces) {
      const pParam: any = {
        kwarg: {
          namespace: '',
          fieldselector: node ? `spec.nodeName=${node}` : '',
          labelselector:
            !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
              ? `${filterLabelKey}=${filterLabelValue}`
              : '',
          limit:
            filterLimit !== '' && filterLimit !== 'Unlimited'
              ? parseInt(filterLimit)
              : parseInt(selectedLimit),
          detail: true,
        },
      }

      try {
        const pods = await getKubernetesPodsProxy(pParam)
        return pods || []
      } catch (error) {
        console.error(error)
        return []
      }
    }

    const podPromises = selectedNamespaces.map(async namespace => {
      const pParam: any = {
        kwarg: {
          namespace: namespace,
          fieldselector: node ? `spec.nodeName=${node}` : '',
          labelselector:
            !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
              ? `${filterLabelKey}=${filterLabelValue}`
              : '',
          limit:
            filterLimit !== '' && filterLimit !== 'Unlimited'
              ? parseInt(filterLimit)
              : parseInt(selectedLimit),
          detail: true,
        },
      }

      try {
        const pods = await getKubernetesPodsProxy(pParam)
        return pods || []
      } catch (error) {
        console.error(error)
        return []
      }
    })

    try {
      const results = await Promise.allSettled(podPromises)
      const successfulResults = results
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value)
      return successfulResults.flat()
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getDeploymentsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam: any = {kwarg}

    try {
      const deployments = await getKubernetesDeploymentsProxy(pParam)
      return deployments || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getReplicaSetsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam: any = {kwarg}

    try {
      const replicaSets = await getKubernetesReplicaSetsProxy(pParam)
      return replicaSets || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getReplicationControllersForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const pParam: any = {
      kwarg: {
        namespace: namespace,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit:
          filterLimit !== '' && filterLimit !== 'Unlimited'
            ? parseInt(filterLimit)
            : parseInt(selectedLimit),
        detail: true,
      },
    }
    try {
      const replicationControllers = await getKubernetesReplicationControllersProxy(
        pParam
      )
      return replicationControllers || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getDaemonSetsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const pParam = {
      kwarg: {
        namespace: namespace,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit:
          filterLimit !== '' && filterLimit !== 'Unlimited'
            ? parseInt(filterLimit)
            : parseInt(selectedLimit),
        detail: true,
      },
    }
    try {
      const daemonSets = await getKubernetesDaemonSetsProxy(pParam)
      return daemonSets || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getStatefulSetsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const pParam = {
      kwarg: {
        namespace: namespace,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit:
          filterLimit !== '' && filterLimit !== 'Unlimited'
            ? parseInt(filterLimit)
            : parseInt(selectedLimit),
        detail: true,
      },
    }
    try {
      const statefulSets = await getKubernetesStatefulSetsProxy(pParam)
      return statefulSets || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getCronJobsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const pParam = {
      kwarg: {
        namespace: namespace,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit:
          filterLimit !== '' && filterLimit !== 'Unlimited'
            ? parseInt(filterLimit)
            : parseInt(selectedLimit),
        detail: true,
      },
    }
    try {
      const cronJobs = await getKubernetesCronJobsProxy(pParam)
      return cronJobs || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getJobsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state
    const pParam = {
      kwarg: {
        namespace: namespace,
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        limit:
          filterLimit !== '' && filterLimit !== 'Unlimited'
            ? parseInt(filterLimit)
            : parseInt(selectedLimit),
        detail: true,
      },
    }
    try {
      const jobs = await getKubernetesJobsProxy(pParam)
      return jobs || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getServicesForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam: any = {kwarg}

    try {
      const services = await getKubernetesServicesProxy(pParam)
      return services || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getIngressesForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam: any = {kwarg}

    try {
      const ingresses = await getKubernetesIngressesProxy(pParam)
      return ingresses || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getServiceAccountsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam: any = {kwarg}

    try {
      const serviceAccounts = await getKubernetesServiceAccountsProxy(pParam)
      return serviceAccounts || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getRolesForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam: any = {kwarg}

    try {
      const roles = await getKubernetesRolesProxy(pParam)
      return roles || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getRoleBindingsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam: any = {kwarg}

    try {
      const roleBindings = await getKubernetesRoleBindingsProxy(pParam)
      return roleBindings || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getPersistentVolumes = async () => {
    const {filterLabelKey, filterLabelValue} = this.state
    const pParam: any = {
      kwarg: {
        labelselector:
          !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
            ? `${filterLabelKey}=${filterLabelValue}`
            : '',
        detail: true,
      },
    }

    try {
      const persistentVolumes = await getKubernetesPersistentVolumesProxy(
        pParam
      )
      return persistentVolumes
    } catch (error) {
      console.error(error)
      return null
    }
  }

  public getPersistentVolumeClaimsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam = {kwarg}

    try {
      const persistentVolumeClaims = await getKubernetesPersistentVolumeClaimsProxy(
        pParam
      )
      return persistentVolumeClaims || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getConfigMapsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam = {kwarg}

    try {
      const configMaps = await getKubernetesConfigMapsProxy(pParam)
      return configMaps || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public getSecretsForNamespace = async (namespace: string) => {
    const {
      selectedLimit,
      filterLabelKey,
      filterLabelValue,
      filterLimit,
    } = this.state

    const kwarg: any = {
      labelselector:
        !_.isEmpty(filterLabelKey) && !_.isEmpty(filterLabelValue)
          ? `${filterLabelKey}=${filterLabelValue}`
          : '',
      limit:
        filterLimit !== '' && filterLimit !== 'Unlimited'
          ? parseInt(filterLimit)
          : parseInt(selectedLimit),
      detail: true,
    }

    if (namespace !== '') {
      kwarg.namespace = namespace
    }

    const pParam = {kwarg}

    try {
      const secrets = await getKubernetesSecretsProxy(pParam)
      return secrets || []
    } catch (error) {
      console.error(error)
      return []
    }
  }

  public jsonRemoveNull = (key: string, value: any) => {
    if (value !== null && key !== 'managed_fields' && key !== 'annotations')
      return value
  }

  public combineNamespaceResults = (
    results: any[],
    selectedNamespaces: string[],
    type: string
  ) => {
    const itemsPerNamespace = 8
    const typeIndex = {
      services: 0,
      ingresses: 1,
      serviceAccounts: 2,
      roles: 3,
      roleBindings: 4,
      persistentVolumeClaims: 5,
      configmaps: 6,
      secrets: 7,
    }

    const index = typeIndex[type]
    if (index === undefined) return []

    const combinedResults = []
    for (let i = 0; i < selectedNamespaces.length; i++) {
      const resultIndex = i * itemsPerNamespace + index
      if (results[resultIndex]) {
        combinedResults.push(...results[resultIndex])
      }
    }

    return combinedResults
  }

  public combineWorkloadResults = (
    results: any[],
    selectedNamespaces: string[],
    type: string
  ) => {
    const itemsPerNamespace = 7
    const typeIndex = {
      deployments: 0,
      replicaSets: 1,
      replicationControllers: 2,
      daemonSets: 3,
      statefulSets: 4,
      cronJobs: 5,
      jobs: 6,
    }

    const index = typeIndex[type]
    if (index === undefined) return []

    const combinedResults = []
    for (let i = 0; i < selectedNamespaces.length; i++) {
      const resultIndex = i * itemsPerNamespace + index
      if (results[resultIndex]) {
        combinedResults.push(...results[resultIndex])
      }
    }

    return combinedResults
  }

  public parentNavigation = d => {
    const {kubernetesData} = this.state
    const findData = []

    findData.push(d.data.name)
    if (_.get(kubernetesData, d.data.owner)) {
      if (d.parent.data.type === 'Ingress') {
        const namespace = d.data.namespace
        const ingressName = d.data.label
        const spec = _.get(kubernetesData, [
          'Namespace',
          namespace,
          'Ingress',
          ingressName,
        ])
        const rules = _.get(spec, 'spec.rules') || _.get(spec, 'rules')
        if (rules.length > 0) {
          const objKind = _.get(d, 'parent.parent.data.type')
          const objLabel = _.get(d, 'parent.parent.data.label')

          _.map(rules, rule => {
            _.map(_.get(rule, 'http.paths'), service => {
              const serviceName =
                _.get(service, 'backend.service.name') ||
                _.get(service, 'backend.service_name')
              const newData = `${objKind}_${objLabel}_Service_${serviceName}`
              findData.push(newData)
            })
          })
        }
      } else {
        const owner = _.get(kubernetesData, d.data.owner)

        _.map(owner, ownerItem => {
          if (ownerItem['kind'] !== d.parent.data.type) {
            const objKind = _.get(d, 'parent.parent.data.type')
            const objLabel = _.get(d, 'parent.parent.data.label')
            const newData = `${objKind}_${objLabel}_${ownerItem['kind']}_${ownerItem['name']}`
            findData.push(newData)

            const parentOwnerPath = [
              objKind,
              objLabel,
              ownerItem['kind'],
              ownerItem['name'],
              'metadata',
              'owner_references',
            ]

            if (_.get(kubernetesData, parentOwnerPath)) {
              const parentOwner = _.get(kubernetesData, parentOwnerPath)

              _.map(parentOwner, parentOwnerItem => {
                if (parentOwnerItem['kind'] !== d.parent.data.type) {
                  const parentNewData = `${objKind}_${objLabel}_${parentOwnerItem['kind']}_${parentOwnerItem['name']}`
                  findData.push(parentNewData)
                }
              })
            }
          }
        })
      }
    }

    if (_.get(d, 'data.child')) {
      const childPath = _.get(d, 'data.child')

      if (_.get(kubernetesData, childPath)) {
        const pod = _.get(kubernetesData, childPath)

        _.map(pod, podItem => {
          if (_.get(d, 'parent')) {
            if (_.get(d, 'parent.parent')) {
              const objKind = _.get(d, 'parent.parent.data.type')
              const objLabel = _.get(d, 'parent.parent.data.label')

              if (_.get(d, 'parent.data.type') === 'Service') {
                const ingressPath = `${objKind}.${objLabel}.Ingress`
                const ingresses = _.get(kubernetesData, ingressPath)

                _.map(ingresses, ingress => {
                  _.map(_.get(ingress.spec, 'rules'), rule => {
                    _.map(_.get(rule, 'http.paths'), service => {
                      const serviceName = _.get(service, 'backend.service_name')
                      const currentLabel = _.get(d, 'data.label')

                      if (serviceName === currentLabel) {
                        const newData = `${objKind}_${objLabel}_Ingress_${_.get(
                          ingress,
                          'metadata.name'
                        )}`

                        findData.push(newData)
                      }
                    })
                  })
                })
              } else {
                const namespace = d.data.namespace
                const nodeName = podItem['node_name']
                const podName = podItem['name']
                const podOwnerRefsPath = [
                  'Namespace',
                  namespace,
                  'Node',
                  nodeName,
                  'Pod',
                  podName,
                  'metadata',
                  'owner_references',
                ]
                const podOwnerRefs = _.get(kubernetesData, podOwnerRefsPath)

                _.map(podOwnerRefs, owner => {
                  const newData = `${objKind}_${objLabel}_${owner['kind']}_${owner['name']}`
                  findData.push(newData)
                })
              }

              const podData = `${objKind}_${objLabel}_${podItem['node_name']}_${podItem['name']}`
              findData.push(podData)
            }
          }
        })
      }
    }
    const relation = _.map(_.unionBy(findData), (name: string): string =>
      name.replace(/[.:*+?^${}()|[\]\\]/g, '\\$&')
    )

    return relation
  }

  public getNamespaces = async () => {
    const pParam: any = {
      kwarg: {namespace: '', detail: true},
    }

    try {
      const namespaces = await getKubernetesNamespacesProxy(pParam)
      return namespaces
    } catch (error) {
      console.error(error)
      return null
    }
  }

  public getK8sObject = async () => {
    this.setState({remoteDataState: RemoteDataState.Loading})

    const basicResults = await Promise.allSettled([
      this.getNamespaces(),
      this.getNodes(),
    ])

    const namespacesResult =
      basicResults[0].status === 'fulfilled' ? basicResults[0].value : null
    const nodesResult =
      basicResults[1].status === 'fulfilled' ? basicResults[1].value : null

    if (typeof namespacesResult !== 'object') {
      this.setState({remoteDataState: RemoteDataState.Error})
      return
    }

    const {selectedNamespaces} = this.state
    let validatedSelectedNamespaces = selectedNamespaces

    if (!_.includes(selectedNamespaces, 'All namespaces')) {
      const availableNamespaces = _.map(namespacesResult, namespace =>
        _.get(namespace, 'metadata.name')
      )

      const validNamespaces = selectedNamespaces.filter(ns =>
        availableNamespaces.includes(ns)
      )

      if (validNamespaces.length === 0) {
        this.props.notify(notifySelectedNamespacesAreNotValid())
        this.setState({remoteDataState: RemoteDataState.Error})
        return
      } else if (validNamespaces.length < selectedNamespaces.length) {
        validatedSelectedNamespaces = validNamespaces
      }

      if (!_.isEqual(selectedNamespaces, validatedSelectedNamespaces)) {
        this.setState({selectedNamespaces: validatedSelectedNamespaces})
        const getLocal = getLocalStorage('kubernetes')
        setLocalStorage('kubernetes', {
          ...getLocal,
          selectedNamespaces: validatedSelectedNamespaces,
        })
      }
    }

    const isAllNamespaces = _.includes(
      validatedSelectedNamespaces,
      'All namespaces'
    )
    const selectedNamespacesForQuery = isAllNamespaces
      ? ['']
      : !_.isEmpty(validatedSelectedNamespaces)
      ? validatedSelectedNamespaces
      : _.map(namespacesResult, namespace => _.get(namespace, 'metadata.name'))

    let namespaceResults = []
    let clusterResults = []

    if (isAllNamespaces) {
      const allNamespacePromises = [
        this.getServicesForNamespace(''),
        this.getIngressesForNamespace(''),
        this.getServiceAccountsForNamespace(''),
        this.getRolesForNamespace(''),
        this.getRoleBindingsForNamespace(''),
        this.getPersistentVolumeClaimsForNamespace(''),
        this.getConfigMapsForNamespace(''),
        this.getSecretsForNamespace(''),
        this.getPersistentVolumes(),
      ]

      const allResults = await Promise.allSettled(allNamespacePromises)
      namespaceResults = allResults
        .slice(0, 8)
        .map(result => (result.status === 'fulfilled' ? result.value : []))
      clusterResults = [
        allResults[8].status === 'fulfilled' ? allResults[8].value : [],
      ]
    } else {
      const namespaceBasedPromises = selectedNamespacesForQuery.flatMap(
        namespace => [
          this.getServicesForNamespace(namespace),
          this.getIngressesForNamespace(namespace),
          this.getServiceAccountsForNamespace(namespace),
          this.getRolesForNamespace(namespace),
          this.getRoleBindingsForNamespace(namespace),
          this.getPersistentVolumeClaimsForNamespace(namespace),
          this.getConfigMapsForNamespace(namespace),
          this.getSecretsForNamespace(namespace),
        ]
      )

      const clusterPromises = [this.getPersistentVolumes()]

      const [nsResults, clResults] = await Promise.allSettled([
        Promise.allSettled(namespaceBasedPromises),
        Promise.allSettled(clusterPromises),
      ])

      namespaceResults =
        nsResults.status === 'fulfilled'
          ? nsResults.value.map(result =>
              result.status === 'fulfilled' ? result.value : []
            )
          : []
      clusterResults =
        clResults.status === 'fulfilled'
          ? clResults.value.map(result =>
              result.status === 'fulfilled' ? result.value : []
            )
          : []
    }

    const info = [
      namespacesResult,
      nodesResult,
      isAllNamespaces
        ? namespaceResults[0]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'services'
          ),
      isAllNamespaces
        ? namespaceResults[1]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'ingresses'
          ),
      isAllNamespaces
        ? namespaceResults[2]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'serviceAccounts'
          ),
      isAllNamespaces
        ? namespaceResults[3]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'roles'
          ),
      isAllNamespaces
        ? namespaceResults[4]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'roleBindings'
          ),
      clusterResults[0],
      isAllNamespaces
        ? namespaceResults[5]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'persistentVolumeClaims'
          ),
      isAllNamespaces
        ? namespaceResults[6]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'configmaps'
          ),
      isAllNamespaces
        ? namespaceResults[7]
        : this.combineNamespaceResults(
            namespaceResults,
            selectedNamespacesForQuery,
            'secrets'
          ),
    ]

    let kubernetesData = {}
    const kubernetesD3Data: D3K8sData = {name: 'k8s', children: []}
    const d3Namespaces = {}

    const namespaces = _.reduce(
      !_.isEmpty(selectedNamespacesForQuery) &&
        !_.includes(validatedSelectedNamespaces, 'All namespaces')
        ? _.filter(info[0], namespace =>
            _.includes(
              selectedNamespacesForQuery,
              namespace['metadata']['name']
            )
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

      if (!d3Namespaces[namespaceName]) {
        return
      }

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

      const serviceIndex = _.findIndex(d3Namespaces[namespaceName].children, {
        name: `Namespace_${namespaceName}_Service`,
      })

      if (serviceIndex !== -1) {
        d3Namespaces[namespaceName].children[serviceIndex].children.push(
          d3DataDepth3
        )
      }
    })

    _.map(info[3], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const ingressName = _.get(m, 'metadata.name')

      if (!d3Namespaces[namespaceName]) {
        return
      }

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

      const ingressIndex = _.findIndex(d3Namespaces[namespaceName].children, {
        name: `Namespace_${namespaceName}_Ingress`,
      })

      if (ingressIndex !== -1) {
        d3Namespaces[namespaceName].children[ingressIndex].children.push(
          d3DataDepth3
        )
      }
    })
    _.map(info[4], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const serviceAccountName = _.get(m, 'metadata.name')

      if (!d3Namespaces[namespaceName]) {
        return
      }

      if (
        info[4] !== null &&
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

      const serviceAccountIndex = _.findIndex(
        d3Namespaces[namespaceName].children,
        {
          name: `Namespace_${namespaceName}_ServiceAccount`,
        }
      )

      if (serviceAccountIndex !== -1) {
        d3Namespaces[namespaceName].children[serviceAccountIndex].children.push(
          d3DataDepth3
        )
      }
    })

    _.map(info[5], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const roleName = _.get(m, 'metadata.name')

      if (!d3Namespaces[namespaceName]) {
        return
      }

      if (
        info[5] !== null &&
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

      const roleIndex = _.findIndex(d3Namespaces[namespaceName].children, {
        name: `Namespace_${namespaceName}_Role`,
      })

      if (roleIndex !== -1) {
        d3Namespaces[namespaceName].children[roleIndex].children.push(
          d3DataDepth3
        )
      }
    })

    _.map(info[6], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const roleBindingName = _.get(m, 'metadata.name')

      if (!d3Namespaces[namespaceName]) {
        return
      }

      if (
        info[6] !== null &&
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

      const roleBindingIndex = _.findIndex(
        d3Namespaces[namespaceName].children,
        {
          name: `Namespace_${namespaceName}_RoleBinding`,
        }
      )

      if (roleBindingIndex !== -1) {
        d3Namespaces[namespaceName].children[roleBindingIndex].children.push(
          d3DataDepth3
        )
      }
    })

    _.map(info[7], m => {
      const persistentVolumeName = _.get(m, 'metadata.name')
      if (
        info[7] !== null &&
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

    _.map(info[8], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const persistentVolumeClaimName = _.get(m, 'metadata.name')
      const volumeName = _.get(m, 'spec.volume_name')

      if (!d3Namespaces[namespaceName]) {
        return
      }

      if (
        info[8] !== null &&
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
        volume_name: volumeName,
        value: 10,
      }

      const volumeMapping = {}
      volumeMapping[persistentVolumeClaimName] = volumeName ?? ''

      const pvcIndex = _.findIndex(d3Namespaces[namespaceName].children, {
        name: `Namespace_${namespaceName}_PersistentVolumeClaim`,
      })

      if (pvcIndex !== -1) {
        d3Namespaces[namespaceName].children[pvcIndex].children.push(
          d3DataDepth3
        )
      }

      this.setState({
        volumeMapping: {
          ...this.state.volumeMapping,
          ...volumeMapping,
        },
      })
    })

    _.map(info[9], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const configmapName = _.get(m, 'metadata.name')

      if (!d3Namespaces[namespaceName]) {
        return
      }

      if (
        info[9] !== null &&
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

    _.map(info[10], m => {
      const namespaceName = _.get(m, 'metadata.namespace')
      const secretName = _.get(m, 'metadata.name')

      if (!d3Namespaces[namespaceName]) {
        return
      }

      if (
        info[10] !== null &&
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

    const podsPromises = _.map(_.keys(nodes), nodeName =>
      this.getPodsForNode(nodeName, selectedNamespacesForQuery, isAllNamespaces)
    )
    const podsResults = await Promise.allSettled(podsPromises)
    const pods = podsResults.map(result =>
      result.status === 'fulfilled' ? result.value : []
    )

    let workloadResults = []
    let etcObject = []

    if (isAllNamespaces) {
      const workloadPromises = [
        this.getDeploymentsForNamespace(''),
        this.getReplicaSetsForNamespace(''),
        this.getReplicationControllersForNamespace(''),
        this.getDaemonSetsForNamespace(''),
        this.getStatefulSetsForNamespace(''),
        this.getCronJobsForNamespace(''),
        this.getJobsForNamespace(''),
      ]

      const workloadSettledResults = await Promise.allSettled(workloadPromises)
      etcObject = workloadSettledResults.map(result =>
        result.status === 'fulfilled' ? result.value : []
      )
    } else {
      const workloadPromises = selectedNamespacesForQuery.flatMap(namespace => [
        this.getDeploymentsForNamespace(namespace),
        this.getReplicaSetsForNamespace(namespace),
        this.getReplicationControllersForNamespace(namespace),
        this.getDaemonSetsForNamespace(namespace),
        this.getStatefulSetsForNamespace(namespace),
        this.getCronJobsForNamespace(namespace),
        this.getJobsForNamespace(namespace),
      ])

      const workloadSettledResults = await Promise.allSettled(workloadPromises)
      workloadResults = workloadSettledResults.map(result =>
        result.status === 'fulfilled' ? result.value : []
      )

      etcObject = [
        this.combineWorkloadResults(
          workloadResults,
          selectedNamespacesForQuery,
          'deployments'
        ),
        this.combineWorkloadResults(
          workloadResults,
          selectedNamespacesForQuery,
          'replicaSets'
        ),
        this.combineWorkloadResults(
          workloadResults,
          selectedNamespacesForQuery,
          'replicationControllers'
        ),
        this.combineWorkloadResults(
          workloadResults,
          selectedNamespacesForQuery,
          'daemonSets'
        ),
        this.combineWorkloadResults(
          workloadResults,
          selectedNamespacesForQuery,
          'statefulSets'
        ),
        this.combineWorkloadResults(
          workloadResults,
          selectedNamespacesForQuery,
          'cronJobs'
        ),
        this.combineWorkloadResults(
          workloadResults,
          selectedNamespacesForQuery,
          'jobs'
        ),
      ]
    }

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
        const volumeArray = _.get(pod, 'spec.volumes')

        if (!d3Namespaces[namespace]) {
          return
        }

        let podCPU = 0
        let podMemory = 0

        _.map(podContainers, podCont => {
          const cpuRequest = _.get(podCont, 'resources.requests.cpu')
          const cpuLimit = _.get(podCont, 'resources.limits.cpu')
          const cpuAllocation = cpuRequest || cpuLimit

          podCPU = podCPU + transToCPUMillCore(cpuAllocation, 'pod')

          const memoryRequest = _.get(podCont, 'resources.requests.memory')
          const memoryLimit = _.get(podCont, 'resources.limits.memory')
          const memoryAllocation = memoryRequest || memoryLimit

          podMemory = podMemory + transMemoryToBytes(memoryAllocation)
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
                metadata:
                  replicaSets[ownerName] !== undefined
                    ? replicaSets[ownerName].metadata
                    : {},
                spec:
                  replicaSets[ownerName] !== undefined
                    ? replicaSets[ownerName].spec
                    : {},
                status:
                  replicaSets[ownerName] !== undefined
                    ? replicaSets[ownerName].status
                    : {},
                Pod: [],
              }
              namespaces[namespace]['ReplicaSet'][ownerName]['Pod'].push({
                name: podName,
                node_name: nodeName,
                namespaces: namespace,
                volumes: volumeArray,
              })

              d3Namespaces[namespace].children[
                _.findIndex(d3Namespaces[namespace].children, {
                  name: `Namespace_${namespace}_ReplicaSet`,
                })
              ].children.push({
                name: `Namespace_${namespace}_ReplicaSet_${ownerName}`,
                owner: [
                  'Namespace',
                  namespace,
                  'ReplicaSet',
                  ownerName,
                  'metadata',
                  'owner_references',
                ],
                child: ['Namespace', namespace, 'ReplicaSet', ownerName, 'Pod'],
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
                      child: [
                        'Namespace',
                        namespace,
                        'Deployment',
                        ownerName,
                        'Pod',
                      ],
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
                owner: [
                  'Namespace',
                  namespace,
                  'Job',
                  ownerName,
                  'metadata',
                  'owner_references',
                ],
                child: ['Namespace', namespace, 'Job', ownerName, 'Pod'],
                status:
                  _.get(jobs[ownerName], 'status.failed') &&
                  _.get(jobs[ownerName], 'status.failed ') > 0
                    ? 'Ready'
                    : 'Succeeded',
                value: 10,
              })

              _.map(_.get(jobs[ownerName], 'metadata.owner_references'), ro => {
                const parentKind = _.get(ro, 'kind')
                const name = _.get(ro, 'name')
                if (parentKind !== 'CronJob') {
                  return
                }
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
                const parentKind = _.get(ro, 'kind')
                const name = _.get(ro, 'name')
                if (parentKind !== 'CronJob') {
                  return
                }
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
            owner: [
              'Namespace',
              namespace,
              'Node',
              nodeName,
              'Pod',
              podName,
              'metadata',
              'owner_references',
            ],
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
            volumes: volumeArray,
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
                          owner: [
                            'Namespace',
                            namespace,
                            'Ingress',
                            ingressName,
                            'spec',
                          ],
                          child: [
                            'Namespace',
                            namespace,
                            'Ingress',
                            ingressName,
                            'Pod',
                          ],
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
    const node = d3.select('svg.kubernetes-svg').selectAll('g')

    if (!node.node() || !(node.data().length > 0)) return

    const esc = (v: any) =>
      typeof (window as any).CSS !== 'undefined' &&
      typeof (window as any).CSS.escape === 'function'
        ? (window as any).CSS.escape(String(v))
        : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&')

    let d3NodeObject = {}
    _.forEach(node.select(`circle[data-type=${'Node'}]`).data() as any[], s => {
      d3NodeObject[s.data.label] = {
        ...d3NodeObject[s.data.label],
        name: s.data.label,
        cpu: s.data.data.cpu,
        memory: s.data.data.memory,
      }
    })

    let d3PodObject = {}
    const pod = node.select(`path[data-type=${'Pod'}]`)
    _.forEach(pod.data() as any[], s => {
      d3PodObject[s.data.label] = {
        ...d3PodObject[s.data.label],
        name: s.data.label,
        cpu: s.data.data.cpu,
        memory: s.data.data.memory,
        volumes: s.data.data.volumes,
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
        node
          .select(`circle[data-label=${esc(d3ModNod['name'])}]`)
          .attr('fill', 'gray')
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
        node
          .select(`path[data-label=${esc(d3ModPod['name'])}]`)
          .attr('fill', 'gray')
      }
    )
    try {
      _.forEach(kubernetesObject, m => {
        if (m['type'] === 'Node') {
          if (
            _.find(
              node.select(`circle[data-type=${'Node'}]`).data() as any[],
              nodeData => nodeData.data.label === m['name']
            )
          ) {
            const limitCpu = node
              .select(`circle[data-label=${esc(m['name'])}]`)
              .attr('data-limit-cpu')
            const limitMemory = node
              .select(`circle[data-label=${esc(m['name'])}]`)
              .attr('data-limit-memory')
            const cpuUsage =
              (parseFloat(m['cpu']) / parseFloat(limitCpu)) * 100.0
            const memoryUsage =
              (parseFloat(m['memory']) / parseFloat(limitMemory)) * 100.0

            node
              .select(`circle[data-label=${esc(m['name'])}]`)
              .attr('data-cpu', `${cpuUsage}`)
            node
              .select(`circle[data-label=${esc(m['name'])}]`)
              .attr('data-memory', `${memoryUsage}`)
            const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
            const fillColor = kubernetesStatusColor(pick / 100)
            node
              .select(`circle[data-label=${esc(m['name'])}]`)
              .attr('fill', fillColor)
          }
        } else if (m['type'] === 'PV') {
          if (
            _.find(
              node.select(`path[data-type=${'PV'}]`).data() as any[],
              pvData => pvData.data.label === m['name']
            )
          ) {
            const iopsValue = m['iops'] || 0
            const bandwidthValue = m['bandwidth'] || 0
            const latencyValue = m['latency'] || 0

            const iopsUsage = (iopsValue / 100000) * 100
            const bandwidthUsage = (bandwidthValue / 700000) * 100

            const pick = iopsUsage > bandwidthUsage ? iopsUsage : bandwidthUsage
            const fillColor = kubernetesStatusColor(pick / 100)

            node
              .select(`path[data-label=${esc(m['name'])}]`)
              .attr('data-iops', `${iopsValue}`)
              .attr('data-bandwidth', `${bandwidthValue}`)
              .attr('data-latency', `${latencyValue}`)
              .attr('fill', fillColor)

            const volumeMapping = this.state.volumeMapping || {}
            const mappedPVCs = Object.keys(volumeMapping).filter(
              pvcName => volumeMapping[pvcName] === m['name']
            )
            mappedPVCs.forEach(pvcName => {
              node
                .select(`path[data-type=${'PVC'}][data-label=${esc(pvcName)}]`)
                .attr('fill', fillColor)
            })
          }
        } else {
          if (
            _.find(
              node.select(`path[data-type=${'Pod'}]`).data() as any[],
              podData => podData.data.label === m['name']
            )
          ) {
            const limitCpu = node
              .select(`path[data-label=${esc(m['name'])}]`)
              .attr('data-limit-cpu')
            const limitMemory = node
              .select(`path[data-label=${esc(m['name'])}]`)
              .attr('data-limit-memory')
            const cpuUsage =
              (parseFloat(m['cpu']) / parseFloat(limitCpu)) * 100.0
            const memoryUsage =
              (parseFloat(m['memory']) / parseFloat(limitMemory)) * 100.0

            node
              .select(`path[data-label=${esc(m['name'])}]`)
              .attr('data-cpu', `${cpuUsage}`)
            node
              .select(`path[data-label=${esc(m['name'])}]`)
              .attr('data-memory', `${memoryUsage}`)

            const pick = cpuUsage > memoryUsage ? cpuUsage : memoryUsage
            const fillColor = kubernetesStatusColor(pick / 100)
            node
              .select(`path[data-label=${esc(m['name'])}]`)
              .attr('fill', fillColor)
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
      selectedNamespaces: storedSelectedNamespaces = ['All namespaces'],
    } = getLocal

    this.setState({
      proportions,
      selectedAutoRefresh,
      selectedNamespaces: storedSelectedNamespaces || ['All namespaces'],
    })
    await this.getK8sObject()
  }

  public async componentDidUpdate(prevProps: Props, prevState: State) {
    const {autoRefresh, manualRefresh} = this.props
    const {
      kubernetesObject,
      kubernetesData,
      kubernetesD3Data,
      focuseNode,
      selectedAutoRefresh,
      selectedNamespaces,
      filterNamespace,
      filterLimit,
      filterNode,
      filterLabelKey,
      filterLabelValue,
    } = this.state
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

    // kubernetesD3Data가 바뀌면 Hexagon이 SVG를 지우고 다시 그리므로,
    // 자식이 DOM을 갱신한 뒤에 색상을 다시 적용해야 함
    if (
      JSON.stringify(prevState.kubernetesD3Data) !==
      JSON.stringify(kubernetesD3Data)
    ) {
      requestAnimationFrame(() => {
        this.setD3K8sSeries()
      })
    }

    if (focuseNode.name && prevState.focuseNode.name !== focuseNode.name) {
      const esc = (v: any) =>
        typeof (window as any).CSS !== 'undefined' &&
        typeof (window as any).CSS.escape === 'function'
          ? (window as any).CSS.escape(String(v))
          : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
      d3.selectAll(`path`).classed('kubernetes-focuse', false)
      d3.select(`path[data-name=${esc(this.state.focuseNode.name)}]`).classed(
        'kubernetes-focuse',
        true
      )
    }

    if (prevState.pinNode !== this.state.pinNode) {
      const {pinNode} = this.state
      d3.selectAll(`path`).classed('kubernetes-pin', false)
      _.forEach(pinNode, pin => {
        d3.select(`[data-name=${this.esc(pin)}]`).classed(
          'kubernetes-pin',
          true
        )
      })
    }

    if (prevState.highlightVolumes !== this.state.highlightVolumes) {
      const {highlightVolumes} = this.state
      this.handleHighlightVolumes(highlightVolumes)
    }
    if (prevProps.autoRefresh !== autoRefresh) {
      GlobalAutoRefresher.poll(autoRefresh)
    }

    if (prevState.selectedAutoRefresh !== selectedAutoRefresh) {
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

    if (!_.isEqual(prevState.selectedNamespaces, selectedNamespaces)) {
      const getLocal = getLocalStorage('kubernetes')
      setLocalStorage('kubernetes', {...getLocal, selectedNamespaces})
    }

    if (
      !_.isEqual(prevState.filterNamespace, filterNamespace) ||
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
      selectedNamespaces,
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

      selectedAutoRefresh,
      layouts,
      highlightVolumes,
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
          selectedNamespace={selectedNamespaces}
          selectedNode={selectedNode}
          selectedLimit={selectedLimit}
          labelKey={labelKey}
          labelValue={labelValue}
          namespaces={['All namespaces', ...namespaces]}
          nodes={['All nodes', ...nodes]}
          limits={limits}
          height={this.height}
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
          remoteDataState={this.state.remoteDataState}
          highlightVolumes={highlightVolumes}
          layouts={layouts}
          handleHighlightVolumes={this.handleHighlightVolumes}
          searchName={this.state.searchName}
          handleChangeSearchName={this.handleChangeSearchName}
          handleApplySearchName={this.handleApplySearchName}
          handleClearSearchName={this.handleClearSearchName}
          searchNameHighlight={this.state.searchNameApplied}
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
    const tempVars = generateForHosts(source)
    const fetchMeasurements = getMeasurementsForHost(source, '')
    const filterLayout = _.filter(layouts, m => _.includes(k8sApps, m.app))
    const fetchHosts = getAppsForHost(
      source.links.proxy,
      '',
      filterLayout,
      source.telegraf,
      tempVars
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
    const {selectedAutoRefresh} = this.state

    this.clearKubernetesObjectInterval()
    if (selectedAutoRefresh === 0) return

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

  private onChooseNamespace = (selectedIDs: string[], value?: {id: string}) => {
    let finalSelection: string[]

    if (value) {
      if (value.id === 'All namespaces') {
        finalSelection = ['All namespaces']
      } else {
        let updatedSelection = selectedIDs
        if (
          _.includes(selectedIDs, 'All namespaces') &&
          value.id !== 'All namespaces'
        ) {
          updatedSelection = selectedIDs.filter(id => id !== 'All namespaces')
        }
        if (updatedSelection.length === 0) {
          finalSelection = []
        } else {
          finalSelection = updatedSelection
        }
      }
    } else {
      finalSelection = (selectedIDs as any).text || selectedIDs
    }

    this.setState({
      selectedNamespaces: finalSelection,
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

  private handleChangeSearchName = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({searchName: e.target.value})
  }

  private handleApplySearchName = () => {
    const {searchName} = this.state
    this.setState({searchNameApplied: searchName})
  }

  private handleClearSearchName = () => {
    this.setState({searchName: '', searchNameApplied: ''})
  }

  private onSetActiveEditorTab = (activeEditorTab: string): void => {
    this.setState({
      activeEditorTab,
    })
  }

  private onClickFilter = (): void => {
    const {
      selectedNode,
      labelKey,
      labelValue,
      selectedLimit,
      selectedNamespaces,
    } = this.state
    const {notify} = this.props

    if (selectedNamespaces.length === 0) {
      notify(notifyNamespaceRequired())
      return
    }

    this.setState({
      filterNamespace: selectedNamespaces,
      filterNode: selectedNode !== 'All nodes' ? selectedNode : '',
      filterLabelKey: labelKey,
      filterLabelValue: labelValue,
      filterLimit: selectedLimit,
    })
  }

  private onClickVisualizePod = async (data: any) => {
    const {volumeMapping} = this.state
    const {setSelectedPersistentVolume} = this.props

    const focuseNodeName = _.get(data, 'data.name')
    const focuseNodeLabel = _.get(data, 'data.label')
    const focuseNodeType = _.get(data, 'data.type')
    const focuseNamespace = _.get(data, 'data.namespace')
    const focuseVolumes = _.get(data, 'data.volumes')

    if (focuseNodeType === 'Pod') {
      const selectedVolumes = focuseVolumes
        .map((volume: any) => volume?.persistent_volume_claim?.claim_name)
        .filter((item: any) => !!item)

      setSelectedPersistentVolume(
        selectedVolumes.map(volume => volumeMapping[volume])
      )
    }

    let pParam: any = {}

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

    if (_.isEmpty(pParam)) {
      const apiVersion = _.get(data, 'data.apiVersion') as string
      const label = focuseNodeLabel
      const ns = focuseNamespace
      if (!apiVersion || !label) return
      const [group, version] = apiVersion.includes('/')
        ? apiVersion.split('/')
        : ['', apiVersion]

      const pluralizeKind = (kind: string) => {
        const k = (kind || '').toLowerCase()
        if (/(s|x|z|ch|sh)$/.test(k)) return `${k}es`
        if (/(?:[^aeiou])y$/.test(k)) return `${k.replace(/y$/, 'ies')}`
        return `${k}s`
      }

      const plural = pluralizeKind(focuseNodeType)
      try {
        const detail = await getKubernetesCustomObjectDetail({
          group,
          version,
          name: label,
          namespace: ns,
          plural,
        })
        const resultJson = detail.data
        if (focuseNodeName) {
          this.setState({
            focuseNode: {
              name: focuseNodeName.replace(/[.:*+?^${}()|[\]\\]/g, '\\$&'),
              label: label,
              type: focuseNodeType,
            },
            script: resultJson,
          })
        }
      } catch (e) {}
      return
    }

    const k8sDetail = await getKubernetesDetailProxy({
      ...pParam,
      fun: pParam.fun || 'kubernetes.show_pod',
    })

    const resultJson = k8sDetail.data

    if (focuseNodeName) {
      this.setState({
        focuseNode: {
          name: focuseNodeName.replace(/[.:*+?^${}()|[\]\\]/g, '\\$&'),
          label: focuseNodeLabel,
          type: k8sNodeTypeAttrs?.[focuseNodeType]?.name,
        },
        script: resultJson,
      })
    }
  }

  private handleHighlightVolumes = (highlightVolumes: any) => {
    d3.selectAll(`path`).classed('kubernetes-volume', false)
    _.forEach(highlightVolumes, volume => {
      d3.selectAll(
        `
            path[data-name*="PersistentVolumeClaim_"][data-name$="${this.esc(
              volume
            )}"],
            path[data-name*="PersistentVolume_"][data-name$="${this.esc(
              volume
            )}"],
            path[data-name="${this.esc(volume)}"]
          `
      ).classed('kubernetes-volume', true)
    })
  }

  private onDBClick = (data: any) => {
    const {pinNode} = this.state
    const focuseVolumes = _.get(data, 'data.volumes')
    const focuseNodeName = _.get(data, 'data.name') ?? ''
    const focuseNodeType = _.get(data, 'data.type') ?? ''
    const focuseVolumeName = _.get(data, 'data.volume_name') ?? ''
    const focuseLabelName = _.get(data, 'data.label') ?? ''

    if (focuseNodeType === 'PV' || focuseNodeType === 'PVC') {
    } else if (
      !this.findStringInArray(pinNode, focuseNodeName) ||
      focuseNodeType !== 'Pod'
    ) {
      this.handlePinNode(data)
    }

    if (
      (focuseNodeType === 'PV' || focuseNodeType === 'PVC') &&
      this.checkHighlightVolumes(focuseNodeName)
    ) {
      this.setState({highlightVolumes: [], pinNode: []})
    } else if (
      focuseNodeType === 'Pod' &&
      this.checkHighlightVolumesExact(focuseNodeName)
    ) {
      this.setState({highlightVolumes: [], pinNode: []})
    } else if (!!focuseVolumes) {
      this.handleVolumeSpec(
        focuseVolumes
          .map((volume: any) => volume?.persistent_volume_claim?.claim_name)
          .filter((item: any) => !!item),
        focuseNodeName
      )
    } else if (!!focuseVolumeName) {
      this.setState({
        highlightVolumes: [
          this.esc(focuseVolumeName),
          this.esc(focuseNodeName),
        ],
        pinNode: [],
      })
    } else if (focuseNodeType === 'PV') {
      this.setState({
        highlightVolumes: [this.esc(focuseLabelName)],
        pinNode: [],
      })
    } else {
      this.setState({highlightVolumes: []})
    }
  }

  private handleVolumeSpec = (volumes: string[], focuseNodeName: string) => {
    const volumeMapping = this.state.volumeMapping || {}

    if (!Array.isArray(volumes) || volumes.length === 0) {
      this.setState({highlightVolumes: []})
      return
    }

    const highlightVolumes = _.uniq([
      ...volumes.map(volume => this.esc(volume)),
      ..._.map(volumes, volume => this.esc(volumeMapping[volume])).filter(
        Boolean
      ),
      this.esc(focuseNodeName),
    ])
    this.setState({highlightVolumes: highlightVolumes || []})
  }

  private findStringInArray(sourceArray: string[], targetString: string) {
    if (!Array.isArray(sourceArray) || typeof targetString !== 'string') {
      return false
    }

    return sourceArray.some(element => {
      const unescapedElement = element.replaceAll('\\.', '.')
      return unescapedElement === targetString
    })
  }

  private handlePinNode = (data: any) => {
    if (
      data.depth === 3 ||
      (data.depth === 2 &&
        (data.data.type === 'CR' ||
          data.data.type === 'CRB' ||
          data.data.type === 'PV'))
    ) {
      const pinNode = this.parentNavigation(data)
      const esc = (v: any) =>
        typeof (window as any).CSS !== 'undefined' &&
        typeof (window as any).CSS.escape === 'function'
          ? (window as any).CSS.escape(String(v))
          : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
      const target = d3.select(`[data-name=${esc(pinNode[0])}]`)
      const isNull = _.isNull(_.flatMapDeep((target as any)._groups)[0])
      const isPin = isNull || target.classed('kubernetes-pin')
      this.setState({
        pinNode: isPin ? [] : pinNode,
        highlightVolumes: [],
      })
    } else {
      this.setState({pinNode: [], highlightVolumes: []})
    }
  }

  private checkHighlightVolumes = (name: string) => {
    const {highlightVolumes} = this.state

    const isIncluded = highlightVolumes.some(sub => name.includes(sub))
    return isIncluded
  }

  private checkHighlightVolumesExact = (name: string) => {
    const {highlightVolumes} = this.state

    const isIncluded = highlightVolumes.some(sub => name === sub)
    return isIncluded
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
    const dataType = target.getAttribute('data-type')

    const tooltipNode: any = {
      name: target.getAttribute('data-label'),
      cpu: parseInt(target.getAttribute('data-cpu')),
      memory: parseInt(target.getAttribute('data-memory')),
    }

    if (dataType === 'PV') {
      tooltipNode.iops = parseFloat(target.getAttribute('data-iops'))
      tooltipNode.bandwidth = parseFloat(target.getAttribute('data-bandwidth'))
      tooltipNode.latency = parseFloat(target.getAttribute('data-latency'))
    }

    this.setState({
      isToolipActive: true,
      targetPosition: {width, top, right, left},
      tooltipNode,
    })
  }

  private handleCloseTooltip = () => {
    this.setState({
      isToolipActive: false,
      targetPosition: {top: null, right: null, left: null, width: null},
    })
  }

  private esc = (v: any) =>
    typeof (window as any).CSS !== 'undefined' &&
    typeof (window as any).CSS.escape === 'function'
      ? (window as any).CSS.escape(String(v))
      : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&')
}

const mstp = ({links: {addons}, auth: {me}}) => {
  const meRole = _.get(me, 'role', null)
  return {
    meRole,
    addons,
  }
}

const mdtp = {
  notify: notifyAction,
  setSelectedPersistentVolume: setSelectedPersistentVolume,
}

export default connect(mstp, mdtp, null)(KubernetesPage)
