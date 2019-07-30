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
  },
  disk: {
    free: 'kkk',
    inodes_free: 'lll',
    inodes_total: 'mmm',
    inodes_used: 'nnn',
    total: 'ooo',
    used: 'ppp',
    used_percent: 'qqq',
  },
}
