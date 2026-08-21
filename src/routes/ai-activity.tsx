import { RoutePending } from "@/components/dashboard/RoutePending";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { Shell } from "@/components/dashboard/Shell";
import { Card, CardHeader, Badge } from "@/components/dashboard/primitives";
import { CustomSelect } from "@/components/dashboard/CustomSelect";
import { 
  Bot, Zap, Clock, MessageSquare, Send, Sparkles, User, BrainCircuit, 
  ChevronDown, Trash2, Eye, X, Shield, Target, Compass, CalendarCheck, 
  Sliders, Check, CheckCircle2, Volume2, FileText, Layers, Wand2, RefreshCw,
  Building2, ArrowRight, Award, TrendingUp, AlertTriangle, ShieldAlert,
  CheckSquare, XCircle, DollarSign, MapPin, Lightbulb, Home, Bookmark
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { 
  getLeadsData, 
  simulateAIChatReply, 
  generateAIScriptUpdate, 
  getBuilderProfile, 
  getAiBrainConfig, 
  saveAiBrainConfig 
} from "@/lib/dashboard";
import { obscurePII } from "@/lib/utils";
import { useRouteContext } from "@tanstack/react-router";

export const Route = createFileRoute("/ai-activity")({
  loader: ({ context }) => {
    if (typeof window === 'undefined' && !context.session) {
      return { leads: [], brainConfig: {}, builderProfile: {} };
    }
    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
    return Promise.all([
      getLeadsData({ data: { activeRole } }),
      getAiBrainConfig(),
      getBuilderProfile({ data: { activeRole } })
    ]).then(([leads, brainConfig, builderProfile]) => ({
      leads: leads || [],
      brainConfig: brainConfig || {},
      builderProfile: builderProfile || {}
    }));
  },
  head: () => ({
    meta: [
      { title: "AI Brain & Knowledge Engine — WeaverFrame" },
      { name: "description", content: "AI Brain Studio, conversation objectives, qualification rules, and live simulator." },
    ],
  }),
  staleTime: 60_000,
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading AI Brain Studio..." type="ai-activity" />,
  component: AIPage,
});

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

const goalOptions = [
  { value: "book_consultation", label: "Book Consultation / Tour (High Conversion)" },
  { value: "qualify_readiness", label: "Strict Project Qualification (Lead Filter)" },
  { value: "nurture_educate", label: "Architectural Advisory & Nurture (Trust Building)" },
];

const goalDescriptions: Record<string, string> = {
  book_consultation: "Guides homeowner leads towards scheduling a showroom visit, architectural discovery call, or site meeting once interest is verified.",
  qualify_readiness: "Deeply qualifies construction budget, lot readiness, and timeline before offering meetings to prevent wasting sales team time.",
  nurture_educate: "Warmly educates homeowners on custom build stages, permitting, and architectural ideas without aggressive sales pressure.",
};

const voiceOptions = [
  { value: "luxury_bespoke", label: "Quiet Luxury & Elegance (Default)" },
  { value: "warm_consultative", label: "Warm & Consultative (Advisor)" },
  { value: "direct_executive", label: "Direct & Fast Executive (High Speed)" },
];

const voiceDescriptions: Record<string, string> = {
  luxury_bespoke: "Refined, polite, understated prestige. Speaks with the dignity and sophistication expected by high-net-worth estate clients.",
  warm_consultative: "Friendly, empathetic, and encouraging. Treats homeowners like valued partners embarking on their dream custom build.",
  direct_executive: "Crisp, concise, and strictly to the point. No fluff or lengthy explanations. Maximizes speed-to-lead response clarity.",
};

function WhatsAppDoodleBackground({ idPrefix = "sim" }: { idPrefix?: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none opacity-40">
      <svg className="w-full h-full text-white" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* LAYER A — base density layer */}
          <pattern id={`${idPrefix}-doodle-layer-a`} width="190" height="190" patternUnits="userSpaceOnUse">
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
          <pattern id={`${idPrefix}-doodle-layer-b`} width="137" height="167" patternUnits="userSpaceOnUse" x="61" y="94">
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
          <pattern id={`${idPrefix}-doodle-layer-c`} width="155" height="124" patternUnits="userSpaceOnUse" x="29" y="118">
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

        <rect width="100%" height="100%" fill={`url(#${idPrefix}-doodle-layer-a)`} />
        <rect width="100%" height="100%" fill={`url(#${idPrefix}-doodle-layer-b)`} />
        <rect width="100%" height="100%" fill={`url(#${idPrefix}-doodle-layer-c)`} />
      </svg>
    </div>
  );
}

function AIPage() {
  const { session } = useRouteContext({ strict: false }) as any;
  const isPrivacyMode = session?.role === 'admin' && !!session?.actingAsBuilderId;

  const loaderData = useLoaderData({ from: '/ai-activity' }) as any;
  const leads = (loaderData?.leads as any[]) || [];
  const initialBrainConfig = loaderData?.brainConfig || {};
  const initialProfile = loaderData?.builderProfile || {};

  // Active Main View Tab
  const [activeTab, setActiveTab] = useState<"studio" | "simulator" | "logs">("studio");

  // ── AI Brain Studio State ───────────────────────────────────────────────────
  const [primaryGoal, setPrimaryGoal] = useState<string>(initialBrainConfig.primaryGoal || "book_consultation");
  const [brandVoice, setBrandVoice] = useState<string>(initialBrainConfig.brandVoice || "luxury_bespoke");
  const [personaName, setPersonaName] = useState<string>(initialBrainConfig.personaName || initialProfile.primaryContact || "Alex");
  const [minBudget, setMinBudget] = useState<string>(initialBrainConfig.minBudget || "$500,000");
  const [maxTimeline, setMaxTimeline] = useState<string>(initialBrainConfig.maxTimeline || "12");
  const [lotRequirement, setLotRequirement] = useState<string>(initialBrainConfig.lotRequirement || "actively_shopping");
  const [plansRequirement, setPlansRequirement] = useState<string>(initialBrainConfig.plansRequirement || "any");
  const [minLeadScore, setMinLeadScore] = useState<number>(initialBrainConfig.minLeadScore ?? 60);
  const [customDirectives, setCustomDirectives] = useState<string>(initialBrainConfig.customDirectives || "");

  const [isSavingBrain, setIsSavingBrain] = useState(false);
  const [brainSaved, setBrainSaved] = useState(false);

  const handleSaveBrain = async () => {
    setIsSavingBrain(true);
    try {
      await saveAiBrainConfig({
        data: {
          primaryGoal,
          brandVoice,
          personaName,
          minBudget,
          maxTimeline,
          lotRequirement,
          plansRequirement,
          minLeadScore,
          customDirectives,
        }
      });
      setBrainSaved(true);
      setTimeout(() => setBrainSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save AI Brain config:", err);
      alert("Failed to save AI Brain settings.");
    } finally {
      setIsSavingBrain(false);
    }
  };

  const addDirectiveChip = (text: string) => {
    setCustomDirectives(prev => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed}\n- ${text}` : `- ${text}`;
    });
  };

  // ── Chat Simulator State ────────────────────────────────────────────────────
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [lastIntent, setLastIntent] = useState<'HOT' | 'COLD' | 'WARM' | null>(null);
  const [conversations, setConversations] = useState<Record<string, any>>({});
  const [activeModalLeadId, setActiveModalLeadId] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ── Live AI Sales Intelligence & Extracted Memory State ─────────────────────
  const [liveIntelligence, setLiveIntelligence] = useState<{
    dealScore: number;
    dealSummary: string;
    leadMemory: Record<string, any>;
    qualification: {
      budgetQualified?: boolean;
      timelineQualified?: boolean;
      lotQualified?: boolean;
      decisionMaker?: boolean;
      overallStatus?: string;
    };
    objectionStrategyUsed: string | null;
    nextBestAction: string;
    escalationRequired: boolean;
    escalationReason: string | null;
  } | null>(null);

  // Set default initial lead
  useEffect(() => {
    if (leads.length > 0 && !selectedLeadId) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  // Keep chat history and memory in sync with selected lead
  useEffect(() => {
    if (!selectedLeadId) return;

    const leadObj = leads.find((l: any) => l.id === selectedLeadId);
    if (!leadObj) return;

    const tier = leadObj.scoreTier?.toUpperCase();
    if (tier === "HOT") setLastIntent("HOT");
    else if (tier === "COLD") setLastIntent("COLD");
    else setLastIntent("WARM");

    // Initialize live intelligence state from lead properties
    let parsedMemory: Record<string, any> = {};
    if (leadObj.leadMemory) {
      try { parsedMemory = JSON.parse(leadObj.leadMemory); } catch (_) {}
    }

    let parsedQual: Record<string, any> = {};
    if (leadObj.qualificationData) {
      try { parsedQual = JSON.parse(leadObj.qualificationData); } catch (_) {}
    }

    setLiveIntelligence({
      dealScore: leadObj.dealScore || (tier === "HOT" ? 85 : tier === "COLD" ? 20 : 55),
      dealSummary: leadObj.lastAiSummary || parsedQual.dealSummary || "Homeowner lead inquiring on custom estate build.",
      leadMemory: {
        budgetRange: parsedMemory.budgetRange || (leadObj.estimatedBudget ? `$${(leadObj.estimatedBudget / 1000).toFixed(0)}k` : null),
        lotStatus: parsedMemory.lotStatus || (leadObj.landPrice > 0 ? `Owns buildable land ($${(leadObj.landPrice / 1000).toFixed(0)}k)` : null),
        timeline: parsedMemory.timeline || "< 12 Months",
        architecturalStyle: parsedMemory.architecturalStyle || "Modern Bespoke Estate",
        familyLifestyleNeeds: parsedMemory.familyLifestyleNeeds || "Primary residence",
        objectionsRaised: parsedMemory.objectionsRaised || [],
        keyPreferences: parsedMemory.keyPreferences || ["Fixed-Scope Architectural Finish"]
      },
      qualification: parsedQual.qualification || {
        budgetQualified: !!(leadObj.estimatedBudget && leadObj.estimatedBudget >= 500000),
        timelineQualified: true,
        lotQualified: !!(leadObj.landPrice && leadObj.landPrice > 0),
        decisionMaker: true,
        overallStatus: leadObj.status || "Qualified"
      },
      objectionStrategyUsed: parsedQual.objectionStrategyUsed || "Value-Framed Architectural Advisory",
      nextBestAction: parsedQual.nextBestAction || "Offer private showroom walkthrough & site feasibility study.",
      escalationRequired: !!parsedQual.escalationRequired,
      escalationReason: parsedQual.escalationReason || null
    });

    if (conversations[selectedLeadId]) {
      setChatHistory(conversations[selectedLeadId].messages);
    } else {
      const name = getCleanLeadName(leadObj);
      const greeting = [
        { 
          role: 'assistant' as const, 
          content: `Hi ${name}, I noticed your residential permit inquiry filed in ${leadObj.county || 'Travis County'}. I'm ${personaName}, executive concierge representing ${initialProfile.companyName || 'our custom estate studio'}. Are you currently exploring a custom build, or have you already engaged a general contractor?` 
        }
      ];
      setChatHistory(greeting);
    }
  }, [selectedLeadId, conversations, leads, personaName, initialProfile.companyName]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isThinking]);

  // Close modal on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModalLeadId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSendSimulatedSMS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isThinking || !selectedLeadId) return;

    const userText = inputMessage;
    setInputMessage("");

    const updatedHistory = [...chatHistory, { role: 'user' as const, content: userText }];
    setChatHistory(updatedHistory);
    setIsThinking(true);

    const leadObj = leads.find((l: any) => l.id === selectedLeadId);
    const name = leadObj ? getCleanLeadName(leadObj) : "Client";

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
      const response: any = await simulateAIChatReply({
        data: {
          leadId: selectedLeadId,
          userMessage: userText,
          chatHistory: chatHistory,
          isSimulated: true
        }
      });

      const reply = response.replyText;
      const intent = response.intent || 'WARM';

      setLastIntent(intent);

      // Update Live Intelligence state from structured AI response
      if (response.dealScore !== undefined || response.leadMemory) {
        setLiveIntelligence({
          dealScore: response.dealScore || 75,
          dealSummary: response.dealSummary || "Lead actively interacting with AI Concierge.",
          leadMemory: response.leadMemory || {},
          qualification: response.qualification || {},
          objectionStrategyUsed: response.objectionStrategyUsed || null,
          nextBestAction: response.nextBestAction || "Continue consultative conversation.",
          escalationRequired: !!response.escalationRequired,
          escalationReason: response.escalationReason || null
        });
      }

      const finalHistory = [...updatedHistory, { role: 'assistant' as const, content: reply }];
      setChatHistory(finalHistory);

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
      const errHistory = [...updatedHistory, { role: 'assistant' as const, content: `I apologize for the brief pause. How can I best assist with your custom build plans?` }];
      setChatHistory(errHistory);
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
  };

  return (
    <Shell title="AI Brain & Knowledge Engine">
      {/* ── Studio Top Controls Bar (Integrated with Nav Bar) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            AI Brain Active · Real-Time LLM Sync
          </span>
          <span className="text-xs text-muted-foreground hidden md:inline font-mono">
            Tuned for {initialProfile.companyName || 'your custom estate studio'}
          </span>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center p-1 rounded-xl bg-card border border-border shadow-sm">
          <button
            onClick={() => setActiveTab("studio")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "studio"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BrainCircuit className="size-3.5" />
            <span>AI Brain Studio</span>
          </button>

          <button
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "simulator"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="size-3.5" />
            <span>Live Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="size-3.5" />
            <span>History ({Object.keys(conversations).length})</span>
          </button>
        </div>
      </div>

      {/* ── TAB 1: AI BRAIN STUDIO & KNOWLEDGE CONTROLS ── */}
      {activeTab === "studio" && (
        <div className="space-y-6 max-w-5xl">
          
          {/* Top Save & Deploy Action Bar */}
          <div className="p-4 rounded-2xl border border-[#c9a84c]/30 dark:border-[#e5d9c5]/30 bg-card flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5] shrink-0">
                <Wand2 className="size-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  Ready to deploy updates to your AI Brain?
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Changes take effect immediately across all SMS conversations and the live sandbox.
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveBrain}
              disabled={isSavingBrain}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0 ${
                brainSaved 
                  ? "bg-emerald-500 text-white border-emerald-600" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isSavingBrain ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Deploying...</span>
                </>
              ) : brainSaved ? (
                <>
                  <Check className="size-3.5" />
                  <span>Deployed & Active!</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Save & Deploy AI Brain</span>
                </>
              )}
            </button>
          </div>

          {/* 1. Primary AI Objective (Goal Dropdown) */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Target className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
                  1. Primary Conversational Goal
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c9a84c]/20 text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
                Core Mission
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground font-light">
              Select the primary conversational directive your AI Concierge pursues during outreach.
            </p>

            <div className="pt-1">
              <CustomSelect
                value={primaryGoal}
                onChange={(val) => setPrimaryGoal(val)}
                options={goalOptions}
              />
              <p className="text-xs text-muted-foreground font-light mt-2 p-3 rounded-xl bg-secondary/60 border border-border leading-relaxed">
                <strong className="text-foreground font-medium">Directive Behavior: </strong>
                {goalDescriptions[primaryGoal] || goalDescriptions.book_consultation}
              </p>
            </div>
          </div>

          {/* 2. Brand Voice, Persona & Tone Dropdown */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Volume2 className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
                  2. Brand Voice, Persona & Tone
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c9a84c]/20 text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
                Identity & Tone
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-light">
              Customize how the AI introduces itself, its representative name, and its communication style.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 pt-1">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80 mb-1.5">
                  AI Concierge Name
                </label>
                <input
                  type="text"
                  value={personaName}
                  onChange={e => setPersonaName(e.target.value)}
                  placeholder="e.g. Alex, Sarah, Liam"
                  className="w-full bg-input border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none transition-colors shadow-sm"
                />
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  The name the AI uses in message greetings (e.g. "I'm {personaName} from {initialProfile.companyName || 'your company'}").
                </p>
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80 mb-1.5">
                  Representing Company Name
                </label>
                <input
                  type="text"
                  disabled
                  value={initialProfile.companyName || "Your Custom Home Studio"}
                  className="w-full bg-muted/60 border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-muted-foreground cursor-not-allowed shadow-sm"
                />
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  Synced from your Builder Organization Profile.
                </p>
              </div>

              <div className="sm:col-span-12 space-y-1.5 pt-1">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80">
                  Brand Voice Tone Preset
                </label>
                <CustomSelect
                  value={brandVoice}
                  onChange={(val) => setBrandVoice(val)}
                  options={voiceOptions}
                />
                <p className="text-xs text-muted-foreground font-light mt-2 p-3 rounded-xl bg-secondary/60 border border-border leading-relaxed">
                  <strong className="text-foreground font-medium">Tone Behavior: </strong>
                  {voiceDescriptions[brandVoice] || voiceDescriptions.luxury_bespoke}
                </p>
              </div>
            </div>
          </div>

          {/* 3. In-Depth Qualification Criteria */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
                  3. Lead Qualification Rules & Strictness
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c9a84c]/20 text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
                Filters
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-light">
              Set the project thresholds the AI verifies before flagging a lead as Hot or booking a consultation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5">
              {/* Min Budget */}
              <div className="sm:col-span-6 space-y-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80">
                  Minimum Project Build Budget
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["$500,000", "$750,000", "$1,000,000", "$1,500,000", "$2,000,000+"].map((b) => (
                    <button
                      key={b}
                      onClick={() => setMinBudget(b)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                        minBudget === b
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                          : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={minBudget}
                  onChange={e => setMinBudget(e.target.value)}
                  placeholder="Or enter custom budget (e.g. $850,000)"
                  className="w-full bg-input border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none mt-1 shadow-sm"
                />
              </div>

              {/* Max Timeline */}
              <div className="sm:col-span-6 space-y-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80">
                  Target Construction Timeline
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { label: "< 6 Months", val: "6" },
                    { label: "6-12 Months", val: "12" },
                    { label: "12-24 Months", val: "24" },
                    { label: "Flexible", val: "flexible" }
                  ].map((t) => (
                    <button
                      key={t.val}
                      onClick={() => setMaxTimeline(t.val)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
                        maxTimeline === t.val
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                          : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-1">
                  Leads with start dates exceeding this window are handled as warm nurturing.
                </p>
              </div>

              {/* Lot / Land Status */}
              <div className="sm:col-span-6 space-y-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80">
                  Lot / Land Ownership Requirement
                </label>
                <CustomSelect
                  value={lotRequirement}
                  onChange={(val) => setLotRequirement(val)}
                  options={[
                    { value: "must_own_lot", label: "Must already own land or have lot under contract" },
                    { value: "actively_shopping", label: "Actively shopping for land (Lot evaluation offered)" },
                    { value: "any", label: "Any stage (Help homeowners source land from scratch)" },
                  ]}
                />
              </div>

              {/* Architectural Plans Status */}
              <div className="sm:col-span-6 space-y-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-foreground/80">
                  Architectural Plans Status
                </label>
                <CustomSelect
                  value={plansRequirement}
                  onChange={(val) => setPlansRequirement(val)}
                  options={[
                    { value: "any", label: "Open to all (Full architectural design & build service)" },
                    { value: "plans_ready", label: "Must have blueprints / architectural plans drafted" },
                    { value: "in_progress", label: "Architectural schematics in progress" },
                  ]}
                />
              </div>

              {/* Lead Score Threshold */}
              <div className="sm:col-span-12 pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-foreground/80">
                    Minimum Qualification Score for Hot Alert
                  </label>
                  <span className="font-mono text-xs text-primary font-bold px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                    {minLeadScore} / 100
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={minLeadScore}
                  onChange={e => setMinLeadScore(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1">
                  <span>0 (Lenient)</span>
                  <span>50 (Moderate)</span>
                  <span>80+ (Strict High-Ticket)</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Dynamic Custom Directives & Knowledge Box */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
                  4. Custom Business Directives & Policies
                </h3>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#c9a84c]/20 text-[#c9a84c] dark:text-[#e5d9c5] font-semibold">
                Directives Box
              </span>
            </div>

            <p className="text-xs text-muted-foreground font-light">
              Add custom instructions, warranty policies, service locations, or specific phrases your AI should mention or avoid.
            </p>

            {/* Quick Directive Suggestion Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase text-muted-foreground">Quick Add:</span>
              {[
                "10-Year Structural Warranty Included",
                "Never quote exact square foot price over text",
                "Specializing in Travis & Williamson Counties",
                "In-house architectural & interior design team",
                "Office open Mon-Sat 9am to 6pm"
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => addDirectiveChip(chip)}
                  className="px-2.5 py-1 text-[11px] rounded-lg border border-border bg-secondary hover:border-primary/40 text-foreground transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="text-primary font-bold">+</span>
                  <span>{chip}</span>
                </button>
              ))}
            </div>

            <textarea
              rows={5}
              value={customDirectives}
              onChange={e => setCustomDirectives(e.target.value)}
              placeholder="e.g. 
- We are a bespoke custom builder with over 20 years of experience in Westlake, Lakeway, and Barton Creek.
- We offer complimentary initial lot topography and feasibility reviews.
- When leads ask about cost per square foot, politely explain that custom homes vary based on architectural finishes and invite them for a personalized budget assessment.
- Never mention pricing under $500k."
              className="w-full bg-input border border-border rounded-xl p-4 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none transition-colors leading-relaxed font-mono resize-y shadow-sm"
            />

            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>{customDirectives.length} characters</span>
              <span className="text-emerald-500 flex items-center gap-1">
                <Check className="size-3" />
                Injected dynamically into real-time LLM prompt
              </span>
            </div>
          </div>

          {/* Bottom Save Bar */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSaveBrain}
              disabled={isSavingBrain}
              className={`px-6 py-3 rounded-xl text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                brainSaved 
                  ? "bg-emerald-500 text-white" 
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isSavingBrain ? (
                <>
                  <RefreshCw className="size-4 animate-spin" />
                  <span>Saving AI Brain...</span>
                </>
              ) : brainSaved ? (
                <>
                  <Check className="size-4" />
                  <span>Saved & Active!</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  <span>Save & Deploy AI Brain</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIVE SIMULATOR & PLAYGROUND ── */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Context: Active Brain Settings Summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                <h3 className="font-nevera text-sm text-foreground font-normal tracking-wide">
                  Active AI Brain Rules
                </h3>
              </div>
              
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-xl bg-secondary/80 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Goal:</span>
                  <span className="font-semibold text-foreground capitalize">
                    {primaryGoal.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-secondary/80 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Brand Voice:</span>
                  <span className="font-semibold text-foreground capitalize">
                    {brandVoice.replace('_', ' ')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-secondary/80 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Persona Name:</span>
                  <span className="font-semibold text-foreground">{personaName}</span>
                </div>

                <div className="p-3 rounded-xl bg-secondary/80 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Min Budget:</span>
                  <span className="font-semibold text-foreground font-mono">{minBudget}</span>
                </div>

                <div className="p-3 rounded-xl bg-secondary/80 border border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Timeline Window:</span>
                  <span className="font-semibold text-foreground font-mono">&lt; {maxTimeline} mos</span>
                </div>
              </div>

              <button
                onClick={() => setActiveTab("studio")}
                className="w-full py-2 rounded-xl text-xs font-mono font-medium text-primary hover:bg-primary/10 border border-primary/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Edit Brain Rules in Studio</span>
                <ArrowRight className="size-3" />
              </button>
            </div>

            {/* Target Lead Selector */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
              <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
                Select Target Homeowner Lead
              </label>
              <select
                value={selectedLeadId}
                onChange={e => setSelectedLeadId(e.target.value)}
                className="w-full bg-input border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:border-primary focus:outline-none cursor-pointer"
              >
                {leads.map((l: any) => (
                  <option key={l.id} value={l.id}>
                    {getCleanLeadName(l)} · {l.county || 'Travis County'} ({l.scoreTier || 'Warm'})
                  </option>
                ))}
                {leads.length === 0 && (
                  <option value="demo">Demo Homeowner (Travis County Modern Estate)</option>
                )}
              </select>
            </div>

            {/* ── LIVE LEAD MEMORY & DEAL INTELLIGENCE INSPECTOR ── */}
            <div className="rounded-2xl border border-[#c9a84c]/30 dark:border-[#e5d9c5]/30 bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                  <h3 className="font-nevera text-sm text-foreground font-normal tracking-wide">
                    Live Deal Intelligence & Memory
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                  Real-Time AI
                </span>
              </div>

              {/* Deal Score Meter */}
              <div className="p-3.5 rounded-xl bg-secondary/80 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground uppercase tracking-wider text-[10px]">Buyer Readiness Score</span>
                  <span className={`font-mono font-bold text-sm ${
                    (liveIntelligence?.dealScore ?? 50) >= 75
                      ? "text-emerald-500"
                      : (liveIntelligence?.dealScore ?? 50) >= 40
                        ? "text-amber-500"
                        : "text-rose-500"
                  }`}>
                    {liveIntelligence?.dealScore ?? 50} / 100 · {(liveIntelligence?.dealScore ?? 50) >= 75 ? "HOT" : (liveIntelligence?.dealScore ?? 50) >= 40 ? "WARM" : "COLD"}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      (liveIntelligence?.dealScore ?? 50) >= 75
                        ? "bg-emerald-500"
                        : (liveIntelligence?.dealScore ?? 50) >= 40
                          ? "bg-amber-500"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, liveIntelligence?.dealScore ?? 50))}%` }}
                  />
                </div>
                {liveIntelligence?.dealSummary && (
                  <p className="text-[11px] text-muted-foreground italic font-mono pt-1">
                    "{liveIntelligence.dealSummary}"
                  </p>
                )}
              </div>

              {/* VIP Escalation Banner */}
              {liveIntelligence?.escalationRequired && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 animate-pulse">
                  <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] block">🔥 VIP Human Takeover Triggered</span>
                    <p className="text-[11px] mt-0.5 leading-snug">{liveIntelligence.escalationReason || "High intent custom estate client ready for principal review."}</p>
                  </div>
                </div>
              )}

              {/* Extracted Lead Memory Graph */}
              <div className="space-y-2 text-xs">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                  🧠 Extracted Lead Memory Graph
                </span>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-muted-foreground block text-[9px] uppercase font-mono">Budget</span>
                    <span className="font-semibold text-foreground font-mono">{liveIntelligence?.leadMemory?.budgetRange || "Pending confirmation"}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-muted-foreground block text-[9px] uppercase font-mono">Lot Readiness</span>
                    <span className="font-semibold text-foreground truncate block">{liveIntelligence?.leadMemory?.lotStatus || "Actively shopping"}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-muted-foreground block text-[9px] uppercase font-mono">Timeline</span>
                    <span className="font-semibold text-foreground font-mono">{liveIntelligence?.leadMemory?.timeline || "< 12 Months"}</span>
                  </div>

                  <div className="p-2 rounded-lg bg-secondary/50 border border-border">
                    <span className="text-muted-foreground block text-[9px] uppercase font-mono">Style</span>
                    <span className="font-semibold text-foreground truncate block">{liveIntelligence?.leadMemory?.architecturalStyle || "Modern Custom"}</span>
                  </div>
                </div>

                {/* Family / Needs */}
                {liveIntelligence?.leadMemory?.familyLifestyleNeeds && (
                  <div className="p-2 rounded-lg bg-secondary/50 border border-border text-[11px]">
                    <span className="text-muted-foreground block text-[9px] uppercase font-mono">Lifestyle Needs</span>
                    <span className="text-foreground">{liveIntelligence.leadMemory.familyLifestyleNeeds}</span>
                  </div>
                )}

                {/* Objections & Preferences */}
                {liveIntelligence?.leadMemory?.objectionsRaised && liveIntelligence.leadMemory.objectionsRaised.length > 0 && (
                  <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20 text-[11px]">
                    <span className="text-rose-600 dark:text-rose-400 block text-[9px] uppercase font-mono font-bold">Objections Raised</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {liveIntelligence.leadMemory.objectionsRaised.map((obj: string, i: number) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-mono">
                          {obj}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Strategy & Next Action */}
                <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-primary text-[10px] font-mono font-bold uppercase">
                    <Lightbulb className="size-3" />
                    <span>Next Best Action for Sales Team</span>
                  </div>
                  <p className="text-xs text-foreground font-medium leading-normal">
                    {liveIntelligence?.nextBestAction || "Offer private showroom walkthrough & site feasibility study."}
                  </p>
                  {liveIntelligence?.objectionStrategyUsed && (
                    <p className="text-[10px] text-muted-foreground font-mono pt-0.5">
                      Strategy Applied: <span className="text-foreground">{liveIntelligence.objectionStrategyUsed}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Interactive Chat Sandbox with WhatsApp Wallpaper */}
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-border bg-card flex flex-col h-[600px] overflow-hidden shadow-sm">
              
              {/* Simulator Chat Header */}
              <div className="p-4 border-b border-border bg-card/90 backdrop-blur-sm flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
                    <Bot className="size-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {personaName} (AI Concierge) &harr; {leads.find(l => l.id === selectedLeadId) ? getCleanLeadName(leads.find(l => l.id === selectedLeadId)) : "Homeowner Lead"}
                    </h4>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Testing real-time prompt & goal execution
                    </p>
                  </div>
                </div>

                {lastIntent && (
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                    lastIntent === "HOT"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : lastIntent === "COLD"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  }`}>
                    Intent: {lastIntent}
                  </span>
                )}
              </div>

              {/* Chat Thread Messages with WhatsApp Wallpaper Doodle Overlay */}
              <div className="flex-1 min-h-0 relative bg-[#050608] overflow-hidden flex flex-col">
                <WhatsAppDoodleBackground idPrefix="sim" />

                <div 
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 relative z-10 custom-scrollbar"
                >
                  {chatHistory.map((m, idx) => {
                    const isAssistant = m.role === 'assistant';
                    return (
                      <div
                        key={idx}
                        className={`flex ${isAssistant ? "justify-start" : "justify-end"} items-start gap-2.5`}
                      >
                        {isAssistant && (
                          <div className="size-7 rounded-lg bg-[#181920] border border-border flex items-center justify-center font-nevera text-[10px] text-[#c9a84c] dark:text-[#e5d9c5] shrink-0 mt-0.5 shadow-sm">
                            {personaName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                          isAssistant
                            ? "bg-[#111218]/95 backdrop-blur-sm border border-border/80 text-foreground rounded-tl-none"
                            : "bg-primary text-primary-foreground rounded-tr-none font-medium"
                        }`}>
                          {m.content}
                        </div>
                      </div>
                    );
                  })}

                  {isThinking && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono italic p-2.5 bg-[#111218]/90 backdrop-blur-sm rounded-xl border border-border w-fit animate-pulse">
                      <Bot className="size-3.5 text-primary" />
                      <span>{personaName} is formulating response...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Scenario Chips */}
              <div className="p-2.5 px-4 border-t border-border bg-card flex items-center gap-2 overflow-x-auto z-10">
                <span className="text-[10px] font-mono uppercase text-muted-foreground shrink-0">Test Scenarios:</span>
                {[
                  "What is your price per sq ft for a 4,500 sq ft home?",
                  "I have a lot in Lakeway and want to start building in 4 months.",
                  "Can we schedule a call for next Tuesday at 2 PM?",
                  "My budget is around $400k, do you build in that range?"
                ].map((scenario) => (
                  <button
                    key={scenario}
                    onClick={() => setInputMessage(scenario)}
                    className="px-2.5 py-1 rounded-lg text-[11px] bg-secondary hover:bg-muted border border-border text-foreground transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    "{scenario.slice(0, 30)}..."
                  </button>
                ))}
              </div>

              {/* Chat Input Form */}
              <form onSubmit={handleSendSimulatedSMS} className="p-3 border-t border-border bg-card flex items-center gap-2 z-10">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  placeholder="Type simulated homeowner reply (e.g. 'Yes, I own the land and have a $1.2M budget')..."
                  className="flex-1 bg-input border border-border rounded-xl px-4 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isThinking}
                  className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all disabled:opacity-50 cursor-pointer shrink-0 shadow-sm"
                  title="Send Message"
                >
                  <Send className="size-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: CONVERSATION HISTORY LOGS ── */}
      {activeTab === "logs" && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-nevera text-base text-foreground font-normal tracking-wide">
                Live AI Conversation Audit History
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect live lead SMS threads, verify AI intent classification, or clear logs.
              </p>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {Object.keys(conversations).length} Logged Threads
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.16em] bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold">Lead Client</th>
                  <th className="px-6 py-4 font-semibold">County / Location</th>
                  <th className="px-6 py-4 font-semibold text-center">Messages</th>
                  <th className="px-6 py-4 font-semibold">Last Activity</th>
                  <th className="px-6 py-4 font-semibold">Lead Outcome</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.keys(conversations).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-muted-foreground text-xs font-mono">
                      <Bot className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                      No active AI conversations logged yet. Use the Live Simulator to test!
                    </td>
                  </tr>
                ) : (
                  Object.values(conversations).map((c: any) => {
                    const msgCount = c.messages ? c.messages.length : 0;
                    const outcome = c.scoreTier === "Hot" ? "Qualified" : c.scoreTier === "Cold" ? "Disqualified" : "Nurturing";

                    return (
                      <tr key={c.leadId} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-medium text-foreground">{c.leadName}</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground text-xs">{c.county}</td>
                        <td className="px-6 py-4 text-center font-mono text-foreground font-medium">{msgCount}</td>
                        <td className="px-6 py-4 text-muted-foreground text-xs font-mono">{c.lastMessageAt}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                            outcome === "Qualified" 
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : outcome === "Disqualified"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          }`}>
                            {outcome}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setActiveModalLeadId(c.leadId)}
                              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                              title="View Chat Details"
                            >
                              <Eye className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteConversation(c.leadId)}
                              className="p-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-500 transition-all cursor-pointer"
                              title="Delete Thread"
                            >
                              <Trash2 className="size-3.5" />
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
        </div>
      )}

      {/* ── Conversation History Modal ── */}
      {activeModalLeadId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border bg-card flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-secondary border border-border flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5]">
                  <Bot className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {conversations[activeModalLeadId]?.leadName} &middot; SMS History
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    County: {conversations[activeModalLeadId]?.county || "Travis County"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveModalLeadId(null)}
                className="size-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 relative bg-[#050608] overflow-hidden flex flex-col">
              <WhatsAppDoodleBackground idPrefix="modal" />
              
              <div className="flex-1 overflow-y-auto p-5 space-y-3 relative z-10 custom-scrollbar">
                {conversations[activeModalLeadId]?.messages?.map((m: any, idx: number) => {
                  const isAssistant = m.role === 'assistant';
                  return (
                    <div
                      key={idx}
                      className={`flex ${isAssistant ? "justify-start" : "justify-end"} items-start gap-2.5`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md ${
                        isAssistant
                          ? "bg-[#111218]/95 backdrop-blur-sm border border-border/80 text-foreground rounded-tl-none"
                          : "bg-primary text-primary-foreground rounded-tr-none font-medium"
                      }`}>
                        {m.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-card flex justify-between items-center text-xs z-10">
              <span className="text-muted-foreground font-mono">Press Esc to close</span>
              <button
                onClick={() => {
                  const id = activeModalLeadId;
                  setActiveModalLeadId(null);
                  handleDeleteConversation(id);
                }}
                className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                Delete Conversation
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
