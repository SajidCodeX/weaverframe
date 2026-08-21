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
} from "@/lib/dashboard";
import { Loader2, Check, X, AlertCircle, Download, Mail, Sparkles, RefreshCw, Lock, ShieldCheck, CheckCircle2, Zap, Server, Globe } from "lucide-react";

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
    doc.text(`Platform Fees: WeaverFrame SaaS Professional Plan`, 20, 70);
    doc.text(`Payment Status: ${status} (Visa •••• 4242)`, 20, 80);
    doc.text(`Merchant: WeaverFrame Inc.`, 20, 90);

    doc.setLineWidth(0.5);
    doc.line(20, 100, 190, 100);

    doc.setFont("helvetica", "bold");
    doc.text("Description", 20, 110);
    doc.text("Total", 170, 110);
    
    doc.line(20, 115, 190, 115);

    doc.setFont("helvetica", "normal");
    doc.text("WeaverFrame AI Lead Conversion OS Platform License", 20, 125);
    // doc.text("- Travis County permit feed streaming & ingestion", 25, 135);
    doc.text("- 24/7 AI Lead Concierge & Automated Qualification", 25, 135);
    doc.text("- Live Multi-Channel Pipeline & WhatsApp/SMS Concierge", 25, 145);
    // doc.text("- Google Business reputation optimization", 25, 155);
    doc.text("$3,000.00", 170, 125);

    doc.line(20, 170, 190, 170);
    doc.setFont("helvetica", "bold");
    doc.text("Total Paid:", 20, 180);
    doc.text(amount, 170, 180);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Thank you for your business! If you have any questions, reach out to", 20, 210);
    doc.text("billing@buildersedge.com. Built by Google DeepMind team.", 20, 215);

    doc.save(`BE_Invoice_${date.replace(/\s+/g, '_').replace(/,/g, '')}.pdf`);
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
  const [webhookUrl, setWebhookUrl] = useState(loadedWebhookUrl || 'https://your-app.com/webhook/buildersedge');

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
    // },
    {
      id: "twilio",
      name: "Twilio SMS Outreach Gateway",
      desc: "Powers AI Concierge outreach SMS delivery. Syncs live client conversations directly inside our platform.",
      icon: "T",
      fields: [
        { key: "accountSid", label: "Twilio Account SID", type: "text", required: true, placeholder: "e.g. ACxxxxxxxxxxxxxxxxxxxxxxxx" },
        { key: "authToken", label: "Twilio Auth Token", type: "password", required: true, placeholder: "Enter Twilio Auth Token" },
        { key: "phoneNumber", label: "Twilio Phone Number", type: "text", required: true, placeholder: "e.g. +15128903498" }
      ]
    },
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
              <Row label={<>Company name <span className="text-danger">*</span></>}><Input value={profileForm.companyName} onChange={e => setProfileForm(p => ({ ...p, companyName: e.target.value }))} /></Row>
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
              <div className="text-xs uppercase tracking-wider text-muted-foreground pt-4">Channels</div>
              <div className="flex gap-2">
                {["SMS", "Email", "Both"].map((c) => (
                  <button
                    key={c}
                    onClick={() => setNotifForm(p => ({ ...p, channel: c }))}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                      notifForm.channel === c
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >{c}</button>
                ))}
              </div>
              <Toggle label="Quiet hours (10 PM – 7 AM)" checked={notifForm.quietHours} onChange={v => setNotifForm(p => ({ ...p, quietHours: v }))} />
              <Save onClick={handleSaveNotif} isSaving={isSavingNotif} saved={notifSaved} />
            </div>
          )}

          {active === "Integrations" && (
            <div className="space-y-4">
              <div>
                <H>Integrations & API Credentials</H>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect company mailboxes and third-party platforms with encrypted credentials to synchronize reviews, leads, and AI communication.
                </p>
              </div>

              {/* Integrations List */}
              <div className="space-y-3">
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
                               {i.id === "twilio" && "💬 Powers automated SMS dialogue with real builder phone number."}
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
                <Row label="Custom Webhook Trigger URL">
                  <Input
                    value={webhookUrl}
                    onChange={e => setWebhookUrl(e.target.value)}
                    placeholder="https://your-app.com/webhook/buildersedge"
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
            <div className="space-y-5 relative">
              <H>Billing</H>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Plan</div>
                  <div className="mt-1">
                    <CustomSelect 
                      value={billingPlan}
                      onChange={async (val) => {
                        setBillingPlan(val);
                        await updateBillingProfile({ data: { plan: val } as any });
                      }}
                      options={[
                        {label: "Starter ($1,500/mo)", value: "starter"},
                        {label: "Professional ($3,000/mo)", value: "professional"},
                        {label: "Enterprise ($5,000/mo)", value: "enterprise"}
                      ]}
                    />
                  </div>
                  <div className="font-mono text-xl text-foreground mt-3">
                    {billingPlan === "starter" ? "$1,500" : billingPlan === "enterprise" ? "$5,000" : "$3,000"}<span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Next billing</div>
                  <div className="text-foreground font-medium mt-1">Jun 1, 2026</div>
                  <div className="text-xs text-muted-foreground mt-2">Auto-renew on</div>
                </Card>
                {/* <Card className="p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Ad spend balance</div>
                  <div className="font-mono text-2xl text-foreground mt-1">${adSpendBalance}</div>
                  <button onClick={() => setIsAddFundsOpen(true)} className="text-xs text-primary mt-2 hover:underline cursor-pointer">Add funds</button>
                </Card> */}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Payment method</div>
                <div className="flex items-center justify-between p-4 border border-border rounded-md">
                  <span className="font-mono text-foreground">{paymentMethod}</span>
                  <button 
                    disabled
                    title="Coming soon — secure payment setup in progress" 
                    className="text-xs text-muted-foreground cursor-not-allowed opacity-50 flex items-center"
                  >
                    Add Payment Method
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Invoice history</div>
                <table className="w-full text-sm border border-border rounded-md overflow-hidden">
                  <thead className="bg-secondary/50 text-xs text-muted-foreground uppercase tracking-wider">
                    <tr className="text-left">
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                      <th className="px-4 py-2 font-medium">Status</th>
                      <th className="px-4 py-2 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[["May 1, 2026", "$3,000", "Paid"], ["Apr 1, 2026", "$3,000", "Paid"], ["Mar 1, 2026", "$3,000", "Paid"]].map(([d, a, s]) => (
                      <tr key={d} className="border-t border-border">
                        <td className="px-4 py-2 text-foreground">{d}</td>
                        <td className="px-4 py-2 font-mono text-foreground">{a}</td>
                        <td className="px-4 py-2">
                          <span className="text-xs px-2 py-0.5 rounded badge-success">{s}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => downloadInvoicePDF(d, a, s)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold cursor-pointer"
                          >
                            <Download className="size-3" /> Download Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ADD FUNDS MODAL */}
              {/* {isAddFundsOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-100">
                  <Card className="w-full max-w-md bg-[#0B0B0C] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                    ...
                  </Card>
                </div>
              )} */}

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
