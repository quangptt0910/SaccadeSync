// // for now these are approximate values for a standard setup how far the user sits from the screen
// // ,but we will add stuff from Anna's calibration to make it work correctly and accurately
//
// const HORIZONTAL_DEGREES = 40;
// const VERTICAL_DEGREES = 30;
// const EYE_ROTATION_GAIN = 30; // Used for raw iris movement gain, not needed for calibrated data
// const SCREEN_WIDTH = window.screen.width || 1920; // in pixels
// const SCREEN_HEIGHT = window.screen.height || 1080; // in pixels
//
// // function to calculate the instant velocity between two frames
// export const calculateInstantVelocity = (currentFrame, previousFrame) => {
//
//     if (!currentFrame || !previousFrame) return 0;
//
//     // calculate the time difference (ms)
//     const timeDelta = (currentFrame.timestamp - previousFrame.timestamp) / 1000;
//     if (timeDelta <= 0 || timeDelta > 0.5) return 0;
//
//     // Check if we have calibrated data
//     if (currentFrame.calibrated && previousFrame.calibrated) {
//         const curCal = currentFrame.calibrated;
//         const prevCal = previousFrame.calibrated;
//
//         // We can use the average gaze point if available, or fallback to individual eyes
//         // Let's calculate velocity for left and right separately if possible, then average
//         let leftVelocity = null;
//         let rightVelocity = null;
//
//         // Left Eye
//         if (curCal.left && prevCal.left) {
//             const dx = (curCal.left.x - prevCal.left.x) * SCREEN_WIDTH;
//             const dy = (curCal.left.y - prevCal.left.y) * SCREEN_HEIGHT;
//             const distPixels = Math.sqrt(dx*dx + dy*dy);
//
//             // Convert pixels to degrees
//             // Assuming standard screen setup where SCREEN_WIDTH pixels covers HORIZONTAL_DEGREES
//             const pixelsPerDegree = SCREEN_WIDTH / HORIZONTAL_DEGREES;
//             const distDeg = distPixels / pixelsPerDegree;
//
//             leftVelocity = distDeg / timeDelta;
//         }
//
//         // Right Eye
//         if (curCal.right && prevCal.right) {
//             const dx = (curCal.right.x - prevCal.right.x) * SCREEN_WIDTH;
//             const dy = (curCal.right.y - prevCal.right.y) * SCREEN_HEIGHT;
//             const distPixels = Math.sqrt(dx*dx + dy*dy);
//
//             const pixelsPerDegree = SCREEN_WIDTH / HORIZONTAL_DEGREES;
//             const distDeg = distPixels / pixelsPerDegree;
//
//             rightVelocity = distDeg / timeDelta;
//         }
//
//         if (leftVelocity !== null && rightVelocity !== null) {
//             return (leftVelocity + rightVelocity) / 2;
//         } else if (leftVelocity !== null) {
//             return leftVelocity;
//         } else if (rightVelocity !== null) {
//             return rightVelocity;
//         }
//         // If calibrated data exists but is null (e.g. eyes closed), fall through to raw or return 0
//     }
//
//     // --- Fallback to Raw Iris Data ---
//
//     // now do calculations for the left eye
//     // calculate distance and turn it into degrees
//     const dLx = currentFrame.leftIris.x - previousFrame.leftIris.x;
//     const dLy = currentFrame.leftIris.y - previousFrame.leftIris.y;
//
//     // Convert normalized iris delta to Pixel
//     // dLx is normalized (0-1) relative to the face mesh bounding box or similar?
//     // Actually MediaPipe iris landmarks are relative to the image.
//     // But without calibration, we don't know how much iris movement corresponds to screen movement.
//     // That's what EYE_ROTATION_GAIN was likely for.
//
//     const leftDistDeg = Math.sqrt((dLx * HORIZONTAL_DEGREES * EYE_ROTATION_GAIN) ** 2 + (dLy * VERTICAL_DEGREES * EYE_ROTATION_GAIN) ** 2);
//
//     // now the calculations for the right eye
//     const dRx = currentFrame.rightIris.x - previousFrame.rightIris.x;
//     const dRy = currentFrame.rightIris.y - previousFrame.rightIris.y;
//     const rightDistDeg = Math.sqrt((dRx * HORIZONTAL_DEGREES * EYE_ROTATION_GAIN) ** 2 + (dRy * VERTICAL_DEGREES * EYE_ROTATION_GAIN) ** 2);
//
//     // we average the results of both to reduce the noise and not using saccade value
//     const avgDistDeg = (leftDistDeg + rightDistDeg) / 2;
//
//     // console.log(avgDistDeg);
//
//     // return the velocity
//     return avgDistDeg / timeDelta;
// }
