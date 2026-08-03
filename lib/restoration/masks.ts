export type Defect = {
    type: "scratch" | "dust" | "tear" | "gap" | "crease";
    x: number;
    y: number;
    width: number;
    height: number;
};

/**
 * Detect strong horizontal crease/fold lines.
 * Works well on the kind of dark fold lines in your Martin School plat.
 */
export function detectHorizontalCreases(
    gray: Uint8Array, // 0-255 grayscale
    width: number,
    height: number,
    options: {
        minDarkness?: number;   // how dark the line must be (0-255)
        minWidthRatio?: number; // must span at least this fraction of image width
        thickness?: number;     // how thick to make the mask
    } = {}
): Defect[] {
    const {
        minDarkness = 90,
        minWidthRatio = 0.55,
        thickness = 14,
    } = options;

    const projection = new Float32Array(height);

    // Average each row
    for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = 0; x < width; x++) {
            sum += gray[y * width + x];
        }
        projection[y] = sum / width;
    }

    // Find dark horizontal bands
    const defects: Defect[] = [];
    let y = 0;

    while (y < height) {
        if (projection[y] < minDarkness) {
            // start of a dark band
            let y1 = y;
            while (y < height && projection[y] < minDarkness + 15) {
                y++;
            }
            let y2 = y;

            const bandHeight = y2 - y1;
            if (bandHeight >= 2 && bandHeight <= 40) {
                // Check that it actually spans most of the width
                // (simple version — you can improve later)
                defects.push({
                    type: "crease",
                    x: 0,
                    y: Math.max(0, y1 - Math.floor(thickness / 2)),
                    width,
                    height: Math.min(height - y1, bandHeight + thickness),
                });
            }
        } else {
            y++;
        }
    }

    return defects;
}

export function createMask(
    width: number,
    height: number,
    defects: Defect[]
): Uint8Array {
    const mask = new Uint8Array(width * height);

    for (const defect of defects) {
        for (let y = defect.y; y < defect.y + defect.height; y++) {
            if (y < 0 || y >= height) continue;

            for (let x = defect.x; x < defect.x + defect.width; x++) {
                if (x < 0 || x >= width) continue;

                mask[y * width + x] = 255;
            }
        }
    }

    return mask;
}