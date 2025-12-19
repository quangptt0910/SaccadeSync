// for now these are approximate values for a standard setup how far the user sits from the screen
// ,but we will add stuff from Anna's calibration to make it work correctly and accurately
// TODO: change the degrees with the calibration from anna

const HORIZONTAL_DEGREES = 40;
const VERTICAL_DEGREES = 30;
const EYE_ROTATION_GAIN = 30;
const SCREEN_WIDTH = 1920; // in pixels
const SCREEN_HEIGHT = 1080; // in pixels

// function to calculate the instant velocity between two frames
export const calculateInstantVelocity = (currentFrame, previousFrame) => {

    if (!currentFrame || !previousFrame) return 0;

    // calculate the time difference (ms)
    const timeDelta = (currentFrame.timestamp - previousFrame.timestamp) / 1000;
    if (timeDelta <= 0 || timeDelta > 0.5) return 0;


    // now do calculations for the left eye
    // calculate distance and turn it into degrees
    const dLx = currentFrame.leftIris.x - previousFrame.leftIris.x;
    const dLy = currentFrame.leftIris.y - previousFrame.leftIris.y;

    // Conver normalized iris delta to Pixel
    const dx_pixels = dLx * SCREEN_WIDTH;
    const dy_pixels = dLy * SCREEN_HEIGHT;
    const distance_pixels = Math.sqrt(dx_pixels**2 + dy_pixels**2); // calc euclidean distance in pixels
    const pixels_per_degree_x = SCREEN_WIDTH / HORIZONTAL_DEGREES; // pixels to/per degree conversion
    const pixels_per_degree_y = SCREEN_HEIGHT / VERTICAL_DEGREES; // pixels to/per degree conversion
    const dist_degrees = distance_pixels / ((pixels_per_degree_x + pixels_per_degree_y)/2); // convert distance to degrees
    const velocity_dps = dist_degrees / timeDelta; // degrees per second
    // ==================================================================

    const leftDistDeg = Math.sqrt((dLx * HORIZONTAL_DEGREES * EYE_ROTATION_GAIN) ** 2 + (dLy * VERTICAL_DEGREES * EYE_ROTATION_GAIN) ** 2);

    // now the calculations for the right eye
    const dRx = currentFrame.rightIris.x - previousFrame.rightIris.x;
    const dRy = currentFrame.rightIris.y - previousFrame.rightIris.y;
    const rightDistDeg = Math.sqrt((dRx * HORIZONTAL_DEGREES * EYE_ROTATION_GAIN) ** 2 + (dRy * VERTICAL_DEGREES * EYE_ROTATION_GAIN) ** 2);

    // we average the results of both to reduce the noise and not using saccade value
    const avgDistDeg = (leftDistDeg + rightDistDeg) / 2;

    console.log(avgDistDeg);

    // return the velocity
   //return avgDistDeg / timeDelta;
    return velocity_dps;
}



