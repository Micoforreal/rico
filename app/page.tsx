"use client";

import { useState, useEffect } from "react";
import { ConnectionPicker } from "@/components/ConnectionPicker";
import { PermissionChoice } from "@/components/PermissionChoice";
import { DemoUserSwitcher } from "@/components/DemoUserSwitcher";
import { Chat } from "@/components/Chat";
import { MemoryTimeline } from "@/components/MemoryTimeline";
import { createBrowserSupabase } from "@/lib/supabase";
import { Menu, X } from "lucide-react";

type FlowState = "picker" | "permission" | "demo-switcher" | "chat";

export interface GmailSession {
  userId: string;
  userEmail: string;
  gmailToken: string;
  permission: "read-only" | "read-send";
  isGmail: boolean; // false for demo users
}

export default function Home() {
  const [flow, setFlow] = useState<FlowState>("picker");
  const [session, setSession] = useState<GmailSession | null>(null);
  const [showMobileMemory, setShowMobileMemory] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);

  // On mount: check if Supabase already has a session (handles redirect-back from Google OAuth)
  useEffect(() => {
    const supabase = createBrowserSupabase();

    async function restoreSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.provider_token) {
        let permission = (data.session.user.user_metadata?.permission ?? "read-only") as "read-only" | "read-send";
        
        // If we just returned from OAuth, grab the pending choice and persist it
        const pending = localStorage.getItem("rico_pending_permission");
        if (pending) {
          permission = pending as "read-only" | "read-send";
          localStorage.removeItem("rico_pending_permission");
          await supabase.auth.updateUser({ data: { permission } });
        }

        setSession({
          userId: data.session.user.id,
          userEmail: data.session.user.email ?? "",
          gmailToken: data.session.provider_token,
          permission,
          isGmail: true,
        });
        setFlow("chat");
      }
    }

    restoreSession();

    // Listen for sign-in/sign-out changes during the session
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, supabaseSession) => {
      if (supabaseSession?.provider_token) {
        let permission = (supabaseSession.user.user_metadata?.permission ?? "read-only") as "read-only" | "read-send";
        
        const pending = localStorage.getItem("rico_pending_permission");
        if (pending) {
          permission = pending as "read-only" | "read-send";
          localStorage.removeItem("rico_pending_permission");
          await supabase.auth.updateUser({ data: { permission } });
        }

        setSession({
          userId: supabaseSession.user.id,
          userEmail: supabaseSession.user.email ?? "",
          gmailToken: supabaseSession.provider_token,
          permission,
          isGmail: true,
        });
        setFlow("chat");
      } else if (!supabaseSession) {
        // Signed out
        setSession(null);
        setFlow("picker");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleDisconnect() {
    if (session?.isGmail) {
      const supabase = createBrowserSupabase();
      await supabase.auth.signOut();
    }
    setSession(null);
    setFlow("picker");
  }

  async function handleGmailAuthExpired() {
    await handleDisconnect();
    setSessionExpiredNotice("Your Gmail session expired. Please reconnect.");
  }

  if (flow === "picker") {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#141210] items-center justify-center">
        {sessionExpiredNotice && (
          <div className="bg-[#52360C] text-[#F7F3EC] px-4 py-3 rounded-[12px] text-[14px] mb-6 flex flex-col items-center max-w-sm text-center border border-[#F5A524] shadow-lg">
            <b>{sessionExpiredNotice}</b>
            <span className="text-[#A39E93] text-[13px] mt-1">If you changed permissions, reconnect to apply them.</span>
          </div>
        )}
        <ConnectionPicker
          isConnected={!!session?.isGmail}
          connectedEmail={session?.userEmail}
          permission={session?.permission}
          onSelectGmail={() => {
            setSessionExpiredNotice(null);
            setFlow("permission");
          }}
          onSelectDemo={() => {
            setSessionExpiredNotice(null);
            setFlow("demo-switcher");
          }}
          onDisconnect={handleDisconnect}
        />
      </div>
    );
  }

  if (flow === "permission") {
    return (
      <PermissionChoice
        onContinue={async (level) => {
          localStorage.setItem("rico_pending_permission", level);
          const supabase = createBrowserSupabase();
          const scopes =
            level === "read-only"
              ? "https://www.googleapis.com/auth/gmail.readonly"
              : "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send";
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              scopes,
              redirectTo: window.location.origin,
              queryParams: { access_type: "offline", prompt: "consent" },
            },
          });
        }}
        onBack={() => setFlow("picker")}
      />
    );
  }

  if (flow === "demo-switcher") {
    return (
      <DemoUserSwitcher
        onSelect={(id) => {
          setSession({
            userId: id,
            userEmail: "",
            gmailToken: "",
            permission: "read-only",
            isGmail: false,
          });
          setFlow("chat");
        }}
        onBack={() => setFlow("picker")}
      />
    );
  }

  if (flow === "chat" && session) {
    return (
      <div className="flex w-screen h-screen bg-[#141210] overflow-hidden relative">
        {/* Mobile Hamburger */}
        <button
          className="xl:hidden absolute top-6 left-5 z-50 text-[#F7F3EC] bg-[#1F1B16] p-2 rounded-full shadow-lg border border-[#3A352D]"
          onClick={() => setShowMobileMemory(!showMobileMemory)}
        >
          {showMobileMemory ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Mobile memory overlay */}
        {showMobileMemory && (
          <div className="xl:hidden absolute inset-0 z-40 bg-[#141210] flex justify-center pt-16 pb-4">
            <MemoryTimeline userId={session.userId} />
          </div>
        )}

        {/* Desktop timeline panel (Left, 25%) */}
        <div className="hidden xl:flex h-full border-r border-[#3A352D] w-1/4 flex-none">
          <MemoryTimeline userId={session.userId} />
        </div>
        {/* Chat (Right, 75%) */}
        <div className="flex-1 w-full xl:w-3/4 flex justify-center min-w-0 xl:px-[5%]">
          <Chat
            userId={session.userId}
            gmailToken={session.isGmail ? session.gmailToken : undefined}
            gmailPermission={session.permission}
            userEmail={session.userEmail}
            onDisconnect={handleDisconnect}
            onGmailAuthExpired={handleGmailAuthExpired}
          />
        </div>
      </div>
    );
  }

  return null;
}
