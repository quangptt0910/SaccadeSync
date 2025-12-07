// for now these are approximate values for a standard setup how far the user sits from the screen
// ,but we will add stuff from Anna's calibration to make it work correctly and accurately
// TODO: change the degrees with the calibration from anna

const HORIZONTAL_DEGREES = 45;
const VERTICAL_DEGREES = 30;
const EYE_ROTATION_GAIN = 30;

export const calculateInstantVelocity = (currentFrame, previousFrame) => {

    if (!currentFrame || !previousFrame) return 0;

    // calculate the time difference (ms)
    const timeDelta = (currentFrame.timestamp - previousFrame.timestamp) / 1000;
    if (timeDelta <= 0 || timeDelta > 0.5) return 0;


    // now do calculations for the left eye
    // calculate distance and turn it into degrees
    const dLx = currentFrame.leftIris.x - previousFrame.leftIris.x;
    const dLy = currentFrame.leftIris.y - previousFrame.leftIris.y;

    const leftDistDeg = Math.sqrt((dLx * HORIZONTAL_DEGREES * EYE_ROTATION_GAIN) ** 2 + (dLy * VERTICAL_DEGREES * EYE_ROTATION_GAIN) ** 2);

    // now the calculations for the right eye
    const dRx = currentFrame.rightIris.x - previousFrame.rightIris.x;
    const dRy = currentFrame.rightIris.y - previousFrame.rightIris.y;
    const rightDistDeg = Math.sqrt((dRx * HORIZONTAL_DEGREES * EYE_ROTATION_GAIN) ** 2 + (dRy * VERTICAL_DEGREES * EYE_ROTATION_GAIN) ** 2);

    // we average the results of both to reduce the noise and not using saccade value
    const avgDistDeg = (leftDistDeg + rightDistDeg) / 2;

    console.log(avgDistDeg);

    // return the velocity
    return avgDistDeg / timeDelta;
}



