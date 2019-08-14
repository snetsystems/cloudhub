export const FIELD_DESCRIPTIONS = {
  cpu: {
    usage_guest:
      'Percentage of processor time used for guest (virtual machine) demand.',
    usage_guest_nice:
      'Time spent executing in user mode under nice priority for guest (virtual machine) demand.',
    usage_idle:
      'Percentage of time that the CPU or CPUs were idle \
      and the system did not have an outstanding disk I/O request.',
    usage_iowait: 'Time spent waiting on I/O or timer.',
    usage_irq: 'Time spent servicing hardware interrupts.',
    usage_nice: 'Time spent executing in user mode under nice priority.',
    usage_softirq: 'Time spent servicing software interrupts.',
    usage_steal:
      'Percentage of time spent in involuntary wait by the virtual CPU or CPUs \
      while the hypervisor was servicing another virtual processor.',
    usage_system: 'Time processes spent in system (kernel) mode.',
    usage_user: 'Percentage of time processes execute in user mode.',
    Percent_DPC_Time:
      'The processor spends receiving and servicing deferred procedure calls (DPCs).(%)',
    Percent_Idle_Time:
      'Percentage of time that the CPU or CPUs were idle \
    and the system did not have an outstanding disk I/O request.',
    Percent_Interrupt_Time:
      'Percentage of time that servicing hardware interrupts.',
    Percent_Privileged_Time:
      'In total CPU time, it is CPU utilization of system (kernel) excluding idle CPU time and user CPU time (User mode).',
    Percent_Processor_Time:
      'A single processor spent running a non-idle thread.(%)',
    Percent_User_Time: 'Percentage of time processes execute in user mode.',
  },
  disk: {
    free: 'the available capacity of the disk',
    inodes_free: 'the number of available inodes',
    inodes_total: 'the number of inodes',
    inodes_used: 'the number of used inodes',
    total: 'the total capacity of the disk',
    used: 'the used capacity of the disk',
    used_percent: 'the percentage of used inodes',
  },
  diskio: {
    io_time: 'The time in milliseconds that an I / O request was queued.',
    iops_in_progress: 'Number of I / O requests issued to the device',
    read_bytes: 'The number of bytes read from the block device',
    read_time:
      'The time in milliseconds that the block device waited for an I / O read request.',
    reads: 'Count of I / O read requests',
    weighted_io_time:
      'The time, in milliseconds, that an I / O request waited on a block device.',
    write_bytes: 'Number of bytes written by the block device',
    write_time:
      'The time, in milliseconds, that the block device waited for an I / O write request.',
    writes: 'Total disk volume',
  },
  mem: {
    active: 'active memory',
    available: 'available memory',
    available_percent:
      'Estimated memory available to run new applications without swapping',
    buffered: 'The amount of physical RAM used in the file buffer',
    cached: 'Memory cache (page cache) for files read from disk',
    commit_limit:
      'The total amount of memory (in bytes) that can be allocated to the current system',
    committed_as:
      'The amount of memory currently allocated to the system (even if it is not "used" in the process)',
    dirty: 'Memory pending to write back to disk',
    free: 'Amount of RAM available',
    high_free: 'Total amount of highmem available',
    high_total: 'Total amount of highmem ',
    huge_page_size: 'Size of Huge pages',
    huge_pages_free: 'Number of Huge pages not yet allocated in pool',
    huge_pages_total: 'Size of pool of Huge pages',
    inactive:
      'Less recently used memory. You are eligible for further refill for other purposes.',
    low_free: 'Total amount of effective lowmem',
    low_total: 'Total amount of lowmem',
    mapped: 'Files mapped to memory, such as libraries',
    page_tables:
      'The amount of memory dedicated to the lowest level page table.',
    shared: '',
    slab: 'In-kernel data structure cache.',
    swap_cached: 'The amout of cached swap',
    swap_free: 'The amount of swap space currently unused.',
    swap_total: 'The total amount of swap space available.',
    total: 'Total available RAM',
    used: '',
    used_percent: '',
    vmalloc_chunk: 'The largest contiguous block of free vmalloc area.',
    vmalloc_total: 'The total size of the vmalloc memory area.',
    vmalloc_used: 'The amount of vmalloc space used.',
    wired: '',
    write_back: 'Memory back on the disk',
    write_back_tmp: 'Memory used by FUSE as a temporary write buffer.',
  },
  processes: {
    blocked: 'aka disk sleep or uninterruptible sleep',
    dead: '',
    idle: '',
    paging: '',
    running: '',
    sleeping: '',
    stopped: '',
    total: '',
    total_threads: '',
    unknown: '',
    zombies: '',
  },
  swap: {
    free: 'Remaining swap memory',
    in: 'Data swapped since last boot',
    out: 'Exporting the entire program from memory',
    total: 'Total swqp memory',
    used: 'Swap memory in use',
    used_percent: 'Swap memory in use(%)',
  },
  system: {
    load1: 'Average CPU load during the last minute',
    load15: 'Average CPU load during the last 15 minute',
    load5: 'Average CPU load during the last 5 minute',
    n_cpus: 'Number of cpus',
    n_users: 'Number of users',
    uptime: 'Uptime after last reboot',
    uptime_format: 'Format for uptime',
  },
  win_disk: {
    Current_Disk_Queue_Length: 'The number of outstanding requests from disk',
    Free_Megabytes: 'the unallocated space on the disk drive in megabytes',
    Percent_Disk_Read_Time:
      'Percentage of time that the disk drive is processing read request',
    Percent_Disk_Time:
      'Percentage of time that the disk drive is processing read or write request',
    Percent_Disk_Write_Time:
      'Percentage of time that the disk drive is processing wirte request',
    Percent_Free_Space:
      'Percentage of tatal space available on the logical disk drive',
    Percent_Idle_Time: '',
  },
  win_diskio: {
    Current_Disk_Queue_Length: '',
    Disk_Read_Bytes_persec: '',
    Disk_Reads_persec: '',
    Disk_Write_Bytes_persec: '',
    Disk_Writes_persec: '',
    Percent_Disk_Read_Time: '',
    Percent_Disk_Time: '',
    Percent_Disk_Write_Time: 'a',
  },
  win_mem: {
    Available_Bytes: '',
    Cache_Faults_persec: '',
    Demand_Zero_Faults_persec: '',
    Page_Faults_persec: '',
    Pages_persec: '',
    Pool_Nonpaged_Bytes: '',
    Pool_Paged_Bytes: '',
    Standby_Cache_Core_Bytes: '',
    Standby_Cache_Normal_Priority_Bytes: '',
    Standby_Cache_Reserve_Bytes: '',
    Transition_Faults_persec: '',
  },
  win_net: {
    Bytes_Received_persec: '',
    Bytes_Sent_persec: '',
    Packets_Outbound_Discarded: '',
    Packets_Outbound_Errors: '',
    Packets_Received_Discarded: '',
    Packets_Received_Errors: '',
    Packets_Received_persec: '',
    Packets_Sent_persec: '',
  },
  win_proc: {
    Handle_Count: '',
    Percent_Processor_Time: '',
    Private_Bytes: '',
    Thread_Count: '',
    Virtual_Bytes: '',
    Working_Set: '',
  },
  win_swap: {
    Percent_Usage:
      'Displays the largest percentage of paging files used during the sample interval.',
  },
  win_system: {
    Context_Switches_persec: '',
    Processor_Queue_Length: '',
    System_Calls_persec: '',
    System_Up_Time: '',
  },
}
