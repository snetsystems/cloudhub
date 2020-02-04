import React, {SFC} from 'react'
import ReactTooltip from 'react-tooltip'
import {Router} from 'src/addon/128t/types'

interface Props {
  locationCoordinates: Router['locationCoordinates']
}

const GeoLocationIndicator: SFC<Props> = locationCoordinates => {
  let locationText = `<p>${locationCoordinates.locationCoordinates.replace(
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
