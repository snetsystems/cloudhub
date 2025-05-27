import {BaseElasticSearchData} from 'src/types'
import {CreateElasticSearchParams} from 'src/types/elasticSearch'
import AJAX from 'src/utils/ajax'

export const APPLY_LEARNING_ENABLE_STATUS_URL = '/cloudhub/v1/es'

export const getElasticSearchInfo = async (): Promise<
  BaseElasticSearchData[]
> => {
  try {
    const response = await AJAX({
      url: APPLY_LEARNING_ENABLE_STATUS_URL,
      method: 'GET',
    })

    if (!response || !response.data.esSources) {
      console.error('Invalid response format:', response)
      return []
    }

    const {data} = response
    return data.esSources || []
  } catch (error) {
    console.error('Failed to fetch ElasticSearch info:', error)
    return []
  }
}

export const getElasticSearchInfoById = async (
  id: string
): Promise<BaseElasticSearchData> => {
  try {
    const response = await AJAX({
      url: APPLY_LEARNING_ENABLE_STATUS_URL + '/' + id,
      method: 'GET',
    })

    if (!response || !response.data.esSources) {
      console.error('Invalid response format:', response)
      throw new Error('Failed to fetch ElasticSearch info')
    }

    const {data} = response
    return data
  } catch (error) {
    console.error('Failed to fetch ElasticSearch info:', error)
    return null
  }
}

export const createElasticSearchInfo = async (
  params: CreateElasticSearchParams
): Promise<BaseElasticSearchData> => {
  try {
    const response = await AJAX({
      url: APPLY_LEARNING_ENABLE_STATUS_URL,
      method: 'POST',
      data: params,
    })

    if (!response) {
      console.error('Invalid response format:', response)
      throw new Error('Failed to create ElasticSearch info')
    }

    const {data} = response
    return data
  } catch (error) {
    console.error('Failed to create ElasticSearch info:', error)
    throw error
  }
}

export const deleteElasticSearchInfo = async (id: string): Promise<boolean> => {
  try {
    const response = await AJAX({
      url: APPLY_LEARNING_ENABLE_STATUS_URL + '/' + id,
      method: 'DELETE',
    })

    if (!response) {
      console.error('Invalid response format:', response)
      throw new Error('Failed to delete ElasticSearch info')
    }

    return true
  } catch (error) {
    console.error('Failed to delete ElasticSearch info:', error)
    throw error
  }
}

export const updateElasticSearchInfo = async (
  params: CreateElasticSearchParams
): Promise<BaseElasticSearchData> => {
  try {
    const response = await AJAX({
      url: APPLY_LEARNING_ENABLE_STATUS_URL + '/' + params.id,
      method: 'PATCH',
      data: params,
    })

    if (!response) {
      console.error('Invalid response format:', response)
      throw new Error('Failed to update ElasticSearch info')
    }

    return response.data
  } catch (error) {
    console.error('Failed to update ElasticSearch info:', error)
    throw error
  }
}
