import { RoutePending } from "@/components/dashboard/RoutePending";
import { createFileRoute, useLoaderData, useRouter, useRouteContext } from "@tanstack/react-router";
import { useState, useEffect, useRef, useMemo } from "react";
import { obscurePII } from "@/lib/utils";
import { Shell } from "@/components/dashboard/Shell";
import { Card, CardHeader, Badge } from "@/components/dashboard/primitives";
import { 
  getAppointmentsData, 
  getLeadsData, 
  bookAppointment, 
  rescheduleAppointment, 
  cancelAppointment 
} from "@/lib/dashboard";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  MapPin, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Check, 
  FileText,
  AlertCircle
} from "lucide-react";
import { getCleanLeadName } from "./ai-activity";

// Dynamic US Holidays / Festivals list
const getUSHoliday = (date: Date) => {
  const y = date.getFullYear();
  const m = date.getMonth(); // 0-indexed
  const d = date.getDate();
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Fixed date holidays
  if (m === 0 && d === 1) return "New Year's Day";
  if (m === 5 && d === 19) return "Juneteenth";
  if (m === 6 && d === 4) return "4th of July";
  if (m === 9 && d === 31) return "Halloween";
  if (m === 10 && d === 11) return "Veterans Day";
  if (m === 11 && d === 24) return "Christmas Eve";
  if (m === 11 && d === 25) return "Christmas Day";
  if (m === 11 && d === 31) return "New Year's Eve";

  // Dynamic date holidays calculations
  // Third Monday of January: MLK Day
  if (m === 0 && dayOfWeek === 1 && d > 14 && d <= 21) return "MLK Day";
  
  // Third Monday of February: Presidents' Day
  if (m === 1 && dayOfWeek === 1 && d > 14 && d <= 21) return "Presidents' Day";
  
  // Easter Sunday using Meeus's Gregorian algorithm to support all navigated years dynamically
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d_val = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d_val - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m_val = Math.floor((a + 11 * h + 22 * l) / 451);
  const easterMonth = Math.floor((h + l - 7 * m_val + 114) / 31) - 1; // 0-indexed: 2 = March, 3 = April
  const easterDay = ((h + l - 7 * m_val + 114) % 31) + 1;
  if (m === easterMonth && d === easterDay) return "Easter Sunday";
  
  // Mother's Day: Second Sunday of May
  if (m === 4 && dayOfWeek === 0 && d > 7 && d <= 14) return "Mother's Day";

  // Memorial Day: Last Monday of May
  if (m === 4 && dayOfWeek === 1 && d > 24) return "Memorial Day";

  // Father's Day: Third Sunday of June
  if (m === 5 && dayOfWeek === 0 && d > 14 && d <= 21) return "Father's Day";

  // Labor Day: First Monday of September
  if (m === 8 && dayOfWeek === 1 && d <= 7) return "Labor Day";

  // Columbus Day: Second Monday of October
  if (m === 9 && dayOfWeek === 1 && d > 7 && d <= 14) return "Columbus Day";

  // Thanksgiving: Fourth Thursday of November
  if (m === 10 && dayOfWeek === 4 && d > 21 && d <= 28) return "Thanksgiving";

  // Day after Thanksgiving: Black Friday
  if (m === 10 && dayOfWeek === 5 && d > 22 && d <= 29) return "Black Friday";

  return null;
};

export const Route = createFileRoute("/appointments")({
  loader: ({ context }) => {
    if (typeof window === 'undefined' && !context.session) {
      return { appts: [], leads: [] };
    }
    const activeRole = typeof window !== 'undefined' ? (sessionStorage.getItem('active_role') ?? undefined) : undefined;
    return Promise.all([
      getAppointmentsData({ data: { activeRole } }),
      getLeadsData({ data: { activeRole } })
    ]).then(([appts, leads]) => ({ appts, leads }));
  },
  staleTime: 60_000, // 60s — fresh data, instant revisits within a minute
  head: () => ({ 
    meta: [
      { title: "Appointments — WeaverFrame" }, 
      { name: "description", content: "Calendar and management of lead appointments." }
    ] 
  }),
  pendingMs: 0,
  pendingComponent: () => <RoutePending title="Loading Appointments..." type="appointments" />,
  component: ApptPage,
});

function ApptPage() {
  const { session } = useRouteContext({ strict: false }) as any;
  const isPrivacyMode = session?.role === 'admin' && !!session?.actingAsBuilderId;

  const router = useRouter();
  const { appts: initialAppts, leads } = useLoaderData({ from: "/appointments" }) as { appts: any[]; leads: any[] };

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [appointmentsList, setAppointmentsList] = useState<any[]>(initialAppts);
  const [currentDate, setCurrentDate] = useState(() => new Date()); // Defaults to today
  const [todayDate, setTodayDate] = useState<Date | null>(null);

  useEffect(() => {
    const today = new Date();
    setTodayDate(today);
    setCurrentDate(today);
  }, []);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | "up" | "down" | "">("");
  const [animateKey, setAnimateKey] = useState(0);
  const [yearPageAnchor, setYearPageAnchor] = useState(() => new Date().getFullYear());
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  
  // Arrow navigation indices
  const [activeLeadIndex, setActiveLeadIndex] = useState(0);
  const [activeTypeIndex, setActiveTypeIndex] = useState(0);
  const [datePickerSection, setDatePickerSection] = useState<"years" | "months">("years");
  const [activeYearIndex, setActiveYearIndex] = useState(4); // 2026 is index 4 in [yearPageAnchor - 4 + i]
  const [activeMonthIndex, setActiveMonthIndex] = useState(4); // May is index 4
  
  const typeOptions = [
    { label: "Phone call", value: "Phone call" },
    { label: "Site visit", value: "Site visit" },
    { label: "Follow-up", value: "Follow-up" },
    { label: "Custom (Write your own)", value: "Custom" }
  ];
  
  // Quick book form states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [apptType, setApptType] = useState("Site visit");
  const [customApptType, setCustomApptType] = useState("");
  const [apptDateTime, setApptDateTime] = useState("");
  const [apptLocation, setApptLocation] = useState("Lakeway Model Home");
  const [apptNotes, setApptNotes] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Reschedule & Detail Modals
  const [selectedApptDetails, setSelectedApptDetails] = useState<any | null>(null);
  const [rescheduleApptId, setRescheduleApptId] = useState<string | null>(null);
  const [newDateTime, setNewDateTime] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Sync state with loader data changes
  useEffect(() => {
    setAppointmentsList(initialAppts);
  }, [initialAppts]);

  useEffect(() => {
    setYearPageAnchor(currentDate.getFullYear());
  }, [currentDate]);

  useEffect(() => {
    setActiveLeadIndex(0);
  }, [searchQuery]);

  const changeMonth = (targetDate: Date, directionOverride?: "left" | "right" | "up" | "down") => {
    let direction: "left" | "right" | "up" | "down" = "left";
    if (directionOverride) {
      direction = directionOverride;
    } else {
      direction = targetDate.getTime() > currentDate.getTime() ? "left" : "right";
    }
    setSlideDirection(direction);
    setAnimateKey(prev => prev + 1);
    setCurrentDate(targetDate);
  };

  // Refs for event listeners to avoid re-binding closures during transition state updates
  const currentDateRef = useRef(currentDate);
  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  const changeMonthRef = useRef(changeMonth);
  useEffect(() => {
    changeMonthRef.current = changeMonth;
  }, [changeMonth]);

  // Unified Swipe Tracking (Touch on mobile, Wheel/Two-finger swipe on touchpad)
  const swipeStartX = useRef<number | null>(null);
  const swipeStartY = useRef<number | null>(null);
  const swipeCurrentX = useRef<number | null>(null);
  const swipeCurrentY = useRef<number | null>(null);
  const minSwipeDistance = 50;
  const hasDragged = useRef(false);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const isSwipingRef = useRef(false);
  const lastWheelTime = useRef(0);

  const handleSwipeStart = (clientX: number, clientY: number) => {
    swipeStartX.current = clientX;
    swipeStartY.current = clientY;
    swipeCurrentX.current = clientX;
    swipeCurrentY.current = clientY;
    isSwipingRef.current = true;
  };

  const handleSwipeMove = (clientX: number, clientY: number) => {
    if (swipeStartX.current === null || swipeStartY.current === null) return;
    swipeCurrentX.current = clientX;
    swipeCurrentY.current = clientY;
  };

  const handleSwipeEnd = () => {
    if (!isSwipingRef.current) return;
    
    const curDate = currentDateRef.current;
    if (
      swipeStartX.current !== null && 
      swipeStartY.current !== null && 
      swipeCurrentX.current !== null && 
      swipeCurrentY.current !== null
    ) {
      const diffX = swipeStartX.current - swipeCurrentX.current;
      const diffY = swipeStartY.current - swipeCurrentY.current;
      
      if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > minSwipeDistance) {
        if (diffY > 0) {
          const nextMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 1);
          changeMonthRef.current(nextMonthDate, "up");
        } else {
          const prevMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() - 1, 1);
          changeMonthRef.current(prevMonthDate, "down");
        }
      } else if (Math.abs(diffX) > minSwipeDistance) {
        if (diffX > 0) {
          const nextMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 1);
          changeMonthRef.current(nextMonthDate, "left");
        } else {
          const prevMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() - 1, 1);
          changeMonthRef.current(prevMonthDate, "right");
        }
      }
    }
    
    // Reset
    swipeStartX.current = null;
    swipeStartY.current = null;
    swipeCurrentX.current = null;
    swipeCurrentY.current = null;
    isSwipingRef.current = false;
  };

  const handleSwipeEndRef = useRef(handleSwipeEnd);
  useEffect(() => {
    handleSwipeEndRef.current = handleSwipeEnd;
  }, [handleSwipeEnd]);

  useEffect(() => {
    const el = calendarContainerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('select') || target.closest('input') || target.closest('a')) {
        return;
      }
      hasDragged.current = false;
      const touch = e.touches[0];
      handleSwipeStart(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (swipeStartX.current === null || swipeStartY.current === null) return;
      const touch = e.touches[0];
      const diffX = swipeStartX.current - touch.clientX;
      const diffY = swipeStartY.current - touch.clientY;
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        hasDragged.current = true;
        if (e.cancelable) {
          e.preventDefault();
        }
      }
      handleSwipeMove(touch.clientX, touch.clientY);
    };

    const onTouchEnd = () => {
      handleSwipeEndRef.current();
    };

    const onTouchCancel = () => {
      swipeStartX.current = null;
      swipeStartY.current = null;
      swipeCurrentX.current = null;
      swipeCurrentY.current = null;
      isSwipingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      // Unconditionally prevent default scroll to lock gestures and avoid trackpad page scroll/history back-forward navigation
      e.preventDefault();
      
      const threshold = 10; // slightly lower threshold for quick touchpad response
      if (Math.abs(e.deltaX) > threshold || Math.abs(e.deltaY) > threshold) {
        const now = Date.now();
        if (now - lastWheelTime.current < 600) return; // 600ms cooldown to block scroll inertia month skip loops
        lastWheelTime.current = now;

        const curDate = currentDateRef.current;
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          if (e.deltaY > 0) {
            const nextMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 1);
            changeMonthRef.current(nextMonthDate, "up");
          } else {
            const prevMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() - 1, 1);
            changeMonthRef.current(prevMonthDate, "down");
          }
        } else {
          if (e.deltaX > 0) {
            const nextMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 1);
            changeMonthRef.current(nextMonthDate, "left");
          } else {
            const prevMonthDate = new Date(curDate.getFullYear(), curDate.getMonth() - 1, 1);
            changeMonthRef.current(prevMonthDate, "right");
          }
        }
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      let closedAny = false;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
        closedAny = true;
      }
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
        closedAny = true;
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setIsTypeDropdownOpen(false);
        closedAny = true;
      }
      if (closedAny && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDatePickerOpen(false);
        setIsTypeDropdownOpen(false);
        setIsDropdownOpen(false);
        setSelectedApptDetails(null);
        setRescheduleApptId(null);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filteredLeads = leads.filter(l => {
    const name = (isPrivacyMode ? obscurePII(getCleanLeadName(l), 'name') : getCleanLeadName(l)).toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || (l.county && l.county.toLowerCase().includes(query));
  });

  const handleSelectLead = (lead: any) => {
    setSelectedLeadId(lead.id);
    setSearchQuery(isPrivacyMode ? obscurePII(getCleanLeadName(lead), 'name') : getCleanLeadName(lead));
    setIsDropdownOpen(false);
  };

  // Booking submit handler
  const handleBookAppointment = async () => {
    if (!selectedLeadId) {
      setErrorMsg("Please select a lead first.");
      return;
    }
    if (!apptDateTime) {
      setErrorMsg("Please select a date & time.");
      return;
    }
    const finalType = apptType === "Custom" ? (customApptType.trim() || "Custom Meeting") : apptType;

    setErrorMsg("");
    setSuccessMsg("");
    setIsBooking(true);

    try {
      const newAppt = await bookAppointment({
        data: {
          leadId: selectedLeadId,
          type: finalType,
          dateTime: apptDateTime,
          location: apptLocation,
          notes: apptNotes,
          sendSms
        }
      });

      // Reset form
      setSelectedLeadId("");
      setSearchQuery("");
      setApptNotes("");
      setCustomApptType("");
      setSuccessMsg("Appointment successfully booked!");
      
      // Refresh router state to fetch fresh DB values
      await router.invalidate();
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to book appointment. Please try again.");
    } finally {
      setIsBooking(false);
    }
  };

  // Cancellation handler
  const handleCancelAppointment = async (id: string) => {
    if (!confirm("Are you sure you want to cancel and remove this appointment?")) return;
    try {
      await cancelAppointment({ data: id });
      setSelectedApptDetails(null);
      await router.invalidate();
    } catch (err) {
      console.error(err);
      alert("Failed to cancel appointment.");
    }
  };

  // Reschedule save handler
  const handleSaveReschedule = async () => {
    if (!rescheduleApptId || !newDateTime) return;
    setIsRescheduling(true);
    try {
      await rescheduleAppointment({
        data: {
          id: rescheduleApptId,
          dateTime: newDateTime
        }
      });
      setRescheduleApptId(null);
      setSelectedApptDetails(null);
      await router.invalidate();
    } catch (err) {
      console.error(err);
      alert("Failed to reschedule appointment.");
    } finally {
      setIsRescheduling(false);
    }
  };

  // Calendar generation helpers
  const handlePrevMonth = () => {
    const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    changeMonth(prevMonthDate);
  };

  const handleNextMonth = () => {
    const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    changeMonth(nextMonthDate);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    const days: Array<{ day: number | null; date: Date | null }> = [];
    // Add padding days for previous month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, date: null });
    }
    // Add days of current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({ day: i, date: new Date(year, month, i) });
    }
    return days;
  };

  const calendarDays = getDaysInMonth(currentDate);

  // Pre-grouped lookup map for O(1) cell access
  const appointmentsByDateMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    appointmentsList.forEach(a => {
      if (!a.dateTime) return;
      const d = new Date(a.dateTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [appointmentsList]);

  // Group events by day string (YYYY-MM-DD) - O(1) lookup
  const getApptsForDate = (dateObj: Date | null) => {
    if (!dateObj) return [];
    const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    return appointmentsByDateMap[key] || [];
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <Shell title="Appointments">
      <div className="flex items-center justify-between mb-2">
        <div className="inline-flex bg-[#161618] border border-white/10 rounded-md p-0.5">
          {(["calendar", "list"] as const).map((v) => (
            <button 
              key={v} 
              onClick={() => setView(v)} 
              className={`px-3 py-1 text-xs font-semibold rounded transition-all duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 ${
                view === v ? "bg-white text-black shadow-md" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "calendar" ? "Calendar" : "List View"}
            </button>
          ))}
        </div>

        {view === "calendar" && (
          <div className="relative" ref={datePickerRef}>
            <button 
              onClick={() => {
                setIsDatePickerOpen(!isDatePickerOpen);
                setDatePickerSection("years");
                const curYear = currentDate.getFullYear();
                const yearPageIdx = Array.from({ length: 12 }, (_, i) => yearPageAnchor - 4 + i).indexOf(curYear);
                setActiveYearIndex(yearPageIdx >= 0 ? yearPageIdx : 4);
                setActiveMonthIndex(currentDate.getMonth());
              }}
              onKeyDown={(e) => {
                if (!isDatePickerOpen) {
                  if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setIsDatePickerOpen(true);
                    setDatePickerSection("years");
                    const curYear = currentDate.getFullYear();
                    const yearPageIdx = Array.from({ length: 12 }, (_, i) => yearPageAnchor - 4 + i).indexOf(curYear);
                    setActiveYearIndex(yearPageIdx >= 0 ? yearPageIdx : 4);
                    setActiveMonthIndex(currentDate.getMonth());
                  }
                  return;
                }

                if (datePickerSection === "years") {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    setDatePickerSection("months");
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    setActiveYearIndex((prev) => (prev + 1) % 12);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    setActiveYearIndex((prev) => (prev - 1 + 12) % 12);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveYearIndex((prev) => (prev + 4) % 12);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveYearIndex((prev) => (prev - 4 + 12) % 12);
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const selectedYear = yearPageAnchor - 4 + activeYearIndex;
                    const newDate = new Date(selectedYear, currentDate.getMonth(), 1);
                    changeMonth(newDate);
                    setDatePickerSection("months");
                  }
                } else {
                  if (e.key === "Tab") {
                    e.preventDefault();
                    setDatePickerSection("years");
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    setActiveMonthIndex((prev) => (prev + 1) % 12);
                  } else if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    setActiveMonthIndex((prev) => (prev - 1 + 12) % 12);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveMonthIndex((prev) => (prev + 3) % 12);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveMonthIndex((prev) => (prev - 3 + 12) % 12);
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const newDate = new Date(currentDate.getFullYear(), activeMonthIndex, 1);
                    changeMonth(newDate);
                    setIsDatePickerOpen(false);
                  }
                }
              }}
              className="flex items-center gap-1.5 text-xs text-foreground bg-secondary/80 border border-border/80 rounded-md px-3 py-1.5 hover:border-white/30 hover:bg-secondary transition-all duration-150 cursor-pointer select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
            >
              <CalendarIcon className="size-3.5 text-foreground/75" />
              <span className="font-medium text-foreground">
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <ChevronDown className="size-3 text-foreground/60" />
            </button>

            {isDatePickerOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-lg bg-card border border-border p-3 shadow-none z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="text-[10px] font-semibold text-foreground/50 uppercase tracking-widest px-3 py-2 border-b border-border/40 mb-2">Select Month & Year</div>
                
                {/* Decade Year Pagination Header */}
                <div className="flex items-center justify-between mb-2 px-1">
                  <button
                    type="button"
                    onClick={() => setYearPageAnchor(prev => prev - 12)}
                    className="p-1 hover:bg-white/5 rounded text-foreground/60 hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-foreground/80 tracking-wide select-none">
                    {yearPageAnchor - 4} - {yearPageAnchor + 7}
                  </span>
                  <button
                    type="button"
                    onClick={() => setYearPageAnchor(prev => prev + 12)}
                    className="p-1 hover:bg-white/5 rounded text-foreground/60 hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>

                {/* Year Selection (Dynamic 12-Year Grid) */}
                <div className="grid grid-cols-4 gap-1 mb-3 pb-2 border-b border-border/40">
                  {Array.from({ length: 12 }, (_, i) => yearPageAnchor - 4 + i).map((y, idx) => {
                    const isActive = datePickerSection === "years" && activeYearIndex === idx;
                    return (
                      <button
                        key={y}
                        onClick={() => {
                          const newDate = new Date(y, currentDate.getMonth(), 1);
                          changeMonth(newDate);
                          setDatePickerSection("months");
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                        }}
                        className={`text-[10px] font-mono py-1 rounded transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 ${
                          currentDate.getFullYear() === y
                            ? "bg-white/[0.08] text-white font-bold border border-white/10"
                            : isActive
                              ? "bg-white/15 text-white ring-1 ring-white/30"
                              : "hover:bg-white/[0.08] text-foreground/80 hover:text-white"
                        }`}
                      >
                        {y}
                      </button>
                    );
                  })}
                </div>

                {/* Month Selection */}
                <div className="grid grid-cols-3 gap-1.5">
                  {months.map((m, idx) => {
                    const isActive = datePickerSection === "months" && activeMonthIndex === idx;
                    return (
                      <button
                        key={m}
                        onClick={() => {
                          const newDate = new Date(currentDate.getFullYear(), idx, 1);
                          changeMonth(newDate);
                          setIsDatePickerOpen(false);
                          if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                          }
                        }}
                        className={`text-[10px] py-1.5 rounded transition-colors text-center font-medium cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 ${
                          currentDate.getMonth() === idx
                            ? "bg-white/[0.08] text-white font-bold border border-white/10"
                            : isActive
                              ? "bg-white/15 text-white ring-1 ring-white/30"
                              : "hover:bg-white/[0.08] text-foreground/80 hover:text-white"
                        }`}
                      >
                        {m.substring(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Main interactive area: Calendar or List */}
        <div className="lg:col-span-3">
          {view === "calendar" ? (
            <Card className="p-3 overflow-hidden border-white/10 bg-[#09090b] relative animate-duration-300 select-none touch-none">
              <div
                ref={calendarContainerRef}
                onDragStart={(e) => e.preventDefault()}
                style={{ touchAction: "none" }}
                className="w-full h-full select-none relative"
              >
                <style>{`
                  @keyframes slideInLeft {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                  }
                  @keyframes slideInRight {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                  }
                  @keyframes slideInUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                  }
                  @keyframes slideInDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                  }
                  .animate-slide-left {
                    animation: slideInLeft 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  }
                  .animate-slide-right {
                    animation: slideInRight 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  }
                  .animate-slide-up {
                    animation: slideInUp 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  }
                  .animate-slide-down {
                    animation: slideInDown 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                  }
                `}</style>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="py-0.5">{d}</div>
                  ))}
                </div>
                <div 
                  key={animateKey}
                  style={{ touchAction: "none" }}
                  className={`grid grid-cols-7 gap-1 ${
                    slideDirection === "left" ? "animate-slide-left" : 
                    slideDirection === "right" ? "animate-slide-right" : 
                    slideDirection === "up" ? "animate-slide-up" : 
                    slideDirection === "down" ? "animate-slide-down" : ""
                  }`}
                >
                  {calendarDays.map((d, i) => {
                    const hasEvents = d.date ? getApptsForDate(d.date).length > 0 : false;
                    const dayEvents = d.date ? getApptsForDate(d.date) : [];
                    
                    // Highlights today's actual date dynamically, falls back to May 20, 2026 before mount
                    const refDate = todayDate || new Date("2026-05-20");
                    const isToday = d.date && 
                      d.date.getDate() === refDate.getDate() && 
                      d.date.getMonth() === refDate.getMonth() && 
                      d.date.getFullYear() === refDate.getFullYear();

                    // Get US Holiday / Festival
                    const holiday = d.date ? getUSHoliday(d.date) : null;

                    return (
                      <div 
                        key={i} 
                        style={{ touchAction: "none" }}
                        className={`min-h-[82px] border rounded-lg p-1.5 transition-all flex flex-col justify-between ${
                          !d.day 
                            ? "border-transparent bg-transparent opacity-20" 
                            : isToday
                            ? "border-emerald-500 bg-emerald-500/10"
                              : holiday
                                ? "border-rose-500/20 bg-rose-500/[0.02] hover:border-rose-500/30"
                                : hasEvents
                                  ? "border-white/15 bg-white/[0.02] hover:border-white/25"
                                  : "border-white/5 bg-white/[0.005] hover:border-white/10"
                        }`}
                      >
                        {d.day && (
                          <div className="flex items-start justify-between gap-1">
                            <span className={`text-[10px] font-mono font-bold ${
                              isToday ? "text-emerald-400 bg-emerald-500/20 px-1 py-0.5 rounded" : "text-muted-foreground"
                            }`}>
                              {d.day}
                            </span>
                            
                            {holiday ? (
                              <span 
                                className="text-[8px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 truncate max-w-[80px]" 
                                title={`Important US Day: ${holiday}`}
                              >
                                🎉 {holiday}
                              </span>
                            ) : dayEvents.length > 0 ? (
                              <span className="size-1.5 mt-1 rounded-full bg-emerald-500 animate-pulse" />
                            ) : null}
                          </div>
                        )}
                        
                        <div className="mt-1 space-y-0.5 overflow-y-auto max-h-[44px] custom-scrollbar">
                          {dayEvents.map((appt) => {
                            const timeStr = new Date(appt.dateTime).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                              hour12: true
                            });
                            
                            const style = 
                              appt.type === "Phone call" ? "bg-[#0A84FF]/10 border border-[#0A84FF]/30 text-[#4DA6FF] hover:bg-[#0A84FF]/20" :
                              appt.type === "Site visit" ? "bg-[#30D158]/10 border border-[#30D158]/30 text-[#30D158] hover:bg-[#30D158]/20" :
                              appt.type === "Follow-up" ? "bg-[#FF9F0A]/10 border border-[#FF9F0A]/30 text-[#FF9F0A] hover:bg-[#FF9F0A]/20" :
                              "bg-[#BF5AF2]/10 border border-[#BF5AF2]/30 text-[#BF5AF2] hover:bg-[#BF5AF2]/20"; // Purple/Pink for Custom

                            return (
                              <button
                                key={appt.id}
                                onClick={() => {
                                  if (hasDragged.current) return;
                                  setSelectedApptDetails(appt);
                                }}
                                className={`w-full text-left text-[9px] px-1.5 py-0.5 rounded truncate font-semibold transition-all select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 ${style}`}
                                title={`${isPrivacyMode ? obscurePII(getCleanLeadName(appt.lead), 'name') : getCleanLeadName(appt.lead)} (${timeStr})`}
                              >
                                <span className="font-mono opacity-80 mr-1">{timeStr.split(" ")[0]}</span>
                                {isPrivacyMode ? obscurePII(getCleanLeadName(appt.lead), 'name') : getCleanLeadName(appt.lead)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="border-white/10 bg-[#09090b]">
              <CardHeader 
                title="Active Appointments" 
                subtitle="Live status, scheduled time slots, and real-time activity tracking." 
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#161618] text-xs text-muted-foreground uppercase tracking-wider border-b border-white/10">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-semibold">Lead</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Date & Time</th>
                      <th className="px-4 py-3 font-semibold">Location</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {appointmentsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-xs">
                          <CalendarIcon className="size-6 mx-auto mb-2 opacity-30 text-white" />
                          No appointments found in the database.
                        </td>
                      </tr>
                    ) : (
                      appointmentsList.map((a) => {
                        const dateFormatted = new Date(a.dateTime).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true
                        });
                        
                        return (
                          <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground text-xs">
                              {isPrivacyMode ? obscurePII(getCleanLeadName(a.lead), 'name') : getCleanLeadName(a.lead)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                                a.type === "Phone call" ? "bg-[#0A84FF]/12 text-[#4DA6FF]" :
                                a.type === "Site visit" ? "bg-[#30D158]/12 text-[#30D158]" :
                                a.type === "Follow-up" ? "bg-[#FF9F0A]/12 text-[#FF9F0A]" :
                                "bg-[#BF5AF2]/12 text-[#BF5AF2]"
                              }`}>
                                {a.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                              {dateFormatted}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground text-xs">
                              {a.location}
                            </td>
                            <td className="px-4 py-3">
                              <Badge tone={a.status === "Confirmed" ? "success" : a.status === "Pending" ? "warm" : "neutral"}>
                                {a.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => {
                                  setSelectedApptDetails(a);
                                  setRescheduleApptId(a.id);
                                  setNewDateTime(a.dateTime.substring(0, 16));
                                }}
                                className="text-[11px] text-muted-foreground hover:text-white mr-3 transition-colors font-semibold focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                              >
                                Reschedule
                              </button>
                              <button 
                                onClick={() => handleCancelAppointment(a.id)}
                                className="text-[11px] text-red-500/70 hover:text-red-500 transition-colors font-semibold focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                              >
                                Cancel
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar: Quick Book Appointment */}
        <div className="lg:col-span-1">
          <Card className="p-4 border-white/10 bg-[#09090b] flex flex-col justify-between">
            <div>
              <h3 className="text-[11px] font-bold text-foreground mb-2.5 uppercase tracking-widest text-[#00a884] flex items-center gap-2">
                <Plus className="size-3.5" />
                Quick Book
              </h3>
              
              <div className="space-y-2.5">
                {/* Search & Select Lead Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Select Lead</label>
                  <div className="relative mt-0.5">
                    <input 
                      placeholder="Search name or county..." 
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedLeadId("");
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={(e) => {
                        if (!isDropdownOpen) {
                          if (e.key === "ArrowDown") {
                            setIsDropdownOpen(true);
                          }
                          return;
                        }
                        const itemsCount = filteredLeads.length;
                        if (itemsCount === 0) return;

                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setActiveLeadIndex((prev) => (prev + 1) % itemsCount);
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setActiveLeadIndex((prev) => (prev - 1 + itemsCount) % itemsCount);
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          if (filteredLeads[activeLeadIndex]) {
                            handleSelectLead(filteredLeads[activeLeadIndex]);
                          }
                        }
                      }}
                      className="w-full bg-[#161618] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 focus:border-white/20 transition-all text-white placeholder-white/30"
                    />
                    <Search className="absolute left-2.5 top-2 size-3.5 text-white/30" />
                    {selectedLeadId && (
                      <Check className="absolute right-2.5 top-2 size-3.5 text-emerald-500" />
                    )}
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-[#161618] border border-white/10 rounded-lg shadow-none max-h-44 overflow-y-auto custom-scrollbar">
                      {filteredLeads.length === 0 ? (
                        <div className="px-3 py-2 text-[11px] text-muted-foreground text-center">
                          No matching leads found
                        </div>
                      ) : (
                        filteredLeads.map((l, idx) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleSelectLead(l)}
                            className={`w-full text-left px-3 py-1.5 transition-colors border-b border-white/[0.02] last:border-b-0 flex items-center justify-between focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 ${
                              idx === activeLeadIndex ? "bg-white/10" : "hover:bg-white/5"
                            }`}
                          >
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-white">{isPrivacyMode ? obscurePII(getCleanLeadName(l), 'name') : getCleanLeadName(l)}</span>
                              <span className="text-[9px] text-muted-foreground">{l.county || "Travis County"}, {l.state || "TX"}</span>
                            </div>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${
                              l.scoreTier?.toLowerCase() === "hot" ? "bg-rose-500/10 text-rose-500" :
                              l.scoreTier?.toLowerCase() === "cold" ? "bg-blue-500/10 text-blue-500" :
                              "bg-amber-500/10 text-amber-500"
                            }`}>
                              {l.scoreTier || "Warm"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="relative" ref={typeDropdownRef}>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Type</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsTypeDropdownOpen(!isTypeDropdownOpen);
                      const curIdx = typeOptions.findIndex(o => o.value === apptType);
                      setActiveTypeIndex(curIdx >= 0 ? curIdx : 0);
                    }}
                    onKeyDown={(e) => {
                      if (!isTypeDropdownOpen) {
                        if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setIsTypeDropdownOpen(true);
                          const curIdx = typeOptions.findIndex(o => o.value === apptType);
                          setActiveTypeIndex(curIdx >= 0 ? curIdx : 0);
                        }
                        return;
                      }

                      const itemsCount = typeOptions.length;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveTypeIndex((prev) => (prev + 1) % itemsCount);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveTypeIndex((prev) => (prev - 1 + itemsCount) % itemsCount);
                      } else if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        const selectedOpt = typeOptions[activeTypeIndex];
                        setApptType(selectedOpt.value);
                        setIsTypeDropdownOpen(false);
                        if (selectedOpt.value === "Phone call") {
                          setApptLocation("Outgoing Call (AI booked)");
                        } else if (selectedOpt.value === "Site visit") {
                          setApptLocation("Lakeway Model Home");
                        } else if (selectedOpt.value === "Follow-up") {
                          setApptLocation("Office HQ");
                        } else {
                          setApptLocation("Lakeway Model Home");
                        }
                      }
                    }}
                    className="w-full mt-0.5 bg-[#161618] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-left text-white flex items-center justify-between hover:border-white/20 transition-all select-none focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                  >
                    <span>{apptType === "Custom" ? (customApptType.trim() ? `Custom: ${customApptType}` : "Custom (Write your own)") : apptType}</span>
                    <ChevronDown className="size-3.5 text-white/50" />
                  </button>

                  {isTypeDropdownOpen && (
                    <div className="absolute z-20 w-full mt-1 bg-[#161618] border border-white/10 rounded-lg shadow-none p-1 animate-in fade-in slide-in-from-top-1 duration-150">
                      {typeOptions.map((opt, idx) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setApptType(opt.value);
                            setIsTypeDropdownOpen(false);
                            if (document.activeElement instanceof HTMLElement) {
                              document.activeElement.blur();
                            }
                            if (opt.value === "Phone call") {
                              setApptLocation("Outgoing Call (AI booked)");
                            } else if (opt.value === "Site visit") {
                              setApptLocation("Lakeway Model Home");
                            } else if (opt.value === "Follow-up") {
                              setApptLocation("Office HQ");
                            } else {
                              setApptLocation("Lakeway Model Home");
                            }
                          }}
                          className={`w-full text-left text-xs px-2.5 py-1.5 rounded flex items-center justify-between transition-colors font-medium cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 ${
                            idx === activeTypeIndex ? "bg-white/10" : "hover:bg-white/[0.08]"
                          }`}
                        >
                          <span>{opt.label}</span>
                          {apptType === opt.value && <Check className="size-3.5 text-emerald-500" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {apptType === "Custom" && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Custom Type Name</label>
                    <input 
                      placeholder="e.g. Design Consult, Roof Inspection..." 
                      value={customApptType}
                      onChange={(e) => setCustomApptType(e.target.value)}
                      className="w-full mt-0.5 bg-[#161618] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all text-white placeholder-white/20" 
                    />
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Location</label>
                  <input 
                    value={apptLocation}
                    onChange={(e) => setApptLocation(e.target.value)}
                    className="w-full mt-0.5 bg-[#161618] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all text-white placeholder-white/20" 
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Date & Time</label>
                  <input 
                    type="datetime-local" 
                    value={apptDateTime}
                    onChange={(e) => setApptDateTime(e.target.value)}
                    className="w-full mt-0.5 bg-[#161618] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all text-white color-scheme-dark" 
                  />
                </div>

                <div>
                  <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider font-display">Notes (Optional)</label>
                  <textarea 
                    value={apptNotes}
                    onChange={(e) => setApptNotes(e.target.value)}
                    placeholder="Agenda / notes..."
                    rows={2}
                    className="w-full mt-0.5 bg-[#161618] border border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-white/20 focus:border-white/30 transition-all resize-none h-12 text-white placeholder-white/20" 
                  />
                </div>

                <label className="flex items-center justify-between text-[11px] py-0.5 select-none cursor-pointer">
                  <span className="text-muted-foreground font-semibold">Send Email confirmation</span>
                  <input 
                    type="checkbox" 
                    checked={sendSms}
                    onChange={(e) => setSendSms(e.target.checked)}
                    className="size-3.5 accent-emerald-500 cursor-pointer" 
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {errorMsg && (
                <div className="text-red-500 text-[10px] flex items-center gap-1 font-semibold bg-red-500/5 p-1.5 rounded-lg border border-red-500/20">
                  <AlertCircle className="size-3" />
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="text-emerald-500 text-[10px] flex items-center gap-1 font-semibold bg-emerald-500/5 p-1.5 rounded-lg border border-emerald-500/20">
                  <Check className="size-3" />
                  {successMsg}
                </div>
              )}
              
              <button 
                onClick={handleBookAppointment}
                disabled={isBooking}
                className="w-full bg-[#00a884] text-white hover:bg-[#008f70] disabled:bg-emerald-950/40 disabled:text-muted-foreground rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
              >
                {isBooking ? (
                  <>
                    <span className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Booking Slot...
                  </>
                ) : (
                  <>
                    <CalendarIcon className="size-3.5" />
                    Book Appointment
                  </>
                )}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* Appointment Detail & Actions Overlay Modal */}
      {selectedApptDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="relative w-full max-w-md bg-[#0e171c] border border-white/10 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
          >
            {/* Modal Header */}
            <div className="px-5 py-3 bg-[#162127] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-4.5 text-[#00a884]" />
                <h3 className="font-semibold text-sm text-white">Appointment Details</h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedApptDetails(null);
                  setRescheduleApptId(null);
                }}
                className="p-1 hover:bg-white/5 rounded text-white/50 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3.5">
              {rescheduleApptId ? (
                // Rescheduling View
                <div className="space-y-3.5">
                  <div className="text-center pb-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Rescheduling Appointment for</p>
                    <h4 className="text-base font-bold text-white mt-0.5">{isPrivacyMode ? obscurePII(getCleanLeadName(selectedApptDetails.lead), 'name') : getCleanLeadName(selectedApptDetails.lead)}</h4>
                  </div>
                  
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">New Date & Time</label>
                    <input 
                      type="datetime-local" 
                      value={newDateTime}
                      onChange={(e) => setNewDateTime(e.target.value)}
                      className="w-full mt-1 bg-[#161618] border border-white/10 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 focus:border-white/20 transition-all text-white color-scheme-dark" 
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setRescheduleApptId(null)}
                      className="flex-1 bg-white/5 text-white hover:bg-white/10 rounded-lg py-2 text-xs font-bold transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleSaveReschedule}
                      disabled={isRescheduling || !newDateTime}
                      className="flex-1 bg-[#00a884] text-white hover:bg-[#008f70] rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                    >
                      {isRescheduling ? (
                        <>
                          <span className="size-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save New Time"
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                // Standard details view
                <>
                  <div className="bg-[#162127]/40 p-3.5 rounded-lg border border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <div className="flex items-center gap-2 text-white">
                        <User className="size-3.5 text-[#00a884]" />
                        <span className="font-semibold text-xs">{isPrivacyMode ? obscurePII(getCleanLeadName(selectedApptDetails.lead), 'name') : getCleanLeadName(selectedApptDetails.lead)}</span>
                      </div>
                      <Badge tone={selectedApptDetails.status === "Confirmed" ? "success" : "warm"}>
                        {selectedApptDetails.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs pt-0.5">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Meeting Type</span>
                        <div className="font-semibold text-white flex items-center gap-1.5 text-xs">
                          {selectedApptDetails.type}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Date & Time</span>
                        <div className="font-mono text-white text-[11px] mt-0.5">
                          {new Date(selectedApptDetails.dateTime).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-0.5 pt-1.5">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="size-3" /> Location
                      </span>
                      <div className="text-white text-xs font-semibold">{selectedApptDetails.location}</div>
                    </div>
                  </div>

                  {selectedApptDetails.notes && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
                        <FileText className="size-3" /> Agenda / Notes
                      </span>
                      <p className="bg-[#161618] border border-white/5 rounded-lg p-2.5 text-xs text-muted-foreground leading-relaxed max-h-24 overflow-y-auto custom-scrollbar">
                        {selectedApptDetails.notes}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                    <button
                      onClick={() => {
                        setRescheduleApptId(selectedApptDetails.id);
                        setNewDateTime(selectedApptDetails.dateTime.substring(0, 16));
                      }}
                      className="flex-1 bg-white/5 text-white hover:bg-white/10 border border-white/10 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                    >
                      <Edit className="size-3.5" />
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleCancelAppointment(selectedApptDetails.id)}
                      className="flex-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-lg py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30"
                    >
                      <Trash2 className="size-3.5" />
                      Cancel Meeting
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}
