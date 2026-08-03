// app/api/restore/process/route.ts
import { NextResponse } from "next/server";
import sharp from "sharp";
import { cleanupScan } from "@/lib/restoration/cleanup";
import { detectHorizontalCreases, createMask } from "@/lib/restoration/masks";
import { inpaint } from "@/lib/restoration/inpaint";

export const runtime = "nodejs";

export interface RestoreGuidance {
    inpaintCreases: boolean;
    inpaintStains: boolean;
    protectText: boolean;
    protectLines: boolean;
    notes?: string;
}

const DEFAULT_GUIDANCE: RestoreGuidance = {
    inpaintCreases: true,
    inpaintStains: false,
    protectText: true,
    protectLines: true,
};

function parseGuidance(raw: FormDataEntryValue | null): RestoreGuidance {
    if (typeof raw !== "string" || !raw.trim()) {
        return { ...DEFAULT_GUIDANCE };
    }
    try {
        const parsed = JSON.parse(raw) as Partial<RestoreGuidance>;
        return {
            inpaintCreases:
                typeof parsed.inpaintCreases === "boolean"
                    ? parsed.inpaintCreases
                    : DEFAULT_GUIDANCE.inpaintCreases,
            inpaintStains:
                typeof parsed.inpaintStains === "boolean"
                    ? parsed.inpaintStains
                    : DEFAULT_GUIDANCE.inpaintStains,
            protectText:
                typeof parsed.protectText === "boolean"
                    ? parsed.protectText
                    : DEFAULT_GUIDANCE.protectText,
            protectLines:
                typeof parsed.protectLines === "boolean"
                    ? parsed.protectLines
                    : DEFAULT_GUIDANCE.protectLines,
            notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
        };
    } catch {
        return { ...DEFAULT_GUIDANCE };
    }
}

function protectInkInMask(
    mask: ArrayLike<number>,
    gray: ArrayLike<number>,
    width: number,
    height: number,
    edgeThreshold = 28
): Uint8Array {
    const out = new Uint8Array(mask.length);
    for (let i = 0; i < mask.length; i++) out[i] = mask[i];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            if (out[i] === 0) continue;

            const gx = gray[i + 1] - gray[i - 1];
            const gy = gray[i + width] - gray[i - width];
            if (Math.abs(gx) + Math.abs(gy) >= edgeThreshold) {
                out[i] = 0;
            }
        }
    }
    return out;
}

export async function POST(request: Request) {
    try {
        const form = await request.formData();
        const image = form.get("image");

        if (!(image instanceof File)) {
            return NextResponse.json(
                { error: "Image required" },
                { status: 400 }
            );
        }

        const guidance = parseGuidance(form.get("guidance"));
        if (guidance.notes) {
            console.info("[restore/process] guidance notes:", guidance.notes);
        }

        const buffer = Buffer.from(await image.arrayBuffer());
        let restored: Buffer = await cleanupScan(buffer);

        let creasesRemoved = 0;
        let creasesDetected = 0;
        let maskPixels = 0;

        if (guidance.inpaintCreases) {
            const { data, info } = await sharp(restored)
                .greyscale()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const gray = new Uint8Array(data);
            const thickness =
                guidance.protectLines || guidance.protectText ? 12 : 16;

            const defects = detectHorizontalCreases(
                gray,
                info.width,
                info.height,
                { thickness }
            );
            creasesDetected = defects.length;

            if (defects.length > 0) {
                let mask = createMask(info.width, info.height, defects);

                if (guidance.protectLines || guidance.protectText) {
                    mask = protectInkInMask(
                        mask,
                        gray,
                        info.width,
                        info.height,
                        guidance.protectText ? 24 : 32
                    );
                }

                maskPixels = 0;
                for (let i = 0; i < mask.length; i++) {
                    if (mask[i] > 0) maskPixels++;
                }

                if (maskPixels > 0) {
                    restored = await inpaint(restored, mask, info.width, info.height);
                    creasesRemoved = defects.length;
                }
            }
        }

        const output = `data:image/png;base64,${restored.toString("base64")}`;

        return NextResponse.json({
            image: output,
            restored: true,
            guidance,
            creasesDetected,
            creasesRemoved,
            maskPixels,
            applied: {
                cleanup: true,
                creases: guidance.inpaintCreases && creasesRemoved > 0,
                stains: false,
                inkProtection: guidance.protectLines || guidance.protectText,
            },
        });
    } catch (error) {
        console.error("[restore/process]", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Restoration failed",
            },
            { status: 500 }
        );
    }
}