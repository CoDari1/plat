import cv from "@techstark/opencv-js";

export async function inpaint(
    imageBuffer: Buffer,
    mask: Uint8Array,
    width: number,
    height: number
): Promise<Buffer> {
    // Wait for OpenCV to be ready
    await new Promise<void>((resolve) => {
        if (cv.Mat) resolve();
        else cv.onRuntimeInitialized = () => resolve();
    });

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
    const resultData = new Uint8Array(result.data);
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