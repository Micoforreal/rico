"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, LogOut, Mail, Send, AudioWaveform, AudioWaveformIcon, LucideAudioWaveform, LucideWaves, LucideWavesHorizontal } from "lucide-react";
import { startListening, stopListening, speak, cancelSpeech } from "@/lib/voice";

interface Message {
  id: string;
  role: "user" | "rico";
  content: string;
  recalled?: string[];
}

interface ChatProps {
  userId: string;
  gmailToken?: string;       // present only for real Gmail users
  gmailPermission?: "read-only" | "read-send";
  userEmail?: string;
  onDisconnect: () => void;
}

export function Chat({ userId, gmailToken, gmailPermission, userEmail, onDisconnect }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [interim, setInterim] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  // Track the last email Rico mentioned so "read it" follow-ups work correctly
  const [lastMsgId, setLastMsgId] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interim]);

  // Greet real Gmail users on first load
  useEffect(() => {
    if (gmailToken && messages.length === 0) {
      const name = userEmail?.split("@")[0] ?? "there";
      const greeting: Message = {
        id: "greeting",
        role: "rico",
        content: `hey ${name} — Gmail's connected${gmailPermission === "read-send" ? " with read and send access" : " in read-only mode"}. ask me anything about your inbox.`,
      };
      setMessages([greeting]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmailToken]);

  async function handleSend(text: string, fromVoice: boolean = false) {
    if (!text.trim()) return;

    const msgId = Math.random().toString();
    setMessages((prev) => [...prev, { id: msgId, role: "user", content: text }]);
    setTextInput("");
    setIsProcessing(true);


    console.log("[chat-client] sending:", { userId, hasGmailToken: !!gmailToken, lastMsgId });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: text,
          // Pass the Gmail token server-side so the API can call Gmail on behalf of the user
          gmailToken: gmailToken ?? undefined,
          gmailPermission,
          lastMsgId,
        }),
      });
      const data = await res.json();

      // Persist the last email ID for follow-up turns
      if (data.lastMsgId) setLastMsgId(data.lastMsgId);

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "rico",
          content: data.reply,
          recalled: data.recalled,
        },
      ]);

      if (fromVoice) {
        await speak(data.reply);
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), role: "rico", content: "Sorry, I ran into an error." },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }

  function toggleMic() {
    if (isListening) {
      stopListening();
      setIsListening(false);
      setInterim("");
    } else {
      cancelSpeech();
      setIsListening(true);
      startListening(
        (transcript, isFinal) => {
          if (isFinal) {
            setInterim("");
            setIsListening(false);
            handleSend(transcript, true);
          } else {
            setInterim(transcript);
          }
        },
        (err) => {
          console.error(err);
          setIsListening(false);
          setInterim("");
        },
        () => {
          setIsListening(false);
        }
      );
    }
  }

  const isGmailUser = !!gmailToken;

  return (
    <div className="flex flex-col flex-1 h-full max-h-screen relative w-full mx-auto px-5 py-8 md:py-10">
      {/* Header */}
      <header className="flex items-center gap-3 mb-1.5 shrink-0">
        <img
          className="w-10 h-10 rounded-full object-cover border-[1.5px] border-[rgba(245,165,36,0.28)] bg-[#241d12]"
          src="/rico-face.webp"
          alt="Rico"
        />
        <div className="flex flex-col gap-0.5">
          <b className="text-[#f7f3ec9e] text-[16px]">Rico</b>
          <span className="text-[#ffe1a167] text-[12px]">
            {isListening ? "listening…" : isProcessing ? "thinking…" : "online"}
          </span>
        </div>


      </header>

      {/* Messages */}
      <div className="flex-1 flex flex-col gap-3 pt-3.5 overflow-y-auto pb-[200px]">
        {messages.map((m) => (
          <div key={m.id} className="flex flex-col">
            {m.role === "user" ? (
              <div className="self-end bg-[#52360C] text-[#F7F3EC] rounded-[18px] px-4 py-3 text-[15px] max-w-[280px] md:max-w-[320px]">
                {m.content}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 self-start">
                <div className="self-start bg-[#1F1B16] text-[#F7F3EC] rounded-[18px] px-4 py-3.5 text-[14.5px] leading-relaxed max-w-[300px] md:max-w-[340px] whitespace-pre-wrap">
                  {m.content}
                </div>
                {m.recalled && m.recalled.length > 0 && (
                  <div className="self-start bg-[rgba(245,165,36,0.14)] text-[#F5A524] text-[11px] font-bold rounded-[20px] px-2.5 py-1">
                    recalled {m.recalled.length} memor{m.recalled.length === 1 ? "y" : "ies"}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {interim && (
          <div className="self-end bg-[#52360C] text-[#f7f3ecab] rounded-[18px] px-4 py-3 text-[15px] max-w-[280px] opacity-70">
            {interim}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom input bar */}
      <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2.5 pointer-events-auto bg-gradient-to-t from-[#141210] via-[#141210] to-transparent pt-10 px-5 pb-2">
        {mode === "voice" ? (
          <>
            <div className="relative w-[168px] h-[168px] flex items-center justify-center">
              {isListening && (
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle, rgba(245,165,36,0.35) 0%, rgba(245,165,36,0) 70%)",
                  }}
                />
              )}
              <button
                onClick={toggleMic}
                className="w-[92px] h-[92px] rounded-full border-2 border-[#F5A524] flex items-center justify-center gap-1.5 z-10 hover:scale-105 transition-transform"
              >
                {isListening ? (
                  <AudioWaveform className="animate-pulse" color="#F5A524" size={32} />
                ) : (
                  <Mic strokeWidth={2.5} color="#F5A524" size={32} />
                )}
              </button>
            </div>
            <div className="text-[#A39E93] text-[13px] -mt-4 mb-2">Tap to talk</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode("text")}
                className="text-[#A39E93] text-[13.5px] hover:text-[#F7F3EC] transition-colors"
              >
                type instead
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col w-full gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend(textInput, false)}
                placeholder="Type to Rico…"
                className="flex-1 bg-[#1F1B16] text-[#F7F3EC] rounded-[18px] px-4 py-3.5 outline-none focus:ring-2 focus:ring-[#f5a5246f] placeholder:text-[#A39E93]"
              />
              <button
                onClick={() => handleSend(textInput, false)}
                disabled={isProcessing || !textInput.trim()}
                className="w-[52px] h-[52px] shrink-0 rounded-[18px] bg-[#F5A524] flex items-center justify-center text-[#291A05] hover:bg-[#e0941f] disabled:opacity-50 transition-opacity"
              >
                <Send size={20} className="-ml-0.5" />
              </button>
            </div>
            <div className="flex items-center justify-between w-full px-2">
              <button
                onClick={() => setMode("voice")}
                className="flex items-center gap-2 text-[#A39E93] text-[13.5px] hover:text-[#F7F3EC] transition-colors"
              >
                <Mic size={16} /> tap to talk
              </button>
            </div>
          </div>
        )}
      </div>

        
<div className="absolute top-8 right-5 flex  flex-col items-end   gap-3 text-[12px] text-[#A39E93] hover:text-[#F7F3EC] transition-colors">
   {isGmailUser && (
          <div className="flex items-center gap-1.5 bg-[#1F1B16] rounded-full px-2.5 py-1 ml-1">
            {/* <Mail size={11} className="text-[#F5A524]" /> */}
            <span className="text-[11px] text-[#84837fc4] max-w-[120px] truncate">
              {userEmail}             </span>
            {gmailPermission === "read-send" && (
              <span className="text-[10px] text-[#4ADE80] font-bold">+send</span>
            )}
          </div>
        )}

      {/* Disconnect button */}
      <button
        onClick={onDisconnect}
        className=" flex items-center gap-2 border rounded-2xl px-2.5 py-1">
        <LogOut size={13} />
        {isGmailUser ? "Disconnect" : "Sign out"}
      </button>
    </div>
</div>

    
  );
}
