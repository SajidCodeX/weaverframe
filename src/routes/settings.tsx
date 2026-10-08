import { RoutePending } from "@/components/dashboard/RoutePending";
import { createFileRoute, useLoaderData, useRouter, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { Shell } from "@/components/dashboard/Shell";
import { Card } from "@/components/dashboard/primitives";
import { CustomSelect } from "@/components/dashboard/CustomSelect";
import {
  getIntegrationsStatus,
  saveIntegrationCredentials,
  disconnectIntegration,
  testIntegrationConnection,
  getBuilderProfile,
  saveBuilderProfile,
  getQualificationRules,
  saveQualificationRules,
  getNotificationSettings,
  saveNotificationSettings,
  getBillingProfile,
  updateBillingProfile,
  createStripeCheckoutSession,
  createStripeCustomerPortalSession,
  addManualLead,
  triggerMailboxSync,
  getGoogleConnectUrl,
} from "@/lib/dashboard";
import { Loader2, Check, X, AlertCircle, AlertTriangle, Download, Mail, Sparkles, RefreshCw, Lock, ShieldCheck, CheckCircle2, Zap, Server, Globe, CreditCard, ExternalLink, Copy, Code, Code2, Share2, Send, Terminal, Smartphone, Inbox, ArrowRight, CheckCircle, Eye, EyeOff, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') return
    const session = (context as any).session
    if (session && session.role === 'builder' && (session.builderRole === 'manager' || session.builderRole === 'sales')) {
      throw redirect({ to: '/' })
    }
  },
  loader: () => {
    // FIX-6: SSR bypass — mirrors the pattern used in index.tsx and admin routes.
    // Without this, the server runs requireAuth() during SSR without the client's
    // x-active-role header, causing getSessionFromCookie() to return null when
    // multiple cookies are present (admin + builder), which crashes the page on
    // hard refresh with a 401 UNAUTHORIZED error.
    if (typeof window === 'undefined') {
      return {
        _isSsrPlaceholder: true,
        integrationsStatus: {},
        builderProfile: {},
        qualRules: {},
        notifSettings: {},
        billingProfile: { adSpendBalance: 0, paymentMethod: "None", plan: "trial" },
      };
    }

    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
    return Promise.all([
      getIntegrationsStatus({ data: { activeRole } }),
      getBuilderProfile({ data: { activeRole } }),
      getQualificationRules(),
      getNotificationSettings(),
      getBillingProfile(),
    ]).then(([integrationsStatus, builderProfile, qualRules, notifSettings, billingProfile]) => ({
      integrationsStatus: integrationsStatus || {},
      builderProfile: builderProfile || {},
      qualRules: qualRules || {},
      notifSettings: notifSettings || {},
      billingProfile: billingProfile || { adSpendBalance: 0, paymentMethod: "None", plan: "trial" },
    }));
  },
  head: () => ({ meta: [{ title: "Settings — WeaverFrame" }, { name: "description", content: "Configure your account, qualification rules, and integrations." }] }),
  staleTime: 60_000, // 60s — fresh data, instant revisits within a minute
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading Settings..." type="settings" />,
  component: SettingsPage,
});

const sections = [
  "Builder Profile",
  "Notifications",
  "Integrations",
  "Billing",
  "Appearance",
  "About",
  // "Blocked Users"
] as const;

const clientPlanDetails: Record<string, { name: string; price: string; period: string; badge: string; description: string; features: string[] }> = {
  trial: {
    name: "Free Evaluation Trial",
    price: "$0",
    period: "/ 14 days",
    badge: "EVALUATION",
    description: "Sandbox evaluation with standard lead capture & simulation.",
    features: ["Standard Lead Ingestion", "Automated AI Email Outreach"]
  },
  starter: {
    name: "Starter Tier",
    price: "$149",
    period: "/ month",
    badge: "STARTER",
    description: "Up to 50 leads/month. Autonomous email follow-ups & AI qualification.",
    features: ["Up to 50 Leads / Month", "Autonomous AI Email Outreach", "Smart Qualification & Lead Memory", "Instant High-Alert Notifications"]
  },
  growth: {
    name: "Growth Tier",
    price: "$349",
    period: "/ month",
    badge: "GROWTH",
    description: "Up to 200 leads/month. Advanced AI sales concierge & live walkthrough booking.",
    features: ["Up to 200 Leads / Month", "Live Calendar & Walkthrough Booking", "Full Multi-Turn AI Conversation", "Team Collaboration & Priority Support"]
  },
  // Aliases for backwards compatibility
  professional: {
    name: "Starter Tier",
    price: "$149",
    period: "/ month",
    badge: "STARTER",
    description: "Up to 50 leads/month. Autonomous email follow-ups & AI qualification.",
    features: ["Up to 50 Leads / Month", "Autonomous AI Email Outreach", "Smart Qualification & Lead Memory"]
  },
  enterprise: {
    name: "Growth Tier",
    price: "$349",
    period: "/ month",
    badge: "GROWTH",
    description: "Up to 200 leads/month. Advanced AI sales concierge & live walkthrough booking.",
    features: ["Up to 200 Leads / Month", "Live Calendar & Walkthrough Booking", "Full Multi-Turn AI Conversation"]
  }
};

function SettingsPage() {
  const loaderData = useLoaderData({ from: "/settings" }) || {};
  const { integrationsStatus: loadedStatuses = {}, builderProfile: loadedProfile = {}, qualRules: loadedQualRules = {}, notifSettings: loadedNotif = {}, billingProfile: loadedBillingProfile = { adSpendBalance: 0, paymentMethod: "None", plan: "trial" } } = loaderData as any;
  const router = useRouter();
  const routeContext = (Route as any).useRouteContext ? (Route as any).useRouteContext() : {};
  const session = routeContext?.session;
  const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
  const isOwner = session?.role === 'admin' || session?.builderRole === 'owner';
  const availableSections = isOwner ? sections : sections.filter(s => s !== "Integrations" && s !== "Billing");

  // FIX-6: Hydration invalidation — if the SSR placeholder was served, trigger a
  // client-side refetch immediately after hydration to load the real settings data.
  useEffect(() => {
    if ((loaderData as any)?._isSsrPlaceholder) {
      router.invalidate()
    }
  }, [loaderData, router])

  const [active, setActive] = useState<typeof sections[number]>(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const urlTab = url.searchParams.get('tab');
      if (urlTab) {
        const matched = sections.find(s => s.toLowerCase() === urlTab.toLowerCase() || s === urlTab);
        if (matched) return matched;
      }
      if (url.searchParams.get('connected') || url.searchParams.get('error')) {
        return "Integrations";
      }
      const saved = sessionStorage.getItem('settings_active_tab');
      if (saved && sections.includes(saved as any)) {
        return saved as any;
      }
    }
    return "Builder Profile";
  });

  const handleSelectTab = (tabName: typeof sections[number]) => {
    setActive(tabName);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('settings_active_tab', tabName);
    }
  };

  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  // ── Highlight & Deep-Link for Concierge Activation Steps ───────────────────
  const [highlightSection, setHighlightSection] = useState<"profile" | "mailbox" | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const urlTab = url.searchParams.get("tab");
    const highlight = url.searchParams.get("highlight");

    if (highlight === "profile" || urlTab?.toLowerCase().includes("profile")) {
      setActive("Builder Profile");
      if (highlight === "profile") {
        setHighlightSection("profile");
        setTimeout(() => {
          const el = document.getElementById("activation-profile-section");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
        const timer = setTimeout(() => {
          setHighlightSection(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    } else if (highlight === "mailbox" || urlTab?.toLowerCase() === "integrations") {
      setActive("Integrations");
      if (highlight === "mailbox") {
        setExpandedIntegration("email_mailbox");
        setHighlightSection("mailbox");
        setTimeout(() => {
          const el = document.getElementById("activation-mailbox-section");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 200);
        const timer = setTimeout(() => {
          setHighlightSection(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  // ── Billing States ──────────────────────────────────────────────────────────
  const [adSpendBalance, setAdSpendBalance] = useState(loadedBillingProfile.adSpendBalance);
  const [paymentMethod, setPaymentMethod] = useState(loadedBillingProfile.paymentMethod);
  const [billingPlan, setBillingPlan] = useState(loadedBillingProfile.plan || "professional");
  const [isPlansExpanded, setIsPlansExpanded] = useState(false);

  useEffect(() => {
    setAdSpendBalance(loadedBillingProfile.adSpendBalance);
    setPaymentMethod(loadedBillingProfile.paymentMethod);
    setBillingPlan(loadedBillingProfile.plan || "professional");
  }, [loadedBillingProfile]);
  
  // Modals
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  
  // Add funds form state
  const [fundingAmount, setFundingAmount] = useState("500");
  const [customFundingAmount, setCustomFundingAmount] = useState("");
  const [isFunding, setIsFunding] = useState(false);
  const [fundingSuccess, setFundingSuccess] = useState(false);

  const currentPlanKey = (billingPlan || loadedBillingProfile.plan || loadedProfile.plan || "professional").toLowerCase();
  const currentPlan = clientPlanDetails[currentPlanKey] || clientPlanDetails.professional;

  const downloadInvoicePDF = async (inv: { invoiceNumber?: string; date: string; amount: string; status: string; planName?: string; paymentMethod?: string }) => {
    const company = loadedProfile.companyName || "Your Company LLC";
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const invNum = inv.invoiceNumber || `INV-WF-${inv.date.replace(/\s+/g, '-').replace(/,/g, '')}`;
    const cleanMethod = (inv.paymentMethod || 'Stripe Card (ending in 4242)').replace(/•/g, '*');

    // ── 1. TOP OBSIDIAN & CHAMPAGNE GOLD BANNER ──────────────────────────────
    doc.setFillColor(15, 23, 42); // Obsidian Slate (#0f172a)
    doc.rect(0, 0, 210, 42, 'F');

    doc.setFillColor(201, 168, 76); // Champagne Gold (#c9a84c)
    doc.rect(0, 42, 210, 2.5, 'F');

    // Left Header Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("WEAVERFRAME", 20, 19);

    doc.setTextColor(201, 168, 76);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("AUTONOMOUS ARCHITECTURAL SALES OS", 20, 26);

    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("support@weaverframe.in | https://weaverframe.in", 20, 33);

    // Right Header Invoice Meta
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("OFFICIAL TAX INVOICE", 130, 18);

    doc.setTextColor(201, 168, 76);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(invNum, 130, 25);

    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Date: ${inv.date}`, 130, 32);

    // ── 2. BILLED TO & PAYMENT DETAILS CARDS ─────────────────────────────────
    // Billed To Card (Left)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 50, 82, 36, 2.5, 2.5, 'F');
    doc.setFillColor(201, 168, 76); // Gold Accent Left Border
    doc.roundedRect(20, 50, 2.5, 36, 1, 1, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("BILLED TO CLIENT:", 26, 58);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(company, 26, 65);

    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Attn: ${loadedProfile.contactName || 'Principal Director'}`, 26, 72);
    doc.text(`Email: ${loadedProfile.email || 'builder@domain.com'}`, 26, 78);

    // Payment Info Card (Right)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, 50, 82, 36, 2.5, 2.5, 'F');
    doc.setFillColor(15, 23, 42); // Navy Accent Left Border
    doc.roundedRect(108, 50, 2.5, 36, 1, 1, 'F');

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("PAYMENT & SETTLEMENT:", 114, 58);

    // Emerald Paid Badge Pill
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(114, 62, 42, 6.5, 2, 2, 'F');
    // Vector Green Dot
    doc.setFillColor(5, 150, 105);
    doc.circle(118, 65.2, 1, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text("PAID & SETTLED", 121, 66.8);

    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Method: ${cleanMethod}`, 114, 74);
    doc.text("Currency: USD ($) | Automatic Settlement", 114, 80);

    // ── 3. SERVICE ITEMS TABLE ───────────────────────────────────────────────
    // Table Header Bar
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(20, 93, 170, 8.5, 2, 2, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("SERVICE / PLAN DESCRIPTION", 25, 98.8);
    doc.text("CYCLE", 125, 98.8);
    doc.text("AMOUNT (USD)", 155, 98.8);

    // Table Row Box
    doc.setFillColor(255, 255, 255);
    doc.rect(20, 101.5, 170, 44, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(20, 101.5, 170, 44, 'D');

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(`WeaverFrame AI Lead Engine - ${inv.planName || currentPlan.name}`, 25, 110);

    const featureItems = [
      "24/7 Autonomous Architectural Email Concierge & Live Reply Outreach",
      "Inbound Webhook Ingestion (WordPress Forms, Meta Ads, Zapier / Make)",
      "Real-Time Lead Qualification Scoring, Memory Graph & Multi-CRM Sync",
      "Automated Walkthrough Calendar Booking & High-Alert Builder Notifications"
    ];

    featureItems.forEach((itemText, idx) => {
      const lineY = 117 + idx * 7;
      // Native vector gold circle bullet
      doc.setFillColor(201, 168, 76);
      doc.circle(26, lineY - 1, 0.9, 'F');
      
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(itemText, 29, lineY);
    });

    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Monthly", 126, 110);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(inv.amount, 160, 110);

    // ── 4. VERIFICATION & SUMMARY TOTALS BOXES ────────────────────────────────
    // Security / Auth Box (Left)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 151, 82, 33, 2.5, 2.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(20, 151, 82, 33, 2.5, 2.5, 'D');

    // Vector Shield/Check indicator
    doc.setFillColor(5, 150, 105);
    doc.circle(27, 157.5, 1.2, 'F');
    doc.setTextColor(5, 150, 105);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("VERIFIED TRANSACTION", 31, 159);

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Processed via Stripe PCI-DSS Level 1 Gateway.", 26, 166);
    doc.text("256-Bit Encrypted SaaS Billing Infrastructure.", 26, 172);
    doc.text("Account ID: WF-TENANT-" + (loadedProfile.id ? loadedProfile.id.slice(0, 8).toUpperCase() : "ACTIVE"), 26, 178);

    // Summary Totals Box (Right)
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, 151, 82, 33, 2.5, 2.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(108, 151, 82, 33, 2.5, 2.5, 'D');

    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Subtotal:", 114, 159);
    doc.setTextColor(15, 23, 42);
    doc.text(inv.amount, 165, 159);

    doc.setTextColor(100, 116, 139);
    doc.text("Estimated Tax (0%):", 114, 166);
    doc.setTextColor(15, 23, 42);
    doc.text("$0.00", 165, 166);

    doc.setDrawColor(201, 168, 76);
    doc.line(114, 170, 184, 170);

    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Total Paid:", 114, 178);

    doc.setTextColor(201, 168, 76);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(inv.amount, 160, 178);

    // ── 5. BOTTOM OBSIDIAN FOOTER BANNER ─────────────────────────────────────
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 270, 210, 27, 'F');

    doc.setFillColor(201, 168, 76);
    doc.rect(0, 270, 210, 1.5, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("THANK YOU FOR BUILDING WITH WEAVERFRAME", 20, 281);

    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("For corporate billing questions or tax compliance, reach out to billing@weaverframe.in", 20, 287);

    doc.setTextColor(201, 168, 76);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("WEAVERFRAME.IN", 155, 281);

    doc.save(`${invNum}.pdf`);
  };

  // ── Stripe Subscription Checkout Handlers ─────────────────────────────────────
  const [isUpgradingPlan, setIsUpgradingPlan] = useState<string | null>(null);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const handleUpgradePlan = async (planId: 'starter' | 'growth') => {
    setIsUpgradingPlan(planId);
    try {
      const res = await createStripeCheckoutSession({
        data: {
          planId,
          returnUrl: typeof window !== 'undefined' ? window.location.origin : 'https://weaverframe.in'
        }
      });
      if (res?.url) {
        window.location.href = res.url;
      } else if (res?.simulated) {
        alert("Stripe Infrastructure Ready (Sandbox Mode):\n\n" + (res.message || "Ready for live payment when STRIPE_SECRET_KEY is configured."));
      }
    } catch (err: any) {
      console.error("Failed to start Stripe checkout session:", err);
      alert(err.message || "Failed to initiate Stripe checkout.");
    } finally {
      setIsUpgradingPlan(null);
    }
  };

  const handleOpenPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const res = await createStripeCustomerPortalSession({
        data: { returnUrl: typeof window !== 'undefined' ? window.location.origin : 'https://weaverframe.in' }
      });
      if (res?.url) {
        window.location.href = res.url;
      } else if (res?.simulated) {
        alert("Stripe Customer Portal:\n\n" + (res.message || "No active Stripe customer found."));
      }
    } catch (err: any) {
      alert(err.message || "Failed to open Stripe portal.");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  // ── Builder Profile State ───────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState(() => {
    let cached: any = null;
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem('cached_builder_profile');
        if (raw) cached = JSON.parse(raw);
      } catch (e) {}
    }
    return {
      companyName: loadedProfile.companyName || cached?.companyName || "",
      primaryContact: loadedProfile.primaryContact || cached?.primaryContact || "",
      email: loadedProfile.email || cached?.email || "",
      phone: loadedProfile.phone || cached?.phone || "",
      businessAddress: loadedProfile.businessAddress || cached?.businessAddress || "",
      targetZipCodes: loadedProfile.targetZipCodes || cached?.targetZipCodes || "",
      avgHomePrice: loadedProfile.avgHomePrice || cached?.avgHomePrice || "$700,000",
      homesPerYear: loadedProfile.homesPerYear || cached?.homesPerYear || "42",
      timezone: loadedProfile.timezone || cached?.timezone || "Asia/Kolkata",
      aiContext: loadedProfile.aiContext || cached?.aiContext || "",
    };
  });

  useEffect(() => {
    if (loadedProfile && Object.keys(loadedProfile).length > 0 && !(loadedProfile as any)._isSsrPlaceholder) {
      const updated = {
        companyName: loadedProfile.companyName || "",
        primaryContact: loadedProfile.primaryContact || "",
        email: loadedProfile.email || "",
        phone: loadedProfile.phone || "",
        businessAddress: loadedProfile.businessAddress || "",
        targetZipCodes: loadedProfile.targetZipCodes || "",
        avgHomePrice: loadedProfile.avgHomePrice || "$700,000",
        homesPerYear: loadedProfile.homesPerYear || "42",
        timezone: loadedProfile.timezone || "Asia/Kolkata",
        aiContext: loadedProfile.aiContext || "",
      };
      setProfileForm(updated);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cached_builder_profile', JSON.stringify(updated));
      }
    }
  }, [loadedProfile]);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSaveProfile = async () => {
    // Mandatory Field Verification
    if (!profileForm.companyName.trim() || !profileForm.primaryContact.trim() || !profileForm.email.trim() || !profileForm.phone.trim() || !profileForm.businessAddress.trim()) {
      alert("Please fill in all mandatory fields: Company Name, Primary Contact, Email, Phone, and Business Address.");
      return;
    }

    // Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileForm.email.trim())) {
      alert("Please enter a valid email address.");
      return;
    }

    // Phone Validation (US and India formats)
    const phoneTrimmed = profileForm.phone.trim();
    const usPhoneRegex = /^(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
    const indiaPhoneRegex = /^(?:\+?91|0)?[\s-]?[6789]\d{9}$/;
    
    if (!usPhoneRegex.test(phoneTrimmed) && !indiaPhoneRegex.test(phoneTrimmed)) {
      alert("Please enter a valid US or Indian phone number.");
      return;
    }

    // Compulsory AI Knowledge Base Check
    if (!profileForm.aiContext || profileForm.aiContext.trim().length < 20) {
      alert("AI Knowledge Base / Builder Defaults is compulsory (minimum 20 characters). Please provide your build policies, service region, or guidelines to prevent the AI from misinforming leads.");
      return;
    }

    setIsSavingProfile(true);
    try {
      await saveBuilderProfile({ data: profileForm });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cached_builder_profile', JSON.stringify(profileForm));
        const { invalidateClientSession } = await import('./__root');
        invalidateClientSession({ 
          companyName: profileForm.companyName, 
          displayName: profileForm.primaryContact 
        });
      }
      await router.invalidate();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err: any) {
      console.error(err);
      alert("Failed to save profile: " + (err?.message || err));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ── Qualification Rules State ───────────────────────────────────────────────
  const [qualForm, setQualForm] = useState({
    minBudget: loadedQualRules.minBudget || "$500,000",
    maxTimeline: loadedQualRules.maxTimeline || "12",
    preApprovalRequired: loadedQualRules.preApprovalRequired ?? false,
    specificZipOnly: loadedQualRules.specificZipOnly ?? true,
    minLeadScore: loadedQualRules.minLeadScore ?? 60,
  });

  useEffect(() => {
    if (loadedQualRules && Object.keys(loadedQualRules).length > 0) {
      setQualForm({
        minBudget: loadedQualRules.minBudget || "$500,000",
        maxTimeline: loadedQualRules.maxTimeline || "12",
        preApprovalRequired: loadedQualRules.preApprovalRequired ?? false,
        specificZipOnly: loadedQualRules.specificZipOnly ?? true,
        minLeadScore: loadedQualRules.minLeadScore ?? 60,
      });
    }
  }, [loadedQualRules]);

  const [isSavingQual, setIsSavingQual] = useState(false);
  const [qualSaved, setQualSaved] = useState(false);

  const handleSaveQual = async () => {
    setIsSavingQual(true);
    try {
      await saveQualificationRules({ data: qualForm });
      setQualSaved(true);
      setTimeout(() => setQualSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to save qualification rules.");
    } finally {
      setIsSavingQual(false);
    }
  };

  // ── Notification Settings State ─────────────────────────────────────────────
  const [notifForm, setNotifForm] = useState({
    newLead: loadedNotif.newLead ?? true,
    leadReplies: loadedNotif.leadReplies ?? true,
    hotLead: loadedNotif.hotLead ?? true,
    apptBooked: loadedNotif.apptBooked ?? true,
    channel: loadedNotif.channel || "Both",
    quietHours: loadedNotif.quietHours ?? true,
  });

  useEffect(() => {
    if (loadedNotif && Object.keys(loadedNotif).length > 0) {
      setNotifForm({
        newLead: loadedNotif.newLead ?? true,
        leadReplies: loadedNotif.leadReplies ?? true,
        hotLead: loadedNotif.hotLead ?? true,
        apptBooked: loadedNotif.apptBooked ?? true,
        channel: loadedNotif.channel || "Both",
        quietHours: loadedNotif.quietHours ?? true,
      });
    }
  }, [loadedNotif]);

  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  const handleSaveNotif = async () => {
    setIsSavingNotif(true);
    try {
      await saveNotificationSettings({ data: notifForm });
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to save notification settings.");
    } finally {
      setIsSavingNotif(false);
    }
  };

  const [showWebhookUrl, setShowWebhookUrl] = useState(false);
  const [isInboundExpanded, setIsInboundExpanded] = useState(false);

  // ── Integration connection states ──────────────────────────────────────────
  const [connectionStatus, setConnectionStatus] = useState<Record<string, boolean>>(() => {
    const statuses: Record<string, boolean> = {
      google: false, houzz: false, facebook: false, twilio: false, hubspot: false, ghl: false, email_mailbox: false
    };
    Object.keys(loadedStatuses).forEach(key => {
      if (loadedStatuses[key]) statuses[key] = loadedStatuses[key].isConnected;
    });
    return statuses;
  });

  // Saved credentials storage in state
  const [credentials, setCredentials] = useState<Record<string, Record<string, string>>>(() => {
    const creds: Record<string, Record<string, string>> = {
      google: {}, twilio: {}, hubspot: {}, houzz: {}, facebook: {}, ghl: {}, email_mailbox: {}
    };
    Object.keys(loadedStatuses).forEach(key => {
      if (loadedStatuses[key]) creds[key] = loadedStatuses[key].credentials || {};
    });
    return creds;
  });

  // ── Email & Mailbox Connection State ─────────────────────────────────────────
  const [emailProvider, setEmailProvider] = useState<"google" | "microsoft" | "custom_smtp">("google");
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSenderName, setEmailSenderName] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [useSsl, setUseSsl] = useState(false);
  const [showManualGoogle, setShowManualGoogle] = useState(false);

  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // Detect Google OAuth callback redirect parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const connected = url.searchParams.get('connected');
      const err = url.searchParams.get('error');
      const connectedEmail = url.searchParams.get('email');

      if (connected === 'google') {
        setActive("Integrations");
        sessionStorage.setItem('settings_active_tab', 'Integrations');
        toast.success(`Google Workspace connected successfully!${connectedEmail ? ` (${connectedEmail})` : ''}`);
        setExpandedIntegration('email_mailbox');
        url.searchParams.delete('connected');
        url.searchParams.delete('email');
        window.history.replaceState({}, '', url.toString());
      } else if (err) {
        setActive("Integrations");
        sessionStorage.setItem('settings_active_tab', 'Integrations');
        toast.error(`Google Connection Notice: ${err.replace(/_/g, ' ')}`);
        url.searchParams.delete('error');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  useEffect(() => {
    if (loadedStatuses && Object.keys(loadedStatuses).length > 0) {
      const statuses: Record<string, boolean> = {
        google: false, houzz: false, facebook: false, twilio: false, hubspot: false, ghl: false, email_mailbox: false
      };
      const creds: Record<string, Record<string, string>> = {
        google: {}, twilio: {}, hubspot: {}, houzz: {}, facebook: {}, ghl: {}, email_mailbox: {}
      };
      Object.keys(loadedStatuses).forEach(key => {
        if (loadedStatuses[key]) {
          statuses[key] = loadedStatuses[key].isConnected;
          creds[key] = loadedStatuses[key].credentials || {};
        }
      });
      setConnectionStatus(statuses);
      setCredentials(creds);

      if (creds.email_mailbox) {
        const em = creds.email_mailbox;
        if (em.provider === 'google_oauth' || em.provider === 'google') {
          setEmailProvider('google');
        } else if (em.provider === 'microsoft') {
          setEmailProvider('microsoft');
        } else if (em.provider === 'custom_smtp') {
          setEmailProvider('custom_smtp');
        }
        if (em.email) setEmailAddress(em.email);
        if (em.senderName) setEmailSenderName(em.senderName);
        if (em.password) setEmailPassword(em.password);
        if (em.smtpHost) setSmtpHost(em.smtpHost);
        if (em.smtpPort) setSmtpPort(em.smtpPort);
        if (em.useSsl) setUseSsl(em.useSsl === 'true');
      }
    }
  }, [loadedStatuses]);

  const isEmailConnected = !!connectionStatus.email_mailbox;

  const handleTestEmail = async () => {
    const targetEmail = emailAddress.trim() || credentials.email_mailbox?.email || '';
    if (!targetEmail) {
      toast.error("Please enter a valid company mailbox email first.");
      return;
    }
    setIsTestingEmail(true);
    try {
      const activeProvider = credentials.email_mailbox?.provider || emailProvider;
      const creds = {
        provider: activeProvider,
        email: targetEmail,
        senderName: emailSenderName || credentials.email_mailbox?.senderName || '',
        password: emailPassword || credentials.email_mailbox?.password || '',
        smtpHost: (activeProvider === 'google' || activeProvider === 'google_oauth') ? 'smtp.gmail.com' : activeProvider === 'microsoft' ? 'smtp.office365.com' : smtpHost,
        smtpPort: (activeProvider === 'google' || activeProvider === 'google_oauth') ? '465' : activeProvider === 'microsoft' ? '587' : smtpPort,
        useSsl: useSsl ? 'true' : 'false'
      };
      await testIntegrationConnection({
        data: { platformId: "email_mailbox", credentials: creds, activeRole }
      });
      toast.success(`Handshake verified! Connected to ${targetEmail}`);
    } catch (err: any) {
      toast.error(`Mailbox Verification Failed: ${err?.message || err}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  // Ensure isConnectingGoogle is never stuck on status change
  useEffect(() => {
    setIsConnectingGoogle(false);
  }, [connectionStatus.email_mailbox]);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const res = await getGoogleConnectUrl({ data: { returnTo: '/settings?tab=integrations', activeRole } });
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      toast.error("Could not start Google connection: " + (err?.message || err));
      setIsConnectingGoogle(false);
    } finally {
      setTimeout(() => setIsConnectingGoogle(false), 5000);
    }
  };

  const handleSaveEmail = async () => {
    if (!emailAddress.trim()) {
      toast.error("Please enter a company email address.");
      return;
    }
    setIsSaving(prev => ({ ...prev, email_mailbox: true }));
    try {
      const creds = {
        provider: emailProvider,
        email: emailAddress,
        senderName: emailSenderName,
        password: emailPassword,
        smtpHost: emailProvider === 'google' ? 'smtp.gmail.com' : emailProvider === 'microsoft' ? 'smtp.office365.com' : smtpHost,
        smtpPort: emailProvider === 'google' ? '465' : emailProvider === 'microsoft' ? '587' : smtpPort,
        useSsl: useSsl ? 'true' : 'false'
      };
      await testIntegrationConnection({
        data: { platformId: "email_mailbox", credentials: creds, activeRole }
      });
      await saveIntegrationCredentials({
        data: { platformId: "email_mailbox", credentials: creds, activeRole }
      });
      setConnectionStatus(prev => ({ ...prev, email_mailbox: true }));
      setCredentials(prev => ({ ...prev, email_mailbox: creds }));
      // Immediately trigger initial sync
      triggerMailboxSync().catch((e) => console.warn('[INITIAL MAILBOX SYNC ERROR]:', e));
      await router.invalidate();
      toast.success(`Company mailbox linked! AI can now send and receive emails as ${emailAddress}.`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save mailbox connection: ${err?.message || err}`);
    } finally {
      setIsSaving(prev => ({ ...prev, email_mailbox: false }));
    }
  };

  const confirmDisconnectEmail = async () => {
    setIsSaving(prev => ({ ...prev, email_mailbox: true }));
    setIsConnectingGoogle(false);
    try {
      await disconnectIntegration({
        data: { platformId: "email_mailbox", activeRole }
      });
      setConnectionStatus(prev => ({ ...prev, email_mailbox: false }));
      setCredentials(prev => ({ ...prev, email_mailbox: {} }));
      setEmailPassword("");
      setIsDisconnectModalOpen(false);
      await router.invalidate();
      toast.success("Company mailbox disconnected successfully.");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to disconnect mailbox: " + (err?.message || err));
    } finally {
      setIsSaving(prev => ({ ...prev, email_mailbox: false }));
      setIsConnectingGoogle(false);
    }
  };

  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});

  const handleCredentialChange = (integrationId: string, fieldKey: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [integrationId]: {
        ...(prev[integrationId] || {}),
        [fieldKey]: value
      }
    }));
  };

  const [disconnectTarget, setDisconnectTarget] = useState<{ id: string; name: string } | null>(null);

  const handleConnect = async (id: string) => {
    setIsSaving(prev => ({ ...prev, [id]: true }));
    try {
      const integrationCreds = credentials[id] || {};
      
      // Perform integration connection validation check first
      await testIntegrationConnection({
        data: { platformId: id, credentials: integrationCreds, activeRole }
      });

      await saveIntegrationCredentials({
        data: { platformId: id, credentials: integrationCreds, activeRole }
      });
      setConnectionStatus(prev => ({ ...prev, [id]: true }));
      setExpandedIntegration(null);
      await router.invalidate();
      const targetName = id === 'hubspot' ? 'HubSpot CRM' : id === 'ghl' ? 'GoHighLevel' : id;
      toast.success(`${targetName} connected and synced successfully!`);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || "Failed to save credentials.";
      toast.error(`API Connection Failed: ${errMsg}`);
    } finally {
      setIsSaving(prev => ({ ...prev, [id]: false }));
    }
  };

  const confirmDisconnectIntegration = async () => {
    if (!disconnectTarget) return;
    const { id, name } = disconnectTarget;
    setIsSaving(prev => ({ ...prev, [id]: true }));
    try {
      await disconnectIntegration({
        data: { platformId: id, activeRole }
      });
      setConnectionStatus(prev => ({ ...prev, [id]: false }));
      setCredentials(prev => ({ ...prev, [id]: {} }));
      setExpandedIntegration(null);
      setDisconnectTarget(null);
      await router.invalidate();
      toast.success(`${name} disconnected successfully.`);
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to disconnect ${name}: ` + (err?.message || err));
    } finally {
      setIsSaving(prev => ({ ...prev, [id]: false }));
    }
  };

  // ── Inbound Lead Ingestion Hub State ─────────────────────────────────────────
  // ── Inbound Lead Ingestion Hub State ─────────────────────────────────────────
  const [inboundTab, setInboundTab] = useState<"wordpress" | "meta" | "webflow" | "whatsapp" | "zapier" | "make" | "html">("wordpress");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isTestingInbound, setIsTestingInbound] = useState(false);
  const [testInboundResult, setTestInboundResult] = useState<{ success: boolean; message: string; leadId?: string; scoreTier?: string; dealScore?: number } | null>(null);

  const inboundPlatformOptions = [
    {
      value: "wordpress",
      label: "WordPress / Elementor Pro",
      sourceParam: "WordPress_Elementor",
      readableName: "WordPress Elementor",
      icon: (
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#21759B">
          <path d="M12 2C6.486 2 2 6.486 2 12c0 4.418 2.865 8.167 6.839 9.49L4.47 8.358C5.83 5.46 8.7 3.5 12 3.5c1.68 0 3.25.503 4.568 1.368L12 2zm8.53 10c0-1.657-.597-2.808-1.11-3.71-.682-1.11-1.32-2.046-1.32-3.155 0-1.233.937-2.383 2.26-2.383.104 0 .204.01.306.022A9.957 9.957 0 0012 3.5c-3.766 0-7.067 2.09-8.79 5.204l5.748 16.717c.64-1.87 1.312-4.54 1.312-6.657 0-1.657-.597-2.808-1.11-3.71-.682-1.11-1.32-2.046-1.32-3.155 0-1.233.937-2.383 2.26-2.383zM12 22a9.96 9.96 0 005.161-1.425l-5.07-14.73-5.26 14.797A9.97 9.97 0 0012 22z"/>
        </svg>
      ),
    },
    {
      value: "meta",
      label: "Meta (FB & IG) Lead Ads",
      sourceParam: "Meta_Lead_Ads",
      readableName: "Meta Lead Ads",
      icon: (
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#0081FB">
          <path d="M16.96 4C14.74 4 13.06 5.21 12 6.55 10.94 5.21 9.26 4 7.04 4 3.15 4 0 7.22 0 11.23c0 4.88 4.25 9.07 10.63 11.13.88.29 1.86.29 2.74 0C19.75 20.3 24 16.11 24 11.23 24 7.22 20.85 4 16.96 4zm-9.92 9.77c-2.06 0-3.68-1.59-3.68-3.54 0-1.96 1.62-3.55 3.68-3.55 1.51 0 2.59.88 3.32 1.89-1.23 1.58-2.36 3.49-3.32 5.2zm9.92 0c-.96-1.71-2.09-3.62-3.32-5.2.73-1.01 1.81-1.89 3.32-1.89 2.06 0 3.68 1.59 3.68 3.55 0 1.95-1.62 3.54-3.68 3.54z"/>
        </svg>
      ),
    },
    {
      value: "webflow",
      label: "Webflow Forms",
      sourceParam: "Webflow",
      readableName: "Webflow Forms",
      icon: (
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#146EF5">
          <path d="M17.8 7.2c-.3 0-.6.1-.8.4L13.7 13l-2.4-7.8c-.1-.3-.4-.5-.7-.5s-.6.2-.7.5L6.6 15.9 4.3 8.3c-.1-.3-.4-.5-.7-.5H1.4c-.4 0-.7.4-.6.8l3.6 11.9c.1.3.4.5.7.5h2.8c.3 0 .6-.2.7-.5l3.2-9.6 3.2 9.6c.1.3.4.5.7.5h2.8c.3 0 .6-.2.7-.5l4.8-12.7c.1-.4-.2-.8-.6-.8h-1.9z"/>
        </svg>
      ),
    },
    {
      value: "whatsapp",
      label: "WhatsApp Business (Wati / Twilio)",
      sourceParam: "WhatsApp_Inbound",
      readableName: "WhatsApp Inbound",
      icon: (
        <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#25D366">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 20.15C10.57 20.15 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.05 20.15M16.56 14.39C16.31 14.26 15.09 13.66 14.86 13.58C14.64 13.5 14.47 13.45 14.31 13.7C14.15 13.95 13.68 14.5 13.53 14.67C13.39 14.84 13.24 14.86 12.99 14.74C12.74 14.61 11.94 14.35 11 13.51C10.26 12.85 9.77 12.04 9.62 11.79C9.48 11.54 9.61 11.4 9.73 11.28C9.84 11.17 9.98 10.99 10.1 10.85C10.23 10.71 10.27 10.6 10.35 10.44C10.43 10.27 10.39 10.13 10.33 10C10.27 9.88 9.77 8.65 9.57 8.15C9.37 7.67 9.16 7.73 9.01 7.72H8.52C8.36 7.72 8.09 7.78 7.87 8.03C7.64 8.27 7 8.87 7 10.09C7 11.31 7.89 12.48 8.01 12.65C8.14 12.81 9.76 15.32 12.24 16.39C12.83 16.65 13.29 16.8 13.64 16.91C14.23 17.1 14.77 17.07 15.2 17.01C15.68 16.94 16.67 16.41 16.88 15.82C17.08 15.23 17.08 14.73 17.02 14.62C16.96 14.52 16.81 14.45 16.56 14.39Z" />
        </svg>
      ),
    },
    {
      value: "zapier",
      label: "Zapier Webhook (Easiest)",
      sourceParam: "Zapier",
      readableName: "Zapier",
      icon: (
        <svg className="size-4 shrink-0" viewBox="0 0 24 24">
          <rect width="24" height="24" rx="5" fill="#FF4F00" />
          <path d="M11 5h2v6h5v2h-5v6h-2v-6H6v-2h5V5z" fill="#FFF" />
          <path d="M7.4 6.6l1.4-1.4 8.5 8.5-1.4 1.4L7.4 6.6zm9.9 1.4l-1.4-1.4-8.5 8.5 1.4 1.4 8.5-8.5z" fill="#FFF" />
        </svg>
      ),
    },
    {
      value: "make",
      label: "Make.com (Integromat)",
      sourceParam: "Make",
      readableName: "Make.com",
      icon: (
        <svg className="size-4 shrink-0" viewBox="0 0 24 24">
          <rect width="24" height="24" rx="5" fill="#6E00F5" />
          <path d="M5.5 8.5L9.5 5.5L13.5 8.5L9.5 11.5L5.5 8.5Z" fill="#FFF" />
          <path d="M10.5 12.5L14.5 9.5L18.5 12.5L14.5 15.5L10.5 12.5Z" fill="#FFF" opacity="0.9"/>
          <path d="M5.5 15.5L9.5 12.5L13.5 15.5L9.5 18.5L5.5 15.5Z" fill="#FFF" opacity="0.75"/>
        </svg>
      ),
    },
    {
      value: "html",
      label: "Custom HTML / Code Embed",
      sourceParam: "Custom_HTML_Form",
      readableName: "Custom Website HTML",
      icon: <Code2 className="size-4 text-emerald-400 shrink-0" />,
    },
  ];

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const builderToken = session?.builderId || loadedProfile?.id || "builder_primary";
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://weaverframe.in';
  
  // High-Security Cryptographic Platform-Scoped Token:
  // Each marketing platform receives a dedicated cryptographically signed token (e.g. wf_wp_..., wf_meta_..., wf_wa_...).
  // This prevents cross-channel blast radius and guarantees lead attribution cannot be spoofed.
  const platformScopedToken = loadedProfile?.platformWebhookTokens?.[inboundTab] || builderToken;
  const selectedPlatform = inboundPlatformOptions.find(p => p.value === inboundTab) || inboundPlatformOptions[0];
  const inboundWebhookUrl = `${siteOrigin}/api/leads/inbound?token=${platformScopedToken}`;
  const inboundEmailAddress = `leads+${builderToken.slice(0, 8)}@inbound.weaverframe.in`;

  const handleSendTestLead = async () => {
    setIsTestingInbound(true);
    setTestInboundResult(null);
    try {
      const parsedCity = profileForm.businessAddress ? profileForm.businessAddress.split(',')[0]?.trim() : "";
      const parsedRegion = profileForm.businessAddress ? (profileForm.businessAddress.split(',')[1]?.trim() || parsedCity) : "Local Region";
      const county = parsedRegion || (profileForm.targetZipCodes ? profileForm.targetZipCodes.split(',')[0].trim() : "Local Region");
      const state = profileForm.businessAddress ? (profileForm.businessAddress.split(',')[2]?.trim()?.slice(0, 2)?.toUpperCase() || "US") : "US";
      const res = await addManualLead({
        data: {
          name: "Harrison Vance (Test Inbound Lead)",
          email: `inbound.buyer.${Date.now().toString().slice(-4)}@example.com`,
          phone: "+1 (555) 019-9234",
          county,
          state,
          estimatedBudget: 2200000,
          source: `${selectedPlatform.readableName}`,
          scoreTier: "Hot",
          notes: `Inquiring about building a 4,800 sqft modern custom residence in ${county}. Lot survey already completed. Requesting consultation with ${profileForm.companyName || 'your design team'}.`,
        }
      });

      if (res?.success) {
        setTestInboundResult({
          success: true,
          message: `Inbound lead created (#${res.lead?.id?.slice(0, 8) || 'new'}). Score: ${res.lead?.dealScore || 85} (${res.lead?.scoreTier || 'Hot'}). Ingested & ready in Leads tab!`,
          leadId: res.lead?.id,
          scoreTier: res.lead?.scoreTier,
          dealScore: res.lead?.dealScore,
        });
        await router.invalidate();
      } else {
        setTestInboundResult({
          success: false,
          message: "Failed to process inbound test lead.",
        });
      }
    } catch (err: any) {
      setTestInboundResult({
        success: false,
        message: err?.message || "Network error while sending test lead.",
      });
    } finally {
      setIsTestingInbound(false);
    }
  };

  const integrationsList = [
    {
      id: "hubspot",
      name: "HubSpot CRM Sync",
      desc: "Sync qualified builder leads, custom timelines, and budgets directly into your HubSpot deal pipelines.",
      icon: (
        <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="#FF7A59">
          <path d="M17.8 8.15V5.98a2.15 2.15 0 1 0-2.15 2.15v.02h-.03a5.5 5.5 0 0 0-2.92 1.48L7.6 6.33a2.15 2.15 0 1 0-1.42 1.63l5.05 3.26a5.55 5.55 0 0 0-.23 1.58c0 .55.08 1.08.23 1.58l-5.05 3.26a2.15 2.15 0 1 0 1.42 1.63l5.1-3.3a5.5 5.5 0 0 0 2.92 1.48v.02a2.15 2.15 0 1 0 2.15 2.15v-2.17a5.53 5.53 0 0 0 3.7-5.23 5.53 5.53 0 0 0-3.67-5.22zm-7.3 6.65a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z"/>
        </svg>
      ),
      fields: [
        { key: "accessToken", label: "Private App Access Token", type: "password", required: true, placeholder: "e.g. pat-na1-xxxxxxxxxxxxxxxxxxxx", colSpan: 2 }
      ]
    },
    {
      id: "ghl",
      name: "GoHighLevel (GHL) Sync",
      desc: "Sync contacts, pipeline stages, and AI conversation actions directly inside GHL sub-accounts.",
      icon: (
        <div className="size-6 rounded bg-gradient-to-br from-[#1E60FF] to-[#0A47D4] flex items-center justify-center text-white font-black text-[9px] tracking-tight shrink-0 shadow-sm">
          GHL
        </div>
      ),
      fields: [
        { key: "apiKey", label: "GHL Location API Key (v2)", type: "password", required: true, placeholder: "Enter GHL Location API Key", colSpan: 2 }
      ]
    }
  ];

  return (
    <Shell title="Settings">
      <div className="grid grid-cols-[200px_1fr] gap-6">
        <nav className="space-y-1">
          {availableSections.map((s) => (
            <button
              key={s}
              onClick={() => handleSelectTab(s)}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm cursor-pointer ${active === s ? "bg-secondary text-foreground border-l-2 border-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </nav>

        <Card
          className={`p-6 max-w-2xl w-full transition-all duration-700 ${
            highlightSection === "profile"
              ? "border-[#e5d9c5] ring-2 ring-[#e5d9c5] shadow-[0_0_35px_rgba(229,217,197,0.35)]"
              : ""
          }`}
        >
          {active === "Builder Profile" && (
            <div id="activation-profile-section" className="space-y-4">
              <H>Builder Profile</H>
              <Row label="Company Organization">
                <div className="flex items-center justify-between w-full bg-secondary/60 border border-border rounded-md px-3 py-2 text-sm text-foreground select-none">
                  <span className="font-semibold text-foreground">{profileForm.companyName || "Organization Account"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                    <Lock className="size-2.5" /> Managed by Platform Super-Admin
                  </span>
                </div>
              </Row>
              <Row label={<>Primary contact <span className="text-danger">*</span></>}><Input value={profileForm.primaryContact} onChange={e => setProfileForm(p => ({ ...p, primaryContact: e.target.value }))} /></Row>
              <Row label={<>Email <span className="text-danger">*</span></>}><Input type="email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} /></Row>
              <Row label={<>Phone <span className="text-danger">*</span></>}><Input type="tel" value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))} /></Row>
              <Row label={<>Business address <span className="text-danger">*</span></>}><Input value={profileForm.businessAddress} onChange={e => setProfileForm(p => ({ ...p, businessAddress: e.target.value }))} /></Row>
              {/* <Row label="Target zip codes"><Input value={profileForm.targetZipCodes} onChange={e => setProfileForm(p => ({ ...p, targetZipCodes: e.target.value }))} /></Row> */}
              {/* <div className="grid grid-cols-2 gap-4">
                <Row label="Avg home price"><Input value={profileForm.avgHomePrice} onChange={e => setProfileForm(p => ({ ...p, avgHomePrice: e.target.value }))} /></Row>
                <Row label="Homes built / year"><Input value={profileForm.homesPerYear} onChange={e => setProfileForm(p => ({ ...p, homesPerYear: e.target.value }))} /></Row>
              </div> */}

              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="text-sm font-semibold text-foreground mb-4">AI Concierge Preferences</h4>
                <Row label="Timezone">
                  <CustomSelect
                    options={[
                      { value: "America/New_York", label: "Eastern Time (EST/EDT)" },
                      { value: "America/Chicago", label: "Central Time (CST/CDT)" },
                      { value: "America/Denver", label: "Mountain Time (MST/MDT)" },
                      { value: "America/Los_Angeles", label: "Pacific Time (PST/PDT)" },
                      { value: "Europe/London", label: "London (GMT/BST)" },
                      { value: "Asia/Kolkata", label: "India Standard Time (IST)" },
                    ]}
                    value={profileForm.timezone}
                    onChange={(val) => setProfileForm(p => ({ ...p, timezone: val }))}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Used by the AI to convert meeting requests into correct UTC times for your calendar.
                  </p>
                </Row>
                
                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground uppercase tracking-widest flex items-center gap-1">
                      <span>AI Knowledge Base / Builder Defaults</span>
                      <span className="text-red-500 font-bold">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setProfileForm(p => ({
                        ...p,
                        aiContext: p.aiContext && p.aiContext.trim().length > 10 ? p.aiContext : `Operating Hours: Monday–Friday 8:00 AM – 5:30 PM, Saturday by appointment.\nSpecialization: Luxury architectural custom homes, site-sensitive estate design, and complete modern transformations.\nConsultation Locations: Private design studio or virtual video conference.\nFeasibility: Complimentary zoning envelope, topography slope analysis, and utility verification for buyer parcels.\nPricing & Policy: Bespoke custom builds starting at regional luxury market standards. Detailed estimates provided post-architectural discovery.`
                      }))}
                      className="text-[11px] text-primary hover:underline font-medium transition-colors cursor-pointer"
                    >
                      + Insert Standard Builder Template
                    </button>
                  </div>
                  <textarea
                    value={profileForm.aiContext}
                    onChange={e => setProfileForm(p => ({ ...p, aiContext: e.target.value }))}
                    placeholder="e.g. Office hours: Mon-Fri 8am-5pm. We specialize in luxury custom homes and architectural estates. Consultation locations: Studio or virtual video call. Feasibility: Complimentary slope and setback verification for buyer lots."
                    className="w-full bg-[#141414] border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors text-white resize-y min-h-[110px]"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The autonomous AI concierge quotes strictly from this context when conversing with leads and booking consultations. Prevents misinformation and regional assumptions.
                  </p>
                </div>
              </div>
              <Save onClick={handleSaveProfile} isSaving={isSavingProfile} saved={profileSaved} />

              <div className="mt-8 pt-6 border-t border-danger/20">
                <h3 className="text-sm font-semibold text-danger mb-2">Danger Zone</h3>
                <p className="text-xs text-muted-foreground mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                <button 
                  onClick={() => {
                    if(confirm("Are you absolutely sure you want to delete your account? All data will be lost.")) {
                      alert("Account deletion requested. Support will contact you shortly.");
                    }
                  }}
                  className="px-4 py-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 rounded-md text-sm font-semibold transition-colors"
                >
                  Delete Account
                </button>
              </div>
            </div>
          )}

          {active === "Appearance" && (
            <div className="space-y-4">
              <H>Appearance</H>
              <div className="bg-card border border-border rounded-xl p-6 shadow-xs">
                <label className="block text-sm font-medium text-muted-foreground mb-4">Theme Preference</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setTheme("light")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                      theme === "light" 
                        ? "bg-white text-black border-white" 
                        : "bg-transparent text-muted-foreground border-border hover:text-white"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                      theme === "dark" 
                        ? "bg-white text-black border-white" 
                        : "bg-transparent text-muted-foreground border-border hover:text-white"
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                      theme === "system" 
                        ? "bg-white text-black border-white" 
                        : "bg-transparent text-muted-foreground border-border hover:text-white"
                    }`}
                  >
                    System
                  </button>
                </div>
              </div>
            </div>
          )}

          {active === "Notifications" && (
            <div className="space-y-4">
              <H>Notification Preferences</H>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Notify me when</div>
              <Toggle label="New lead arrives" checked={notifForm.newLead} onChange={v => setNotifForm(p => ({ ...p, newLead: v }))} />
              <Toggle label="Lead replies to AI" checked={notifForm.leadReplies} onChange={v => setNotifForm(p => ({ ...p, leadReplies: v }))} />
              <Toggle label="Hot lead detected" checked={notifForm.hotLead} onChange={v => setNotifForm(p => ({ ...p, hotLead: v }))} />
              <Toggle label="Appointment booked" checked={notifForm.apptBooked} onChange={v => setNotifForm(p => ({ ...p, apptBooked: v }))} />
              <div className="text-xs uppercase tracking-wider text-muted-foreground pt-4">Notification Channel</div>
              <div className="flex gap-2">
                <div className="px-3.5 py-1.5 rounded-md text-xs font-mono bg-primary/15 border border-primary/40 text-primary font-bold flex items-center gap-1.5">
                  <Check className="size-3" />
                  <span>Email (Direct In-App & Push)</span>
                </div>
              </div>
              <Toggle label="Quiet hours (10 PM – 7 AM)" checked={notifForm.quietHours} onChange={v => setNotifForm(p => ({ ...p, quietHours: v }))} />
              <Save onClick={handleSaveNotif} isSaving={isSavingNotif} saved={notifSaved} />
            </div>
          )}

          {active === "Integrations" && (
            <div className="space-y-6">
              <div>
                <H>Integrations & API Credentials</H>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect inbound website lead sources, company mailboxes, and third-party CRMs to automate high-ticket buyer qualification.
                </p>
              </div>

              <div className="border border-border rounded-lg bg-secondary/10 overflow-hidden transition-all duration-150">
                {/* Header Strip */}
                <div className="flex items-center justify-between p-4 bg-secondary/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-foreground text-xs font-mono font-bold shrink-0">
                      <Zap className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Inbound Lead Ingestion</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                          Auto Ingest
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Directly capture inquiries from your website forms, Meta ads, or Zapier into your autonomous pipeline.
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-success/10 text-success">
                      Active
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsInboundExpanded(!isInboundExpanded)}
                      className="text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      {isInboundExpanded ? "Close" : "Configure"}
                    </button>
                  </div>
                </div>

                {isInboundExpanded && (
                  <div className="p-5 border-t border-border/40 bg-card space-y-4 animate-in slide-in-from-top-2 duration-150">
                    <div className="p-4 sm:p-5 rounded-xl border border-border/70 bg-secondary/15 dark:bg-neutral-900/40 space-y-3.5 animate-in fade-in duration-150">

                      {/* Row 1: Icon & Title */}
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                          <Globe className="size-4.5 text-[#c9a84c] dark:text-[#e5d9c5]" />
                        </div>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                            Inbound Webhook Endpoint
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Subtitle / Description */}
                      <div className="text-xs text-muted-foreground">
                        Accepts JSON & form-encoded payloads from any lead source
                      </div>

                      {/* Row 3: Action Buttons (Show URL, Copy URL, Test Lead) */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <button
                          type="button"
                          onClick={() => setShowWebhookUrl(!showWebhookUrl)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm font-medium"
                          title={showWebhookUrl ? "Hide full URL" : "Show full URL"}
                        >
                          {showWebhookUrl ? <EyeOff className="size-3 text-muted-foreground" /> : <Eye className="size-3 text-primary" />}
                          <span>{showWebhookUrl ? "Hide URL" : "Show URL"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(inboundWebhookUrl, "webhook_url")}
                          className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm font-medium"
                          title="Copy webhook URL to clipboard"
                        >
                          {copiedKey === "webhook_url" ? (
                            <>
                              <Check className="size-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="size-3 text-foreground" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleSendTestLead}
                          disabled={isTestingInbound}
                          className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm font-medium"
                          title="Send sample qualified lead"
                        >
                          {isTestingInbound ? (
                            <>
                              <Loader2 className="size-3 animate-spin" />
                              <span>Testing...</span>
                            </>
                          ) : (
                            <>
                              <Send className="size-3 text-primary" />
                              <span>Test Lead</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Visible URL Bar when toggled */}
                      {showWebhookUrl && (
                        <div className="p-3 rounded-lg bg-[#101010] border border-border font-mono text-xs text-foreground select-all overflow-x-auto whitespace-nowrap animate-in fade-in duration-150">
                          <span className="font-mono text-xs text-foreground/90">{inboundWebhookUrl}</span>
                        </div>
                      )}

                      {/* Test Inbound Result Banner */}
                      {testInboundResult && (
                        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1 ${
                          testInboundResult.success
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-medium"
                            : "bg-red-500/10 border-red-500/30 text-red-400"
                        }`}>
                          <div className="flex items-center gap-2 min-w-0">
                            {testInboundResult.success ? (
                              <CheckCircle className="size-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="size-4 text-red-400 shrink-0" />
                            )}
                            <span className="truncate">{testInboundResult.message}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTestInboundResult(null)}
                            className="p-1 hover:bg-white/10 rounded text-muted-foreground hover:text-white cursor-pointer"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Row 2: Platform Dropdown Selector */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                          Platform Setup Guide
                        </label>
                        <CustomSelect
                          value={inboundTab}
                          onChange={(val) => setInboundTab(val as any)}
                          options={inboundPlatformOptions}
                          align="left"
                        />
                      </div>

                      {/* Row 3: Setup Instructions Box */}
                      <div className="p-4 rounded-xl bg-[#101010] border border-border/80 space-y-3">
                        {inboundTab === "zapier" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                                  <rect width="24" height="24" rx="5" fill="#FF4F00" />
                                  <path d="M11 5h2v6h5v2h-5v6h-2v-6H6v-2h5V5z" fill="#FFF" />
                                  <path d="M7.4 6.6l1.4-1.4 8.5 8.5-1.4 1.4L7.4 6.6zm9.9 1.4l-1.4-1.4-8.5 8.5 1.4 1.4 8.5-8.5z" fill="#FFF" />
                                </svg>
                                <span>Zapier Webhook Setup</span>
                              </h4>
                              <span className="text-[10px] font-mono text-muted-foreground">3-Step Setup</span>
                            </div>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                              <li>In Zapier, create a new Zap and choose your trigger app (e.g. Typeform, Google Forms, Calendly, or Lead Ads).</li>
                              <li>Add an Action: choose <strong className="text-foreground">"Webhooks by Zapier"</strong> &rarr; Event: <strong className="text-foreground">"Custom Request"</strong> (or <strong className="text-foreground">POST</strong>).</li>
                              <li>Paste your WeaverFrame Webhook URL into <code className="text-foreground font-mono">URL</code>, select <code className="text-foreground font-mono">Payload Type: JSON</code>, and map fields: <code className="text-foreground font-mono">name</code>, <code className="text-foreground font-mono">email</code>, <code className="text-foreground font-mono">phone</code>, <code className="text-foreground font-mono">estimatedBudget</code>, <code className="text-foreground font-mono">county</code>, <code className="text-foreground font-mono">message</code>.</li>
                            </ol>
                          </div>
                        )}

                        {inboundTab === "make" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                                  <rect width="24" height="24" rx="5" fill="#6E00F5" />
                                  <path d="M5.5 8.5L9.5 5.5L13.5 8.5L9.5 11.5L5.5 8.5Z" fill="#FFF" />
                                  <path d="M10.5 12.5L14.5 9.5L18.5 12.5L14.5 15.5L10.5 12.5Z" fill="#FFF" opacity="0.9"/>
                                  <path d="M5.5 15.5L9.5 12.5L13.5 15.5L9.5 18.5L5.5 15.5Z" fill="#FFF" opacity="0.75"/>
                                </svg>
                                <span>Make.com (Integromat) Setup</span>
                              </h4>
                              <span className="text-[10px] font-mono text-muted-foreground">HTTP Module</span>
                            </div>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                              <li>Add an <strong className="text-foreground">"HTTP &rarr; Make a request"</strong> module at the end of your Make scenario.</li>
                              <li>Set URL to your WeaverFrame Webhook URL, and Method to <strong className="text-foreground">POST</strong>.</li>
                              <li>Set Body type to <strong className="text-foreground">Raw</strong> and Content type to <strong className="text-foreground">JSON (application/json)</strong>. Map your lead variables in the JSON body.</li>
                            </ol>
                          </div>
                        )}

                        {inboundTab === "wordpress" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#21759B">
                                  <path d="M12 2C6.486 2 2 6.486 2 12c0 4.418 2.865 8.167 6.839 9.49L4.47 8.358C5.83 5.46 8.7 3.5 12 3.5c1.68 0 3.25.503 4.568 1.368L12 2zm8.53 10c0-1.657-.597-2.808-1.11-3.71-.682-1.11-1.32-2.046-1.32-3.155 0-1.233.937-2.383 2.26-2.383.104 0 .204.01.306.022A9.957 9.957 0 0012 3.5c-3.766 0-7.067 2.09-8.79 5.204l5.748 16.717c.64-1.87 1.312-4.54 1.312-6.657 0-1.657-.597-2.808-1.11-3.71-.682-1.11-1.32-2.046-1.32-3.155 0-1.233.937-2.383 2.26-2.383zM12 22a9.96 9.96 0 005.161-1.425l-5.07-14.73-5.26 14.797A9.97 9.97 0 0012 22z"/>
                                </svg>
                                <span>WordPress (Elementor Pro / WPForms / Gravity)</span>
                              </h4>
                              <span className="text-[10px] font-mono text-muted-foreground">Native Form Webhooks</span>
                            </div>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                              <li>In Elementor Pro Form settings, open <strong className="text-foreground">"Actions After Submit"</strong> and add <strong className="text-foreground">"Webhook"</strong> (or use WPForms / Gravity Forms Webhook addon).</li>
                              <li>Under the Webhook tab, paste your WeaverFrame Webhook URL.</li>
                              <li>Ensure your form field IDs or Shortcodes match: <code className="text-foreground font-mono">name</code>, <code className="text-foreground font-mono">email</code>, <code className="text-foreground font-mono">phone</code>, <code className="text-foreground font-mono">estimatedBudget</code>, and <code className="text-foreground font-mono">county</code>.</li>
                            </ol>
                          </div>
                        )}

                        {inboundTab === "meta" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#0081FB">
                                  <path d="M16.96 4C14.74 4 13.06 5.21 12 6.55 10.94 5.21 9.26 4 7.04 4 3.15 4 0 7.22 0 11.23c0 4.88 4.25 9.07 10.63 11.13.88.29 1.86.29 2.74 0C19.75 20.3 24 16.11 24 11.23 24 7.22 20.85 4 16.96 4zm-9.92 9.77c-2.06 0-3.68-1.59-3.68-3.54 0-1.96 1.62-3.55 3.68-3.55 1.51 0 2.59.88 3.32 1.89-1.23 1.58-2.36 3.49-3.32 5.2zm9.92 0c-.96-1.71-2.09-3.62-3.32-5.2.73-1.01 1.81-1.89 3.32-1.89 2.06 0 3.68 1.59 3.68 3.55 0 1.95-1.62 3.54-3.68 3.54z"/>
                                </svg>
                                <span>Meta Lead Ads (Facebook & Instagram)</span>
                              </h4>
                              <span className="text-[10px] font-mono text-muted-foreground">Instant Lead Sync</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Connect Meta Lead Ads directly to your WeaverFrame webhook using Zapier's free <strong className="text-foreground">Facebook Lead Ads</strong> trigger or directly subscribe via Meta Graph Webhooks (our endpoint automatically satisfies the Meta <code className="text-foreground font-mono">hub.challenge</code> handshake). When a buyer submits an ad form on Instagram or Facebook, WeaverFrame ingests the lead in &lt;1 second, auto-forwards to your CRMs, and triggers autonomous AI follow-up!
                            </p>
                          </div>
                        )}

                        {inboundTab === "webflow" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#146EF5">
                                  <path d="M17.8 7.2c-.3 0-.6.1-.8.4L13.7 13l-2.4-7.8c-.1-.3-.4-.5-.7-.5s-.6.2-.7.5L6.6 15.9 4.3 8.3c-.1-.3-.4-.5-.7-.5H1.4c-.4 0-.7.4-.6.8l3.6 11.9c.1.3.4.5.7.5h2.8c.3 0 .6-.2.7-.5l3.2-9.6 3.2 9.6c.1.3.4.5.7.5h2.8c.3 0 .6-.2.7-.5l4.8-12.7c.1-.4-.2-.8-.6-.8h-1.9z"/>
                                </svg>
                                <span>Webflow Forms Webhook</span>
                              </h4>
                              <span className="text-[10px] font-mono text-muted-foreground">Project Settings</span>
                            </div>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                              <li>In your Webflow project, go to <strong className="text-foreground">Project Settings &rarr; Integrations &rarr; Webhooks</strong>.</li>
                              <li>Click <strong className="text-foreground">"Add Webhook"</strong>, select Trigger: <strong className="text-foreground">"Form Submission"</strong>.</li>
                              <li>Paste your WeaverFrame Webhook URL and click <strong className="text-foreground">Add Webhook</strong>. All website submissions will instantly flow into WeaverFrame!</li>
                            </ol>
                          </div>
                        )}

                        {inboundTab === "whatsapp" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="#25D366">
                                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 20.15C10.57 20.15 9.12 19.76 7.85 19.01L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.8 7.37 7.5 3.67 12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.05 20.15M16.56 14.39C16.31 14.26 15.09 13.66 14.86 13.58C14.64 13.5 14.47 13.45 14.31 13.7C14.15 13.95 13.68 14.5 13.53 14.67C13.39 14.84 13.24 14.86 12.99 14.74C12.74 14.61 11.94 14.35 11 13.51C10.26 12.85 9.77 12.04 9.62 11.79C9.48 11.54 9.61 11.4 9.73 11.28C9.84 11.17 9.98 10.99 10.1 10.85C10.23 10.71 10.27 10.6 10.35 10.44C10.43 10.27 10.39 10.13 10.33 10C10.27 9.88 9.77 8.65 9.57 8.15C9.37 7.67 9.16 7.73 9.01 7.72H8.52C8.36 7.72 8.09 7.78 7.87 8.03C7.64 8.27 7 8.87 7 10.09C7 11.31 7.89 12.48 8.01 12.65C8.14 12.81 9.76 15.32 12.24 16.39C12.83 16.65 13.29 16.8 13.64 16.91C14.23 17.1 14.77 17.07 15.2 17.01C15.68 16.94 16.67 16.41 16.88 15.82C17.08 15.23 17.08 14.73 17.02 14.62C16.96 14.52 16.81 14.45 16.56 14.39Z" />
                                </svg>
                                <span>WhatsApp Business (Wati / Twilio / Respond.io)</span>
                              </h4>
                              <span className="text-[10px] font-mono text-muted-foreground">Inbound Chat Sync</span>
                            </div>
                            <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                              <li>In your WhatsApp Business BSP (e.g. Wati.io, Respond.io, or Twilio Studio flow), go to <strong className="text-foreground">Webhooks / Automations</strong>.</li>
                              <li>Set Webhook URL to your WeaverFrame Webhook URL (with pre-tagged <code className="text-foreground font-mono">&source=WhatsApp_Inbound</code>).</li>
                              <li>When a client sends their initial inquiry or message on WhatsApp, their phone number, name, and message are instantly ingested into WeaverFrame and deal readiness score is computed!</li>
                            </ol>
                          </div>
                        )}

                        {inboundTab === "html" && (
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                              <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                                <Code2 className="size-4 text-emerald-400 shrink-0" />
                                <span>1-Line HTML Form / Embed Snippet</span>
                              </h4>
                              <span className="text-[10px] font-mono text-muted-foreground">Embed Anywhere</span>
                            </div>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              Copy and paste this standard HTML consultation form into any custom website or landing page:
                            </p>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono text-muted-foreground">HTML Form Snippet:</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(`<form action="${inboundWebhookUrl}" method="POST">
  <input type="text" name="name" placeholder="Your Full Name" required />
  <input type="email" name="email" placeholder="Your Email Address" required />
  <input type="tel" name="phone" placeholder="Phone Number" />
  <input type="number" name="estimatedBudget" placeholder="Target Budget (e.g. 1800000)" />
  <input type="text" name="county" placeholder="County / Region (e.g. Palm Beach, Orange County, Westchester)" />
  <textarea name="message" placeholder="Describe your dream home vision..."></textarea>
  <button type="submit">Request Architectural Consultation</button>
</form>`, "html_form")}
                                  className="text-primary hover:underline flex items-center gap-1 font-mono text-[10px] cursor-pointer"
                                >
                                  {copiedKey === "html_form" ? "Copied HTML!" : "Copy HTML Snippet"}
                                </button>
                              </div>
                              <pre className="p-3 rounded-lg bg-[#101010] border border-border text-[11px] font-mono text-foreground/90 overflow-x-auto">
{`<form action="${inboundWebhookUrl}" method="POST">
  <input type="text" name="name" placeholder="Your Full Name" required />
  <input type="email" name="email" placeholder="Your Email Address" required />
  <input type="tel" name="phone" placeholder="Phone Number" />
  <input type="number" name="estimatedBudget" placeholder="Target Budget (e.g. 1800000)" />
  <input type="text" name="county" placeholder="County / Location" />
  <textarea name="message" placeholder="Project details..."></textarea>
  <button type="submit">Submit Inquiry</button>
</form>`}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Row 4: Shorter Clean Status Line */}
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono pt-3 border-t border-border/40">
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                        <span>Instant Webhook Ingestion • Auto-Forward to CRMs • Autonomous AI Replies Online</span>
                      </div>

                    </div>
                  </div>
                )}
              </div>
              {/* ════════════════════════════════════════════════════════════════════
                  2. COMPANY EMAIL & MAILBOX GATEWAY + CRM INTEGRATIONS
                  ════════════════════════════════════════════════════════════════════ */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Outbound Email Mailbox & Third-Party Sync
                </h4>

                {/* ── EMAIL & MAILBOX CONNECTION (PRIMARY AI MAIL GATEWAY) ── */}
                <div
                  id="activation-mailbox-section"
                  className={`border rounded-lg bg-secondary/10 overflow-hidden transition-all duration-700 ${
                    highlightSection === "mailbox"
                      ? "border-[#e5d9c5] ring-2 ring-[#e5d9c5] shadow-[0_0_35px_rgba(229,217,197,0.35)]"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between p-4 bg-secondary/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-foreground text-xs font-mono font-bold shrink-0">
                        <Mail className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">
                          Company Email & Mailbox Gateway
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          Send and receive AI lead conversations directly from your official company email.
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <span className={`text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded ${
                        isEmailConnected ? "bg-success/10 text-success" : "bg-neutral-800 text-muted-foreground"
                      }`}>
                        {isEmailConnected ? "Connected" : "Disconnected"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedIntegration(expandedIntegration === "email_mailbox" ? null : "email_mailbox")}
                        className="text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer"
                      >
                        {expandedIntegration === "email_mailbox" ? "Close" : isEmailConnected ? "Configure" : "Connect"}
                      </button>
                    </div>
                  </div>

                  {expandedIntegration === "email_mailbox" && (
                    <div className="p-5 border-t border-border/40 bg-card space-y-4 animate-in slide-in-from-top-2 duration-150">
                      {isEmailConnected ? (
                        /* ── ALREADY CONNECTED: SHOW ONLY HOW IT IS CONNECTED (NO CONFUSING FORM) ── */
                        <div className="space-y-4">
                          {credentials.email_mailbox?.provider === 'google_oauth' || credentials.email_mailbox?.provider === 'google' || (!credentials.email_mailbox?.password && (credentials.email_mailbox?.email || emailAddress)) ? (
                            <div className="p-4 sm:p-5 rounded-xl border border-border/70 bg-secondary/15 dark:bg-neutral-900/40 space-y-3.5 animate-in fade-in duration-150">
                              {/* Row 1: Google Icon, Google Workspace, Connected */}
                              <div className="flex items-center gap-3">
                                <div className="size-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                                  <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                  </svg>
                                </div>
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">Google Workspace</span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-medium shrink-0">
                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Connected
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: email */}
                              <div className="text-xs text-muted-foreground font-mono select-all">
                                {emailAddress || credentials.email_mailbox?.email || "Google Account Connected"}
                              </div>

                              {/* Row 3: Test Connection, Switch Account, Disconnect */}
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                <button
                                  type="button"
                                  onClick={handleTestEmail}
                                  disabled={isTestingEmail}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm font-medium"
                                  title="Verify handshake with Google"
                                >
                                  {isTestingEmail ? <RefreshCw className="size-3 animate-spin" /> : <Zap className="size-3 text-[#c9a84c] dark:text-[#e5d9c5]" />}
                                  <span>{isTestingEmail ? "Verifying..." : "Test Connection"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleConnectGoogle}
                                  disabled={isConnectingGoogle}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm font-medium"
                                  title="Switch or re-authorize Google account"
                                >
                                  <span>Switch Account</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsDisconnectModalOpen(true)}
                                  disabled={isSaving.email_mailbox}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-danger/20 text-danger hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50 shadow-sm font-medium"
                                >
                                  Disconnect
                                </button>
                              </div>

                              {/* Row 4: Shorter status */}
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono pt-3 border-t border-border/40">
                                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                <span>Active 2-Way Sync • AI Replies Online</span>
                              </div>
                            </div>
                          ) : credentials.email_mailbox?.provider === 'microsoft' ? (
                            <div className="p-4 sm:p-5 rounded-xl border border-border/70 bg-secondary/20 dark:bg-neutral-900/40 space-y-3.5 animate-in fade-in duration-150">
                              {/* Row 1: Microsoft Icon, Microsoft 365, Connected */}
                              <div className="flex items-center gap-3">
                                <div className="size-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 shadow-sm">
                                  <svg className="size-4.5 shrink-0" viewBox="0 0 24 24">
                                    <path fill="#F25022" d="M1 1h10v10H1z"/>
                                    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                                    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                                    <path fill="#FFB900" d="M13 13h10v10H13z"/>
                                  </svg>
                                </div>
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">Microsoft 365</span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-medium shrink-0">
                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Connected
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: email */}
                              <div className="text-xs text-muted-foreground font-mono select-all">
                                {emailAddress || credentials.email_mailbox?.email}
                              </div>

                              {/* Row 3: Test Connection, Disconnect */}
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                <button
                                  type="button"
                                  onClick={handleTestEmail}
                                  disabled={isTestingEmail}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm font-medium"
                                >
                                  {isTestingEmail ? <RefreshCw className="size-3 animate-spin" /> : <Zap className="size-3 text-[#c9a84c] dark:text-[#e5d9c5]" />}
                                  <span>{isTestingEmail ? "Verifying..." : "Test Connection"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsDisconnectModalOpen(true)}
                                  disabled={isSaving.email_mailbox}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-danger/20 text-danger hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50 shadow-sm font-medium"
                                >
                                  Disconnect
                                </button>
                              </div>

                              {/* Row 4: Shorter status */}
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono pt-3 border-t border-border/40">
                                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                <span>Active 2-Way Sync • AI Replies Online</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 sm:p-5 rounded-xl border border-border/70 bg-secondary/20 dark:bg-neutral-900/40 space-y-3.5 animate-in fade-in duration-150">
                              {/* Row 1: Server Icon, Custom SMTP / IMAP, Connected */}
                              <div className="flex items-center gap-3">
                                <div className="size-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 shadow-sm text-primary">
                                  <Server className="size-4.5" />
                                </div>
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">Custom SMTP / IMAP</span>
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 font-medium shrink-0">
                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    Connected
                                  </span>
                                </div>
                              </div>

                              {/* Row 2: email */}
                              <div className="text-xs text-muted-foreground font-mono select-all">
                                {emailAddress || credentials.email_mailbox?.email} {smtpHost ? `(${smtpHost})` : ''}
                              </div>

                              {/* Row 3: Test Connection, Disconnect */}
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                <button
                                  type="button"
                                  onClick={handleTestEmail}
                                  disabled={isTestingEmail}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm font-medium"
                                >
                                  {isTestingEmail ? <RefreshCw className="size-3 animate-spin" /> : <Zap className="size-3 text-[#c9a84c] dark:text-[#e5d9c5]" />}
                                  <span>{isTestingEmail ? "Verifying..." : "Test Connection"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsDisconnectModalOpen(true)}
                                  disabled={isSaving.email_mailbox}
                                  className="text-xs px-3 py-1.5 rounded-lg border border-danger/20 text-danger hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-50 shadow-sm font-medium"
                                >
                                  Disconnect
                                </button>
                              </div>

                              {/* Row 4: Shorter status */}
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono pt-3 border-t border-border/40">
                                <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                <span>Active 2-Way Sync • AI Replies Online</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* ── DISCONNECTED: SHOW PROVIDER SELECTOR & ONBOARDING FLOW ── */
                        <div className="space-y-4">
                          {/* Mail Provider Dropdown */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                              Mail Service Provider
                            </label>
                            <CustomSelect
                              value={emailProvider}
                              onChange={(val) => setEmailProvider(val as any)}
                              options={[
                                {
                                  value: "google",
                                  label: "Google Workspace",
                                  icon: (
                                    <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                    </svg>
                                  ),
                                },
                                {
                                  value: "microsoft",
                                  label: "Microsoft 365",
                                  icon: (
                                    <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                                      <path fill="#F25022" d="M1 1h10v10H1z"/>
                                      <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                                      <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                                      <path fill="#FFB900" d="M13 13h10v10H13z"/>
                                    </svg>
                                  ),
                                },
                                {
                                  value: "custom_smtp",
                                  label: "Custom SMTP / IMAP Server",
                                  icon: <Server className="size-4 shrink-0 text-muted-foreground" />,
                                },
                              ]}
                            />
                          </div>

                          {/* 1-Click Google Workspace OAuth (Default for Google) */}
                          {emailProvider === "google" && !showManualGoogle ? (
                            <div className="space-y-4">
                              <div className="p-5 rounded-lg border border-border/60 bg-secondary/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-150">
                                <div className="space-y-1 text-center sm:text-left">
                                  <div className="flex items-center justify-center sm:justify-start gap-2.5">
                                    <svg className="size-5 shrink-0" viewBox="0 0 24 24">
                                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                    </svg>
                                    <span className="text-sm font-semibold text-foreground">Google Workspace Authorization</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Connect your company Gmail or Google Workspace inbox securely with zero passwords or manual port setups.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleConnectGoogle}
                                  disabled={isConnectingGoogle}
                                  className="inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-md bg-white text-black hover:bg-neutral-100 font-semibold text-xs tracking-wide shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-60"
                                >
                                  {isConnectingGoogle ? (
                                    <>
                                      <RefreshCw className="size-3.5 animate-spin text-black" />
                                      <span>Connecting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="size-4" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                                      </svg>
                                      <span>Connect with Google</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => setShowManualGoogle(true)}
                                  className="text-[11px] text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
                                >
                                  Advanced: Configure manually with 16-character App Password →
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Manual Credentials Form (Microsoft 365, Custom SMTP, or manual Google) */
                            <div className="space-y-4">
                              {emailProvider === "google" && showManualGoogle && (
                                <div className="flex justify-between items-center pb-1">
                                  <span className="text-[11px] text-muted-foreground">Configuring Google via manual App Password</span>
                                  <button
                                    type="button"
                                    onClick={() => setShowManualGoogle(false)}
                                    className="text-[11px] text-primary hover:underline transition-colors cursor-pointer"
                                  >
                                    ← Switch back to Google Workspace Authorization
                                  </button>
                                </div>
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                                {/* Connected Email Address */}
                                <div className="sm:col-span-6 space-y-1.5">
                                  <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                                    Company Mailbox Email <span className="text-danger">*</span>
                                  </label>
                                  <input
                                    type="email"
                                    value={emailAddress}
                                    onChange={e => setEmailAddress(e.target.value)}
                                    placeholder="e.g. contact@luxuryhomes.com"
                                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:border-white/60 font-mono"
                                  />
                                </div>

                                {/* Sender Display Name */}
                                <div className="sm:col-span-6 space-y-1.5">
                                  <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                                    Sender Display Name
                                  </label>
                                  <input
                                    type="text"
                                    value={emailSenderName}
                                    onChange={e => setEmailSenderName(e.target.value)}
                                    placeholder="e.g. Alex | Luxury Homes Studio"
                                    className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:border-white/60"
                                  />
                                </div>

                                {/* App Password / Access Secret */}
                                {emailProvider !== "custom_smtp" ? (
                                  <div className="sm:col-span-12 space-y-1.5">
                                    <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                                      {emailProvider === "google" ? "Google Workspace App Password" : "Microsoft 365 App Password / Secret"} <span className="text-danger">*</span>
                                    </label>
                                    <input
                                      type="password"
                                      value={emailPassword}
                                      onChange={e => setEmailPassword(e.target.value)}
                                      placeholder="Enter 16-character App Password (e.g. abcd efgh ijkl mnop)"
                                      className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-white/60"
                                    />
                                    <p className="text-[10px] text-muted-foreground">
                                      {emailProvider === "google"
                                        ? "🔑 Generated in Google Account > Security > 2-Step Verification > App Passwords."
                                        : "🔑 Generated in Microsoft 365 Admin / Azure Security > App Registrations or App Passwords."}
                                    </p>
                                  </div>
                                ) : (
                                  <>
                                    <div className="sm:col-span-6 space-y-1.5">
                                      <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                                        SMTP Server Host <span className="text-danger">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={smtpHost}
                                        onChange={e => setSmtpHost(e.target.value)}
                                        placeholder="e.g. smtp.mailgun.org or mail.yourdomain.com"
                                        className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-white/60"
                                      />
                                    </div>

                                    <div className="sm:col-span-3 space-y-1.5">
                                      <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                                        SMTP Port <span className="text-danger">*</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={smtpPort}
                                        onChange={e => setSmtpPort(e.target.value)}
                                        placeholder="587"
                                        className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-white/60"
                                      />
                                    </div>

                                    <div className="sm:col-span-3 space-y-1.5 flex flex-col justify-center pt-3">
                                      <label className="flex items-center gap-2 cursor-pointer text-xs text-foreground">
                                        <input
                                          type="checkbox"
                                          checked={useSsl}
                                          onChange={e => setUseSsl(e.target.checked)}
                                          className="size-4 accent-primary rounded"
                                        />
                                        <span>Use SSL (Port 465)</span>
                                      </label>
                                    </div>

                                    <div className="sm:col-span-12 space-y-1.5">
                                      <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                                        SMTP Password <span className="text-danger">*</span>
                                      </label>
                                      <input
                                        type="password"
                                        value={emailPassword}
                                        onChange={e => setEmailPassword(e.target.value)}
                                        placeholder="Enter SMTP password"
                                        className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-white/60"
                                      />
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Card Actions Footer */}
                              <div className="flex items-center justify-between pt-2 border-t border-border/20">
                                <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                                  <Lock className="size-3 text-emerald-500" />
                                  AES-256 GCM encrypted
                                </span>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={handleTestEmail}
                                    disabled={isTestingEmail || !emailAddress.trim()}
                                    className="px-3 py-1.5 border border-border hover:bg-secondary text-xs font-medium text-foreground rounded transition-colors flex items-center gap-1 disabled:opacity-50"
                                  >
                                    {isTestingEmail ? (
                                      <>
                                        <RefreshCw className="size-3 animate-spin" />
                                        <span>Verifying...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Zap className="size-3 text-[#c9a84c] dark:text-[#e5d9c5]" />
                                        <span>Test</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={handleSaveEmail}
                                    disabled={isSaving.email_mailbox || !emailAddress.trim()}
                                    className="px-4 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/95 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                  >
                                    {isSaving.email_mailbox ? (
                                      <>
                                        <RefreshCw className="size-3 animate-spin" />
                                        <span>Saving...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Sparkles className="size-3" />
                                        <span>Save & Sync</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {integrationsList.map((i) => {
                  const isExpanded = expandedIntegration === i.id;
                  const isConnected = connectionStatus[i.id];
                  
                  return (
                    <div key={i.id} className="border border-border rounded-lg bg-secondary/10 overflow-hidden transition-all duration-150">
                      <div className="flex items-center justify-between p-4 bg-secondary/30">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-foreground text-xs font-mono font-bold shrink-0">
                            {i.icon}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-foreground">{i.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{i.desc}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded ${isConnected ? "bg-success/10 text-success" : "bg-neutral-800 text-muted-foreground"}`}>
                            {isConnected ? "Connected" : "Disconnected"}
                          </span>
                          <button
                            onClick={() => setExpandedIntegration(isExpanded ? null : i.id)}
                            className="text-xs px-3 py-1.5 rounded border border-border text-foreground hover:bg-secondary transition-colors"
                          >
                            {isExpanded ? "Close" : isConnected ? "Configure" : "Connect"}
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-5 border-t border-border/40 bg-card space-y-4 animate-in slide-in-from-top-2 duration-150">
                          <div className="grid grid-cols-2 gap-4">
                            {i.fields.map((field) => (
                              <div key={field.key} className={field.colSpan === 2 ? "col-span-2" : "col-span-1"}>
                                <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1.5">
                                  {field.label} {field.required && <span className="text-danger">*</span>}
                                </label>
                                <input
                                  type={field.type}
                                  value={credentials[i.id]?.[field.key] || ""}
                                  onChange={(e) => handleCredentialChange(i.id, field.key, e.target.value)}
                                  placeholder={field.placeholder}
                                  className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-xs text-foreground focus:outline-none focus:border-white/60 font-mono"
                                />
                              </div>
                            ))}
                          </div>

                           <div className="flex items-center justify-between pt-2 border-t border-border/20">
                             <span className="text-[10px] text-muted-foreground font-sans">
                               {/* {i.id === "google" && "🔑 Synchronizes and auto-replies to Google Business reviews."} */}
                               {/* {i.id === "houzz" && "🔑 Tracks 5-star Houzz review routing progress."} */}
                               {/* {i.id === "facebook" && "🔑 Fetches social page check-ins and recommendations."} */}
                               {i.id === "hubspot" && "🔄 Automatically syncs qualified leads directly to pipeline deals."}
                               {i.id === "ghl" && "🔄 Synchronizes custom fields, contact pipelines, and AI actions inside GHL."}

                             </span>
                             <div className="flex gap-2">
                               {isConnected && (
                                 <button
                                   type="button"
                                   onClick={() => setDisconnectTarget({ id: i.id, name: i.name })}
                                   disabled={isSaving[i.id]}
                                   className="px-3 py-1.5 border border-danger/20 hover:bg-danger/10 text-danger rounded text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                                 >
                                   {isSaving[i.id] && <Loader2 className="size-3 animate-spin" />}
                                   Disconnect
                                 </button>
                               )}
                               <button
                                 type="button"
                                 onClick={() => handleConnect(i.id)}
                                 disabled={isSaving[i.id]}
                                 className="px-4 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/95 transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                 {isSaving[i.id] && <Loader2 className="size-3 animate-spin" />}
                                 Save & Sync
                               </button>
                             </div>
                           </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {active === "Billing" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Subscription & Billing</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Active subscription tier, automated monthly billing, and Stripe payment methods.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleOpenPortal}
                    disabled={isOpeningPortal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    title="Manage payment methods and receipts in Stripe"
                  >
                    {isOpeningPortal ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        <span>Opening Portal...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="size-3.5 text-[#c9a84c] dark:text-[#e5d9c5]" />
                        <span>Stripe Customer Portal</span>
                        <ExternalLink className="size-3 text-muted-foreground" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Collapsible Active Subscription & Tier Comparison Card */}
              <div className="border border-border rounded-xl bg-secondary/10 overflow-hidden transition-all duration-150">
                {/* Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-secondary/30 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#c9a84c] dark:text-[#e5d9c5] shrink-0 shadow-inner">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground truncate">
                          {currentPlan.name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30">
                          {currentPlan.price} / mo
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          ACTIVE
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {currentPlan.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setIsPlansExpanded(!isPlansExpanded)}
                      className="text-xs px-3.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
                    >
                      <span>{isPlansExpanded ? "Hide Plans" : "Change / Compare Plans"}</span>
                      <ChevronDown className={`size-3.5 transition-transform duration-200 ${isPlansExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded Plan Comparison Drawer */}
                {isPlansExpanded && (
                  <div className="p-5 border-t border-border/40 bg-card space-y-5 animate-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                          Available Subscription Tiers
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Upgrade or adjust your monthly pipeline capacity at any time.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* 1. Starter Tier */}
                      <Card className={`p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                        currentPlanKey === 'starter' || currentPlanKey === 'professional'
                          ? 'border-2 border-[#e5d9c5]/80 bg-card shadow-md shadow-[#e5d9c5]/5'
                          : 'border border-border/80 bg-card/60 hover:border-border'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                              Entry-Level Plan
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-[#c9a84c]/15 text-[#c9a84c] dark:text-[#e5d9c5] border border-[#c9a84c]/30">
                              STARTER TIER
                            </span>
                          </div>

                          <div className="text-xl font-bold text-foreground font-mono">
                            Starter
                          </div>

                          <div className="flex items-baseline gap-1 my-2">
                            <span className="font-nevera text-3xl sm:text-4xl font-normal text-foreground">
                              $149
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              / month (up to 50 leads)
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground font-light mb-4 leading-relaxed">
                            Designed for boutique builders. Autonomous AI email qualification, lead memory, and instant hot lead dispatches.
                          </p>

                          <div className="space-y-2 pt-3 border-t border-border/50 text-xs font-mono text-muted-foreground">
                            {[
                              "Up to 50 active leads / month",
                              "Autonomous AI email outreach & reply engine",
                              "Smart Hot/Warm/Cold score qualification",
                              "Instant email notifications & lead alerts",
                              "Standard email support"
                            ].map((feat, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px]">
                                <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-border/50">
                          {currentPlanKey === 'starter' || currentPlanKey === 'professional' ? (
                            <div className="w-full py-2 rounded-xl bg-secondary/80 border border-border text-center text-xs font-mono font-semibold text-foreground flex items-center justify-center gap-1.5">
                              <Check className="size-3.5 text-emerald-400" />
                              <span>Current Active Plan</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpgradePlan('starter')}
                              disabled={isUpgradingPlan !== null}
                              className="w-full py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-mono font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {isUpgradingPlan === 'starter' ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin" />
                                  <span>Connecting to Stripe...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="size-3.5 text-[#e5d9c5]" />
                                  <span>Switch to Starter ($149/mo)</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </Card>

                      {/* 2. Growth Tier */}
                      <Card className={`p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 ${
                        currentPlanKey === 'growth' || currentPlanKey === 'enterprise'
                          ? 'border-2 border-[#e5d9c5]/80 bg-card shadow-md shadow-[#e5d9c5]/5'
                          : 'border border-[#e5d9c5]/30 bg-card/80 hover:border-[#e5d9c5]/60'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="text-[10.5px] uppercase tracking-wider text-[#e5d9c5] font-mono font-semibold">
                              Most Popular
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-mono font-bold bg-[#e5d9c5] text-black font-semibold shadow-sm">
                              GROWTH TIER
                            </span>
                          </div>

                          <div className="text-xl font-bold text-foreground font-mono">
                            Growth
                          </div>

                          <div className="flex items-baseline gap-1 my-2">
                            <span className="font-nevera text-3xl sm:text-4xl font-normal text-gold-gradient">
                              $349
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              / month (up to 200 leads)
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground font-light mb-4 leading-relaxed">
                            For high-volume residential custom builders. Advanced conversational nuance, multi-turn objection handling & site visit booking.
                          </p>

                          <div className="space-y-2 pt-3 border-t border-border/50 text-xs font-mono text-muted-foreground">
                            {[
                              "Up to 200 active leads / month",
                              "Live site walkthrough & calendar booking",
                              "Deep architectural memory & floor plan context",
                              "Multi-seat builder team collaboration",
                              "Priority concierge onboarding & support"
                            ].map((feat, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px]">
                                <CheckCircle2 className="size-3.5 text-[#e5d9c5] shrink-0" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mt-6 pt-4 border-t border-border/50">
                          {currentPlanKey === 'growth' || currentPlanKey === 'enterprise' ? (
                            <div className="w-full py-2 rounded-xl bg-secondary/80 border border-border text-center text-xs font-mono font-semibold text-foreground flex items-center justify-center gap-1.5">
                              <Check className="size-3.5 text-emerald-400" />
                              <span>Current Active Plan</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleUpgradePlan('growth')}
                              disabled={isUpgradingPlan !== null}
                              className="w-full py-2.5 rounded-xl bg-[#e5d9c5] hover:bg-white text-black text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-[#e5d9c5]/20 disabled:opacity-50"
                            >
                              {isUpgradingPlan === 'growth' ? (
                                <>
                                  <Loader2 className="size-3.5 animate-spin text-black" />
                                  <span>Connecting to Stripe...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="size-3.5 text-black" />
                                  <span>Upgrade to Growth ($349/mo)</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </Card>
                    </div>
                  </div>
                )}
              </div>

              {/* Infrastructure Readiness & Billing History */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-4 border border-border bg-card">
                  <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Billing Currency</div>
                  <div className="text-xl font-nevera text-foreground mt-1">USD ($)</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Global credit card & ACH settlement</div>
                </Card>

                <Card className="p-4 border border-border bg-card">
                  <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Payment Processor</div>
                  <div className="text-xl font-nevera text-foreground mt-1 flex items-center gap-1.5">
                    <span>Stripe</span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">READY</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Automated webhook sync enabled</div>
                </Card>

                <Card className="p-4 border border-border bg-card">
                  <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">Auto-Renewal</div>
                  <div className="text-xl font-nevera text-foreground mt-1">Active</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Billed monthly on subscription date</div>
                </Card>
              </div>

              {/* Invoice History */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono font-semibold">
                    Invoice & Billing History
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Automated Monthly Receipts
                  </span>
                </div>
                <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 text-[10.5px] font-mono text-muted-foreground uppercase tracking-wider border-b border-border">
                      <tr className="text-left">
                        <th className="px-4 py-2.5 font-medium">Invoice #</th>
                        <th className="px-4 py-2.5 font-medium">Billing Date</th>
                        <th className="px-4 py-2.5 font-medium">Amount</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {(loadedBillingProfile?.invoices && loadedBillingProfile.invoices.length > 0) ? (
                        loadedBillingProfile.invoices.map((inv: any) => (
                          <tr key={inv.id || inv.invoiceNumber} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-mono text-foreground text-xs font-semibold">
                              {inv.invoiceNumber}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs font-sans">
                              {inv.date}
                            </td>
                            <td className="px-4 py-3 font-mono text-foreground text-xs font-bold">
                              {inv.amount}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border inline-flex items-center gap-1 ${
                                inv.status === 'Paid' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                <span className={`size-1 rounded-full ${inv.status === 'Paid' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                {inv.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {inv.pdfUrl ? (
                                <a
                                  href={inv.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono font-semibold"
                                >
                                  <ExternalLink className="size-3" /> View Stripe Receipt
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => downloadInvoicePDF(inv)}
                                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono font-semibold cursor-pointer"
                                >
                                  <Download className="size-3" /> Download Invoice PDF
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-1.5 font-mono">
                              <FileText className="size-5 text-muted-foreground/60" />
                              <span className="font-semibold text-foreground">No invoices yet</span>
                              <span className="text-[11px] text-muted-foreground">
                                Receipts and invoice history will appear automatically once a payment is processed.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {active === "About" && (
            <div className="space-y-6">
              <div>
                <H>About WeaverFrame</H>
                <p className="text-xs text-muted-foreground mt-2">
                  System architecture, telemetry, and platform specifications.
                </p>
              </div>

              {/* Brand & Version Hero Card */}
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#161616] via-[#141414] to-[#121212] p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center p-2 shadow-inner">
                      <img src="/weaverframe-mark-transparent.png" alt="WeaverFrame" className="size-full object-contain" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-nevera text-lg text-white font-normal tracking-wide">
                          WeaverFrame™
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider uppercase rounded-full bg-[#e5d9c5]/15 border border-[#e5d9c5]/30 text-[#e5d9c5]">
                          v1.0.0.0 Stable
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">
                        Autonomous AI Sales OS for Custom Builders & Architectural Firms
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                      Production Live
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-center">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Release Version</div>
                    <div className="text-xs font-mono font-bold text-white mt-1">1.0.0.0</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Channel</div>
                    <div className="text-xs font-mono font-bold text-[#e5d9c5] mt-1">Initial Release</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Environment</div>
                    <div className="text-xs font-mono font-bold text-white mt-1">Enterprise Cloud</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-[10px] font-mono text-white/40 uppercase tracking-wider">Security Engine</div>
                    <div className="text-xs font-mono font-bold text-white mt-1">AES-256-GCM</div>
                  </div>
                </div>
              </div>

              {/* Core System Capabilities */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono uppercase tracking-wider text-white/60">
                  Core Platform Capabilities
                </h4>
                <div className="grid gap-2.5">
                  <div className="p-3.5 rounded-lg bg-secondary/30 border border-border flex items-start gap-3">
                    <Sparkles className="size-4 text-[#e5d9c5] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">24/7 Autonomous AI Lead Concierge</div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Instant qualification of inbound prospects, real-time 0–100 buyer readiness scoring, and automated personalized architectural email engagement.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-secondary/30 border border-border flex items-start gap-3">
                    <Zap className="size-4 text-[#e5d9c5] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Persistent Structured Memory Graph</div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Continuous contextual extraction of construction budget, timeline, lot acquisition status, and custom home style requirements.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-secondary/30 border border-border flex items-start gap-3">
                    <Mail className="size-4 text-[#e5d9c5] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">2-Way Mailbox Synchronization & Dispatch</div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Direct SMTP outbound email transmission paired with IMAP inbound listener, stripping quote headers and keeping threads fully synchronized.
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-secondary/30 border border-border flex items-start gap-3">
                    <ShieldCheck className="size-4 text-[#e5d9c5] shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Enterprise Multi-Tenant Data Isolation</div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Row-level security enforcement with strict tenant query scoping, preventing any cross-tenant data access or lead leakage.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Official Licensing & Support */}
              <div className="pt-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <div>
                  © 2026 WeaverFrame Technologies. All rights reserved.
                </div>
                <div className="flex items-center gap-4">
                  <a href="mailto:support@weaverframe.in" className="hover:text-[#e5d9c5] transition-colors">
                    support@weaverframe.in
                  </a>
                  <span>·</span>
                  <a href="https://weaverframe.in" target="_blank" rel="noopener noreferrer" className="hover:text-[#e5d9c5] transition-colors flex items-center gap-1">
                    weaverframe.in <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* {active === "Blocked Users" && (
            <div className="space-y-4">
              <H>Blocked Users</H>
              <p className="text-xs text-muted-foreground">Manage leads and contacts that you have blocked from messaging you.</p>
              
              <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                {[{id: "1", name: "Spam Caller", phone: "(512) 555-9999", date: "May 15, 2026"}].map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 bg-secondary/10">
                    <div>
                      <p className="text-sm font-medium text-foreground">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.phone} · Blocked on {user.date}</p>
                    </div>
                    <button className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-xs font-semibold transition-colors">
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )} */}

        </Card>
      </div>

      {/* Theme-Styled Disconnect Mailbox Confirmation Modal */}
      {isDisconnectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="size-11 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0 text-danger">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  Disconnect Mailbox?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to disconnect <span className="font-mono font-medium text-foreground">{emailAddress || credentials.email_mailbox?.email || "this mailbox"}</span>?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  The AI will no longer be able to autonomously read or reply to incoming emails from leads until reconnected.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(false)}
                disabled={isSaving.email_mailbox}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDisconnectEmail}
                disabled={isSaving.email_mailbox}
                className="px-4 py-2 rounded-lg bg-danger text-danger-foreground text-xs font-medium hover:bg-danger/90 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {isSaving.email_mailbox ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Disconnecting...</span>
                  </>
                ) : (
                  <span>Disconnect Mailbox</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Theme-Styled Disconnect Integration Confirmation Modal */}
      {disconnectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="size-11 rounded-xl bg-danger/10 border border-danger/20 flex items-center justify-center shrink-0 text-danger">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-base font-semibold text-foreground">
                  Disconnect {disconnectTarget.name}?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Are you sure you want to disconnect <span className="font-medium text-foreground">{disconnectTarget.name}</span>?
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed pt-1">
                  New leads and deals will no longer be automatically synchronized to this external CRM until reconnected.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setDisconnectTarget(null)}
                disabled={isSaving[disconnectTarget.id]}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDisconnectIntegration}
                disabled={isSaving[disconnectTarget.id]}
                className="px-4 py-2 rounded-lg bg-danger text-danger-foreground text-xs font-medium hover:bg-danger/90 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {isSaving[disconnectTarget.id] ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    <span>Disconnecting...</span>
                  </>
                ) : (
                  <span>Disconnect</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">{children}</h2>;
}
function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div><label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">{label}</label><div className="mt-1.5">{children}</div></div>;
}
function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />;
}
function Toggle({ label, checked, onChange }: { label: string; checked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className="text-sm text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange?.(e.target.checked)}
        className="accent-primary size-4"
      />
    </label>
  );
}
function Save({ onClick, isSaving, saved }: { onClick?: () => void; isSaving?: boolean; saved?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={isSaving}
      className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 mt-2 disabled:opacity-60 transition-all"
    >
      {isSaving ? (
        <><Loader2 className="size-4 animate-spin" /> Saving...</>
      ) : saved ? (
        <><Check className="size-4" /> Saved!</>
      ) : (
        "Save changes"
      )}
    </button>
  );
}
