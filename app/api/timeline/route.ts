import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("memory_log")
      .select("memory_id, blob_id, text, user_id, namespace, created_at, superseded_by, walrus_network")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[timeline] Supabase query error", error.message);
      return NextResponse.json(
        { error: "failed to fetch timeline", detail: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ memories: data ?? [] });
  } catch (err) {
    console.error("[timeline] unexpected error", err);
    return NextResponse.json(
      { error: "failed to fetch timeline", detail: String(err) },
      { status: 500 }
    );
  }
}
