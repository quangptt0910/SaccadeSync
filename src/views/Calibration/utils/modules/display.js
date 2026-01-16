// Calibration\display.js
import { refs } from "./domRefs.js";
import { gazeData, calibrationModel } from "./dotCalibration.js";
import { leastSquares } from "./mathUtils.js";

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
            const dx = predX - bx[i], dy = predY - by[i];
            errSum += dx*dx+dy*dy;
        }
        const rmse = Math.sqrt(errSum/A.length);
        const accuracy = Math.max(0,1-rmse);

        return {success:true, px, py, rmse, accuracy, samples:A.length};
    };

    const leftRes = fitAndValidate(buildMatrices("left"));
    const rightRes = fitAndValidate(buildMatrices("right"));


    // 🔍 COMPREHENSIVE DIAGNOSTICS
    console.group('🔬 CALIBRATION MODEL DIAGNOSTICS');

    // 1. Check raw data ranges
    console.group('📊 Raw Data Analysis');
    const irisLeftX = gazeData.map(d => d.iris_left?.x).filter(Boolean);
    const irisLeftY = gazeData.map(d => d.iris_left?.y).filter(Boolean);
    const irisRightX = gazeData.map(d => d.iris_right?.x).filter(Boolean);
    const irisRightY = gazeData.map(d => d.iris_right?.y).filter(Boolean);
    const targetX = gazeData.map(d => d.targetX);
    const targetY = gazeData.map(d => d.targetY);

    // 🔍 VALIDATION: Check if user moved their eyes
    const irisXrange = Math.max(...irisLeftX) - Math.min(...irisLeftX);
    const irisYrange = Math.max(...irisLeftY) - Math.min(...irisLeftY);

    if (irisXrange < 0.08) {
        console.warn('⚠️ WARNING: Insufficient horizontal eye movement!');
        console.warn('Expected range >0.08, got:', irisXrange.toFixed(4));
        console.warn('User may not be looking at the dots properly.');
    }

    if (irisYrange < 0.08) {
        console.warn('⚠️ WARNING: Insufficient vertical eye movement!');
        console.warn('Expected range >0.08, got:', irisYrange.toFixed(4));
        console.warn('User may not be looking at the dots properly.');
    }

    console.log('Left Iris X:', {
        min: Math.min(...irisLeftX).toFixed(4),
        max: Math.max(...irisLeftX).toFixed(4),
        range: (Math.max(...irisLeftX) - Math.min(...irisLeftX)).toFixed(4),
        mean: (irisLeftX.reduce((a,b)=>a+b,0)/irisLeftX.length).toFixed(4)
    });

    console.log('Left Iris Y:', {
        min: Math.min(...irisLeftY).toFixed(4),
        max: Math.max(...irisLeftY).toFixed(4),
        range: (Math.max(...irisLeftY) - Math.min(...irisLeftY)).toFixed(4),
        mean: (irisLeftY.reduce((a,b)=>a+b,0)/irisLeftY.length).toFixed(4)
    });

    console.log('Target X:', {
        min: Math.min(...targetX).toFixed(4),
        max: Math.max(...targetX).toFixed(4),
        unique: [...new Set(targetX.map(v => v.toFixed(2)))]
    });

    console.log('Target Y:', {
        min: Math.min(...targetY).toFixed(4),
        max: Math.max(...targetY).toFixed(4),
        unique: [...new Set(targetY.map(v => v.toFixed(2)))]
    });
    console.groupEnd();

    // 2. Check coefficient magnitude
    if(leftRes.success){
        console.group('🧮 Left Eye Model Coefficients');
        console.log('X-axis coefficients:', leftRes.px.map(c => c.toFixed(4)));
        console.log('Y-axis coefficients:', leftRes.py.map(c => c.toFixed(4)));
        console.log('Intercept magnitude check:', {
            coefX0: leftRes.px[0].toFixed(4),
            coefY0: leftRes.py[0].toFixed(4),
            interpretation: Math.abs(leftRes.px[0]) > 10 ?
                '⚠️ PIXEL-BASED (>10)' : '✅ NORMALIZED (<10)'
        });
        console.groupEnd();
    }
    if(rightRes.success){
        console.group('🧮 Right Eye Model Coefficients');
        console.log('X-axis coefficients:', rightRes.px.map(c => c.toFixed(4)));
        console.log('Y-axis coefficients:', rightRes.py.map(c => c.toFixed(4)));
        console.log('Intercept magnitude check:', {
            coefX0: rightRes.px[0].toFixed(4),
            coefY0: rightRes.py[0].toFixed(4),
            interpretation: Math.abs(rightRes.px[0]) > 10 ?
                '⚠️ PIXEL-BASED (>10)' : '✅ NORMALIZED (<10)'
        });
    }

    // 3. Test predictions at key positions
    if (leftRes.success) {
        console.group('🎯 Test Predictions (Left Eye)');

        // Get actual iris positions from collected data
        const centerData = gazeData.filter(d =>
            Math.abs(d.targetX - 0.5) < 0.01 && Math.abs(d.targetY - 0.5) < 0.01
        );
        const leftData = gazeData.filter(d =>
            Math.abs(d.targetX - 0.05) < 0.01 && Math.abs(d.targetY - 0.5) < 0.01
        );
        const rightData = gazeData.filter(d =>
            Math.abs(d.targetX - 0.95) < 0.01 && Math.abs(d.targetY - 0.5) < 0.01
        );

        const testScenarios = [];

        if (centerData.length > 0 && centerData[0].iris_left) {
            const iris = centerData[0].iris_left;
            testScenarios.push({
                label: 'Looking CENTER',
                iris: iris,
                expected: {x: 0.5, y: 0.5}
            });
        }

        if (leftData.length > 0 && leftData[0].iris_left) {
            const iris = leftData[0].iris_left;
            testScenarios.push({
                label: 'Looking LEFT',
                iris: iris,
                expected: {x: 0.05, y: 0.5}
            });
        }

        if (rightData.length > 0 && rightData[0].iris_left) {
            const iris = rightData[0].iris_left;
            testScenarios.push({
                label: 'Looking RIGHT',
                iris: iris,
                expected: {x: 0.95, y: 0.5}
            });
        }

        testScenarios.forEach(({label, iris, expected}) => {
            const px = leftRes.px;
            const py = leftRes.py;
            const ix = iris.x;
            const iy = iris.y;

            const predX = px[0] + px[1]*ix + px[2]*iy + px[3]*ix*ix + px[4]*iy*iy + px[5]*ix*iy;
            const predY = py[0] + py[1]*ix + py[2]*iy + py[3]*ix*ix + py[4]*iy*iy + py[5]*ix*iy;

            const errorX = Math.abs(predX - expected.x);
            const errorY = Math.abs(predY - expected.y);
            const errorDist = Math.sqrt(errorX*errorX + errorY*errorY);

            console.log(`${label}:`, {
                iris: `(${ix.toFixed(4)}, ${iy.toFixed(4)})`,
                predicted: `(${predX.toFixed(4)}, ${predY.toFixed(4)})`,
                expected: `(${expected.x.toFixed(2)}, ${expected.y.toFixed(2)})`,
                error: errorDist.toFixed(4),
                status: predX >= 0 && predX <= 1 && predY >= 0 && predY <= 1 ?
                    (errorDist < 0.1 ? '✅ GOOD (<0.1)' : '⚠️ HIGH ERROR') :
                    '❌ OUT OF BOUNDS'
            });
        });

        console.groupEnd();
    }

    // 4. Model quality summary
    console.group('📈 Model Quality Metrics');
    console.log('Left Eye:', {
        success: leftRes.success,
        rmse: leftRes.rmse?.toFixed(4),
        accuracy: leftRes.accuracy?.toFixed(4),
        samples: leftRes.samples,
        quality: leftRes.rmse < 0.08 ? '✅ EXCELLENT(<0.08)' :
            leftRes.rmse < 0.15 ? '⚠️ ACCEPTABLE (<0.15)' : '❌ POOR'
    });

    console.log('Right Eye:', {
        success: rightRes.success,
        rmse: rightRes.rmse?.toFixed(4),
        accuracy: rightRes.accuracy?.toFixed(4),
        samples: rightRes.samples,
        quality: rightRes.rmse < 0.08 ? '✅ EXCELLENT (<0.08)' :
            rightRes.rmse < 0.15 ? '⚠️ ACCEPTABLE (<0.15)' : '❌ POOR'
    });
    console.groupEnd();

    console.groupEnd();

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
        calibrationMethod: 'least-squares',
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
        version: '1.0.1'
    };

    return {
        sucess: {left: leftRes.success, right: rightRes.success },
        rmse: {left: leftRes.rmse, right: rightRes.rmse },
        accuracy: { left: leftRes.accuracy, right: rightRes.accuracy }
    };
}
export function testWithSyntheticData() {
    console.group('🧪 SYNTHETIC DATA TEST');

    // Generate fake iris data with proper movement
    const syntheticGaze = [];

    for (let targetX of [0.05, 0.50, 0.95]) {
        for (let targetY of [0.05, 0.50, 0.95]) {
            for (let i = 0; i < 15; i++) {
                // Simulate iris position that correlates with gaze
                const irisX = 0.45 + targetX * 0.15 + (Math.random() - 0.5) * 0.01;
                const irisY = 0.45 + targetY * 0.15 + (Math.random() - 0.5) * 0.01;

                syntheticGaze.push({
                    targetX: targetX,
                    targetY: targetY,
                    iris_left: { x: irisX, y: irisY },
                    iris_right: { x: irisX - 0.15, y: irisY }
                });
            }
        }
    }

    // Temporarily replace gazeData
    const originalGazeData = gazeData;
    gazeData = syntheticGaze;

    // Run model fitting
    const result = displayPredictionModel();

    console.log('Synthetic data RMSE:', result.rmse);
    console.log('Should be <0.05 if model code is correct');

    // Restore original data
    gazeData = originalGazeData;

    console.groupEnd();
}