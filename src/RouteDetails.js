import React, { Component } from 'react';

function formatTime(sec) {
  const value = Math.round(sec / 60);
  const unit = 'min';

  return { value, unit }
}


function formatDistance(m) {
  const value = Math.round(m / 1000);
  const unit = 'km';

  return { value, unit }
}

class RouteDetails extends Component {
  render() {
    const { routeResult, onClickStartNavigation, onClickStartSimulation, onClickCancelNavigation, isNavigating } = this.props;

    const time = formatTime(routeResult.duration);
    const distance = formatDistance(routeResult.distance);

    return (
      <div>
        { isNavigating ? (
          <button onClick={onClickCancelNavigation}>Cancel</button>
        ) : (
          <div>
            <div>
              {time.value} {time.unit} ({distance.value} {distance.unit})
            </div>
            <div>
              <button onClick={onClickStartNavigation}>Start</button>
              <button onClick={onClickStartSimulation}>Simulate</button>
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default RouteDetails;
