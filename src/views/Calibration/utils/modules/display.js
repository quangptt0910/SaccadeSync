// Calibration\display.js
import { refs } from "./domRefs.js";
import { gazeData, calibrationModel } from "./dotCalibration.js";
import { ridgeRegression, findOptimalLambda, leastSquares} from "./mathUtils.js";

export function displayPredictionModel(useRidge = true) {

    const buildMatrices = (eye) => {
        const A = [], bx = [], by = [];
        gazeData.forEach(d => {
            const iris = eye === "left" ? d.iris_left : d.iris_right;
            if (!iris) return;
            const x = iris.x, y = iris.y;
            A.push([1, x, y, x*x, y*y, x*y]);
            bx.push(d.targetX);
            by.push(d.targetY);
        });
        return { A, bx, by };
    };

    const fitAndValidate = ({A,bx,by}, eye) => {
        if(A.length < 6) return {success:false, reason:"not enough samples"};

        let px, py, lambda = 0.01;
        // const px = leastSquares(A,bx);
        // const py = leastSquares(A,by);

        if (useRidge) {
            // 🔧 RIDGE REGRESSION with cross-validation
            console.log(`Finding optimal lambda for ${eye} eye...`);
            const lambdaX = findOptimalLambda(A, bx, [0.001, 0.01, 0.1, 1.0, 10.0], 5);
            const lambdaY = findOptimalLambda(A, by, [0.001, 0.01, 0.1, 1.0, 10.0], 5);

            px = ridgeRegression(A, bx, lambdaX);
            py = ridgeRegression(A, by, lambdaY);
            lambda = (lambdaX + lambdaY) / 2;

            console.log(`${eye} eye: λ_x=${lambdaX}, λ_y=${lambdaY}`);
        } else {
            // Original OLS
            px = leastSquares(A, bx);
            py = leastSquares(A, by);
        }

        if (!px || !py) return {success: false, reason: "matrix failure"};

        if(!px || !py) return {success:false, reason:"matrix failure"};

        let errSum= 0;
        for(let i= 0; i < A.length; i++){
            const [_, ix, iy] = A[i];
            const predX = px[0]+px[1]*ix+px[2]*iy+px[3]*ix*ix+px[4]*iy*iy+px[5]*ix*iy;
            const predY = py[0]+py[1]*ix+py[2]*iy+py[3]*ix*ix+py[4]*iy*iy+py[5]*ix*iy;
            const dx = predX - bx[i], dy = predY - by[i];
            errSum += dx * dx + dy * dy;
        }
        const rmse = Math.sqrt(errSum / A.length);
        const accuracy = Math.max(0, 1 - rmse);

        return {success:true, px, py, rmse, accuracy, samples:A.length, lambda: lambda, method: useRidge ? 'ridge' : 'ols'};
    };

    console.group('📊 Per-Eye Movement Analysis');

// Left eye analysis
    const leftIrisX = gazeData.map(d => d.iris_left?.x).filter(Boolean);
    const leftMinX = Math.min(...leftIrisX);
    const leftMaxX = Math.max(...leftIrisX);
    console.log('LEFT eye iris X:', {
        min: leftMinX.toFixed(4),
        max: leftMaxX.toFixed(4),
        range: (leftMaxX - leftMinX).toFixed(4),
        rangePercent: ((leftMaxX - leftMinX) * 100).toFixed(2) + '%'
    });

    // Right eye analysis
    const rightIrisX = gazeData.map(d => d.iris_right?.x).filter(Boolean);
    const rightMinX = Math.min(...rightIrisX);
    const rightMaxX = Math.max(...rightIrisX);
    console.log('RIGHT eye iris X:', {
        min: rightMinX.toFixed(4),
        max: rightMaxX.toFixed(4),
        range: (rightMaxX - rightMinX).toFixed(4),
        rangePercent: ((rightMaxX - rightMinX) * 100).toFixed(2) + '%'
    });

// Both eyes should show similar ranges (within 0.5%)
    const rangeDiff = Math.abs((leftMaxX - leftMinX) - (rightMaxX - rightMinX));
    console.log('Range difference:', {
        diff: rangeDiff.toFixed(4),
        status: rangeDiff < 0.005 ? '✅ SYMMETRIC' : '⚠️ ASYMMETRIC (possible bug)'
    });

    console.groupEnd();

    const leftRes = fitAndValidate(buildMatrices("left"), "left");
    const rightRes = fitAndValidate(buildMatrices("right"), "right");




    // Store coefficients
    if(leftRes.success){
        calibrationModel.left.coefX = leftRes.px;
        calibrationModel.left.coefY = leftRes.py;
    }
    if(rightRes.success){
        calibrationModel.right.coefX = rightRes.px;
        calibrationModel.right.coefY = rightRes.py;
    }

    // debug: Store calibration metadata - UPDATED
    calibrationModel.metadata = {
        calibrationMethod: useRidge ? 'ridge-regression' : 'least-squares',
        calibrationPoints: '9-points', // 9 calibration points used
        samplesPerPoint: 15,
        totalSamples: gazeData.length,
        coordinateSystem: 'normalized',  // Model outputs 0-1 range
        irisExtractionMethod: 'center-point', // Using center point of iris
        irisIndices: {
            left: { center: 473 },
            right: { center: 468 }
        },
        screenDimensions: {
            width: window.innerWidth,
            height: window.innerHeight
        },
        timestamp: Date.now(),
        version: '1.0.2'
    };

    console.log('📊 Calibration complete:', {
        method: useRidge ? 'Ridge Regression' : 'Ordinary Least Squares',
        leftRMSE: leftRes.rmse?.toFixed(4),
        rightRMSE: rightRes.rmse?.toFixed(4),
        leftLambda: leftRes.lambda,
        rightLambda: rightRes.lambda
    });

    return {
        sucess: {left: leftRes.success, right: rightRes.success },
        rmse: {left: leftRes.rmse, right: rightRes.rmse },
        accuracy: { left: leftRes.accuracy, right: rightRes.accuracy },
        method: useRidge ? 'ridge' : 'ols'
    };
}