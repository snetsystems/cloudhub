// APIs
import {getQueryConfigAndStatus} from 'src/shared/apis'

// Utils
import templateReplace from 'src/tempVars/utils/replace'

// Constants
import {
  UNTITLED_GRAPH,
  NEW_DEFAULT_DASHBOARD_CELL,
} from 'src/dashboards/constants'
import {TEMPLATE_RANGE} from 'src/tempVars/constants'

const MAX_COLUMNS = 96

// Types
import {Cell, CellType, Dashboard, NewDefaultCell} from 'src/types/dashboards'
import {QueryConfig, DurationRange} from 'src/types/queries'
import {Template} from 'src/types'

const getMostCommonValue = (values: number[]): number => {
  const results = values.reduce(
    (acc, value) => {
      const {distribution, mostCommonCount} = acc
      distribution[value] = (distribution[value] || 0) + 1
      if (distribution[value] > mostCommonCount) {
        return {
          distribution,
          mostCommonCount: distribution[value],
          mostCommonValue: value,
        }
      }
      return acc
    },
    {distribution: {}, mostCommonCount: 0, mostCommonValue: null}
  )

  return results.mostCommonValue
}

export const isCellUntitled = (cellName: string): boolean => {
  return cellName === UNTITLED_GRAPH
}

export const getNextAvailablePosition = (cells, newCell) => {
  const farthestY = cells.map(cell => cell.y).reduce((a, b) => (a > b ? a : b))

  const bottomCells = cells.filter(cell => cell.y === farthestY)
  const farthestX = bottomCells
    .map(cell => cell.x)
    .reduce((a, b) => (a > b ? a : b))
  const lastCell = bottomCells.find(cell => cell.x === farthestX)

  const availableSpace = MAX_COLUMNS - (lastCell.x + lastCell.w)
  const newCellFits = availableSpace >= newCell.w

  return newCellFits
    ? {
        x: lastCell.x + lastCell.w,
        y: farthestY,
      }
    : {
        x: 0,
        y: lastCell.y + lastCell.h,
      }
}

export const getNewDashboardCell = (
  dashboard: Dashboard,
  cellType: CellType = CellType.Line
): NewDefaultCell => {
  const typedCell = {
    ...NEW_DEFAULT_DASHBOARD_CELL,
    type: cellType,
    name: UNTITLED_GRAPH,
  }

  if (dashboard.cells.length === 0) {
    return typedCell
  }

  const existingCellWidths = dashboard.cells.map(cell => cell.w)
  const existingCellHeights = dashboard.cells.map(cell => cell.h)

  const mostCommonCellWidth = getMostCommonValue(existingCellWidths)
  const mostCommonCellHeight = getMostCommonValue(existingCellHeights)

  const newCell = {
    ...typedCell,
    w: mostCommonCellWidth,
    h: mostCommonCellHeight,
  }

  const {x, y} = getNextAvailablePosition(dashboard.cells, newCell)

  return {
    ...newCell,
    x,
    y,
  }
}

const incrementCloneName = (cellNames: string[], cellName: string): string => {
  const rootName = cellName.replace(/\s\(clone\s(\d)+\)/g, '').replace(/\)/, '')

  const filteredNames = cellNames.filter(cn => cn.includes(rootName))

  const highestNumberedClone = filteredNames.reduce((acc, name) => {
    if (name.match(/\(clone(\s|\d)+\)/)) {
      const strippedName = name
        .replace(rootName, '')
        .replace(/\(clone/, '')
        .replace(/\)/, '')

      const cloneNumber = Number(strippedName)

      return cloneNumber >= acc ? cloneNumber : acc
    }

    return acc
  }, 0)

  if (highestNumberedClone) {
    const newCloneNumber = highestNumberedClone + 1
    return `${cellName.replace(
      /\(clone\s(\d)+\)/,
      ''
    )} (clone ${newCloneNumber})`
  }

  return `${cellName} (clone 1)`
}

export const getClonedDashboardCell = (
  dashboard: Dashboard,
  cellClone: Cell
): Cell => {
  const cellNames = dashboard.cells.map(c => c.name)
  const name = incrementCloneName(cellNames, cellClone.name)

  const cellCloneFitsLeft = cellClone.x >= cellClone.w
  const cellCloneFitsRight =
    MAX_COLUMNS - (cellClone.w + cellClone.x) >= cellClone.w

  if (cellCloneFitsRight) {
    return {...cellClone, x: cellClone.x + cellClone.w, name}
  }

  if (cellCloneFitsLeft) {
    return {...cellClone, x: cellClone.x - cellClone.w, name}
  }

  return {...cellClone, y: cellClone.y + cellClone.h, name}
}

export const getTimeRange = (queryConfig: QueryConfig): DurationRange => {
  return getRangeForOriginalQuery(queryConfig.originalQuery, queryConfig.range)
}

const getRangeForOriginalQuery = (
  originalQuery: string,
  range: DurationRange
): DurationRange => {
  const isUsingDashTime =
    range && originalQuery && originalQuery.indexOf(TEMPLATE_RANGE.lower) !== -1

  if (isUsingDashTime || !range) {
    return TEMPLATE_RANGE
  }

  return range
}

export const getConfig = async (
  url,
  id: string,
  query: string,
  templates: Template[]
): Promise<QueryConfig> => {
  const renderedQuery = templateReplace(query, templates)

  const queries = await getQueryConfigAndStatus(url, [
    {query: renderedQuery, id},
  ])
  const {queryConfig} = queries.find(q => q.id === id)

  const range = getRangeForOriginalQuery(query, queryConfig.range)

  separateGroupByClause(renderedQuery)

  if (
    queryConfig.database === '' &&
    queryConfig.measurement === '' &&
    queryConfigParser !== null &&
    (renderedQuery.includes('derivative') ||
      renderedQuery.includes('non_negative_derivative'))
  ) {
    return {
      ...queryConfigParser(renderedQuery),
      ...queryConfig,
      originalQuery: query,
      range,
    }
  } else {
    return {
      ...queryConfig,
      originalQuery: query,
      range,
    }
  }
}

export const queryConfigParser = (query: string) => {
  const splitQuery = query.split('WHERE')

  const backQuery = splitQuery[1]

  const frontQuery = splitQuery[0].split('SELECT')

  if (frontQuery.length > 2) {
    //subquery filter
    return null
  }

  const frontSplitQuery = frontQuery[1]?.split('FROM')

  const selectClause = frontSplitQuery[0]

  const fromClause = frontSplitQuery[1].replaceAll(' ', '').replaceAll(`\"`, '')

  const backQuerySplit = backQuery.split('FILL')

  const whereClause = backQuerySplit[0].split('GROUP BY')[0]

  const groupByClause = backQuerySplit[0].split('GROUP BY')[1]

  const fillClause = backQuerySplit[1]

  const areTagsAccepted: boolean = !whereClause.includes('!=')

  const calcRegex = /([\+\-\*\/]+)/g
  if (calcRegex.test(selectClause)) {
    return null
  }

  return {
    ...parseFromClause(fromClause),
    fields: parseSelectClause(selectClause),
    areTagsAccepted: areTagsAccepted,
    groupBy: parseGroupByClause(groupByClause) ?? null,
    tags: parseWhereClause(whereClause, areTagsAccepted) ?? {},
    fill: parseFillClause(fillClause) ?? 'null',
  }
}

export const parseSelectClause = (input: string) => {
  const modifiedString = input
    .replace(/ AS /g, '') // AS remove
    .replace(/\"|\s*\s*/g, '') // space remove
    .split(/,(?![^(]*\))/) // string to array

  const modifiedArray = modifiedString.map(i =>
    i.split(/AS\s+"|,\s*|\)\s*|\(\s*|\\+"/).filter(i => !!i)
  )

  // const tempSubFunc = subFuncHandler(modifiedArray)
  const result = modifiedArray.map(item => {
    const arg = []
    if (item.length > 4) {
      arg[0] = {
        value: item[2]?.replaceAll(' ', ''),
        type: 'field',
        alias: '',
      }

      return {
        type: 'func',
        args: arg,
        value: item[1]?.replaceAll(' ', '') ?? '',
        alias: item[item.length - 1]?.replace('AS ', '') ?? '',
        subFunc: item[0],
      }
    } else if (item[0] === 'derivative' || 'non_negative_derivative') {
      arg[0] = {
        value: item[1]?.replaceAll(' ', ''),
        type: 'field',
        alias: '',
      }
      return {
        type: 'func',
        args: arg,
        value: item[0]?.replaceAll(' ', '') ?? '',
        alias: item[item.length - 1]?.replace('AS ', '') ?? '',
      }
    } else {
      arg[0] = {
        value: item[1]?.replaceAll(' ', ''),
        type: 'field',
        alias: '',
      }
      return {
        type: 'func',
        args: arg,
        value: item[0]?.replaceAll(' ', '') ?? '',
        alias: item[2]?.replace('AS ', '') ?? '',
      }
    }
  })

  return result
}

export const subFuncHandler = (modifiedArray: string[][]) => {
  const tempSubFunc = new Map()
  const result = {}

  modifiedArray.forEach(i => {
    if (i.length > 3) {
      tempSubFunc.set(
        i[2],
        !!tempSubFunc.get(i[2])
          ? [...(tempSubFunc.get(i[2]) ?? null), i[0]]
          : [i[0]]
      )
    }
  })

  for (const [key, value] of tempSubFunc) {
    result[key] = value
  }

  return result
}

export const parseFromClause = (input: string) => {
  const fromAry = input.split('.')

  return {
    database: fromAry[0],
    retentionPolicy: fromAry[1],
    measurement: fromAry[2],
  }
}

export const parseWhereClause = (input: string, areTagsAccepted: boolean) => {
  const whereClause = input.split('AND').filter(i => !i.includes('time'))

  if (whereClause.length === 0) {
    return null
  }
  if (areTagsAccepted) {
    return parseWhereAccTag(whereClause)
  } else {
    return parseWhereNegTag(whereClause)
  }
}

export const parseWhereNegTag = (whereAry: string[]) => {
  const keyValuePairs = {}

  whereAry.forEach(input => {
    input
      .replace(/["()'! ]/g, '')
      .split('AND')
      .forEach(item => {
        let [key, value] = item.split('=')
        key = key?.replace(/['"]/g, '')
        value = value?.replace(/['"]/g, '')
        if (!keyValuePairs[key]) {
          keyValuePairs[key] = []
        }
        keyValuePairs[key].push(value)
      })
  })

  return keyValuePairs
}

export const parseWhereAccTag = (whereAry: string[]) => {
  let keyValuePairs = {}
  whereAry.forEach(input => {
    input
      .replace(/["()'! ]/g, '')
      .split('OR')
      .forEach(item => {
        let [key, value] = item.split('=')
        key = key?.replace(/['"]/g, '')
        value = value?.replace(/['"]/g, '')
        if (key && value) {
          if (!keyValuePairs[key]) {
            keyValuePairs[key] = []
          }
          keyValuePairs[key].push(value)
        }
      })
  })

  return keyValuePairs
}

export const parseGroupByClause = (input: string | null) => {
  let time = ''
  if (input === null) {
    return {
      tags: [],
      time: time,
    }
  }

  const temp = groupByTagPick(input.toUpperCase())
  const tags = temp
    .toLowerCase()
    ?.split(',')
    ?.map(i => {
      if (i.includes('time(')) {
        let regex = /(time|[^a-zA-Z0-9:]+)/g
        if (i.replaceAll(regex, '') === ':interval:') {
          time = 'auto'
        } else {
          time = i.replaceAll(regex, '')
        }
      } else {
        let regex = /([\"\'\s]+)/g
        return i.replaceAll(regex, '')
      }
    })
    .filter(i => !!i)

  return {
    tags: tags ?? [],
    time: time,
  }
}

export const parseFillClause = (input: string | null) => {
  let regex = /([^a-zA-Z0-9:]+)/g
  return groupByTagPick(input?.replace(regex, ''))
}

//return GroupBy Clause tag ary
export const separateGroupByClause = (input: string) => {
  const reg = /\(([^()]+)\)/g
  const seperate = input.toUpperCase().split('GROUP BY')
  if (seperate[seperate.length - 1].replaceAll(reg, '').includes(')')) {
    return parseGroupByClause(null)
  } else {
    return parseGroupByClause(groupByTagPick(seperate[seperate.length - 1]))
  }
}

export const groupByTagPick = (input: string) => {
  const soffset = input?.split('SOFFSET') ?? ''
  const slimit = soffset[0].split('SLIMIT')
  const offset = slimit[0].split('OFFSET')
  const limit = offset[0].split('LIMIT')
  const oderby = limit[0].split('ORDER BY')
  const fill = oderby[0].split('FILL')[0]
  return fill?.toLowerCase()
}
