// libraries
import _ from 'lodash'
import moment, {unitOfTime} from 'moment'

// constants
import {SUPERADMIN_ROLE} from 'src/auth/Authorized'
import {notIncludeOspProjects} from 'src/clouds/constants/openstack'

// api
import {getRunnerCloudActionOSPProject} from 'src/shared/apis/saltStack'

// utils
import {calculateDataStorage} from 'src/shared/utils/units'

// types
import {
  OpenStackApiList,
  OpenStackDataGroupTypes,
  OpenStackProject,
  OpenstackProjectAPIInfo,
} from 'src/clouds/types/openstack'

export const getOspSaltInfo = async (
  meRole: string,
  handleLoadCspsAsync: () => Promise<any>,
  accessInfo: {url: string; token: string; adminProvider: string}
) => {
  try {
    let namespaces = []
    let allProjectInstances = {}
    const adminProvider = accessInfo.adminProvider
    if (meRole == SUPERADMIN_ROLE) {
      const pCallInfo = {
        [adminProvider]: {
          [OpenStackDataGroupTypes.instances]: {
            options: {
              provider: adminProvider,
              all_projects: true,
            },
            apiList: ['list_nodes_full'],
          },
          [OpenStackDataGroupTypes.projects]: {
            options: {
              provider: adminProvider,
            },
            apiList: ['list_projects'],
          },
        },
      }
      const resApis = await getOSPApiAsync(
        accessInfo.url,
        accessInfo.token,
        pCallInfo
      )

      const instances = resApis[adminProvider].instances

      namespaces = _.reduce(
        resApis[adminProvider].projects,
        (acc, project) => {
          if (!_.includes(notIncludeOspProjects, project.name)) {
            acc.push(project.name)
          }
          return acc
        },
        []
      )
      allProjectInstances = {
        ...instances,
      }
    } else {
      const dbResp: any[] = await handleLoadCspsAsync()

      namespaces = _.map(dbResp, csp => {
        if (csp.provider == 'osp') {
          return csp.namespace
        }
      })
    }

    const pCallInfo: OpenStackApiList = _.reduce(
      namespaces,
      (acc, namespace, _) => {
        acc[namespace] = {
          [OpenStackDataGroupTypes.projects]: {
            options: {
              provider: adminProvider,
              kwarg: {
                project: namespace,
              },
            },
            apiList: [
              'get_compute_limits',
              'get_volume_limits',
              'get_network_quotas',
            ],
          },
          [OpenStackDataGroupTypes.flaver]: {
            options: {
              provider: adminProvider,
            },
            apiList: ['avail_sizes'],
          },
        }
        if (meRole !== SUPERADMIN_ROLE) {
          acc[namespace] = {
            ...acc[namespace],
            [OpenStackDataGroupTypes.instances]: {
              options: {
                provider:
                  meRole === SUPERADMIN_ROLE ? adminProvider : namespace,
                all_projects: false,
              },
              apiList: ['list_nodes_full'],
            },
          }
        }

        return acc
      },
      {}
    )

    let saltRes = await getOSPApiAsync(
      accessInfo.url,
      accessInfo.token,
      pCallInfo
    )
    let instanceSaveProject = Object.keys(saltRes)[0]

    const savedInstance = saltRes[instanceSaveProject].instances
      ? saltRes[instanceSaveProject].instances
      : {}

    allProjectInstances = {
      ...allProjectInstances,
      ...savedInstance,
    }

    saltRes = {
      ...saltRes,
      [instanceSaveProject]: {
        ...saltRes[instanceSaveProject],
        instances: allProjectInstances,
      },
    }

    if (_.isEmpty(saltRes)) {
      throw Error
    }

    const openStackProjects = getOSPProjectInfo(saltRes)
    return openStackProjects
  } catch (error) {
    throw error
  }
}

export const getOSPApiAsync = async (
  pUrl: string,
  pToken: string,
  pCallInfo: object
) => {
  try {
    const saltInfo = await getRunnerCloudActionOSPProject(
      pUrl,
      pToken,
      pCallInfo
    )

    return saltInfo
  } catch (error) {
    throw error
  }
}

export const getOSPProjectInfo = (saltRes: OpenstackProjectAPIInfo) => {
  try {
    const saltInfo = saltRes
    let conVertProjects = {}

    _.reduce(
      saltInfo,
      function (__obj, dataType: any, key) {
        const val = dataType.projects
        conVertProjects[key] = {
          projectData: {
            projectName: key,
            row: {
              projectName: key,
              instances: {
                gaugePosition: `${
                  (val.total_instances_used / val.max_total_instances) * 100
                }`,
                resourceUsuage: `${val.total_instances_used}/${val.max_total_instances}`,
              },
              vcpus: {
                gaugePosition: `${
                  (val.total_cores_used / val.max_total_cores) * 100
                }`,
                resourceUsuage: `${val.total_cores_used}/${val.max_total_cores}`,
              },
              ram: {
                gaugePosition: `${
                  (val.total_ram_used / val.max_total_ram_size) * 100
                }`,
                resourceUsuage: `${calculateDataStorage(
                  val.total_ram_used,
                  'MB',
                  0
                )}/${calculateDataStorage(
                  val.max_total_ram_size,
                  'MB',
                  0
                )}`.replaceAll(' ', ''),
              },
              volumes: {
                gaugePosition: `${
                  (val.absolute.totalVolumesUsed /
                    val.absolute.maxTotalVolumes) *
                  100
                }`,
                resourceUsuage: `${val.absolute.totalVolumesUsed}/${val.absolute.maxTotalVolumes}`,
              },
              volumeSnapshots: {
                gaugePosition: `${
                  (val.absolute.totalSnapshotsUsed /
                    val.absolute.maxTotalSnapshots) *
                  100
                }`,
                resourceUsuage: `${val.absolute.totalSnapshotsUsed}/${val.absolute.maxTotalSnapshots}`,
              },
              volumeStorage: {
                gaugePosition: `${
                  (val.absolute.totalGigabytesUsed /
                    val.absolute.maxTotalVolumeGigabytes) *
                  100
                }`,
                resourceUsuage: `${calculateDataStorage(
                  val.absolute.totalGigabytesUsed,
                  'GB',
                  0
                )}/${calculateDataStorage(
                  val.absolute.maxTotalVolumeGigabytes,
                  'GB',
                  0
                )}`.replaceAll(' ', ''),
              },
              floatingIPs: {
                gaugePosition: `${
                  (val.floatingip.used / val.floatingip.limit) * 100
                }`,
                resourceUsuage: `${val.floatingip.used}/${val.floatingip.limit}`,
              },
              securityGroups: {
                gaugePosition: `${
                  (val.security_group.used / val.security_group.limit) * 100
                }`,
                resourceUsuage: `${val.security_group.used}/${val.security_group.limit}`,
              },
              securityGroupRules: {
                gaugePosition: `${
                  (val.security_group_rule.used /
                    val.security_group_rule.limit) *
                  100
                }`,
                resourceUsuage: `${val.security_group_rule.used}/${val.security_group_rule.limit}`,
              },
              networks: {
                gaugePosition: `${
                  (val.network.used / val.network.limit) * 100
                }`,
                resourceUsuage: `${val.network.used}/${val.network.limit}`,
              },
              ports: {
                gaugePosition: `${(val.port.used / val.port.limit) * 100}`,
                resourceUsuage: `${val.port.used}/${val.port.limit}`,
              },
              routers: {
                gaugePosition: `${(val.router.used / val.router.limit) * 100}`,
                resourceUsuage: `${val.router.used}/${val.router.limit}`,
              },
            },
            chart: {
              Computed: [
                {
                  resourceName: 'Instances',
                  gaugePosition: `${
                    (val.total_instances_used / val.max_total_instances) * 100
                  }`,
                  resourceUsuage: `Used ${val.total_instances_used} of ${val.max_total_instances}`,
                },
                {
                  resourceName: 'VCPUS',
                  gaugePosition: `${
                    (val.total_cores_used / val.max_total_cores) * 100
                  }`,
                  resourceUsuage: `Used ${val.total_cores_used} of ${val.max_total_cores}`,
                },
                {
                  resourceName: 'RAM ',
                  gaugePosition: `${
                    (val.total_ram_used / val.max_total_ram_size) * 100
                  }`,
                  resourceUsuage: `Used ${(calculateDataStorage(
                    val.total_ram_used,
                    'MB',
                    0
                  ) as string).replaceAll(' ', '')} of ${(calculateDataStorage(
                    val.max_total_ram_size,
                    'MB',
                    0
                  ) as string).replaceAll(' ', '')}`,
                },
              ],
              Volume: [
                {
                  resourceName: 'Volumes',
                  gaugePosition: `${
                    (val.absolute.totalVolumesUsed /
                      val.absolute.maxTotalVolumes) *
                    100
                  }`,
                  resourceUsuage: `Used ${val.absolute.totalVolumesUsed} of ${val.absolute.maxTotalVolumes}`,
                },
                {
                  resourceName: 'Volume Sanpshots',
                  gaugePosition: `${
                    (val.absolute.totalSnapshotsUsed /
                      val.absolute.maxTotalSnapshots) *
                    100
                  }`,
                  resourceUsuage: `Used ${val.absolute.totalSnapshotsUsed} of ${val.absolute.maxTotalSnapshots}`,
                },
                {
                  resourceName: 'Volume Storage ',
                  gaugePosition: `${
                    (val.absolute.totalGigabytesUsed /
                      val.absolute.maxTotalVolumeGigabytes) *
                    100
                  }`,
                  resourceUsuage: `Used ${(calculateDataStorage(
                    val.absolute.totalGigabytesUsed,
                    'GB',
                    0
                  ) as string).replaceAll(' ', '')} of ${(calculateDataStorage(
                    val.absolute.maxTotalVolumeGigabytes,
                    'GB',
                    0
                  ) as string).replaceAll(' ', '')}`,
                },
              ],
              Network: [
                {
                  resourceName: 'Floating IPs',
                  gaugePosition: `${
                    (val.floatingip.used / val.floatingip.limit) * 100
                  }`,
                  resourceUsuage: `Allocated ${val.floatingip.used} of ${val.floatingip.limit}`,
                },
                {
                  resourceName: 'Sercurity Groups',
                  gaugePosition: `${
                    (val.security_group.used / val.security_group.limit) * 100
                  }`,
                  resourceUsuage: `Used ${val.security_group.used} of ${val.security_group.limit}`,
                },
                {
                  resourceName: 'Security Group Rules',
                  gaugePosition: `${
                    (val.security_group_rule.used /
                      val.security_group_rule.limit) *
                    100
                  }`,
                  resourceUsuage: `Used ${val.security_group_rule.used} of ${val.security_group_rule.limit}`,
                },
                {
                  resourceName: 'Networks',
                  gaugePosition: `${
                    (val.network.used / val.network.limit) * 100
                  }`,
                  resourceUsuage: `Used ${val.network.used} of ${val.network.limit}`,
                },
                {
                  resourceName: 'Ports',
                  gaugePosition: `${(val.port.used / val.port.limit) * 100}`,
                  resourceUsuage: `Used ${val.port.used} of ${val.port.limit}`,
                },
                {
                  resourceName: 'Routers',
                  gaugePosition: `${
                    (val.router.used / val.router.limit) * 100
                  }`,
                  resourceUsuage: `Used ${val.router.used} of ${val.router.limit}`,
                },
              ],
            },
          },
        }

        return conVertProjects[key]
      },
      {}
    )

    let openStackProjects = null
    _.reduce(
      saltInfo,
      (_before, saltData: any) => {
        const instances = saltData?.instances

        if (!_.isEmpty(instances)) {
          let tempObjectToArray = []
          _.map(instances, instance => {
            const projectName = instance['location']['project']['name']

            const volumesAttached = _.map(
              instance['os-extended-volumes:volumes_attached'],
              volume => `${volume['id']}\n`
            )

            const securityGroups = _.flatten(
              _.map(instance['security_groups'], securityGroup => {
                const securityGroupRules = securityGroup.security_group_rules

                return _.map(securityGroupRules, (securityGroupRule, index) => {
                  return {
                    id: `${index}_securityGroup.name`,
                    securityGroup: securityGroup.name,
                    ethertype: securityGroupRule.ethertype,
                    protocol: securityGroupRule.protocol,
                    portrange: gerPortRange(
                      securityGroupRule.port_range_min,
                      securityGroupRule.port_range_max
                    ),
                    remoteIPPrefix: securityGroupRule.remote_ip_prefix,
                    remoteSecurityGroup: securityGroupRule.group.name,
                  }
                })
              })
            )

            const flaverDetail = _.filter(
              saltInfo[projectName]?.flaver,
              flaver => flaver['id'] == instance['flavor']['id']
            )[0]

            const filteredInstance = {
              instanceId: instance['id'],
              projectName: projectName,
              instanceName: instance['name'],
              ipAddress: instance['private_v4'],
              flavor: instance['flavor']['name'],
              keyPair: instance['key_name'],
              availabilityZone: instance['location']['zone'],
              status: instance['status'],
              task: instance['task_state'] || '',
              powerState: powerStateCodeConvert(instance['power_state']),
              age: calculateDateDuration(instance['created']) || '',
              flaverDetail: {
                id: flaverDetail?.['id'] || '',
                ram: flaverDetail?.['ram'] || '',
                vcpus: flaverDetail?.['vcpus'] || '',
                size: flaverDetail?.['disk'] || '',
              },
              detail: {
                overview: {
                  name: instance['name'],
                  id: instance['id'],
                  projectId: instance['location']['project']['id'],
                  status: instance['status'],
                  availabilityZone: instance['az'],
                  created: instance['created'],
                  age: calculateDateDuration(instance['created']) || '',
                },
                speces: {
                  flavor: instance['flavor']['name'],
                },
                ipAddress: {
                  demoNw: instance['networks']['demo-nw'],
                },
                securityGroups: securityGroups,
                metaData: instance['metadata'],
                volumesAttached: {
                  attachedTo: volumesAttached,
                },
              },
            }
            tempObjectToArray.push(filteredInstance)
          })
          openStackProjects = _.groupBy(
            tempObjectToArray,
            e => e['projectName']
          )

          return false
        }
      },
      {}
    )

    const projects = _.values(
      _.reduce(
        openStackProjects,
        (acc, instance, namespace) => {
          if (acc[namespace]) {
            acc[namespace] = {
              projectData: acc[namespace].projectData,
              instances: instance,
            }
          }

          return acc
        },
        conVertProjects
      )
    ) as OpenStackProject[]

    return projects
  } catch (error) {
    throw error
  }
}
const gerPortRange = (portRangeMin: number, portRangeMax: number) => {
  if (portRangeMin === null && portRangeMax === null) {
    return 'All'
  }

  if (portRangeMin === 1 && portRangeMax === 65535) {
    return 'All'
  }

  if (portRangeMin === portRangeMax) {
    return `${portRangeMin}`
  }

  return `${portRangeMin} ~ ${portRangeMax}`
}
const powerStateCodeConvert = (stateCode: number) => {
  const code = {
    0: 'NoState',
    1: 'Running',
    2: '_Unused',
    3: 'Paused',
    4: 'Shutdown',
    5: '_unused',
    6: 'Crashed',
    7: 'Suspended',
  }
  return code[stateCode]
}
const calculateDateDuration = (startDate: string) => {
  const currentTime = moment()
  const pastTime = moment(startDate)
  const duration = calculateDuration()

  return duration.length > 1
    ? duration.slice(0, 2).join(', ')
    : duration.join('')

  function calculateDuration() {
    const dateUnits = ['years', 'months', 'weeks', 'days', 'hours', 'minutes']

    return dateUnits.reduce((result: string[], dateUnit: unitOfTime.Diff) => {
      const pastDate = currentTime.diff(pastTime, dateUnit)

      if (pastDate > 0) {
        const _dateUnit = pastDate === 1 ? dateUnit.slice(0, -1) : dateUnit

        pastTime.add(pastDate, dateUnit)
        result.push(`${pastDate} ${_dateUnit}`)
      }

      return result
    }, [])
  }
}
