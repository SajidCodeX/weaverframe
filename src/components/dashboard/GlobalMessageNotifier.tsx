import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { X, ArrowUpRight } from "lucide-react";
import { getLatestInboundMessages } from "@/lib/dashboard";

interface InboundNotification {
  id: string;
  leadId: string;
  leadName: string;
  leadEmail?: string;
  scoreTier?: string;
  content: string;
  channel?: string;
  isSimulated?: boolean;
  isMuteNotice?: boolean;
  createdAt: string;
}

// AudioContext pre-warmed on first user interaction (avoids autoplay block)
let audioCtxRef: AudioContext | null = null;

function getOrCreateAudioCtx(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef) audioCtxRef = new AudioCtx();
    if (audioCtxRef.state === "suspended") audioCtxRef.resume().catch(() => {});
    return audioCtxRef;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  const warmup = () => { getOrCreateAudioCtx(); };
  window.addEventListener("click", warmup, { once: true });
  window.addEventListener("keydown", warmup, { once: true });
  window.addEventListener("touchstart", warmup, { once: true });
}

export function playNotificationSound() {
  try {
    const audio = new Audio("/sounds/notification.mp3");
    audio.volume = 0.8;
    const p = audio.play();
    if (p !== undefined) {
      p.catch(() => {
        const wav = new Audio("/sounds/notification.wav");
        wav.volume = 0.8;
        wav.play().catch(() => playSynthesizedChime());
      });
    }
  } catch {
    playSynthesizedChime();
  }
}

function playSynthesizedChime() {
  try {
    const ctx = getOrCreateAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(540, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1); gain1.connect(ctx.destination);
    osc1.start(now); osc1.stop(now + 0.12);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.07);
    gain2.gain.setValueAtTime(0.25, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2); gain2.connect(ctx.destination);
    osc2.start(now + 0.07); osc2.stop(now + 0.35);
  } catch {}
}

function showDesktopNotification(title: string, body: string, onClick: () => void) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      const n = new Notification(title, { body, icon: "/favicon.png", badge: "/favicon.png", silent: false });
      n.onclick = () => { window.focus(); onClick(); n.close(); };
    } catch {}
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") showDesktopNotification(title, body, onClick);
    });
  }
}

function getInitials(name: string): string {
  if (!name) return "L";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function cleanMessageContent(raw: string): string {
  if (!raw) return "";
  let text = raw;
  // Strip quoted reply date-time headers like "On Wed, Sep 2, 2026 at 12:35 PM wrote:..."
  text = text.replace(/\s*On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+[A-Za-z]+\s+\d+[\s\S]*/i, "");
  text = text.replace(/\s*On\s+[\s\S]+?wrote:[\s\S]*/i, "");
  text = text.replace(/\s*-{2,}\s*Original Message[\s\S]*/i, "");
  text = text.replace(/\s*_{2,}[\s\S]*/i, "");
  text = text.replace(/\s*From:\s*.+[\r\n]+Sent:\s*.+[\s\S]*/i, "");

  const lines = text.split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith(">") && !l.startsWith("&gt;"));

  return lines.join(" ").trim() || raw.trim();
}

const SEEN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getSeenIds(): Map<string, number> {
  try {
    const raw = sessionStorage.getItem("seen_inbound_msg_ids_v2");
    if (!raw) return new Map();
    const parsed: [string, number][] = JSON.parse(raw);
    const now = Date.now();
    return new Map(parsed.filter(([, ts]) => now - ts < SEEN_WINDOW_MS));
  } catch {
    return new Map();
  }
}

function saveSeenIds(map: Map<string, number>) {
  try {
    sessionStorage.setItem("seen_inbound_msg_ids_v2", JSON.stringify([...map.entries()]));
  } catch {}
}

export function GlobalMessageNotifier() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [notifications, setNotifications] = useState<InboundNotification[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  const seenIdsRef = useRef<Map<string, number>>(new Map());
  const activeLeadIdRef = useRef<string | null>(null);
  const lastPollTimeRef = useRef<string>(new Date(Date.now() - 3 * 60 * 1000).toISOString());

  useEffect(() => {
    seenIdsRef.current = getSeenIds();
  }, []);

  useEffect(() => {
    const handleActiveLead = (e: any) => { activeLeadIdRef.current = e.detail?.leadId || null; };
    window.addEventListener("weaver_active_lead_changed", handleActiveLead);
    return () => window.removeEventListener("weaver_active_lead_changed", handleActiveLead);
  }, []);

  // Window debugging helper to test notifications directly from console
  useEffect(() => {
    (window as any).testSlackNotification = (
      leadName = "Faizan Ansari",
      message = "Hello! Are you available for a custom home consultation this Saturday?"
    ) => {
      const testMsg: InboundNotification = {
        id: `test-${Date.now()}`,
        leadId: "test-lead",
        leadName,
        leadEmail: "faizan.ansari@example.com",
        content: message,
        scoreTier: "Hot",
        channel: "email",
        isSimulated: true,
        createdAt: new Date().toISOString(),
      };
      window.dispatchEvent(new CustomEvent("weaver_inbound_message", { detail: testMsg }));
    };

    (window as any).testAiOffNotification = (leadName = "Faizan Ansari") => {
      window.dispatchEvent(
        new CustomEvent("weaver_ai_muted", {
          detail: {
            leadId: "test-lead",
            leadName,
          },
        })
      );
    };
  }, []);

  // Handle AI Auto-Muted event (when human sends a manual message)
  // Shows a Slack-style card WITHOUT notification sound!
  useEffect(() => {
    const handleAiMuted = (e: any) => {
      const detail = e.detail || {};
      const leadId = detail.leadId || "";
      const leadName = detail.leadName || "Lead";

      const muteNotice: InboundNotification = {
        id: `ai-muted-${Date.now()}`,
        leadId,
        leadName,
        leadEmail: "",
        content: `AI is off for ${leadName}. You are now speaking directly with this lead.`,
        scoreTier: "AI OFF",
        channel: "portal",
        isSimulated: false,
        isMuteNotice: true,
        createdAt: new Date().toISOString(),
      };

      // STRICTLY SILENT: No sound played as requested ("slack style but not notification sound")
      setNotifications((prev) => [muteNotice, ...prev].slice(0, 3));
    };

    window.addEventListener("weaver_ai_muted", handleAiMuted);
    return () => window.removeEventListener("weaver_ai_muted", handleAiMuted);
  }, []);

  const handleOpenConversation = useCallback((leadId: string, id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    window.dispatchEvent(new CustomEvent("weaver_select_lead", { detail: { leadId } }));
    const activeRole = sessionStorage.getItem("active_role");
    const targetRoute = activeRole === "admin" ? "/admin/inbox" : "/messages";
    router.navigate({ to: targetRoute, search: { leadId } as any });
  }, [router]);

  const fireNotification = useCallback((msgs: InboundNotification[]) => {
    if (msgs.length === 0) return;
    playNotificationSound();
    const topMsg = msgs[0];
    showDesktopNotification(
      `New Message from ${topMsg.leadName}`,
      cleanMessageContent(topMsg.content),
      () => handleOpenConversation(topMsg.leadId, topMsg.id)
    );
    setNotifications((prev) => [...msgs, ...prev].slice(0, 3));
    router.invalidate();
  }, [router, handleOpenConversation]);

  // Handle simulated / instant-trigger inbound events
  useEffect(() => {
    const handleCustomInbound = (e: any) => {
      const msg: InboundNotification = e.detail;
      if (!msg || !msg.id) return;
      const isCurrentChatOpen =
        (pathname === "/messages" || pathname === "/admin/inbox") &&
        activeLeadIdRef.current === msg.leadId;
      if (isCurrentChatOpen) return;
      const now = Date.now();
      seenIdsRef.current.set(msg.id, now);
      saveSeenIds(seenIdsRef.current);
      fireNotification([msg]);
    };
    window.addEventListener("weaver_inbound_message", handleCustomInbound);
    return () => window.removeEventListener("weaver_inbound_message", handleCustomInbound);
  }, [pathname, fireNotification]);

  // Polling loop — timestamp-cursor based, every 4 seconds
  useEffect(() => {
    let isMounted = true;

    const poll = async () => {
      if (typeof window === "undefined") return;
      const activeRole = sessionStorage.getItem("active_role") ?? undefined;
      try {
        const latestMsgs = await getLatestInboundMessages({
          data: { since: lastPollTimeRef.current, activeRole },
        });

        if (!isMounted) return;

        lastPollTimeRef.current = new Date().toISOString();

        if (!Array.isArray(latestMsgs) || latestMsgs.length === 0) return;

        const now = Date.now();
        for (const [id, ts] of seenIdsRef.current) {
          if (now - ts > SEEN_WINDOW_MS) seenIdsRef.current.delete(id);
        }

        const newToNotify: InboundNotification[] = [];
        for (const m of latestMsgs) {
          if (seenIdsRef.current.has(m.id)) continue;
          seenIdsRef.current.set(m.id, now);
          const isCurrentChatOpen =
            (pathname === "/messages" || pathname === "/admin/inbox") &&
            activeLeadIdRef.current === m.leadId;
          if (isCurrentChatOpen) continue;
          newToNotify.push(m);
        }

        saveSeenIds(seenIdsRef.current);
        if (newToNotify.length > 0) fireNotification(newToNotify);
      } catch {
        // Silent
      }
    };

    poll();
    const interval = setInterval(poll, 4000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [pathname, fireNotification]);

  // Auto-dismiss last notification after 8 seconds, pauses on hover
  useEffect(() => {
    if (notifications.length === 0 || isHovered) return;
    const timer = setTimeout(() => {
      setNotifications((prev) => prev.slice(0, prev.length - 1));
    }, 8000);
    return () => clearTimeout(timer);
  }, [notifications, isHovered]);

  const dismissNotification = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div 
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none max-w-[360px] w-full px-3 sm:px-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {notifications.map((n) => {
        const initials = getInitials(n.leadName);
        const isHot = (n.scoreTier || "").toLowerCase() === "hot";

        return (
          <div
            key={n.id}
            onClick={() => handleOpenConversation(n.leadId, n.id)}
            className="pointer-events-auto group relative overflow-hidden rounded-xl bg-[#0d0d12]/95 backdrop-blur-xl border border-white/10 hover:border-white/20 shadow-[0_12px_32px_rgba(0,0,0,0.7)] p-3 transition-all duration-200 hover:bg-[#13131a] cursor-pointer animate-in slide-in-from-right-6 fade-in"
          >
            <div className="flex items-center gap-3">
              {/* Sleek Minimal Avatar */}
              <div className="relative shrink-0">
                <div className="size-9 rounded-full bg-zinc-800/90 border border-white/10 flex items-center justify-center text-xs font-mono font-medium text-zinc-200">
                  {n.isMuteNotice ? "AI" : initials}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-[#0d0d12] ${
                    n.isMuteNotice ? "bg-amber-400" : "bg-emerald-500"
                  }`}
                />
              </div>

              {/* Sender & Snippet */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                  <span className="text-[13px] font-medium text-white truncate group-hover:text-zinc-100">
                    {n.leadName}
                  </span>
                  {n.isMuteNotice ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/25 shrink-0">
                      AI OFF
                    </span>
                  ) : isHot ? (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-rose-500/15 text-rose-300 border border-rose-500/25 shrink-0">
                      HOT
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium uppercase bg-zinc-800 text-zinc-400 border border-zinc-700/50 shrink-0">
                      NEW
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-zinc-400 truncate leading-snug font-sans">
                  {cleanMessageContent(n.content)}
                </p>
              </div>

              {/* Minimal Arrow Action & Close */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="size-6 rounded-md flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-colors">
                  <ArrowUpRight className="size-3.5 stroke-[2]" />
                </div>
                <button
                  type="button"
                  onClick={(e) => dismissNotification(n.id, e)}
                  aria-label="Dismiss notification"
                  className="size-6 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Slim 1.5px Neutral Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white/5 overflow-hidden">
              <div
                className={`h-full ${n.isMuteNotice ? "bg-amber-500/70" : "bg-emerald-500/70"}`}
                style={{
                  animation: "shrinkProgress 8s linear forwards",
                  animationPlayState: isHovered ? "paused" : "running",
                }}
              />
            </div>
          </div>
        );
      })}

      <style>{`
        @keyframes shrinkProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
