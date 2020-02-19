// Libraries
import React, {PureComponent} from 'react'
import _ from 'lodash'
import L, {LatLngExpression} from 'leaflet'

// components
import {
  CellName,
  HeadingBar,
  PanelHeader,
  Panel,
  PanelBody,
} from 'src/addon/128t/reusable/layout'

// type
import {ErrorHandling} from 'src/shared/decorators/errors'
import {Router, TopSource, TopSession} from 'src/addon/128t/types'
import {cellLayoutInfo} from 'src/addon/128t/containers/SwanSdplexStatusPage'

import 'leaflet/dist/leaflet.css'

let DefaultIcon = L.icon({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

export const routerIcon = new L.Icon({
  iconUrl: require('src/addon/128t/components/assets/marker-icon-normal.png'),
  iconRetinaUrl: require('src/addon/128t/components/assets/marker-icon-normal.png'),
  shadowUrl: require('src/addon/128t/components/assets/marker-icon-shadow.png'),
  iconAnchor: [16, 50],
  popupAnchor: [0, -45],
  iconSize: [40, 50],
  shadowSize: [40, 50],
})

export const routerIconOver = new L.Icon({
  iconUrl: require('src/addon/128t/components/assets/marker-icon-over.png'),
  iconRetinaUrl: require('src/addon/128t/components/assets/marker-icon-over.png'),
  shadowUrl: require('src/addon/128t/components/assets/marker-icon-shadow.png'),
  iconAnchor: [16, 50],
  popupAnchor: [0, -45],
  iconSize: [40, 50],
  shadowSize: [40, 50],
})

export interface Props {
  isEditable: boolean
  cellBackgroundColor: string
  cellTextColor: string
  routers: Router[]
  focusedAssetId: string
  onClickMapMarker: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedAssetId: string
  ) => void
  layout: cellLayoutInfo[]
}

interface State {
  defaultCenter: LatLngExpression
  defaultZoom: number
  map: L.Map
  marker: L.Marker[]
}

@ErrorHandling
class RouterMaps extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props)

    this.state = {
      defaultCenter: [36.5, 127.266667],
      defaultZoom: 6,
      map: null,
      marker: null,
    }
  }

  componentDidMount() {
    const streets = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
    })

    const map = L.map('map', {
      center: this.state.defaultCenter,
      zoom: this.state.defaultZoom,
      layers: [streets],
    })

    const marker = this.props.routers
      .filter((r: Router) => r.locationCoordinates != null)
      .map(r =>
        L.marker([
          r.locationCoordinates.indexOf('+', 2) != -1
            ? Number(
                r.locationCoordinates.substr(
                  0,
                  r.locationCoordinates.indexOf('+', 2)
                )
              )
            : Number(
                r.locationCoordinates.substr(
                  0,
                  r.locationCoordinates.indexOf('-', 2)
                )
              ),
          r.locationCoordinates.indexOf('+', 2) != -1
            ? Number(
                r.locationCoordinates
                  .substr(
                    r.locationCoordinates.indexOf('+', 2),
                    r.locationCoordinates.length
                  )
                  .replace('/', '')
              )
            : Number(
                r.locationCoordinates
                  .substr(
                    r.locationCoordinates.indexOf('-', 2),
                    r.locationCoordinates.length
                  )
                  .replace('/', '')
              ),
        ])
          .addTo(map)
          .bindPopup(r.assetId, {
            closeButton: false,
            closeOnEscapeKey: false,
            closeOnClick: false,
          })
          .setIcon(routerIcon)
          .addEventListener('click', this.onMarkerClick)
          .addEventListener('mouseover', this.onMarkerMouseOver)
          .addEventListener('mouseout', this.onMarkerMouseOut)
      )

    marker
      .filter(f => f.getPopup().getContent() === this.props.focusedAssetId)
      .map(m => m.openPopup())

    this.setState({map: map, marker: marker})
  }

  componentDidUpdate(nextProps: Props) {
    const {focusedAssetId, layout} = this.props

    if (layout !== nextProps.layout) {
      if (
        JSON.stringify(layout.filter(f => f.i === 'leafletMap')) !==
        JSON.stringify(nextProps.layout.filter(f => f.i === 'leafletMap'))
      ) {
        this.state.map.invalidateSize()
      }
    }

    if (focusedAssetId !== nextProps.focusedAssetId) {
      const focusedRouter = this.props.routers.find(
        r => r.assetId === focusedAssetId
      )

      if (focusedRouter.locationCoordinates !== null) {
        this.state.marker
          .filter(f => f.getPopup().getContent() === focusedAssetId)
          .map(m => m.openPopup())
      } else {
        this.state.marker.map(m => m.closePopup())
      }
    }
  }

  public onMarkerClick = event => {
    event.target.openPopup()

    this.props.routers
      .filter(f => f.assetId === event.target.getPopup().getContent())
      .map(m =>
        this.props.onClickMapMarker(m.topSources, m.topSessions, m.assetId)
      )
  }

  public onMarkerMouseOver = event => {
    event.target.setIcon(routerIconOver)
  }

  public onMarkerMouseOut = event => {
    event.target.setIcon(routerIcon)
  }

  public render() {
    const {isEditable, cellTextColor, cellBackgroundColor} = this.props
    return (
      <Panel>
        <PanelHeader isEditable={isEditable}>
          <CellName
            cellTextColor={cellTextColor}
            cellBackgroundColor={cellBackgroundColor}
            value={[]}
            name={'Routers in Map'}
            sizeVisible={false}
          />
          <HeadingBar
            isEditable={isEditable}
            cellBackgroundColor={cellBackgroundColor}
          />
        </PanelHeader>
        <PanelBody>{this.mapData}</PanelBody>
      </Panel>
    )
  }

  private get mapData() {
    return (
      <div className="router-map-container">
        <div id="map" style={{width: '100%', height: '100%'}} />
      </div>
    )
  }
}

export default RouterMaps
