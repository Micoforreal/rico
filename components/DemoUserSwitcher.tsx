"use client";

import { DEMO_USERS, DemoUserId } from "@/lib/config";
import { Card } from "@/components/ui/card";

interface DemoUserSwitcherProps {
  onSelect: (userId: DemoUserId) => void;
  onBack: () => void;
}

export function DemoUserSwitcher({ onSelect, onBack }: DemoUserSwitcherProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-[480px] mx-auto pt-10 px-6">
      <img
        src="/rico-face.webp"
        alt="Rico"
        className="w-[64px] h-[64px] rounded-[20px] mb-6 shadow-xl object-cover"
      />
      <h1 className="text-[24px] font-bold text-[#F7F3EC] mb-2 text-center leading-tight">
        Pick a demo user
      </h1>
      <p className="text-[14.5px] text-[#A39E93] mb-8 text-center">
        These profiles have pre-seeded memory histories so you can see Rico in action instantly. No login required.
      </p>

      <div className="flex flex-col gap-4 w-full mb-8">
        {DEMO_USERS.map((user) => (
          <Card
            key={user.id}
            onClick={() => onSelect(user.id as DemoUserId)}
            className="flex flex-col p-[18px] rounded-[18px] cursor-pointer transition-colors border-transparent bg-[#1F1B16] hover:bg-[#2a251e]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[16.5px] font-bold text-[#F7F3EC]">{user.name}</span>
              <div className="bg-[#3A352D] text-[#A39E93] text-[11px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                {user.permission}
              </div>
            </div>
            <p className="text-[14.5px] text-[#A39E93]">{user.label}</p>
          </Card>
        ))}
      </div>
      
      <button
        onClick={onBack}
        className="text-[14.5px] text-[#A39E93] hover:text-[#F7F3EC] transition-colors"
      >
        Back
      </button>
    </div>
  );
}
