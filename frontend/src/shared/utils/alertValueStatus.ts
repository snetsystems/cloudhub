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
    case 4:
      return 'In Error Packet'
    case 5:
      return 'Out Error Packet'
    case 6:
      return 'In/Out Error Packet'
    default:
      return null
  }
}
