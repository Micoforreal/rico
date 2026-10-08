import { NextResponse } from "next/server";
import { checkHealth } from "@/lib/memory";

export async function GET() {
  try {
    // Check if env vars are present (never leak values)
    const envVars = {
      hasGroqKey: !!process.env.GROQ_API_KEY,
      hasMemWalKey: !!process.env.MEMWAL_PRIVATE_KEY,
      hasMemWalAccountId: !!process.env.MEMWAL_ACCOUNT_ID,
    };

    // Actual runtime check against the relayer
    const memoryHealth = await checkHealth();

    return NextResponse.json({
      status: memoryHealth.status,
      version: memoryHealth.version,
      env: envVars,
    });
  } catch (err) {
    console.error("[health] check failed", err);
    return NextResponse.json(
      { status: "error", detail: String(err) },
      { status: 500 }
    );
  }
}
