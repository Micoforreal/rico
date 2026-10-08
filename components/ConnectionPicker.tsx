"use client";

import { SocialIcon } from "react-social-icons";
import { Card } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

interface ConnectionPickerProps {
  isConnected: boolean;        // true when Supabase has an active Google session
  connectedEmail?: string;     // the connected Google account email
  onSelectGmail: () => void;
  onSelectDemo: () => void;
  onDisconnect: () => void;
}

export function ConnectionPicker({
  isConnected,
  connectedEmail,
  onSelectGmail,
  onSelectDemo,
  onDisconnect,
}: ConnectionPickerProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-[800px] mx-auto pt-10 px-4">
      <img
        src="/rico-face.webp"
        alt="Rico"
        className="w-[104px] h-[104px] rounded-[32px] mb-6 shadow-xl object-cover"
      />
      <h1 className="text-[32px] font-bold text-[#F7F3EC] mb-1">Rico</h1>
      <p className="text-[15px] text-[#A39E93] mb-10">A voice-first AI assistant that remembers.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full md:px-8 mt-4">
        {/* Gmail card — switches to "connected" state once authed */}
        {isConnected ? (
          <Card className="flex items-center gap-4 p-[18px] rounded-[18px] bg-[#1F1B16] border-2 border-[#4ADE80]">
            <div className="w-10 h-10 shrink-0 relative">
              <SocialIcon network="google" style={{ height: 40, width: 40 }} />
              <CheckCircle
                size={16}
                className="absolute -bottom-1 -right-1 text-[#4ADE80] bg-[#1F1B16] rounded-full"
                fill="#1F1B16"
              />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[16.5px] font-bold text-[#F7F3EC]">Gmail connected</span>
              {connectedEmail && (
                <span className="text-[12px] text-[#A39E93] truncate">{connectedEmail}</span>
              )}
            </div>
            <button
              onClick={onDisconnect}
              className="text-[13px] text-[#A39E93] hover:text-[#F7F3EC] border border-[#3A352D] rounded-[10px] px-3 py-1.5 shrink-0 transition-colors"
            >
              Disconnect
            </button>
          </Card>
        ) : (
          <Card
            onClick={onSelectGmail}
            className="flex items-center gap-4 p-[18px] rounded-[18px] bg-[#1F1B16] border-transparent cursor-pointer hover:bg-[#2a251e] transition-colors h-full"
          >
            <div className="w-10 h-10 shrink-0">
              <SocialIcon network="google" style={{ height: 40, width: 40 }} />
            </div>
            <div className="flex flex-col">
              <span className="text-[16.5px] font-bold text-[#F7F3EC]">Connect Gmail</span>
              <span className="text-[12px] text-[#A39E93]">read your inbox with Rico</span>
            </div>
          </Card>
        )}

        {/* Connect GitHub — coming soon */}
        <Card className="flex items-center gap-4 p-[18px] rounded-[18px] bg-[#1F1B16] border-transparent opacity-50 cursor-not-allowed h-full">
          <div className="w-10 h-10 shrink-0">
            <SocialIcon network="github" style={{ height: 40, width: 40 }} bgColor="#ffffff" fgColor="#000000" />
          </div>
          <div className="flex flex-col">
            <span className="text-[16.5px] font-bold text-[#F7F3EC]">Connect GitHub</span>
            <span className="text-[12px] text-[#A39E93]">coming soon</span>
          </div>
        </Card>

        {/* Try Demo */}
        {!isConnected && (
          <div className="md:col-span-2 flex justify-center md:pt-4">
            <Card
              onClick={onSelectDemo}
              className="flex items-center gap-4 p-[18px] rounded-[18px] bg-[#1F1B16] border-transparent cursor-pointer hover:bg-[#2a251e] transition-colors w-full md:max-w-[400px]"
            >
              <div className="w-10 h-10 shrink-0 bg-[#3A352D] rounded-full flex items-center justify-center text-[#F5A524] text-xl font-bold">
                ?
              </div>
              <div className="flex flex-col">
                <span className="text-[16.5px] font-bold text-[#F7F3EC]">Try the demo</span>
                <span className="text-[12px] text-[#A39E93]">no login needed</span>
              </div>
            </Card>
          </div>
        )}

        {/* If connected, allow jumping straight into chat */}
        {isConnected && (
          <div className="md:col-span-2 flex justify-center md:pt-4">
            <button
              onClick={onSelectGmail}
              className="w-full md:max-w-[400px] h-14 bg-[#F5A524] hover:bg-[#e0941f] text-[#291A05] text-[16px] font-bold rounded-[18px] transition-colors mt-1"
            >
              Open Rico
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
