// lib/group.ts
import { PlatImage } from "@/types";

/** Assigns a new shared groupId to every image whose id is in `ids`. No-op below 2 images. */
export function groupImages(images: PlatImage[], ids: Set<number>): PlatImage[] {
    if (ids.size < 2) return images;
    const groupId = Date.now();
    return images.map((img) => (ids.has(img.id) ? { ...img, groupId } : img));
}

/** Clears groupId on every image whose id is in `ids`. */
export function ungroupImages(images: PlatImage[], ids: Set<number>): PlatImage[] {
    return images.map((img) => (ids.has(img.id) ? { ...img, groupId: null } : img));
}

/** Every id that shares a groupId with `id` (including itself). Returns just [id] if ungrouped. */
export function groupMembers(images: PlatImage[], id: number): number[] {
    const target = images.find((img) => img.id === id);
    if (!target?.groupId) return [id];
    return images.filter((img) => img.groupId === target.groupId).map((img) => img.id);
}