import { RoutePending } from "@/components/dashboard/RoutePending";
import { createFileRoute, useLoaderData, useRouter } from "@tanstack/react-router";
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
  getWebhookUrl,
  saveWebhookUrl,
  getBillingProfile,
  updateBillingProfile,
  createStripeCheckoutSession,
  createStripeCustomerPortalSession,
  addManualLead,
} from "@/lib/dashboard";
import { Loader2, Check, X, AlertCircle, Download, Mail, Sparkles, RefreshCw, Lock, ShieldCheck, CheckCircle2, Zap, Server, Globe, CreditCard, ExternalLink, Copy, Code, Share2, Send, Terminal, Smartphone, Inbox, ArrowRight, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context }) => {
    if (typeof window === 'undefined') return
    const session = (context as any).session
    if (session && session.role === 'builder' && (session.builderRole === 'manager' || session.builderRole === 'sales')) {
      const { redirect } = await import('@tanstack/react-router')
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
        webhookUrl: '',
        billingProfile: { adSpendBalance: 0, paymentMethod: "None", plan: "trial" },
      };
    }

    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
    return Promise.all([
      getIntegrationsStatus(),
      getBuilderProfile({ data: { activeRole } }),
      getQualificationRules(),
      getNotificationSettings(),
      getWebhookUrl(),
      getBillingProfile(),
    ]).then(([integrationsStatus, builderProfile, qualRules, notifSettings, webhookUrl, billingProfile]) => ({
      integrationsStatus: integrationsStatus || {},
      builderProfile: builderProfile || {},
      qualRules: qualRules || {},
      notifSettings: notifSettings || {},
      webhookUrl: webhookUrl || '',
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
  const { integrationsStatus: loadedStatuses = {}, builderProfile: loadedProfile = {}, qualRules: loadedQualRules = {}, notifSettings: loadedNotif = {}, webhookUrl: loadedWebhookUrl = '', billingProfile: loadedBillingProfile = { adSpendBalance: 0, paymentMethod: "None", plan: "trial" } } = loaderData as any;
  const router = useRouter();
  const routeContext = (Route as any).useRouteContext ? (Route as any).useRouteContext() : {};
  const session = routeContext?.session;
  const isOwner = session?.role === 'admin' || session?.builderRole === 'owner';
  const availableSections = isOwner ? sections : sections.filter(s => s !== "Integrations" && s !== "Billing");

  // FIX-6: Hydration invalidation — if the SSR placeholder was served, trigger a
  // client-side refetch immediately after hydration to load the real settings data.
  useEffect(() => {
    if ((loaderData as any)?._isSsrPlaceholder) {
      router.invalidate()
    }
  }, [loaderData, router])

  const [active, setActive] = useState<typeof sections[number]>("Builder Profile");
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();

  // ── Billing States ──────────────────────────────────────────────────────────
  const [adSpendBalance, setAdSpendBalance] = useState(loadedBillingProfile.adSpendBalance);
  const [paymentMethod, setPaymentMethod] = useState(loadedBillingProfile.paymentMethod);
  const [billingPlan, setBillingPlan] = useState(loadedBillingProfile.plan || "professional");

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

  const downloadInvoicePDF = async (date: string, amount: string, status: string) => {
    const company = loadedProfile.companyName || "Your Company LLC";
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`${company} — INVOICE`, 20, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(`Invoice Date: ${date}`, 20, 40);
    doc.text(`Client Name: ${company}`, 20, 50);
    doc.text(`Contract ID: WF-2026-904`, 20, 60);
    doc.text(`Platform Fees: WeaverFrame SaaS ${currentPlan.name}`, 20, 70);
    doc.text(`Payment Status: ${status} (Visa •••• 4242)`, 20, 80);
    doc.text(`Merchant: WeaverFrame Inc.`, 20, 90);

    doc.setLineWidth(0.5);
    doc.line(20, 100, 190, 100);

    doc.setFont("helvetica", "bold");
    doc.text("Plan Description", 20, 110);
    doc.text("Total", 170, 110);
    
    doc.line(20, 115, 190, 115);

    doc.setFont("helvetica", "normal");
    doc.text(`WeaverFrame AI Lead Conversion OS (${currentPlan.name})`, 20, 125);
    doc.text("- 24/7 AI Lead Concierge & Automated Qualification", 25, 135);
    doc.text("- 24/7 Autonomous AI Email Concierge & Pipeline Sync", 25, 145);
    doc.text(amount, 170, 125);

    doc.line(20, 170, 190, 170);
    doc.setFont("helvetica", "bold");
    doc.text("Total Paid:", 20, 180);
    doc.text(amount, 170, 180);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Thank you for your business! If you have any questions, reach out to", 20, 210);
    doc.text("support@weaverframe.in · WeaverFrame Architecture OS", 20, 215);

    doc.save(`BE_Invoice_${date.replace(/\s+/g, '_').replace(/,/g, '')}.pdf`);
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
  const [profileForm, setProfileForm] = useState({
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
  });

  useEffect(() => {
    if (loadedProfile && Object.keys(loadedProfile).length > 0) {
      setProfileForm({
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
      });
    }
  }, [loadedProfile]);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const handleSaveProfile = async () => {
    // // Unique Zip Code Validation (Scraper remnant - commented out)
    // const zips = profileForm.targetZipCodes.split(',').map((z: string) => z.trim()).filter(Boolean);
    // const uniqueZips = new Set(zips);
    // if (uniqueZips.size !== zips.length) {
    //   alert("Error: Duplicate zip codes are not allowed in Target Zip Codes. Please remove duplicates.");
    //   return;
    // }

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

    setIsSavingProfile(true);
    try {
      await saveBuilderProfile({ data: profileForm });
      if (typeof window !== 'undefined') {
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

  // ── Webhook URL State ───────────────────────────────────────────────────
  const [webhookUrl, setWebhookUrl] = useState(loadedWebhookUrl || '');

  useEffect(() => {
    if (loadedWebhookUrl) {
      setWebhookUrl(loadedWebhookUrl);
    }
  }, [loadedWebhookUrl]);

  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [webhookSaved, setWebhookSaved] = useState(false);

  const handleSaveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      await saveWebhookUrl({ data: webhookUrl });
      setWebhookSaved(true);
      setTimeout(() => setWebhookSaved(false), 2500);
    } catch (err) {
      console.error(err);
      alert("Failed to save webhook URL.");
    } finally {
      setIsSavingWebhook(false);
    }
  };

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

  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailTestSuccess, setEmailTestSuccess] = useState<string | null>(null);

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
        if (em.provider) setEmailProvider(em.provider as any);
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
    if (!emailAddress.trim()) {
      alert("Please enter a valid company mailbox email first.");
      return;
    }
    setIsTestingEmail(true);
    setEmailTestSuccess(null);
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
        data: { platformId: "email_mailbox", credentials: creds }
      });
      setEmailTestSuccess(`Handshake verified! Connected to ${emailAddress}`);
      setTimeout(() => setEmailTestSuccess(null), 5000);
    } catch (err: any) {
      alert(`Mailbox Verification Failed: ${err?.message || err}`);
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!emailAddress.trim()) {
      alert("Please enter a company email address.");
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
        data: { platformId: "email_mailbox", credentials: creds }
      });
      await saveIntegrationCredentials({
        data: { platformId: "email_mailbox", credentials: creds }
      });
      setConnectionStatus(prev => ({ ...prev, email_mailbox: true }));
      setCredentials(prev => ({ ...prev, email_mailbox: creds }));
      await router.invalidate();
      alert(`Success: Company mailbox linked! AI can now send and receive emails as ${emailAddress}.`);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save mailbox connection: ${err?.message || err}`);
    } finally {
      setIsSaving(prev => ({ ...prev, email_mailbox: false }));
    }
  };

  const handleDisconnectEmail = async () => {
    setIsSaving(prev => ({ ...prev, email_mailbox: true }));
    try {
      await disconnectIntegration({
        data: { platformId: "email_mailbox" }
      });
      setConnectionStatus(prev => ({ ...prev, email_mailbox: false }));
      setCredentials(prev => ({ ...prev, email_mailbox: {} }));
      setEmailPassword("");
      await router.invalidate();
      alert("Mailbox disconnected.");
    } catch (err) {
      console.error(err);
      alert("Failed to disconnect mailbox.");
    } finally {
      setIsSaving(prev => ({ ...prev, email_mailbox: false }));
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

  const handleConnect = async (id: string) => {
    setIsSaving(prev => ({ ...prev, [id]: true }));
    try {
      const integrationCreds = credentials[id] || {};
      
      // Perform integration connection validation check first
      await testIntegrationConnection({
        data: { platformId: id, credentials: integrationCreds }
      });

      await saveIntegrationCredentials({
        data: { platformId: id, credentials: integrationCreds }
      });
      setConnectionStatus(prev => ({ ...prev, [id]: true }));
      setExpandedIntegration(null);
      await router.invalidate();
      alert(`Success: Credential lock secured and connection synced successfully!`);
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || "Failed to save credentials.";
      alert(`API Connection Failed: ${errMsg}`);
    } finally {
      setIsSaving(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDisconnect = async (id: string) => {
    setIsSaving(prev => ({ ...prev, [id]: true }));
    try {
      await disconnectIntegration({
        data: { platformId: id }
      });
      setConnectionStatus(prev => ({ ...prev, [id]: false }));
      setCredentials(prev => ({ ...prev, [id]: {} }));
      setExpandedIntegration(null);
      await router.invalidate();
      alert(`Disconnected integration from our platform.`);
    } catch (err) {
      console.error(err);
      alert("Failed to disconnect integration.");
    } finally {
      setIsSaving(prev => ({ ...prev, [id]: false }));
    }
  };

  // ── Inbound Lead Ingestion Hub State ─────────────────────────────────────────
  const [inboundTab, setInboundTab] = useState<"wordpress" | "meta" | "webflow" | "email_forward" | "zapier" | "embed">("wordpress");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isTestingInbound, setIsTestingInbound] = useState(false);
  const [testInboundResult, setTestInboundResult] = useState<{ success: boolean; message: string; leadId?: string; scoreTier?: string; dealScore?: number } | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const builderToken = session?.builderId || loadedProfile?.id || "builder_primary";
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://weaverframe.in';
  const inboundWebhookUrl = `${siteOrigin}/api/leads/inbound?token=${builderToken}`;
  const inboundEmailAddress = `leads+${builderToken.slice(0, 8)}@inbound.weaverframe.in`;

  const handleSendTestLead = async () => {
    setIsTestingInbound(true);
    setTestInboundResult(null);
    try {
      const county = profileForm.targetZipCodes ? `${profileForm.targetZipCodes.split(',')[0].trim()} CAD` : "Travis County";
      const res = await addManualLead({
        data: {
          name: "Harrison Vance (Test Inbound Lead)",
          email: `inbound.buyer.${Date.now().toString().slice(-4)}@example.com`,
          phone: "+1 (512) 555-0199",
          county,
          state: "TX",
          estimatedBudget: 2200000,
          source: `${inboundTab.toUpperCase()} Inbound Lead Hub`,
          scoreTier: "Hot",
          notes: "Looking for a 4,800 sqft modern architectural estate in Westlake. Lot survey already completed. Requesting architectural consultation.",
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
    // {
    //   id: "google",
    //   name: "Google Business Reviews API",
    //   desc: "Monitor Google Reviews in real-time, generate keyword-rich responses, and publish instantly.",
    //   icon: "G",
    //   fields: [
    //     { key: "clientId", label: "Google OAuth Client ID", type: "text", required: true, placeholder: "e.g. oauth-client.apps.googleusercontent.com" },
    //     { key: "clientSecret", label: "OAuth Client Secret", type: "password", required: true, placeholder: "Enter client secret key" },
    //     { key: "locationId", label: "Google Location ID", type: "text", required: true, placeholder: "e.g. accounts/12345/locations/67890" }
    //   ]
    {
      id: "hubspot",
      name: "HubSpot CRM Sync",
      desc: "Sync qualified builder leads, custom timelines, and budgets directly into your HubSpot deal pipelines.",
      icon: "H",
      fields: [
        { key: "accessToken", label: "Private App Access Token", type: "password", required: true, placeholder: "e.g. pat-na1-xxxxxxxxxxxxxxxxxxxx", colSpan: 2 }
      ]
    },
    // {
    //   id: "houzz",
    //   name: "Houzz Professional Reviews",
    //   desc: "Automatically route Houzz 5-Star reviews to boost local visibility and organic Houzz profile rank.",
    //   icon: "Hz",
    //   fields: [
    //     { key: "apiKey", label: "Houzz Partner API Key", type: "password", required: true, placeholder: "Enter Partner API Key" },
    //     { key: "profileUrl", label: "Houzz Profile URL", type: "text", required: true, placeholder: "e.g. houzz.com/pro/yourcompany" }
    //   ]
    // },
    // {
    //   id: "facebook",
    //   name: "Facebook Page & Recommendations API",
    //   desc: "Sync Facebook client reviews, recommendations, and local check-in mentions to our dashboard.",
    //   icon: "F",
    //   fields: [
    //     { key: "pageId", label: "Facebook Page ID", type: "text", required: true, placeholder: "e.g. 102459806497" },
    //     { key: "accessToken", label: "Page Access Token", type: "password", required: true, placeholder: "Enter Page Access Token", colSpan: 2 }
    //   ]
    // },
    {
      id: "ghl",
      name: "GoHighLevel (GHL) Sync",
      desc: "Sync contacts, pipeline stages, and AI conversation actions directly inside GHL sub-accounts.",
      icon: "GHL",
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
              onClick={() => setActive(s)}
              className={`block w-full text-left px-3 py-2 rounded-md text-sm ${active === s ? "bg-secondary text-foreground border-l-2 border-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}
        </nav>

        <Card className="p-6 max-w-2xl w-full">
          {active === "Builder Profile" && (
            <div className="space-y-4">
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
                  <label className="text-xs font-semibold text-foreground uppercase tracking-widest">
                    AI Knowledge Base / Builder Defaults
                  </label>
                  <textarea
                    value={profileForm.aiContext}
                    onChange={e => setProfileForm(p => ({ ...p, aiContext: e.target.value }))}
                    placeholder="e.g. Office hours: Mon-Sat 9am-6pm. We specialize in luxury custom homes & modern architectural estates. Consultation locations: Office or virtual video call."
                    className="w-full bg-[#0c0d12] border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors text-white resize-y min-h-[100px]"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Provide default operating hours, meeting locations, or policies. The AI will use this context when answering leads and booking appointments.
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
              <div className="bg-[#0a0a0a] border border-[#333] rounded-md p-6">
                <label className="block text-sm font-medium text-muted-foreground mb-4">Theme Preference</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setTheme("light")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                      theme === "light" 
                        ? "bg-white text-black border-white" 
                        : "bg-transparent text-muted-foreground border-[#333] hover:text-white"
                    }`}
                  >
                    Light
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                      theme === "dark" 
                        ? "bg-white text-black border-white" 
                        : "bg-transparent text-muted-foreground border-[#333] hover:text-white"
                    }`}
                  >
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors border ${
                      theme === "system" 
                        ? "bg-white text-black border-white" 
                        : "bg-transparent text-muted-foreground border-[#333] hover:text-white"
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

              {/* ════════════════════════════════════════════════════════════════════
                  1. INBOUND LEAD INGESTION & PLATFORM CONNECTION HUB (CORE WORKFLOW)
                  ════════════════════════════════════════════════════════════════════ */}
              <div className="border-2 border-primary/30 rounded-2xl bg-[#0a0b10] p-5 sm:p-6 space-y-5 shadow-xl relative overflow-hidden">
                {/* Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-inner">
                      <Zap className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">Inbound Lead Connection Hub</h3>
                        <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                          Auto Ingest
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Route leads from your website forms, Meta Lead Ads, Houzz/Zillow emails, or Zapier directly into your pipeline.
                      </p>
                    </div>
                  </div>

                  {/* Test Ping Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSendTestLead}
                      disabled={isTestingInbound}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-black hover:bg-primary/90 text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                      title="Send a sample high-ticket lead to test your pipeline"
                    >
                      {isTestingInbound ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>Ingesting Test Lead...</span>
                        </>
                      ) : (
                        <>
                          <Send className="size-3.5" />
                          <span>Send Test Inbound Lead</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

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

                {/* Master Webhook URL Box */}
                <div className="p-4 rounded-xl bg-[#06070a] border border-border/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10.5px] font-mono text-muted-foreground uppercase font-semibold tracking-wider flex items-center gap-1.5">
                      <Globe className="size-3.5 text-primary" />
                      <span>Your Unique Inbound Webhook URL (POST)</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <Check className="size-3" /> Ready for POST requests
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-secondary/30 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground select-all overflow-x-auto whitespace-nowrap">
                      {inboundWebhookUrl}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(inboundWebhookUrl, "webhook_url")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-colors shrink-0 cursor-pointer"
                    >
                      {copiedKey === "webhook_url" ? (
                        <>
                          <Check className="size-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" />
                          <span>Copy URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Platform Tabs Selector */}
                <div className="space-y-3 pt-1">
                  <label className="block text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Select Your Platform For Exact Step-by-Step Instructions:
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "wordpress", label: "WordPress / Elementor / WPForms", icon: "🌐" },
                      { id: "meta", label: "Meta (FB & IG) Lead Ads", icon: "📱" },
                      { id: "webflow", label: "Webflow, Wix & Squarespace", icon: "🎨" },
                      { id: "email_forward", label: "Houzz & Zillow Email Routing", icon: "📨" },
                      { id: "zapier", label: "Zapier & Make.com", icon: "⚡" },
                      { id: "embed", label: "1-Line HTML / Embed Code", icon: "💻" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setInboundTab(tab.id as any)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                          inboundTab === tab.id
                            ? "bg-primary/15 border-primary/40 text-primary shadow-sm"
                            : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Platform-Specific Interactive Panels */}
                  <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/70 space-y-4 animate-in fade-in duration-150">
                    {/* 1. WORDPRESS & ELEMENTOR */}
                    {inboundTab === "wordpress" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>🌐 WordPress, Elementor Pro & WPForms Setup</span>
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground">Setup time: 2 mins</span>
                        </div>
                        <ol className="text-xs text-muted-foreground space-y-2.5 list-decimal pl-4 leading-relaxed font-sans">
                          <li>
                            In your WordPress Dashboard, open your contact/inquiry form (e.g. <strong>Elementor Form</strong> or <strong>WPForms Webhooks</strong>).
                          </li>
                          <li>
                            Under <strong>Actions After Submit</strong>, add <strong>Webhook</strong>.
                          </li>
                          <li>
                            Paste your Webhook URL into the <strong>Webhook URL</strong> field:
                            <code className="block mt-1 p-2 rounded bg-[#07080a] border border-border text-[11px] font-mono text-foreground break-all select-all">
                              {inboundWebhookUrl}
                            </code>
                          </li>
                          <li>
                            Set Method to <strong>POST</strong>. WeaverFrame will automatically read standard fields: <code className="text-primary font-mono font-semibold">name</code>, <code className="text-primary font-mono font-semibold">email</code>, <code className="text-primary font-mono font-semibold">phone</code>, <code className="text-primary font-mono font-semibold">estimatedBudget</code>, <code className="text-primary font-mono font-semibold">county</code>, and <code className="text-primary font-mono font-semibold">message</code>.
                          </li>
                        </ol>
                      </div>
                    )}

                    {/* 2. META LEAD ADS */}
                    {inboundTab === "meta" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>📱 Facebook & Instagram Lead Generation Ads</span>
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground">Instant 3s Lead Delivery</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Connect your Meta Ads directly via Zapier or Make.com so that every buyer form submission on Instagram or Facebook instantly enters your WeaverFrame pipeline:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
                            <span className="text-[10px] font-mono uppercase text-primary font-bold">Step 1: Zapier Trigger</span>
                            <p className="text-muted-foreground text-[11px]">App: <strong>Facebook Lead Ads</strong><br />Event: <strong>New Lead</strong></p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/30 border border-border space-y-1">
                            <span className="text-[10px] font-mono uppercase text-primary font-bold">Step 2: Zapier Action</span>
                            <p className="text-muted-foreground text-[11px]">App: <strong>Webhooks by Zapier</strong><br />Action: <strong>POST</strong> to your Webhook URL</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. WEBFLOW, WIX & SQUARESPACE */}
                    {inboundTab === "webflow" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>🎨 Webflow, Wix & Squarespace Custom Forms</span>
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground">No Plugins Required</span>
                        </div>
                        <ol className="text-xs text-muted-foreground space-y-2.5 list-decimal pl-4 leading-relaxed font-sans">
                          <li>
                            In <strong>Webflow</strong>, select your Form block $\rightarrow$ Open Form Settings $\rightarrow$ Set <strong>Action</strong> to your Webhook URL and <strong>Method</strong> to <code className="font-mono text-foreground font-semibold">POST</code>.
                          </li>
                          <li>
                            In <strong>Wix</strong> or <strong>Squarespace</strong>, use Wix Automations / Zapier Trigger to send form submissions directly to your WeaverFrame Webhook URL.
                          </li>
                          <li>
                            When a client submits their budget and lot details, WeaverFrame ingests the lead and prepares the AI qualification reply within 60 seconds.
                          </li>
                        </ol>
                      </div>
                    )}

                    {/* 4. HOUZZ & ZILLOW EMAIL ROUTING */}
                    {inboundTab === "email_forward" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>📨 Houzz, Zillow & Real Estate Directory Email Routing</span>
                          </h4>
                          <span className="text-[10px] font-mono text-emerald-400 font-semibold">AI Automated Parser</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Real estate directories like Houzz and Zillow send new lead notifications to your email inbox. Forward them to your dedicated WeaverFrame Inbound routing address:
                        </p>
                        <div className="p-3.5 rounded-xl bg-[#06070a] border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="min-w-0">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">Your Inbound Routing Email:</span>
                            <div className="text-xs font-mono font-bold text-foreground truncate mt-0.5">{inboundEmailAddress}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(inboundEmailAddress, "inbound_email")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-colors shrink-0 cursor-pointer"
                          >
                            {copiedKey === "inbound_email" ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                            <span>{copiedKey === "inbound_email" ? "Copied!" : "Copy Email"}</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          💡 <strong>Pro Tip:</strong> Create an automatic forward rule in Gmail or Outlook for messages containing <em>"leads@houzz.com"</em> or <em>"leads@zillow.com"</em> to auto-forward to this address.
                        </p>
                      </div>
                    )}

                    {/* 5. ZAPIER & MAKE.COM */}
                    {inboundTab === "zapier" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>⚡ Universal Zapier & Make.com Ingestion</span>
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground">Any CRM / App</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Connect any third-party app (Typeform, Google Sheets, HubSpot, Jotform, Calendly) in Zapier by sending a <code className="font-mono text-foreground font-semibold">POST</code> webhook to your WeaverFrame URL.
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono text-muted-foreground">Sample JSON Payload:</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(JSON.stringify({
                                token: builderToken,
                                name: "Harrison Vance",
                                email: "harrison.vance@example.com",
                                phone: "+1 (512) 555-0199",
                                county: "Travis County",
                                state: "TX",
                                estimatedBudget: 1800000,
                                source: "Zapier Inbound",
                                message: "Looking for a 4,500 sqft modern architectural estate."
                              }, null, 2), "sample_json")}
                              className="text-primary hover:underline flex items-center gap-1 font-mono text-[10px] cursor-pointer"
                            >
                              {copiedKey === "sample_json" ? "Copied JSON!" : "Copy Sample JSON"}
                            </button>
                          </div>
                          <pre className="p-3 rounded-lg bg-[#06070a] border border-border text-[11px] font-mono text-foreground/90 overflow-x-auto">
{`{
  "token": "${builderToken}",
  "name": "Harrison Vance",
  "email": "harrison.vance@example.com",
  "phone": "+1 (512) 555-0199",
  "county": "Travis County",
  "state": "TX",
  "estimatedBudget": 1800000,
  "source": "Zapier Inbound",
  "message": "Looking for a 4,500 sqft modern estate."
}`}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* 6. HTML / EMBED CODE */}
                    {inboundTab === "embed" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                          <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                            <span>💻 1-Line HTML Form / Embed Snippet</span>
                          </h4>
                          <span className="text-[10px] font-mono text-muted-foreground">Raw HTML / React</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Copy and paste this standard HTML consultation form into any custom website page:
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
  <input type="text" name="county" placeholder="County / Location (e.g. Travis County)" />
  <textarea name="message" placeholder="Describe your dream home vision..."></textarea>
  <button type="submit">Request Architectural Consultation</button>
</form>`, "html_form")}
                              className="text-primary hover:underline flex items-center gap-1 font-mono text-[10px] cursor-pointer"
                            >
                              {copiedKey === "html_form" ? "Copied HTML!" : "Copy HTML Snippet"}
                            </button>
                          </div>
                          <pre className="p-3 rounded-lg bg-[#06070a] border border-border text-[11px] font-mono text-foreground/90 overflow-x-auto">
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
                </div>
              </div>

              {/* ════════════════════════════════════════════════════════════════════
                  2. COMPANY EMAIL & MAILBOX GATEWAY + CRM INTEGRATIONS
                  ════════════════════════════════════════════════════════════════════ */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Outbound Email Mailbox & Third-Party Sync
                </h4>

                {/* ── EMAIL & MAILBOX CONNECTION (PRIMARY AI MAIL GATEWAY) ── */}
                <div className="border border-border rounded-lg bg-secondary/10 overflow-hidden transition-all duration-150">
                  <div className="flex items-center justify-between p-4 bg-secondary/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-md bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-foreground text-xs font-mono font-bold shrink-0">
                        <Mail className="size-4 text-[#c9a84c] dark:text-[#e5d9c5]" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          Company Email & Mailbox Gateway
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
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
                      {/* Mail Provider Dropdown */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                          Mail Service Provider
                        </label>
                        <CustomSelect
                          value={emailProvider}
                          onChange={(val) => setEmailProvider(val as any)}
                          options={[
                            { value: "google", label: "Google Workspace / Gmail (@yourcompany.com)" },
                            { value: "microsoft", label: "Microsoft 365 / Outlook (@yourcompany.com)" },
                            { value: "custom_smtp", label: "Custom SMTP / IMAP Server (Private Host)" },
                          ]}
                        />
                      </div>

                      {/* Form Fields Grid */}
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
                            placeholder="e.g. alex@luxuryhomes.com"
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

                      {/* Test Success Feedback */}
                      {emailTestSuccess && (
                        <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-mono flex items-center gap-2 animate-in fade-in duration-150">
                          <CheckCircle2 className="size-4 shrink-0" />
                          <span>{emailTestSuccess}</span>
                        </div>
                      )}

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

                          {isEmailConnected && (
                            <button
                              type="button"
                              onClick={handleDisconnectEmail}
                              disabled={isSaving.email_mailbox}
                              className="px-3 py-1.5 border border-danger/20 hover:bg-danger/10 text-danger rounded text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              Disconnect
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleSaveEmail}
                            disabled={isSaving.email_mailbox || !emailAddress.trim()}
                            className="px-4 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/95 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
                                   onClick={() => handleDisconnect(i.id)}
                                   disabled={isSaving[i.id]}
                                   className="px-3 py-1.5 border border-danger/20 hover:bg-danger/10 text-danger rounded text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1"
                                 >
                                   {isSaving[i.id] && <Loader2 className="size-3 animate-spin" />}
                                   Disconnect
                                 </button>
                               )}
                               <button
                                 type="button"
                                 onClick={() => handleConnect(i.id)}
                                 disabled={isSaving[i.id]}
                                 className="px-4 py-1.5 bg-primary text-black rounded text-xs font-semibold hover:bg-primary/95 transition-colors disabled:opacity-50 flex items-center gap-1.5"
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
              
              <div className="pt-4 space-y-2">
                <Row label="Custom Outbound Webhook URL">
                  <Input
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    placeholder="https://your-crm.com/api/leads-webhook"
                  />
                </Row>
                <p className="text-[10px] text-muted-foreground">
                  Sends raw webhook payload of newly captured and qualified builder leads to external endpoints.
                </p>
                <Save onClick={handleSaveWebhook} isSaving={isSavingWebhook} saved={webhookSaved} />
              </div>
            </div>
          )}

          {active === "Billing" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Subscription & Billing</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage your organization's subscription tier, billing cycle, and Stripe payments.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={handleOpenPortal}
                    disabled={isOpeningPortal}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
                    title="Manage credit cards and receipts in Stripe"
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
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    ACTIVE
                  </span>
                </div>
              </div>

              {/* Interactive Subscription Plan Cards */}
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
                        "Instant SMS/Email builder notifications",
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
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-mono font-semibold mb-2.5">
                  Invoice & Billing History
                </div>
                <table className="w-full text-sm border border-border rounded-xl overflow-hidden bg-card">
                  <thead className="bg-secondary/50 text-[10.5px] font-mono text-muted-foreground uppercase tracking-wider">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 font-medium">Date</th>
                      <th className="px-4 py-2.5 font-medium">Amount</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ["May 1, 2026", currentPlan.price, "Paid"],
                      ["Apr 1, 2026", currentPlan.price, "Paid"],
                      ["Mar 1, 2026", currentPlan.price, "Paid"]
                    ].map(([d, a, s]) => (
                      <tr key={d} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 text-foreground text-xs">{d}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground text-xs font-bold">{a}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{s}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => downloadInvoicePDF(d, a, s)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-mono font-semibold cursor-pointer"
                          >
                            <Download className="size-3" /> Download Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
