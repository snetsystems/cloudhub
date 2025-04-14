//Libraries
import _ from 'lodash'
import {useEffect, useRef} from 'react'

//Utils
import {statusHexColor} from 'src/device_management/utils'

//Constants
import {
  BYTES_PER_GB,
  MIG_PROFILE_REGEX,
  MIN_TEMPERATURE,
} from 'src/gpu_monitoring/constants'

//Types
import {
  AllowedGPUMonitoringMetricProperty,
  GPUMonitoringSeries,
  GPUSmiMIGData,
  GPUSmiData,
  HostsForGPUSmiData,
  HostsForGPUSmiMIGData,
  MigProfile,
} from 'src/types'
import {NvidiaSmiLog} from 'src/gpu_monitoring/types/gpu-details'

export const calculateTemperaturePercent = (
  temperature: number,
  maxThreshold: number
): number => {
  if (maxThreshold <= MIN_TEMPERATURE) {
    console.error(
      `Max Threshold (${maxThreshold}) must be greater than the minimum temperature (${MIN_TEMPERATURE}).`
    )
    return 0
  }

  const percent =
    ((temperature - MIN_TEMPERATURE) / (maxThreshold - MIN_TEMPERATURE)) * 100

  return Math.min(Math.max(percent, 0), 100)
}

export const processMigProfiles = (response: string) => {
  const lines = response.split('\n').filter(line => line.trim() !== '')

  const parsedMigProfilesData: Record<string, MigProfile[]> = {}
  let currentHost: string | null = null
  let currentData: string[] = []

  lines.forEach(line => {
    if (line.startsWith('- ')) {
      if (currentHost && currentData.length > 0) {
        const migProfiles = parseMigProfileData(currentData.join('\n'))
        parsedMigProfilesData[currentHost] = migProfiles
      }

      currentHost = line.slice(2).split(':')[0].trim()
      currentData = []
    } else if (currentHost) {
      currentData.push(line)
    }
  })

  if (currentHost && currentData.length > 0) {
    const migProfiles = parseMigProfileData(currentData.join('\n'))
    parsedMigProfilesData[currentHost] = migProfiles
  }

  return parsedMigProfilesData
}

const parseMigProfileData = (text: string) => {
  const profiles: MigProfile[] = []
  const lines = text.split('\n').filter(line => line.trim() !== '')

  lines.forEach(line => {
    const trimmed = line.trim()
    const match = trimmed.match(MIG_PROFILE_REGEX)

    if (match) {
      const gpu = parseInt(match[1], 10)
      const name = match[2].trim()
      const id = parseInt(match[3], 10)
      const instanceStr = match[4].trim()
      const memGiBTable = Math.ceil(parseFloat(match[5]))
      const memMatch = name.match(/(\d+(?:\.\d+)?)gb/i)
      const memGiB = memMatch ? parseFloat(memMatch[1]) : memGiBTable
      const parts = instanceStr.split('/')
      const totalInstances = parseInt(parts[1], 10)
      const memoryBytes = memGiB * totalInstances * BYTES_PER_GB

      profiles.push({
        gpu,
        name,
        id,
        totalInstances,
        memGiB,
        memoryBytes,
      })
    }
  })

  return profiles
}

export const colorScaleForGPUMonitoring = (value: number) => {
  if (isNaN(value) || !(value + 100)) {
    return statusHexColor('invalid')
  }
  const result = ((100 - value) * 110) / 100
  return `hsl(${result}, 78%, 54%)`
}

export const colorScaleForGPUTempMetricsMonitoring = (value: number) => {
  if (isNaN(value) || value < 0 || value > 100) {
    return statusHexColor('invalid')
  }

  const maxHue = (160 * 360) / 255
  const hue = Math.round((1 - value / 100) * maxHue)
  return `hsl(${hue}, 78%, 54%)`
}

type NumericKeys<T> = {
  [K in keyof T]: T[K] extends number ? K : never
}[keyof T]

export const transformNVidiaSmiData = (
  dataResponse: any
): HostsForGPUSmiData => {
  type MetricMapping = {
    statement: number
    property: AllowedGPUMonitoringMetricProperty
    valueKey: 'mean' | 'last'
  }

  const mappings: MetricMapping[] = [
    {statement: 0, property: 'gpuMemoryUtilization', valueKey: 'mean'},
    {statement: 1, property: 'gpuPowerDraw', valueKey: 'mean'},
    {statement: 2, property: 'gpuCurrentPowerLimit', valueKey: 'last'},
    {statement: 3, property: 'gpuTemperature', valueKey: 'mean'},
    {statement: 4, property: 'gpuTemperatureMaxThreshold', valueKey: 'last'},
    {statement: 5, property: 'gpuMemoryTemperature', valueKey: 'mean'},
    {
      statement: 6,
      property: 'gpuMemoryTemperatureMaxThreshold',
      valueKey: 'last',
    },
    {statement: 7, property: 'pcieLinkTx', valueKey: 'mean'},
    {statement: 8, property: 'pcieLinkRx', valueKey: 'mean'},
    {statement: 9, property: 'pcieLinkCurrentGeneration', valueKey: 'last'},
    {statement: 10, property: 'pcieLinkCurrentWidth', valueKey: 'last'},
    {statement: 11, property: 'migMode', valueKey: 'last'},
    {statement: 12, property: 'gpuMemoryTotal', valueKey: 'last'},
    {statement: 13, property: 'gpuMemoryUsed', valueKey: 'mean'},
    {statement: 14, property: 'gpuUtilization', valueKey: 'mean'},
  ]

  const hostMap: HostsForGPUSmiData = {}
  const precision = 100

  mappings.forEach(({statement, property, valueKey}) => {
    const seriesArr = _.get(dataResponse, `results[${statement}].series`, [])
    seriesArr.forEach((series: GPUMonitoringSeries) => {
      const host = series.tags.host
      const index = Number(series.tags.index)
      if (!hostMap[host]) {
        hostMap[host] = []
      }
      let gpuData = hostMap[host].find(gpu => gpu.gpuIndex === index)
      if (!gpuData) {
        gpuData = {
          hostname: host,
          gpuIndex: index,
          gpuMemoryTotal: -1,
          gpuMemoryUsed: -1,
          gpuMemoryUtilization: -1,
          gpuPowerDraw: -1,
          gpuCurrentPowerLimit: -1,
          gpuTemperature: -1,
          gpuTemperatureMaxThreshold: -1,
          gpuMemoryTemperature: -1,
          gpuMemoryTemperatureMaxThreshold: -1,
          pcieLinkCurrentGeneration: -1,
          pcieLinkCurrentWidth: -1,
          pcieLinkTx: -1,
          pcieLinkRx: -1,
          gpuUtilization: -1,
          migMode: 'Enabled',
        }
        hostMap[host].push(gpuData)
      }
      const valueIdx = series.columns.indexOf(valueKey)
      if (property === 'migMode') {
        gpuData.migMode = series.values[0][valueIdx]
      } else {
        let value = Number(series.values[0][valueIdx])
        const roundedValue = Math.round(value * precision) / precision
        const numericProperty = property as NumericKeys<GPUSmiData>
        gpuData[numericProperty] = roundedValue
      }
    })
  })

  return hostMap
}

export const transformNVidiaSmiMIGData = (
  dataResponse: any
): HostsForGPUSmiMIGData => {
  type MigMapping = {
    statement: number
    property: keyof GPUSmiMIGData
    valueKey: 'mean' | 'last'
  }

  const migMappings: MigMapping[] = [
    {statement: 0, property: 'bar1Used', valueKey: 'mean'},
    {statement: 1, property: 'bar1Total', valueKey: 'last'},
    {statement: 2, property: 'fbUsed', valueKey: 'mean'},
    {statement: 3, property: 'fbTotal', valueKey: 'last'},
  ]

  const hostMap: HostsForGPUSmiMIGData = {}

  migMappings.forEach(({statement, property, valueKey}) => {
    const seriesArr = _.get(dataResponse, `results[${statement}].series`, [])
    seriesArr.forEach((series: GPUMonitoringSeries) => {
      const host = series.tags.host
      const gpuIndex = Number(series.tags.index)
      const computeIndex = Number(series.tags.compute_index)
      const gi = Number(series.tags.gpu_index)

      if (!hostMap[host]) {
        hostMap[host] = []
      }
      let migData = hostMap[host].find(
        data =>
          data.gpuIndex === gpuIndex &&
          data.ci === computeIndex &&
          data.gi === gi
      )

      if (!migData) {
        migData = {
          hostname: host,
          gpuIndex,
          gi,
          ci: computeIndex,
          fbTotal: -1,
          fbUsed: -1,
          bar1Total: -1,
          bar1Used: -1,
        }
        hostMap[host].push(migData)
      }
      const valueIdx = series.columns.indexOf(valueKey)
      const value = Number(series.values[0][valueIdx])
      const numericProperty = property as NumericKeys<GPUSmiMIGData>

      migData[numericProperty] = value
    })
  })

  return hostMap
}

export function useIsMounted() {
  const isMounted = useRef<boolean>(true)

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  return isMounted
}
export const getGpuDetails = (gpuInfo: NvidiaSmiLog) => {
  if (_.isEmpty(gpuInfo)) return {}

  const {driver_version, cuda_version, attached_gpus, timestamp, gpu} = gpuInfo

  const systemInfo = {
    SYSTEM: {
      name: 'host',
      role: 'table',
      data: {
        DRIVER_VERSION: driver_version,
        CUDA_VERSION: cuda_version,
        ATTACHED_GPUS: attached_gpus,
        TIMESTAMP: timestamp,
      },
    },
  }

  const resourceData: Record<string, Record<string, string>> = {}
  const limitData: Record<string, Record<string, string>> = {}
  const configData: Record<string, Record<string, string>> = {}
  const temperatureData: Record<string, Record<string, string>> = {}
  const deviceInfoData: Record<string, Record<string, string>> = {}

  gpu.forEach(g => {
    const gpuKey = `#${g.minor_number}`

    resourceData[gpuKey] = {
      MEMORY_TOTAL: g.fb_memory_usage?.total,
      MEMORY_USED: g.fb_memory_usage?.used,
      MEMORY_FREE: g.fb_memory_usage?.free,
      POWER_DRAW: g.gpu_power_readings?.power_draw,
      VOLTAGE: g.voltage?.graphics_volt,
      PCIE_LINK_GEN:
        g.pci?.pci_gpu_link_info?.pcie_gen?.current_link_gen ?? 'N/A',
      PCIE_LINK_WIDTH:
        g.pci?.pci_gpu_link_info?.link_widths?.current_link_width ?? 'N/A',
    }

    limitData[gpuKey] = {
      POWER_LIMIT_DEFAULT: g.gpu_power_readings?.default_power_limit,
      POWER_LIMIT_MAX: g.gpu_power_readings?.max_power_limit,
      GPU_TEMP_MAX_THRESHOLD: g.temperature?.gpu_temp_max_threshold,
      GPU_TEMP_SLOW_THRESHOLD: g.temperature?.gpu_temp_slow_threshold,
      MEMORY_TEMP_MAX: g.temperature?.gpu_temp_max_mem_threshold,
    }

    configData[gpuKey] = {
      VBIOS_VERSION: g.vbios_version,
      PRODUCT_ARCHITECTURE: g.product_architecture ?? 'N/A',
      ECC_MODE: g.ecc_mode?.current_ecc ?? 'N/A',
      DISPLAY_ACTIVE: g.display_active ?? 'N/A',
      DISPLAY_MODE: g.display_mode ?? 'N/A',
      PCIE_LINK_GEN:
        g.pci?.pci_gpu_link_info?.pcie_gen?.current_link_gen ?? 'N/A',
      PCIE_LINK_WIDTH:
        g.pci?.pci_gpu_link_info?.link_widths?.current_link_width ?? 'N/A',
      PERSISTENCE_MODE: g.persistence_mode ?? 'N/A',
      COMPUTE_MODE: g.compute_mode ?? 'N/A',
      MIG_MODE: g.mig_mode?.current_mig ?? 'N/A',
    }

    temperatureData[gpuKey] = {
      GPU_TEMP: g.temperature?.gpu_temp,
      MEMORY_TEMP: g.temperature?.memory_temp,
      GPU_TEMP_MAX_THRESHOLD: g.temperature?.gpu_temp_max_threshold,
      GPU_TEMP_SLOW_THRESHOLD: g.temperature?.gpu_temp_slow_threshold,
      GPU_TEMP_MAX_GPU_THRESHOLD: g.temperature?.gpu_temp_max_gpu_threshold,
      GPU_TEMP_MAX_MEM_THRESHOLD: g.temperature?.gpu_temp_max_mem_threshold,
    }

    deviceInfoData[gpuKey] = {
      UUID: g.uuid,
      SERIAL: g.serial,
      MINOR_NUMBER: g.minor_number,
      PRODUCT_NAME: g.product_name,
      BOARD_ID: g.board_id,
      GPU_MODULE_ID: g.gpu_module_id,
    }
  })

  return {
    ...systemInfo,
    CONFIG: {
      name: 'gpu',
      role: 'table',
      data: configData,
    },
    RESOURCE: {
      name: 'gpu',
      role: 'table',
      data: resourceData,
    },
    LIMIT: {
      name: 'gpu',
      role: 'table',
      data: limitData,
    },
    TEMPERATURE: {
      name: 'gpu',
      role: 'table',
      data: temperatureData,
    },
    DEVICE: {
      name: 'gpu',
      role: 'table',
      data: deviceInfoData,
    },
  }
}
