"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "./StatusPill";

interface Memory {
  memory_id: string;
  text: string;
  created_at: string;
  superseded_by: string | null;
}

export function MemoryTimeline({ userId }: { userId: string }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResetting, setIsResetting] = useState(false);

  async function fetchTimeline() {
    try {
      const res = await fetch(`/api/timeline?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMemories(data.memories ?? []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTimeline();
    // Poll every 5s for new memories
    const interval = setInterval(fetchTimeline, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  async function handleReset() {
    setIsResetting(true);
    try {
      await fetch("/api/seed", { method: "POST" });
      await fetchTimeline();
    } finally {
      setIsResetting(false);
    }
  }

  // Group memories by date
  const grouped: Record<string, Memory[]> = {};
  memories.forEach((m) => {
    const d = new Date(m.created_at);
    let key = "Today";
    // basic grouping logic
    const today = new Date();
    if (d.toDateString() !== today.toDateString()) {
      const diff = today.getTime() - d.getTime();
      const days = Math.floor(diff / (1000 * 3600 * 24));
      if (days === 1) key = "Yesterday";
      else if (days < 7) {
        key = d.toLocaleDateString("en-US", { weekday: "long" });
      } else {
        key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
    }
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(m);
  });

  return (
    <div className="flex flex-col w-full max-w-[400px] xl:max-w-none flex-none px-6 py-10 gap-3.5 h-full overflow-y-auto">
      <div className="flex items-center gap-2.5 mb-1">
        <b className="text-[20px] text-[#F7F3EC]">Memory</b>
        <div className="flex-1" />
        <StatusPill />
      </div>

      {loading && memories.length === 0 ? (
        <div className="text-[14.5px] text-[#A39E93]">Loading timeline...</div>
      ) : memories.length === 0 ? (
        <div className="text-[14.5px] text-[#A39E93]">No memories yet.</div>
      ) : (
        Object.entries(grouped).map(([group, groupMemories]) => (
          <div key={group} className="flex flex-col gap-3.5">
            <div className="text-[12px] font-bold text-[#A39E93] mt-1.5">{group}</div>
            {groupMemories.map((m) => (
              <div
                key={m.memory_id}
                className="bg-[#1F1B16] rounded-[14px] px-4 py-3.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[14.5px] text-[#F7F3EC] leading-snug break-words">
                    {m.text}
                  </span>
                  <span className="text-[12px] text-[#A39E93] ml-auto whitespace-nowrap">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {m.superseded_by && (
                  <span className="self-start bg-[rgba(74,222,128,0.14)] text-[#4ADE80] text-[11px] font-bold rounded-[20px] px-2.5 py-1">
                    resolved
                  </span>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {userId.startsWith("user-") && (
        <button
          onClick={handleReset}
          disabled={isResetting}
          className="mt-auto border border-[#A39E93] text-[#A39E93] bg-transparent rounded-[14px] p-3 text-[14px] text-center cursor-pointer hover:text-[#F7F3EC] hover:border-[#F7F3EC] transition-colors disabled:opacity-50"
        >
          {isResetting ? "Resetting..." : "Reset demo data"}
        </button>
      )}
    </div>
  );
}
