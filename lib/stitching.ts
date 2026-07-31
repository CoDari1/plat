import { PlatImage, Point } from "@/types";

export interface Transform {
    scale: number;
    rot: number;
    tx: number;
    ty: number;
}

export function localToWorld(img: PlatImage, px: number, py: number) {
    return {
        x:
            img.x +
            img.scale * (Math.cos(img.rot) * px - Math.sin(img.rot) * py),
        y:
            img.y +
            img.scale * (Math.sin(img.rot) * px + Math.cos(img.rot) * py),
    };
}

export function worldToLocal(img: PlatImage, wx: number, wy: number) {
    const dx = wx - img.x;
    const dy = wy - img.y;

    return {
        px: (Math.cos(img.rot) * dx + Math.sin(img.rot) * dy) / img.scale,
        py: (-Math.sin(img.rot) * dx + Math.cos(img.rot) * dy) / img.scale,
    };
}

export function fitSimilarity(
    src: Point[],
    dst: Point[],
    mode: "rigid" | "similarity" | "translation" = "similarity"
): Transform {
    const n = src.length;

    if (n === 0) {
        return { scale: 1, rot: 0, tx: 0, ty: 0 };
    }

    if (mode === "translation" || n === 1) {
        let sx = 0;
        let sy = 0;
        let dx = 0;
        let dy = 0;

        for (let i = 0; i < n; i++) {
            sx += src[i].x;
            sy += src[i].y;
            dx += dst[i].x;
            dy += dst[i].y;
        }

        return {
            scale: 1,
            rot: 0,
            tx: (dx - sx) / n,
            ty: (dy - sy) / n,
        };
    }

    let Sx = 0;
    let Sy = 0;
    let Dx = 0;
    let Dy = 0;

    let crossA = 0;
    let crossB = 0;
    let denom = 0;

    for (let i = 0; i < n; i++) {
        const x = src[i].x;
        const y = src[i].y;

        const xp = dst[i].x;
        const yp = dst[i].y;

        Sx += x;
        Sy += y;

        Dx += xp;
        Dy += yp;

        denom += x * x + y * y;

        crossA += x * xp + y * yp;
        crossB += x * yp - y * xp;
    }

    denom -= (Sx * Sx + Sy * Sy) / n;

    if (Math.abs(denom) < Number.EPSILON) {
        return fitSimilarity(src, dst, "translation");
    }

    let a = (crossA - (Sx * Dx + Sy * Dy) / n) / denom;
    let b = (crossB - (Sx * Dy - Sy * Dx) / n) / denom;

    const rot = Math.atan2(b, a);

    if (mode === "rigid") {
        a = Math.cos(rot);
        b = Math.sin(rot);
    }

    return {
        scale: Math.sqrt(a * a + b * b),
        rot,
        tx: (Dx - a * Sx + b * Sy) / n,
        ty: (Dy - b * Sx - a * Sy) / n,
    };
}
