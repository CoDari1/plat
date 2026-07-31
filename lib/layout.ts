import { PlatImage } from "@/types";

interface LayoutOptions {
    columns?: number;
    gap: number;
    overlap: number;
}

export function arrangePlatGrid(
    images: PlatImage[],
    options: LayoutOptions = {
        gap: 120,
        overlap: 0,
    }
) {
    const {
        columns = 3,
        gap,
        overlap
    } = options;

    let cellWidth = 0;
    let cellHeight = 0;

    images.forEach((img) => {
        cellWidth = Math.max(cellWidth, img.natW);
        cellHeight = Math.max(cellHeight, img.natH);
    });

    const stepX = cellWidth - cellWidth * overlap + gap;
    const stepY = cellHeight - cellHeight * overlap + gap;

    return images.map((img, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;

        return {
            ...img,
            x: 40 + col * stepX,
            y: 40 + row * stepY,
            rot: 0,
            scale: 1,
        };
    });
}
