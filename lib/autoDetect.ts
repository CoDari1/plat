import { ControlPoint, PlatImage } from "@/types";
import { localToWorld, worldToLocal } from "@/lib/transforms";

interface GrayImage { gray: Float32Array; width: number; height: number; scale: number; }
interface Feature { x: number; y: number; strength: number; patch: Float32Array; }
interface Match { ax: number; ay: number; bx: number; by: number; score: number; dx: number; dy: number; }

const cache = new Map<number, GrayImage>();

async function getWorkingImage(image: PlatImage, maxDim = 720): Promise<GrayImage> {
    const cached = cache.get(image.id);
    if (cached) return cached;
    const scale = Math.min(1, maxDim / Math.max(image.natW, image.natH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.natW * scale));
    canvas.height = Math.max(1, Math.round(image.natH * scale));
    const source = new Image();
    await new Promise<void>((resolve, reject) => {
        source.onload = () => resolve();
        source.onerror = () => reject(new Error(`Failed to load ${image.name}`));
        source.src = image.src;
    });
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const gray = new Float32Array(canvas.width * canvas.height);
    for (let sourceIndex = 0, targetIndex = 0; sourceIndex < rgba.length; sourceIndex += 4, targetIndex++) {
        gray[targetIndex] = (rgba[sourceIndex] * .299 + rgba[sourceIndex + 1] * .587 + rgba[sourceIndex + 2] * .114) / 255;
    }
    const result = { gray, width: canvas.width, height: canvas.height, scale };
    cache.set(image.id, result);
    return result;
}

function harris(image: GrayImage, x: number, y: number) {
    let xx = 0, yy = 0, xy = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const offset = (y + dy) * image.width + x + dx;
        const gx = image.gray[offset + 1] - image.gray[offset - 1];
        const gy = image.gray[offset + image.width] - image.gray[offset - image.width];
        xx += gx * gx; yy += gy * gy; xy += gx * gy;
    }
    return xx * yy - xy * xy - .05 * (xx + yy) ** 2;
}

function patchAt(image: GrayImage, x: number, y: number, radius = 6) {
    if (x < radius || y < radius || x >= image.width - radius || y >= image.height - radius) return null;
    const patch = new Float32Array((radius * 2 + 1) ** 2);
    let index = 0, mean = 0;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const value = image.gray[Math.round(y + dy) * image.width + Math.round(x + dx)];
        patch[index++] = value; mean += value;
    }
    mean /= patch.length;
    let norm = 0;
    for (let i = 0; i < patch.length; i++) { patch[i] -= mean; norm += patch[i] ** 2; }
    if (norm < .0001) return null;
    norm = Math.sqrt(norm);
    for (let i = 0; i < patch.length; i++) patch[i] /= norm;
    return patch;
}

function detectFeatures(image: GrayImage) {
    const candidates: Omit<Feature, "patch">[] = [];
    for (let y = 10; y < image.height - 10; y += 3) for (let x = 10; x < image.width - 10; x += 3) {
        const strength = harris(image, x, y);
        if (strength > .00008) candidates.push({ x, y, strength });
    }
    candidates.sort((a, b) => b.strength - a.strength);
    const features: Feature[] = [];
    for (const candidate of candidates) {
        if (features.some((item) => (item.x - candidate.x) ** 2 + (item.y - candidate.y) ** 2 < 12 ** 2)) continue;
        const patch = patchAt(image, candidate.x, candidate.y);
        if (patch) features.push({ ...candidate, patch });
        if (features.length === 300) break;
    }
    return features;
}

function correlation(a: Float32Array, b: Float32Array) {
    let score = 0;
    for (let i = 0; i < a.length; i++) score += a[i] * b[i];
    return score;
}

function overlaps(a: PlatImage, b: PlatImage) {
    const corners = (image: PlatImage) => [[0, 0], [image.natW, 0], [0, image.natH], [image.natW, image.natH]].map(([x, y]) => localToWorld(image, x, y));
    const bounds = (points: { x: number; y: number }[]) => ({ minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) });
    const aa = bounds(corners(a)), bb = bounds(corners(b));
    return aa.minX < bb.maxX && aa.maxX > bb.minX && aa.minY < bb.maxY && aa.maxY > bb.minY;
}

async function matchImages(a: PlatImage, b: PlatImage): Promise<Match[]> {
    if (!overlaps(a, b)) return [];
    const [workA, workB] = await Promise.all([getWorkingImage(a), getWorkingImage(b)]);
    const [featuresA, featuresB] = [detectFeatures(workA), detectFeatures(workB)];
    const raw: Match[] = [];
    const searchRadius = Math.max(70, Math.min(180, Math.max(workB.width, workB.height) * .22));

    for (const featureA of featuresA) {
        const localA = { x: featureA.x / workA.scale, y: featureA.y / workA.scale };
        const predictedWorld = localToWorld(a, localA.x, localA.y);
        const predictedLocalB = worldToLocal(b, predictedWorld.x, predictedWorld.y);
        const predicted = { x: predictedLocalB.x * workB.scale, y: predictedLocalB.y * workB.scale };
        let best: Feature | null = null, bestScore = -1, secondScore = -1;
        for (const featureB of featuresB) {
            if ((featureB.x - predicted.x) ** 2 + (featureB.y - predicted.y) ** 2 > searchRadius ** 2) continue;
            const score = correlation(featureA.patch, featureB.patch);
            if (score > bestScore) { secondScore = bestScore; bestScore = score; best = featureB; }
            else if (score > secondScore) secondScore = score;
        }
        if (!best || bestScore < .72 || bestScore - secondScore < .035) continue;
        const localB = { x: best.x / workB.scale, y: best.y / workB.scale };
        const worldA = localToWorld(a, localA.x, localA.y), worldB = localToWorld(b, localB.x, localB.y);
        raw.push({ ax: localA.x, ay: localA.y, bx: localB.x, by: localB.y, score: bestScore, dx: worldB.x - worldA.x, dy: worldB.y - worldA.y });
    }

    // Keep one-to-one matches belonging to the dominant geometric translation.
    const unique = raw.sort((x, y) => y.score - x.score).filter((match, index, all) =>
        all.findIndex(other => Math.hypot(other.bx - match.bx, other.by - match.by) < 10) === index
    );
    if (unique.length < 2) return unique;
    const tolerance = 18;
    const consensus = unique.map(seed => unique.filter(item => Math.hypot(item.dx - seed.dx, item.dy - seed.dy) <= tolerance))
        .sort((x, y) => y.length - x.length)[0];
    return consensus.sort((x, y) => y.score - x.score).slice(0, 10);
}

export async function autoDetect(images: PlatImage[]): Promise<ControlPoint[]> {
    const points: ControlPoint[] = [];
    for (let i = 0; i < images.length; i++) for (let j = i + 1; j < images.length; j++) {
        const matches = await matchImages(images[i], images[j]);
        for (const match of matches) points.push({ id: Date.now() + points.length, aId: images[i].id, ax: match.ax, ay: match.ay, bId: images[j].id, bx: match.bx, by: match.by, auto: true });
    }
    return points;
}
