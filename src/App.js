import React, { Component } from 'react';
import Banner from './Banner';
import RouteDetails from './RouteDetails';
import SearchDetails from './SearchDetails';
import MapGL from 'react-map-gl';
import Geocoder from 'react-map-gl-geocoder';
import DeckGL, { GeoJsonLayer } from 'deck.gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import mapboxgl from 'mapbox-gl';
import mbxClient from '@mapbox/mapbox-sdk';
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import * as turf from '@turf/helpers'
import nearestPointOnLine from '@turf/nearest-point-on-line'
import along from '@turf/along'
const geoViewport = require('@mapbox/geo-viewport');

const baseClient = mbxClient({ accessToken: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN });
const directionsService = mbxDirections(baseClient);


function simulateLocation(routeGeometry, routeDistance, cb) {
  const NUM_SIMULATED_POINTS = 1000;
  const UPDATE_FREQUENCY_MS = 100; // 0.01Hz

  const distanceIncrement = routeDistance / 1000 / NUM_SIMULATED_POINTS;
  let step = 0;

  function updateLocation() {
    step = step + 1;
    const point = along(routeGeometry, step * distanceIncrement, { units: 'kilometers' });

    cb({
      coords: {
        longitude: point.geometry.coordinates[0],
        latitude: point.geometry.coordinates[1],
      },
      timestamp: Date.now()
    })
  }

  return setInterval(() => {
    if (step < NUM_SIMULATED_POINTS) updateLocation();
  }, UPDATE_FREQUENCY_MS)

}


function requestDirections(start, end) {
  const options = {
    profile: 'driving-traffic',
    geometries: 'geojson',
    overview: 'full',
    steps: true,
    bannerInstructions: true,
    waypoints: [{
      coordinates: start
    }, {
      coordinates: end
    }]
  };

  return directionsService
    .getDirections(options)
    .send()
    .then((response) => response.body.routes)
}

function requestGeolocation() {
  return new Promise((resolve, reject) => {
    resolve({
      coords: {
        latitude: 38.8980586,
        longitude: -77.1876467
      }
    });
    // navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

function watchGeolocation(onSuccess, onError) {
  return navigator.geolocation.watchPosition(onSuccess, onError, {
    enableHighAccuracy: true,
    maximumAge: 5000
  });
}

class App extends Component {

  state = {
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight - 100,
      latitude: 38.8980586,
      longitude: -77.1876467,
      zoom: 16,
      maxZoom: 18,
      transitionDuration: 1000
    },
    geolocationWatcher: null,
    currentPosition: {
      latitude: 38.8980586,
      longitude: -77.1876467
    },
    currentPositionLayer: new GeoJsonLayer({
      id: 'current-position',
      data: {
        type: 'Point',
        coordinates: [-77.1876467, 38.8980586]
      },
      getFillColor: [255, 255, 255, 255],
      getRadius: 5,
      pointRadiusMinPixels: 5
    }),
    currentRouteStepIndex: 0,
    searchResult: null,
    searchResultLayer: null,
    routeResult: null,
    routeResultLayer: null,
    isNavigating: false,
    simulationIntervalId: null
  };

  mapRef = React.createRef();

  handleViewportChange = viewport => {
    this.setState({
      viewport: { ...this.state.viewport, ...viewport }
    });
  };

  handleSearchResult = event => {
    this.setState({
      routeResult: null,
      routeResultLayer: null,
      searchResult: event.result,
      searchResultLayer: new GeoJsonLayer({
        id: 'search-result',
        data: event.result.geometry,
        getFillColor: [160, 160, 180, 200],
        getRadius: 5,
        pointRadiusMinPixels: 5
      })
    });
  };

  handleSearchClear = event => {
    this.setState({
      searchResult: null,
      searchResultLayer: null,
      routeResult: null,
      routeResultLayer: null
    });
  };

  handleGetDirections = event => {
    requestGeolocation()
      .then(p => this.setState({
        currentPosition: {
          longitude: p.coords.longitude,
          latitude: p.coords.latitude,
          lastupdated: p.timestamp
        },
        currentPositionLayer: new GeoJsonLayer({
          id: 'current-position',
          data: {
            type: 'Point',
            coordinates: [p.coords.longitude, p.coords.latitude]
          },
          getFillColor: [255, 255, 255, 255],
          getRadius: 5,
          pointRadiusMinPixels: 5
        })
      }))
      .then(() => {
        const start = [this.state.currentPosition.longitude, this.state.currentPosition.latitude];
        const end = this.state.searchResult.center;
        return requestDirections(start, end);
      })
      .then(r => this.setState({
        routeResult: r[0], // TODO show alternatives
        routeResultLayer: new GeoJsonLayer({
          id: 'route-result',
          data: r[0].geometry,
          lineWidthMinPixels: 3,
          getLineColor: [66, 100, 251, 255],
          getLineWidth: 5,
        })
      }))
      .then(() => {
        const coordinates = this.state.routeResult.geometry.coordinates;
        const bounds = coordinates.reduce(function(bounds, coord) {
          return bounds.extend(coord);
        }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

        const viewport = geoViewport.viewport(
          [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          [400, 400]
        );

        this.handleViewportChange({
          longitude: viewport.center[0],
          latitude: viewport.center[1],
          zoom: viewport.zoom
        });
      })
      .catch(err => console.error(err));
  };

  handleNewPositionSuccess = (p) => {
    let currentRouteStepIndex = this.state.currentRouteStepIndex || 0;

    const currentStep = this.state.routeResult.legs[0].steps[currentRouteStepIndex];
    const nextStep = this.state.routeResult.legs[0].steps[currentRouteStepIndex+1];
    const snappedPositionToCurrentStep = nearestPointOnLine(currentStep.geometry, turf.point([p.coords.longitude, p.coords.latitude]));
    const snappedPositionToNextStep = nearestPointOnLine(nextStep.geometry, turf.point([p.coords.longitude, p.coords.latitude]));

    // decide whether to progress to next step
    let snappedPosition;
    // snap to next step is closer than snap to current step,
    // and snap to next step is less than 50m from the start of the step
    if (snappedPositionToNextStep.properties.dist < snappedPositionToCurrentStep.properties.dist && snappedPositionToNextStep.properties.location < 0.05) {
      snappedPosition = snappedPositionToNextStep;
      currentRouteStepIndex = currentRouteStepIndex + 1;
    } else {
      snappedPosition = snappedPositionToCurrentStep;
    }

    const distanceAlongGeometry = snappedPosition.properties.location * 1000;

    this.setState({
      viewport: {
        ...this.state.viewport,
        longitude: p.coords.longitude,
        latitude: p.coords.latitude,
        zoom: 16
      },
      currentPosition: {
        longitude: p.coords.longitude,
        latitude: p.coords.latitude,
        lastupdated: p.timestamp
      },
      currentRouteStepIndex: currentRouteStepIndex,
      distanceAlongGeometry: distanceAlongGeometry,
      currentPositionLayer: new GeoJsonLayer({
        id: 'current-position',
        data: {
          type: 'Point',
          coordinates: [p.coords.longitude, p.coords.latitude]
        },
        getFillColor: [255, 255, 255, 255],
        getRadius: 5,
        pointRadiusMinPixels: 5
      })
    });
  };

  handleNewPositionError = (err) => {
    console.error(err);
  };

  handleStartNavigation = () => {
    const geolocationWatcher = watchGeolocation(this.handleNewPositionSuccess, this.handleNewPositionError);
    this.setState({
      isNavigating: true,
      geolocationWatcher
    });
  };

  handleStartSimulation = () => {
    const { geometry, distance } = this.state.routeResult;
    const simulationIntervalId = simulateLocation(geometry, distance, this.handleNewPositionSuccess);
    this.setState({
      isNavigating: true,
      simulationIntervalId
    });
  };

  handleCancelNavigation = () => {
    clearInterval(this.state.simulationIntervalId);
    this.setState({
      isNavigating: false,
      simulationIntervalId: null
    });
  };

  render() {
    const { viewport, searchResult, searchResultLayer, routeResult, routeResultLayer, currentPosition, currentPositionLayer, currentRouteStepIndex, distanceAlongGeometry, isNavigating } = this.state;

    let BottomBanner;
    if (searchResult && !routeResult) {
      BottomBanner = <SearchDetails searchResult={searchResult} onClick={this.handleGetDirections} />
    } else if (routeResult) {
      BottomBanner = <RouteDetails routeResult={routeResult} isNavigating={isNavigating} onClickStartNavigation={this.handleStartNavigation} onClickStartSimulation={this.handleStartSimulation} onClickCancelNavigation={this.handleCancelNavigation} />
    }

    return (
      <>
        { isNavigating && routeResult &&
          <Banner routeResult={routeResult} distanceAlongGeometry={distanceAlongGeometry} currentRouteStepIndex={currentRouteStepIndex} />
        }
        <MapGL
          mapStyle='mapbox://styles/mapbox/navigation-guidance-day-v4'
          ref={this.mapRef}
          {...viewport}
          onViewportChange={this.handleViewportChange}
        >
          { !isNavigating &&
            <Geocoder
              mapRef={this.mapRef}
              onViewportChange={this.handleViewportChange}
              onResult={this.handleSearchResult}
              onClear={this.handleSearchClear}
              mapboxApiAccessToken={process.env.REACT_APP_MAPBOX_ACCESS_TOKEN}
              proximity={currentPosition}
              position='top-left'
              placeholder='Where to?...'
            />
          }
          <DeckGL {...viewport} layers={[searchResultLayer, routeResultLayer, currentPositionLayer]} />
        </MapGL>
        {BottomBanner}
      </>
    );
  }
}

export default App;
