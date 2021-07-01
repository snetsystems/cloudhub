import _ from 'lodash'
import {eachNodeTypeAttrs} from '../constants/tools'

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
