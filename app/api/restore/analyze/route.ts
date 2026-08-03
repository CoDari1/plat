import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM = `You are an expert at archival survey plats and cadastral maps.
You analyze a scanned/stitched plat image and classify visible elements.

PRESERVE (never erase or inpaint over):
- Inked property lines, curves, lot boundaries
- Text: titles, lot numbers, bearings, distances, notes
- North arrow, scale, legend, seals, signatures
- Any mark that carries legal or survey meaning

REMOVE / CLEAN (safe to inpaint or suppress):
- Fold creases, horizontal/vertical scan streaks
- Stains, foxing, dirt, tape residue
- Scanner edge noise, black borders, dust spots
- Background paper discoloration (tone only — do not touch ink)

Return ONLY valid JSON matching this schema:
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
}`;

export async function POST(request: Request) {
    try {
        const form = await request.formData();
        const image = form.get("image");
        if (!(image instanceof File)) {
            return NextResponse.json({ error: "Image required" }, { status: 400 });
        }

        const buffer = Buffer.from(await image.arrayBuffer());
        const base64 = buffer.toString("base64");
        const mime = image.type || "image/png";

        // Use a current Groq vision model from their docs
        const completion = await groq.chat.completions.create({
            model: "meta-llama/llama-4-scout-17b-16e-instruct", // or whatever vision model your console lists
            temperature: 0.1,
            max_tokens: 1200,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM },
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Classify preserve vs remove for this stitched survey plat. Be conservative: when unsure, PRESERVE.",
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mime};base64,${base64}`,
                            },
                        },
                    ],
                },
            ],
        });

        const raw = completion.choices[0]?.message?.content ?? "{}";
        const analysis = JSON.parse(raw);

        return NextResponse.json({ analysis });
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Analysis failed" },
            { status: 500 }
        );
    }
}