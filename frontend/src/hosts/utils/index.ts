import _ from 'lodash'
import CryptoJS from 'crypto-js'

//types
import {CloudServiceProvider, CSPAccessObject, Instance} from 'src/hosts/types'

const detailsValueChecker = (
  value: string | number | boolean = null
): string | number | boolean | '-' => {
  if (
    _.isUndefined(value) ||
    _.isNaN(value) ||
    _.isNull(value) ||
    _.isError(value) ||
    _.isArray(value)
  ) {
    value = '-'
  }
  return value
}

export const getInstanceType = (awsInstanceTypes: any) => {
  try {
    if (_.isEmpty(awsInstanceTypes)) return
    let instanceTypes = {}

    const getAWSInstanceTypes = _.values(
      _.values(_.values(awsInstanceTypes)[0])[0]
    )

    _.reduce(
      getAWSInstanceTypes,
      (_before, current) => {
        if (_.isNull(current)) return false

        const [family, size] = current.InstanceType.split('.')
        const ValidThreadsPerCore = _.get(
          current.VCpuInfo,
          'ValidThreadsPerCore',
          '-'
        )

        let instanceType = {
          Details: {
            Instance_type: current.InstanceType,
            Instance_family: family,
            Instance_size: size,
            Hypervisor: current.Hypervisor,
            Auto_Recovery_support: current.AutoRecoverySupported.toString(),
            Supported_root_device_types: current.SupportedRootDeviceTypes,
            Dedicated_Host_support: current.DedicatedHostsSupported.toString(),
            'On-Demand_Hibernation_support': current.HibernationSupported.toString(),
            Burstable_Performance_support: current.BurstablePerformanceSupported.toString(),
          },
          Compute: {
            'Free-Tier_eligible': current.FreeTierEligible.toString(),
            Bare_metal: current.BareMetal.toString(),
            vCPUs: current.VCpuInfo.DefaultVCpus,
            Architecture: current.ProcessorInfo.SupportedArchitectures,
            Cores: current.VCpuInfo.DefaultCores,
            Valid_cores: current.VCpuInfo.ValidCores,
            Threads_per_core: current.VCpuInfo.DefaultThreadsPerCore,
            Valid_threads_per_core: _.isArray(ValidThreadsPerCore)
              ? ValidThreadsPerCore.join(',')
              : ValidThreadsPerCore,
            'Sustained_clock_speed_(GHz)':
              current.ProcessorInfo.SustainedClockSpeedInGhz,
            'Memory_(GiB)': current.MemoryInfo.SizeInMiB / 1024,
            Current_generation: current.CurrentGeneration.toString(),
          },
          Networking: {
            EBS_optimization_support: current.EbsInfo.EbsOptimizedSupport,
            Network_performance: current.NetworkInfo.NetworkPerformance,
            ENA_support: current.NetworkInfo.EnaSupport,
            Maximum_number_of_network_interfaces:
              current.NetworkInfo.MaximumNetworkInterfaces,
            IPv4_addresses_per_interface:
              current.NetworkInfo.Ipv4AddressesPerInterface,
            IPv6_addresses_per_interface:
              current.NetworkInfo.Ipv6AddressesPerInterface,
            IPv6_support: current.NetworkInfo.Ipv6Supported.toString(),
            Supported_placement_group_strategies: current.PlacementGroupInfo.SupportedStrategies.join(
              ', '
            ),
          },
        }

        if (current.InstanceStorageSupported) {
          const storage = {
            Storage: {
              'Storage_(GB)': current.InstanceStorageInfo.Disks.TotalSizeInGB,
              Local_instance_storage: '-',
              Storage_type: current.InstanceStorageInfo.Disks.Type,
              Storage_disk_count: current.InstanceStorageInfo.Disks.Count,
              EBS_encryption_support: current.EbsInfo.EncryptionSupport,
            },
          }

          instanceType = {
            ...instanceType,
            ...storage,
          }
        }

        if (current.hasOwnProperty('GpuInfo')) {
          const accelators = {
            Accelerators: {
              GPUs: current.GpuInfo.Gpus.Count,
              'GPU_memory_(GiB)': current.GpuInfo.Gpus.MemoryInfo.SizeInMiB,
              GPU_manufacturer: current.GpuInfo.Gpus.Manufacturer,
              GPU_name: current.GpuInfo.Gpus.Name,
            },
          }

          instanceType = {
            ...instanceType,
            ...accelators,
          }
        }

        instanceTypes = {
          ...instanceType,
        }

        return false
      },
      {}
    )

    return instanceTypes
  } catch (error) {
    console.error('error instanceTypes: ', error)
    return {}
  }
}

export const getInstanceDetails = (
  cloudAccessInfos: CSPAccessObject[],
  focusedInstance: Instance
) => {
  let instanceData = {}

  if (_.isEmpty(cloudAccessInfos) || _.isEmpty(focusedInstance)) {
    return instanceData
  }
  const {provider, namespace, instanceid} = focusedInstance
  const accessInfo = _.find(
    cloudAccessInfos,
    c => c.provider === provider && c.namespace === namespace
  )

  if (accessInfo === null) return

  const getData = _.filter(accessInfo.data, d =>
    _.isNull(d)
      ? false
      : accessInfo.provider === CloudServiceProvider.AWS
      ? d.InstanceId === instanceid
      : d.id === instanceid
  )

  if (provider === CloudServiceProvider.AWS) {
    _.reduce(
      getData,
      (_, current) => {
        const {
          InstanceId,
          NetworkInterfaces,
          PublicIpAddress,
          PrivateIpAddress,
          State,
          PrivateDnsName,
          PublicDnsName,
          InstanceType,
          VpcId,
          SubnetId,
          Platform,
          ImageId,
          Monitoring,
          LaunchTime,
          AmiLaunchIndex,
          KeyName,
          StateTransitionReason,
          Placement,
          VirtualizationType,
          CpuOptions,
          CapacityReservationSpecification,
        } = current

        const instance = {
          Instance_summary: {
            Instance_ID: detailsValueChecker(InstanceId),
            Public_IPv4_address: detailsValueChecker(PublicIpAddress),
            Private_IPv4_addresses: detailsValueChecker(PrivateIpAddress),
            IPv6_address: detailsValueChecker(
              NetworkInterfaces[0].Ipv6Addresses
            ),
            Instance_state: detailsValueChecker(State.Name),
            Public_IPv4_DNS: detailsValueChecker(PublicDnsName),
            Private_IPv4_DNS: detailsValueChecker(PrivateDnsName),
            Instance_type: detailsValueChecker(InstanceType),
            Elastic_IP_addresses: detailsValueChecker(
              NetworkInterfaces[0].Association?.PublicIp
            ),
            VPC_ID: detailsValueChecker(VpcId),
            Subnet_ID: detailsValueChecker(SubnetId),
          },
          Instance_details: {
            Platform: detailsValueChecker(Platform),
            AMI_ID: detailsValueChecker(ImageId),
            Monitoring: detailsValueChecker(Monitoring.State),
            Launch_time: detailsValueChecker(LaunchTime.toString()),
            AMI_Launch_index: detailsValueChecker(AmiLaunchIndex),
            Key_pair_name: detailsValueChecker(KeyName),
            State_transition_reason: detailsValueChecker(StateTransitionReason),
            Owner: detailsValueChecker(NetworkInterfaces[0].OwnerId),
          },
          Host_and_placement_group: {
            Placement_group: detailsValueChecker(Placement.GroupName),
            Host_resource_group_name: detailsValueChecker(),
            Tenancy: detailsValueChecker(Placement.Tenancy),
            Virtualization_type: detailsValueChecker(VirtualizationType),
            Number_of_vCPUs: detailsValueChecker(
              CpuOptions.CoreCount * CpuOptions.ThreadsPerCore
            ),
          },
          Capacity_reservation: {
            Capacity_Reservation_setting: detailsValueChecker(
              CapacityReservationSpecification.CapacityReservationPreference
            ),
          },
        }

        instanceData = {
          ...instance,
        }

        return false
      },
      {}
    )
  } else if (provider === CloudServiceProvider.GCP) {
    _.reduce(
      getData,
      (_, current) => {
        const {
          id,
          image,
          name,
          private_ips,
          public_ips,
          size,
          state,
          extra,
        } = current

        const instance = {
          Instance_summary: {
            Instance_ID: detailsValueChecker(id),
            Instance_Name: detailsValueChecker(name),
            Instance_Image: detailsValueChecker(image),
            Instance_Type: detailsValueChecker(size),
            Instance_state: detailsValueChecker(state),
            Private_IP: detailsValueChecker(private_ips[0]),
            Public_IP: detailsValueChecker(public_ips[0]),
          },
          Zone: {
            Name: detailsValueChecker(extra.zone.name),
            Country: detailsValueChecker(extra.zone.country),
            Status: detailsValueChecker(extra.zone.status),
            Description: detailsValueChecker(extra.zone.extra.description),
          },
        }

        instanceData = {
          ...instance,
        }

        return false
      },
      {}
    )

    const computeNetwork = []
    const computeDisk = []

    if (!_.isEmpty(getData)) {
      _.forEach(_.get(getData[0], 'extra.networkInterfaces'), network => {
        const {name, networkIP, accessConfigs} = network

        if (!_.isEmpty(accessConfigs)) {
          _.forEach(accessConfigs, accessConfig => {
            computeNetwork.push({
              name: name,
              internal_ip: networkIP,
              external_ip: accessConfig.natIP,
              tier: accessConfig.networkTier,
              type: accessConfig.type,
            })
          })
        } else {
          computeNetwork.push({
            name: name,
            internal_ip: networkIP,
            external_ip: '-',
            tier: '-',
            type: '-',
          })
        }
      })

      _.forEach(_.get(getData[0], 'extra.disks'), disk => {
        computeDisk.push({
          devicename: detailsValueChecker(_.get(disk, 'deviceName')),
          disksize: detailsValueChecker(_.get(disk, 'diskSizeGb')),
          diskinterface: detailsValueChecker(_.get(disk, 'interface')),
          boot: detailsValueChecker(_.toString(_.get(disk, 'boot'))),
          autodelete: detailsValueChecker(
            _.toString(_.get(disk, 'autoDelete'))
          ),
          mode: detailsValueChecker(_.get(disk, 'mode')),
          type: detailsValueChecker(_.get(disk, 'type')),
        })
      })
    }

    instanceData = {
      ...instanceData,
      Network_Interfaces: {
        name: 'network',
        role: 'table',
        data: computeNetwork,
      },
      Disk: {name: 'disk', role: 'table', data: computeDisk},
    }
  }

  return instanceData
}

export const getInstanceSecurity = (
  treeMenu: any,
  focusedInstance: Instance,
  awsSecurity: any
) => {
  let instanceData = {}

  try {
    if (_.isNull(awsSecurity)) return

    const getAWSSecurity = _.values(_.values(awsSecurity)[0][0])[0]
    const rules = _.get(getAWSSecurity, 'rules', [])
    const rulesEgress = _.get(getAWSSecurity, 'rules_egress', [])
    const outboundRules = []
    const inboundRules = []

    _.forEach(rules, rule => {
      const {grants, from_port, ip_protocol} = rule
      const isAll = ip_protocol === '-1'
      _.forEach(grants, grant => {
        const {source_group_group_id, cidr_ip} = grant

        inboundRules.push({
          port: isAll ? 'All' : from_port,
          protocol: isAll ? 'All' : _.upperCase(ip_protocol),
          source: cidr_ip || source_group_group_id,
          security_groups: getAWSSecurity.name,
        })
      })
    })

    _.forEach(rulesEgress, rule => {
      const {grants, from_port, ip_protocol} = rule
      const isAll = ip_protocol === '-1'
      _.forEach(grants, grant => {
        const {cidr_ip} = grant

        outboundRules.push({
          port: isAll ? 'All' : from_port,
          protocol: isAll ? 'All' : _.upperCase(ip_protocol),
          destination: cidr_ip,
          security_groups: getAWSSecurity.name,
        })
      })
    })

    return {
      Security_details: {
        Owner_ID: getAWSSecurity.owner_id,
        Launch_Time: treeMenu[focusedInstance.provider]['nodes'][
          focusedInstance.namespace
        ]['nodes'][focusedInstance.instanceid].meta.LaunchTime.toString(),
        Security_groups: `${getAWSSecurity.id}(${getAWSSecurity.name})`,
      },
      Inbound_rules: {name: 'security', role: 'table', data: inboundRules},
      Outbound_rules: {name: 'security', role: 'table', data: outboundRules},
    }
  } catch (error) {
    return instanceData
  }
}

export const getInstancStorage = (
  treeMenu: any,
  focusedInstance: Instance,
  awsVolume: any
) => {
  let instanceData = {}

  try {
    if (_.isNull(awsVolume)) return

    const {provider, namespace, instanceid} = focusedInstance
    const getAWSVolume = _.values(_.values(_.values(awsVolume)[0])[0])
    const blockDevices = []

    _.forEach(getAWSVolume, s => {
      if (!s || !s.Attachments) return

      _.forEach(s.Attachments, volume => {
        blockDevices.push({
          volumeId: volume.VolumeId,
          deviceName: volume.Device,
          volumeSize: s.Size,
          attachmentStatus: volume.State,
          attachmentTime: volume.AttachTime.toString(),
          encrypted: s.Encrypted.toString(),
          deleteOnTermination: volume.DeleteOnTermination.toString(),
        })
      })
    })

    return {
      Root_device_details: {
        Root_device_name:
          treeMenu[provider]['nodes'][namespace]['nodes'][instanceid].meta
            .RootDeviceName,
        Root_device_type:
          treeMenu[provider]['nodes'][namespace]['nodes'][instanceid].meta
            .RootDeviceType,
      },
      Block_devices: {
        name: 'storage',
        role: 'table',
        data: blockDevices,
      },
    }
  } catch (error) {
    return instanceData
  }
}

export const createCSPInstanceData = (
  dbResp: any,
  saltResp: any,
  cloudAccessInfos: CSPAccessObject[]
) => {
  if (dbResp.provider === CloudServiceProvider.AWS) {
    dbResp['data'] = !_.isEmpty(saltResp.return[0])
      ? _.values(saltResp.return[0]).length > 0
        ? _.values(saltResp.return[0])
        : []
      : []
  } else if (dbResp.provider === CloudServiceProvider.GCP) {
    dbResp['data'] =
      !_.isEmpty(saltResp.return[0]) && _.isObject(saltResp.return[0])
        ? _.values(saltResp.return[0][dbResp.namespace]['gce']).length > 0
          ? _.values(saltResp.return[0][dbResp.namespace]['gce'])
          : []
        : []
  }

  return [...cloudAccessInfos, dbResp]
}

export const updateCSPInstanceData = (
  dbResp: any,
  saltResp: any,
  cloudAccessInfos: CSPAccessObject[]
) => {
  const cspInstanceData = _.map(cloudAccessInfos, cloudInfo => {
    if (cloudInfo.id === dbResp.id) {
      if (dbResp.provider === CloudServiceProvider.AWS) {
        cloudInfo = {
          ...dbResp,
          data: !_.isEmpty(saltResp.return[0])
            ? _.values(saltResp.return[0]).length > 0
              ? _.values(saltResp.return[0])
              : []
            : [],
        }
      } else if (dbResp.provider === CloudServiceProvider.GCP) {
        cloudInfo = {
          ...dbResp,
          data:
            !_.isEmpty(saltResp.return[0]) && _.isObject(saltResp.return[0])
              ? _.values(saltResp.return[0][dbResp.namespace]['gce']).length > 0
                ? _.values(saltResp.return[0][dbResp.namespace]['gce'])
                : []
              : [],
        }
      }
    }
    return cloudInfo
  })

  return cspInstanceData
}

export const cryptoJSAESencrypt = (key: string, encryptKey: string) => {
  const encryptedBytes = CryptoJS.AES.encrypt(key, encryptKey)
  const encryptedKey = encryptedBytes.toString()

  return encryptedKey
}

export const cryptoJSAESdecrypt = (key: string, decryptKey: string) => {
  const decryptedBytes = CryptoJS.AES.decrypt(key, decryptKey)
  const decryptedKey = decryptedBytes.toString(CryptoJS.enc.Utf8)

  return decryptedKey
}

export const getNamespaceID = (
  treeMenu: any,
  provider: CloudServiceProvider,
  namespace: string
): string => {
  const menus = _.keys(treeMenu)
  let namespaceID = ''

  if (provider && namespace) {
    for (let i = 0; i < menus.length; i++) {
      if (treeMenu[menus[i]].provider === provider) {
        namespaceID = treeMenu[menus[i]]['nodes'][namespace].namespaceID
        break
      }
    }
  }

  return namespaceID
}

export const isGCPRequiredCheck = (
  provider,
  cloudNamespace,
  cloudAccessKey,
  cloudSecretKey,
  cloudSAEmail,
  cloudSAKey,
  isUpdateCloud
) => {
  if (!isUpdateCloud) {
    if (provider === CloudServiceProvider.AWS) {
      if (_.isEmpty(cloudNamespace)) {
        return 'Region'
      } else if (_.isEmpty(cloudAccessKey)) {
        return 'Access Key'
      } else if (_.isEmpty(cloudSecretKey)) {
        return 'Secret Key'
      }
    } else if (provider === CloudServiceProvider.GCP) {
      if (_.isEmpty(cloudNamespace)) {
        return 'Project'
      } else if (_.isEmpty(cloudSAEmail)) {
        return 'Service Account Email Address'
      } else if (_.isEmpty(cloudSAKey)) {
        return 'Service Account Private Key'
      }
    }
  } else {
    if (provider === CloudServiceProvider.AWS) {
      if (_.isEmpty(cloudNamespace)) {
        return 'Region'
      } else if (_.isEmpty(cloudAccessKey)) {
        return 'Access Key'
      } else if (_.isEmpty(cloudSecretKey)) {
        return 'Secret Key'
      }
    } else if (provider === CloudServiceProvider.GCP) {
      if (_.isEmpty(cloudNamespace)) {
        return 'Project'
      } else if (_.isEmpty(cloudSAEmail)) {
        return 'Service Account Email Address'
      } else if (_.isEmpty(cloudSAKey)) {
        return 'Service Account Private Key'
      }
    }
  }

  return null
}
