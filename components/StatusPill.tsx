"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

export function StatusPill() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/health");
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status === "ok" ? "ok" : "error");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }
    check();
  }, []);

  return (
    <div className="flex items-center gap-1.5 bg-[#3A352D] rounded-full px-2.5 py-1.5 text-[#F7F3EC] text-[11px] font-bold whitespace-nowrap">
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          status === "ok" ? "bg-[#4ADE80]" : status === "error" ? "bg-[#F87171]" : "bg-gray-500 animate-pulse"
        }`}
      />
      {status === "ok" ? "memory ok" : status === "error" ? "memory error" : "checking..."}
    </div>
  );
}
