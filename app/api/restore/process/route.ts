import { NextResponse } from "next/server";
import sharp from "sharp";
import { cleanupScan } from "@/lib/restoration/cleanup";
import { detectHorizontalCreases, createMask } from "@/lib/restoration/masks";
import { inpaint } from "@/lib/restoration/inpaint";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const form = await request.formData();
        const image = form.get("image");

        if (!(image instanceof File)) {
            return NextResponse.json({ error: "Image required" }, { status: 400 });
        }

        const buffer = Buffer.from(await image.arrayBuffer());

        // 1. Light cleanup
        let restored = await cleanupScan(buffer);

        // 2. Detect creases
        const { data, info } = await sharp(restored)
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const gray = new Uint8Array(data);
        const defects = detectHorizontalCreases(gray, info.width, info.height, {
            thickness: 16,
        });

        if (defects.length > 0) {
            const mask = createMask(info.width, info.height, defects);
            restored = await inpaint(restored, mask, info.width, info.height);
        }

        const output = `data:image/png;base64,${restored.toString("base64")}`;

        return NextResponse.json({
            image: output,
            restored: true,
            creasesRemoved: defects.length,
        });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Restoration failed" }, { status: 500 });
    }
}