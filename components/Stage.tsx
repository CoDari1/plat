"use client";

import StageImage from "./StageImage";

import { ControlPoint, PendingPoint, PlatImage } from "@/types";
import ControlPointOverlay from "@/components/ControlPointOverlay";
import { localToWorld } from "@/lib/transforms";
import { snapToEdge } from "@/lib/autoCorrect";

const VIEW_SCALE = 0.25;

interface Props {
    images: PlatImage[];
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>;
    points: ControlPoint[];
    setPoints: React.Dispatch<React.SetStateAction<ControlPoint[]>>;
    mode: "move" | "point";
    pending: PendingPoint | null;
    setPending: React.Dispatch<React.SetStateAction<PendingPoint | null>>;
}

export default function Stage({
    images,
    setImages,
    points,
    setPoints,
    mode,
    pending,
    setPending,
}: Props) {
    async function addControlPoint(img: PlatImage, rawX: number, rawY: number) {
        if (mode !== "point") {
            return;
        }

        const { x, y } = await snapToEdge(img, rawX, rawY);

        if (pending && pending.imgId === img.id) {
            setPending(null);
            return;
        }

        if (pending && pending.imgId !== img.id) {
            setPoints((prev) => [
                ...prev,
                {
                    id: Date.now(),
                    aId: pending.imgId,
                    ax: pending.x,
                    ay: pending.y,
                    bId: img.id,
                    bx: x,
                    by: y,
                    auto: false,
                },
            ]);
            setPending(null);
            return;
        }

        setPending({
            imgId: img.id,
            x,
            y,
        });
    }

    const extent = images.reduce((size, image) => {
        const corners = [[0, 0], [image.natW, 0], [0, image.natH], [image.natW, image.natH]]
            .map(([x, y]) => localToWorld(image, x, y));
        return {
            width: Math.max(size.width, ...corners.map((point) => point.x * VIEW_SCALE + 200)),
            height: Math.max(size.height, ...corners.map((point) => point.y * VIEW_SCALE + 200)),
        };
    }, { width: 1200, height: 800 });

    return (
        <div className="stage-container">
            <div className="stage" style={{ width: extent.width, height: extent.height }}>
                {images.length === 0 && (
                    <div className="stage-empty"><strong>EMPTY PLAT</strong><span>Add two or more overlapping images to begin.</span></div>
                )}
                {images.map((img) => (
                    <StageImage
                        key={img.id}
                        image={img}
                        mode={mode}
                        setImages={setImages}
                        onPoint={addControlPoint}
                        viewScale={VIEW_SCALE}
                    />
                ))}

                <ControlPointOverlay

                    points={points}

                    images={images}
                    viewScale={VIEW_SCALE}

                />
                {pending && (() => {
                    const image = images.find((item) => item.id === pending.imgId);
                    if (!image) return null;
                    const point = localToWorld(image, pending.x, pending.y);
                    return <span className="pending-point" style={{ left: point.x * VIEW_SCALE, top: point.y * VIEW_SCALE }} />;
                })()}
            </div>
        </div>
    );
}
