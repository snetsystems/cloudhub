export const vcenterCells = [
  {
    i: 'vcenter',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 96,
    h: 30,
  },
  {
    i: 'datacenters',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
]

export const datacenterCells = [
  {
    i: 'datacenter',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 96,
    h: 30,
  },
  {
    i: 'clusters',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
  {
    i: 'vmhosts',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
  {
    i: 'datastores',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
]

export const clusterCells = [
  {
    i: 'cluster',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
  {
    i: 'vmhosts',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
  {
    i: 'datastores',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
]

export const hostCells = [
  {
    i: 'vmhost',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 96,
    h: 30,
  },
  {
    i: 'vms',
    x: 0,
    y: 0,
    w: 96,
    h: 18,
  },
]

export const vmCells = [
  {
    i: 'vm',
    x: 0,
    y: 0,
    w: 96,
    h: 12,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 96,
    h: 30,
  },
]

export const getOpenStackPageLayouts = {
  superadmin: [
    {i: 'projectTable', x: 0, y: 0, w: 53, h: 30, minW: 20, minH: 8},
    {i: 'projectDetail', x: 53, y: 0, w: 43, h: 30, minW: 20, minH: 8},
    {i: 'instanceTable', x: 0, y: 8, w: 53, h: 30, minW: 20, minH: 8},
    {i: 'instanceDetail', x: 53, y: 8, w: 43, h: 30, minW: 20, minH: 8},
    {i: 'instanceGraph', x: 0, y: 16, w: 96, h: 30, minW: 20, minH: 8},
  ],
  other: [
    {i: 'projectDetail', x: 0, y: 0, w: 53, h: 30, minW: 20, minH: 8},
    {i: 'instanceTable', x: 0, y: 8, w: 43, h: 30, minW: 20, minH: 8},
    {i: 'instanceDetail', x: 53, y: 8, w: 43, h: 30, minW: 20, minH: 8},
    {i: 'instanceGraph', x: 0, y: 16, w: 96, h: 30, minW: 20, minH: 8},
  ],
}
