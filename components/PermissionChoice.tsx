"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PermissionChoiceProps {
  onContinue: (level: "read-only" | "read-send") => void;
  onBack: () => void;
}

export function PermissionChoice({ onContinue, onBack }: PermissionChoiceProps) {
  const [selected, setSelected] = useState<"read-only" | "read-send">("read-only");

  return (
    <div className="flex flex-col items-center w-full max-w-[480px] mx-auto pt-10 px-6">
      <img
        src="/rico-face.webp"
        alt="Rico"
        className="w-[64px] h-[64px] rounded-[20px] mb-6 shadow-xl object-cover"
      />
      <h1 className="text-[24px] font-bold text-[#F7F3EC] mb-8 text-center leading-tight">
        Choose Rico's email access
      </h1>

      <div className="flex flex-col gap-4 w-full mb-8">
        <Card
          onClick={() => setSelected("read-only")}
          className={`flex flex-col p-[18px] rounded-[18px] cursor-pointer transition-colors relative border-2 ${
            selected === "read-only"
              ? "border-[#F5A524] bg-[rgba(245,165,36,0.05)]"
              : "border-transparent bg-[#1F1B16] hover:bg-[#2a251e]"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[16.5px] font-bold text-[#F7F3EC]">Just read</span>
            <div className="bg-[#3A352D] text-[#A39E93] text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
              Recommended
            </div>
          </div>
          <p className="text-[14.5px] text-[#A39E93] leading-relaxed">
            Find, summarize, and read out emails. It can never send.
          </p>
        </Card>

        <Card
          onClick={() => setSelected("read-send")}
          className={`flex flex-col p-[18px] rounded-[18px] cursor-pointer transition-colors border-2 ${
            selected === "read-send"
              ? "border-[#F5A524] bg-[rgba(245,165,36,0.05)]"
              : "border-transparent bg-[#1F1B16] hover:bg-[#2a251e]"
          }`}
        >
          <div className="flex items-center mb-2">
            <span className="text-[16.5px] font-bold text-[#F7F3EC]">Read and send</span>
          </div>
          <p className="text-[14.5px] text-[#A39E93] leading-relaxed">
            Everything in Just read, plus draft and send replies — always with your explicit yes per message.
          </p>
        </Card>
      </div>

      <Button
        onClick={() => onContinue(selected)}
        className="w-full h-14 bg-[#F5A524] hover:bg-[#e0941f] text-[#291A05] text-[16px] font-bold rounded-[18px] mb-4"
      >
        Continue
      </Button>
      
      <button
        onClick={onBack}
        className="text-[14.5px] text-[#A39E93] hover:text-[#F7F3EC] transition-colors"
      >
        Back
      </button>
    </div>
  );
}
