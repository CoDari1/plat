import { ControlPoint, PlatImage } from "@/types";

export default function RightPanel({ points, images, setPoints, onAutoDetect, onAlign, onExport, busy, refine, setRefine }: {
    points: ControlPoint[];
    images: PlatImage[];
    setPoints: React.Dispatch<React.SetStateAction<ControlPoint[]>>;
    onAutoDetect: () => void | Promise<void>;
    onAlign: () => void;
    onExport: () => void | Promise<void>;
    busy: boolean;
    refine: boolean;
    setRefine: React.Dispatch<React.SetStateAction<boolean>>;
}) {
    const name = (id: number) => images.find((image) => image.id === id)?.name ?? "Removed image";
    return (
        <aside className="right-panel">
            <div className="section-title first">Control points · {points.length}</div>
            <div className="point-list">
                {points.length === 0 && <p className="empty-copy">Add matching points manually or run auto detect.</p>}
                {points.map((point, index) => (
                    <div className="point-row" key={point.id}>
                        <span className={`point-swatch ${point.auto ? "auto" : ""}`} />
                        <div><strong>PAIR {String(index + 1).padStart(2, "0")}</strong><small title={`${name(point.aId)} ↔ ${name(point.bId)}`}>{name(point.aId)} ↔ {name(point.bId)}</small></div>
                        <button className="icon-button danger" onClick={() => setPoints((current) => current.filter((item) => item.id !== point.id))} aria-label="Delete control point">×</button>
                    </div>
                ))}
            </div>
            <div className="panel-actions">
                <button disabled={images.length < 2 || busy} onClick={onAutoDetect}>{busy ? "DETECTING…" : "RUN AUTO DETECT"}</button>
                <button disabled={points.length === 0 || busy} onClick={onAlign}>ALIGN IMAGES</button>
                <label className="refine-toggle">
                    <input type="checkbox" checked={refine} onChange={(event) => setRefine(event.target.checked)} />
                    <span><strong>AUTO REFINE</strong><small>Color normalization + multi-band seams</small></span>
                </label>
                <button className="primary" disabled={images.length === 0 || busy} onClick={onExport}>PREVIEW EXPORT</button>
            </div>
        </aside>
    );
}
