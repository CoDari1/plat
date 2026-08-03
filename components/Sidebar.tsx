"use client";

import { useState } from "react";
import ImageList from "@/components/ImageList";
import { useImageLoader } from "@/hooks/useImages";
import { arrangePlatGrid } from "@/lib/layout";
import { EditorMode, PlatImage } from "@/types";

export default function Sidebar({ images, setImages, mode, setMode, onRemove, onAutoCorrect, busy, selected, setSelected }: {
    images: PlatImage[];
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>;
    mode: EditorMode;
    setMode: React.Dispatch<React.SetStateAction<EditorMode>>;
    onRemove: (id: number) => void;
    onAutoCorrect: () => void | Promise<void>;
    busy: boolean;
    selected: Set<number>;
    setSelected: React.Dispatch<React.SetStateAction<Set<number>>>;
}) {
    const loadFiles = useImageLoader(setImages);
    const [uploading, setUploading] = useState(false);

    async function handleFiles(files: FileList) {
        setUploading(true);
        try {
            await loadFiles(files);
        } finally {
            setUploading(false);
        }
    }

    return (
        <aside className="sidebar">
            <label className={`file-button ${uploading ? "busy" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                event.preventDefault();
                if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
            }}>
                <span>{uploading ? "PROCESSING…" : "＋ DROP PLATS HERE / CLICK TO UPLOAD"}</span>
                <small>{uploading ? "Rasterizing pages — large PDFs can take a while" : "JPG · PNG · PDF (each page becomes a plate) · browser-supported images"}</small>
                <input type="file" multiple accept="image/*,application/pdf,.pdf" disabled={uploading} onChange={(event) => {
                    if (event.target.files) void handleFiles(event.target.files);
                    event.target.value = "";
                }} />
            </label>

            <div className="section-title">Interaction mode</div>
            <div className="button-row">
                <button className={mode === "move" ? "primary" : ""} onClick={() => setMode("move")}>MOVE</button>
                <button className={mode === "point" ? "primary" : ""} onClick={() => setMode("point")}>ADD POINTS</button>
            </div>
            <p className="hint">{mode === "move" ? "Drag plates to position them." : "Click matching locations on two different plates."}</p>

            <div className="section-title">Images · {images.length}</div>
            <ImageList images={images} setImages={setImages} onRemove={onRemove} selected={selected} setSelected={setSelected} />
            {images.length > 0 && (
                <button className="wide" disabled={busy} onClick={onAutoCorrect}>
                    {busy ? "CORRECTING…" : "AUTO-CORRECT (straighten + background)"}
                </button>
            )}
            <p className="hint">Snaps each scan to true 0/90°, normalizes background to white. Run this before placing control points — it clears any existing ones.</p>
            {images.length > 1 && <button className="wide" onClick={() => setImages((current) => arrangePlatGrid(current))}>RESET TO 3-COLUMN GRID</button>}
        </aside>
    );
}
