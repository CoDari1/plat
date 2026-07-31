import { PlatImage } from "@/types";
import { refineLayer } from "@/lib/refinement";

export function computeBounds(images: PlatImage[]) {
    if (images.length === 0) {
        return {
            minX: 0,
            minY: 0,
            maxX: 1,
            maxY: 1,
        };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    images.forEach((img) => {
        [[0, 0], [img.natW, 0], [0, img.natH], [img.natW, img.natH]].forEach(
            ([x, y]) => {
                const p = localToWorld(img, x, y);

                minX = Math.min(minX, p.x);
                minY = Math.min(minY, p.y);
                maxX = Math.max(maxX, p.x);
                maxY = Math.max(maxY, p.y);
            }
        );
    });

    return {
        minX,
        minY,
        maxX,
        maxY,
    };
}

export async function buildComposite(images: PlatImage[], refine = true) {
    if (images.length === 0) {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 1, 1);
        return canvas;
    }

    const bounds = computeBounds(images);

    const width = Math.ceil(bounds.maxX - bounds.minX);
    const height = Math.ceil(bounds.maxY - bounds.minY);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d")!;

    for (const img of images) {
        await new Promise<void>((resolve, reject) => {
            const image = new Image();

            image.onload = () => {
                const layerCanvas = document.createElement("canvas");
                layerCanvas.width = width;
                layerCanvas.height = height;
                const layerContext = layerCanvas.getContext("2d")!;
                layerContext.save();

                layerContext.translate(img.x - bounds.minX, img.y - bounds.minY);
                layerContext.rotate(img.rot);
                layerContext.scale(img.scale, img.scale);

                layerContext.drawImage(image, 0, 0);
                layerContext.restore();

                if (refine && images.indexOf(img) > 0) {
                    const baseData = ctx.getImageData(0, 0, width, height);
                    const layerData = layerContext.getImageData(0, 0, width, height);
                    ctx.putImageData(refineLayer(baseData, layerData), 0, 0);
                } else {
                    ctx.drawImage(layerCanvas, 0, 0);
                }
                resolve();
            };

            image.onerror = () => reject(new Error(`Failed to render ${img.name}`));

            image.src = img.src;
        });
    }

    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, width, height);

    return canvas;
}

export function localToWorld(
    img: PlatImage,
    px: number,
    py: number
) {
    return {
        x:
            img.x +
            img.scale *
            (
                Math.cos(img.rot) * px -
                Math.sin(img.rot) * py
            ),

        y:
            img.y +
            img.scale *
            (
                Math.sin(img.rot) * px +
                Math.cos(img.rot) * py
            )
    };
}


export function worldToLocal(
    img: PlatImage,
    wx: number,
    wy: number
) {
    const dx = wx - img.x;
    const dy = wy - img.y;

    return {
        x:
            (
                Math.cos(img.rot) * dx +
                Math.sin(img.rot) * dy
            ) /
            img.scale,

        y:
            (
                -Math.sin(img.rot) * dx +
                Math.cos(img.rot) * dy
            ) /
            img.scale
    };
}
