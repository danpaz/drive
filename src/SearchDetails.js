import React, { Component } from 'react';

class RouteDetails extends Component {
  render() {
    const { searchResult, onClick } = this.props;
    return (
      <div>
        <div>{searchResult.text}</div>
        <div>{searchResult.properties.address}</div>
        <button onClick={onClick}>Directions</button>
      </div>
    )
  }
}

export default RouteDetails;
