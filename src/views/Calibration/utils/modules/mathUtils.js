/**
 * Transposes a matrix.
 * @param {Array<Array<number>>} m - The input matrix.
 * @returns {Array<Array<number>>} The transposed matrix.
 */
export function transpose(m) {
    return m[0].map((_, i) => m.map(r => r[i]));
}

/**
 * Multiplies two matrices (A * B).
 * @param {Array<Array<number>>} a - Matrix A.
 * @param {Array<Array<number>>} b - Matrix B.
 * @returns {Array<Array<number>>} The result matrix.
 */
export function multiply(a, b) {
    const r = [];
    for (let i = 0; i < a.length; i++) {
        r[i] = [];
        for (let j = 0; j < b[0].length; j++) {
            let sum = 0;
            for (let k = 0; k < b.length; k++) {
                sum += a[i][k] * b[k][j];
            }
            r[i][j] = sum;
        }
    }
    return r;
}

/**
 * Calculates the inverse of a square matrix using Gaussian elimination.
 * @param {Array<Array<number>>} m - The input square matrix.
 * @returns {Array<Array<number>>|null} The inverted matrix, or null if singular.
 */
export function invert(m) {
    const n = m.length;
    const I = m.map((row, i) =>
        row.map((_, j) => (i === j ? 1 : 0))
    );
    const M = m.map(row => row.slice());

    for (let i = 0; i < n; i++) {
        let diag = M[i][i];
        if (Math.abs(diag) < 1e-12) return null;

        for (let j = 0; j < n; j++) {
            M[i][j] /= diag;
            I[i][j] /= diag;
        }

        for (let k = 0; k < n; k++) {
            if (k === i) continue;
            const f = M[k][i];
            for (let j = 0; j < n; j++) {
                M[k][j] -= f * M[i][j];
                I[k][j] -= f * I[i][j];
            }
        }
    }

    return I;
}

/**
 * Solves the linear least squares problem Ax = b using the Normal Equation: x = (A^T A)^-1 A^T b.
 *
 * @param {Array<Array<number>>} A - Design matrix (samples x features).
 * @param {Array<number>} b - Target vector.
 * @returns {Array<number>|null} The coefficient vector x, or null if the matrix cannot be inverted.
 */
export function leastSquares(A, b) {
    const AT = transpose(A);
    const ATA = multiply(AT, A);
    const ATb = multiply(AT, b.map(v => [v]));
    const ATA_inv = invert(ATA);
    if (!ATA_inv) return null;
    return multiply(ATA_inv, ATb).map(r => r[0]);
}