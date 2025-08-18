import {ChartOptions} from 'src/types'
import AJAX from 'src/utils/ajax'

const API_BASE_URL = '/cloudhub/v1/org_config/log-analysis'

export const saveChartOptions = async (chartOptions: ChartOptions) => {
  try {
    const response = await AJAX({
      data: chartOptions,
      url: API_BASE_URL,
      method: 'PUT',
    })

    return response
  } catch (error) {
    console.error(error)
    throw error
  }
}
