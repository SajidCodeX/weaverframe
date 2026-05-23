import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
import { useState, useRef, useEffect, useMemo } from "react";
import { Shell } from "@/components/dashboard/Shell";
import { Card, CardHeader, Badge } from "@/components/dashboard/primitives";
import { 
  Star, 
  Award, 
  ShieldCheck, 
  Mail, 
  Send, 
  ExternalLink, 
  MessageSquare, 
  AlertCircle, 
  Sparkles, 
  Plus, 
  Loader2, 
  Check, 
  ArrowRight,
  Smartphone,
  MessageCircle,
  Search,
  ChevronDown
} from "lucide-react";
import { getReviewsData, sendReviewRequest, submitClientReview, getLeadsData, getPublicReviews, replyToReview } from "@/lib/dashboard";

export const Route = createFileRoute("/reviews")({
  loader: async () => {
    const reviews = await getReviewsData();
    // Also load leads so builder can select a completed project to ask reviews for
    const leads = await getLeadsData();
    const publicReviews = await getPublicReviews();
    return { ...reviews, leads, publicReviews };
  },
  staleTime: 5000,
  head: () => ({ 
    meta: [
      { title: "Reputation & Reviews — Builder's Edge" }, 
      { name: "description", content: "Local SEO & 5-Star Trust Manager for custom home builders." }
    ] 
  }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const { platforms = [], requests = [], leads = [], publicReviews: loadedPublicReviews = [] } = useLoaderData({ from: '/reviews' }) || {};
  const router = useRouter();

  // Create request form state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Selected private feedback viewer state
  const [activeFeedbackRequest, setActiveFeedbackRequest] = useState<any>(null);

  // Simulation controls state
  const [simulatingInviteId, setSimulatingInviteId] = useState<string | null>(null);
  const [simulatingStatus, setSimulatingStatus] = useState(false);

  // AI Review Responder & SEO Optimizer States
  const [publicReviews, setPublicReviews] = useState<any[]>(loadedPublicReviews);

  useEffect(() => {
    setPublicReviews(loadedPublicReviews);
  }, [loadedPublicReviews]);
  const [selectedReviewId, setSelectedReviewId] = useState<string>("");
  const [responseTone, setResponseTone] = useState<string>("appreciative");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([
    "Austin Custom Home Builder",
    "Premium Custom Craftsmanship"
  ]);
  const [aiResponseText, setAiResponseText] = useState<string>("");
  const [isGeneratingResponse, setIsGeneratingResponse] = useState<boolean>(false);
  const [isPublishingResponse, setIsPublishingResponse] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"All" | "Unanswered" | "Answered">("All");
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside to close category filter dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Listen to Escape Key to close dropdowns / overlays and blur focused element
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFilterDropdownOpen(false);
        setActiveFeedbackRequest(null);
        setSimulatingInviteId(null);
        setSelectedReviewId("");
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;
    setIsSending(true);
    try {
      // Find matching email/phone from selected lead if present
      let email = clientEmail;
      let phone = clientPhone;
      if (selectedLeadId) {
        const lead = leads.find((l: any) => l.id === selectedLeadId);
        if (lead) {
          if (!email) email = lead.email || "";
          if (!phone) phone = lead.phone || "";
        }
      }

      await sendReviewRequest({
        data: {
          clientName,
          clientEmail: email,
          clientPhone: phone,
          leadId: selectedLeadId || undefined
        }
      });
      
      setClientName("");
      setClientEmail("");
      setClientPhone("");
      setSelectedLeadId("");
      setSendSuccess(true);
      setTimeout(() => setSendSuccess(false), 4000);
      
      await router.invalidate();
    } catch (err) {
      console.error("Failed to send review request:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleFastSimulate = async (id: string, rating: number) => {
    setSimulatingStatus(true);
    try {
      const feedback = rating <= 3 ? "The drywall finishing had dynamic micro-cracks and there was a 2-week framing delay." : undefined;
      const platform = rating >= 4 ? "Google Business" : undefined;
      
      await submitClientReview({
        data: { id, rating, feedback, platform }
      });

      setSimulatingInviteId(null);
      await router.invalidate();
    } catch (err) {
      console.error("Fast simulation failed:", err);
    } finally {
      setSimulatingStatus(false);
    }
  };

  const handleGenerateAIResponse = () => {
    const review = publicReviews.find(r => r.id === selectedReviewId);
    if (!review) return;

    setIsGeneratingResponse(true);

    setTimeout(() => {
      let draftText = "";
      const name = review.clientName.split(" ")[0];
      
      if (responseTone === "appreciative") {
        draftText = `Hi ${name}! Thank you so much for the wonderful review. We thoroughly enjoyed working on your ${review.projectType || 'project'} in ${review.location || 'your area'}. Delivering premium craftsmanship is our main goal, and we're thrilled you love the results. Thank you for choosing us as your Builder!`;
      } else if (responseTone === "professional") {
        draftText = `Hello ${name}. Thank you for your feedback regarding your ${review.projectType || 'project'} construction. We are committed to providing top-tier building services. We are pleased to hear that it was executed to your satisfaction. We appreciate your commendation of our craftsmanship and timeline reliability.`;
      } else {
        draftText = `Thank you, ${name}! We are absolutely delighted by your recommendation. Building your ${review.projectType || 'project'} in ${review.location || 'your area'} was a privilege. Open communication is how we ensure that our construction matches your exact vision. Thank you for trusting us!`;
      }

      // Inject active selected keywords if not present
      selectedKeywords.forEach(kw => {
        if (!draftText.toLowerCase().includes(kw.toLowerCase())) {
          draftText += ` We strive to remain the premier ${kw} in Texas.`;
        }
      });

      setAiResponseText(draftText);
      setIsGeneratingResponse(false);
    }, 1000);
  };

  const handlePublishResponse = async () => {
    if (!aiResponseText || !selectedReviewId) return;
    setIsPublishingResponse(true);
    try {
      await replyToReview({ data: { id: selectedReviewId, replyText: aiResponseText } });
      await router.invalidate();
    } catch (err) {
      console.error("Failed to publish response:", err);
    } finally {
      setIsPublishingResponse(false);
    }
  };

  // Stats Calculations
  const {
    totalReviews,
    totalGoal,
    averageRating,
    negativeSafeguarded,
    positivePublished,
    totalResponses,
    safeguardRate,
    pendingRequestsCount,
    feedbackItems,
  } = useMemo(() => {
    const totalRev = (platforms || []).reduce((sum: number, p: any) => sum + (p.reviewCount || 0), 0);
    const totalGl = (platforms || []).reduce((sum: number, p: any) => sum + (p.reviewsGoal || 0), 0);
    const avgRating = totalRev > 0 ? parseFloat(
      ((platforms || []).reduce((sum: number, p: any) => sum + ((p.rating || 0) * (p.reviewCount || 0)), 0) / totalRev).toFixed(2)
    ) : 4.88;

    const negSafeguarded = (requests || []).filter((r: any) => r.status === "Feedback").length;
    const posPublished = (requests || []).filter((r: any) => r.status === "Completed").length;
    const totResponses = negSafeguarded + posPublished;
    const sfRate = totResponses > 0 
      ? Math.round((negSafeguarded / totResponses) * 100) 
      : 100;

    const pendingReqCount = (requests || []).filter((r: any) => r.status === "Sent").length;

    const fbItems = (requests || []).filter((r: any) => r.status === "Feedback" || (r.rating !== undefined && r.rating !== null && r.rating <= 3));

    return {
      totalReviews: totalRev,
      totalGoal: totalGl,
      averageRating: avgRating,
      negativeSafeguarded: negSafeguarded,
      positivePublished: posPublished,
      totalResponses: totResponses,
      safeguardRate: sfRate,
      pendingRequestsCount: pendingReqCount,
      feedbackItems: fbItems,
    };
  }, [platforms, requests]);

  return (
    <Shell title="Reviews & Reputation Booster">
      {/* Premium Dashboard Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-6">
        <Card className="p-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Average Rating</div>
            <div className="text-2xl font-bold font-display text-foreground mt-1 flex items-baseline gap-1.5">
              {averageRating}
              <div className="flex gap-0.5 text-warning shrink-0">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className="size-3.5 fill-current text-amber-400" />
                ))}
              </div>
            </div>
          </div>
          <div className="size-10 bg-warning/10 rounded-lg flex items-center justify-center text-warning">
            <Award className="size-5" />
          </div>
        </Card>

        <Card className="p-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total Reviews / Goal</div>
            <div className="text-2xl font-bold font-display text-foreground mt-1">{totalReviews} <span className="text-sm font-medium text-muted-foreground">/ {totalGoal}</span></div>
          </div>
          <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <Star className="size-5 fill-current" />
          </div>
        </Card>

        <Card className="p-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Gatekeeper Safeguard</div>
            <div className="text-2xl font-bold font-display text-success mt-1">{safeguardRate}% <span className="text-xs font-semibold text-muted-foreground">Rate</span></div>
          </div>
          <div className="size-10 bg-success/10 rounded-lg flex items-center justify-center text-success">
            <ShieldCheck className="size-5" />
          </div>
        </Card>

        <Card className="p-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Pending Requests</div>
            <div className="text-2xl font-bold font-display text-foreground mt-1">{pendingRequestsCount} <span className="text-xs text-muted-foreground font-mono">active</span></div>
          </div>
          <div className="size-10 bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
            <Mail className="size-5" />
          </div>
        </Card>
      </div>

      {/* Platforms overview - Full Width */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Local SEO & Reputation Directory Targets</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Automated campaigns will direct happy clients to these platforms.</p>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#0A84FF] bg-[#0A84FF]/10 px-2 py-0.5 rounded">Active Routing</span>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {platforms.map((p: any) => {
            const percentage = Math.min(Math.round((p.reviewCount / p.reviewsGoal) * 100), 100);
            return (
              <div key={p.id} className="border border-border/80 rounded-lg p-5 bg-secondary/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-foreground">{p.name}</span>
                    <a 
                      href={p.profileUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="size-6 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-display text-foreground">{p.rating}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">/5.0 ({p.reviewCount} reviews)</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border/40">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                    <span>Goal: {p.reviewsGoal}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500" 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {/* AI Review Responder & Local SEO Rank Optimizer - Full Width */}
      <Card className="p-6 mb-6 relative overflow-hidden border border-primary/20 bg-card">
        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] uppercase font-mono tracking-widest text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">
          <Sparkles className="size-3 text-[#0A84FF] animate-pulse" /> AI Agent Workspace
        </div>
        
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-foreground">AI Review Responder & Local SEO Rank Optimizer</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Optimize local search (Google Maps/Houzz local packs) by generating keyword-rich AI responses instantly.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6 pt-3">
          
          {/* Public Reviews Live Feed Container (Left Side) - Col Span 5 */}
          <div className="col-span-5 border-r border-border/40 pr-6 flex flex-col justify-between" style={{ minHeight: "440px" }}>
            <div className="space-y-4">
              {/* Search & Filter Header */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reviews..."
                    className="w-full bg-secondary/30 border border-border/60 rounded-md pl-8 pr-3 py-1.5 text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-primary/60"
                  />
                </div>
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                    className="flex items-center gap-1.5 text-xs text-foreground bg-secondary/80 border border-border/80 rounded-md px-3 py-1.5 hover:border-white/30 hover:bg-secondary transition-all duration-150 min-w-[120px] justify-between font-medium"
                  >
                    <span>
                      {filterStatus === "All" && "All Reviews"}
                      {filterStatus === "Unanswered" && "Unanswered"}
                      {filterStatus === "Answered" && "Answered"}
                    </span>
                    <ChevronDown className="size-3 text-foreground/60 shrink-0" />
                  </button>

                  {isFilterDropdownOpen && (
                    <div className="absolute left-0 mt-2 w-44 rounded-lg bg-card border border-border p-2 shadow-none z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="text-[9px] font-semibold text-foreground/50 uppercase tracking-widest px-2.5 py-1.5 border-b border-border/40 mb-1 font-mono">
                        Select Category
                      </div>
                      <div className="space-y-0.5 py-0.5">
                        {[
                          { value: "All", label: "All Reviews" },
                          { value: "Unanswered", label: "Unanswered" },
                          { value: "Answered", label: "Answered" }
                        ].map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setFilterStatus(opt.value as any);
                              setIsFilterDropdownOpen(false);
                            }}
                            className="w-full text-left text-xs px-2.5 py-1.5 rounded-md text-foreground/90 hover:text-white hover:bg-white/[0.08] flex items-center justify-between transition-colors font-medium"
                          >
                            <span>{opt.label}</span>
                            {filterStatus === opt.value && <Check className="size-3.5 text-success" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Reviews Feed */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {(() => {
                  const filtered = publicReviews.filter(r => {
                    const matchesSearch = r.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                          r.reviewText.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesFilter = filterStatus === "All" || 
                                          (filterStatus === "Unanswered" && r.status === "Unanswered") || 
                                          (filterStatus === "Answered" && r.status === "Answered");
                    return matchesSearch && matchesFilter;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-border/40 rounded-lg bg-secondary/10">
                        <MessageSquare className="size-8 text-muted-foreground/40 mb-2.5 animate-pulse" />
                        <p className="text-xs font-semibold text-foreground">No Public Reviews Found</p>
                        <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px] leading-relaxed mx-auto">
                          New reviews will automatically appear here when clients post on connected directories.
                        </p>
                      </div>
                    );
                  }

                  return filtered.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedReviewId(r.id);
                        setAiResponseText(r.replyText || "");
                      }}
                      className={`w-full text-left p-3.5 rounded-lg text-xs transition-all duration-150 border flex flex-col gap-2 ${
                        selectedReviewId === r.id
                          ? "bg-primary/10 border-primary text-white"
                          : "bg-secondary/40 border-border/40 hover:border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{r.clientName}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{r.platform}</span>
                      </div>
                      <p className="text-[11px] line-clamp-2 leading-relaxed opacity-85">{r.reviewText}</p>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex gap-0.5">
                          {Array.from({ length: r.rating }).map((_, i) => (
                            <Star key={i} className="size-3 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                        <span className={`text-[9px] uppercase font-mono tracking-widest px-2 py-0.5 rounded ${
                          r.status === "Answered" 
                            ? "bg-success/10 text-success" 
                            : "bg-warning/10 text-warning"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* AI Generator & Optimizer Panel (Right Side) - Col Span 7 */}
          <div className="col-span-7 flex flex-col justify-between" style={{ minHeight: "440px" }}>
            {(() => {
              const review = publicReviews.find(r => r.id === selectedReviewId);
              if (!review) {
                return (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-mono">
                    Select a review from the feed to launch the AI responder
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Selected Review Details */}
                  <div className="bg-secondary/20 rounded-lg p-4 border border-border/40">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{review.clientName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-mono">{review.platform}</span>
                          <span className="text-muted-foreground/30">•</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{review.location}</span>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">"{review.reviewText}"</p>
                  </div>

                  {/* Optimization Parameters */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Tone Selector */}
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-semibold">Response Tone</label>
                      <div className="grid grid-cols-3 gap-1">
                        {["appreciative", "professional", "casual"].map(t => (
                          <button
                            key={t}
                            onClick={() => setResponseTone(t)}
                            className={`py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-colors border ${
                              responseTone === t 
                                ? "bg-primary border-primary text-black" 
                                : "bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* SEO Keyword Injectors */}
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-semibold">Local SEO Target Keywords</label>
                      <div className="flex flex-wrap gap-1">
                        {[
                          "Austin Custom Home Builder",
                          "Premium Custom Craftsmanship",
                          "Luxury Residential Construction"
                        ].map(kw => {
                          const isSelected = selectedKeywords.includes(kw);
                          return (
                            <button
                              key={kw}
                              onClick={() => {
                                setSelectedKeywords(prev => 
                                  isSelected ? prev.filter(k => k !== kw) : [...prev, kw]
                                );
                              }}
                              className={`px-2 py-1 rounded text-[9px] font-medium transition-all ${
                                isSelected 
                                  ? "bg-[#0A84FF]/20 border border-[#0A84FF] text-[#0A84FF]" 
                                  : "bg-secondary/40 border border-border/40 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {kw}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Generated / Draft Response Area */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">AI Generated Response Draft</label>
                      <button
                        onClick={handleGenerateAIResponse}
                        disabled={isGeneratingResponse}
                        className="bg-primary/20 border border-primary/30 text-white px-2.5 py-1 rounded text-[10px] font-semibold flex items-center gap-1 hover:bg-primary/30 transition-all"
                      >
                        {isGeneratingResponse ? (
                          <>
                            <Loader2 className="size-3 animate-spin" /> Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="size-3 text-[#0A84FF]" /> Optimize SEO Reply
                          </>
                        )}
                      </button>
                    </div>

                    <textarea
                      value={aiResponseText}
                      onChange={(e) => setAiResponseText(e.target.value)}
                      placeholder="Click 'Optimize SEO Reply' to generate a response draft, or write one here manually..."
                      className="w-full bg-secondary/30 border border-border/60 rounded-md p-3 text-xs text-white focus:outline-none focus:border-primary/60 h-28 resize-none leading-relaxed font-sans"
                    />
                  </div>

                  {/* Actions footer */}
                  <div className="flex justify-end gap-3 pt-1">
                    {review.status === "Answered" ? (
                      <div className="flex items-center gap-1.5 text-xs text-success bg-success/15 px-3 py-2 rounded-md font-semibold w-full justify-center animate-in zoom-in-95 duration-150">
                        <Check className="size-4" /> Reply Published & Injected into Local SEO Profiles
                      </div>
                    ) : (
                      <button
                        onClick={handlePublishResponse}
                        disabled={isPublishingResponse || !aiResponseText}
                        className="w-full bg-success text-black font-semibold py-2.5 rounded-md text-xs flex items-center justify-center gap-1.5 hover:bg-success/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isPublishingResponse ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <>
                            Publish SEO-Optimized Reply <Send className="size-3.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </Card>
      {/* Side-by-side cards: Trigger form & private inbox */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Reputation Review Booster Form Card */}
        <Card className="p-6 h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Mail className="size-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Reputation Review Booster</h3>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Manually request feedback from custom home buyers. The system automatically triggers the gatekeeper layout.
            </p>

            <form onSubmit={handleSendRequest} className="space-y-5">
              <div>
                <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-semibold">Select Lead Project (Optional)</label>
                <select
                  value={selectedLeadId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedLeadId(id);
                    if (id) {
                      const lead = leads.find((l: any) => l.id === id);
                      if (lead) {
                        setClientName(lead.name);
                        setClientEmail(lead.email || "");
                        setClientPhone(lead.phone || "");
                      }
                    } else {
                      setClientName("");
                      setClientEmail("");
                      setClientPhone("");
                    }
                  }}
                  className="w-full bg-secondary border border-border rounded-md px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-white/60"
                >
                  <option value="">-- Or enter client manually --</option>
                  {leads.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.status} · {l.county})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-semibold">Client Name *</label>
                <input
                  required
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. John Wick"
                  className="w-full bg-secondary border border-border rounded-md px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-white/60 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-semibold">Client Email (Optional)</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="sconnor@cyberdyne.com"
                  className="w-full bg-secondary border border-border rounded-md px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-white/60 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-widest font-semibold">Client Phone Number (Optional)</label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="512-555-0199"
                  className="w-full bg-secondary border border-border rounded-md px-3.5 py-2.5 text-xs text-foreground focus:outline-none focus:border-white/60 font-mono"
                />
              </div>

              {sendSuccess && (
                <div className="p-3.5 bg-success/15 text-success rounded text-xs flex items-start gap-2 animate-in fade-in duration-200">
                  <Check className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Review Request Dispatched!</span>
                    <p className="text-[10px] mt-0.5 opacity-90 leading-snug">SMS & Email invite sent to the client. Sandbox has loaded this request!</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSending || !clientName}
                className="w-full bg-primary text-primary-foreground font-semibold text-xs py-2.5 rounded hover:bg-primary/90 transition-all duration-150 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                    <Send className="size-3.5" /> Trigger Automation
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="border-t border-border/40 pt-5 mt-6">
            <div className="flex gap-2 p-3 rounded-lg bg-[#BF5AF2]/10 border border-[#BF5AF2]/20 text-[#D07EF9] text-xs">
              <ShieldCheck className="size-4 shrink-0 mt-0.5 text-success" />
              <div>
                <div className="font-semibold">Review Gatekeeper On</div>
                <p className="text-[10px] opacity-80 leading-normal">
                  This automation includes positive referral routing and private review intercept checks.
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Private Feedback Safeguard Inbox */}
        <Card className="h-full flex flex-col justify-between p-6 border border-warning/20">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <MessageCircle className="size-5 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">Private Feedback Inbox</h3>
              </div>
              <Badge tone="warm">Safeguarded</Badge>
            </div>

            {activeFeedbackRequest ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <button
                  onClick={() => setActiveFeedbackRequest(null)}
                  className="text-[10px] font-bold text-warning hover:underline flex items-center gap-1 font-mono mb-2"
                >
                  &larr; Back to Feedback List
                </button>

                <div className="p-4 bg-secondary/50 rounded-lg border border-border/80">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-xs text-white">{activeFeedbackRequest.clientName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{activeFeedbackRequest.clientEmail || "No email listed"}</div>
                    </div>
                    <div className="text-xs bg-red-500/10 text-red-400 font-bold px-2 py-0.5 rounded font-mono">
                      {activeFeedbackRequest.rating} Stars
                    </div>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed italic bg-black/40 p-3.5 rounded border border-border/40 font-mono">
                    "{activeFeedbackRequest.feedback || "No feedback comments left."}"
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] text-muted-foreground uppercase font-semibold font-mono tracking-widest">
                    AI Mitigation Suggestion
                  </div>
                  <div className="p-4 bg-success/10 border border-success/20 rounded-lg text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold text-success">Recommended Action:</span> Call {activeFeedbackRequest.clientName} directly at <span className="font-mono text-white font-semibold">{activeFeedbackRequest.clientPhone || "listed number"}</span> to resolve the framing sub-contractor issue. Resolving this keeps their private complaint from leaking onto Google Maps.
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {feedbackItems.length > 0 ? (
                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                    <p className="text-[10px] text-muted-foreground font-mono mb-2">
                      Click any private entry below to view custom AI mitigation actions:
                    </p>
                    {feedbackItems.map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveFeedbackRequest(item)}
                        className="w-full text-left p-3.5 bg-secondary/40 border border-border/40 hover:border-warning/40 hover:bg-secondary/60 rounded-lg transition-all flex flex-col gap-2 group"
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-semibold text-xs text-foreground group-hover:text-warning transition-colors">{item.clientName}</span>
                          <span className="text-[10px] font-mono bg-red-500/10 text-red-400 font-bold px-1.5 py-0.5 rounded shrink-0">
                            {item.rating} ★
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 italic font-mono">
                          "{item.feedback || "No feedback comments left"}"
                        </p>
                        <div className="text-[9px] text-[#0A84FF] font-mono flex items-center gap-1 mt-1 group-hover:underline">
                           See AI Mitigation Suggestion <ArrowRight className="size-2.5" />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-2 bg-secondary/20 rounded-lg border border-dashed border-border/60">
                    <AlertCircle className="size-6 text-muted-foreground/60 mx-auto" />
                    <div className="text-xs font-semibold text-muted-foreground font-mono">No Private Feedback Complaints</div>
                    <p className="text-[10px] text-muted-foreground/60 max-w-[200px] mx-auto">
                      Any low reviews (1-3 stars) submitted by clients will appear here privately instead of publishing publicly.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/40 pt-5 mt-6 text-center text-[10px] text-muted-foreground font-mono leading-relaxed">
            <p className="text-sm font-medium">All private submissions are fully gated. They are strictly visible inside the Builder's Edge dashboard.</p>
          </div>
        </Card>
      </div>

      {/* Review Invitation History & Logs - Full Width */}
      <Card className="mb-0">
        <CardHeader title="Review Invitation History & Logs" />
        <div className="overflow-x-auto max-h-[350px] overflow-y-auto pr-1 pb-2">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase tracking-wider">
              <tr className="text-left font-mono">
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium">Invitation Date</th>
                <th className="px-6 py-4 font-medium text-center">Score</th>
                <th className="px-6 py-4 font-medium">Platform Target</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground font-mono">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Mail className="size-6 text-muted-foreground/40 animate-pulse" />
                      <div className="text-xs font-semibold text-foreground">No Invitation Logs Found</div>
                      <p className="text-[10px] text-muted-foreground/60 max-w-sm mx-auto leading-relaxed">
                        Use the "Reputation Review Booster" form above to send your first customer review invitation!
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((r: any) => {
                  const stars = r.rating;
                  return (
                    <tr key={r.id} className="border-t border-border hover:bg-white/[0.01] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-foreground">{r.clientName}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{r.clientEmail || r.clientPhone || "No contact"}</div>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">
                        {new Date(r.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {stars ? (
                          <div className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded text-xs font-mono">
                            {stars} ★
                          </div>
                        ) : (
                          <span className="text-muted-foreground/60 text-xs font-mono">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-foreground font-medium">
                        {r.platform ? (
                          <PlatformBadge p={r.platform} />
                        ) : (
                          <span className="text-muted-foreground/40 font-mono text-[10px]">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={r.status} />
                      </td>

                      <td className="px-6 py-4 text-right font-medium">
                        <div className="flex justify-end items-center gap-1.5 min-h-[28px]">
                          {r.status === "Feedback" && (
                            <button
                              onClick={() => setActiveFeedbackRequest(r)}
                              className="px-2 py-1 text-[10px] font-bold bg-warning/15 text-warning rounded border border-warning/20 hover:bg-warning/25 transition-colors"
                            >
                              View Feedback
                            </button>
                          )}
                          {r.status === "Sent" && (
                            simulatingInviteId === r.id ? (
                              <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100">
                                <button
                                  disabled={simulatingStatus}
                                  onClick={() => handleFastSimulate(r.id, 5)}
                                  className="px-2 py-1 text-[10px] font-bold bg-success text-black rounded hover:bg-success/90 transition-all font-mono"
                                >
                                  {simulatingStatus ? "..." : "5 ★"}
                                </button>
                                <button
                                  disabled={simulatingStatus}
                                  onClick={() => handleFastSimulate(r.id, 2)}
                                  className="px-2 py-1 text-[10px] font-bold bg-warning text-black rounded hover:bg-warning/90 transition-all font-mono"
                                >
                                  {simulatingStatus ? "..." : "2 ★"}
                                </button>
                                <button
                                  disabled={simulatingStatus}
                                  onClick={() => setSimulatingInviteId(null)}
                                  className="text-[10px] text-muted-foreground hover:text-white px-1 font-semibold"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setSimulatingInviteId(r.id)}
                                className="px-2 py-1 text-[10px] font-bold bg-primary/15 text-primary rounded border border-primary/20 hover:bg-primary/25 transition-colors"
                              >
                                Simulate Client Reply
                              </button>
                            )
                          )}
                          {r.status !== "Sent" && r.status !== "Feedback" && (
                            <span className="text-[10px] font-mono text-muted-foreground italic px-2">Simulated</span>
                          )}
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
    </Shell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: "neutral" | "success" | "warm" | "cold" }> = {
    Sent:      { label: "Invite Sent",    tone: "neutral" },
    Completed: { label: "Completed",      tone: "success" },
    Feedback:  { label: "Internal Gated", tone: "warm" },
  };

  const current = map[status] ?? { label: status, tone: "neutral" };
  return <Badge tone={current.tone}>{current.label}</Badge>;
}

function PlatformBadge({ p }: { p: string }) {
  const map: Record<string, string> = {
    "Google Business": "bg-[#0A84FF]/12 text-[#4DA6FF]",
    "Houzz":           "bg-[#BF5AF2]/12 text-[#D07EF9]",
    "GuildQuality":    "bg-[#30D158]/12 text-[#30D158]",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${map[p] ?? "bg-muted text-muted-foreground"}`}>
      {p}
    </span>
  );
}
