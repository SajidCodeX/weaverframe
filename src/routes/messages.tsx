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
  simulateLeadMessage,
  generatePortalToken
} from "@/lib/dashboard";
import {
  MessageSquare,
  MessageSquarePlus,
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
  BrainCircuit,
  MoreVertical,
  Paperclip,
  Link2,
  Globe,
  Download,
  Eye,
  BookOpen,
  Image as ImageIcon,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/messages")({
  loader: async ({ context }) => {
    try {
      if (typeof window === 'undefined' && !context.session) {
        return { conversations: [], aiToggleMap: {}, integrationsStatus: {} };
      }
      const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
      const conversations = await getConversations({ data: { activeRole } });
      const aiToggleMap = await getAiToggleMap();
      const integrationsStatus = await getIntegrationsStatus();
      return {
        conversations: conversations || [],
        aiToggleMap: aiToggleMap || {},
        integrationsStatus: integrationsStatus || {}
      };
    } catch (err) {
      console.error("Error in messages route loader:", err);
      return { conversations: [], aiToggleMap: {}, integrationsStatus: {} };
    }
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
  const loaderData = (useLoaderData({ from: "/messages" }) || {}) as any;
  const initialConversations = loaderData?.conversations || [];
  const initialAiToggleMap = loaderData?.aiToggleMap || {};
  const initialIntegrationsStatus = loaderData?.integrationsStatus || {};

  const [conversationsList, setConversationsList] = useState<any[]>(initialConversations || []);

  useEffect(() => {
    if (initialConversations && Array.isArray(initialConversations)) {
      setConversationsList(initialConversations);
    }
  }, [initialConversations]);

  // Poll conversations every 15s so online status stays fresh (WhatsApp-style)
  useEffect(() => {
    const interval = setInterval(() => {
      router.invalidate();
    }, 15000);
    return () => clearInterval(interval);
  }, [router]);

  // Track selected lead & active conversation
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [activeChat, setActiveChat] = useState<{ lead: any; messages: any[] } | null>(null);

  // Active threads: Leads with actual messages or currently selected
  const activeThreadsList = useMemo(() => {
    if (!Array.isArray(conversationsList)) return [];
    return conversationsList.filter(t => 
      t && ((t.lastMessage && t.lastMessage !== "No messages yet") || t.leadId === selectedLeadId)
    );
  }, [conversationsList, selectedLeadId]);

  // Uncontacted leads: Leads without messages
  const uncontactedLeadsList = useMemo(() => {
    if (!Array.isArray(conversationsList)) return [];
    return conversationsList.filter(t => 
      t && (!t.lastMessage || t.lastMessage === "No messages yet")
    );
  }, [conversationsList]);

  const [isLookbookOpen, setIsLookbookOpen] = useState(false);
  const [lookbookPage, setLookbookPage] = useState(0);

  // File & Link Attachment State
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; type: string; dataUrl?: string } | null>(null);
  const [attachedLink, setAttachedLink] = useState<{ title: string; url: string; category: string } | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState("");
  const [linkInputTitle, setLinkInputTitle] = useState("");
  const [linkInputCategory, setLinkInputCategory] = useState("3D Virtual Tour");
  const [activeImageModalUrl, setActiveImageModalUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // WhatsApp New Chat modal state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatSearchQuery, setNewChatSearchQuery] = useState("");

  // Loading and sending UI states
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const loadedLeadIdRef = useRef<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [newMessageText, setNewMessageText] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [showCcDrawer, setShowCcDrawer] = useState(false);
  const [ccEmail, setCcEmail] = useState("");

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

  const handleCopyPortalLink = async () => {
    if (!activeChat) return;
    try {
      let token = selectedThread?.portalToken || activeChat.lead.portalToken;
      if (!token) {
        const activeRole = sessionStorage.getItem('active_role') ?? undefined;
        // activeChat.lead has id from DB but might just be the mapped thread which has leadId
        const targetLeadId = selectedThread?.leadId || activeChat.lead.id || activeChat.lead.leadId;
        token = await generatePortalToken({ data: { leadId: targetLeadId, activeRole } });
        if (selectedThread) selectedThread.portalToken = token;
      }
      const link = `${window.location.origin}/portal/${token}`;
      await navigator.clipboard.writeText(link);
      toast.success("Client portal link copied!", {
        description: "Anyone with this link can chat with you as this lead."
      });
    } catch (e) {
      toast.error("Failed to copy link");
      console.error(e);
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

  // Auto-select the first active conversation on initial load if none selected
  useEffect(() => {
    if (activeThreadsList.length > 0 && !selectedLeadId) {
      setSelectedLeadId(activeThreadsList[0].leadId);
      setIsLoadingChat(true);
    }
  }, [activeThreadsList, selectedLeadId]);

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



  // Filtered uncontacted leads for New Chat Modal search
  const filteredUncontactedLeads = useMemo(() => {
    if (!newChatSearchQuery.trim()) return uncontactedLeadsList;
    const q = newChatSearchQuery.toLowerCase();
    return uncontactedLeadsList.filter(l =>
      (l.leadName && l.leadName.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.scoreTier && l.scoreTier.toLowerCase().includes(q))
    );
  }, [uncontactedLeadsList, newChatSearchQuery]);

  // Filter active conversations for left sidebar list
  const filteredThreads = useMemo(() => {
    let threads = activeThreadsList;
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
  }, [activeThreadsList, searchQuery, activeTab, selectedLeadId]);

  // Handle File Selection (PDF, Blueprint, Images, CAD, Docs)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let sizeStr = `${(file.size / 1024).toFixed(0)} KB`;
    if (file.size > 1024 * 1024) {
      sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    }

    const isImg = file.type.startsWith("image/");
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        size: sizeStr,
        type: file.type || (isImg ? "image/jpeg" : "application/pdf"),
        dataUrl: typeof reader.result === "string" ? reader.result : undefined
      });
      toast.success(`Attached ${file.name} (${sizeStr})`);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  // Handle Link Inserter
  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInputUrl.trim()) return;

    let formattedUrl = linkInputUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const domain = formattedUrl.replace(/^https?:\/\//, '').split('/')[0];
    const finalTitle = linkInputTitle.trim() || domain;

    setAttachedLink({
      url: formattedUrl,
      title: finalTitle,
      category: linkInputCategory || "Virtual Tour / Link"
    });

    setIsLinkModalOpen(false);
    setLinkInputUrl("");
    setLinkInputTitle("");
    setLinkInputCategory("3D Virtual Tour");
    toast.success(`Attached link: ${finalTitle}`);
  };

  // Handle sending text message or attachments
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedLeadId || (!newMessageText.trim() && !attachedFile && !attachedLink) || isSending) return;

    let payloadContent = newMessageText.trim();
    if (attachedFile) {
      if (attachedFile.type.startsWith("image/")) {
        const header = `🖼️ Image Shared: ${attachedFile.name}|size=${attachedFile.size}|data=${attachedFile.dataUrl || ""}`;
        payloadContent = payloadContent ? `${header}\n\n${payloadContent}` : header;
      } else {
        const header = `📎 File Attachment: ${attachedFile.name}|size=${attachedFile.size}|type=${attachedFile.type}|data=${attachedFile.dataUrl || ""}`;
        payloadContent = payloadContent ? `${header}\n\n${payloadContent}` : header;
      }
    } else if (attachedLink) {
      const header = `🔗 Link Shared: ${attachedLink.title}|url=${attachedLink.url}|category=${attachedLink.category}`;
      payloadContent = payloadContent ? `${header}\n\n${payloadContent}` : header;
    }

    const originalText = payloadContent;
    setNewMessageText("");
    setAttachedFile(null);
    setAttachedLink(null);
    setIsSending(true);

    const tempId = `opt-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      sender: "user" as const,
      content: originalText,
      createdAt: new Date().toISOString(),
      isRead: true
    };

    // Optimsitic UI Update INSTANTLY
    setActiveChat(prev => {
      if (!prev) return null;
      return { ...prev, messages: [...prev.messages, optimisticMessage] };
    });
    setTimeout(scrollToBottom, 20);

    try {
      const res = await sendMessage({
        data: {
          leadId: selectedLeadId,
          content: originalText
        }
      });

      // Update state with actual DB response (replace temp message)
      setActiveChat(prev => {
        if (!prev) return null;
        const updatedMsgs = prev.messages.map(m => m.id === tempId ? {
            id: res.userMessage.id,
            sender: "user" as const,
            content: res.userMessage.content,
            createdAt: new Date().toISOString(),
            isRead: true
        } : m);

        if ((window as any)._messagesCache) {
          (window as any)._messagesCache.set(selectedLeadId, updatedMsgs);
        }

        return { ...prev, messages: updatedMsgs };
      });

      await router.invalidate();
    } catch (err) {
      console.error("Failed to send message:", err);
      // Rollback optimistic update
      setActiveChat(prev => {
        if (!prev) return null;
        return { ...prev, messages: prev.messages.filter(m => m.id !== tempId) };
      });
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

    const msgToSend = simulateMessageText.trim();
    setIsSimulating(true);
    try {
      const res = await simulateLeadMessage({
        data: {
          leadId: selectedLeadId,
          content: msgToSend,
          enableAiReply: isAiActive
        }
      });

      // Instantly inject new messages into local active chat view
      if (res && res.leadMessage) {
        setActiveChat(prev => {
          if (!prev) return null;
          const newMessages = [...prev.messages, res.leadMessage];
          if (res.systemMessage) {
            newMessages.push(res.systemMessage);
          }
          if ((window as any)._messagesCache) {
            (window as any)._messagesCache.set(selectedLeadId, newMessages);
          }
          return { ...prev, messages: newMessages };
        });
        setTimeout(() => scrollToBottom(true, "smooth"), 60);
      }

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
    <Shell title="Messages" noPadding>
      <div ref={containerRef} className="flex h-full w-full bg-card/40 backdrop-blur-xl relative">

        {/* LEFT COLUMN: Search & Thread List */}
        <div
          style={{ width: `${leftWidth}px` }}
          className="border-r border-border flex flex-col h-full min-h-0 bg-[#080808]/90 shrink-0 relative"
        >
          {/* Thread Search Box */}
          <div className="p-3.5 border-b border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-foreground tracking-tight flex items-center gap-1.5">
                <Mail className="size-3.5 text-primary" />
                <span>Inbox</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewChatSearchQuery("");
                  setIsNewChatModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[10.5px] font-semibold transition-colors cursor-pointer"
              >
                <Plus className="size-3" /> New Message
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground transition-colors"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 p-0.5 bg-secondary/60 rounded-lg">
              {(["all", "unread", "hot"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[10.5px] font-medium capitalize rounded-md transition-all ${activeTab === tab
                    ? "bg-card text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {tab === "all" ? "All" : tab === "unread" ? "Unread" : "Hot"}
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
                    className={`w-full text-left p-3.5 flex gap-3 transition-colors hover:bg-secondary/40 select-none outline-none focus:bg-secondary/40 relative ${isActive ? "bg-secondary text-foreground" : "text-muted-foreground"
                      }`}
                  >
                    {/* Left border active bar */}
                    {isActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary animate-in fade-in duration-100" />
                    )}

                    {/* Avatar Container */}
                    <div className="relative shrink-0">
                      <div className={`size-9 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${isActive
                        ? "bg-primary/10 border-primary/20 text-white"
                        : "bg-secondary border-border text-muted-foreground"
                        }`}>
                        {initials}
                      </div>

                      {/* Online Status Dot */}
                      {thread.isOnline && (
                        <div className="absolute bottom-0 right-0 size-2 rounded-full bg-emerald-500 ring-2 ring-[#080808]" />
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

                      {/* Clean Score & Status */}
                      <div className="flex items-center gap-1.5">
                        {thread.scoreTier === "Hot" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
                            Hot
                          </span>
                        )}
                        {thread.scoreTier === "Warm" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-warning/10 text-warning border border-warning/20">
                            Warm
                          </span>
                        )}
                        {thread.scoreTier === "Cold" && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-muted text-muted-foreground border border-border">
                            Cold
                          </span>
                        )}
                        <span className="text-[9px] font-mono text-muted-foreground/60 select-none">
                          · {thread.status}
                        </span>
                      </div>

                      {/* Last Message Preview & Unread Badge */}
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-[11px] text-muted-foreground truncate leading-relaxed flex-1">
                          {thread.lastMessage}
                        </p>
                        {!isActive && thread.unreadCount > 0 && (
                          <span className="shrink-0 size-4.5 bg-primary text-primary-foreground text-[9.5px] font-bold flex items-center justify-center rounded-full select-none">
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
              {/* CLEAN THREAD HEADER */}
              <div className="px-6 py-3.5 border-b border-border bg-[#090a0e] flex items-center justify-between gap-4 shrink-0">
                {/* Left: Lead Identity & Metadata */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                    {(selectedThread.leadName || "Lead")
                      .split(" ")
                      .filter(Boolean)
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "L"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-xs sm:text-sm text-foreground truncate">
                        {selectedThread.leadName}
                      </h3>
                      {selectedThread.scoreTier === "Hot" && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                          Hot
                        </span>
                      )}
                      {selectedThread.scoreTier === "Warm" && (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-warning/10 text-warning border border-warning/20 shrink-0">
                          Warm
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono mt-0.5 truncate">
                      <span>{selectedThread.email || `${selectedThread.leadName?.toLowerCase().replace(/\s+/g, '')}@client.com`}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* AI Toggle Button */}
                  <button
                    onClick={async () => {
                      if (!selectedLeadId) return;
                      const nextVal = !isAiActive;
                      setAiToggleMap(prev => ({ ...prev, [selectedLeadId]: nextVal }));
                      try {
                        await setLeadAiToggle({ data: { leadId: selectedLeadId, active: nextVal } });
                      } catch (err) {
                        console.error("Failed to toggle AI:", err);
                        setAiToggleMap(prev => ({ ...prev, [selectedLeadId]: isAiActive }));
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      isAiActive
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                    }`}
                    title={isAiActive ? "AI Auto-reply enabled" : "AI Auto-reply paused"}
                  >
                    <Sparkles className="size-3.5" />
                    <span className="hidden sm:inline">{isAiActive ? "AI Active" : "AI Off"}</span>
                  </button>

                  {/* AI Summary */}
                  <button
                    onClick={handleSummarizeChat}
                    disabled={isSummarizing || !activeChat || activeChat.messages.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary border border-border hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                    title="Generate conversation summary"
                  >
                    {isSummarizing ? <Loader2 className="size-3.5 animate-spin text-primary" /> : <BrainCircuit className="size-3.5 text-primary" />}
                    <span className="hidden md:inline">Summarize</span>
                  </button>

                  {/* Schedule Meeting Button */}
                  <button
                    onClick={() => setIsSchedulingOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-xs font-medium transition-colors cursor-pointer"
                    title="Schedule Meeting"
                  >
                    <Calendar className="size-3.5" />
                    <span className="hidden md:inline">Schedule</span>
                  </button>

                  {/* More Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 rounded-lg hover:bg-secondary border border-transparent hover:border-border transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-[#0a0a0c] border border-border">
                      <DropdownMenuItem onClick={handleCopyPortalLink} className="flex items-center gap-2 cursor-pointer">
                        <ExternalLink className="size-4 text-muted-foreground" />
                        <span>Copy Client Portal Link</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setIsPortfolioModalOpen(true)} className="flex items-center gap-2 cursor-pointer">
                        <BookOpen className="size-4 text-muted-foreground" />
                        <span>Manage Documents</span>
                      </DropdownMenuItem>
                      {canSimulate && (
                        <DropdownMenuItem onClick={() => setIsSimulateOpen(true)} className="flex items-center gap-2 cursor-pointer">
                          <MessageSquare className="size-4 text-muted-foreground" />
                          <span>Simulate Lead Reply</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* SUBJECT LINE BAR */}
              <div className="px-6 py-2.5 bg-[#06070a] border-b border-border/30 flex items-center justify-between text-xs text-muted-foreground shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70 font-semibold shrink-0">Subject:</span>
                  <span className="font-medium text-foreground text-xs truncate">
                    {emailSubject || `Re: Inquiry · ${selectedThread.leadName}`}
                  </span>
                </div>
                <span className="text-[10.5px] font-mono text-muted-foreground/60 shrink-0 hidden sm:flex items-center gap-1">
                  <Check className="size-3 text-emerald-400" /> Synced with Mailbox
                </span>
              </div>

              {/* AI BRIEFING SHEET */}
              {chatSummary && (
                <div className="mx-6 mt-4 p-4 rounded-xl bg-[#0f0f14] border border-primary/40 shadow-2xl animate-in fade-in slide-in-from-top-4 relative z-30 shrink-0 max-h-[260px] overflow-y-auto">
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 sticky top-0 bg-[#0f0f14] z-10">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                        <BrainCircuit className="size-3.5 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white">Conversation Summary</h4>
                      </div>
                    </div>
                    <button
                      onClick={() => setChatSummary(null)}
                      className="size-6 rounded-md bg-white/5 hover:bg-white/15 text-muted-foreground hover:text-white flex items-center justify-center transition-colors"
                      title="Close Summary"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <FormattedSummary text={chatSummary} />
                </div>
              )}

              {/* MESSAGE THREAD STREAM CANVAS */}
              <div className="flex-1 flex flex-col min-h-0 relative bg-[#07080b] overflow-hidden">
                {/* Messages Scroll Container */}
                <div
                  ref={chatContainerRef}
                  onScroll={handleChatScroll}
                  className="flex-1 overflow-y-auto px-6 py-4 space-y-1 min-h-0 relative z-10 custom-scrollbar"
                >
                  {activeChat.messages.length > 0 ? (
                    activeChat.messages.map((msg, index) => {
                      const isUser = msg.sender === "user";
                      const isAI = msg.sender === "system";
                      const isLead = !isUser && !isAI;

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

                      const isBrochureCard = msg.content.includes("📄 Document Shared");
                      const isAppointmentCard = msg.content.includes("📆 Site Visit Booked");
                      const isFileAttachment = msg.content.includes("📎 File Attachment:");
                      const isImageAttachment = msg.content.includes("🖼️ Image Shared:");
                      const isLinkShared = msg.content.includes("🔗 Link Shared:");

                      return (
                        <div key={msg.id} className="w-full">
                          {showDateDivider && (
                            <div className="flex justify-center my-4">
                              <span className="text-[10px] font-medium text-muted-foreground bg-[#111115] border border-white/10 px-3 py-0.5 rounded-full uppercase tracking-widest font-mono">
                                {dateLabel}
                              </span>
                            </div>
                          )}

                          {/* Flowing Message Entry */}
                          <div className="py-3 border-b border-border/30 last:border-0 group animate-in fade-in duration-150">
                            {/* Sender Header Row */}
                            <div className="flex items-start justify-between gap-3 mb-1.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={`size-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                                    isAI
                                      ? "bg-primary/20 text-primary border border-primary/30"
                                      : isUser
                                        ? "bg-primary/20 text-primary border border-primary/40"
                                        : "bg-secondary text-foreground border border-border"
                                  }`}
                                >
                                  {isAI ? <Sparkles className="size-3.5" /> : isUser ? "You" : (activeChat.lead?.name?.[0] || "C")}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                  <span className="font-semibold text-xs text-foreground">
                                    {isAI ? "AI Assistant" : isUser ? "You" : (activeChat.lead?.name || "Client")}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground font-mono">
                                    &lt;{isAI ? "ai@buildersedge.ai" : isUser ? "sales@yourcompany.com" : (activeChat.lead?.email || `${activeChat.lead?.name?.toLowerCase().replace(/\s+/g, '') || 'client'}@email.com`)}&gt;
                                  </span>
                                  {isAI && (
                                    <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                                      AI Auto-Reply
                                    </span>
                                  )}
                                  {isUser && (
                                    <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono font-medium bg-secondary text-muted-foreground border border-border">
                                      Sent
                                    </span>
                                  )}
                                </div>
                              </div>

                              <span className="text-[10.5px] text-muted-foreground font-mono shrink-0 select-none">
                                {msgDate.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>

                            {/* Message Content Body */}
                            <div className="pl-9 text-xs sm:text-[13px] text-foreground/90 leading-relaxed font-sans select-text space-y-2.5">
                              {isBrochureCard ? (
                                /* Shared document card */
                                <div className="bg-[#12131a] border border-border rounded-xl p-3.5 max-w-[420px] shadow-sm relative overflow-hidden">
                                  <div className="flex gap-3 items-center">
                                    <div className="size-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shrink-0 text-primary">
                                      <FileText className="size-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-xs font-semibold text-white truncate">{msg.content.replace("📄 Document Shared: ", "").split(".pdf|size=")[0]}</h4>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">PDF Document · {msg.content.includes("|size=") ? msg.content.split("|size=")[1] : "4.8 MB"}</p>
                                    </div>
                                  </div>
                                  <div className="border-t border-border/40 mt-3 pt-2.5 flex items-center justify-between">
                                    <span className="text-[9px] text-muted-foreground font-mono">Attachment</span>
                                    <a
                                      href="#"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        setIsLookbookOpen(true);
                                        setLookbookPage(0);
                                      }}
                                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary hover:underline"
                                    >
                                      View PDF <ExternalLink className="size-3" />
                                    </a>
                                  </div>
                                </div>
                              ) : isAppointmentCard ? (
                                /* Meeting Scheduled Card */
                                <div className="bg-success/5 border border-success/30 rounded-xl p-3.5 max-w-[420px] shadow-sm relative overflow-hidden">
                                  <div className="flex gap-3 items-center">
                                    <div className="size-9 bg-success/15 rounded-lg flex items-center justify-center border border-success/30 shrink-0 text-success">
                                      <Calendar className="size-4.5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h4 className="text-xs font-semibold text-white">Meeting Scheduled</h4>
                                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                        {msg.content.replace("📆 Site Visit Booked: ", "")}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="border-t border-success/10 mt-3 pt-2 flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 text-[9px] text-success font-medium font-mono">
                                      <Check className="size-2.5" /> Confirmed
                                    </span>
                                  </div>
                                </div>
                              ) : isFileAttachment ? (
                                /* Document / File Attachment */
                                (() => {
                                  const parts = msg.content.replace("📎 File Attachment: ", "").split("\n\n");
                                  const metaStr = parts[0] || "";
                                  const caption = parts.slice(1).join("\n\n");
                                  const [fileName, sizeParam, typeParam, dataParam] = metaStr.split("|");
                                  const fileSize = sizeParam ? sizeParam.replace("size=", "") : "File";
                                  const fileType = typeParam ? typeParam.replace("type=", "") : "document";
                                  const dataUrl = dataParam ? dataParam.replace("data=", "") : undefined;

                                  return (
                                    <div className="bg-[#12131a] border border-border rounded-xl p-3 max-w-[420px] shadow-sm space-y-2">
                                      <div className="flex gap-2.5 items-center">
                                        <div className="size-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shrink-0 text-primary">
                                          <FileText className="size-4.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h4 className="text-xs font-semibold text-white truncate">{fileName || "Attachment"}</h4>
                                          <span className="text-[10px] text-muted-foreground font-mono">
                                            {fileSize} · {fileType.includes("pdf") ? "PDF" : "File"}
                                          </span>
                                        </div>
                                      </div>
                                      {caption && (
                                        <p className="text-xs text-white/90 pt-1 border-t border-white/5 leading-relaxed whitespace-pre-line">
                                          {caption}
                                        </p>
                                      )}
                                      <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                                        <span className="text-[9px] text-muted-foreground font-mono">Attachment</span>
                                        {dataUrl ? (
                                          <a
                                            href={dataUrl}
                                            download={fileName}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                                          >
                                            <Download className="size-3" /> Download
                                          </a>
                                        ) : (
                                          <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                                            <Check className="size-2.5" /> Attached
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : isImageAttachment ? (
                                /* Image Attachment */
                                (() => {
                                  const parts = msg.content.replace("🖼️ Image Shared: ", "").split("\n\n");
                                  const metaStr = parts[0] || "";
                                  const caption = parts.slice(1).join("\n\n");
                                  const [fileName, sizeParam, dataParam] = metaStr.split("|");
                                  const fileSize = sizeParam ? sizeParam.replace("size=", "") : "";
                                  const dataUrl = dataParam ? dataParam.replace("data=", "") : undefined;

                                  return (
                                    <div className="bg-[#12131a] border border-border rounded-xl p-2.5 max-w-[420px] shadow-sm space-y-2">
                                      {dataUrl && (
                                        <div
                                          onClick={() => setActiveImageModalUrl(dataUrl)}
                                          className="relative rounded-lg overflow-hidden border border-border max-h-[240px] bg-black/40 cursor-pointer group/img"
                                        >
                                          <img src={dataUrl} alt={fileName} className="w-full h-auto object-cover max-h-[240px] group-hover/img:scale-105 transition-transform duration-200" />
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1">
                                        <span className="truncate max-w-[200px]">{fileName}</span>
                                        {fileSize && <span>{fileSize}</span>}
                                      </div>
                                      {caption && (
                                        <p className="text-xs text-white/90 pt-1 leading-relaxed border-t border-white/5 whitespace-pre-line">
                                          {caption}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : isLinkShared ? (
                                /* Shared Link */
                                (() => {
                                  const parts = msg.content.replace("🔗 Link Shared: ", "").split("\n\n");
                                  const metaStr = parts[0] || "";
                                  const caption = parts.slice(1).join("\n\n");
                                  const [titleParam, urlParam] = metaStr.split("|");
                                  const title = titleParam || "Shared Link";
                                  const url = urlParam ? urlParam.replace("url=", "") : "#";

                                  return (
                                    <div className="bg-[#12131a] border border-border rounded-xl p-3 max-w-[420px] shadow-sm space-y-2">
                                      <div className="flex gap-2.5 items-start">
                                        <div className="size-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shrink-0 text-primary">
                                          <Globe className="size-4.5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <h4 className="text-xs font-semibold text-white truncate">{title}</h4>
                                          <p className="text-[10px] text-muted-foreground truncate font-mono">{url}</p>
                                        </div>
                                      </div>
                                      {caption && (
                                        <p className="text-xs text-white/90 pt-1 border-t border-white/5 leading-relaxed whitespace-pre-line">
                                          {caption}
                                        </p>
                                      )}
                                      <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                                        <span className="text-[9px] text-muted-foreground font-mono">Link</span>
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition-colors cursor-pointer border border-border"
                                        >
                                          Open <ExternalLink className="size-3" />
                                        </a>
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : (
                                /* Standard Clean Message Text */
                                <p className="whitespace-pre-line leading-relaxed text-[13.5px] text-foreground/90 font-sans">
                                  {msg.content}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <div className="size-12 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center mb-3">
                        <Mail className="size-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-foreground font-semibold">No messages yet</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                        Send a message below to start your conversation with {selectedThread.leadName}.
                      </p>
                    </div>
                  )}

                  {/* Typing Indicator for simulated replies */}
                  {isSimulating && (
                    <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground font-mono animate-in fade-in duration-150">
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                      <span>AI is generating reply...</span>
                    </div>
                  )}

                  {/* Scroll Anchor */}
                  <div ref={chatEndRef} />
                </div>
              </div>

              {/* SIMPLE COMPACT COMPOSER */}
              <div className="p-4 border-t border-border bg-[#090a0e] relative z-30 shrink-0">
                {isUserScrolledUp && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToBottom(true, "smooth");
                    }}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#141418]/95 border border-primary/50 text-primary shadow-xl hover:bg-primary hover:text-black transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-1 duration-150 text-xs"
                    title="Scroll to latest messages"
                  >
                    <ChevronDown className="size-3.5" />
                    <span>Latest Messages</span>
                  </button>
                )}

                {/* Hidden File Input Picker */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.cad,.dwg,.txt,.csv"
                />

                {/* Pre-Send Attachment Banner (File) */}
                {attachedFile && (
                  <div className="mb-2.5 p-2 px-3 rounded-lg bg-secondary border border-border flex items-center justify-between text-xs text-foreground animate-in slide-in-from-bottom-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="size-4 text-primary shrink-0" />
                      <span className="font-medium text-xs truncate">{attachedFile.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({attachedFile.size})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedFile(null)}
                      className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {/* Pre-Send Attachment Banner (Link) */}
                {attachedLink && (
                  <div className="mb-2.5 p-2 px-3 rounded-lg bg-secondary border border-border flex items-center justify-between text-xs text-foreground animate-in slide-in-from-bottom-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Globe className="size-4 text-primary shrink-0" />
                      <span className="font-medium text-xs truncate">{attachedLink.title}</span>
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">({attachedLink.url})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachedLink(null)}
                      className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}

                {/* Unified Clean Composer Box */}
                <div className="rounded-xl border border-border bg-[#0d0e14] focus-within:border-primary/60 transition-all overflow-hidden shadow-sm">
                  {/* Optional CC/Subject expander */}
                  {showCcDrawer && (
                    <div className="p-2.5 border-b border-border/40 bg-secondary/20 flex flex-col gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold shrink-0">Subject:</span>
                        <input
                          type="text"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          className="w-full bg-transparent text-xs text-foreground focus:outline-none"
                          placeholder={`Re: Inquiry · ${selectedThread.leadName}`}
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold shrink-0">CC:</span>
                        <input
                          type="email"
                          value={ccEmail}
                          onChange={(e) => setCcEmail(e.target.value)}
                          placeholder="team@yourcompany.com"
                          className="w-full bg-transparent text-xs text-foreground focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Textarea */}
                  <textarea
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`Reply to ${selectedThread.leadName}... (Ctrl+Enter to send)`}
                    className="w-full bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none resize-none min-h-[75px] max-h-[220px] font-sans leading-relaxed"
                  />

                  {/* Action Toolbar */}
                  <div className="px-3 py-2 border-t border-border/30 bg-secondary/10 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isSending}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        title="Attach File"
                      >
                        <Paperclip className="size-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsLinkModalOpen(true)}
                        disabled={isSending}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        title="Add Link"
                      >
                        <Globe className="size-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsPortfolioModalOpen(true)}
                        disabled={isSending}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        title="Attach PDF"
                      >
                        <BookOpen className="size-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsSchedulingOpen(true)}
                        disabled={isSending}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        title="Schedule Meeting"
                      >
                        <Calendar className="size-4" />
                      </button>

                      <div className="w-px h-4 bg-border mx-1" />

                      <button
                        type="button"
                        onClick={() => setShowCcDrawer(prev => !prev)}
                        className={`px-2 py-1 rounded text-[10.5px] font-mono transition-colors cursor-pointer ${
                          showCcDrawer ? "bg-primary/20 text-primary font-bold" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        {showCcDrawer ? "Hide CC" : "+ CC / Subject"}
                      </button>
                    </div>

                    {/* Send Button */}
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={isSending || (!newMessageText.trim() && !attachedFile && !attachedLink)}
                      className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40 cursor-pointer shrink-0"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="size-3.5" />
                          <span>Send</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* LOADING / EMPTY VIEW */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#070708]/30">
              {isLoadingChat ? (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">Loading conversation...</span>
                </div>
              ) : (
                <>
                  <div className="size-14 mx-auto rounded-full bg-secondary border border-border flex items-center justify-center mb-4">
                    <MessageSquare className="size-6 text-muted-foreground" />
                  </div>
                  <h2 className="text-sm font-semibold text-foreground mb-1">No conversation selected</h2>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed mb-6">
                    Choose a conversation from the left to view messages and reply.
                  </p>
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
                    <h3 className="font-semibold text-xs text-white">
                      Schedule Meeting
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      With {selectedThread.leadName}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsSchedulingOpen(false)}
                    className="p-1 text-muted-foreground hover:text-white rounded-md hover:bg-white/[0.04] transition-colors cursor-pointer"
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
                      <h4 className="text-xs font-semibold text-white">
                        Meeting Scheduled!
                      </h4>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Meeting has been scheduled and details sent to {selectedThread.leadName}.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Appointment Type */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-medium text-muted-foreground">
                          Meeting Type
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
                        <label className="block text-[10px] font-medium text-muted-foreground">
                          Date & Time *
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
                        <label className="block text-[10px] font-medium text-muted-foreground">
                          Location
                        </label>
                        <input
                          type="text"
                          required
                          value={apptLocation}
                          onChange={(e) => setApptLocation(e.target.value)}
                          placeholder="e.g. Office or Site Location"
                          className="w-full bg-[#141414] border border-border focus:border-primary/60 rounded-md px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>

                      {/* Notes */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-medium text-muted-foreground">
                          Notes
                        </label>
                        <textarea
                          rows={2}
                          value={apptNotes}
                          onChange={(e) => setApptNotes(e.target.value)}
                          placeholder="Add any details or instructions for this meeting..."
                          className="w-full bg-[#141414] border border-border focus:border-primary/60 rounded-md p-3 text-xs text-white focus:outline-none resize-none placeholder:text-muted-foreground/60 leading-relaxed font-sans"
                        />
                      </div>

                      {/* Actions */}
                      <div className="border-t border-border pt-4 mt-2 flex items-center justify-end gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIsSchedulingOpen(false)}
                          className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-white hover:bg-white/[0.02] rounded-md transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          disabled={isBooking || !apptDateTime}
                          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                        >
                          {isBooking ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" /> Scheduling...
                            </>
                          ) : (
                            <>
                              Schedule Meeting
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

          {/* DOCUMENT PREVIEW MODAL */}
          {isLookbookOpen && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
              <div className="w-full max-w-2xl bg-[#09090a]/95 border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col h-[520px] overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-[#101011]">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary" />
                    <div>
                      <h3 className="font-semibold text-xs text-white">
                        Document Preview
                      </h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Project Overview & Specifications
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLookbookOpen(false)}
                    className="p-1.5 text-muted-foreground hover:text-white rounded-md hover:bg-white/[0.04] transition-colors cursor-pointer"
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

      {/* START NEW CHAT MODAL (WhatsApp Style) */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-[#12141C] border border-border/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 border-b border-border/60 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center text-[#25D366]">
                  <MessageSquarePlus className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white font-display">Start New Chat</h3>
                  <p className="text-[11px] text-muted-foreground">Select an uncontacted lead to initiate conversation</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="size-8 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors"
                title="Close Modal"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Search Input */}
            <div className="p-4 border-b border-border/40 bg-secondary/20">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search lead by name, email, or phone..."
                  value={newChatSearchQuery}
                  onChange={(e) => setNewChatSearchQuery(e.target.value)}
                  className="w-full bg-secondary border border-border/60 rounded-lg pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-primary/60 placeholder:text-muted-foreground transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {/* Uncontacted Leads List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar min-h-[220px]">
              {filteredUncontactedLeads.length > 0 ? (
                filteredUncontactedLeads.map((lead) => {
                  const initials = (lead.leadName || "Lead")
                    .split(" ")
                    .filter(Boolean)
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "L";

                  return (
                    <button
                      key={lead.leadId}
                      onClick={() => {
                        setSelectedLeadId(lead.leadId);
                        setActiveChat(null);
                        setIsLoadingChat(true);
                        setIsNewChatModalOpen(false);
                        setTimeout(() => {
                          if (inputRef.current) inputRef.current.focus();
                        }, 150);
                      }}
                      className="w-full text-left p-3 rounded-xl flex items-center gap-3 hover:bg-white/[0.06] transition-all group border border-transparent hover:border-white/10 select-none"
                    >
                      <div className="size-10 rounded-full bg-primary/10 border border-primary/20 text-white flex items-center justify-center text-xs font-semibold shrink-0 group-hover:bg-primary/20 transition-colors">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-white truncate">{lead.leadName}</h4>
                          {lead.scoreTier && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase ${
                              lead.scoreTier === "Hot"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : lead.scoreTier === "Warm"
                                ? "bg-warning/10 text-warning border border-warning/20"
                                : "bg-cold/10 text-cold border border-cold/20"
                            }`}>
                              {lead.scoreTier}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {lead.email || lead.phone || lead.status || "New Lead"}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-white">No uncontacted leads found</p>
                  <p className="text-[11px]">All available leads already have active chat conversations.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INSERT LINK DIALOG */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0e0f14] border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-[#12131b]">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Globe className="size-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Add Web Link</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Attach a web link or online resource to your message.</p>
                </div>
              </div>
              <button
                onClick={() => setIsLinkModalOpen(false)}
                className="size-7 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleAddLink} className="p-6 space-y-4">
              {/* URL Input */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-muted-foreground">
                  URL *
                </label>
                <input
                  type="url"
                  required
                  value={linkInputUrl}
                  onChange={(e) => setLinkInputUrl(e.target.value)}
                  placeholder="https://example.com/..."
                  className="w-full bg-[#181924] border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-mono"
                  autoFocus
                />
              </div>

              {/* Title / Description */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-muted-foreground">
                  Display Title (Optional)
                </label>
                <input
                  type="text"
                  value={linkInputTitle}
                  onChange={(e) => setLinkInputTitle(e.target.value)}
                  placeholder="e.g. Project Photos / Spec Sheet"
                  className="w-full bg-[#181924] border border-border focus:border-primary rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!linkInputUrl.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-40 cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Link2 className="size-3.5" /> Attach Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      {activeImageModalUrl && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="fixed inset-0" onClick={() => setActiveImageModalUrl(null)} />
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center z-10 animate-in zoom-in-95 duration-150">
            <div className="absolute -top-12 right-0 flex items-center gap-2">
              <a
                href={activeImageModalUrl}
                download="estate-photo.jpg"
                className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                title="Download image"
              >
                <Download className="size-4" />
              </a>
              <button
                onClick={() => setActiveImageModalUrl(null)}
                className="size-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shadow-lg"
                title="Close"
              >
                <X className="size-4" />
              </button>
            </div>
            <img
              src={activeImageModalUrl}
              alt="Fullscreen attachment"
              className="max-h-[80vh] w-auto rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>
        </div>
      )}

    </Shell>
  );
}
