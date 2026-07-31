interface LayerStats {
    gain: [number, number, number];
    offset: [number, number, number];
}

const CHANNELS = 3;
const MIN_OVERLAP_SAMPLES = 128;

function clampByte(value: number) {
    return Math.max(0, Math.min(255, value));
}

function estimateNormalization(base: ImageData, layer: ImageData): LayerStats {
    const baseSum = [0, 0, 0];
    const layerSum = [0, 0, 0];
    const baseSquareSum = [0, 0, 0];
    const layerSquareSum = [0, 0, 0];
    let samples = 0;

    // Sampling every fourth pixel keeps large scan exports responsive.
    for (let pixel = 0; pixel < base.data.length; pixel += 16) {
        if (base.data[pixel + 3] < 240 || layer.data[pixel + 3] < 240) continue;

        for (let channel = 0; channel < CHANNELS; channel++) {
            const baseValue = base.data[pixel + channel];
            const layerValue = layer.data[pixel + channel];
            baseSum[channel] += baseValue;
            layerSum[channel] += layerValue;
            baseSquareSum[channel] += baseValue * baseValue;
            layerSquareSum[channel] += layerValue * layerValue;
        }
        samples++;
    }

    if (samples < MIN_OVERLAP_SAMPLES) {
        return { gain: [1, 1, 1], offset: [0, 0, 0] };
    }

    const gain = [1, 1, 1] as [number, number, number];
    const offset = [0, 0, 0] as [number, number, number];

    for (let channel = 0; channel < CHANNELS; channel++) {
        const baseMean = baseSum[channel] / samples;
        const layerMean = layerSum[channel] / samples;
        const baseVariance = Math.max(0, baseSquareSum[channel] / samples - baseMean ** 2);
        const layerVariance = Math.max(0, layerSquareSum[channel] / samples - layerMean ** 2);
        const rawGain = layerVariance > 16 ? Math.sqrt(baseVariance / layerVariance) : 1;

        // Conservative limits avoid amplifying scanner noise or clipped highlights.
        gain[channel] = Math.max(0.75, Math.min(1.33, rawGain));
        offset[channel] = Math.max(-48, Math.min(48, baseMean - layerMean * gain[channel]));
    }

    return { gain, offset };
}

function normalizeLayer(layer: ImageData, stats: LayerStats) {
    for (let pixel = 0; pixel < layer.data.length; pixel += 4) {
        if (layer.data[pixel + 3] === 0) continue;
        for (let channel = 0; channel < CHANNELS; channel++) {
            layer.data[pixel + channel] = clampByte(
                layer.data[pixel + channel] * stats.gain[channel] + stats.offset[channel]
            );
        }
    }
}

function blurMask(source: Float32Array, width: number, height: number, radius: number) {
    if (radius < 1) return source.slice();
    const horizontal = new Float32Array(source.length);
    const output = new Float32Array(source.length);

    for (let y = 0; y < height; y++) {
        let sum = 0;
        const row = y * width;
        for (let x = -radius; x <= radius; x++) sum += source[row + Math.max(0, Math.min(width - 1, x))];
        for (let x = 0; x < width; x++) {
            horizontal[row + x] = sum / (radius * 2 + 1);
            sum -= source[row + Math.max(0, x - radius)];
            sum += source[row + Math.min(width - 1, x + radius + 1)];
        }
    }

    for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let y = -radius; y <= radius; y++) sum += horizontal[Math.max(0, Math.min(height - 1, y)) * width + x];
        for (let y = 0; y < height; y++) {
            output[y * width + x] = sum / (radius * 2 + 1);
            sum -= horizontal[Math.max(0, y - radius) * width + x];
            sum += horizontal[Math.min(height - 1, y + radius + 1) * width + x];
        }
    }
    return output;
}

function blurChannel(source: Float32Array, width: number, height: number, radius: number) {
    return blurMask(source, width, height, radius);
}

/** Color-match a rendered plate to the accumulated image and blend three frequency bands. */
export function refineLayer(base: ImageData, layer: ImageData) {
    const { width, height } = base;
    normalizeLayer(layer, estimateNormalization(base, layer));

    const pixels = width * height;
    const layerMask = new Float32Array(pixels);
    for (let i = 0; i < pixels; i++) {
        const layerAlpha = layer.data[i * 4 + 3] / 255;
        layerMask[i] = layerAlpha;
    }

    const seamMasks = [blurMask(layerMask, width, height, 2), blurMask(layerMask, width, height, 12), blurMask(layerMask, width, height, 40)];
    const output = new ImageData(width, height);

    for (let channel = 0; channel < CHANNELS; channel++) {
        const baseChannel = new Float32Array(pixels);
        const layerChannel = new Float32Array(pixels);
        for (let i = 0; i < pixels; i++) {
            baseChannel[i] = base.data[i * 4 + channel];
            layerChannel[i] = layer.data[i * 4 + channel];
        }

        const baseMid = blurChannel(baseChannel, width, height, 4);
        const layerMid = blurChannel(layerChannel, width, height, 4);
        const baseLow = blurChannel(baseMid, width, height, 20);
        const layerLow = blurChannel(layerMid, width, height, 20);

        for (let i = 0; i < pixels; i++) {
            const onlyLayer = base.data[i * 4 + 3] === 0;
            const onlyBase = layer.data[i * 4 + 3] === 0;
            if (onlyLayer) output.data[i * 4 + channel] = layerChannel[i];
            else if (onlyBase) output.data[i * 4 + channel] = baseChannel[i];
            else {
                const high = (baseChannel[i] - baseMid[i]) * (1 - seamMasks[0][i]) + (layerChannel[i] - layerMid[i]) * seamMasks[0][i];
                const mid = (baseMid[i] - baseLow[i]) * (1 - seamMasks[1][i]) + (layerMid[i] - layerLow[i]) * seamMasks[1][i];
                const low = baseLow[i] * (1 - seamMasks[2][i]) + layerLow[i] * seamMasks[2][i];
                output.data[i * 4 + channel] = clampByte(high + mid + low);
            }
        }
    }

    for (let i = 0; i < pixels; i++) {
        output.data[i * 4 + 3] = Math.max(base.data[i * 4 + 3], layer.data[i * 4 + 3]);
    }
    return output;
}
