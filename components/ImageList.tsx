"use client";

import { PlatImage } from "@/types";

const RAD = Math.PI / 180;

export default function ImageList({ images, setImages, onRemove }: {
    images: PlatImage[];
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>;
    onRemove: (id: number) => void;
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
            current.map((img) => (img.id === id ? { ...img, rot: img.rot + deltaDeg * RAD } : img))
        );
    }

    function setRotationDeg(id: number, deg: number) {
        if (Number.isNaN(deg)) return;
        setImages((current) =>
            current.map((img) => (img.id === id ? { ...img, rot: deg * RAD } : img))
        );
    }

    function lockTogether(ids: number[]) {
        if (ids.length < 2) return;

        setImages(prev => {
            const newGroupId = Date.now();
            return prev.map(img =>
                ids.includes(img.id) ? { ...img, groupId: newGroupId } : img
            );
        });
    }

    function unlock(id: number) {
        setImages(prev =>
            prev.map(img =>
                img.id === id ? { ...img, groupId: null } : img
            )
        );
    }

    if (images.length === 0) return <p className="empty-copy">No images loaded yet.</p>;

    return <div className="image-list">{images.map((image, index) => (
        <div className="image-row" key={image.id}>
            <div className="image-row-main">
                {/* User-selected data URL preview. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="thumbnail" src={image.src} alt="" />
                <span className="image-name" title={image.name}>{image.name}</span>
                <button className="icon-button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${image.name} up`}>↑</button>
                <button className="icon-button" disabled={index === images.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${image.name} down`}>↓</button>
                <button className="icon-button danger" onClick={() => onRemove(image.id)} aria-label={`Remove ${image.name}`}>×</button>
            </div>
            <div className="image-row-rotate">
                <button className="icon-button" onClick={() => nudgeRotation(image.id, -1)} title="Rotate −1°" aria-label={`Rotate ${image.name} counter-clockwise 1 degree`}>↺</button>
                <button className="icon-button" onClick={() => nudgeRotation(image.id, -0.1)} title="Rotate −0.1°" aria-label={`Rotate ${image.name} counter-clockwise 0.1 degree`}>‹</button>
                <input
                    type="number"
                    className="rotate-input"
                    step={0.1}
                    value={Math.round((image.rot / RAD) * 100) / 100}
                    onChange={(event) => setRotationDeg(image.id, parseFloat(event.target.value))}
                    aria-label={`${image.name} rotation in degrees`}
                />
                <button className="icon-button" onClick={() => nudgeRotation(image.id, 0.1)} title="Rotate +0.1°" aria-label={`Rotate ${image.name} clockwise 0.1 degree`}>›</button>
                <button className="icon-button" onClick={() => nudgeRotation(image.id, 1)} title="Rotate +1°" aria-label={`Rotate ${image.name} clockwise 1 degree`}>↻</button>
                <button className="icon-button" onClick={() => setRotationDeg(image.id, 0)} title="Reset rotation to 0°">0°</button>
                <button
                    className="icon-button"
                    title={image.groupId ? "Unlock from group" : "Lock with selected"}
                    onClick={() => toggleLock(image.id)}
                >
                    {image.groupId ? "🔓" : "🔒"}
                </button>
            </div>
        </div>
    ))}</div>;
}
