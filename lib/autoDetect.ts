// lib/autoDetect.ts
import { ControlPoint, PlatImage } from "@/types";
import { localToWorld } from "@/lib/transforms";
import { fitSimilarity } from "@/lib/stitching";

// ---------------------------------------------------------------------------
// Working grayscale cache
// ---------------------------------------------------------------------------

interface GrayImage {
    gray: Float32Array;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
}

const cache = new Map<number, GrayImage>();

export function clearAutoDetectCache(id?: number) {
    if (id === undefined) {
        cache.clear();
        return;
    }
    cache.delete(id);
}

async function getWorkingImage(
    image: PlatImage,
    maxDim = 720
): Promise<GrayImage> {
    const cached = cache.get(image.id);
    if (cached) return cached;

    const scale = Math.min(1, maxDim / Math.max(image.natW, image.natH));
    const width = Math.max(1, Math.round(image.natW * scale));
    const height = Math.max(1, Math.round(image.natH * scale));
    const scaleX = width / image.natW;
    const scaleY = height / image.natH;

    const source = new Image();
    await new Promise<void>((resolve, reject) => {
        source.onload = () => resolve();
        source.onerror = () =>
            reject(new Error(`Failed to load ${image.name}`));
        source.src = image.src;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0, width, height);

    const rgba = ctx.getImageData(0, 0, width, height).data;
    const gray = new Float32Array(width * height);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
        gray[j] =
            (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) /
            255;
    }

    const result: GrayImage = { gray, width, height, scaleX, scaleY };
    cache.set(image.id, result);
    return result;
}

// ---------------------------------------------------------------------------
// Harris corners + normalized patches
// ---------------------------------------------------------------------------

interface Feature {
    x: number; // working-space
    y: number;
    strength: number;
    patch: Float32Array;
}

function harris(img: GrayImage, x: number, y: number): number {
    let xx = 0;
    let yy = 0;
    let xy = 0;
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            const o = (y + dy) * img.width + (x + dx);
            const gx = img.gray[o + 1] - img.gray[o - 1];
            const gy = img.gray[o + img.width] - img.gray[o - img.width];
            xx += gx * gx;
            yy += gy * gy;
            xy += gx * gy;
        }
    }
    return xx * yy - xy * xy - 0.05 * (xx + yy) ** 2;
}

function patchAt(
    img: GrayImage,
    x: number,
    y: number,
    radius = 6
): Float32Array | null {
    if (
        x < radius ||
        y < radius ||
        x >= img.width - radius ||
        y >= img.height - radius
    ) {
        return null;
    }
    const size = radius * 2 + 1;
    const patch = new Float32Array(size * size);
    let mean = 0;
    let k = 0;
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const v =
                img.gray[Math.round(y + dy) * img.width + Math.round(x + dx)];
            patch[k++] = v;
            mean += v;
        }
    }
    mean /= patch.length;
    let norm = 0;
    for (let i = 0; i < patch.length; i++) {
        patch[i] -= mean;
        norm += patch[i] * patch[i];
    }
    if (norm < 1e-4) return null;
    norm = Math.sqrt(norm);
    for (let i = 0; i < patch.length; i++) patch[i] /= norm;
    return patch;
}

function detectFeatures(img: GrayImage, maxFeatures = 350): Feature[] {
    const candidates: { x: number; y: number; strength: number }[] = [];
    for (let y = 10; y < img.height - 10; y += 3) {
        for (let x = 10; x < img.width - 10; x += 3) {
            const strength = harris(img, x, y);
            if (strength > 0.00008) {
                candidates.push({ x, y, strength });
            }
        }
    }
    candidates.sort((a, b) => b.strength - a.strength);

    const features: Feature[] = [];
    for (const c of candidates) {
        if (
            features.some(
                (f) => (f.x - c.x) ** 2 + (f.y - c.y) ** 2 < 12 ** 2
            )
        ) {
            continue;
        }
        const patch = patchAt(img, c.x, c.y);
        if (!patch) continue;
        features.push({ ...c, patch });
        if (features.length >= maxFeatures) break;
    }
    return features;
}

function correlation(a: Float32Array, b: Float32Array): number {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function overlaps(a: PlatImage, b: PlatImage): boolean {
    const corners = (img: PlatImage) =>
        [
            [0, 0],
            [img.natW, 0],
            [0, img.natH],
            [img.natW, img.natH],
        ].map(([x, y]) => localToWorld(img, x, y));

    const bounds = (pts: { x: number; y: number }[]) => ({
        minX: Math.min(...pts.map((p) => p.x)),
        maxX: Math.max(...pts.map((p) => p.x)),
        minY: Math.min(...pts.map((p) => p.y)),
        maxY: Math.max(...pts.map((p) => p.y)),
    });

    const aa = bounds(corners(a));
    const bb = bounds(corners(b));
    return (
        aa.minX < bb.maxX &&
        aa.maxX > bb.minX &&
        aa.minY < bb.maxY &&
        aa.maxY > bb.minY
    );
}

interface Match {
    ax: number;
    ay: number;
    bx: number;
    by: number;
    score: number;
}

// ---------------------------------------------------------------------------
// Rigid consensus (all plates same pixel size → scale fixed at 1)
// ---------------------------------------------------------------------------

function rigidConsensus(
    matches: Match[],
    tol = 4,
    minInliers = 3
): Match[] {
    if (matches.length < 2) return matches;

    let best: Match[] = [];

    for (let i = 0; i < matches.length; i++) {
        for (let j = i + 1; j < matches.length; j++) {
            const seed = [matches[i], matches[j]];
            const src = seed.map((m) => ({ x: m.ax, y: m.ay }));
            const dst = seed.map((m) => ({ x: m.bx, y: m.by }));
            const t = fitSimilarity(src, dst, "rigid");

            const cos = Math.cos(t.rot);
            const sin = Math.sin(t.rot);

            const inliers = matches.filter((m) => {
                const px = t.tx + (cos * m.ax - sin * m.ay);
                const py = t.ty + (sin * m.ax + cos * m.ay);
                return Math.hypot(px - m.bx, py - m.by) <= tol;
            });

            if (inliers.length > best.length) best = inliers;
        }
    }

    if (best.length < minInliers) return [];
    return best.sort((a, b) => b.score - a.score).slice(0, 10);
}

// ---------------------------------------------------------------------------
// Match one pair
// ---------------------------------------------------------------------------

async function matchImages(a: PlatImage, b: PlatImage): Promise<Match[]> {
    if (!overlaps(a, b)) return [];

    const [workA, workB] = await Promise.all([
        getWorkingImage(a),
        getWorkingImage(b),
    ]);

    const featuresA = detectFeatures(workA);
    const featuresB = detectFeatures(workB);
    if (featuresA.length < 4 || featuresB.length < 4) return [];

    // Search window in working space, guided by current placement
    const searchRadius = Math.max(
        60,
        Math.min(160, Math.max(workB.width, workB.height) * 0.2)
    );

    const raw: Match[] = [];

    for (const fa of featuresA) {
        const localA = {
            x: fa.x / workA.scaleX,
            y: fa.y / workA.scaleY,
        };
        const world = localToWorld(a, localA.x, localA.y);

        // Predict where this point should land on B given current pose
        const dx = world.x - b.x;
        const dy = world.y - b.y;
        const cos = Math.cos(b.rot);
        const sin = Math.sin(b.rot);
        const predLocalX = (cos * dx + sin * dy) / b.scale;
        const predLocalY = (-sin * dx + cos * dy) / b.scale;
        const predW = {
            x: predLocalX * workB.scaleX,
            y: predLocalY * workB.scaleY,
        };

        let best: Feature | null = null;
        let bestScore = -1;
        let second = -1;

        for (const fb of featuresB) {
            const d2 =
                (fb.x - predW.x) ** 2 + (fb.y - predW.y) ** 2;
            if (d2 > searchRadius ** 2) continue;

            const score = correlation(fa.patch, fb.patch);
            if (score > bestScore) {
                second = bestScore;
                bestScore = score;
                best = fb;
            } else if (score > second) {
                second = score;
            }
        }

        // NCC threshold + ratio test
        if (!best || bestScore < 0.72 || bestScore - second < 0.03) {
            continue;
        }

        raw.push({
            ax: localA.x,
            ay: localA.y,
            bx: best.x / workB.scaleX,
            by: best.y / workB.scaleY,
            score: bestScore,
        });
    }

    // One-to-one on B
    const unique = raw
        .sort((x, y) => y.score - x.score)
        .filter(
            (m, _i, all) =>
                all.findIndex(
                    (o) => Math.hypot(o.bx - m.bx, o.by - m.by) < 10
                ) === all.indexOf(m)
        );

    if (unique.length < 2) return unique;
    return rigidConsensus(unique, 4, 3);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function autoDetect(
    images: PlatImage[]
): Promise<ControlPoint[]> {
    const points: ControlPoint[] = [];

    for (let i = 0; i < images.length; i++) {
        for (let j = i + 1; j < images.length; j++) {
            try {
                const matches = await matchImages(images[i], images[j]);
                for (const m of matches) {
                    points.push({
                        id: Date.now() + points.length,
                        aId: images[i].id,
                        ax: m.ax,
                        ay: m.ay,
                        bId: images[j].id,
                        bx: m.bx,
                        by: m.by,
                        auto: true,
                    });
                }
            } catch (err) {
                console.warn(
                    `autoDetect pair ${images[i].name} ↔ ${images[j].name}:`,
                    err
                );
            }
        }
    }

    return points;
}