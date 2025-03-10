import {createContext} from 'react'

export const PREDICTION_TOOLTIP_TABLE_SIZING = {
  TABLE_ROW_IN_HEADER: '45%',
  TABLE_ROW_IN_BODY: '55%',
}
export const PREDICTION_TOOLTIP_HEADER = '100%'

export const TOOLTIP_OFFSET_X = 40
export const TOOLTIP_WIDTH = 150

export const OUTLINE = 58
export const DETECT_RATE = 0.85
export const STATIC_TOOLTIP_HEIGHT = 147

export const MODAL_HEIGHT = window.innerHeight * 0.85
export const CHART_HEIGHT = window.innerHeight * 0.3

export const TIME_GAP = 7200000

export const DEFAULT_GROUP_BY = 1

export const ANOMALY_INITIAL = {
  host: '',
  time: '',
}

export const ModalSizeContext = createContext({height: MODAL_HEIGHT})
