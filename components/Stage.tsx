"use client";

import { useEffect, useRef, useState } from "react";
import StageImage from "./StageImage";
import { ControlPoint, PendingPoint, PlatImage } from "@/types";
import ControlPointOverlay from "@/components/ControlPointOverlay";
import { localToWorld } from "@/lib/transforms";
import { snapToEdge } from "@/lib/autoCorrect";
import { groupImages, ungroupImages, groupMembers } from "@/lib/group";

const MIN_ZOOM = 0.03;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = 0.25;

interface Rect {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

interface Props {
    images: PlatImage[];
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>;
    points: ControlPoint[];
    setPoints: React.Dispatch<React.SetStateAction<ControlPoint[]>>;
    mode: "move" | "point";
    pending: PendingPoint | null;
    setPending: React.Dispatch<React.SetStateAction<PendingPoint | null>>;
    selected: Set<number>;
    setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
}

export default function Stage({
                                  images,
                                  setImages,
                                  points,
                                  setPoints,
                                  mode,
                                  pending,
                                  setPending,
                                  selected,
                                  setSelected,
                              }: Props) {
    const [zoom, setZoom] = useState(DEFAULT_ZOOM);
    const [marquee, setMarquee] = useState<Rect | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;

    // mutable ref so mousemove handlers always see the latest selection
    // without re-binding listeners on every render
    const selectedRef = useRef(selected);
    selectedRef.current = selected;

    const clampZoom = (value: number) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

    // ---- zoom helpers (always zoom toward a screen point) ----
    function zoomTo(nextZoom: number, clientX?: number, clientY?: number) {
        const container = containerRef.current;
        if (!container) {
            setZoom(clampZoom(nextZoom));
            return;
        }

        const oldZoom = zoomRef.current;
        const z = clampZoom(nextZoom);
        if (z === oldZoom) return;

        const rect = container.getBoundingClientRect();
        // Default pivot = center of the visible viewport
        const pivotClientX = clientX ?? rect.left + rect.width / 2;
        const pivotClientY = clientY ?? rect.top + rect.height / 2;

        // Point under the cursor in stage (content) coordinates at old zoom
        const contentX = container.scrollLeft + (pivotClientX - rect.left);
        const contentY = container.scrollTop + (pivotClientY - rect.top);
        const worldX = contentX / oldZoom;
        const worldY = contentY / oldZoom;

        setZoom(z);

        // After React paints the new stage size, put the same world point
        // back under the cursor.
        requestAnimationFrame(() => {
            const c = containerRef.current;
            if (!c) return;
            c.scrollLeft = worldX * z - (pivotClientX - rect.left);
            c.scrollTop = worldY * z - (pivotClientY - rect.top);
        });
    }

    const zoomIn = () => zoomTo(zoomRef.current * 1.25);
    const zoomOut = () => zoomTo(zoomRef.current / 1.25);
    const zoomReset = () => zoomTo(DEFAULT_ZOOM);

    // ---- native wheel listener (passive: false so preventDefault works) ----
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            // Trackpad pinch sets ctrlKey on most browsers; also allow metaKey.
            // Plain wheel still scrolls the container normally.
            if (!e.ctrlKey && !e.metaKey) return;

            e.preventDefault();

            // Smooth, delta-mode-aware step
            let factor: number;
            if (e.deltaMode === 1) {
                // lines
                factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
            } else {
                // pixels (trackpad) — scale by magnitude, clamp
                const intensity = Math.min(0.2, Math.abs(e.deltaY) / 200);
                factor = e.deltaY < 0 ? 1 + intensity : 1 / (1 + intensity);
            }

            zoomTo(zoomRef.current * factor, e.clientX, e.clientY);
        };

        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    // ---- keyboard shortcuts: Cmd/Ctrl+G group, Cmd/Ctrl+Shift+G ungroup, Escape clear ----
    useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
            const meta = e.ctrlKey || e.metaKey;
            if (meta && e.key.toLowerCase() === "g") {
                e.preventDefault();
                if (selectedRef.current.size < 2 && !e.shiftKey) return;
                setImages((prev) =>
                    e.shiftKey
                        ? ungroupImages(prev, selectedRef.current)
                        : groupImages(prev, selectedRef.current)
                );
            } else if (e.key === "Escape") {
                setSelected(new Set());
            } else if (meta && (e.key === "=" || e.key === "+")) {
                e.preventDefault();
                zoomIn();
            } else if (meta && e.key === "-") {
                e.preventDefault();
                zoomOut();
            } else if (meta && e.key === "0") {
                e.preventDefault();
                zoomReset();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [setImages, setSelected]);

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

    // ---- click-and-drag on an image ----
    function onImageMouseDown(img: PlatImage, e: React.MouseEvent) {
        e.stopPropagation();
        if (mode !== "move") return;

        if (e.shiftKey) {
            setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(img.id)) next.delete(img.id);
                else next.add(img.id);
                return next;
            });
            return;
        }

        let effective: number[];
        if (img.groupId) {
            effective = groupMembers(images, img.id);
        } else if (selected.has(img.id) && selected.size > 1) {
            effective = [...selected];
        } else {
            effective = [img.id];
        }
        setSelected(new Set(effective));

        const startX = e.clientX;
        const startY = e.clientY;
        const startPositions = new Map<number, { x: number; y: number }>();
        images.forEach((item) => {
            if (effective.includes(item.id)) {
                startPositions.set(item.id, { x: item.x, y: item.y });
            }
        });

        function move(ev: MouseEvent) {
            const dx = (ev.clientX - startX) / zoomRef.current;
            const dy = (ev.clientY - startY) / zoomRef.current;
            setImages((prev) =>
                prev.map((item) => {
                    const start = startPositions.get(item.id);
                    if (!start) return item;
                    return { ...item, x: start.x + dx, y: start.y + dy };
                })
            );
        }
        function stop() {
            window.removeEventListener("mousemove", move);
        }
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", stop, { once: true });
    }

    // ---- marquee (rubber-band) select on empty canvas ----
    function onStageMouseDown(e: React.MouseEvent) {
        if (mode !== "move") return;
        if (e.target !== e.currentTarget) return;

        const stageRect = stageRef.current!.getBoundingClientRect();
        const startX = e.clientX - stageRect.left;
        const startY = e.clientY - stageRect.top;
        const shiftHeld = e.shiftKey;
        const baseSelection = shiftHeld ? new Set(selected) : new Set<number>();
        let dragged = false;

        setMarquee({ x0: startX, y0: startY, x1: startX, y1: startY });

        function move(ev: MouseEvent) {
            const curX = ev.clientX - stageRect.left;
            const curY = ev.clientY - stageRect.top;
            if (Math.abs(curX - startX) > 3 || Math.abs(curY - startY) > 3) {
                dragged = true;
            }
            const rect = {
                x0: Math.min(startX, curX),
                y0: Math.min(startY, curY),
                x1: Math.max(startX, curX),
                y1: Math.max(startY, curY),
            };
            setMarquee(rect);

            const hits = new Set(baseSelection);
            const z = zoomRef.current;
            images.forEach((img) => {
                const corners = [
                    [0, 0],
                    [img.natW, 0],
                    [0, img.natH],
                    [img.natW, img.natH],
                ].map(([x, y]) => localToWorld(img, x, y));
                const minX = Math.min(...corners.map((c) => c.x)) * z;
                const maxX = Math.max(...corners.map((c) => c.x)) * z;
                const minY = Math.min(...corners.map((c) => c.y)) * z;
                const maxY = Math.max(...corners.map((c) => c.y)) * z;
                const intersects =
                    minX <= rect.x1 &&
                    maxX >= rect.x0 &&
                    minY <= rect.y1 &&
                    maxY >= rect.y0;
                if (intersects) hits.add(img.id);
            });
            setSelected(hits);
        }
        function stop() {
            window.removeEventListener("mousemove", move);
            setMarquee(null);
            if (!dragged && !shiftHeld) setSelected(new Set());
        }
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", stop, { once: true });
    }

    const extent = images.reduce(
        (size, image) => {
            const corners = [
                [0, 0],
                [image.natW, 0],
                [0, image.natH],
                [image.natW, image.natH],
            ].map(([x, y]) => localToWorld(image, x, y));
            return {
                width: Math.max(
                    size.width,
                    ...corners.map((point) => point.x * zoom + 200)
                ),
                height: Math.max(
                    size.height,
                    ...corners.map((point) => point.y * zoom + 200)
                ),
            };
        },
        { width: 1200, height: 800 }
    );

    const selectedHasGroup = [...selected].some(
        (id) => images.find((img) => img.id === id)?.groupId
    );

    return (
        <div className="stage-container" ref={containerRef}>
            <div className="zoom-toolbar">
                <button
                    className="icon-button"
                    onClick={zoomOut}
                    aria-label="Zoom out"
                >
                    −
                </button>
                <button
                    className="zoom-readout"
                    onClick={zoomReset}
                    title="Reset zoom"
                >
                    {Math.round(zoom * 100)}%
                </button>
                <button
                    className="icon-button"
                    onClick={zoomIn}
                    aria-label="Zoom in"
                >
                    +
                </button>
            </div>

            {mode === "move" && selected.size > 0 && (
                <div className="selection-toolbar">
                    <span>{selected.size} selected</span>
                    {selected.size >= 2 && (
                        <button
                            onClick={() =>
                                setImages((prev) => groupImages(prev, selected))
                            }
                        >
                            🔗 Group{" "}
                            <kbd>
                                {navigator.platform.includes("Mac")
                                    ? "⌘G"
                                    : "Ctrl+G"}
                            </kbd>
                        </button>
                    )}
                    {selectedHasGroup && (
                        <button
                            onClick={() =>
                                setImages((prev) =>
                                    ungroupImages(prev, selected)
                                )
                            }
                        >
                            Ungroup
                        </button>
                    )}
                    <button onClick={() => setSelected(new Set())}>
                        Clear
                    </button>
                </div>
            )}

            <div
                className="stage"
                ref={stageRef}
                style={{ width: extent.width, height: extent.height }}
                onMouseDown={onStageMouseDown}
            >
                {images.length === 0 && (
                    <div className="stage-empty">
                        <strong>EMPTY PLAT</strong>
                        <span>
                            Add two or more overlapping images to begin.
                        </span>
                    </div>
                )}
                {images.map((img) => (
                    <StageImage
                        key={img.id}
                        image={img}
                        mode={mode}
                        onPoint={addControlPoint}
                        onMoveMouseDown={onImageMouseDown}
                        viewScale={zoom}
                        selected={selected.has(img.id)}
                    />
                ))}

                <ControlPointOverlay
                    points={points}
                    images={images}
                    viewScale={zoom}
                />
                {pending &&
                    (() => {
                        const image = images.find(
                            (item) => item.id === pending.imgId
                        );
                        if (!image) return null;
                        const point = localToWorld(
                            image,
                            pending.x,
                            pending.y
                        );
                        return (
                            <span
                                className="pending-point"
                                style={{
                                    left: point.x * zoom,
                                    top: point.y * zoom,
                                }}
                            />
                        );
                    })()}

                {marquee && (
                    <div
                        className="marquee-select"
                        style={{
                            left: marquee.x0,
                            top: marquee.y0,
                            width: marquee.x1 - marquee.x0,
                            height: marquee.y1 - marquee.y0,
                        }}
                    />
                )}
            </div>
        </div>
    );
}