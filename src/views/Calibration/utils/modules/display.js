import { refs } from "./domRefs.js";
import { CALIBRATION_POINTS, gazeData, calibrationModel } from "./dotCalibration.js";
import { leastSquares } from "./mathUtils.js";

export function displayCalibrationParameters() {
    const parameterDisplay = refs.parameterDisplay;

    const grouped = CALIBRATION_POINTS.map((p, i) => {
        const samples = gazeData.filter(v => v.point_index === i);
        if (!samples.length) {
            return {
                label: p.label,
                count: 0,
                leftX: "N/A", leftY: "N/A", leftR: "N/A",
                rightX: "N/A", rightY: "N/A", rightR: "N/A"
            };
        }

        const leftSamples = samples.filter(s => s.iris_left).map(s => s.iris_left);
        const rightSamples = samples.filter(s => s.iris_right).map(s => s.iris_right);

        const sumLeft = leftSamples.reduce((a,v) => ({ x:a.x+v.x, y:a.y+v.y, r:a.r+v.r }), {x:0,y:0,r:0});
        const sumRight = rightSamples.reduce((a,v) => ({ x:a.x+v.x, y:a.y+v.y, r:a.r+v.r }), {x:0,y:0,r:0});

        const leftCount = leftSamples.length;
        const rightCount = rightSamples.length;

        return {
            label: p.label,
            count: samples.length,
            leftX: leftCount ? (sumLeft.x/leftCount).toFixed(4) : "N/A",
            leftY: leftCount ? (sumLeft.y/leftCount).toFixed(4) : "N/A",
            leftR: leftCount ? (sumLeft.r/leftCount).toFixed(4) : "N/A",
            rightX: rightCount ? (sumRight.x/rightCount).toFixed(4) : "N/A",
            rightY: rightCount ? (sumRight.y/rightCount).toFixed(4) : "N/A",
            rightR: rightCount ? (sumRight.r/rightCount).toFixed(4) : "N/A"
        };
    });

    parameterDisplay.innerHTML = `
    <h3>Calibration Data Samples (per point)</h3>
    <table border="1" style="width:100%;max-width:900px;margin:auto;">
      <thead>
        <tr>
          <th>Point</th><th>Samples</th>
          <th>Left X</th><th>Left Y</th><th>Left R</th>
          <th>Right X</th><th>Right Y</th><th>Right R</th>
        </tr>
      </thead>
      <tbody>
        ${grouped.map(g => `
          <tr>
            <td>${g.label}</td>
            <td>${g.count}</td>
            <td>${g.leftX}</td>
            <td>${g.leftY}</td>
            <td>${g.leftR}</td>
            <td>${g.rightX}</td>
            <td>${g.rightY}</td>
            <td>${g.rightR}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

export function displayPredictionModel() {
    const parameterDisplay = refs.parameterDisplay;

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

    parameterDisplay.innerHTML += `<h3>Per-eye Quadratic Models & Validation</h3>`;

    const renderEye = (res, eyeName) => {
        if(res.success){
            parameterDisplay.innerHTML += `
        <h4>${eyeName} Eye (samples: ${res.samples})</h4>
        <table border="1" style="width:100%;max-width:600px;margin:auto;">
          <tr><th>coef</th><th>value</th></tr>
          ${res.px.map((v,i)=>`<tr><td>a${i}</td><td>${v.toFixed(6)}</td></tr>`).join("")}
          ${res.py.map((v,i)=>`<tr><td>b${i}</td><td>${v.toFixed(6)}</td></tr>`).join("")}
        </table>
        <p><strong>RMSE:</strong> ${res.rmse.toFixed(6)} · <strong>Accuracy:</strong> ${(res.accuracy*100).toFixed(2)}%</p>
      `;
        } else {
            parameterDisplay.innerHTML += `<p>${eyeName} eye fit failed: ${res.reason||"unknown"}</p>`;
        }
    };

    renderEye(leftRes, "Left");
    renderEye(rightRes, "Right");

    if((leftRes.success && leftRes.accuracy>=0.85)||(rightRes.success && rightRes.accuracy>=0.85)){
        parameterDisplay.innerHTML += `<p style="color:green;font-weight:700;">Calibration OK (one or more eyes meet threshold).</p>`;
    } else {
        parameterDisplay.innerHTML += `<p style="color:crimson;font-weight:700;">Calibration below threshold. Consider recalibration.</p>`;
    }

    // Return metrics for saving
    return {
        accuracy: {left: leftRes.success, right: rightRes.success },
        rmse: {left: leftRes.success && rightRes.success },
        details: { left: leftRes.accuracy, right: rightRes.accuracy }
    };
}