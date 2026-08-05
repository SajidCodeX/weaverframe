import { createFileRoute, useLoaderData, useRouter, useRouteContext } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { RoutePending } from "@/components/dashboard/RoutePending";
import { Card, Badge } from "@/components/dashboard/primitives";
import {
  getConversations,
  getMessagesForLead,
  sendMessage,
  bookAppointment,
  getAiToggleMap,
  setLeadAiToggle,
  getIntegrationsStatus,
  summarizeConversation,
  simulateLeadMessage
} from "@/lib/dashboard";
import {
  MessageSquare,
  Send,
  Search,
  Calendar,
  FileText,
  Phone,
  Mail,
  Plus,
  Loader2,
  Check,
  Sparkles,
  Clock,
  AlertCircle,
  X,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  BrainCircuit
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/messages")({
  loader: async ({ context }) => {
    if (typeof window === 'undefined' && !context.session) {
      return { conversations: [], aiToggleMap: {}, integrationsStatus: {} };
    }
    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
    const conversations = await getConversations({ data: { activeRole } });
    const aiToggleMap = await getAiToggleMap();
    const integrationsStatus = await getIntegrationsStatus();
    return { conversations, aiToggleMap, integrationsStatus };
  },
  staleTime: 60_000,
  head: () => ({
    meta: [
      { title: "Messages — WeaverFrame" },
      { name: "description", content: "Direct messages and AI lead nurture workspace." }
    ]
  }),
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading Messages..." type="messages" />,
  component: MessagesPage,
});

function FormattedSummary({ text }: { text: string }) {
  const parseInlineMarkdown = (str: string) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const lines = text.split('\n').filter(l => l.trim().length > 0);

  return (
    <div className="space-y-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const isHeader = (trimmed.startsWith('**') && (trimmed.endsWith(':**') || trimmed.endsWith('**'))) ||
          trimmed.startsWith('📋') || trimmed.startsWith('💰') || trimmed.startsWith('❓') || trimmed.startsWith('🎯') ||
          (trimmed.toUpperCase().includes('PROFILE') && trimmed.includes(':')) ||
          (trimmed.toUpperCase().includes('FINANCIALS') && trimmed.includes(':')) ||
          (trimmed.toUpperCase().includes('CONCERNS') && trimmed.includes(':')) ||
          (trimmed.toUpperCase().includes('ACTION') && trimmed.includes(':'));

        if (isHeader && !trimmed.startsWith('* ') && !trimmed.startsWith('- ') && !trimmed.startsWith('+ ')) {
          const cleanedHeader = trimmed.replace(/\*\*/g, '').replace(/:$/, '');
          let icon = '';
          if (cleanedHeader.includes('PROFILE') || cleanedHeader.includes('SPECS')) icon = '📋 ';
          else if (cleanedHeader.includes('FINANCIALS') || cleanedHeader.includes('BUDGET')) icon = '💰 ';
          else if (cleanedHeader.includes('CONCERNS') || cleanedHeader.includes('OBJECTIONS')) icon = '❓ ';
          else if (cleanedHeader.includes('ACTION') || cleanedHeader.includes('DELIVERABLES')) icon = '🎯 ';

          return (
            <div key={idx} className="pt-2 pb-1 border-b border-white/10 first:pt-0">
              <h5 className="text-[11px] font-bold text-primary tracking-wider uppercase font-display flex items-center gap-1.5">
                <span>{icon}</span> {cleanedHeader.replace(/^[📋💰❓🎯]\s*/, '')}
              </h5>
            </div>
          );
        }

        const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('+ ') || trimmed.startsWith('• ');
        const bulletText = isBullet ? trimmed.replace(/^[\*\-\+\•]\s*/, '') : trimmed;

        return (
          <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 leading-relaxed pl-1">
            {isBullet ? (
              <span className="size-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
            ) : null}
            <div className="flex-1">{parseInlineMarkdown(bulletText)}</div>
          </div>
        );
      })}
    </div>
  );
}

function MessagesPage() {
  const router = useRouter();
  const { conversations: initialConversations, aiToggleMap: initialAiToggleMap, integrationsStatus: initialIntegrationsStatus } = useLoaderData({ from: "/messages" }) as { conversations: any[]; aiToggleMap: Record<string, boolean>; integrationsStatus: any };

  const [conversationsList, setConversationsList] = useState<any[]>(initialConversations || []);

  useEffect(() => {
    if (initialConversations) {
      setConversationsList(initialConversations);
    }
  }, [initialConversations]);

  // Track selected lead & active conversation
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<{ lead: any; messages: any[] } | null>(null);

  const [isLookbookOpen, setIsLookbookOpen] = useState(false);
  const [lookbookPage, setLookbookPage] = useState(0);

  // Portfolio Management
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [editPortfolioName, setEditPortfolioName] = useState("");
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [portfolios, setPortfolios] = useState<{ id: string; name: string; size: string }[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("portfolios");
      return saved ? JSON.parse(saved) : [{ id: "default", name: "Your Company Custom Specifications and Premium Design Portfolio", size: "4.8 MB" }];
    }
    return [];
  });
  const [newPortfolioName, setNewPortfolioName] = useState("");

  const savePortfolios = (newPorts: any[]) => {
    setPortfolios(newPorts);
    localStorage.setItem("portfolios", JSON.stringify(newPorts));
  };

  const isGCalConnected = initialIntegrationsStatus?.google?.isConnected ?? false;

  // Drag resizable split panel state
  const [leftWidth, setLeftWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("messages-split-width");
      return saved ? parseInt(saved, 10) : 340;
    }
    return 340;
  });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      // Clamp between 260px and 600px
      const clampedWidth = Math.max(260, Math.min(600, newWidth));
      setLeftWidth(clampedWidth);
      localStorage.setItem("messages-split-width", String(clampedWidth));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Search and filter tab states
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "hot">("all");

  // Loading and sending UI states
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const loadedLeadIdRef = useRef<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");

  // Input focus ref
  const inputRef = useRef<HTMLInputElement>(null);

  // Quick schedule modal states
  const [isSchedulingOpen, setIsSchedulingOpen] = useState(false);
  const [apptType, setApptType] = useState("Site visit");
  const [apptDateTime, setApptDateTime] = useState("");
  const [apptLocation, setApptLocation] = useState("Lakeway Model Home");
  const [apptNotes, setApptNotes] = useState("");
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [aiToggleMap, setAiToggleMap] = useState<Record<string, boolean>>(initialAiToggleMap || {});
  const isAiActive = selectedLeadId ? (aiToggleMap[selectedLeadId] ?? true) : true;

  // Summarize feature
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [chatSummary, setChatSummary] = useState<string | null>(null);

  // Simulation feature states
  const [isSimulateOpen, setIsSimulateOpen] = useState(false);
  const [simulateMessageText, setSimulateMessageText] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const { session } = useRouteContext({ strict: false }) as any;
  const canSimulate = session?.role === 'admin' || session?.builderRole === 'owner' || session?.builderRole === 'admin';

  // Custom dropdown states
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const dropdownOptions = [
    { value: "Site visit", label: "📐 Site walkthrough & Lot survey" },
    { value: "Phone call", label: "📞 Architectural draft check call" },
    { value: "Follow-up", label: "☕ Design studio consultation" },
  ];

  // Keep scroll container pinned to bottom
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // User Scroll Locking (Prevents polling from auto-scrolling while reading history)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const isUserScrolledUpRef = useRef(false);

  const handleChatScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 80;
    setIsUserScrolledUp(isFarFromBottom);
    isUserScrolledUpRef.current = isFarFromBottom;
    if (!isFarFromBottom) {
      setNewMessagesCount(0);
    }
  };

  // Scroll active chat feed to bottom (respects user scroll position unless forced)
  const scrollToBottom = (force = false, mode: ScrollBehavior = "smooth") => {
    if (!force && isUserScrolledUpRef.current) return;
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: mode,
      });
      if (mode === "instant" || mode === "auto") {
        requestAnimationFrame(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        });
      }
    }
    setIsUserScrolledUp(false);
    isUserScrolledUpRef.current = false;
    setNewMessagesCount(0);
  };

  // Auto-select the first conversation on initial load if none selected
  useEffect(() => {
    if (conversationsList.length > 0 && !selectedLeadId) {
      setSelectedLeadId(conversationsList[0].leadId);
      setIsLoadingChat(true);
    }
  }, [conversationsList, selectedLeadId]);

  const conversationsListRef = useRef(conversationsList);
  useEffect(() => {
    conversationsListRef.current = conversationsList;
  }, [conversationsList]);

  // Fetch messages ONLY when selected lead changes
  useEffect(() => {
    if (!selectedLeadId) {
      setActiveChat(null);
      loadedLeadIdRef.current = null;
      return;
    }
    let isMounted = true;
    const fetchChat = async () => {
      const activeRole = sessionStorage.getItem('active_role') ?? undefined;
      const cachedMessages = (window as any)._messagesCache?.get(selectedLeadId);
      const isNewLeadSelected = loadedLeadIdRef.current !== selectedLeadId;

      if (isNewLeadSelected) {
        if (cachedMessages) {
          // Instant load from cache
          const lead = conversationsListRef.current.find(c => c.leadId === selectedLeadId);
          setActiveChat({ lead, messages: cachedMessages });
          setIsLoadingChat(false);
        } else {
          setIsLoadingChat(true);
        }
        setChatSummary(null); // Reset summary when lead changes
      }

      try {
        const lead = conversationsListRef.current.find(c => c.leadId === selectedLeadId);
        const { messages } = await getMessagesForLead({ data: { leadId: selectedLeadId, activeRole } });

        // Update cache
        if (!(window as any)._messagesCache) {
          (window as any)._messagesCache = new Map();
        }
        (window as any)._messagesCache.set(selectedLeadId, messages);

        if (isMounted) {
          setActiveChat({ lead, messages });
          if (isNewLeadSelected) {
            loadedLeadIdRef.current = selectedLeadId;
            setIsLoadingChat(false);
            // Position at bottom ONLY when switching to a NEW lead
            setIsUserScrolledUp(false);
            isUserScrolledUpRef.current = false;
            setNewMessagesCount(0);
            setTimeout(() => scrollToBottom(true, "instant"), 30);
          }
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setIsLoadingChat(false);
        }
      }
    };
    fetchChat();
    return () => { isMounted = false; };
  }, [selectedLeadId]);

  // Real-time Live WhatsApp Polling: Refresh active chat & thread list every 2.5s
  useEffect(() => {
    let isMounted = true;
    const pollLiveChat = async () => {
      try {
        const activeRole = sessionStorage.getItem('active_role') ?? undefined;
        // 1. Silently update thread list
        const latestThreads = await getConversations({ data: { activeRole } });
        if (isMounted && Array.isArray(latestThreads) && latestThreads.length > 0) {
          setConversationsList(latestThreads);
        }

        // 2. Silently update messages for active selected lead
        if (selectedLeadId) {
          const { messages: latestMsgs } = await getMessagesForLead({ data: { leadId: selectedLeadId, activeRole } });
          if (isMounted && Array.isArray(latestMsgs)) {
            if ((window as any)._messagesCache) {
              (window as any)._messagesCache.set(selectedLeadId, latestMsgs);
            }
            setActiveChat(prev => {
              if (!prev) return null;
              const lead = latestThreads.find(c => c.leadId === selectedLeadId) || prev.lead;
              const diffCount = latestMsgs.length - prev.messages.length;
              const hasNewMessages = diffCount > 0 ||
                (latestMsgs.length > 0 && prev.messages[prev.messages.length - 1]?.id !== latestMsgs[latestMsgs.length - 1]?.id);

              if (hasNewMessages) {
                if (isUserScrolledUpRef.current) {
                  // WhatsApp behavior: Do NOT auto-scroll when user is reading history! Show unread badge.
                  setNewMessagesCount(c => c + Math.max(1, diffCount));
                } else {
                  // User is already at the bottom — scroll down to show new message
                  setTimeout(() => scrollToBottom(true, "smooth"), 60);
                }
                return { lead, messages: latestMsgs };
              }
              return { ...prev, lead };
            });
          }
        }
      } catch (_) {
        // Silent catch for background poll
      }
    };

    const timer = setInterval(pollLiveChat, 2500);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [selectedLeadId]);

  // Click outside to close custom dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle global Escape key to blur inputs and close scheduling overlays
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isDropdownOpen) {
          setIsDropdownOpen(false);
          return;
        }
        setIsPortfolioModalOpen(false);
        setIsSchedulingOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDropdownOpen]);

  // Keyboard navigation for custom dropdown
  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsDropdownOpen(true);
        const currentIndex = dropdownOptions.findIndex(o => o.value === apptType);
        setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % dropdownOptions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + dropdownOptions.length) % dropdownOptions.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setApptType(dropdownOptions[highlightedIndex].value);
      setIsDropdownOpen(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setIsDropdownOpen(false);
    }
  };

  // Filter conversations
  const filteredThreads = useMemo(() => {
    let threads = conversationsList;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      threads = threads.filter(t =>
        (t.leadName && t.leadName.toLowerCase().includes(q)) ||
        (t.lastMessage && t.lastMessage.toLowerCase().includes(q))
      );
    }
    if (activeTab === "unread") return threads.filter(t => t.unreadCount > 0 && t.leadId !== selectedLeadId);
    if (activeTab === "hot") return threads.filter(t => t.scoreTier === "Hot");
    return threads;
  }, [conversationsList, searchQuery, activeTab, selectedLeadId]);

  // Handle sending text message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedLeadId || !newMessageText.trim() || isSending) return;

    setIsSending(true);
    const originalText = newMessageText;
    setNewMessageText("");

    try {
      const res = await sendMessage({
        data: {
          leadId: selectedLeadId,
          content: originalText
        }
      });

      // Update state optimistically with the user message
      setActiveChat(prev => {
        if (!prev) return null;
        const updatedMsgs = [
          ...prev.messages,
          {
            id: res.userMessage.id,
            sender: "user" as const,
            content: res.userMessage.content,
            createdAt: new Date().toISOString(),
            isRead: true
          }
        ];

        if ((window as any)._messagesCache) {
          (window as any)._messagesCache.set(selectedLeadId, updatedMsgs);
        }

        return {
          ...prev,
          messages: updatedMsgs
        };
      });

      await router.invalidate();
    } catch (err) {
      console.error("Failed to send message:", err);
      setNewMessageText(originalText);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 60);
    }
  };

  // Helper suggestion tag clicking action
  const handleSuggestionClick = (text: string) => {
    setNewMessageText(text);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Action: Share Custom digital specs brochure PDF card
  const handleShareBrochure = async (portfolioName: string, portfolioSize: string) => {
    if (!selectedLeadId || isSending) return;
    setIsSending(true);
    try {
      const brochureContent = `📄 Document Shared: ${portfolioName}.pdf|size=${portfolioSize}`;
      const res = await sendMessage({
        data: {
          leadId: selectedLeadId,
          content: brochureContent
        }
      });

      setActiveChat(prev => {
        if (!prev) return null;
        const userMsg = (res as any).userMessage || res;
        const updatedMsgs = [
          ...prev.messages,
          {
            id: userMsg.id || String(Date.now()),
            sender: "user" as const,
            content: userMsg.content || brochureContent,
            createdAt: new Date().toISOString(),
            isRead: true
          }
        ];
        return {
          ...prev,
          messages: updatedMsgs
        };
      });

      await router.invalidate();
    } catch (err) {
      console.error("Failed to share brochure:", err);
    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 60);
    }
  };

  // Action: Inline booking schedule dispatch
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !apptDateTime) return;

    setIsBooking(true);
    try {
      // 1. Book appointment in database
      const appt = await bookAppointment({
        data: {
          leadId: selectedLeadId,
          type: apptType,
          dateTime: apptDateTime,
          location: apptLocation,
          notes: apptNotes || "Booked directly via Live Chat Direct Channel.",
          sendSms: true
        }
      });

      const formattedTime = new Date(apptDateTime).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      });

      // 2. Post a high-fidelity calendar booking card as a message
      const calendarMessage = `📆 Site Visit Booked: ${apptType} scheduled at ${apptLocation} on ${formattedTime}`;
      const res = await sendMessage({
        data: {
          leadId: selectedLeadId,
          content: calendarMessage
        }
      });

      setActiveChat(prev => {
        if (!prev) return null;
        const userMsg = (res as any).userMessage || res;
        const updatedMsgs = [
          ...prev.messages,
          {
            id: userMsg.id || String(Date.now()),
            sender: "user" as const,
            content: userMsg.content || calendarMessage,
            createdAt: new Date().toISOString(),
            isRead: true
          }
        ];
        return {
          ...prev,
          messages: updatedMsgs
        };
      });

      setBookingSuccess(true);
      setTimeout(() => {
        setBookingSuccess(false);
        setIsSchedulingOpen(false);
        // Clear booking inputs
        setApptDateTime("");
        setApptNotes("");
      }, 2000);

      await router.invalidate();
    } catch (err) {
      console.error("Failed to book appointment from chat:", err);
    } finally {
      setIsBooking(false);
      setTimeout(scrollToBottom, 60);
    }
  };

  const handleSummarizeChat = async () => {
    if (!selectedLeadId || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const summary = await summarizeConversation({ data: { leadId: selectedLeadId } });
      setChatSummary(summary);
    } catch (err) {
      console.error("Failed to summarize chat", err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSimulateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !simulateMessageText.trim()) return;

    setIsSimulating(true);
    try {
      await simulateLeadMessage({
        data: {
          leadId: selectedLeadId,
          content: simulateMessageText,
          enableAiReply: isAiActive
        }
      });
      setIsSimulateOpen(false);
      setSimulateMessageText("");
      await router.invalidate();
    } catch (err) {
      console.error("Failed to simulate message:", err);
      toast.error("Failed to simulate lead message.");
    } finally {
      setIsSimulating(false);
    }
  };

  // Formats relative time snippets (e.g. "Just now", "2m ago")
  const formatMsgTime = (isoString: string) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now.getTime() - past.getTime();
      const diffMin = Math.round(diffMs / 60000);
      const diffHr = Math.round(diffMs / 3600000);

      if (diffMin < 1) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      return past.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const selectedThread = useMemo(() => {
    return conversationsList.find(c => c.leadId === selectedLeadId) || null;
  }, [conversationsList, selectedLeadId]);

  return (
    <Shell title="Direct Lead Messages" noPadding>
      <div ref={containerRef} className="flex h-full w-full bg-card/40 backdrop-blur-xl relative">

        {/* LEFT COLUMN: Search & Thread List */}
        <div
          style={{ width: `${leftWidth}px` }}
          className="border-r border-border flex flex-col h-full min-h-0 bg-[#080808]/90 shrink-0"
        >

          {/* Thread Search Box */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border border-border rounded-md pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground transition-colors"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 p-0.5 bg-secondary/60 rounded-lg">
              {(["all", "unread", "hot"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[11px] font-medium capitalize rounded-md transition-all ${activeTab === tab
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/40">
            {filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => {
                const isActive = thread.leadId === selectedLeadId;
                const initials = (thread.leadName || "Lead")
                  .split(" ")
                  .filter(Boolean)
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "L";

                return (
                  <button
                    key={thread.leadId}
                    onClick={() => {
                      setSelectedLeadId(thread.leadId);
                      setActiveChat(null);
                      setIsLoadingChat(true);
                    }}
                    className={`w-full text-left p-4 flex gap-3 transition-colors hover:bg-secondary/40 select-none outline-none focus:bg-secondary/40 relative ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                      }`}
                  >
                    {/* Left border active bar */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary animate-in fade-in duration-100" />
                    )}

                    {/* Avatar Container */}
                    <div className="relative shrink-0">
                      <div className={`size-10 rounded-full flex items-center justify-center text-xs font-semibold tracking-tighter border transition-all ${isActive
                        ? "bg-primary/10 border-primary/20 text-white"
                        : "bg-white/[0.02] border-white/[0.05] text-muted-foreground"
                        }`}>
                        {initials}
                      </div>

                      {/* Online Status Dot */}
                      {thread.isOnline && (
                        <div className="absolute bottom-0 right-0 size-2.5 rounded-full bg-success ring-2 ring-[#080808]" />
                      )}
                    </div>

                    {/* Thread Info Column */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {thread.leadName}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0 select-none">
                          {formatMsgTime(thread.lastMessageTime)}
                        </span>
                      </div>

                      {/* Score Badge (Vivid styling, no emojis per rules) */}
                      <div className="flex items-center gap-1.5">
                        {thread.scoreTier === "Hot" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            Hot Tier
                          </span>
                        )}
                        {thread.scoreTier === "Warm" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-warning/10 text-warning border border-warning/20">
                            Warm Tier
                          </span>
                        )}
                        {thread.scoreTier === "Cold" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase bg-cold/10 text-cold border border-cold/20">
                            Cold Tier
                          </span>
                        )}
                        <span className="text-[9px] uppercase font-mono tracking-widest text-muted-foreground/60 select-none">
                          · {thread.status}
                        </span>
                      </div>

                      {/* Last Message Preview & WhatsApp-style Unread Badge Container */}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground truncate leading-relaxed flex-1">
                          {thread.lastMessage}
                        </p>
                        {!isActive && thread.unreadCount > 0 && (
                          <span className="shrink-0 size-5 bg-[#30D158] text-black text-[10px] font-black flex items-center justify-center rounded-full shadow-md select-none animate-in scale-in duration-150">
                            {thread.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No active threads found.
              </div>
            )}
          </div>
        </div>

        {/* Draggable Divider splitter */}
        <div
          onMouseDown={startDrag}
          className={`w-[4px] hover:w-[6px] cursor-col-resize h-full hover:bg-primary/50 active:bg-primary z-40 shrink-0 relative flex items-center justify-center transition-all duration-100 select-none ${isDragging ? "bg-primary w-[6px]" : "bg-border/40"
            }`}
          title="Drag to resize panels"
        >
          {/* Visual indicator handle */}
          <div className="absolute top-1/2 -translate-y-1/2 w-[2px] h-8 rounded bg-muted-foreground/30 pointer-events-none" />
        </div>

        {/* RIGHT COLUMN: Selected Active Chat Workspace */}
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 bg-card/25 backdrop-blur-md relative overflow-hidden">

          {selectedThread && activeChat ? (
            <>
              {/* CHAT PANEL HEADER */}
              <div className="px-6 py-4 border-b border-border bg-[#0B0B0C]/80 flex items-center justify-between gap-4">

                {/* User Info Card */}
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-primary/5 border border-white/[0.06] flex items-center justify-center font-bold text-xs text-white">
                    {(selectedThread.leadName || "Lead")
                      .split(" ")
                      .filter(Boolean)
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "L"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-foreground tracking-tight flex items-center gap-2">
                      {selectedThread.leadName}
                      <span className={`inline-block size-2 rounded-full ${selectedThread.isOnline ? "bg-success" : "bg-neutral-600"}`} />
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      {selectedThread.isOnline ? (
                        <span className="text-success">Active now</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Lead contacts and fast action links */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    {selectedThread.email && (
                      <a href={`mailto:${selectedThread.email}`} className="p-2 bg-secondary border border-border rounded-md hover:bg-secondary/80 hover:text-white transition-colors" title={selectedThread.email}>
                        <Mail className="size-3.5" />
                      </a>
                    )}
                  </div>

                  <div className="w-px h-6 bg-border" />

                  {/* Header action shortcuts */}
                  <div className="flex items-center gap-2">
                    {/* Premium AI Concierge Pill Toggle */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedLeadId) return;
                        const nextVal = !isAiActive;
                        setAiToggleMap(prev => ({ ...prev, [selectedLeadId]: nextVal }));
                        try {
                          await setLeadAiToggle({ data: { leadId: selectedLeadId, active: nextVal } });
                        } catch (err) {
                          console.error("Failed to persist AI toggle state:", err);
                          setAiToggleMap(prev => ({ ...prev, [selectedLeadId]: isAiActive }));
                        }
                      }}
                      className={`px-3 py-1.5 text-[11px] font-semibold rounded-md border flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${isAiActive
                        ? "bg-white/10 text-success border-success/30 hover:bg-white/15"
                        : "bg-white/[0.02] text-muted-foreground border-white/[0.05] hover:text-white"
                        }`}
                      title={isAiActive ? "Pause AI Concierge Automated replies" : "Activate AI Concierge Automated replies"}
                    >
                      <Sparkles className={`size-3.5 ${isAiActive ? "text-success animate-pulse" : "text-muted-foreground"}`} />
                      {isAiActive ? "AI Concierge: Active" : "AI Concierge: Paused"}
                    </button>

                    <button
                      onClick={() => setIsPortfolioModalOpen(true)}
                      disabled={isSending}
                      className="px-3 py-1.5 bg-secondary text-white text-[11px] font-medium rounded-md border border-border hover:bg-secondary/80 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <FileText className="size-3.5 text-muted-foreground" /> Portfolios
                    </button>

                    <button
                      onClick={handleSummarizeChat}
                      disabled={isSummarizing || !activeChat || activeChat.messages.length === 0}
                      className="px-3 py-1.5 bg-secondary text-primary text-[11px] font-medium rounded-md border border-primary/20 hover:bg-secondary/80 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isSummarizing ? <Loader2 className="size-3.5 animate-spin" /> : <BrainCircuit className="size-3.5" />}
                      Summarize Chat
                    </button>

                    {canSimulate && (
                      <button
                        onClick={() => setIsSimulateOpen(true)}
                        className="px-3 py-1.5 bg-secondary text-primary text-[11px] font-medium rounded-md border border-primary/20 hover:bg-secondary/80 flex items-center gap-1.5 transition-colors"
                      >
                        <MessageSquare className="size-3.5" /> Simulate Reply
                      </button>
                    )}

                    <button
                      onClick={() => setIsSchedulingOpen(true)}
                      className="px-3 py-1.5 bg-white text-black text-[11px] font-semibold rounded-md hover:bg-white/95 flex items-center gap-1.5 transition-colors"
                    >
                      <Calendar className="size-3.5 text-black" /> Schedule Site Visit
                    </button>
                  </div>
                </div>
              </div>

              {/* CONTEXT BAR */}
              <div className="px-6 py-2.5 bg-[#080808]/90 border-b border-border flex items-center justify-between shadow-sm relative z-20">
                <div className="flex items-center gap-5 text-xs font-medium">
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono">Score</span>
                    <span className={`mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${selectedThread.scoreTier === 'Hot' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : selectedThread.scoreTier === 'Warm' ? 'bg-warning/10 text-warning border border-warning/20' : 'bg-cold/10 text-cold border border-cold/20'}`}>{selectedThread.scoreTier}</span>
                  </div>
                  <div className="w-px h-6 bg-border/50" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono">Status</span>
                    <span className="text-foreground mt-1 text-[11px]">{selectedThread.status}</span>
                  </div>
                  <div className="w-px h-6 bg-border/50" />
                  <div className="flex flex-col">
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-mono">Est. Budget</span>
                    <span className="text-foreground mt-1 text-[11px]">${Math.round(selectedThread.estimatedBudget / 1000)}K</span>
                  </div>
                </div>
              </div>

              {/* AI CHAT EXECUTIVE PRE-MEETING BRIEFING SHEET */}
              {chatSummary && (
                <div className="mx-6 mt-4 p-5 rounded-xl bg-[#0f0f14] border border-primary/40 shadow-2xl animate-in fade-in slide-in-from-top-4 relative z-30 shrink-0 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 sticky top-0 bg-[#0f0f14] z-10">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                        <BrainCircuit className="size-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white tracking-wider uppercase font-display">Builder Pre-Meeting Intelligence Briefing</h4>
                        <p className="text-[10px] text-muted-foreground">AI-synthesized deal overview & action checklist</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setChatSummary(null)}
                      className="size-7 rounded-md bg-white/5 hover:bg-white/15 text-muted-foreground hover:text-white flex items-center justify-center transition-colors"
                      title="Close Summary"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <FormattedSummary text={chatSummary} />
                </div>
              )}

              {/* Fixed Viewport Background Layer for WhatsApp Wallpaper */}
              <div className="flex-1 flex flex-col min-h-0 relative bg-[#050608] overflow-hidden">
                {/* Native React SVG WhatsApp Doodle Overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-40">
                  <svg className="w-full h-full text-white" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      {/* LAYER A — base density layer */}
                      <pattern id="doodle-layer-a" width="190" height="190" patternUnits="userSpaceOnUse">
                        <g stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.9">
                          <g transform="translate(14,22) rotate(-31) scale(0.58)"><path d="M3 10 L9 4 L15 10 V16 H12 V11 H6 V16 H3 Z" /></g>
                          <g transform="translate(71,9) rotate(63) scale(0.71)"><path d="M5 2 H13 V16 H5 Z M7 5 H9 M11 5 H11.1 M7 8 H9 M11 8 H11.1" /></g>
                          <g transform="translate(133,31) rotate(-12) scale(0.49)"><path d="M3 16 V2 H14 M6 2 V16 M3 6 H11 M3 10 H11 M14 2 V9 L11 12" /></g>
                          <g transform="translate(196,18) rotate(84) scale(0.66)"><circle cx="5" cy="5" r="3" /><path d="M8 5 H15 V9 H13 V7 H11 V9 H8 Z" /></g>
                          <g transform="translate(29,68) rotate(-58) scale(0.73)"><path d="M3 12 C3 7 6 4 9 4 C12 4 15 7 15 12 H1 V14 H17 V12 Z" /></g>
                          <g transform="translate(88,79) rotate(19) scale(0.55)"><path d="M4 2 H14 V16 H4 Z M4 6 H8 M4 10 H8 M4 14 H8" /></g>
                          <g transform="translate(151,61) rotate(-73) scale(0.62)"><path d="M4 3 H14 V6 H11 V15 H7 V6 H4 Z M4 4 L14 14 M14 4 L4 14" /></g>
                          <g transform="translate(210,88) rotate(41) scale(0.68)"><path d="M9 2 L10.5 7 L16 8.5 L10.5 10 L9 15 L7.5 10 L2 8.5 L7.5 7 Z" /></g>
                          <g transform="translate(9,122) rotate(27) scale(0.6)"><path d="M3 3 H15 C16 3 17 4 17 5 V11 C17 12 16 13 15 13 H10 L5 16 V13 H3 Z" /></g>
                          <g transform="translate(66,135) rotate(-46) scale(0.77)"><path d="M2 13 H12 V9 H8 L5 5 H2 V9 Z M3 15 H15" /></g>
                          <g transform="translate(126,118) rotate(69) scale(0.53)"><path d="M3 4 H15 V16 H3 Z M3 8 H15 M6 2 V5 M12 2 V5" /></g>
                          <g transform="translate(184,140) rotate(-24) scale(0.64)"><path d="M2 10 H10 V5 H14 L17 10 V14 H2 Z" /></g>
                          <g transform="translate(38,178) rotate(52) scale(0.7)"><path d="M9 2 L11 6.5 L16 7 L12 11 L13.5 16 L9 13.5 L4.5 16 L6 11 L2 7 Z" /></g>
                          <g transform="translate(97,191) rotate(-88) scale(0.57)"><path d="M3 10 L9 4 L15 10 V16 H12 V11 H6 V16 H3 Z" /></g>
                          <g transform="translate(159,203) rotate(15) scale(0.61)"><path d="M5 2 H13 V16 H5 Z M7 5 H9 M11 5 H11.1 M7 8 H9 M11 8 H11.1" /></g>
                          <g transform="translate(219,168) rotate(-39) scale(0.72)"><path d="M3 12 C3 7 6 4 9 4 C12 4 15 7 15 12 H1 V14 H17 V12 Z" /></g>
                          <g transform="translate(55,225) rotate(76) scale(0.5)"><path d="M4 2 H14 V16 H4 Z M4 6 H8 M4 10 H8 M4 14 H8" /></g>
                          <g transform="translate(112,215) rotate(-19) scale(0.65)"><path d="M9 2 L10.5 7 L16 8.5 L10.5 10 L9 15 L7.5 10 L2 8.5 L7.5 7 Z" /></g>
                          <g transform="translate(178,228) rotate(33) scale(0.59)"><path d="M3 16 V2 H14 M6 2 V16 M3 6 H11 M3 10 H11 M14 2 V9 L11 12" /></g>
                          <g transform="translate(226,120) rotate(-64) scale(0.63)"><circle cx="5" cy="5" r="3" /><path d="M8 5 H15 V9 H13 V7 H11 V9 H8 Z" /></g>
                        </g>
                      </pattern>

                      {/* LAYER B — different period, breaks alignment with A */}
                      <pattern id="doodle-layer-b" width="137" height="167" patternUnits="userSpaceOnUse" x="61" y="94">
                        <g stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.55">
                          <g transform="translate(20,30) rotate(44) scale(0.52)"><path d="M2 13 H12 V9 H8 L5 5 H2 V9 Z M3 15 H15" /></g>
                          <g transform="translate(90,18) rotate(-71) scale(0.6)"><path d="M3 4 H15 V16 H3 Z M3 8 H15 M6 2 V5 M12 2 V5" /></g>
                          <g transform="translate(148,45) rotate(22) scale(0.68)"><path d="M2 10 H10 V5 H14 L17 10 V14 H2 Z" /></g>
                          <g transform="translate(35,95) rotate(-33) scale(0.57)"><path d="M3 2 H13 V16 H3 Z M6 5 H10 M6 8 H10" /></g>
                          <g transform="translate(105,110) rotate(88) scale(0.63)"><path d="M9 2 L11 6.5 L16 7 L12 11 L13.5 16 L9 13.5 L4.5 16 L6 11 L2 7 Z" /></g>
                          <g transform="translate(155,135) rotate(-9) scale(0.5)"><path d="M3 10 L9 4 L15 10 V16 H12 V11 H6 V16 H3 Z" /></g>
                          <g transform="translate(18,165) rotate(57) scale(0.66)"><path d="M4 3 H14 V6 H11 V15 H7 V6 H4 Z M4 4 L14 14 M14 4 L4 14" /></g>
                          <g transform="translate(80,180) rotate(-48) scale(0.54)"><circle cx="5" cy="5" r="3" /><path d="M8 5 H15 V9 H13 V7 H11 V9 H8 Z" /></g>
                          <g transform="translate(135,190) rotate(30) scale(0.6)"><path d="M3 3 H15 C16 3 17 4 17 5 V11 C17 12 16 13 15 13 H10 L5 16 V13 H3 Z" /></g>
                        </g>
                      </pattern>

                      {/* LAYER C — third, slower period for max irregularity */}
                      <pattern id="doodle-layer-c" width="155" height="124" patternUnits="userSpaceOnUse" x="29" y="118">
                        <g stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.4">
                          <g transform="translate(25,20) rotate(-55) scale(0.55)"><path d="M5 2 H13 V16 H5 Z M7 5 H9 M11 5 H11.1 M7 8 H9 M11 8 H11.1" /></g>
                          <g transform="translate(100,12) rotate(38) scale(0.62)"><path d="M3 16 V2 H14 M6 2 V16 M3 6 H11 M3 10 H11 M14 2 V9 L11 12" /></g>
                          <g transform="translate(160,40) rotate(-18) scale(0.58)"><path d="M4 2 H14 V16 H4 Z M4 6 H8 M4 10 H8 M4 14 H8" /></g>
                          <g transform="translate(40,80) rotate(70) scale(0.64)"><path d="M9 2 L10.5 7 L16 8.5 L10.5 10 L9 15 L7.5 10 L2 8.5 L7.5 7 Z" /></g>
                          <g transform="translate(120,95) rotate(-27) scale(0.5)"><path d="M3 12 C3 7 6 4 9 4 C12 4 15 7 15 12 H1 V14 H17 V12 Z" /></g>
                          <g transform="translate(170,120) rotate(46) scale(0.6)"><path d="M2 13 H12 V9 H8 L5 5 H2 V9 Z M3 15 H15" /></g>
                        </g>
                      </pattern>
                    </defs>

                    {/* Composite fill — all three layers stacked on same rect */}
                    <rect width="100%" height="100%" fill="url(#doodle-layer-a)" />
                    <rect width="100%" height="100%" fill="url(#doodle-layer-b)" />
                    <rect width="100%" height="100%" fill="url(#doodle-layer-c)" />
                  </svg>
                </div>

                {/* Messages Scroll Container - z-10 over fixed wallpaper */}
                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 relative z-10 custom-scrollbar"
                >
                  {activeChat.messages.length > 0 ? (
                    activeChat.messages.map((msg, index) => {
                      const isUser = msg.sender === "user" || msg.sender === "system";
                      const isAI = msg.sender === "system";

                      const msgDate = new Date(msg.createdAt);
                      const prevMsg = index > 0 ? activeChat.messages[index - 1] : null;
                      let showDateDivider = false;
                      let dateLabel = "";

                      if (!prevMsg) {
                        showDateDivider = true;
                      } else {
                        const prevDate = new Date(prevMsg.createdAt);
                        if (msgDate.toDateString() !== prevDate.toDateString()) {
                          showDateDivider = true;
                        }
                      }

                      if (showDateDivider) {
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);

                        if (msgDate.toDateString() === today.toDateString()) {
                          dateLabel = "Today";
                        } else if (msgDate.toDateString() === yesterday.toDateString()) {
                          dateLabel = "Yesterday";
                        } else {
                          dateLabel = msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                        }
                      }

                      // Render high-fidelity custom cards for brochure shares
                      const isBrochureCard = msg.content.includes("📄 Document Shared");
                      // Render high-fidelity custom cards for calendars/appointments
                      const isAppointmentCard = msg.content.includes("📆 Site Visit Booked");

                      return (
                        <div key={msg.id} className="w-full">
                          {showDateDivider && (
                            <div className="flex justify-center my-6">
                              <span className="text-[10px] font-medium text-muted-foreground bg-[#111111] border border-white/10 px-3 py-1 rounded-full uppercase tracking-widest font-mono">
                                {dateLabel}
                              </span>
                            </div>
                          )}
                          <div
                            className={`flex flex-col ${isUser ? "items-end" : "items-start"} w-full group animate-in slide-in-from-bottom-2 duration-150`}
                          >
                            {isBrochureCard ? (
                              /* Digital specs brochure presentation card */
                              <div className="bg-[#111111] border border-white/[0.08] rounded-xl p-4 max-w-[400px] shadow-2xl relative overflow-hidden group/brochure">
                                <div className="flex gap-3">
                                  <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shrink-0 text-primary">
                                    <FileText className="size-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-white truncate">{msg.content.replace("📄 Document Shared: ", "").split(".pdf|size=")[0]}</h4>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">Custom Specifications & Lookbook · {msg.content.includes("|size=") ? msg.content.split("|size=")[1] : "4.8 MB"}</p>
                                  </div>
                                </div>
                                <div className="border-t border-border/50 mt-4 pt-3 flex items-center justify-between">
                                  <span className="text-[9px] text-muted-foreground font-mono">Sent to Lead SMS & Email</span>
                                  <a
                                    href="#"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setIsLookbookOpen(true);
                                      setLookbookPage(0);
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-white hover:underline"
                                  >
                                    Preview lookbook <ExternalLink className="size-3" />
                                  </a>
                                </div>
                              </div>
                            ) : isAppointmentCard ? (
                              /* Premium Calendar Booking Confirmation Card */
                              <div className="bg-success/5 border border-success/30 rounded-xl p-4 max-w-[400px] shadow-2xl relative overflow-hidden">
                                <div className="flex gap-3">
                                  <div className="size-10 bg-success/15 rounded-lg flex items-center justify-center border border-success/30 shrink-0 text-success">
                                    <Calendar className="size-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-white">Site Walkthrough Booked</h4>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                      {msg.content.replace("📆 Site Visit Booked: ", "")}
                                    </p>
                                  </div>
                                </div>
                                <div className="border-t border-success/10 mt-4 pt-3 flex items-center justify-between">
                                  <span className="inline-flex items-center gap-1 text-[9px] text-success font-semibold tracking-wider uppercase font-mono">
                                    <Check className="size-3" /> Confirmed Calendar Lock
                                  </span>
                                  {isGCalConnected ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] text-success font-bold font-mono">
                                      <Check className="size-2.5" /> Synced to GCal
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] text-amber-500/80 font-bold font-mono" title="Connect Google Business Reviews integration in Settings to sync calendar">
                                      <AlertCircle className="size-2.5" /> Local Lock (GCal Disconnected)
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              /* Standard Message Bubble */
                              <div
                                className={`relative p-3 rounded-2xl text-xs leading-relaxed max-w-[70%] font-sans select-text shadow-xl ${isUser
                                  ? "bg-primary text-black rounded-tr-none font-medium opacity-100"
                                  : "bg-[#151720] border border-white/10 text-white rounded-tl-none opacity-100"
                                  }`}
                              >
                                {isAI && (
                                  <div className="absolute -top-2 -left-2 bg-[#0B0B0C] rounded-full p-1 border border-primary/30 text-primary shadow-sm" title="Generated by AI Concierge">
                                    <Sparkles className="size-3" />
                                  </div>
                                )}
                                <p className="whitespace-pre-line">{msg.content}</p>
                              </div>
                            )}

                            {/* Hover Timestamp metadata display */}
                            <span className="text-[9px] text-muted-foreground/60 mt-1 select-none font-mono px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="size-8 text-muted-foreground mb-3" />
                      <p className="text-xs text-foreground font-semibold">No direct messages yet</p>
                      <p className="text-[11px] text-muted-foreground mt-1 max-w-xs leading-relaxed">
                        Send a message to kick off direct communication. All follow-ups will log and track instantly.
                      </p>
                    </div>
                  )}

                  {/* Scroll Anchor */}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* QUICK INSTANT RESPONSE SHORTCUTS */}
              <div className="px-6 py-2 bg-[#080808]/40 border-t border-border/40 flex items-center gap-2 overflow-x-auto select-none">
                <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground shrink-0 select-none">
                  Draft Quick Tag:
                </span>
                {[
                  "What is your construction timeline?",
                  "Let's meet at the Lakeway site this Saturday!",
                  "Could you confirm your target budget range?",
                  "Here is our standard specifications list."
                ].map((suggestText) => (
                  <button
                    key={suggestText}
                    onClick={() => handleSuggestionClick(suggestText)}
                    className="px-2.5 py-1 text-[10px] bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/10 text-muted-foreground hover:text-white rounded-full transition-all shrink-0 active:scale-95"
                  >
                    {suggestText}
                  </button>
                ))}
              </div>

              {/* MESSAGE COMPOSER FOOTER INPUT */}
              <div className="p-4 border-t border-border bg-[#0B0B0C]/80 backdrop-blur-md relative">
                {isUserScrolledUp && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToBottom(true, "smooth");
                    }}
                    className="absolute -top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#141418]/95 border border-primary/50 text-primary shadow-2xl hover:bg-primary hover:text-black hover:scale-105 active:scale-95 transition-all group backdrop-blur-md cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-200"
                    title="Scroll to latest messages"
                  >
                    <ChevronDown className="size-4 transition-transform group-hover:translate-y-0.5" />
                    {newMessagesCount > 0 ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-black shadow">
                        {newMessagesCount}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium tracking-tight">Latest</span>
                    )}
                  </button>
                )}
                <form onSubmit={handleSendMessage} className="relative flex items-center">
                  <input
                    type="text"
                    required
                    disabled={isSending}
                    ref={inputRef}
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder={`Type message to ${selectedThread.leadName}... (Press Enter to Send)`}
                    className="w-full bg-[#141414] border border-border focus:border-primary/80 transition-all rounded-lg pl-4 pr-12 py-3 text-xs text-white placeholder-muted-foreground focus:outline-none focus:ring-0 leading-relaxed disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !newMessageText.trim()}
                    className="absolute right-3 p-1.5 bg-primary rounded-md text-black hover:bg-primary/95 transition-all disabled:opacity-40 active:scale-95 flex items-center justify-center cursor-pointer"
                  >
                    {isSending ? (
                      <Loader2 className="size-3.5 animate-spin text-black" />
                    ) : (
                      <Send className="size-3.5 text-black" />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* LOADING / EMPTY VIEW: Direct Lead Channel Overview */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#070708]/30">
              {isLoadingChat ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">Retrieving lead conversation...</span>
                </div>
              ) : (
                <>
                  <div className="size-16 mx-auto rounded-full bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-6">
                    <MessageSquare className="size-7 text-muted-foreground" />
                  </div>
                  <h2 className="text-md font-bold tracking-tight text-white mb-2">Direct Messaging Channel</h2>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed mb-8">
                    Communicate directly with your qualified prospects in real-time. Share high-fidelity custom home specifications, schedule private walkthroughs, or let the AI concierge manage threads.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/[0.05] text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                    Select a conversation thread to begin
                  </div>
                </>
              )}
            </div>
          )}

          {/* INLINE SCHEDULER POPUP DIALOG */}
          {isSchedulingOpen && selectedThread && (
            <div className="absolute inset-0 bg-[#000000]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
              <Card className="w-full max-w-md bg-[#0B0B0C] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">

                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-[#101011]">
                  <div>
                    <h3 className="font-semibold text-xs text-white uppercase tracking-wider font-mono">
                      Quick Schedule Site Visit
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Booking for {selectedThread.leadName}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSchedulingOpen(false)}
                    className="p-1 text-muted-foreground hover:text-white rounded-md hover:bg-white/[0.04] transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Modal Form */}
                <form onSubmit={handleBookAppointment} className="p-5 space-y-4">
                  {bookingSuccess ? (
                    <div className="py-8 flex flex-col items-center justify-center text-center gap-2.5 animate-in zoom-in-95">
                      <div className="size-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center text-success animate-bounce">
                        <Check className="size-6" />
                      </div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        Walkthrough Confirmed!
                      </h4>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Site visit logged, invitation emailed, and notification message sent to {selectedThread.leadName}.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Appointment Type */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-widest text-muted-foreground font-mono font-bold">
                          Appointment Type
                        </label>
                        <div ref={dropdownRef} className="relative w-full">
                          <button
                            type="button"
                            onClick={() => {
                              setIsDropdownOpen(!isDropdownOpen);
                              const currentIndex = dropdownOptions.findIndex(o => o.value === apptType);
                              setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
                            }}
                            onKeyDown={handleDropdownKeyDown}
                            className="w-full bg-[#141414] border border-border focus:border-primary/60 hover:border-border/80 rounded-md px-3 py-2 text-xs text-white focus:outline-none flex items-center justify-between cursor-pointer select-none transition-colors"
                          >
                            <span>{dropdownOptions.find(o => o.value === apptType)?.label || apptType}</span>
                            <ChevronDown className={`size-4 text-muted-foreground transition-transform duration-150 ${isDropdownOpen ? "rotate-180" : ""}`} />
                          </button>

                          {isDropdownOpen && (
                            <div className="absolute z-[60] w-full mt-1 bg-[#141414] border border-border rounded-md shadow-2xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                              {dropdownOptions.map((option, index) => {
                                const isSelected = option.value === apptType;
                                const isHighlighted = index === highlightedIndex;
                                return (
                                  <div
                                    key={option.value}
                                    onClick={() => {
                                      setApptType(option.value);
                                      setIsDropdownOpen(false);
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    className={`px-3 py-2 text-xs cursor-pointer select-none flex items-center justify-between transition-colors ${isHighlighted
                                      ? "bg-white/[0.06] text-white"
                                      : "text-muted-foreground hover:text-white"
                                      } ${isSelected ? "font-bold text-white bg-white/[0.03]" : ""}`}
                                  >
                                    <span>{option.label}</span>
                                    {isSelected && <Check className="size-3.5 text-white" />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Date & Time */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-widest text-muted-foreground font-mono font-bold">
                          Date & Time Selection *
                        </label>
                        <input
                          type="datetime-local"
                          required
                          value={apptDateTime}
                          onChange={(e) => setApptDateTime(e.target.value)}
                          className="w-full bg-[#141414] border border-border focus:border-primary/60 rounded-md px-3 py-2 text-xs text-white focus:outline-none font-mono"
                        />
                      </div>

                      {/* Location */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-widest text-muted-foreground font-mono font-bold">
                          Meeting Location
                        </label>
                        <input
                          type="text"
                          required
                          value={apptLocation}
                          onChange={(e) => setApptLocation(e.target.value)}
                          placeholder="e.g. Lakeway Model Estate or Client Lot"
                          className="w-full bg-[#141414] border border-border focus:border-primary/60 rounded-md px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Notes */}
                      <div className="space-y-1.5">
                        <label className="block text-[9px] uppercase tracking-widest text-muted-foreground font-mono font-bold">
                          Staff Notes / Directives
                        </label>
                        <textarea
                          rows={2}
                          value={apptNotes}
                          onChange={(e) => setApptNotes(e.target.value)}
                          placeholder="Bring blueprint files, structural lot surveys, or builder contracts..."
                          className="w-full bg-[#141414] border border-border focus:border-primary/60 rounded-md p-3 text-xs text-white focus:outline-none resize-none placeholder:text-muted-foreground/60 leading-relaxed font-sans"
                        />
                      </div>

                      {/* Actions */}
                      <div className="border-t border-border pt-4 mt-2 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsSchedulingOpen(false)}
                          className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-white hover:bg-white/[0.02] rounded-md transition-colors"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={isBooking || !apptDateTime}
                          className="px-4 py-2 bg-white text-black text-xs font-bold rounded-md hover:bg-white/90 transition-colors disabled:opacity-40 flex items-center gap-1.5"
                        >
                          {isBooking ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin text-black" /> Booking...
                            </>
                          ) : (
                            <>
                              Lock Appointment & Notify
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </form>

              </Card>
            </div>
          )}

          {/* LOOKBOOK PREVIEW MODAL */}
          {isLookbookOpen && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="w-full max-w-2xl bg-[#09090a]/95 border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col h-[520px] overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#101011]">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <div>
                      <h3 className="font-semibold text-xs text-white uppercase tracking-wider font-mono">
                        Lookbook Preview: Your Company Portfolio
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        High-Fidelity Architectural & Custom Specifications
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLookbookOpen(false)}
                    className="p-1.5 text-muted-foreground hover:text-white rounded-md hover:bg-white/[0.04] transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Slides / Content Area */}
                <div className="flex-1 p-8 flex flex-col justify-between overflow-y-auto select-none bg-gradient-to-b from-[#09090a] to-[#040405]">
                  <div className="flex-1 min-h-0 flex flex-col justify-center">
                    {lookbookPage === 0 && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="inline-block px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-widest font-mono">
                          Page 1 of 4 · Introduction
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-white leading-tight">
                          Modern Architectural Vision & Framing Specifications
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          We design custom luxury residences optimized for the unique topography of Austin. Every project begins with a foundation engineered specifically for your site's soil reports and elevation profiles.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Top-Tier Foundations</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">Engineered post-tension concrete slabs built with continuous soil lab monitoring.</p>
                          </div>
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Premium Framing</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">2x6 exterior framing with high-performance Zip System wall sheathing.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {lookbookPage === 1 && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="inline-block px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-widest font-mono">
                          Page 2 of 4 · Culinary Suites
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-white leading-tight">
                          Custom Hand-Crafted Kitchens & Finishes
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          The culinary space serves as the focal point of the modern floor plan. We build kitchen suites that blend custom, premium wood craftsmanship with modern professional-grade appliances.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Artisan Millwork</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">Custom white oak cabinetry built locally in Austin with Blum soft-close hardware.</p>
                          </div>
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Waterfall Countertops</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">3cm Calacatta quartz countertops with precision mitered edge finishes.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {lookbookPage === 2 && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="inline-block px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-widest font-mono">
                          Page 3 of 4 · Spa Sanctuaries
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-white leading-tight">
                          Owner's Retreats & Premium Bath Suites
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Turn your master suite into a five-star private spa retreat. Our bathroom architectures are focused on natural lighting, organic stone surfaces, and high-performance wet room designs.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Zero-Edge Wet Rooms</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">Integrated glass walk-in enclosures containing dual rainfall systems and freestanding tubs.</p>
                          </div>
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Floating Vanities</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">Custom-made floating cabinets with under-cabinet LED ambient lighting.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {lookbookPage === 3 && (
                      <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="inline-block px-2.5 py-1 rounded bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary uppercase tracking-widest font-mono">
                          Page 4 of 4 · High Performance
                        </div>
                        <h2 className="text-xl font-bold tracking-tight text-white leading-tight">
                          Smart Home Automation & Efficient Mechanicals
                        </h2>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          A truly premium home is as intelligent as it is beautiful. We integrate modern whole-home smart systems and high-efficiency mechanical layouts to ensure clean air, security, and lower operating costs.
                        </p>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Integrated Automation</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">Control4 smart hub pre-wired to manage lighting, HVAC, and audio from wall tablets.</p>
                          </div>
                          <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-lg">
                            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Climate Comfort</h4>
                            <p className="text-[10px] text-muted-foreground mt-1">Multi-zone Daikin variable refrigerant HVAC systems with built-in air filtration.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Navigation and Slide Indicators */}
                  <div className="border-t border-border/50 pt-6 mt-6 flex items-center justify-between shrink-0">
                    {/* Dots indicator */}
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3].map((idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLookbookPage(idx)}
                          className={`size-2 rounded-full transition-all duration-300 ${lookbookPage === idx ? "bg-primary w-5" : "bg-white/10 hover:bg-white/30"
                            }`}
                        />
                      ))}
                    </div>

                    {/* Next/Prev buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLookbookPage((prev) => Math.max(0, prev - 1))}
                        disabled={lookbookPage === 0}
                        className="px-3.5 py-1.5 rounded bg-[#141415] border border-border/40 text-xs font-semibold text-muted-foreground hover:text-white transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        Previous
                      </button>

                      {lookbookPage < 3 ? (
                        <button
                          type="button"
                          onClick={() => setLookbookPage((prev) => Math.min(3, prev + 1))}
                          className="px-4 py-1.5 rounded bg-white text-black text-xs font-bold hover:bg-white/95 transition-colors"
                        >
                          Next
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsLookbookOpen(false)}
                          className="px-4 py-1.5 rounded bg-primary text-black text-xs font-bold hover:bg-primary/95 transition-colors"
                        >
                          Finish Preview
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* PORTFOLIO MANAGER MODAL */}
      {isPortfolioModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setIsPortfolioModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-none overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-display text-base font-semibold text-foreground">Manage Portfolios</h2>
              <button onClick={() => setIsPortfolioModalOpen(false)} className="size-8 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4 max-h-[300px] overflow-y-auto mb-6">
                {portfolios.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">No portfolios available. Create one below.</p>
                ) : (
                  portfolios.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/50">
                      {editingPortfolioId === p.id ? (
                        <div className="flex-1 flex gap-2 mr-4">
                          <input
                            type="text"
                            value={editPortfolioName}
                            onChange={(e) => setEditPortfolioName(e.target.value)}
                            className="flex-1 bg-secondary border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              savePortfolios(portfolios.map(port => port.id === p.id ? { ...port, name: editPortfolioName } : port));
                              setEditingPortfolioId(null);
                            }}
                            className="px-2 py-1 bg-primary text-black text-xs font-semibold rounded hover:bg-primary/90"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPortfolioId(null)}
                            className="px-2 py-1 bg-secondary text-muted-foreground text-xs font-semibold rounded hover:text-foreground"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.size}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingPortfolioId(p.id);
                                setEditPortfolioName(p.name);
                              }}
                              className="px-3 py-1.5 bg-secondary text-foreground text-xs font-semibold rounded hover:bg-secondary/80 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                setIsPortfolioModalOpen(false);
                                handleShareBrochure(p.name, p.size);
                              }}
                              className="px-3 py-1.5 bg-primary text-black text-xs font-semibold rounded hover:bg-primary/90 transition-colors"
                            >
                              Send
                            </button>
                            <button
                              onClick={() => savePortfolios(portfolios.filter(port => port.id !== p.id))}
                              className="px-3 py-1.5 bg-danger/10 text-danger text-xs font-semibold rounded hover:bg-danger/20 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-foreground mb-2">Upload New Portfolio</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Modern Farmhouse Collection"
                    value={newPortfolioName}
                    onChange={e => setNewPortfolioName(e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:border-white/60"
                  />
                  <button
                    onClick={() => {
                      if (!newPortfolioName) return;
                      savePortfolios([...portfolios, { id: Date.now().toString(), name: newPortfolioName, size: (Math.random() * 8 + 1).toFixed(1) + " MB" }]);
                      setNewPortfolioName("");
                    }}
                    className="px-4 py-2 bg-white text-black text-xs font-bold rounded-md hover:bg-white/90"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SIMULATE MESSAGE MODAL */}
      {isSimulateOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0B0B0C] border border-border w-[400px] rounded-xl shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-foreground">Simulate Lead Reply</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">Send a test message as if the lead replied.</p>
              </div>
              <button
                onClick={() => setIsSimulateOpen(false)}
                className="size-7 rounded-md hover:bg-white/5 text-muted-foreground hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSimulateMessage} className="p-5 flex flex-col gap-4">
              <textarea
                autoFocus
                required
                value={simulateMessageText}
                onChange={(e) => setSimulateMessageText(e.target.value)}
                placeholder="Type the lead's simulated reply here..."
                className="w-full bg-[#111111] border border-border rounded-lg p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none h-[100px]"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSimulateOpen(false)}
                  className="px-4 py-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSimulating || !simulateMessageText.trim()}
                  className="px-4 py-2 rounded-md bg-primary text-black text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSimulating && <Loader2 className="size-3.5 animate-spin" />}
                  Simulate Message
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Shell>
  );
}
