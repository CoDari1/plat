import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const RESTORE_PROMPT = `
Inspect this historical scan as a conservation specialist.

Identify:
- tears
- scratches
- dust
- missing pixels
- empty gaps
- exposure inconsistencies
- stitching artifacts

Return JSON only:

{
  "issues": [
    {
      "type": "",
      "location": "",
      "severity": "low|medium|high",
      "recommended_action": ""
    }
  ],
  "notes": ""
}

Rules:
- Preserve geometry
- Preserve typography
- Preserve faces and objects
- Do not invent missing details
- This is analysis only
`;

export async function POST(request: Request) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            { error: "Missing GEMINI_API_KEY" },
            { status: 503 }
        );
    }

    const form = await request.formData();
    const image = form.get("image");

    if (!(image instanceof File)) {
        return NextResponse.json(
            { error: "Image required" },
            { status: 400 }
        );
    }


    const buffer = Buffer.from(await image.arrayBuffer());

    const base64 = buffer.toString("base64");


    const genAI = new GoogleGenerativeAI(apiKey);

    const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
    });


    const result = await model.generateContent([
        RESTORE_PROMPT,
        {
            inlineData: {
                mimeType: image.type,
                data: base64,
            },
        },
    ]);


    const text = result.response.text();


    return NextResponse.json({
        analysis: text
    });
}