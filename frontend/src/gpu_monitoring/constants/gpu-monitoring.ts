import {
  FilteredHostForGPUMonitoring,
  GPUSmiData,
  GPUSmiMIGData,
} from 'src/types'

export const GPU_MONITORING_CRITICAL_VALUE = 95

export const GAP_BETWEEN_GPU_LABEL_AND_GPU_NODE = 2

export const REPEATING_LINEAR_GRADIENT_STYLE =
  'repeating-linear-gradient(45deg, gray, gray 3px, white 3px, white 5px)'

export const PCIE_GENERATION_SPEED: Record<number, number> = {
  1: 250,
  2: 500,
  3: 985,
  4: 1969,
  5: 3938,
}

export const DEFAULT_UNIT_SEGMENT = 6
export const BYTES_PER_GB = 1024 ** 3
export const MIN_TEMPERATURE = 25
export const NODE_HEIGHT_MARGIN = 3
export const MIG_PROFILE_REGEX = /^\|\s*(\d+)\s+([^|]+?)\s+(\d+)\s+(\d+\/\d+)\s+([\d.]+)/

export const FILTERED_HOST_BORDER = '2px solid #f58220'

export const EmptyHostForGPUMonitoring: GPUSmiData = {
  hostname: '',
  gpuIndex: -1,
  gpuPowerDraw: -1,
  gpuCurrentPowerLimit: -1,
  gpuTemperature: -1,
  gpuTemperatureMaxThreshold: -1,
  gpuMemoryTemperature: -1,
  gpuMemoryTemperatureMaxThreshold: -1,
  pcieLinkTx: -1,
  pcieLinkRx: -1,
  pcieLinkCurrentGeneration: -1,
  pcieLinkCurrentWidth: -1,
  migMode: 'Disabled',
  gpuMemoryUtilization: -1,
  gpuMemoryTotal: -1,
  gpuMemoryUsed: -1,
  gpuUtilization: -1,
}

export const EmptyHostsForGPUMIGMonitoring: GPUSmiMIGData = {
  hostname: '',
  gpuIndex: -1,
  gi: -1,
  ci: -1,
  bar1Used: -1,
  bar1Total: -1,
  fbUsed: -1,
  fbTotal: -1,
}

export const EMPTY_FILTERED_HOST_FOR_GPU_MONITORING: FilteredHostForGPUMonitoring = {
  hostname: '',
  ci: -1,
  gi: -1,
  gpuIndex: -1,
  migMode: 'Disabled',
}

export const GPU_MONITORING_TOOLTIP_TABLE_SIZING = {
  TABLE_ROW_IN_HEADER: '65%',
  TABLE_ROW_IN_BODY: '35%',
}
export const GPU_MONITORING_TOOLTIP_HEADER = '100%'
export const GPU_MONITORING_TOOLTIP_BODY_FONTSIZE = '11px'
export const GPU_MONITORING_TOOLTIP_BODY_PADDING = '4px 0px 0px 2px'
export const GPU_MONITORING_TOOLTIP_OFFSET_X = 40
export const GPU_MONITORING_TOOLTIP_WIDTH = 200

export const NVIDIA_SMI_CANNED_LAYOUT_IDS = {
  nvidia_smi_all: '3d38d9a2-c38c-4da9-a029-f5d56a8d2a8b',
  nvidia_smi_mig_enabled: '8c437aee-8f6e-459b-9e9d-fccb11524b5f',
  nvidia_smi_mig_disabled: 'ef5a5390-ce3f-4d5e-bbf9-651195c66013',
}
