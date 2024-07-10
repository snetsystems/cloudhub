export const alertValueStatus = (value: number) => {
  switch (value) {
    case 0:
      return 'OK'
    case 1:
      return 'ML Predict'
    case 2:
      return 'DL Predict'
    case 3:
      return 'ML+DL Predict'
    default:
      return null
  }
}
