export const vcenterCells = [
  {
    i: 'vcenter',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 12,
    h: 5,
  },
  {
    i: 'datacenters',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
]

export const datacenterCells = [
  {
    i: 'datacenter',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 12,
    h: 5,
  },
  {
    i: 'clusters',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
  {
    i: 'vmhosts',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
  {
    i: 'datastores',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
]

export const clusterCells = [
  {
    i: 'cluster',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
  {
    i: 'vmhosts',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
  {
    i: 'datastores',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
]

export const hostCells = [
  {
    i: 'vmhost',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 12,
    h: 5,
  },
  {
    i: 'vms',
    x: 0,
    y: 0,
    w: 12,
    h: 3,
  },
]

export const vmCells = [
  {
    i: 'vm',
    x: 0,
    y: 0,
    w: 12,
    h: 2,
  },
  {
    i: 'charts',
    x: 0,
    y: 0,
    w: 12,
    h: 5,
  },
]

export const getOpenStackPageLayouts = {
  superadmin: [
    {i: 'projectTable', x: 0, y: 0, w: 11, h: 8, minW: 5, minH: 2},
    {i: 'projectDetail', x: 11, y: 0, w: 9, h: 8, minW: 5, minH: 7},
    {i: 'instanceTable', x: 0, y: 8, w: 11, h: 8, minW: 5, minH: 2},
    {i: 'instanceDetail', x: 11, y: 8, w: 9, h: 8, minW: 5, minH: 5},
    {i: 'instanceGraph', x: 0, y: 16, w: 20, h: 8, minW: 10, minH: 8},
  ],
  other: [
    {i: 'projectDetail', x: 0, y: 0, w: 20, h: 8, minW: 5, minH: 7},
    {i: 'instanceTable', x: 0, y: 8, w: 11, h: 8, minW: 5, minH: 2},
    {i: 'instanceDetail', x: 11, y: 8, w: 9, h: 8, minW: 5, minH: 5},
    {i: 'instanceGraph', x: 0, y: 16, w: 20, h: 8, minW: 10, minH: 8},
  ],
}
