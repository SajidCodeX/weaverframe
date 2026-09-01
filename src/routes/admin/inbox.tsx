import { createFileRoute, useLoaderData, useRouter, redirect } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { RoutePending } from "@/components/dashboard/RoutePending";
import {
  getAdminConversations,
  getAdminMessagesForLead,
  sendAdminMessage,
  createAdminConversation,
} from "@/lib/admin";
import {
  Search,
  Send,
  User,
  Clock,
  Loader2,
  ChevronRight,
  MessageSquare,
  Plus,
  RefreshCw,
  Mail,
  Phone,
  Building2,
  ShieldCheck,
  X,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/inbox")({
  beforeLoad: ({ context }) => {
    const session = context.session as any;
    if (!session || session.role !== 'admin') {
      throw redirect({ to: '/' });
    }
  },
  loader: () => {
    if (typeof window === 'undefined') return { conversations: [] };
    return getAdminConversations().then(c => ({ conversations: c || [] }));
  },
  staleTime: 30_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading HQ Inbox..." type="messages" />,
  component: AdminInboxPage,
});

function AdminInboxPage() {
  const router = useRouter();
  const { conversations: initialConversations } = useLoaderData({ from: "/admin/inbox" }) as any;
  const [conversations, setConversations] = useState<any[]>(initialConversations || []);
  
  useEffect(() => {
    if (initialConversations && Array.isArray(initialConversations)) {
      setConversations(initialConversations);
    }
  }, [initialConversations]);

  // Active chat state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(() => {
    return initialConversations && initialConversations.length > 0 ? initialConversations[0].leadId : null;
  });
  const [activeChat, setActiveChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");

  // New Conversation Modal State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientCompany, setNewClientCompany] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientInitialMsg, setNewClientInitialMsg] = useState("");
  const [isCreatingConv, setIsCreatingConv] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll conversations every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      router.invalidate();
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);

  // Load chat when selected
  useEffect(() => {
    if (!selectedLeadId) {
      setActiveChat(null);
      setMessages([]);
      return;
    }

    let isMounted = true;
    setIsLoadingChat(true);

    getAdminMessagesForLead({ data: { leadId: selectedLeadId } })
      .then((data) => {
        if (!isMounted) return;
        setActiveChat(data.lead);
        setMessages(data.messages);
        
        // Mark as read in local state
        setConversations(prev => 
          prev.map(c => c.leadId === selectedLeadId ? { ...c, unreadCount: 0 } : c)
        );
        router.invalidate();
      })
      .catch((err) => {
        if (!isMounted) return;
        toast.error("Failed to load conversation");
        console.error(err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingChat(false);
      });

    return () => { isMounted = false; };
  }, [selectedLeadId]);

  // Scroll to bottom of message thread
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeChat || isSending) return;

    const content = inputMessage.trim();
    setInputMessage("");
    setIsSending(true);

    // Optimistic update
    const optimisticMsg = {
      id: "temp-" + Date.now(),
      sender: "user",
      content,
      createdAt: new Date().toISOString(),
      isRead: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      const res = await sendAdminMessage({ data: { leadId: activeChat.id, content } });
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? res.userMessage : m));
      
      // Update thread list with latest message
      setConversations(prev => prev.map(c => {
        if (c.leadId === activeChat.id) {
          return {
            ...c,
            lastMessage: content,
            lastMessageTime: res.userMessage.createdAt
          };
        }
        return c;
      }).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()));

      router.invalidate();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      // Revert optimistic message
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setInputMessage(content);
    } finally {
      setIsSending(false);
    }
  };

  // Create New Conversation
  const handleCreateNewConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || isCreatingConv) return;

    setIsCreatingConv(true);
    try {
      const res = await createAdminConversation({
        data: {
          name: newClientName.trim(),
          company: newClientCompany.trim() || undefined,
          email: newClientEmail.trim() || undefined,
          phone: newClientPhone.trim() || undefined,
          initialMessage: newClientInitialMsg.trim() || undefined,
        }
      });

      toast.success("New conversation initiated");
      setIsNewModalOpen(false);
      setNewClientName("");
      setNewClientCompany("");
      setNewClientEmail("");
      setNewClientPhone("");
      setNewClientInitialMsg("");
      
      await router.invalidate();
      setSelectedLeadId(res.leadId);
    } catch (err: any) {
      toast.error(err.message || "Failed to create conversation");
    } finally {
      setIsCreatingConv(false);
    }
  };

  // Filter threads
  const filteredConversations = useMemo(() => {
    let list = conversations || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c =>
        c.leadName.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
      );
    }
    if (activeTab === "unread") {
      list = list.filter(c => c.unreadCount > 0);
    }
    return list;
  }, [conversations, searchQuery, activeTab]);

  return (
    <Shell title="Super Admin Inbox" noPadding>
      <div className="flex h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-[#060608]">
        
        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN: HQ INBOX THREADS
            ════════════════════════════════════════════════════════════════ */}
        <div className="w-80 lg:w-96 border-r border-border/80 flex flex-col h-full min-h-0 bg-[#080808]/95 shrink-0 relative">
          
          {/* Header */}
          <div className="p-3.5 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground tracking-tight flex items-center gap-1.5">
                <Mail className="size-3.5 text-[#e5d9c5]" />
                <span>HQ Inbox</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={async () => {
                    if (isManualSyncing) return;
                    setIsManualSyncing(true);
                    try {
                      await router.invalidate();
                      toast.success("Inbox synchronized");
                    } finally {
                      setTimeout(() => setIsManualSyncing(false), 600);
                    }
                  }}
                  disabled={isManualSyncing}
                  className="size-7 rounded-md bg-secondary/80 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer border border-border/50"
                  title="Sync Conversations"
                >
                  <RefreshCw className={`size-3 transition-transform duration-300 ${isManualSyncing ? "animate-spin text-[#e5d9c5]" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#e5d9c5]/10 hover:bg-[#e5d9c5]/20 text-[#e5d9c5] border border-[#e5d9c5]/25 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="size-3" />
                  <span>New Message</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[#e5d9c5] placeholder:text-muted-foreground transition-colors font-mono"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-0.5 bg-secondary/60 rounded-lg">
              {(["all", "unread"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[10.5px] font-medium capitalize rounded-md transition-all cursor-pointer ${
                    activeTab === tab
                      ? "bg-card text-[#e5d9c5] shadow-sm font-semibold border border-[#e5d9c5]/30"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "all" ? `All (${conversations.length})` : `Unread (${conversations.filter(c => c.unreadCount > 0).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40 custom-scrollbar">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => {
                const isActive = c.leadId === selectedLeadId;
                const initials = (c.leadName || "C")
                  .split(" ")
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "C";

                return (
                  <button
                    key={c.leadId}
                    onClick={() => setSelectedLeadId(c.leadId)}
                    className={`w-full text-left p-3.5 flex gap-3 transition-colors hover:bg-secondary/40 select-none outline-none focus:bg-secondary/40 relative cursor-pointer ${
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#e5d9c5] animate-in fade-in duration-100" />
                    )}

                    <div className="relative shrink-0">
                      <div className={`size-9 rounded-full flex items-center justify-center text-xs font-semibold border ${
                        c.unreadCount > 0 
                          ? "bg-[#e5d9c5] text-black font-bold border-[#e5d9c5]" 
                          : "bg-[#e5d9c5]/10 border-[#e5d9c5]/20 text-[#e5d9c5]"
                      }`}>
                        {initials}
                      </div>
                      {c.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${c.unreadCount > 0 ? "font-bold text-white tracking-tight" : "font-normal text-foreground/90"}`}>
                          {c.leadName}
                        </span>
                        <span className={`text-[10px] font-mono shrink-0 select-none ${c.unreadCount > 0 ? "text-[#e5d9c5] font-semibold" : "text-muted-foreground"}`}>
                          {new Date(c.lastMessageTime).toLocaleDateString([], { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {c.county && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-white/5 text-slate-300 border border-white/10 truncate max-w-[140px]">
                            {c.county}
                          </span>
                        )}
                        {c.scoreTier && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {c.scoreTier}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-[11px] truncate leading-relaxed flex-1 ${c.unreadCount > 0 ? "font-semibold text-white/90" : "text-muted-foreground"}`}>
                          {c.lastMessage}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="shrink-0 px-1.5 py-0.2 bg-[#e5d9c5] text-black text-[8.5px] font-mono font-bold rounded-full select-none">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground font-mono space-y-2">
                <p>No active conversations found.</p>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(true)}
                  className="px-3 py-1.5 bg-[#e5d9c5] text-black text-[11px] font-semibold rounded-lg hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                  <Plus className="size-3" />
                  <span>Start New Conversation</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN: ACTIVE CHAT & DIRECT MESSAGING
            ════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 bg-card/20 relative overflow-hidden">
          {!selectedLeadId ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground font-mono text-xs">
              <MessageSquare className="size-12 mb-3 opacity-20 text-[#e5d9c5]" />
              <p className="text-sm font-semibold text-foreground">WeaverFrame HQ Inbox</p>
              <p className="mt-1 text-muted-foreground">Select a conversation or start a new message to begin communicating</p>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="mt-4 px-4 py-2 bg-[#e5d9c5] text-black text-xs font-semibold rounded-xl hover:bg-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-md"
              >
                <Plus className="size-3.5" />
                <span>New Conversation</span>
              </button>
            </div>
          ) : isLoadingChat ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-[#e5d9c5]" />
            </div>
          ) : activeChat ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              
              {/* Active Conversation Top Bar */}
              <div className="px-5 py-3.5 bg-[#0a0b0f] border-b border-border/80 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-full bg-[#e5d9c5]/10 border border-[#e5d9c5]/25 flex items-center justify-center text-[#e5d9c5] text-xs font-bold shrink-0">
                    {activeChat.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
                      <span>{activeChat.name}</span>
                      {activeChat.county && (
                        <span className="text-[10px] font-normal px-2 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground font-mono">
                          {activeChat.county}
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground mt-0.5">
                      {activeChat.email && (
                        <a href={`mailto:${activeChat.email}`} className="hover:text-[#e5d9c5] transition-colors truncate">
                          {activeChat.email}
                        </a>
                      )}
                      {activeChat.phone && (
                        <a href={`tel:${activeChat.phone}`} className="hover:text-[#e5d9c5] transition-colors">
                          {activeChat.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <ShieldCheck className="size-3.5" />
                    <span>Direct Human Dispatch</span>
                  </span>
                </div>
              </div>

              {/* Messages Thread Body */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-xs text-muted-foreground font-mono">
                    No messages in this thread yet. Send a message below to start conversation.
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isUser = msg.sender === 'user';
                    return (
                      <div key={msg.id || i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] sm:max-w-[70%] rounded-2xl p-4 shadow-sm ${
                          isUser 
                            ? 'bg-[#e5d9c5] text-black rounded-tr-sm' 
                            : 'bg-[#12131a] text-foreground border border-white/10 rounded-tl-sm'
                        }`}>
                          <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed select-text font-sans">
                            {msg.content}
                          </p>
                          <div className={`text-[9px] mt-2 flex items-center justify-end gap-1 font-mono ${
                            isUser ? 'text-black/60' : 'text-muted-foreground'
                          }`}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isUser && <CheckCheck className="size-3 opacity-70" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Message Composer */}
              <div className="p-4 border-t border-border/80 bg-[#08090d]">
                <form onSubmit={handleSendMessage} className="space-y-2">
                  <div className="relative">
                    <textarea
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder={`Reply to ${activeChat.name}... (Press Enter to dispatch)`}
                      className="w-full bg-secondary/70 border border-border rounded-xl pl-4 pr-14 py-3 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#e5d9c5] resize-none min-h-[54px] max-h-32 leading-relaxed"
                      rows={2}
                    />
                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isSending}
                      className="absolute right-2.5 bottom-2.5 size-8 rounded-lg bg-[#e5d9c5] text-black flex items-center justify-center disabled:opacity-40 hover:bg-white transition-colors cursor-pointer"
                    >
                      {isSending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5 ml-0.5" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground px-1">
                    <span>Direct dispatch from <strong>advisory@weaverframe.com</strong></span>
                    <span>100% Human-Operated · Zero AI</span>
                  </div>
                </form>
              </div>

            </div>
          ) : null}
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════
          START NEW CONVERSATION MODAL
          ════════════════════════════════════════════════════════════════ */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#0a0a0d] border border-border rounded-2xl p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setIsNewModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-[#e5d9c5]/10 border border-[#e5d9c5]/25 flex items-center justify-center text-[#e5d9c5]">
                <MessageSquare className="size-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground">Initiate Direct Client Conversation</h3>
                <span className="text-[10px] font-mono text-muted-foreground">WeaverFrame HQ Platform Communication</span>
              </div>
            </div>

            <form onSubmit={handleCreateNewConversation} className="space-y-3.5">
              <div>
                <label className="text-[10.5px] font-mono uppercase text-muted-foreground block mb-1">Client / Prospect Name *</label>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Jonathan Sterling"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5]"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-mono uppercase text-muted-foreground block mb-1">Company / Architectural Firm</label>
                <input
                  type="text"
                  value={newClientCompany}
                  onChange={(e) => setNewClientCompany(e.target.value)}
                  placeholder="e.g. Sterling Architectural Group"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10.5px] font-mono uppercase text-muted-foreground block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                    placeholder="client@firm.com"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5]"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-mono uppercase text-muted-foreground block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-mono uppercase text-muted-foreground block mb-1">Initial Message / Greeting</label>
                <textarea
                  rows={3}
                  value={newClientInitialMsg}
                  onChange={(e) => setNewClientInitialMsg(e.target.value)}
                  placeholder="Hello, following up on your architectural inquiry..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-xs font-mono focus:outline-none focus:border-[#e5d9c5] resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingConv || !newClientName.trim()}
                  className="px-5 py-2 bg-[#e5d9c5] text-black font-semibold text-xs rounded-lg hover:bg-white transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreatingConv ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                  <span>{isCreatingConv ? "Starting..." : "Start Conversation"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Shell>
  );
}
