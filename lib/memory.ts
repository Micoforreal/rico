/**
 * MemWal integration — server-side only.
 * NEVER import this in client components.
 */
import { MemWal } from "@mysten-incubation/memwal";
import type { RecallMemory } from "@mysten-incubation/memwal";
import {
  NAMESPACE_PREFIX,
  MEMWAL_SERVER_URL,
  RECALL_MAX_DISTANCE,
  DEDUPE_DISTANCE,
  MEMWAL_TIMEOUT_MS,
} from "./config";
import { createServerSupabase, insertMemoryLog } from "./supabase";

// RecallMemory is still exported for callers that need the MemWal type
export type { RecallMemory };

let _memwal: MemWal | null = null;

function getMemWal(): MemWal {
  if (_memwal) return _memwal;
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  const serverUrl = process.env.MEMWAL_SERVER_URL ?? MEMWAL_SERVER_URL;

  if (!key || !accountId) {
    throw new Error("MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID are required.");
  }

  _memwal = MemWal.create({
    key,
    accountId,
    serverUrl,
    namespace: NAMESPACE_PREFIX,
  });

  return _memwal;
}

/** Namespace string for a user — e.g. "rico:user-ada" */
export function userNamespace(userId: string) {
  return `${NAMESPACE_PREFIX}:${userId}`;
}

/** Check relayer health */
export async function checkHealth() {
  const mw = getMemWal();
  return mw.health();
}

/** Semantic recall — returns texts with distance < RECALL_MAX_DISTANCE */
export async function recallMemories(
  userId: string,
  query: string,
  limit = 5
): Promise<{ text: string; distance: number }[]> {
  const mw = getMemWal();
  const ns = userNamespace(userId);
  try {
    const result = await mw.recall({
      query,
      limit,
      namespace: ns,
      maxDistance: RECALL_MAX_DISTANCE,
    });
    return (result.results ?? [])
      .filter((r: { distance: number }) => r.distance < RECALL_MAX_DISTANCE)
      .map((r: { text: string; distance: number }) => ({
        text: r.text,
        distance: r.distance,
      }));
  } catch (err) {
    console.error("[memory] recall error", err);
    return [];
  }
}

/**
 * Dedupe-aware write:
 * 1. Recall for near-duplicates (distance < DEDUPE_DISTANCE).
 * 2. If found, skip the write and return null.
 * 3. Otherwise, rememberAndWait and return the result.
 */
export async function writeMemory(
  userId: string,
  text: string
): Promise<{ id: string; job_id: string; blob_id: string } | null> {
  const mw = getMemWal();
  const ns = userNamespace(userId);

  // Dedupe check
  try {
    const dupeCheck = await mw.recall({
      query: text,
      limit: 1,
      namespace: ns,
      maxDistance: DEDUPE_DISTANCE,
    });
    const results = dupeCheck.results ?? [];
    if (results.length > 0 && results[0].distance < DEDUPE_DISTANCE) {
      console.log("[memory] dedupe: skipping near-duplicate write");
      return null;
    }
  } catch {
    // ignore recall errors for dedupe — safer to write than skip
  }

  try {
    const result = await mw.rememberAndWait(text, ns, {
      timeoutMs: MEMWAL_TIMEOUT_MS,
    });
    const typed = result as { id: string; job_id: string; blob_id: string };

    // Secondary index: insert into Supabase memory_log.
    // MemWal is the source of truth — a Supabase failure must never fail the write.
    try {
      const supabase = createServerSupabase();
      await insertMemoryLog(supabase, {
        memory_id: typed.id,
        blob_id: typed.blob_id ?? null,
        text,
        user_id: userId,
        namespace: ns,
        created_at: new Date().toISOString(),
        superseded_by: null,
      });
    } catch (supabaseErr) {
      console.error("[memory] Supabase memory_log insert failed (non-fatal)", supabaseErr);
    }

    return typed;
  } catch (err) {
    console.error("[memory] rememberAndWait error", err);
    return null;
  }
}

/**
 * Extract multiple facts from long text using analyzeAndWait.
 * Returns array of { text, id, blob_id }.
 */
export async function analyzeFacts(
  userId: string,
  longText: string
): Promise<{ text: string; id: string; blob_id: string }[]> {
  const mw = getMemWal();
  const ns = userNamespace(userId);
  try {
    const analyzed = await mw.analyzeAndWait(longText, ns, {
      timeoutMs: MEMWAL_TIMEOUT_MS,
    });
    return (analyzed.facts ?? []) as { text: string; id: string; blob_id: string }[];
  } catch (err) {
    console.error("[memory] analyzeAndWait error", err);
    return [];
  }
}

// listRecentMemories has been removed.
// The Memory Timeline now queries Supabase memory_log via GET /api/timeline.
// MemWal is still the source of truth for all semantic reads/writes.
