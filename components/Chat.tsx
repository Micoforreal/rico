"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square, LogOut, Mail, Send, AudioWaveform, LucideAudioLines } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { startListening, stopListening, speak, cancelSpeech } from "@/lib/voice";
import { VoiceVisualizer } from "./VoiceVisualizer";
import { GmailAuthExpiredError, sendEmail } from "@/lib/gmail";

interface Message {
  id: string;
  role: "user" | "rico" | "system";
  content: string;
  recalled?: string[];
}

interface ChatProps {
  userId: string;
  gmailToken?: string;
  gmailPermission?: "read-only" | "read-send";
  userEmail?: string;
  onDisconnect: () => void;
  onGmailAuthExpired?: () => void;
}

export function Chat({ userId, gmailToken, gmailPermission, userEmail, onDisconnect, onGmailAuthExpired }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [mode, setMode] = useState<"voice" | "text">("text");
  const [interim, setInterim] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastMsgId, setLastMsgId] = useState<string | undefined>(undefined);
  const [pendingDraft, setPendingDraft] = useState<{ to: string; subject: string; body: string; inReplyToMsgId?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track current speaking text to show in voice mode
  const [speakingText, setSpeakingText] = useState("");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interim, mode]);

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
  }, [gmailToken]);

  async function handleSend(text: string, fromVoice: boolean = false) {
    if (!text.trim()) return;

    const msgId = Math.random().toString();
    setMessages((prev) => [...prev, { id: msgId, role: "user", content: text }]);
    setTextInput("");
    setIsProcessing(true);
    setSpeakingText("");

    if (pendingDraft) {
      if (/^(yes|yeah|yep|send it|confirm|go ahead|ok(ay)?|sure)$/i.test(text.trim())) {
        try {
          await sendEmail(gmailToken!, pendingDraft.to, pendingDraft.subject, pendingDraft.body, pendingDraft.inReplyToMsgId);
          setMessages((prev) => [...prev, { id: Math.random().toString(), role: "system", content: "Sent." }]);
        } catch (e: any) {
          console.error("Failed to send email:", e);
          if (e instanceof GmailAuthExpiredError || e.name === "GmailAuthExpiredError") {
            if (onGmailAuthExpired) onGmailAuthExpired();
            return;
          } else {
            setMessages((prev) => [...prev, { id: Math.random().toString(), role: "system", content: "Failed to send email." }]);
          }
        }
        setPendingDraft(null);
        setIsProcessing(false);
        return;
      } else {
        // If they said something else, clear draft and proceed normally
        setPendingDraft(null);
      }
    }

    // Build history
    const history = messages
      .filter((m) => m.role === "user" || m.role === "rico")
      .slice(-6)
      .map((m) => ({
        role: m.role === "rico" ? "assistant" : "user",
        content: m.content.slice(0, 1500),
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          message: text,
          gmailToken: gmailToken ?? undefined,
          gmailPermission,
          lastMsgId,
          history,
        }),
      });
      const data = await res.json();

      if (data.gmailAuthExpired && onGmailAuthExpired) {
        onGmailAuthExpired();
        return;
      }

      if (data.lastMsgId) setLastMsgId(data.lastMsgId);

      if (data.emailPreview) {
        setPendingDraft(data.emailPreview);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "rico",
          content: data.reply,
          recalled: data.recalled,
        },
      ]);

      if (fromVoice || mode === "voice") {
        setSpeakingText(data.reply);
        setIsSpeaking(true);
        await speak(data.reply);
        setIsSpeaking(false);
        setSpeakingText("");
      }
    } catch (e: any) {
      console.error(e);
      if (e instanceof GmailAuthExpiredError || e.name === "GmailAuthExpiredError") {
        if (onGmailAuthExpired) onGmailAuthExpired();
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: Math.random().toString(), role: "rico", content: "Sorry, I ran into an error." },
      ]);
      setIsSpeaking(false);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleConfirmDraft() {
    if (!gmailToken || !pendingDraft) return;
    setIsProcessing(true);
    try {
      await sendEmail(gmailToken, pendingDraft.to, pendingDraft.subject, pendingDraft.body, pendingDraft.inReplyToMsgId);
      setMessages((prev) => [...prev, { id: Math.random().toString(), role: "system", content: "Sent." }]);
    } catch (e: any) {
      console.error("Failed to send email:", e);
      if (e instanceof GmailAuthExpiredError || e.name === "GmailAuthExpiredError") {
        if (onGmailAuthExpired) onGmailAuthExpired();
      } else {
        setMessages((prev) => [...prev, { id: Math.random().toString(), role: "system", content: "Failed to send email." }]);
      }
    } finally {
      setPendingDraft(null);
      setIsProcessing(false);
    }
  }

  function handleCancelDraft() {
    setPendingDraft(null);
    setMessages((prev) => [...prev, { id: Math.random().toString(), role: "system", content: "Draft discarded." }]);
  }

  function toggleMic() {
    if (isListening || isSpeaking) {
      stopListening();
      cancelSpeech();
      setIsListening(false);
      setIsSpeaking(false);
      setSpeakingText("");
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
    <div className="flex flex-col flex-1 h-full max-h-screen relative w-full mx-auto px-5 py-8 md:py-10 bg-[#141210]">
      {/* Header - Hidden in Voice mode */}
      {mode === "text" && (
        <header className="flex items-center gap-3 mb-1.5 shrink-0">
          <img
            className="w-10 h-10 rounded-full object-cover border-[1.5px] border-[rgba(245,165,36,0.28)] bg-[#241d12]"
            src="/rico-face.webp"
            alt="Rico"
          />
          <div className="flex flex-col gap-0.5">
            <b className="text-[#f7f3ec9e] text-[16px]">Rico</b>
            <span className="text-[#ffe1a167] text-[12px]">
              {isProcessing ? "thinking…" : "online"}
            </span>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      {mode === "voice" ? (
        // Voice Hero UI
        <div className="flex-1 flex flex-col items-center justify-center relative w-full">
          {/* Wave ring + Mic Button */}
          <div className="relative w-full max-w-[400px] aspect-square flex items-center justify-center -mt-10">
            <VoiceVisualizer isListening={isListening} isSpeaking={isSpeaking} />
            <button
              onClick={toggleMic}
              className={`w-[92px] h-[92px] rounded-full flex items-center justify-center gap-1.5 z-10 transition-transform ${isListening || isSpeaking ? 'bg-[#52360C] border-2 border-[#F5A524] scale-110' : 'bg-[#1F1B16] border border-[#F5A524] hover:scale-105'}`}
            >
              {isListening || isSpeaking ? (
                <LucideAudioLines strokeWidth={2.5} color="#F5A524" fill="#F5A524" size={28} />
              ) : (
                <Mic strokeWidth={2.5} color="#F5A524" size={32} />
              )}
            </button>
          </div>

          {/* Subtext area */}
          <div className="h-[120px] flex items-start justify-center text-center px-6 -mt-6 z-10 w-full max-w-md">
            {isListening ? (
              <p className="text-[#f7f3ecab] text-[18px] leading-relaxed italic">{interim || "Listening..."}</p>
            ) : isSpeaking ? (
              <p className="text-[#F7F3EC] text-[18px] leading-relaxed font-medium line-clamp-4">{speakingText}</p>
            ) : isProcessing ? (
              <p className="text-[#A39E93] text-[16px] animate-pulse">Thinking...</p>
            ) : (
              <p className="text-[#A39E93] text-[15px]">Tap to talk</p>
            )}
          </div>
        </div>
      ) : (
        // Text Thread UI
        <div className="flex-1 flex flex-col gap-3 pt-3.5 overflow-y-auto pb-[200px]">
          {messages.map((m) => (
            <div key={m.id} className="flex flex-col">
              {m.role === "system" ? (
                <div className="self-center text-[#A39E93] text-[13px] italic my-2">
                  {m.content}
                </div>
              ) : m.role === "user" ? (
                <div className="self-end bg-[#52360C] text-[#F7F3EC] rounded-[18px] px-4 py-3 text-[15px] max-w-[280px] md:max-w-[320px]">
                  {m.content}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 self-start">
                  <div className="self-start bg-[#1F1B16] text-[#F7F3EC] rounded-[18px] px-4 py-3.5 text-[14.5px] leading-relaxed max-w-[300px] md:max-w-[340px] prose-rico">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-[#F5A524]">{children}</strong>,
                        em: ({ children }) => <em className="italic opacity-80">{children}</em>,
                        code: ({ children }) => <code className="bg-[#2a2318] text-[#F5A524] rounded px-1 py-0.5 text-[12.5px] font-mono">{children}</code>,
                        pre: ({ children }) => <pre className="bg-[#0e0c09] rounded-[10px] p-3 overflow-x-auto text-[12px] font-mono my-2">{children}</pre>,
                        ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-1">{children}</ol>,
                        li: ({ children }) => <li className="text-[14px]">{children}</li>,
                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#F5A524] underline underline-offset-2 hover:opacity-80">{children}</a>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-[#F5A524] pl-3 opacity-70 italic my-2">{children}</blockquote>,
                        hr: () => <hr className="border-[#3A352D] my-3" />,
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
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
          {pendingDraft && (
            <div className="self-center flex flex-col gap-2 bg-[#2A251E] border border-[#3A352D] rounded-[14px] p-4 mt-2 w-full max-w-[340px]">
              <div className="text-[#A39E93] text-[12px] font-bold uppercase tracking-wider mb-1">
                Draft Email
              </div>
              <div className="text-[14px] text-[#F7F3EC] flex flex-col gap-1">
                <div><span className="text-[#A39E93]">To:</span> {pendingDraft.to}</div>
                <div><span className="text-[#A39E93]">Subject:</span> {pendingDraft.subject}</div>
                <div className="mt-2 text-[13px] whitespace-pre-wrap font-mono bg-[#141210] p-2 rounded-[8px]">{pendingDraft.body}</div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleConfirmDraft}
                  disabled={isProcessing}
                  className="flex-1 bg-[#4ADE80] text-[#141210] font-bold py-2 px-3 rounded-[10px] text-[13px] hover:bg-[#3bca6b] transition-colors disabled:opacity-50"
                >
                  Confirm send
                </button>
                <button
                  onClick={handleCancelDraft}
                  disabled={isProcessing}
                  className="flex-1 border border-[#3A352D] text-[#A39E93] font-bold py-2 px-3 rounded-[10px] text-[13px] hover:text-[#F7F3EC] hover:bg-[#141210] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Bottom Controls */}
      <div className={`absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2.5 pointer-events-auto pt-10 px-5 pb-2 ${mode === "text" ? "bg-gradient-to-t from-[#141210] via-[#141210] to-transparent" : ""}`}>
        {mode === "voice" ? (
          <button
            onClick={() => {
              setMode("text");
              if (isListening || isSpeaking) toggleMic();
            }}
            className="text-[#A39E93] text-[14px] hover:text-[#F7F3EC] transition-colors py-2 px-4 rounded-full border border-transparent hover:border-[#3A352D] bg-[#1F1B16] z-10 shadow-lg"
          >
            Type instead
          </button>
        ) : (
          <div className="flex flex-col w-full gap-3 max-w-3xl mx-auto">
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
            <div className="flex items-center justify-center w-full px-2">
              <button
                onClick={() => setMode("voice")}
                className="flex items-center gap-2 text-[#A39E93] text-[14px] hover:text-[#F7F3EC] transition-colors py-1 px-3 rounded-full hover:bg-[#1F1B16]"
              >
                <Mic size={16} /> Tap to talk
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-8 right-5 flex flex-col items-end gap-3 text-[12px] text-[#A39E93] hover:text-[#F7F3EC] transition-colors z-50">
        {isGmailUser && (
          <div className="flex items-center gap-1.5 bg-[#1F1B16] rounded-full px-2.5 py-1 ml-1">
            <span className="text-[11px] text-[#84837fc4] max-w-[120px] truncate">
              {userEmail}
            </span>
            {gmailPermission === "read-send" && (
              <span className="text-[10px] text-[#4ADE80] font-bold">+send</span>
            )}
          </div>
        )}
        <button
          onClick={onDisconnect}
          className="flex items-center gap-2 border border-[#3A352D] bg-[#141210] rounded-2xl px-2.5 py-1 hover:bg-[#1F1B16]"
        >
          <LogOut size={13} />
          {isGmailUser ? "Disconnect" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
