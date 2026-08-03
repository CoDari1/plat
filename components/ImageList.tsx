"use client";

import { PlatImage } from "@/types";

const RAD = Math.PI / 180;

export default function ImageList({
    images,
    setImages,
    onRemove,
    selected,
    setSelected,
}: {
    images: PlatImage[];
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>;
    onRemove: (id: number) => void;
    selected: Set<number>;
    setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
    function reorder(index: number, offset: number) {
        const target = index + offset;
        if (target < 0 || target >= images.length) return;
        const copy = [...images];
        [copy[index], copy[target]] = [copy[target], copy[index]];
        setImages(copy);
    }

    function nudgeRotation(id: number, deltaDeg: number) {
        setImages((current) =>
            current.map((img) =>
                img.id === id ? { ...img, rot: img.rot + deltaDeg * RAD } : img
            )
        );
    }

    function setRotationDeg(id: number, deg: number) {
        if (Number.isNaN(deg)) return;
        setImages((current) =>
            current.map((img) =>
                img.id === id ? { ...img, rot: deg * RAD } : img
            )
        );
    }

    function toggleSelect(id: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    if (images.length === 0) {
        return <p className="empty-copy">No images loaded yet.</p>;
    }

    return (
        <div className="image-list">
            <p className="hint" style={{ marginBottom: 8 }}>
                Click a thumbnail to select · shift-click to add · drag-select on canvas ·
                <kbd>{typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? " ⌘G" : " Ctrl+G"}</kbd> to group
            </p>

            {images.map((image, index) => {
                const isSelected = selected.has(image.id);
                const isGrouped = image.groupId != null;

                return (
                    <div
                        className={`image-row ${isSelected ? "selected" : ""} ${
                            isGrouped ? "grouped" : ""
                        }`}
                        key={image.id}
                    >
                        <div className="image-row-main">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="thumbnail"
                                src={image.src}
                                alt=""
                                onClick={(e) => (e.shiftKey ? toggleSelect(image.id) : setSelected(new Set([image.id])))}
                                style={{ cursor: "pointer" }}
                            />
                            <span
                                className="image-name"
                                title={image.name}
                                onClick={(e) => (e.shiftKey ? toggleSelect(image.id) : setSelected(new Set([image.id])))}
                                style={{ cursor: "pointer" }}
                            >
                                {image.name}
                                {isGrouped && " 🔗"}
                            </span>

                            <button
                                className="icon-button"
                                disabled={index === 0}
                                onClick={() => reorder(index, -1)}
                            >
                                ↑
                            </button>
                            <button
                                className="icon-button"
                                disabled={index === images.length - 1}
                                onClick={() => reorder(index, 1)}
                            >
                                ↓
                            </button>
                            <button
                                className="icon-button danger"
                                onClick={() => onRemove(image.id)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="image-row-rotate">
                            <button className="icon-button" onClick={() => nudgeRotation(image.id, -1)}>
                                ↺
                            </button>
                            <button className="icon-button" onClick={() => nudgeRotation(image.id, -0.1)}>
                                ‹
                            </button>
                            <input
                                type="number"
                                className="rotate-input"
                                step={0.1}
                                value={Math.round((image.rot / RAD) * 100) / 100}
                                onChange={(e) =>
                                    setRotationDeg(image.id, parseFloat(e.target.value))
                                }
                            />
                            <button className="icon-button" onClick={() => nudgeRotation(image.id, 0.1)}>
                                ›
                            </button>
                            <button className="icon-button" onClick={() => nudgeRotation(image.id, 1)}>
                                ↻
                            </button>
                            <button className="icon-button" onClick={() => setRotationDeg(image.id, 0)}>
                                0°
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
