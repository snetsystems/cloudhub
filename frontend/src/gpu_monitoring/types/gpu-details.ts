export interface NvidiaSmiLog {
  timestamp: string
  driver_version: string
  cuda_version: string
  attached_gpus: string
  gpu: GpuInfo[]
}

export interface GpuInfo {
  attrs: {id: string}
  product_name: string
  product_brand: string
  product_architecture: string
  display_mode: string
  display_active: string
  persistence_mode: string
  addressing_mode: string
  mig_mode: {
    current_mig: string
    pending_mig: string
  }
  mig_devices?:
    | string
    | {
        mig_device?: MigDevice | MigDevice[]
      }
  accounting_mode: string
  accounting_mode_buffer_size: string
  driver_model: {
    current_dm: string
    pending_dm: string
  }
  serial: string
  uuid: string
  minor_number: string
  vbios_version: string
  multigpu_board: string
  board_id: string
  board_part_number: string
  gpu_part_number: string
  gpu_fru_part_number: string
  gpu_module_id: string
  inforom_version: Record<string, string>
  inforom_bbx_flush: Record<string, string>
  gpu_operation_mode: Record<string, string>
  gsp_firmware_version: string
  gpu_virtualization_mode: Record<string, string>
  gpu_reset_status: Record<string, string>
  ibmnpu: Record<string, string>
  pci: {
    pci_bus: string
    pci_device: string
    pci_domain: string
    pci_device_id: string
    pci_bus_id: string
    pci_sub_system_id: string
    pci_gpu_link_info: {
      pcie_gen: Record<string, string>
      link_widths: Record<string, string>
    }
    pci_bridge_chip: Record<string, string>
    replay_counter: string
    replay_rollover_counter: string
    tx_util: string
    rx_util: string
    atomic_caps_inbound: string
    atomic_caps_outbound: string
  }
  fan_speed: string
  performance_state: string
  clocks_event_reasons: Record<string, string>
  sparse_operation_mode: string
  fb_memory_usage: Record<string, string>
  bar1_memory_usage: Record<string, string>
  cc_protected_memory_usage: Record<string, string>
  compute_mode: string
  utilization: Record<string, string>
  encoder_stats: Record<string, string>
  fbc_stats: Record<string, string>
  ecc_mode: Record<string, string>
  ecc_errors: {
    volatile: Record<string, string>
    aggregate: Record<string, string>
    aggregate_uncorrectable_sram_sources: Record<string, string>
  }
  retired_pages: {
    multiple_single_bit_retirement: Record<string, string>
    double_bit_retirement: Record<string, string>
    pending_blacklist: string
    pending_retirement: string
  }
  remapped_rows?:
    | string
    | {
        remapped_row_corr: string
        remapped_row_unc: string
        remapped_row_pending: string
        remapped_row_failure: string
        row_remapper_histogram: Record<string, string>
      }
  temperature: Record<string, string>
  supported_gpu_target_temp: Record<string, string>
  gpu_power_readings: Record<string, string>
  module_power_readings: Record<string, string>
  clocks: Record<string, string>
  applications_clocks: Record<string, string>
  default_applications_clocks: Record<string, string>
  deferred_clocks: Partial<Record<string, string>>
  max_clocks: Record<string, string>
  max_customer_boost_clocks: Partial<Record<string, string>>
  clock_policy: Record<string, string>
  voltage: Record<string, string>
  fabric: Record<string, string>
  supported_clocks: {
    supported_mem_clock: {
      value: string
      supported_graphics_clock: string[]
    }
  }
  processes?:
    | string
    | {
        process_info?: ProcessInfo | ProcessInfo[]
      }
  accounted_processes?: string
}

export interface MigDevice {
  index: string
  gpu_instance_id: string
  compute_instance_id: string
  device_attributes?: {
    shared: Record<string, string>
  }
  ecc_error_count?: {
    volatile_count: Record<string, string>
  }
  fb_memory_usage?: Record<string, string>
  bar1_memory_usage?: Record<string, string>
}

export interface ProcessInfo {
  gpu_instance_id?: string
  compute_instance_id?: string
  pid?: string
  type?: string
  process_name?: string
  used_memory?: string
}
