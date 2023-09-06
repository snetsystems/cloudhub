import _ from 'lodash'
import {eachNodeTypeAttrs} from '../constants/tools'

// Types
import {Host} from 'src/types'

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
  if (statusValue === 'N/A') {
    return null
  }
  if (statusKind === 'temperature') {
    return getIpmiTemperatureIndicator(statusValue, selectedTemperatureValue)
  }

  let status = 'UsageIndacator'

  if (_.get(host, key, 0) >= 50) status = 'UsageIndacator--caution'
  if (_.get(host, key, 0) >= 70) status = 'UsageIndacator--warning'
  if (_.get(host, key, 0) >= 90) status = 'UsageIndacator--danger'

  return status
}
