// Julia Set Explorer - Web Worker for Fractal Computation

// Color palettes
const PALETTES = {
    classic: [
        [0, 0, 0],      // Black interior
        [0, 7, 100],    // Deep blue
        [32, 107, 203], // Blue
        [237, 255, 255],// White
        [255, 170, 0],  // Orange
        [0, 2, 0]       // Near black
    ],
    inferno: [
        [0, 0, 0],
        [40, 11, 84],
        [101, 21, 110],
        [159, 42, 99],
        [212, 72, 66],
        [245, 125, 21],
        [250, 193, 39],
        [252, 255, 164]
    ],
    ocean: [
        [0, 0, 20],
        [0, 20, 60],
        [0, 50, 100],
        [0, 100, 150],
        [50, 150, 200],
        [150, 220, 255],
        [255, 255, 255]
    ],
    cosmic: [
        [0, 0, 0],
        [25, 0, 50],
        [75, 0, 100],
        [150, 0, 150],
        [200, 50, 150],
        [255, 100, 100],
        [255, 200, 100],
        [255, 255, 200]
    ],
    grayscale: [
        [0, 0, 0],
        [255, 255, 255]
    ]
};

// Interpolate between colors in a palette
function getColor(t, palette) {
    const colors = PALETTES[palette] || PALETTES.classic;
    const n = colors.length - 1;
    const i = Math.floor(t * n);
    const f = t * n - i;

    if (i >= n) {
        return colors[n];
    }

    const c1 = colors[i];
    const c2 = colors[i + 1];

    return [
        Math.floor(c1[0] + f * (c2[0] - c1[0])),
        Math.floor(c1[1] + f * (c2[1] - c1[1])),
        Math.floor(c1[2] + f * (c2[2] - c1[2]))
    ];
}

// Compute Julia set for a strip of the canvas
function computeJuliaStrip(params) {
    const {
        startY,
        endY,
        width,
        height,
        cReal,
        cImag,
        maxIterations,
        viewCenterX,
        viewCenterY,
        zoom,
        palette,
        isHeatmap
    } = params;

    const stripHeight = endY - startY;
    const data = new Uint8ClampedArray(width * stripHeight * 4);
    const iterationData = new Float32Array(width * stripHeight);

    const aspectRatio = width / height;
    const viewWidth = 4 / zoom;
    const viewHeight = viewWidth / aspectRatio;

    for (let y = startY; y < endY; y++) {
        for (let x = 0; x < width; x++) {
            // Map pixel to complex plane
            const zReal0 = viewCenterX + (x / width - 0.5) * viewWidth;
            const zImag0 = viewCenterY + (y / height - 0.5) * viewHeight;

            let zReal = zReal0;
            let zImag = zImag0;
            let iteration = 0;
            let zReal2 = zReal * zReal;
            let zImag2 = zImag * zImag;

            // Iterate z = z² + c
            while (zReal2 + zImag2 <= 4 && iteration < maxIterations) {
                zImag = 2 * zReal * zImag + cImag;
                zReal = zReal2 - zImag2 + cReal;
                zReal2 = zReal * zReal;
                zImag2 = zImag * zImag;
                iteration++;
            }

            const localY = y - startY;
            const pixelIndex = (localY * width + x) * 4;
            const iterIndex = localY * width + x;

            if (iteration === maxIterations) {
                // Point is in the set - black
                data[pixelIndex] = 0;
                data[pixelIndex + 1] = 0;
                data[pixelIndex + 2] = 0;
                data[pixelIndex + 3] = 255;
                iterationData[iterIndex] = maxIterations;
            } else {
                // Smooth coloring
                const logZn = Math.log(zReal2 + zImag2) / 2;
                const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
                const smoothed = iteration + 1 - nu;

                iterationData[iterIndex] = smoothed;

                // Normalize to [0, 1]
                const t = smoothed / maxIterations;

                let color;
                if (isHeatmap) {
                    // Heatmap: white to deep blue
                    const intensity = 1 - t;
                    color = [
                        Math.floor(255 * intensity * intensity),
                        Math.floor(255 * intensity * intensity),
                        Math.floor(255 * (0.5 + 0.5 * intensity))
                    ];
                } else {
                    // Cycle through palette multiple times for more detail
                    const cycled = (t * 10) % 1;
                    color = getColor(cycled, palette);
                }

                data[pixelIndex] = color[0];
                data[pixelIndex + 1] = color[1];
                data[pixelIndex + 2] = color[2];
                data[pixelIndex + 3] = 255;
            }
        }
    }

    return { data, iterationData, startY, endY };
}

// Compute Mandelbrot set for a strip
function computeMandelbrotStrip(params) {
    const {
        startY,
        endY,
        width,
        height,
        maxIterations,
        viewCenterX,
        viewCenterY,
        zoom,
        palette,
        isHeatmap
    } = params;

    const stripHeight = endY - startY;
    const data = new Uint8ClampedArray(width * stripHeight * 4);

    const aspectRatio = width / height;
    const viewWidth = 4 / zoom;
    const viewHeight = viewWidth / aspectRatio;

    for (let y = startY; y < endY; y++) {
        for (let x = 0; x < width; x++) {
            // Map pixel to complex plane (c varies, z starts at 0)
            const cReal = viewCenterX + (x / width - 0.5) * viewWidth;
            const cImag = viewCenterY + (y / height - 0.5) * viewHeight;

            let zReal = 0;
            let zImag = 0;
            let iteration = 0;
            let zReal2 = 0;
            let zImag2 = 0;

            while (zReal2 + zImag2 <= 4 && iteration < maxIterations) {
                zImag = 2 * zReal * zImag + cImag;
                zReal = zReal2 - zImag2 + cReal;
                zReal2 = zReal * zReal;
                zImag2 = zImag * zImag;
                iteration++;
            }

            const localY = y - startY;
            const pixelIndex = (localY * width + x) * 4;

            if (iteration === maxIterations) {
                data[pixelIndex] = 0;
                data[pixelIndex + 1] = 0;
                data[pixelIndex + 2] = 0;
                data[pixelIndex + 3] = 255;
            } else {
                const logZn = Math.log(zReal2 + zImag2) / 2;
                const nu = Math.log(logZn / Math.log(2)) / Math.log(2);
                const smoothed = iteration + 1 - nu;
                const t = smoothed / maxIterations;

                let color;
                if (isHeatmap) {
                    const intensity = 1 - t;
                    color = [
                        Math.floor(255 * intensity * intensity),
                        Math.floor(255 * intensity * intensity),
                        Math.floor(255 * (0.5 + 0.5 * intensity))
                    ];
                } else {
                    const cycled = (t * 10) % 1;
                    color = getColor(cycled, palette);
                }

                data[pixelIndex] = color[0];
                data[pixelIndex + 1] = color[1];
                data[pixelIndex + 2] = color[2];
                data[pixelIndex + 3] = 255;
            }
        }
    }

    return { data, startY, endY };
}

// Handle messages from main thread
self.onmessage = function(e) {
    const { type, params, id } = e.data;

    let result;
    if (type === 'julia') {
        result = computeJuliaStrip(params);
    } else if (type === 'mandelbrot') {
        result = computeMandelbrotStrip(params);
    }

    self.postMessage({
        id,
        result,
        type
    }, [result.data.buffer]);
};
