import { PlatImage } from "@/types";

export interface RGB {
    r: number;
    g: number;
    b: number;
}

export interface CorrectionResult {
    src: string;
    width: number;
    height: number;
    angleCorrectedDeg: number;
    background: RGB;
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image for correction"));
        img.src = src;
    });
}

function toGray(data: Uint8ClampedArray, w: number, h: number): Float32Array {
    const gray = new Float32Array(w * h);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }
    return gray;
}

/**
 * Estimates the rotation (in radians) needed to snap the dominant line
 * structure in the image to exact 0/90/180/270 degrees.
 *
 * Uses a Sobel gradient-orientation histogram with a 4x angle-doubling
 * trick: edge gradients are ambiguous mod 180 degrees (an edge and its
 * reverse look identical), and we want the dominant axis mod 90 degrees
 * (horizontal or vertical lines both count as "aligned"). Multiplying
 * the angle by 4 collapses both ambiguities into a single circular mean,
 * which is far more robust than picking a single strongest edge.
 */
export function detectSkewAngle(gray: Float32Array, w: number, h: number): number {
    let sumCos = 0;
    let sumSin = 0;
    const step = 2;

    for (let y = 2; y < h - 2; y += step) {
        for (let x = 2; x < w - 2; x += step) {
            const gx = gray[y * w + x + 1] - gray[y * w + x - 1];
            const gy = gray[(y + 1) * w + x] - gray[(y - 1) * w + x];
            const mag = Math.hypot(gx, gy);
            if (mag < 14) continue; // skip flat background / scan noise

            const theta4 = 4 * Math.atan2(gy, gx);
            sumCos += mag * Math.cos(theta4);
            sumSin += mag * Math.sin(theta4);
        }
    }

    if (sumCos === 0 && sumSin === 0) return 0;
    return Math.atan2(sumSin, sumCos) / 4; // back to a -45..45deg equivalent range
}

/**
 * Robustly estimates the paper/background color by sampling a band along
 * all four edges of the image (median per channel, so text/lines near the
 * border don't skew the estimate).
 */
export function estimateBackgroundColor(data: Uint8ClampedArray, w: number, h: number): RGB {
    const samples: [number[], number[], number[]] = [[], [], []];
    const margin = Math.max(4, Math.round(Math.min(w, h) * 0.015));
    const band = Math.max(3, Math.round(Math.min(w, h) * 0.02));

    const sampleRegion = (x0: number, y0: number, x1: number, y1: number) => {
        for (let y = Math.max(0, y0); y < Math.min(h, y1); y += 2) {
            for (let x = Math.max(0, x0); x < Math.min(w, x1); x += 2) {
                const idx = (y * w + x) * 4;
                samples[0].push(data[idx]);
                samples[1].push(data[idx + 1]);
                samples[2].push(data[idx + 2]);
            }
        }
    };

    sampleRegion(margin, margin, w - margin, margin + band);
    sampleRegion(margin, h - margin - band, w - margin, h - margin);
    sampleRegion(margin, margin, margin + band, h - margin);
    sampleRegion(w - margin - band, margin, w - margin, h - margin);

    const median = (arr: number[]) => {
        if (arr.length === 0) return 255;
        const sorted = [...arr].sort((a, b) => a - b);
        return sorted[Math.floor(sorted.length / 2)];
    };

    return { r: median(samples[0]), g: median(samples[1]), b: median(samples[2]) };
}

/**
 * Straightens an image to true 0/90 degrees and normalizes its background
 * color to a target value. This is deterministic pixel math (rotation +
 * per-channel additive shift) — it never invents content, it only
 * repositions and re-tones the pixels that are already there.
 */
export async function autoCorrectSource(
    src: string,
    targetBg: RGB = { r: 255, g: 255, b: 255 }
): Promise<CorrectionResult> {
    const img = await loadImage(src);

    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = img.naturalWidth;
    srcCanvas.height = img.naturalHeight;
    const sctx = srcCanvas.getContext("2d", { willReadFrequently: true })!;
    sctx.drawImage(img, 0, 0);

    const srcImageData = sctx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
    const gray = toGray(srcImageData.data, srcCanvas.width, srcCanvas.height);
    const angle = detectSkewAngle(gray, srcCanvas.width, srcCanvas.height);
    const background = estimateBackgroundColor(srcImageData.data, srcCanvas.width, srcCanvas.height);

    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const newW = Math.ceil(srcCanvas.width * cos + srcCanvas.height * sin);
    const newH = Math.ceil(srcCanvas.width * sin + srcCanvas.height * cos);

    const outCanvas = document.createElement("canvas");
    outCanvas.width = newW;
    outCanvas.height = newH;
    const octx = outCanvas.getContext("2d")!;

    // Fill expanded corners with the *original* background color first so the
    // rotate doesn't introduce a mismatched fill that the shift below then
    // has to fight with.
    octx.fillStyle = `rgb(${background.r},${background.g},${background.b})`;
    octx.fillRect(0, 0, newW, newH);
    octx.translate(newW / 2, newH / 2);
    octx.rotate(-angle);
    octx.drawImage(srcCanvas, -srcCanvas.width / 2, -srcCanvas.height / 2);
    octx.setTransform(1, 0, 0, 1, 0, 0);

    const outData = octx.getImageData(0, 0, newW, newH);
    const shiftR = targetBg.r - background.r;
    const shiftG = targetBg.g - background.g;
    const shiftB = targetBg.b - background.b;
    const d = outData.data;
    for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.max(0, Math.min(255, d[i] + shiftR));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + shiftG));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + shiftB));
    }
    octx.putImageData(outData, 0, 0);

    return {
        src: outCanvas.toDataURL("image/png"),
        width: newW,
        height: newH,
        angleCorrectedDeg: (angle * 180) / Math.PI,
        background,
    };
}

// ---- edge-snapping for precise control point placement ----

const grayCache = new Map<string, { gray: Float32Array; w: number; h: number }>();

export function clearGrayCache(id?: number) {
    if (id === undefined) { grayCache.clear(); return; }
    for (const key of grayCache.keys()) {
        if (key.startsWith(`${id}:`)) grayCache.delete(key);
    }
}

async function getGray(image: PlatImage): Promise<{ gray: Float32Array; w: number; h: number }> {
    const key = `${image.id}:${image.src.length}`;
    const cached = grayCache.get(key);
    if (cached) return cached;

    const img = await loadImage(image.src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const gray = toGray(data, canvas.width, canvas.height);
    const result = { gray, w: canvas.width, h: canvas.height };
    grayCache.set(key, result);
    return result;
}

/**
 * Given a rough click location in an image's local (natural-pixel) space,
 * searches a small neighborhood for the strongest edge and returns that
 * pixel instead — so two clicks meant to mark "the same line" on two
 * different scans both land precisely on the line's center rather than a
 * few pixels off from imprecise clicking.
 */
export async function snapToEdge(
    image: PlatImage,
    x: number,
    y: number,
    radius = 7
): Promise<{ x: number; y: number }> {
    try {
        const { gray, w, h } = await getGray(image);
        const cx = Math.round(x);
        const cy = Math.round(y);
        let bestScore = -1;
        let bestX = x;
        let bestY = y;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const px = cx + dx;
                const py = cy + dy;
                if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
                const gx = gray[py * w + px + 1] - gray[py * w + px - 1];
                const gy = gray[(py + 1) * w + px] - gray[(py - 1) * w + px];
                const mag = gx * gx + gy * gy;
                if (mag > bestScore) {
                    bestScore = mag;
                    bestX = px;
                    bestY = py;
                }
            }
        }
        // Only snap if we actually found meaningful edge strength nearby —
        // otherwise trust the user's original click (e.g. a blank-area point).
        return bestScore > 400 ? { x: bestX, y: bestY } : { x, y };
    } catch {
        return { x, y };
    }
}
