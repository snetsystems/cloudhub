export type HostInfoWithSalt = {
  master: string
  cpu_model: string
  num_cpus: string
  os: string
  oscodename: string
  osrelease: string
  kernel: string
  kernelrelease: string
  kernelversion: string
  cpuarch: string
  init: string
  num_gpus: string
  os_family: string
  osarch: string
  mem_total: string
  swap_total: string
  virtual: string
  shell: string
  username: string
  groupname: string
  locale_info: {
    defaultlanguage: string
    defaultencoding: string
    detectedencoding: string
    timezone: string
  }
  ip_interfaces: {
    [x in string]: string[]
  }
  ip4_gw: string | boolean
  ip6_gw: string | boolean
  dns: {
    nameservers: string[]
    ip4_nameservers: string[]
    ip6_nameservers: string[]
    sortlist: string[]
    domain: string
    search: string[]
    options: string[]
  }
  ip4_interfaces: {
    [x in string]: string[]
  }
  ip6_interfaces: {
    [x in string]: string[]
  }
  gpus: string[] | object[]
  biosversion: string
  selinux: {
    [x in string]: string[] | string | boolean
  }
  biosreleasedate: string
  manufacturer: string
  path: string
  localhost: string
}

export type HostDetailTable = {
  [tableHeader: string]: {
    name: string
    role: string
    data: {
      [key: string]: object | string | string[] | boolean | number | object[]
    }
  }
}
