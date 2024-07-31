import React from 'react'
import {Form} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import _ from 'lodash'
import PredictionModalDLChart from './PredictionModalDLChart'
import PredictionModalMLChart from './PredictionModalMLChart'

interface Props {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  isMl: boolean
  isDl: boolean
  host: string
}

// SVG Hexbin on/off split
export const PredictionModal = ({
  isOpen,
  setIsOpen,
  isMl,
  isDl,
  host,
}: Props) => {
  return (
    <div className={`prediction-form ${isOpen ? 'open' : 'close'}`}>
      <FancyScrollbar autoHeight={true} maxHeight={800} autoHide={false}>
        <div className={'overlay--heading'}>
          <div className="overlay--title">{'Prediction'}</div>
          <button className="overlay--dismiss" onClick={() => setIsOpen(false)}>
            close
          </button>
        </div>

        <div className="overlay--body">
          <Form>
            <Form.Element>
              {
                <>
                  {isMl && <PredictionModalMLChart host={host} />}
                  {isDl && <PredictionModalDLChart host={host} />}
                </>
              }
            </Form.Element>
            <Form.Footer>
              <div></div>
            </Form.Footer>
          </Form>
        </div>
      </FancyScrollbar>
    </div>
  )
}
