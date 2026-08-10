import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import { getPortalData, sendPortalMessage } from "@/lib/portal";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Home, User, Sparkles } from "lucide-react";

export const Route = createFileRoute("/portal/$token")({
  loader: ({ params }) => getPortalData({ data: { token: params.token } }),
  head: () => ({ meta: [{ title: "Client Portal" }] }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const { lead, builder, messages } = useLoaderData({ from: "/portal/$token" });
  const router = useRouter();
  
  const [newMessageText, setNewMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Polling for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      router.invalidate();
    }, 5000);
    return () => clearInterval(interval);
  }, [router]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendPortalMessage({
        data: {
          token: Route.useParams().token,
          content: newMessageText,
        }
      });
      setNewMessageText("");
      // Force refresh data
      router.invalidate();
    } catch (error) {
      console.error("Failed to send message:", error);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050608] text-white font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#0a0a0c] border-b border-white/5 z-20 shrink-0">
        <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
          <Home className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">{builder?.companyName || "Builder Portal"}</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            Client: {lead.name}
          </p>
        </div>
      </header>

      {/* CHAT FEED AREA */}
      <div className="flex-1 overflow-y-auto relative p-4 scroll-smooth">
        {/* WhatsApp-Style Doodle Background (Shared from dashboard) */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen z-0">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="portal-doodle" width="240" height="240" patternUnits="userSpaceOnUse">
                <g stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                  <g transform="translate(14,22) rotate(-31) scale(0.58)"><path d="M3 10 L9 4 L15 10 V16 H12 V11 H6 V16 H3 Z"/></g>
                  <g transform="translate(71,9) rotate(63) scale(0.71)"><path d="M5 2 H13 V16 H5 Z M7 5 H9 M11 5 H11.1 M7 8 H9 M11 8 H11.1"/></g>
                  <g transform="translate(133,31) rotate(-12) scale(0.49)"><path d="M3 16 V2 H14 M6 2 V16 M3 6 H11 M3 10 H11 M14 2 V9 L11 12"/></g>
                </g>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#portal-doodle)" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col gap-4 max-w-2xl mx-auto pb-4">
          
          <div className="text-center py-4">
            <span className="inline-flex bg-[#111111] px-3 py-1 rounded-full text-[10px] text-muted-foreground border border-white/5 shadow-sm">
              This is the start of your conversation with {builder?.companyName || "the builder"}.
            </span>
          </div>

          {messages.map((msg) => {
            const isLead = msg.sender === 'lead';
            
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isLead ? "items-end" : "items-start"} w-full group animate-in slide-in-from-bottom-2 duration-150`}
              >
                <div
                  className={`relative p-3 rounded-2xl text-[13px] leading-relaxed max-w-[85%] font-sans select-text shadow-xl ${isLead
                    ? "bg-[#25D366] text-black rounded-tr-none font-medium opacity-100"
                    : "bg-[#151720] border border-white/10 text-white rounded-tl-none opacity-100"
                    }`}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>
                </div>

                <span className="text-[10px] text-muted-foreground/60 mt-1 select-none font-mono px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* MESSAGE COMPOSER */}
      <div className="p-3 bg-[#0a0a0c] border-t border-white/5 shrink-0 z-20 pb-safe">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSendMessage} className="relative flex items-center">
            <input
              type="text"
              required
              disabled={isSending}
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              placeholder="Type your message..."
              className="w-full bg-[#111] border border-white/10 focus:border-primary/50 transition-all rounded-full pl-5 pr-12 py-3 text-sm text-white placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 leading-relaxed disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSending || !newMessageText.trim()}
              className="absolute right-2 p-2 bg-primary rounded-full text-black hover:bg-primary/95 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center cursor-pointer"
            >
              {isSending ? (
                <Loader2 className="size-4 animate-spin text-black" />
              ) : (
                <Send className="size-4 text-black ml-0.5" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
