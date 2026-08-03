"use client";

import { useState } from "react";
import {
    ControlPoint,
    EditorMode,
    PendingPoint,
    PlatImage,
    Point,
} from "@/types";

import TopBar from "@/components/TopBar";
import Sidebar from "@/components/Sidebar";
import Stage from "@/components/Stage";
import RightPanel from "@/components/RightPanel";
import StatusBar from "@/components/StatusBar";
import PreviewModal from "@/components/PreviewModal";

import { autoDetect } from "@/lib/autoDetect";
import { autoCorrectSource, clearGrayCache } from "@/lib/autoCorrect";
import { buildComposite, localToWorld } from "@/lib/transforms";
import { encodeTIFF } from "@/lib/tiffEncoder";
import { fitSimilarity } from "@/lib/stitching";


export default function Home() {
    const [images, setImages] = useState<PlatImage[]>([]);
    const [points, setPoints] = useState<ControlPoint[]>([]);
    const [mode, setMode] = useState<EditorMode>("move");
    const [pending, setPending] = useState<PendingPoint | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const [previewCanvas, setPreviewCanvas] =
        useState<HTMLCanvasElement | null>(null);

    const [aiCanvas, setAiCanvas] =
        useState<HTMLCanvasElement | null>(null);

    const [aiAnalysis, setAiAnalysis] =
        useState<string | null>(null);

    const [aiBusy, setAiBusy] =
        useState(false);

    const [busy, setBusy] =
        useState(false);

    const [refine, setRefine] =
        useState(false);

    const [message, setMessage] =
        useState<string | null>(null);


    async function handleAutoDetect() {
        setBusy(true);
        setMessage(null);

        try {
            const detected = await autoDetect(images);

            setPoints((prev) => [
                ...prev.filter((point) => !point.auto),
                ...detected,
            ]);

            setMessage(
                detected.length
                    ? `Found ${detected.length} candidate matches.`
                    : "No reliable matches found. Try manual points."
            );

        } catch {
            setMessage("Auto detection failed for one or more images.");

        } finally {
            setBusy(false);
        }
    }


    function handleAlign() {
        setImages((prev) => {

            if (prev.length === 0) {
                return prev;
            }


            const aligned = prev.map((image) => ({
                ...image,
                scale: 1,
            }));

            const known = new Set([aligned[0].id]);
            const rotationUncorrected: string[] = [];


            for (let round = 0; round < aligned.length; round++) {

                let progressed = false;


                for (const img of aligned) {

                    if (known.has(img.id)) {
                        continue;
                    }


                    const localPoints: Point[] = [];
                    const worldPoints: Point[] = [];


                    points.forEach((point) => {

                        if (
                            point.aId === img.id &&
                            known.has(point.bId)
                        ) {

                            const other = aligned.find(
                                (candidate) =>
                                    candidate.id === point.bId
                            );

                            if (!other) return;


                            localPoints.push({
                                x: point.ax,
                                y: point.ay,
                            });

                            worldPoints.push(
                                localToWorld(
                                    other,
                                    point.bx,
                                    point.by
                                )
                            );
                        }


                        if (
                            point.bId === img.id &&
                            known.has(point.aId)
                        ) {

                            const other = aligned.find(
                                (candidate) =>
                                    candidate.id === point.aId
                            );

                            if (!other) return;


                            localPoints.push({
                                x: point.bx,
                                y: point.by,
                            });

                            worldPoints.push(
                                localToWorld(
                                    other,
                                    point.ax,
                                    point.ay
                                )
                            );
                        }

                    });


                    if (localPoints.length === 0) {
                        continue;
                    }

                    if (localPoints.length === 1) {
                        rotationUncorrected.push(img.name);
                    }


                    const transform =
                        localPoints.length === 1
                            ? {
                                scale: 1,
                                rot: img.rot,
                                tx:
                                    worldPoints[0].x -
                                    (
                                        Math.cos(img.rot) *
                                        localPoints[0].x -
                                        Math.sin(img.rot) *
                                        localPoints[0].y
                                    ),

                                ty:
                                    worldPoints[0].y -
                                    (
                                        Math.sin(img.rot) *
                                        localPoints[0].x +
                                        Math.cos(img.rot) *
                                        localPoints[0].y
                                    ),
                            }
                            :
                            fitSimilarity(
                                localPoints,
                                worldPoints,
                                "rigid"
                            );


                    img.x = transform.tx;
                    img.y = transform.ty;
                    img.rot = transform.rot;
                    img.scale = 1;


                    known.add(img.id);
                    progressed = true;
                }


                if (!progressed) {
                    break;
                }
            }


            const base =
                known.size === aligned.length
                    ? `Aligned all ${aligned.length} plates.`
                    : `Aligned ${known.size}/${aligned.length} plates.`;

            const warning =
                rotationUncorrected.length > 0
                    ? ` ⚠ ${rotationUncorrected.join(", ")} used only 1 control point — rotation NOT corrected, only positioned. Add a 2nd point (away from the 1st) on ${rotationUncorrected.length === 1 ? "that image" : "each of those images"} and re-align for an exact fit.`
                    : "";

            setMessage(base + warning);


            return aligned;
        });
    }


    async function handleExportPreview() {

        setBusy(true);
        setMessage(null);


        try {

            const canvas = await buildComposite(
                images,
                refine
            );


            setPreviewCanvas(canvas);
            setAiCanvas(null);
            setAiAnalysis(null);


        } catch {

            setMessage(
                "Could not render export preview."
            );

        } finally {

            setBusy(false);

        }
    }



    async function handleRestore() {

        if (!previewCanvas) return;


        setAiBusy(true);
        setMessage(null);


        try {

            const blob = await new Promise<Blob>(
                (resolve, reject) =>
                    previewCanvas.toBlob(
                        (value) =>
                            value
                                ? resolve(value)
                                : reject(
                                    new Error(
                                        "Could not encode preview."
                                    )
                                ),
                        "image/png"
                    )
            );


            const form = new FormData();

            form.set(
                "image",
                blob,
                "stitched-preview.png"
            );


            const response = await fetch(
                "/api/restore/process",
                {
                    method: "POST",
                    body: form,
                }
            );


            const payload = await response.json() as {
                image?: string;
                error?: string;
            };


            if (!response.ok || !payload.image) {
                throw new Error(
                    payload.error ??
                    "Restoration failed."
                );
            }


            const restored = new Image();


            await new Promise<void>(
                (resolve, reject) => {

                    restored.onload = () =>
                        resolve();

                    restored.onerror = () =>
                        reject(
                            new Error(
                                "Could not load restored image."
                            )
                        );

                    restored.src =
                        payload.image!;
                }
            );


            const canvas =
                document.createElement("canvas");


            canvas.width =
                restored.naturalWidth;

            canvas.height =
                restored.naturalHeight;


            canvas
                .getContext("2d")
                ?.drawImage(
                    restored,
                    0,
                    0
                );


            setAiCanvas(canvas);


            setMessage(
                "Restoration preview generated."
            );


        } catch (error) {

            setMessage(
                error instanceof Error
                    ? error.message
                    : "Restoration failed."
            );

        } finally {

            setAiBusy(false);

        }
    }



    function handleClosePreview() {

        setPreviewCanvas(null);
        setAiCanvas(null);
        setAiAnalysis(null);

    }



    function handleExportTIFF(
        source = previewCanvas
    ) {

        if (!source) return;


        const buffer =
            encodeTIFF(
                source,
                300
            );


        const blob =
            new Blob(
                [buffer],
                {
                    type: "image/tiff",
                }
            );


        const url =
            URL.createObjectURL(blob);


        const link =
            document.createElement("a");


        link.href = url;

        link.download =
            source === aiCanvas
                ? "restored-preview.tiff"
                : "stitch-archival.tiff";


        link.click();


        setTimeout(
            () =>
                URL.revokeObjectURL(url),
            1000
        );
    }



    async function handleAutoCorrect() {
        setBusy(true);
        setMessage(null);
        try {
            const corrected = await Promise.all(
                images.map(async (image) => {
                    const result = await autoCorrectSource(image.src, { r: 255, g: 255, b: 255 });
                    clearGrayCache(image.id);
                    return {
                        ...image,
                        src: result.src,
                        natW: result.width,
                        natH: result.height,
                        rot: 0, // baked into the pixels now
                    };
                })
            );
            setImages(corrected);
            // Local pixel coordinates on every image just shifted (rotation +
            // canvas expansion), so any existing control points are stale.
            setPoints([]);
            setPending(null);
            setMessage(
                `Auto-corrected ${corrected.length} image(s) — straightened to true 0/90° and background normalized to white. Control points were cleared since coordinates shifted; re-add or re-run auto detect.`
            );
        } catch (error) {
            console.error(error);
            setMessage(error instanceof Error ? error.message : "Auto-correct failed.");
        } finally {
            setBusy(false);
        }
    }

    function handleRemoveImage(id: number) {

        setImages((current) =>
            current.filter(
                (image) =>
                    image.id !== id
            )
        );


        setPoints((current) =>
            current.filter(
                (point) =>
                    point.aId !== id &&
                    point.bId !== id
            )
        );


        setPending((current) =>
            current?.imgId === id
                ? null
                : current
        );

        setSelected((current) => {
            if (!current.has(id)) return current;
            const next = new Set(current);
            next.delete(id);
            return next;
        });
    }



    return (
        <main className="plat-app">

            <TopBar />


            <div className="workspace">

                <Sidebar
                    images={images}
                    setImages={setImages}
                    mode={mode}
                    setMode={setMode}
                    onRemove={handleRemoveImage}
                    onAutoCorrect={handleAutoCorrect}
                    busy={busy}
                    selected={selected}
                    setSelected={setSelected}
                />


                <Stage
                    images={images}
                    setImages={setImages}
                    points={points}
                    setPoints={setPoints}
                    mode={mode}
                    pending={pending}
                    setPending={setPending}
                    selected={selected}
                    setSelected={setSelected}
                />


                <RightPanel
                    points={points}
                    setPoints={setPoints}
                    onAutoDetect={handleAutoDetect}
                    onAlign={handleAlign}
                    onExport={handleExportPreview}
                    images={images}
                    busy={busy}
                    refine={refine}
                    setRefine={setRefine}
                />

            </div>


            {message && (
                <button
                    className="toast"
                    onClick={() => setMessage(null)}
                >
                    {message}
                    <span>×</span>
                </button>
            )}


            <StatusBar
                images={images.length}
                points={points.length}
                mode={mode}
                refine={refine}
                busy={busy}
            />


            <PreviewModal
                canvas={previewCanvas}
                aiCanvas={aiCanvas}
                close={handleClosePreview}
                exportTIFF={handleExportTIFF}
                restoreWithAI={handleRestore}
                aiBusy={aiBusy}
                aiAnalysis={aiAnalysis}
            />

        </main>
    );
}