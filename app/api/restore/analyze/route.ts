import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const SYSTEM = `You are an expert at archival survey plats and cadastral maps.
Classify visible elements in the image.

PRESERVE (never erase):
- Property lines, curves, lot boundaries
- Text: titles, lot numbers, bearings, distances, notes
- North arrow, scale, legend, seals, signatures
- Any mark with legal or survey meaning

REMOVE / CLEAN (safe to inpaint):
- Fold creases, scan streaks
- Stains, foxing, dirt, tape residue
- Scanner edge noise, dust
- Background discoloration only (do not touch ink)

Return ONLY valid JSON:
{
  "summary": "one sentence",
  "preserve": [{ "label": string, "reason": string }],
  "remove": [{ "label": string, "reason": string, "severity": "low"|"medium"|"high" }],
  "guidance": {
    "inpaintCreases": boolean,
    "inpaintStains": boolean,
    "protectText": boolean,
    "protectLines": boolean,
    "notes": string
  }
}
When unsure, PRESERVE. Be conservative.`;

export async function POST(request: Request) {
    try {
        const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY
            ?? process.env.GEMINI_API_KEY;
        if (!key) {
            return NextResponse.json(
                { error: "Missing GOOGLE_GENERATIVE_AI_API_KEY" },
                { status: 500 }
            );
        }

        const form = await request.formData();
        const image = form.get("image");
        if (!(image instanceof File)) {
            return NextResponse.json({ error: "Image required" }, { status: 400 });
        }

        const buffer = Buffer.from(await image.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mime = image.type || "image/png";

        const genAI = new GoogleGenerativeAI(key);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash", // or gemini-1.5-flash / gemini-2.5-flash
            generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
            },
        });

        const result = await model.generateContent([
            { text: SYSTEM },
            {
                inlineData: {
                    mimeType: mime,
                    data: base64,
                },
            },
            {
                text: "Classify preserve vs remove for this stitched survey plat. JSON only.",
            },
        ]);

        const raw = result.response.text();
        const analysis = JSON.parse(raw);

        return NextResponse.json({ analysis });
    } catch (err) {
        console.error("[restore/analyze]", err);
        return NextResponse.json(
            {
                error:
                    err instanceof Error ? err.message : "Analysis failed",
            },
            { status: 500 }
        );
    }
}