import React, {useEffect, useState} from 'react'

// Library
import _, {debounce} from 'lodash'

// Components
import {Form} from 'src/reusable_ui'
import FancyScrollbar from 'src/shared/components/FancyScrollbar'
import PredictionModalDLChart from 'src/device_management/components/PredictionModalDLChart'
import PredictionModalMLChart from 'src/device_management/components/PredictionModalMLChart'

// Constant
import {MODAL_HEIGHT} from 'src/device_management/constants'
import {ModalSizeContext} from 'src/device_management/constants/prediction'

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
  const [height, setHeight] = useState(MODAL_HEIGHT)

  useEffect(() => {
    window.addEventListener('resize', () => handleResize())

    return window.removeEventListener('resize', () => handleResize())
  }, [])

  const handleResize = debounce(() => {
    setHeight(window.innerHeight * 0.85)
  }, 200)

  return (
    <div className={`prediction-form ${isOpen ? 'open' : 'close'}`}>
      <FancyScrollbar autoHeight={true} maxHeight={height} autoHide={false}>
        <div className={'overlay--heading'}>
          <div className="overlay--title">{'Learning Plot'}</div>
          <button className="overlay--dismiss" onClick={() => setIsOpen(false)}>
            close
          </button>
        </div>

        <div className="overlay--body">
          <Form>
            <Form.Element>
              {
                <ModalSizeContext.Provider value={{height: height * 0.3}}>
                  {isMl && <PredictionModalMLChart host={host} />}
                  {isDl && <PredictionModalDLChart host={host} />}
                </ModalSizeContext.Provider>
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
