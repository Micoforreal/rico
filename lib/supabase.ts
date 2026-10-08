import { createBrowserClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client — safe to call in Client Components */
export function createBrowserSupabase() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/** Service-role client for API routes (uses service key if present, else anon) */
export function createServerSupabase() {
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey;
  return createServiceClient(supabaseUrl, serviceKey);
}

// ─── memory_log helpers ───────────────────────────────────────────────────────

export interface MemoryLogRow {
  memory_id: string;
  blob_id: string | null;
  text: string;
  user_id: string;
  namespace: string;
  created_at: string;
  superseded_by: string | null;
}

export async function insertMemoryLog(
  supabase: ReturnType<typeof createServerSupabase>,
  row: Omit<MemoryLogRow, "created_at"> & { created_at?: string }
) {
  const { error } = await supabase.from("memory_log").insert({
    ...row,
    created_at: row.created_at ?? new Date().toISOString(),
  });
  if (error) {
    console.error("[memory_log] insert error", error.message);
  }
}

export async function markSuperseded(
  supabase: ReturnType<typeof createServerSupabase>,
  oldMemoryId: string,
  newMemoryId: string
) {
  const { error } = await supabase
    .from("memory_log")
    .update({ superseded_by: newMemoryId })
    .eq("memory_id", oldMemoryId);
  if (error) {
    console.error("[memory_log] supersede error", error.message);
  }
}
