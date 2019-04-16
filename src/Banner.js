import React, { Component } from 'react';
import './banner.css';

class Banner extends Component {
  render() {
    const { routeResult, distanceAlongGeometry, currentRouteStepIndex } = this.props;
    const currentStep = routeResult.legs[0].steps[currentRouteStepIndex]; // TODO how to progress to next step

    let distanceToManeuver = currentStep.distance - distanceAlongGeometry;

    let bannerInstruction = currentStep.bannerInstructions[0];
    for (let i = 0; i < currentStep.bannerInstructions.length; i++) {
      if (currentStep.bannerInstructions[i].distanceAlongGeometry > distanceToManeuver) {
        bannerInstruction = currentStep.bannerInstructions[i];
      }
    }

    return (
      <div className='banner'>
        <div className='primary'>
          {bannerInstruction.primary.text}
        </div>
        <div className='secondary'>
          {bannerInstruction.secondary && bannerInstruction.secondary.text}
        </div>
      </div>
    )
  }
}

export default Banner;
