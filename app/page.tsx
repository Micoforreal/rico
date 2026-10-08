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

  // On mount: check if Supabase already has a session (handles redirect-back from Google OAuth)
  useEffect(() => {
    const supabase = createBrowserSupabase();

    async function restoreSession() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.provider_token) {
        const permission = (data.session.user.user_metadata?.permission ??
          "read-only") as "read-only" | "read-send";
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
      if (supabaseSession?.provider_token) {
        const permission = (supabaseSession.user.user_metadata?.permission ??
          "read-only") as "read-only" | "read-send";
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

  if (flow === "picker") {
    return (
      <ConnectionPicker
        isConnected={!!session?.isGmail}
        connectedEmail={session?.userEmail}
        onSelectGmail={() => setFlow("permission")}
        onSelectDemo={() => setFlow("demo-switcher")}
        onDisconnect={handleDisconnect}
      />
    );
  }

  if (flow === "permission") {
    return (
      <PermissionChoice
        onContinue={async (level) => {
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
          // Store permission choice in user_metadata after redirect-back via onAuthStateChange
          // We embed it as a query param so it survives the redirect
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
          />
        </div>
      </div>
    );
  }

  return null;
}
