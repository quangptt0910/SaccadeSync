import { gazeData, calibrationModel } from "./dotCalibration.js";
import { leastSquares } from "./mathUtils.js";

/**
 * Calculates the prediction model based on collected gaze data.
 * It builds matrices from the gaze points and iris positions, performs a least-squares fit,
 * validates the model accuracy, and updates the global calibrationModel object.
 *
 * @returns {Object} An object containing success flags, RMSE values, and accuracy scores for both eyes.
 */
export function displayPredictionModel() {

    const buildMatrices = (eye) => {
        const A = [], bx = [], by = [];
        gazeData.forEach(d => {
            const iris = eye==="left"?d.iris_left:d.iris_right;
            if (!iris) return;
            const x = iris.x, y = iris.y;
            A.push([1, x, y, x*x, y*y, x*y]);
            bx.push(d.targetX);
            by.push(d.targetY);
        });
        return { A, bx, by };
    };

    const fitAndValidate = ({A,bx,by}) => {
        if(A.length<6) return {success:false, reason:"not enough samples"};
        const px = leastSquares(A,bx);
        const py = leastSquares(A,by);
        if(!px || !py) return {success:false, reason:"matrix failure"};
        let errSum=0;
        for(let i=0;i<A.length;i++){
            const [_,ix,iy] = A[i];
            const predX = px[0]+px[1]*ix+px[2]*iy+px[3]*ix*ix+px[4]*iy*iy+px[5]*ix*iy;
            const predY = py[0]+py[1]*ix+py[2]*iy+py[3]*ix*ix+py[4]*iy*iy+py[5]*ix*iy;
            const dx = predX-bx[i], dy = predY-by[i];
            errSum += dx*dx+dy*dy;
        }
        const rmse = Math.sqrt(errSum/A.length);
        const accuracy = Math.max(0,1-rmse);

        return {success:true, px, py, rmse, accuracy, samples:A.length};
    };

    const leftRes = fitAndValidate(buildMatrices("left"));
    const rightRes = fitAndValidate(buildMatrices("right"));

    if(leftRes.success){
        calibrationModel.left.coefX = leftRes.px;
        calibrationModel.left.coefY = leftRes.py;
    }
    if(rightRes.success){
        calibrationModel.right.coefX = rightRes.px;
        calibrationModel.right.coefY = rightRes.py;
    }

    // debug: Store calibration metadata
    calibrationModel.metadata = {
        coordinateSystem: 'normalized',  // Model outputs 0-1 range
        irisExtractionMethod: '9point',  // Uses 5-point average
        irisIndices: {
            left: { start: 474, end: 479 },
            right: { start: 469, end: 474 }
        },
        screenDimensions: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        timestamp: Date.now(),
        version: '1.0'
    };

    return {
        sucess: {left: leftRes.success, right: rightRes.success },
        rmse: {left: leftRes.rmse, right: rightRes.rmse },
        accuracy: { left: leftRes.accuracy, right: rightRes.accuracy }
    };
}