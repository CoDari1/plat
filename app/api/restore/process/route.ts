import { NextResponse } from "next/server";
import { cleanupScan } from "@/lib/restoration/cleanup";

export const runtime = "nodejs";

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

        const buffer = Buffer.from(
            await image.arrayBuffer()
        );

        const restored = await cleanupScan(buffer);

        const output =
            `data:image/png;base64,${restored.toString("base64")}`;

        return NextResponse.json({
            image: output,
            restored: true,
        });

    } catch (error) {
        console.error(error);

        return NextResponse.json(
            {
                error: "Restoration failed",
            },
            {
                status: 500,
            }
        );
    }
}
