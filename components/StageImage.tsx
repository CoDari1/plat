"use client";

import { PlatImage } from "@/types";
import { worldToLocal } from "@/lib/transforms";
import { moveGroup } from "@/lib/group";

interface Props {
    image: PlatImage;
    mode: "move" | "point";
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>;
    onPoint: (img: PlatImage, x: number, y: number) => void;
    viewScale: number;
}

export default function StageImage({
                                       image,
                                       mode,
                                       setImages,
                                       onPoint,
                                       viewScale,
                                   }: Props) {
    function mouseDown(e: React.MouseEvent) {
        e.stopPropagation();

        if (mode === "point") {
            const stageRect = e.currentTarget.parentElement!.getBoundingClientRect();
            const local = worldToLocal(
                image,
                (e.clientX - stageRect.left) / viewScale,
                (e.clientY - stageRect.top) / viewScale
            );
            onPoint(image, local.x, local.y);
            return;
        }

        const startX = e.clientX;
        const startY = e.clientY;

        // Capture starting positions of the whole group (or just this image)
        const startPositions = new Map<number, { x: number; y: number }>();

        // We need the current images to know the group — we'll read them inside the updater
        function move(ev: MouseEvent) {
            const dx = (ev.clientX - startX) / viewScale;
            const dy = (ev.clientY - startY) / viewScale;

            setImages((prev) => {
                // On first move, record original positions if needed
                if (startPositions.size === 0) {
                    const dragged = prev.find((i) => i.id === image.id);
                    const groupId = dragged?.groupId;
                    prev.forEach((img) => {
                        if (!groupId || img.groupId === groupId || img.id === image.id) {
                            startPositions.set(img.id, { x: img.x, y: img.y });
                        }
                    });
                }

                return prev.map((img) => {
                    const start = startPositions.get(img.id);
                    if (!start) return img;
                    return { ...img, x: start.x + dx, y: start.y + dy };
                });
            });
        }

        function stop() {
            window.removeEventListener("mousemove", move);
        }

        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", stop, { once: true });
    }

    return (
        <div
            onMouseDown={mouseDown}
            className={`plat-image ${mode === "point" ? "point-mode" : ""} ${
                image.groupId ? "grouped" : ""
            }`}
            style={{
                transform: `
          translate(${image.x * viewScale}px, ${image.y * viewScale}px)
          rotate(${image.rot}rad)
          scale(${image.scale * viewScale})
        `,
            }}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={image.src}
                width={image.natW}
                height={image.natH}
                alt={image.name}
                draggable={false}
            />
        </div>
    );
}
