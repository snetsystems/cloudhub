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
import {RouterNode, TopSource, TopSession} from 'src/addon/128t/types'
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
  routerNodes: RouterNode[]
  focusedNodeName: string
  onClickMapMarker: (
    topSources: TopSource[],
    topSessions: TopSession[],
    focusedNodeName: string
  ) => void
  layout: cellLayoutInfo[]
}

interface State {
  map: L.Map
  marker: L.Marker[]
}

@ErrorHandling
class RouterMaps extends PureComponent<Props, State> {
  private connectLine: L.Polyline = null
  private defaultCenter: LatLngExpression = [36.5, 127.266667]
  private defaultZoom: number = 6

  constructor(props: Props) {
    super(props)

    this.state = {
      map: null,
      marker: null,
    }
  }

  componentDidMount() {
    const streets = L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
    })

    const map = L.map('map', {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
      layers: [streets],
    })

    const marker = this.props.routerNodes
      .filter((r: RouterNode) => r.locationCoordinates != null)
      .map((r) =>
        L.marker([
          this.getCoordLatLng(r.locationCoordinates, 'lat'),
          this.getCoordLatLng(r.locationCoordinates, 'lng'),
        ])
          .addTo(map)
          .bindPopup(r.nodeName, {
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
      .filter((f) => f.getPopup().getContent() === this.props.focusedNodeName)
      .map((m) => m.openPopup())

    const focusedRouter = this.props.routerNodes.filter(
      (f) => f.nodeName === this.props.focusedNodeName
    )

    if (focusedRouter.length > 0) {
      if (focusedRouter[0].locationCoordinates !== null) {
        map.setView(
          [
            focusedRouter.map((m) => {
              if (m.locationCoordinates !== null) {
                return this.getCoordLatLng(m.locationCoordinates, 'lat')
              } else {
                return this.defaultCenter[0]
              }
            })[0],
            focusedRouter.map((m) => {
              if (m.locationCoordinates !== null) {
                return this.getCoordLatLng(m.locationCoordinates, 'lng')
              } else {
                return this.defaultCenter[1]
              }
            })[0],
          ],
          this.defaultZoom
        )
      }
    }

    this.setState({map: map, marker: marker})
  }

  componentDidUpdate(nextProps: Props) {
    const {focusedNodeName, layout} = this.props

    if (layout !== nextProps.layout) {
      if (
        JSON.stringify(layout.filter((f) => f.i === 'leafletMap')) !==
        JSON.stringify(nextProps.layout.filter((f) => f.i === 'leafletMap'))
      ) {
        this.state.map.invalidateSize()
      }
    }

    if (focusedNodeName !== nextProps.focusedNodeName) {
      const focusedRouter = this.props.routerNodes.find(
        (r) => r.nodeName === focusedNodeName
      )

      if (focusedRouter.locationCoordinates !== null) {
        this.state.marker
          .filter(
            (f) => f.getPopup().getContent() === this.props.focusedNodeName
          )
          .map((m) => m.openPopup())
      } else {
        this.state.marker.map((m) => m.closePopup())
      }
    }
  }

  public onMarkerClick = (event) => {
    const {routerNodes, onClickMapMarker} = this.props

    event.target.openPopup()

    routerNodes
      .filter((f) => f.nodeName === event.target.getPopup().getContent())
      .map((m) => onClickMapMarker(m.topSources, m.topSessions, m.nodeName))
  }

  public onMarkerMouseOver = (event) => {
    this.setPeerPolyLine(
      event.target.getLatLng().lat,
      event.target.getLatLng().lng
    )
    event.target.setIcon(routerIconOver)
  }

  public onMarkerMouseOut = (event) => {
    event.target.setIcon(routerIcon)
    this.state.map.removeLayer(this.connectLine)
  }

  private setPeerPolyLine = (pLat: number, pLng: number) => {
    const {routerNodes} = this.props
    const selectRouter = routerNodes.filter(
      (f) =>
        this.getCoordLatLng(f.locationCoordinates, 'lat') === pLat &&
        this.getCoordLatLng(f.locationCoordinates, 'lng') === pLng
    )[0]

    const sourceLatLng = {
      lat: this.getCoordLatLng(selectRouter.locationCoordinates, 'lat'),
      lng: this.getCoordLatLng(selectRouter.locationCoordinates, 'lng'),
    }

    const peersLatLng = selectRouter.peers.map((m) => {
      return [
        sourceLatLng,
        routerNodes
          .filter((f) => f.nodeName === m.name)
          .map((rm) => {
            if (rm.locationCoordinates !== null) {
              return {
                lat: this.getCoordLatLng(rm.locationCoordinates, 'lat'),
                lng: this.getCoordLatLng(rm.locationCoordinates, 'lng'),
              }
            } else {
              return sourceLatLng
            }
          })[0],
      ]
    })

    this.connectLine = L.polyline(peersLatLng, {color: '#9a9ea9'}).addTo(
      this.state.map
    )
  }

  private getCoordLatLng(pLatLng: string, pCoordLatLang: string) {
    if (pCoordLatLang === 'lat') {
      if (pLatLng !== null) {
        return pLatLng.indexOf('+', 2) != -1
          ? Number(pLatLng.substr(0, pLatLng.indexOf('+', 2)))
          : Number(pLatLng.substr(0, pLatLng.indexOf('-', 2)))
      } else {
        return null
      }
    } else {
      if (pLatLng !== null) {
        return pLatLng.indexOf('+', 2) != -1
          ? Number(
              pLatLng
                .substr(pLatLng.indexOf('+', 2), pLatLng.length)
                .replace('/', '')
            )
          : Number(
              pLatLng
                .substr(pLatLng.indexOf('-', 2), pLatLng.length)
                .replace('/', '')
            )
      } else {
        return null
      }
    }
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
            name={'Routers on Map'}
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
