import { EditorMode } from "@/types";

export default function StatusBar({ images, points, mode, refine, busy }: {
    images: number;
    points: number;
    mode: EditorMode;
    refine: boolean;
    busy: boolean;
}) {
    return (
        <footer className="statusbar">
            <div><span className={`status-dot ${busy ? "busy" : ""}`} /> {busy ? "PROCESSING" : "READY"}</div>
            <div>{images} IMAGE{images === 1 ? "" : "S"} · {points} CONTROL POINT{points === 1 ? "" : "S"} · {mode.toUpperCase()} MODE · NORMALIZE + BLEND {refine ? "ON" : "OFF"} · AI OPTIONAL</div>
        </footer>
    );
}
