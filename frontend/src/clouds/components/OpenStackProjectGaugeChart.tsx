// libraries
import React, {PureComponent} from 'react'
import {AutoSizer} from 'react-virtualized'

// types
import {ColorString} from 'src/types/colors'
import {DecimalPlaces} from 'src/types/dashboards'

// components
import Gauge from 'src/shared/components/Gauge'

// constants
import {stringifyColorValues} from 'src/shared/constants/colorOperations'
import {DEFAULT_GAUGE_COLORS} from 'src/shared/constants/thresholds'

interface Props {
  gaugePosition: number
  gaugeName: string
  gaugeTitle: string
  gaugeChartSize: {width: string; height: string}
  resourceUsuage: string
  colors?: ColorString[]
  decimalPlaces?: DecimalPlaces
  prefix?: string
  suffix?: string
  resizerTopHeight?: number
}

interface State {}

export default class OpenStackProjectGaugeChart extends PureComponent<
  Props,
  State
> {
  public static defaultProps: Partial<Props> = {
    colors: stringifyColorValues(DEFAULT_GAUGE_COLORS),
    decimalPlaces: {
      isEnforced: false,
      digits: 2,
    },
    prefix: '',
    suffix: '',
  }

  constructor(props: Props) {
    super(props)
  }

  public render() {
    const {
      resourceUsuage,
      decimalPlaces,
      prefix,
      suffix,
      gaugeTitle,
      gaugeName,
      colors,
      gaugePosition,
      gaugeChartSize,
    } = this.props

    return (
      <AutoSizer style={gaugeChartSize}>
        {() => {
          return (
            <>
              <div className="gauge-container">
                <div className="gauge-title">
                  <div>{gaugeTitle}</div>
                </div>
                <div className="gauge-chart">
                  <Gauge
                    width="500"
                    colors={colors}
                    height={'300'}
                    prefix={prefix}
                    suffix={suffix}
                    gaugePosition={gaugePosition}
                    decimalPlaces={decimalPlaces}
                  />
                </div>
                <div className="gauge-label">
                  <div className="gauge-label-name">{gaugeName}</div>
                  <div className="gauge-label-info">{resourceUsuage}</div>
                </div>
              </div>
            </>
          )
        }}
      </AutoSizer>
    )
  }
}
