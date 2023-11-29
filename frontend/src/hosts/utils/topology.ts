import _ from 'lodash'
import {eachNodeTypeAttrs} from '../constants/tools'

// Types
import {Host} from 'src/types'
import {fixedDecimalPercentage} from 'src/shared/utils/decimalPlaces'
import {
  DATA_GATHER_TYPE,
  keysWithGatherType,
  NOT_AVAILABLE_STATUS,
  titleWithGatherType,
  TOOLTIP_TYPE,
} from 'src/hosts/constants/topology'

export const getParseHTML = (
  targer: string,
  type: DOMParserSupportedType = 'text/html'
) => {
  const parser = new DOMParser()
  const parseHTML = parser.parseFromString(targer, type)

  return parseHTML
}

export const getContainerElement = (target: string): Element => {
  const doc = getParseHTML(target)
  const containerElement = doc.querySelector('.vertex')

  return containerElement
}

export const getContainerTitle = (element: Element) => {
  const title = element.querySelector('.mxgraph-cell--title > strong')

  return title
}

export const getFocusedHost = (element: Element) => {
  const host = element.getAttribute('data-name')

  return host
}

export const getIsDisableAttr = (
  containerElement: Element,
  attribute: any
): boolean => {
  let isDisable = false

  if (containerElement) {
    const getType = containerElement.getAttribute('data-type')

    const disableAttrs = _.map(
      eachNodeTypeAttrs?.[getType].disableAttrs,
      disableAttr => `data-${disableAttr}`
    )

    isDisable = _.includes(disableAttrs, attribute)
  }
  return isDisable
}

export const getIsHasString = (value: string): boolean => {
  return value !== ''
}

const getselectedTemperatureMinValue = (
  preferenceTemperatureValue: string
): number => {
  const selectedTemperatureMinValue = preferenceTemperatureValue
    .split(',')
    .find(splittedValue => splittedValue.includes(`min:`))
    .split(':')[1]

  return parseFloat(selectedTemperatureMinValue)
}

const getselectedTemperatureMaxValue = (
  preferenceTemperatureValue: string
): number => {
  const selectedTemperatureMaxValue = preferenceTemperatureValue
    .split(',')
    .find(splittedValue => splittedValue.includes(`max:`))
    .split(':')[1]

  return parseFloat(selectedTemperatureMaxValue)
}

const getIpmiTemperatureIndicator = (
  statusValue: string,
  selectedTemperatureValue: string
): string => {
  const temperatureMinValue = getselectedTemperatureMinValue(
    selectedTemperatureValue
  )
  const temperatureMaxValue = getselectedTemperatureMaxValue(
    selectedTemperatureValue
  )

  const currentValue = parseFloat(statusValue)

  if (currentValue - temperatureMinValue < 0 && currentValue >= 0) {
    return 'UsageIndacator-ipmi'
  }

  if (currentValue - temperatureMinValue < 0) {
    return null
  }

  const normalizedValue =
    ((currentValue - temperatureMinValue) /
      (temperatureMaxValue - temperatureMinValue)) *
    100

  if (normalizedValue >= 90) {
    return 'UsageIndacator-ipmi--danger'
  } else if (normalizedValue >= 70) {
    return 'UsageIndacator-ipmi--warning'
  } else if (normalizedValue >= 50) {
    return 'UsageIndacator-ipmi--caution'
  } else {
    return 'UsageIndacator-ipmi'
  }
}

export const getTimeSeriesHostIndicator = (
  host: Host,
  key: string,
  statusKind: string,
  statusValue: string,
  selectedTemperatureValue: string
): string => {
  if (statusValue === NOT_AVAILABLE_STATUS) {
    return null
  }
  if (statusKind === TOOLTIP_TYPE.temperature) {
    return getIpmiTemperatureIndicator(statusValue, selectedTemperatureValue)
  }

  let status = 'UsageIndacator'

  if (_.get(host, key, 0) >= 50) status = 'UsageIndacator--caution'
  if (_.get(host, key, 0) >= 70) status = 'UsageIndacator--warning'
  if (_.get(host, key, 0) >= 90) status = 'UsageIndacator--danger'

  return status
}

export const getSelectedHostKey = ({
  dataGatherType,
  statusKind,
  selectedTmpType,
}) => {
  return statusKind === TOOLTIP_TYPE.temperature
    ? keysWithGatherType[dataGatherType][statusKind][selectedTmpType]
    : keysWithGatherType[dataGatherType][statusKind]
}
export const getStatusTitle = ({dataGatherType, findKey}) =>
  titleWithGatherType[dataGatherType][findKey]

export const getNotAvailableTitle = ({statusKind, selectedTmpType}) =>
  titleWithGatherType.true[
    statusKind === TOOLTIP_TYPE.temperature ? selectedTmpType : statusKind
  ]

export const dataStatusValue = (
  statusKind: string,
  hostValue: number | undefined,
  host: Host,
  dataGatherType: string
) => {
  let statusValue = NOT_AVAILABLE_STATUS

  if (hostValue === undefined) {
    return statusValue
  }
  if (
    statusKind === TOOLTIP_TYPE.disk &&
    dataGatherType === DATA_GATHER_TYPE.ipmi
  ) {
    return statusValue
  }
  if (statusKind === TOOLTIP_TYPE.temperature) {
    statusValue = `${_.toString(hostValue.toFixed(2))} °C`
    return statusValue
  }
  if (
    dataGatherType === DATA_GATHER_TYPE.ipmi &&
    statusKind !== TOOLTIP_TYPE.temperature
  ) {
    statusValue = _.toString(
      fixedDecimalPercentage(parseFloat(_.toString(hostValue)), 2)
    )
    return statusValue
  }
  if (Math.max(host.deltaUptime || 0, host.winDeltaUptime || 0) > 0) {
    statusValue = _.toString(
      fixedDecimalPercentage(parseFloat(_.toString(hostValue)), 2)
    )
    return statusValue
  }

  return statusValue
}
