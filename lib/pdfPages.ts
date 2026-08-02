export interface ExtractedPage {
    name: string;
    dataUrl: string;
    width: number;
    height: number;
}

/**
 * Renders every page of a PDF to a PNG data URL at the given render scale
 * (2 ≈ 144dpi equivalent for a standard 72dpi PDF page — enough detail for
 * plat line work and text without producing enormous files).
 *
 * pdfjs-dist is loaded dynamically, client-side only: it touches DOMMatrix
 * and canvas globals at import time, which don't exist during Next.js's
 * server-side prerender pass.
 */
export async function extractPdfPages(file: File, renderScale = 2): Promise<ExtractedPage[]> {
    // The "legacy" build avoids very recent JS engine APIs the main build
    // now assumes are present (e.g. Map.prototype.getOrInsertComputed),
    // which aren't yet available in every real-world browser.
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url
    ).toString();

    const buffer = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
    const baseName = file.name.replace(/\.pdf$/i, "");
    const pages: ExtractedPage[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: renderScale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d")!;

        await page.render({ canvasContext: ctx, canvas, viewport }).promise;

        pages.push({
            name: doc.numPages > 1 ? `${baseName}_p${pageNum}` : baseName,
            dataUrl: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height,
        });
    }

    return pages;
}

export function isPdfFile(file: File): boolean {
    return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
