import React, {FunctionComponent} from 'react'
import ReactTooltip from 'react-tooltip'
import {RouterNode} from 'src/addon/128t/types'

interface Props {
  locationCoordinates: RouterNode['locationCoordinates']
}

const GeoLocationIndicator: FunctionComponent<Props> = (
  locationCoordinates
) => {
  const locationText = `<p class="test_locationCoordinates">${locationCoordinates.locationCoordinates.replace(
    '/',
    ''
  )}</p>`
  const imgUrl = require('src/addon/128t/components/assets/marker-icon-normal.png')

  return (
    <div
      className="geoLocationIndicator-connect-tips"
      data-for="geoLocationIndicator-connect-tips-tooltip"
      data-tip={locationText}
    >
      <img src={imgUrl} style={{width: '20px', cursor: ''}} />
      <ReactTooltip
        id="geoLocationIndicator-connect-tips-tooltip"
        effect="solid"
        html={true}
        place="right"
        class="influx-tooltip"
      />
    </div>
  )
}

export default GeoLocationIndicator
