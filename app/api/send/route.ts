import { NextRequest, NextResponse } from "next/server";
import { writeMemory } from "@/lib/memory";
import { sendEmail } from "@/lib/gmail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, gmailToken, to, subject, body: emailBody } = body as {
      userId: string;
      gmailToken: string;
      to: string;
      subject: string;
      body: string;
    };

    if (!userId || !gmailToken || !to || !subject || !emailBody) {
      return NextResponse.json({ error: "missing required fields" }, { status: 400 });
    }

    // Send the email via Gmail API
    await sendEmail(gmailToken, to, subject, emailBody);

    // Store "sent" memory directly in Walrus
    const today = new Date().toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
    const memoryText = `${today}: sent reply to ${to} re: ${subject}`;

    await writeMemory(userId, memoryText);

    return NextResponse.json({ success: true, memory: memoryText });
  } catch (err) {
    console.error("[send] error", err);
    return NextResponse.json(
      { error: "send failed", detail: String(err) },
      { status: 500 }
    );
  }
}
