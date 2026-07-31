import sharp from "sharp";

export async function cleanupScan(buffer: Buffer) {
    return await sharp(buffer)
        .normalize()
        .median(1)
        .sharpen({
            sigma: 1,
            m1: 1,
            m2: 1,
        })
        .png()
        .toBuffer();
}