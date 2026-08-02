"use client";

import { useState } from "react";
import StageImage from "./StageImage";
import { ControlPoint, PendingPoint, PlatImage } from "@/types";
import ControlPointOverlay from "@/components/ControlPointOverlay";
import { localToWorld } from "@/lib/transforms";
import { snapToEdge } from "@/lib/autoCorrect";
import { moveGroup } from "@/lib/group";


    setImages(prev => moveGroup(prev, image.id, dx, dy));
}
const MIN_ZOOM = 0.03;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 0.25;

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
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
    const zoomIn = () => setZoom((z) => clampZoom(z * 1.25));
    const zoomOut = () => setZoom((z) => clampZoom(z / 1.25));
    const zoomReset = () => setZoom(DEFAULT_ZOOM);

    function onWheel(e: React.WheelEvent) {
        if (!e.ctrlKey && !e.metaKey) return; // plain wheel still scrolls/pans normally
        e.preventDefault();
        setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
    }

    async function addControlPoint(img: PlatImage, rawX: number, rawY: number) {
        if (mode !== "point") {
            return;
        }

        const { x, y } = await snapToEdge(img, rawX, rawY, 30);

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
            width: Math.max(size.width, ...corners.map((point) => point.x * zoom + 200)),
            height: Math.max(size.height, ...corners.map((point) => point.y * zoom + 200)),
        };
    }, { width: 1200, height: 800 });


    return (
        <div className="stage-container" onWheel={onWheel}>
            <div className="zoom-toolbar">
                <button className="icon-button" onClick={zoomOut} aria-label="Zoom out">−</button>
                <button className="zoom-readout" onClick={zoomReset} title="Reset zoom">{Math.round(zoom * 100)}%</button>
                <button className="icon-button" onClick={zoomIn} aria-label="Zoom in">+</button>
            </div>
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
                        viewScale={zoom}
                    />
                ))}

                <ControlPointOverlay

                    points={points}

                    images={images}
                    viewScale={zoom}

                />
                {pending && (() => {
                    const image = images.find((item) => item.id === pending.imgId);
                    if (!image) return null;
                    const point = localToWorld(image, pending.x, pending.y);
                    return <span className="pending-point" style={{ left: point.x * zoom, top: point.y * zoom }} />;
                })()}
            </div>
        </div>
    );
}
