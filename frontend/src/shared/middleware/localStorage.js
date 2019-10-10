export const setLocalStorage = (key, value) => {
  return window.localStorage.setItem(key, JSON.stringify(value))
}

export const getLocalStorage = key => {
  const getItem = window.localStorage.getItem(key)
  return getItem ? JSON.parse(getItem) : null
}

export const removeLocalStorage = key => {
  return window.localStorage.removeItem(key)
}

export const verifyLocalStorage = (fnExpr, fnTrue, key, value) => {
  const expr = fnExpr(key)
  // eslint-disable-next-line no-negated-condition
  return !expr ? fnTrue(key, value) : {}
}
