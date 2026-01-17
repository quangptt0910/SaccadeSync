/**
 * @file mathUtils.js
 * @description Mathematical utility functions for calibration algorithms.
 * Primarily focuses on regression techniques including Ordinary Least Squares (OLS)
 * and Ridge Regression (L2 Regularization) to map eye features to screen coordinates.
 */

/**
 * Performs Ordinary Least Squares (OLS) regression.
 * Solves the linear equation system: β = (X^T X)^-1 X^T y
 *
 * @param {Array<Array<number>>} A - The design matrix X (m samples × n features).
 * @param {Array<number>} b - The target values vector y (m × 1).
 * @returns {Array<number>|null} The coefficients vector β (n × 1), or null if the matrix is singular.
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
 * Performs Ridge Regression (L2 regularization).
 * Solves the linear equation system with a regularization term: β = (X^T X + λI)^-1 X^T y
 * This is useful to prevent overfitting, especially when the number of features is large relative to samples.
 *
 * @param {Array<Array<number>>} A - The design matrix X (m samples × n features).
 * @param {Array<number>} b - The target values vector y (m × 1).
 * @param {number} [lambda=0.01] - The regularization parameter λ. Higher values enforce stronger regularization.
 * @returns {Array<number>|null} The coefficients vector β (n × 1), or null if the calculation fails.
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
 * Solves a system of linear equations Ax = b using Gaussian Elimination.
 *
 * @param {Array<Array<number>>} A - The coefficient matrix (n × n).
 * @param {Array<number>} b - The constant vector (n × 1).
 * @returns {Array<number>|null} The solution vector x (n × 1), or null if the matrix is singular.
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
 * Performs k-fold cross-validation to find the optimal regularization parameter (lambda) for Ridge Regression.
 *
 * @param {Array<Array<number>>} A - The design matrix X.
 * @param {Array<number>} b - The target values vector y.
 * @param {Array<number>} [lambdaRange=[0.001, 0.01, 0.1, 1.0, 10.0]] - Array of lambda values to test.
 * @param {number} [k=5] - Number of folds for cross-validation.
 * @returns {number} The lambda value that resulted in the lowest average Mean Squared Error.
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