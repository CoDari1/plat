"use client";

import { PlatImage } from "@/types";
import { worldToLocal } from "@/lib/transforms";

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
        const oldX = image.x;
        const oldY = image.y;

        function move(ev: MouseEvent) {
            setImages((prev) =>
                prev.map((img) =>
                    img.id === image.id
                        ? {
                              ...img,
                              x: oldX + (ev.clientX - startX) / viewScale,
                              y: oldY + (ev.clientY - startY) / viewScale,
                          }
                        : img
                )
            );
        }

        function stop() {
            window.removeEventListener("mousemove", move);
        }

        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", stop, {
            once: true,
        });
    }

    return (
        <div
            onMouseDown={mouseDown}
            className={`plat-image ${mode === "point" ? "point-mode" : ""}`}
            style={{
               transform: `
                   translate(${image.x * viewScale}px, ${image.y * viewScale}px)
                   rotate(${image.rot}rad)
                   scale(${image.scale * viewScale})
               `,
            }}
        >
            {/* User-loaded data URLs are already local and cannot be optimized by Next/Image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} width={image.natW} height={image.natH} alt={image.name} draggable={false} />
        </div>
    );
}
