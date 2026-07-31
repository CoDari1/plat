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

    const pairCounts = new Map<string, number>();
    points.forEach((point) => {
        const key = [point.aId, point.bId].sort((a, b) => a - b).join(":");
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    });
    const thinPairs = [...pairCounts.entries()]
        .filter(([, count]) => count === 1)
        .map(([key]) => {
            const [aId, bId] = key.split(":").map(Number);
            return `${name(aId)} ↔ ${name(bId)}`;
        });

    return (
        <aside className="right-panel">
            <div className="section-title first">Control points · {points.length}</div>
            {thinPairs.length > 0 && (
                <p className="warning-copy">
                    ⚠ Only 1 point between {thinPairs.join("; ")} — rotation can&apos;t be solved from a single point.
                    Add at least one more point on {thinPairs.length === 1 ? "that pair" : "each of those pairs"}, away from the first, before aligning.
                </p>
            )}
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
                    <span><strong>AUTO REFINE</strong><small>Color-matches &amp; blends seams — alters overlap pixels. Leave off for exact reproduction (surveys, legal docs); last image drawn wins the seam instead.</small></span>
                </label>
                <button className="primary" disabled={images.length === 0 || busy} onClick={onExport}>PREVIEW EXPORT</button>
            </div>
        </aside>
    );
}
