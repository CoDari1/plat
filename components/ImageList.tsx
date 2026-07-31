"use client";

import { PlatImage } from "@/types";

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

    if (images.length === 0) return <p className="empty-copy">No images loaded yet.</p>;

    return <div className="image-list">{images.map((image, index) => (
        <div className="image-row" key={image.id}>
            {/* User-selected data URL preview. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="thumbnail" src={image.src} alt="" />
            <span className="image-name" title={image.name}>{image.name}</span>
            <button className="icon-button" disabled={index === 0} onClick={() => reorder(index, -1)} aria-label={`Move ${image.name} up`}>↑</button>
            <button className="icon-button" disabled={index === images.length - 1} onClick={() => reorder(index, 1)} aria-label={`Move ${image.name} down`}>↓</button>
            <button className="icon-button danger" onClick={() => onRemove(image.id)} aria-label={`Remove ${image.name}`}>×</button>
        </div>
    ))}</div>;
}
