import { NextRequest, NextResponse } from "next/server";
import { GROQ_TTS_VOICE } from "@/lib/config";

// Split text into chunks <= 200 characters, trying to split at sentence boundaries.
function chunkText(text: string, maxLen = 200): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= maxLen) {
      currentChunk += sentence;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      // If a single sentence is still > maxLen, just force split it
      if (sentence.length > maxLen) {
        let remaining = sentence;
        while (remaining.length > 0) {
          chunks.push(remaining.slice(0, maxLen).trim());
          remaining = remaining.slice(maxLen);
        }
        currentChunk = "";
      } else {
        currentChunk = sentence;
      }
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    // Groq TTS limit is 200 chars per request.
    const chunks = chunkText(text, 200);
    const audioBuffers: ArrayBuffer[] = [];

    // Process chunks sequentially to keep ordering straightforward and avoid rate limits.
    for (const chunk of chunks) {
      const res = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "canopylabs/orpheus-v1-english",
          voice: GROQ_TTS_VOICE,
          input: chunk,
          response_format: "wav",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `Groq TTS error: ${errText}` },
          { status: res.status }
        );
      }

       if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS ${res.status} — ${body}`);
  }

      const buffer = await res.arrayBuffer();
      audioBuffers.push(buffer);
    }

    // Concatenate WAV buffers
    // A standard WAV file has a 44-byte header. We can take the header from the first buffer,
    // and then append just the data portion (offset 44) from all subsequent buffers.
    // Finally, we update the data chunk size (offset 40) and overall file size (offset 4) in the new header.
    
    if (audioBuffers.length === 0) {
      return NextResponse.json({ error: "No audio generated" }, { status: 500 });
    }

    if (audioBuffers.length === 1) {
      return new NextResponse(audioBuffers[0], {
        headers: { "Content-Type": "audio/wav" },
      });
    }

    const firstBuffer = audioBuffers[0];
    const header = new Uint8Array(firstBuffer.slice(0, 44));
    const dataSizeOffset = 40;
    const fileSizeOffset = 4;

    let totalDataSize = 0;
    const dataChunks: Uint8Array[] = [];

    for (let i = 0; i < audioBuffers.length; i++) {
      const buf = audioBuffers[i];
      // Skip the 44-byte header for all, assuming standard format from Groq.
      // (If it's exactly 44 bytes, this works perfectly. Usually PCM WAV headers are 44 bytes).
      const data = new Uint8Array(buf, 44);
      totalDataSize += data.length;
      dataChunks.push(data);
    }

    // Update sizes in header
    const dataView = new DataView(header.buffer);
    dataView.setUint32(dataSizeOffset, totalDataSize, true); // Little endian
    dataView.setUint32(fileSizeOffset, totalDataSize + 36, true);

    // Create final buffer
    const finalBuffer = new Uint8Array(44 + totalDataSize);
    finalBuffer.set(header, 0);
    let offset = 44;
    for (const data of dataChunks) {
      finalBuffer.set(data, offset);
      offset += data.length;
    }

    return new NextResponse(finalBuffer, {
      headers: { "Content-Type": "audio/wav" },
    });

  } catch (err) {
    console.error("[TTS API Error]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
