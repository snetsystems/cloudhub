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

export const getIsDisableName = (containerElement: Element): boolean => {
  let isDisableName = false

  if (containerElement) {
    isDisableName =
      containerElement.getAttribute('data-isdisablename') === 'true'
  }

  return isDisableName
}

export const getIsHasString = (value: string): boolean => {
  return value !== ''
}
