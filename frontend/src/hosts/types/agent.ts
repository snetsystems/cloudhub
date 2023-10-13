export type HostInfoWithSalt = {
  saltversion: string
  master: string
  os_family: string
  os: string
  osrelease: string
  kernel: string
  kernelrelease: string
  kernelversion: string
  virtual: string
  cpuarch: string
  cpu_model: string
  localhost: string
  ip_interfaces: {
    [x in string]: string[]
  }
  ip6_interfaces: {
    [x in string]: string[]
  }
  ip4_gw: string | boolean
  ip6_gw: string | boolean
  'dns:nameservers': string
  locale_info: {
    defaultlanguage: string
    defaultencoding: string
    detectedencoding: string
    timezone: string
  }

  biosversion: string
  mem_total: string
  swap_total: string
  gpus: {
    [x in string]: string[]
  }[]
  selinux: string
  path: string
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
