"use client";

import { PlatImage } from "@/types";
import { worldToLocal } from "@/lib/transforms";

interface Props {
    image: PlatImage;
    mode: "move" | "point";
    onPoint: (img: PlatImage, x: number, y: number) => void;
    onMoveMouseDown: (img: PlatImage, e: React.MouseEvent) => void;
    viewScale: number;
    selected: boolean;
}

export default function StageImage({
    image,
    mode,
    onPoint,
    onMoveMouseDown,
    viewScale,
    selected,
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

        onMoveMouseDown(image, e);
    }

    return (
        <div
            onMouseDown={mouseDown}
            className={`plat-image ${mode === "point" ? "point-mode" : ""} ${
                selected ? "selected" : ""
            } ${image.groupId ? "grouped" : ""}`}
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
