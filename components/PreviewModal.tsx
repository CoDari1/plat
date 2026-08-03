"use client";

import { useEffect, useRef } from "react";

export default function PreviewModal({ canvas, aiCanvas, aiAnalysis, close, exportTIFF, restoreWithAI, aiBusy }: {
    canvas: HTMLCanvasElement | null;
    aiCanvas: HTMLCanvasElement | null;
    aiAnalysis: string | null;
    close: () => void;
    exportTIFF: (source?: HTMLCanvasElement) => void;
    restoreWithAI: () => void | Promise<void>;
    aiBusy: boolean;
}) {
    const preview = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const shown = aiCanvas ?? canvas;
        if (!shown || !preview.current) return;
        preview.current.width = shown.width;
        preview.current.height = shown.height;
        preview.current.getContext("2d")?.drawImage(shown, 0, 0);
    }, [canvas, aiCanvas]);
    useEffect(() => {
        if (!canvas) return;
        const escape = (event: KeyboardEvent) => event.key === "Escape" && close();
        window.addEventListener("keydown", escape);
        return () => window.removeEventListener("keydown", escape);
    }, [canvas, close]);
    if (!canvas) return null;
    return <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Export preview" onMouseDown={(event) => event.target === event.currentTarget && close()}>
        <div className="modal">
            <div className="modal-header"><div><strong>{aiCanvas ? "GROQ REVIEW · CONSERVATION" : "ARCHIVAL STITCH PREVIEW"}</strong><small>{(aiCanvas ?? canvas).width} × {(aiCanvas ?? canvas).height} px · {aiCanvas ? "original composite reviewed by Groq vision" : "source-faithful refined composite"}</small></div><button className="icon-button" onClick={close} aria-label="Close preview">×</button></div>
            <div className="preview-scroll"><canvas ref={preview} />{aiAnalysis && <section className="ai-analysis"><strong>GROQ CONSERVATION NOTES</strong><p>{aiAnalysis}</p></section>}</div>
            <div className="modal-footer">
                <button onClick={close}>BACK TO EDITOR</button>
                <button disabled={aiBusy} onClick={restoreWithAI}>{aiBusy ? "GROQ ANALYZING…" : aiCanvas ? "RUN GROQ REVIEW AGAIN" : "GROQ CONSERVATION REVIEW"}</button>
                {aiCanvas && <button onClick={() => exportTIFF(aiCanvas)}>DOWNLOAD REVIEWED TIFF</button>}
                <button className="primary" onClick={() => exportTIFF(canvas)}>DOWNLOAD ARCHIVAL TIFF</button>
            </div>
        </div>
    </div>;
}

