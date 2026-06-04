import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Shell } from "@/components/dashboard/Shell";
import { Card, CardHeader, Badge } from "@/components/dashboard/primitives";
import { Bot, Zap, Clock, MessageSquare, Send, Sparkles, User, BrainCircuit, ChevronDown, Trash2, Eye, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { getLeadsData, simulateAIChatReply, generateAIScriptUpdate } from "@/lib/dashboard";
import { obscurePII } from "@/lib/utils";
import { useRouteContext } from "@tanstack/react-router";

export const Route = createFileRoute("/ai-activity")({
  loader: async ({ context }) => {
    if (typeof window === 'undefined' && !context.session) {
      return [];
    }
    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? localStorage.getItem('active_role') ?? undefined) : undefined;
    return await getLeadsData({ data: { activeRole } });
  },
  head: () => ({
    meta: [
      { title: "AI Activity — Builder's Edge" },
      { name: "description", content: "AI conversation log and scripts." },
    ],
  }),
  component: AIPage,
});

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
          {label}
        </div>
        <span
          className="size-7 rounded-md flex items-center justify-center"
          style={{ background: color + "18" }}
        >
          <Icon className="size-3.5" style={{ color }} />
        </span>
      </div>
      <div className="font-display text-3xl font-semibold text-foreground mt-3">
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1.5">{sub}</div>
    </Card>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const style =
    channel === "SMS"
      ? "bg-[#30D158]/12 text-[#30D158]"
      : "bg-[#0A84FF]/12 text-[#4DA6FF]";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md ${style}`}>
      {channel}
    </span>
  );
}

export function getCleanLeadName(lead: { id: string; name: string } | null | undefined) {
  if (!lead) return "Client";
  if (lead.name === "Homeowner (Direct)" || !lead.name) {
    const names = [
      "Sarah Jenkins", "Robert Taylor", "Michael Chang", "Emily Rodriguez",
      "David Vance", "Amanda Miller", "James Wilson", "Jessica Martinez",
      "William Thomas", "Ashley Jackson", "Brian White", "Megan Harris",
      "Kevin Martin", "Rachel Thompson", "Daniel Garcia", "Elizabeth Martinez",
      "Matthew Robinson", "Lauren Clark", "Justin Lewis", "Olivia Walker"
    ];
    let hash = 0;
    for (let i = 0; i < lead.id.length; i++) {
      hash = lead.id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % names.length;
    return names[index];
  }
  return lead.name;
}

function AIPage() {
  const { session } = useRouteContext({ strict: false }) as any;
  const isPrivacyMode = session?.role === 'admin' && !!session?.actingAsBuilderId;

  const loaderData = useLoaderData({ from: '/ai-activity' });
  const leads = (loaderData as any) || [];

  // Script customization state
  const [scriptInstruction, setScriptInstruction] = useState("");
  const [isGeneratingScripts, setIsGeneratingScripts] = useState(false);
  const [scripts, setScripts] = useState([
    {
      t: "Message 1 · Immediate (< 60s)",
      body: "Hi [Name], I noticed your new residential building permit application filed in [County] County. I'm Your Name's assistant from Your Company. Since custom builds in Austin require early structural reviews, have you already hired a general builder?",
      color: "#30D158",
    },
    {
      t: "Message 2 · 2 hours later (no reply)",
      body: "Hey [Name], just following up! I wanted to text you our Austin Permitting Checklist (saves weeks on site preparation and HOA reviews). Do you already own the lot?",
      color: "#FF9F0A",
    },
    {
      t: "Message 3 · 24 hours later",
      body: "Hi [Name], we have a private tour of our Lakeway contemporary model home this Saturday morning. Would you like me to book your spot?",
      color: "#0A84FF",
    },
  ]);

  // Master conversation logs state (lead-based dictionary)
  const [conversations, setConversations] = useState<Record<string, any>>({});
  const [activeModalLeadId, setActiveModalLeadId] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<'HOT' | 'COLD' | 'WARM' | null>(null);

  // Chat Simulator State
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);



  // Set default initial lead if not set
  useEffect(() => {
    if (leads.length > 0 && !selectedLeadId) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  // Keep chat history in sync with selected lead and conversations dict
  useEffect(() => {
    if (!selectedLeadId) return;

    const leadObj = leads.find((l: any) => l.id === selectedLeadId);
    if (!leadObj) return;

    const tier = leadObj.scoreTier?.toUpperCase();
    if (tier === "HOT") setLastIntent("HOT");
    else if (tier === "COLD") setLastIntent("COLD");
    else setLastIntent("WARM");

    if (conversations[selectedLeadId]) {
      setChatHistory(conversations[selectedLeadId].messages);
    } else {
      const name = getCleanLeadName(leadObj);
      const defaultGreeting = [
        { role: 'assistant' as const, content: `Hi, I noticed your new residential building permit application filed in ${leadObj.county || 'Travis County'}. I'm Alex, Your Name's assistant from Your Company. Since custom builds in Austin require early structural reviews, have you already hired a general builder?` }
      ];
      setChatHistory(defaultGreeting);
    }
  }, [selectedLeadId, conversations, leads]);

  // Close modal on Esc keypress
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModalLeadId(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isThinking]);

  // Update simulator whenever chosen lead changes to populate customized greet
  const handleLeadChange = (leadId: string) => {
    setSelectedLeadId(leadId);
  };

  // Quick Suggestion handler
  const selectSuggestion = (text: string) => {
    setInputMessage(text);
  };

  // Submit Simulated SMS Chat to Groq
  const handleSendSimulatedSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isThinking || !selectedLeadId) return;

    const userText = inputMessage;
    setInputMessage("");

    // Add user message immediately
    const updatedHistory = [...chatHistory, { role: 'user' as const, content: userText }];
    setChatHistory(updatedHistory);
    setIsThinking(true);

    const leadObj = leads.find((l: any) => l.id === selectedLeadId);
    const name = leadObj ? getCleanLeadName(leadObj) : "Client";

    // Update conversation logs immediately
    setConversations(prev => ({
      ...prev,
      [selectedLeadId]: {
        leadId: selectedLeadId,
        leadName: name,
        scoreTier: leadObj?.scoreTier || "Warm",
        county: leadObj?.county || "Travis County",
        lastMessageAt: "Just now",
        messages: updatedHistory
      }
    }));

    try {
      const response = await simulateAIChatReply({
        data: {
          leadId: selectedLeadId,
          userMessage: userText,
          chatHistory: chatHistory
        }
      });

      const reply = response.replyText;
      const intent = (response as any).intent || 'WARM';

      setLastIntent(intent);

      const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: reply }];
      setChatHistory(finalHistory);

      // Determine outcome label
      let outcome = "Nurturing";
      if (intent === "HOT") outcome = "Qualified";
      else if (intent === "COLD") outcome = "Disqualified";

      // Save complete AI response back to persistent local storage dictionary
      setConversations(prev => ({
        ...prev,
        [selectedLeadId]: {
          leadId: selectedLeadId,
          leadName: name,
          scoreTier: intent.charAt(0) + intent.slice(1).toLowerCase(),
          county: leadObj?.county || "Travis County",
          lastMessageAt: "Just now",
          messages: finalHistory
        }
      }));
    } catch (err) {
      console.error("Failed to fetch AI reply:", err);
      const errHistory = [...updatedHistory, { role: 'assistant' as const, content: "Sorry, I am having trouble connecting to the Alex AI engine. Let me retry." }];
      setChatHistory(errHistory);
      setConversations(prev => ({
        ...prev,
        [selectedLeadId]: {
          leadId: selectedLeadId,
          leadName: name,
          scoreTier: "Warm",
          county: leadObj?.county || "Travis County",
          lastMessageAt: "Just now",
          messages: errHistory
        }
      }));
    } finally {
      setIsThinking(false);
    }
  };

  const handleDeleteConversation = (leadId: string) => {
    setConversations(prev => {
      const copy = { ...prev };
      delete copy[leadId];
      return copy;
    });
    if (selectedLeadId === leadId) {
      setChatHistory([]);
    }
    if (activeModalLeadId === leadId) {
      setActiveModalLeadId(null);
    }
  };

  // Regenerate Nurture Sequences via Alex AI Groq
  const handleRegenerateScripts = async () => {
    if (!scriptInstruction.trim() || isGeneratingScripts) return;
    setIsGeneratingScripts(true);

    try {
      const response = await generateAIScriptUpdate({
        data: { instruction: scriptInstruction }
      });

      if (Array.isArray(response) && response.length === 3) {
        const updated = response.map((m, idx) => ({
          t: m.t || `Message ${idx + 1}`,
          body: m.body,
          color: idx === 0 ? "#30D158" : idx === 1 ? "#FF9F0A" : "#0A84FF"
        }));
        setScripts(updated);
        setScriptInstruction("");
      }
    } catch (err) {
      console.error("Failed to generate custom scripts:", err);
    } finally {
      setIsGeneratingScripts(false);
    }
  };

  return (
    <Shell title="AI Activity">

      {/* Status header */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
          <span className="relative inline-flex rounded-full size-2 bg-success" />
        </span>
        <span className="text-xs text-muted-foreground">
          AI agent is <span className="text-success font-medium">active</span> — processing leads in real-time
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="Active AI Conversations"
          value={`${Object.keys(conversations).length}`}
          sub="Persistent tracked channels"
          icon={Bot}
          color="#00a884"
        />
        <Stat
          label="Avg Lead Response Time"
          value={Object.keys(conversations).length > 0 ? "Live" : "—"}
          sub="From AI send → lead reply"
          icon={Clock}
          color="#FF9F0A"
        />
        <Stat
          label="Converted to Qualified"
          value={`${Object.values(conversations).filter((c: any) => c.scoreTier === 'Hot' || c.scoreTier === 'hot').length}`}
          sub="By AI follow-up"
          icon={Zap}
          color="#30D158"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4 items-start">
        
        {/* Left Side: Master Conversation Log */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="h-[520px] flex flex-col overflow-hidden">
            <CardHeader
              title="Conversation Log"
              subtitle="Inspect lead message history, view context, or delete chats to manage space"
            />
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
              <table className="w-full text-sm">
                <thead className="bg-[#161618] text-xs text-muted-foreground uppercase tracking-wider border-b border-border sticky top-0 backdrop-blur z-10">
                  <tr className="text-left">
                    <th className="px-5 py-3 font-medium">Lead</th>
                    <th className="px-5 py-3 font-medium">County</th>
                    <th className="px-5 py-3 font-medium text-center">Total Chats</th>
                    <th className="px-5 py-3 font-medium">Last Active</th>
                    <th className="px-5 py-3 font-medium">Outcome</th>
                    <th className="px-5 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(conversations).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2 py-4">
                          <Bot className="size-7 text-muted-foreground/30 animate-pulse" />
                          <span className="text-xs">No AI conversations logged yet.</span>
                          <span className="text-[10px] text-muted-foreground/60 max-w-xs">
                            Select a target lead in the simulator widget to start a live SMS interaction with Alex!
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    Object.values(conversations).map((c: any) => {
                      const msgCount = c.messages ? c.messages.length : 0;
                      const outcome = c.scoreTier === "Hot" ? "Qualified" : c.scoreTier === "Cold" ? "Disqualified" : "Nurturing";
                      return (
                        <tr
                          key={c.leadId}
                          onDoubleClick={() => setActiveModalLeadId(c.leadId)}
                          className="border-t border-border hover:bg-white/[0.02] transition-colors cursor-pointer select-none"
                          title="Double-click to view full conversation history"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col">
                              <span className="text-foreground font-medium">{isPrivacyMode ? obscurePII(c.leadName, 'name') : c.leadName}</span>
                              <div className="mt-1">
                                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold tracking-wider rounded uppercase ${
                                  c.scoreTier === "Hot" || c.scoreTier === "hot"
                                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    : c.scoreTier === "Cold" || c.scoreTier === "cold"
                                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                }`}>
                                  {c.scoreTier}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-muted-foreground">{c.county}</td>
                          <td className="px-5 py-3.5 text-center font-mono font-medium text-foreground">{msgCount}</td>
                          <td className="px-5 py-3.5 text-muted-foreground text-xs font-mono">{c.lastMessageAt}</td>
                          <td className="px-5 py-3.5">
                            <Badge
                              tone={
                                outcome === "Qualified"
                                  ? "hot"
                                  : outcome === "Disqualified"
                                    ? "cold"
                                    : "warm"
                              }
                            >
                              {outcome}
                            </Badge>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => setActiveModalLeadId(c.leadId)}
                                className="size-8 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center text-foreground transition-all duration-200"
                                title="View Full Conversation"
                              >
                                <Eye className="size-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteConversation(c.leadId)}
                                className="size-8 rounded-lg border border-red-500/20 hover:border-red-500/40 bg-red-500/[0.03] hover:bg-red-500/[0.12] flex items-center justify-center text-red-400 transition-all duration-200"
                                title="Delete Conversation Log"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Side: Alex AI SMS simulator widget */}
        <div className="lg:col-span-1">
          <Card className="flex flex-col h-[520px] overflow-hidden border border-[#00a884]/20 relative">
            
            {/* Header info */}
            <div className="p-4 bg-[#1f2c34] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-full bg-[#00a884]/15 flex items-center justify-center border border-[#00a884]/30">
                  <BrainCircuit className="size-4 text-[#00a884] animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Alex Concierge Simulator</h4>
                  <span className="text-[10px] text-muted-foreground">Your Company AI Agent</span>
                </div>
              </div>
              
              {/* Active ripple indicator */}
              <Badge tone="success">
                Live Engine
              </Badge>
            </div>

            {/* Custom Premium Dropdown Selector */}
            <div className="px-4 py-2.5 bg-secondary border-b border-border flex items-center justify-between gap-2 relative z-50">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider min-w-[70px]">
                Target Lead:
              </label>
              
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full bg-black/50 border border-white/10 hover:border-[#00a884]/40 rounded px-2.5 py-1 text-xs text-foreground text-left flex items-center justify-between focus:outline-none transition-colors"
                >
                  <span className="truncate">
                    {isPrivacyMode ? obscurePII(getCleanLeadName(leads.find((l: any) => l.id === selectedLeadId)), 'name') : (getCleanLeadName(leads.find((l: any) => l.id === selectedLeadId)) || "Select Lead")} 
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      ({leads.find((l: any) => l.id === selectedLeadId)?.scoreTier || "Warm"})
                    </span>
                  </span>
                  <ChevronDown className="size-3.5 text-muted-foreground ml-1 flex-shrink-0" />
                </button>

                {isDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsDropdownOpen(false)} 
                    />
                    
                    {/* Floating Scrolled Dropdown (10 items max-height: ~300px) */}
                    <div className="absolute left-0 right-0 mt-1 max-h-[300px] overflow-y-auto bg-[#161618] border border-white/10 rounded-md shadow-2xl z-50 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      {leads.map((l: any) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            handleLeadChange(l.id);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-[#00a884]/10 transition-colors flex items-center justify-between ${
                            l.id === selectedLeadId 
                              ? "bg-[#00a884]/15 text-[#00a884] font-medium" 
                              : "text-foreground hover:text-white"
                          }`}
                        >
                          <span className="truncate">{isPrivacyMode ? obscurePII(getCleanLeadName(l), 'name') : getCleanLeadName(l)}</span>
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                            l.scoreTier === "Hot" 
                              ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" 
                              : l.scoreTier === "Warm" 
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}>
                            {l.scoreTier}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Phone Message Body */}
            <div 
              ref={chatContainerRef} 
              className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-none"
              style={{
                backgroundColor: "#0b141a",
                backgroundImage: "radial-gradient(rgba(0, 168, 132, 0.04) 1.5px, transparent 1.5px)",
                backgroundSize: "20px 20px"
              }}
            >
              {chatHistory.map((m, index) => {
                const isAgent = m.role === 'assistant';
                return (
                  <div
                    key={index}
                    className={`flex ${isAgent ? 'justify-end' : 'justify-start'} items-start gap-2.5`}
                  >
                    {!isAgent && (
                      <div className="size-7 rounded-full bg-[#202c33]/30 border border-white/10 flex items-center justify-center shrink-0">
                        <User className="size-3.5 text-[#00a884]" />
                      </div>
                    )}
                    <div className={`flex flex-col max-w-[80%] ${isAgent ? "items-end" : "items-start"}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-md ${
                          isAgent
                            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none border border-white/[0.03]'
                            : 'bg-[#202c33] text-[#e9edef] border border-white/[0.03] rounded-tl-none'
                        }`}
                      >
                        <p className={isPrivacyMode ? "blur-[4px] select-none opacity-50" : ""}>{m.content}</p>
                      </div>
                    </div>
                    {isAgent && (
                      <div className="size-7 rounded-full bg-[#005c4b]/30 border border-[#00a884]/30 flex items-center justify-center shrink-0">
                        <Bot className="size-3.5 text-[#00a884]" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isThinking && (
                <div className="flex justify-end items-start gap-2.5">
                  <div className="flex flex-col max-w-[80%] items-end">
                    <div className="bg-[#005c4b] border border-white/[0.03] rounded-2xl rounded-tr-none px-3.5 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="relative flex size-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00a884] opacity-75" />
                        <span className="relative inline-flex rounded-full size-2 bg-[#00a884]" />
                      </span>
                      <span className="text-[#e9edef]/80">Alex is typing...</span>
                    </div>
                  </div>
                  <div className="size-7 rounded-full bg-[#005c4b]/30 border border-[#00a884]/30 flex items-center justify-center shrink-0">
                    <Bot className="size-3.5 text-[#00a884] animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Last Intent Classification Display */}
            {lastIntent && (
              <div className="px-4 py-2 bg-[#1f2c34] border-t border-white/10 flex items-center justify-between gap-2 transition-all">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  AI Lead Intent Detected:
                </span>
                <Badge
                  tone={
                    lastIntent === "HOT"
                      ? "hot"
                      : lastIntent === "COLD"
                        ? "neutral"
                        : "warm"
                  }
                >
                  {lastIntent === "HOT" ? "🔥 HOT (Qualified)" : lastIntent === "COLD" ? "🧊 COLD (Disqualified)" : "🌤 WARM (Nurturing)"}
                </Badge>
              </div>
            )}

            {/* Suggested quick inputs */}
            <div className="px-3 py-1.5 bg-secondary border-t border-border">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                Suggested Lead Questions:
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  "Do you use custom kitchen cabinets?",
                  "Can we schedule a home tour Sat?",
                  "What is permitting time in Austin?"
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="text-[10px] bg-black/40 hover:bg-[#00a884]/10 border border-white/10 hover:border-[#00a884]/30 px-2 py-0.5 rounded text-muted-foreground hover:text-foreground transition-all duration-150"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone Message Input */}
            <form onSubmit={handleSendSimulatedSMS} className="p-3 bg-secondary border-t border-border flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Type customer reply message..."
                disabled={isThinking || !selectedLeadId}
                className="flex-1 bg-black/60 border border-white/10 rounded-full px-4 py-2 text-xs placeholder:text-muted-foreground text-foreground focus:outline-none focus:border-white/20 transition-all"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isThinking || !selectedLeadId}
                className="size-8 rounded-full bg-[#00a884] hover:bg-[#00a884]/80 text-[#e9edef] flex items-center justify-center transition-colors disabled:opacity-40"
              >
                <Send className="size-3.5" />
              </button>
            </form>

          </Card>
        </div>

      </div>

      {/* AI Scripts */}
      <Card className="mt-4">
        <CardHeader
          title="AI Follow-up Nurture Scripts"
          subtitle="Dynamically updated via Alex AI"
        />
        <div className="p-5 space-y-3">
          
          {/* Card Sequence Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {scripts.map((m) => (
              <div
                key={m.t}
                className="border border-border rounded-md p-4 bg-white/[0.02] hover:bg-white/[0.03] transition-colors flex flex-col justify-between"
                style={{ borderLeftColor: m.color, borderLeftWidth: 3 }}
              >
                <div>
                  <div
                    className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                    style={{ color: m.color }}
                  >
                    {m.t}
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{m.body}</p>
                </div>
              </div>
            ))}
          </div>

          {/* AI Generator Instruction form */}
          <div className="pt-4 border-t border-border mt-4">
            <label className="text-xs font-semibold uppercase tracking-widest text-[#00a884] flex items-center gap-1">
              <Sparkles className="size-3 text-[#00a884]" />
              Rewrite follow-up sequence with Alex AI
            </label>
            <textarea
              value={scriptInstruction}
              onChange={(e) => setScriptInstruction(e.target.value)}
              className="mt-2 w-full h-20 bg-secondary border border-border rounded-md p-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:border-white/20 resize-none transition-all duration-150"
              placeholder="e.g., 'Make message 3 suggest meeting for gourmet coffee in Lakeway rather than a generic model tour, and keep the tone extremely friendly...'"
            />
            <button
              onClick={handleRegenerateScripts}
              disabled={!scriptInstruction.trim() || isGeneratingScripts}
              className="mt-2 flex items-center gap-1.5 bg-white text-black rounded-md px-4 py-2 text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-40"
            >
              {isGeneratingScripts ? (
                <>
                  <div className="size-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Generating sequence...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Rewrite Campaign Scripts
                </>
              )}
            </button>
          </div>
        </div>
      </Card>

      {/* Conversation Detail Modal */}
      {activeModalLeadId && (
        <div className="fixed top-[60px] left-[240px] right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-5xl bg-[#0b141a] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 h-full max-h-[calc(100%-2rem)]"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 bg-[#1f2c34] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-[#00a884]/15 border border-[#00a884]/30 flex items-center justify-center">
                  <Bot className="size-5 text-[#00a884]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground text-left">
                    {isPrivacyMode ? obscurePII(conversations[activeModalLeadId]?.leadName, 'name') : (conversations[activeModalLeadId]?.leadName || "AI Conversation Detail")}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      County: {conversations[activeModalLeadId]?.county || "Unknown"}
                    </span>
                    <span className="inline-block size-1 bg-muted-foreground/30 rounded-full" />
                    <span className={`inline-flex items-center text-[9px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 ${
                      conversations[activeModalLeadId]?.scoreTier === "Hot" || conversations[activeModalLeadId]?.scoreTier === "hot"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : conversations[activeModalLeadId]?.scoreTier === "Cold" || conversations[activeModalLeadId]?.scoreTier === "cold"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {conversations[activeModalLeadId]?.scoreTier || "Nurturing"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveModalLeadId(null)}
                className="size-8 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.08] flex items-center justify-center text-muted-foreground hover:text-foreground transition-all"
                title="Close (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Conversation Messages */}
            <div 
              className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-white/10 text-left"
              style={{
                backgroundColor: "#0b141a",
                backgroundImage: "radial-gradient(rgba(0, 168, 132, 0.05) 1.5px, transparent 1.5px)",
                backgroundSize: "24px 24px"
              }}
            >
              {(!conversations[activeModalLeadId]?.messages || conversations[activeModalLeadId].messages.length === 0) ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                  <MessageSquare className="size-8 text-muted-foreground/20 animate-pulse" />
                  <span className="text-xs">No chat history available for this lead.</span>
                </div>
              ) : (
                conversations[activeModalLeadId].messages.map((m: any, idx: number) => {
                  const isAgent = m.role === "assistant";
                  return (
                    <div 
                      key={idx} 
                      className={`flex ${isAgent ? "justify-end text-right" : "justify-start text-left"} items-start gap-2.5`}
                    >
                      {!isAgent && (
                        <div className="size-7 rounded-full bg-[#202c33]/30 border border-white/10 flex items-center justify-center shrink-0">
                          <User className="size-3.5 text-[#00a884]" />
                        </div>
                      )}
                      <div className={`flex flex-col max-w-[80%] ${isAgent ? "items-end" : "items-start"}`}>
                        <div className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-md ${
                          isAgent 
                            ? "bg-[#005c4b] text-[#e9edef] rounded-tr-none border border-white/[0.03]" 
                            : "bg-[#202c33] text-[#e9edef] rounded-tl-none border border-white/[0.03]"
                        }`}>
                          <div className={isPrivacyMode ? "blur-[4px] select-none opacity-50" : ""}>{m.content}</div>
                        </div>
                      </div>
                      {isAgent && (
                        <div className="size-7 rounded-full bg-[#005c4b]/30 border border-[#00a884]/30 flex items-center justify-center shrink-0">
                          <Bot className="size-3.5 text-[#00a884]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with actions */}
            <div className="p-4 border-t border-white/10 bg-[#1f2c34] flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Press <kbd className="px-1 py-0.5 bg-white/5 border border-white/10 rounded font-mono text-[9px]">Esc</kbd> key to close
              </span>
              <button
                onClick={() => {
                  const id = activeModalLeadId;
                  setActiveModalLeadId(null);
                  handleDeleteConversation(id);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 hover:border-red-500/40 bg-red-500/[0.03] hover:bg-red-500/[0.12] text-red-400 text-xs transition-all duration-200"
              >
                <Trash2 className="size-3.5" />
                Clear Chat History
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
