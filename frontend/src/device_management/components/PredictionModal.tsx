import React from 'react'
import {Scatter} from 'react-chartjs-2'
import {Form} from 'src/reusable_ui'

interface Props {
  isOpen: boolean
  setIsOpen: (value: boolean) => void
  data: any
  options: any
}
export const PredictionModal = ({isOpen, setIsOpen, data, options}: Props) => {
  return (
    <div className={`prediction-form ${isOpen ? 'open' : 'close'}`}>
      <div className={'overlay--heading'}>
        <div className="overlay--title">{'Prediction'}</div>
        <button className="overlay--dismiss" onClick={() => setIsOpen(false)}>
          close
        </button>
      </div>
      <div className="overlay--body">
        <Form>
          <Form.Element>
            <>
              <div className="prediction-chart-wrap">
                <Scatter
                  data={data}
                  options={options}
                  width={500}
                  height={300}
                />
              </div>
              <div className="prediction-chart-wrap">
                <Scatter
                  data={data}
                  options={options}
                  width={500}
                  height={300}
                />
              </div>
            </>
          </Form.Element>
          <Form.Footer>
            <div></div>
          </Form.Footer>
        </Form>
      </div>
    </div>
  )
}
