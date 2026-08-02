"use client";

import { useState } from "react";
import { PlatImage } from "@/types";

const RAD = Math.PI / 180;

export default function ImageList({
                                      images,
                                      setImages,
                                      onRemove,
                                  }: {
    images: PlatImage[];
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>;
    onRemove: (id: number) => void;
}) {
    const [selected, setSelected] = useState<Set<number>>(new Set());

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

    function lockSelected() {
        if (selected.size < 2) return;
        const newGroupId = Date.now();
        setImages((prev) =>
            prev.map((img) =>
                selected.has(img.id) ? { ...img, groupId: newGroupId } : img
            )
        );
        setSelected(new Set());
    }

    function unlock(id: number) {
        setImages((prev) =>
            prev.map((img) =>
                img.id === id ? { ...img, groupId: null } : img
            )
        );
    }

    function unlockAll() {
        setImages((prev) =>
            prev.map((img) => ({ ...img, groupId: null }))
        );
        setSelected(new Set());
    }

    const hasAnyLocked = images.some((img) => img.groupId != null);

    if (images.length === 0) {
        return <p className="empty-copy">No images loaded yet.</p>;
    }

    return (
        <div className="image-list">
            {/* Action bar */}
            <div className="button-row" style={{ marginBottom: 8, gap: 6 }}>
                {selected.size >= 2 && (
                    <button className="wide primary" onClick={lockSelected}>
                        🔒 Lock {selected.size} selected
                    </button>
                )}
                {hasAnyLocked && (
                    <button className="wide" onClick={unlockAll}>
                        🔓 Unlock all
                    </button>
                )}
            </div>

            {images.map((image, index) => {
                const isSelected = selected.has(image.id);
                const isLocked = image.groupId != null;

                return (
                    <div
                        className={`image-row ${isSelected ? "selected" : ""} ${
                            isLocked ? "grouped" : ""
                        }`}
                        key={image.id}
                    >
                        <div className="image-row-main">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                className="thumbnail"
                                src={image.src}
                                alt=""
                                onClick={() => toggleSelect(image.id)}
                                style={{ cursor: "pointer" }}
                            />
                            <span
                                className="image-name"
                                title={image.name}
                                onClick={() => toggleSelect(image.id)}
                                style={{ cursor: "pointer" }}
                            >
                {image.name}
                                {isLocked && " 🔗"}
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

                            {/* Lock / Unlock single */}
                            <button
                                className="icon-button"
                                title={isLocked ? "Unlock this image" : "Select for locking"}
                                onClick={() => {
                                    if (isLocked) unlock(image.id);
                                    else toggleSelect(image.id);
                                }}
                            >
                                {isLocked ? "🔓" : "🔒"}
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
