import { parameterDisplay } from "./domRefs.js";
import { CALIBRATION_POINTS, gazeData, calibrationModel } from "./dotCalibration.js";
import { leastSquares } from "./mathUtils.js";

export function displayCalibrationParameters() {
    // group by point index and show per-eye averages
    const grouped = CALIBRATION_POINTS.map((p, i) => {
        const s = gazeData.filter(v => v.point_index === i);
        if (!s.length) {
            return {
                label: p.label,
                count: 0,
                leftX: "N/A", leftY: "N/A", leftR: "N/A",
                rightX: "N/A", rightY: "N/A", rightR: "N/A"
            };
        }

        // compute left averages
        const leftSamples = s.filter(v => v.iris_left).map(v => v.iris_left);
        const rightSamples = s.filter(v => v.iris_right).map(v => v.iris_right);

        const sumLeft = leftSamples.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, r: a.r + v.r }), { x: 0, y: 0, r: 0 });
        const sumRight = rightSamples.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y, r: a.r + v.r }), { x: 0, y: 0, r: 0 });

        const leftCount = leftSamples.length;
        const rightCount = rightSamples.length;

        return {
            label: p.label,
            count: s.length,
            leftX: leftCount ? (sumLeft.x / leftCount).toFixed(4) : "N/A",
            leftY: leftCount ? (sumLeft.y / leftCount).toFixed(4) : "N/A",
            leftR: leftCount ? (sumLeft.r / leftCount).toFixed(4) : "N/A",
            rightX: rightCount ? (sumRight.x / rightCount).toFixed(4) : "N/A",
            rightY: rightCount ? (sumRight.y / rightCount).toFixed(4) : "N/A",
            rightR: rightCount ? (sumRight.r / rightCount).toFixed(4) : "N/A"
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
    </table>`;
}

export function displayPredictionModel() {
    // build matrices separately per eye
    const A_left = [];
    const bx_left = [];
    const by_left = [];

    const A_right = [];
    const bx_right = [];
    const by_right = [];

    gazeData.forEach(d => {
        // LEFT
        if (d.iris_left) {
            const x = d.iris_left.x;
            const y = d.iris_left.y;

            A_left.push([1, x, y, x * x, y * y, x * y]);
            bx_left.push(d.targetX);
            by_left.push(d.targetY);
        }

        // RIGHT
        if (d.iris_right) {
            const x = d.iris_right.x;
            const y = d.iris_right.y;

            A_right.push([1, x, y, x * x, y * y, x * y]);
            bx_right.push(d.targetX);
            by_right.push(d.targetY);
        }
    });

    // helper to fit and compute RMSE
    function fitAndValidate(A, bx, by) {
        if (A.length < 6) return { success: false, reason: "not enough samples" };

        const px = leastSquares(A, bx);
        const py = leastSquares(A, by);

        if (!px || !py) return { success: false, reason: "matrix failure" };

        // RMSE
        let errSum = 0;
        for (let i = 0; i < A.length; i++) {
            const row = A[i];
            const ix = row[1], iy = row[2];

            const predX = px[0] + px[1] * ix + px[2] * iy + px[3] * ix * ix + px[4] * iy * iy + px[5] * ix * iy;
            const predY = py[0] + py[1] * ix + py[2] * iy + py[3] * ix * ix + py[4] * iy * iy + py[5] * ix * iy;

            const dx = predX - bx[i];
            const dy = predY - by[i];
            errSum += dx * dx + dy * dy;
        }

        const rmse = Math.sqrt(errSum / A.length);
        const accuracy = Math.max(0, 1 - rmse);

        return { success: true, px, py, rmse, accuracy, samples: A.length };
    }

    const leftRes = fitAndValidate(A_left, bx_left, by_left);
    const rightRes = fitAndValidate(A_right, bx_right, by_right);

    // store into calibrationModel if success
    if (leftRes.success) {
        calibrationModel.left.coefX = leftRes.px;
        calibrationModel.left.coefY = leftRes.py;
    }

    if (rightRes.success) {
        calibrationModel.right.coefX = rightRes.px;
        calibrationModel.right.coefY = rightRes.py;
    }

    parameterDisplay.innerHTML += `<h3>Per-eye Quadratic Models & Validation</h3>`;

    if (leftRes.success) {
        parameterDisplay.innerHTML += `
            <h4>Left Eye (samples: ${leftRes.samples})</h4>
            <table border="1" style="width:100%;max-width:600px;margin:auto;">
                <tr><th>coef</th><th>value</th></tr>
                ${leftRes.px.map((v, i) => `<tr><td>a${i}</td><td>${v.toFixed(6)}</td></tr>`).join("")}
                ${leftRes.py.map((v, i) => `<tr><td>b${i}</td><td>${v.toFixed(6)}</td></tr>`).join("")}
            </table>
            <p><strong>Left RMSE:</strong> ${leftRes.rmse.toFixed(6)} · <strong>Accuracy:</strong> ${(leftRes.accuracy * 100).toFixed(2)}%</p>
        `;
    } else {
        parameterDisplay.innerHTML += `<p>Left eye fit failed: ${leftRes.reason || "unknown"}</p>`;
    }

    if (rightRes.success) {
        parameterDisplay.innerHTML += `
            <h4>Right Eye (samples: ${rightRes.samples})</h4>
            <table border="1" style="width:100%;max-width:600px;margin:auto;">
                <tr><th>coef</th><th>value</th></tr>
                ${rightRes.px.map((v, i) => `<tr><td>a${i}</td><td>${v.toFixed(6)}</td></tr>`).join("")}
                ${rightRes.py.map((v, i) => `<tr><td>b${i}</td><td>${v.toFixed(6)}</td></tr>`).join("")}
            </table>
            <p><strong>Right RMSE:</strong> ${rightRes.rmse.toFixed(6)} · <strong>Accuracy:</strong> ${(rightRes.accuracy * 100).toFixed(2)}%</p>
        `;
    } else {
        parameterDisplay.innerHTML += `<p>Right eye fit failed: ${rightRes.reason || "unknown"}</p>`;
    }

    // summary: if at least one eye succeeded (guys, check if your right eye is also better)
    if ((leftRes.success && leftRes.accuracy >= 0.85) || (rightRes.success && rightRes.accuracy >= 0.85)) {
        parameterDisplay.innerHTML += `<p style="color:green;font-weight:700;">Calibration OK (one or more eyes meet threshold).</p>`;
    } else {
        parameterDisplay.innerHTML += `<p style="color:crimson;font-weight:700;">Calibration below threshold. Consider recalibration.</p>`;
    }
}