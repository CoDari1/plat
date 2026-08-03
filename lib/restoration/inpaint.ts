import cv from "@techstark/opencv-js";

// cv.onRuntimeInitialized is a single global callback slot. If two requests
// call inpaint() concurrently, the second assignment overwrites the first's
// callback and the first request's promise never resolves — it hangs
// forever. Caching one shared ready-promise means every concurrent caller
// awaits the same promise instead of racing to set the callback.
let cvReady: Promise<void> | null = null;

function waitForCv(): Promise<void> {
    if (!cvReady) {
        cvReady = new Promise<void>((resolve) => {
            if (cv.Mat) resolve();
            else cv.onRuntimeInitialized = () => resolve();
        });
    }
    return cvReady;
}

export async function inpaint(
    imageBuffer: Buffer,
    mask: Uint8Array,
    width: number,
    height: number
): Promise<Buffer> {
    await waitForCv();

    // Decode image with Sharp first (or you can use cv.imdecode)
    const sharp = (await import("sharp")).default;
    const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const src = cv.matFromArray(info.height, info.width, cv.CV_8UC4, data);
    const maskMat = cv.matFromArray(height, width, cv.CV_8UC1, mask);

    const result = new cv.Mat();
    cv.inpaint(src, maskMat, result, 4, cv.INPAINT_TELEA);

    // Convert back to PNG buffer
    const resultData = Uint8Array.from(result.data);
    const outBuffer = await sharp(resultData, {
        raw: {
            width: result.cols,
            height: result.rows,
            channels: 4,
        },
    })
        .png()
        .toBuffer();

    src.delete();
    maskMat.delete();
    result.delete();

    return outBuffer;
}
