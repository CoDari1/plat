// lib/groups.ts (new file)
import { PlatImage } from "@/types";

export function moveGroup(
    images: PlatImage[],
    draggedId: number,
    dx: number,
    dy: number
): PlatImage[] {
    const dragged = images.find(i => i.id === draggedId);
    if (!dragged?.groupId) {
        // not locked — move only itself
        return images.map(img =>
            img.id === draggedId
                ? { ...img, x: img.x + dx, y: img.y + dy }
                : img
        );
    }

    // move every image that shares the same groupId
    return images.map(img =>
        img.groupId === dragged.groupId
            ? { ...img, x: img.x + dx, y: img.y + dy }
            : img
    );
}