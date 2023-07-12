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

export const getTimeSeriesHostIndicator = (host: Host, key: string): string => {
  if (Math.max(host.deltaUptime || 0, host.winDeltaUptime || 0) > 0) {
    let status = 'UsageIndacator'

    if (_.get(host, key, 0) >= 50) status = 'UsageIndacator--caution'
    if (_.get(host, key, 0) >= 70) status = 'UsageIndacator--warning'
    if (_.get(host, key, 0) >= 90) status = 'UsageIndacator--danger'

    return status
  } else {
    return null
  }
}
