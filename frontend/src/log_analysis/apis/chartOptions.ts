import {ChartOptions} from 'src/types'
import AJAX from 'src/utils/ajax'

const API_BASE_URL = '/cloudhub/v1/org_config'
const API_BASE_URL_LOG_ANALYSIS = '/cloudhub/v1/org_config/log-analysis'

export const saveChartOptions = async (chartOptions: ChartOptions) => {
  try {
    const response = await AJAX({
      data: chartOptions,
      url: API_BASE_URL_LOG_ANALYSIS,
      method: 'PUT',
    })

    return response
  } catch (error) {
    console.error(error)
    throw error
  }
}

export const getChartOptions = async () => {
  try {
    const response = await AJAX({
      url: API_BASE_URL,
      method: 'GET',
    })

    return response
  } catch (error) {
    console.error(error)
    throw error
  }
}
