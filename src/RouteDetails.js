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
    const { routeResult, onClick } = this.props;

    const time = formatTime(routeResult.duration);
    const distance = formatDistance(routeResult.distance);

    return (
      <div>
        <div>
          {time.value} {time.unit} ({distance.value} {distance.unit})

        </div>
        <button onClick={onClick}>Start</button>
      </div>
    )
  }
}

export default RouteDetails;
