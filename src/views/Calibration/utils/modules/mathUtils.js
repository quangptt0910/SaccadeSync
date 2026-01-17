// Calibration/mathUtils.js

/**
 * Ordinary Least Squares (your current method)
 * Solves: β = (X^T X)^-1 X^T y
 */
export function leastSquares(A, b) {
    const m = A.length;
    const n = A[0].length;

    // Compute X^T X
    const XtX = [];
    for (let i = 0; i < n; i++) {
        XtX[i] = [];
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < m; k++) {
                sum += A[k][i] * A[k][j];
            }
            XtX[i][j] = sum;
        }
    }

    // Compute X^T y
    const Xty = [];
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = 0; k < m; k++) {
            sum += A[k][i] * b[k];
        }
        Xty[i] = sum;
    }

    // Solve via Gaussian elimination
    const beta = gaussianElimination(XtX, Xty);
    return beta;
}

/**
 * Ridge Regression (L2 regularization)
 * Solves: β = (X^T X + λI)^-1 X^T y
 *
 * @param {Array<Array<number>>} A - Design matrix (m samples × n features)
 * @param {Array<number>} b - Target values (m × 1)
 * @param {number} lambda - Regularization parameter (default: 0.01)
 * @returns {Array<number>|null} - Coefficients (n × 1) or null if failed
 */
export function ridgeRegression(A, b, lambda = 0.01) {
    const m = A.length;
    const n = A[0].length;

    if (m < n) {
        console.warn('Ridge: fewer samples than features, increasing lambda');
        lambda = Math.max(lambda, 0.1);
    }

    // Compute X^T X
    const XtX = [];
    for (let i = 0; i < n; i++) {
        XtX[i] = [];
        for (let j = 0; j < n; j++) {
            let sum = 0;
            for (let k = 0; k < m; k++) {
                sum += A[k][i] * A[k][j];
            }
            XtX[i][j] = sum;
        }
    }

    // Add λI to diagonal (regularization term)
    // Note: Don't regularize intercept (index 0)
    for (let i = 1; i < n; i++) {  // Start at 1 to skip intercept
        XtX[i][i] += lambda;
    }

    // Compute X^T y
    const Xty = [];
    for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = 0; k < m; k++) {
            sum += A[k][i] * b[k];
        }
        Xty[i] = sum;
    }

    // Solve (X^T X + λI) β = X^T y
    const beta = gaussianElimination(XtX, Xty);
    return beta;
}

/**
 * Gaussian Elimination for solving Ax = b
 */
function gaussianElimination(A, b) {
    const n = A.length;

    // Create augmented matrix [A|b]
    const aug = A.map((row, i) => [...row, b[i]]);

    // Forward elimination
    for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
            if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) {
                maxRow = k;
            }
        }

        // Swap rows
        [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

        // Check for singular matrix
        if (Math.abs(aug[i][i]) < 1e-10) {
            console.error('Matrix is singular or near-singular');
            return null;
        }

        // Eliminate column
        for (let k = i + 1; k < n; k++) {
            const factor = aug[k][i] / aug[i][i];
            for (let j = i; j <= n; j++) {
                aug[k][j] -= factor * aug[i][j];
            }
        }
    }

    // Back substitution
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
        x[i] = aug[i][n];
        for (let j = i + 1; j < n; j++) {
            x[i] -= aug[i][j] * x[j];
        }
        x[i] /= aug[i][i];
    }

    return x;
}

/**
 * Cross-validation to find optimal lambda
 * Uses k-fold cross-validation
 */
export function findOptimalLambda(A, b, lambdaRange = [0.001, 0.01, 0.1, 1.0, 10.0], k = 5) {
    const m = A.length;
    const foldSize = Math.floor(m / k);

    let bestLambda = lambdaRange[0];
    let bestError = Infinity;

    for (const lambda of lambdaRange) {
        let totalError = 0;

        // k-fold cross-validation
        for (let fold = 0; fold < k; fold++) {
            const testStart = fold * foldSize;
            const testEnd = (fold === k - 1) ? m : (fold + 1) * foldSize;

            // Split into train/test
            const trainA = [], trainB = [], testA = [], testB = [];

            for (let i = 0; i < m; i++) {
                if (i >= testStart && i < testEnd) {
                    testA.push(A[i]);
                    testB.push(b[i]);
                } else {
                    trainA.push(A[i]);
                    trainB.push(b[i]);
                }
            }

            // Train model
            const beta = ridgeRegression(trainA, trainB, lambda);
            if (!beta) continue;

            // Test error
            for (let i = 0; i < testA.length; i++) {
                let pred = 0;
                for (let j = 0; j < beta.length; j++) {
                    pred += beta[j] * testA[i][j];
                }
                const error = pred - testB[i];
                totalError += error * error;
            }
        }

        const avgError = totalError / m;

        if (avgError < bestError) {
            bestError = avgError;
            bestLambda = lambda;
        }
    }

    console.log(`Optimal lambda: ${bestLambda} (CV error: ${Math.sqrt(bestError).toFixed(4)})`);
    return bestLambda;
}

// export function transpose(m) {
//     return m[0].map((_, i) => m.map(r => r[i]));
// }
//
// export function multiply(a, b) {
//     const r = [];
//     for (let i = 0; i < a.length; i++) {
//         r[i] = [];
//         for (let j = 0; j < b[0].length; j++) {
//             let sum = 0;
//             for (let k = 0; k < b.length; k++) {
//                 sum += a[i][k] * b[k][j];
//             }
//             r[i][j] = sum;
//         }
//     }
//     return r;
// }
//
// export function invert(m) {
//     const n = m.length;
//     const I = m.map((row, i) =>
//         row.map((_, j) => (i === j ? 1 : 0))
//     );
//     const M = m.map(row => row.slice());
//
//     for (let i = 0; i < n; i++) {
//         let diag = M[i][i];
//         if (Math.abs(diag) < 1e-12) return null;
//
//         for (let j = 0; j < n; j++) {
//             M[i][j] /= diag;
//             I[i][j] /= diag;
//         }
//
//         for (let k = 0; k < n; k++) {
//             if (k === i) continue;
//             const f = M[k][i];
//             for (let j = 0; j < n; j++) {
//                 M[k][j] -= f * M[i][j];
//                 I[k][j] -= f * I[i][j];
//             }
//         }
//     }
//
//     return I;
// }
//
// export function leastSquares(A, b) {
//     const AT = transpose(A);
//     const ATA = multiply(AT, A);
//     const ATb = multiply(AT, b.map(v => [v]));
//     const ATA_inv = invert(ATA);
//     if (!ATA_inv) return null;
//     return multiply(ATA_inv, ATb).map(r => r[0]);
// }