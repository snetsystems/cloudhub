// Library
import _ from 'lodash'
import {AxiosResponse} from 'axios'

// Types
import {HostsForGPUSmiData, HostsForGPUSmiMIGData, Template} from 'src/types'

// Constants
import {
  EmptyHostForGPUMonitoring,
  EmptyHostsForGPUMIGMonitoring,
} from 'src/gpu_monitoring/constants'

// Utils
import {proxy} from 'src/utils/queryUrlGenerator'
import replaceTemplate from 'src/tempVars/utils/replace'
import {
  transformNVidiaSmiData,
  transformNVidiaSmiMIGData,
} from 'src/gpu_monitoring/utils'

// ETC
import {
  runLocalNVidiaGPUMigLgip,
  runLocalNvidiaGrainsItemForGPU,
} from 'src/shared/apis/saltStack'

export const getNVidiaSmiDataForHosts = async (
  proxyLink: string,
  telegrafDB: string,
  tempVars: Template[]
): Promise<HostsForGPUSmiData> => {
  const query = replaceTemplate(
    `SELECT mean("utilization_memory") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT mean("gpu_power_draw") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT last("gpu_current_power_limit") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT mean("temperature_gpu") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT last("temperature_gpu_max_threshold") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT mean("temperature_gpu_mem") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT last("temperature_gpu_max_mem_threshold") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT mean("pcie_link_tx_util") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT mean("pcie_link_rx_util") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT last("pcie_link_gen_current") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT last("pcie_link_width_current") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT last("mig_mode") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT last("memory_total") /(1024*1024*1024) FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT mean("memory_used") /(1024*1024*1024) FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     SELECT mean("utilization_gpu") FROM ":db:"."autogen"."nvidia_smi" WHERE time > now() - 10m GROUP BY "host", "index";
     `,
    tempVars
  )

  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })

  const gpuDataMap = transformNVidiaSmiData(data)

  for (const host in gpuDataMap) {
    gpuDataMap[host] = gpuDataMap[host].map(gpuData => ({
      ...EmptyHostForGPUMonitoring,
      ...gpuData,
    }))
  }

  return gpuDataMap
}

export const getNVidiaSmiMIGDataForHosts = async (
  proxyLink: string,
  telegrafDB: string,
  tempVars: Template[]
): Promise<HostsForGPUSmiMIGData> => {
  const query = replaceTemplate(
    `SELECT mean("memory_bar1_used") FROM ":db:"."autogen"."nvidia_smi_mig" WHERE time > now() - 10m GROUP BY "host", "index", "compute_index", "gpu_index";
     SELECT last("memory_bar1_total") FROM ":db:"."autogen"."nvidia_smi_mig" WHERE time > now() - 10m GROUP BY "host", "index", "compute_index", "gpu_index";
     SELECT mean("memory_fb_used") FROM ":db:"."autogen"."nvidia_smi_mig" WHERE time > now() - 10m GROUP BY "host", "index", "compute_index", "gpu_index";
     SELECT last("memory_fb_total") FROM ":db:"."autogen"."nvidia_smi_mig" WHERE time > now() - 10m GROUP BY "host", "index", "compute_index", "gpu_index";
     `,
    tempVars
  )

  const {data} = await proxy({
    source: proxyLink,
    query,
    db: telegrafDB,
  })

  const migDataMap = transformNVidiaSmiMIGData(data)

  for (const host in migDataMap) {
    migDataMap[host] = migDataMap[host].map(migData => ({
      ...EmptyHostsForGPUMIGMonitoring,
      ...migData,
    }))
  }

  return migDataMap
}

export const getNvidiaGrainsItem = async (pUrl: string, pToken: string) => {
  try {
    const minions: AxiosResponse = await runLocalNvidiaGrainsItemForGPU(
      pUrl,
      pToken
    )

    return minions
  } catch (error) {
    console.error(error)
  }
}

export const getNVidiaGPUMigLgip = async (pUrl: string, pToken: string) => {
  try {
    const minions: AxiosResponse = await runLocalNVidiaGPUMigLgip(pUrl, pToken)

    return minions
  } catch (error) {
    console.error(error)
  }
}
