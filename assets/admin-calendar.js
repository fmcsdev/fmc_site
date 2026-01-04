// assets/admin-calendar.js
// Calendar view: reservation_slots + teacher_availabilities

(function () {
  const calEl = document.getElementById("adminCalendar");
  if (!calEl || !window.FullCalendar || !window.supabase) return;

  const { createClient } = window.supabase;

  // Use SAME project as admin.js
  const SUPABASE_URL  = "https://dsbvgomhugvjruqykbmr.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I"; // same as admin.js

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, detectSessionInUrl: true }
  });

  // Colors
  const COLORS = {
    slot_active:  { bg: "#3b82f6", border: "#3b82f6", text: "#fff" }, // blue
    slot_closed:  { bg: "#9ca3af", border: "#9ca3af", text: "#fff" }, // gray
    avail_pending:{ bg: "#f59e0b", border: "#f59e0b", text: "#111827" }, // orange
    avail_approved:{ bg: "#22c55e", border: "#22c55e", text: "#0b1220" }, // green
    avail_rejected:{ bg: "#ef4444", border: "#ef4444", text: "#fff" } // red
  };

  function isMissingColumnError(err) {
    const msg = (err && (err.message || err.toString())) || "";
    return msg.includes('column "status" does not exist') || msg.includes("42703");
  }

  async function fetchSlotsSafe() {
    // Try with status first
    let res = await sb
      .from("reservation_slots")
      .select("id, teacher_id, language, course_id, start_time, end_time, capacity, status")
      .order("start_time", { ascending: true });

    if (res.error && isMissingColumnError(res.error)) {
      // Retry without status
      res = await sb
        .from("reservation_slots")
        .select("id, teacher_id, language, course_id, start_time, end_time, capacity")
        .order("start_time", { ascending: true });
      if (!res.error && res.data) {
        // synthesize status
        res.data = res.data.map(r => ({ ...r, status: "active" }));
      }
    }
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function fetchAvailabilities() {
    const { data, error } = await sb
      .from("teacher_availabilities")
      .select("id, teacher_id, language, start_time, end_time, status")
      .order("start_time", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async function fetchCourses() {
    // Optional (for nicer titles)
    const { data, error } = await sb
      .from("courses")
      .select("id, title_ja, duration_min")
      .order("sort_order", { ascending: true });

    if (error) return [];
    return data || [];
  }

  function makeCourseMap(courses) {
    const map = {};
    courses.forEach(c => {
      const title = (c.title_ja || "").trim();
      const dur = c.duration_min != null ? `${c.duration_min}分` : "";
      map[c.id] = title ? (dur ? `${title}（${dur}）` : title) : (dur || "コース");
    });
    return map;
  }

  function slotColor(status) {
    if (status === "closed") return COLORS.slot_closed;
    return COLORS.slot_active; // default
  }

  function availColor(status) {
    if (status === "approved") return COLORS.avail_approved;
    if (status === "rejected") return COLORS.avail_rejected;
    return COLORS.avail_pending;
  }

  function short(s) {
    if (!s) return "";
    return String(s).slice(0, 6) + "…";
  }

  async function buildEvents() {
    const [slots, avails, courses] = await Promise.all([
      fetchSlotsSafe(),
      fetchAvailabilities(),
      fetchCourses()
    ]);

    const courseMap = makeCourseMap(courses);

    const slotEvents = slots.map(s => {
      const c = slotColor(s.status);
      const titleCourse = s.course_id ? (courseMap[s.course_id] || "コース") : "（コース未設定）";
      const title = `【予約枠】${titleCourse} / ${s.language || ""} / ${short(s.teacher_id)}`;

      return {
        id: `slot:${s.id}`,
        title,
        start: s.start_time,
        end: s.end_time,
        backgroundColor: c.bg,
        borderColor: c.border,
        textColor: c.text,
        extendedProps: { kind: "slot", row: s }
      };
    });

    const availEvents = avails.map(a => {
      const c = availColor(a.status);
      const statusJa =
        a.status === "approved" ? "承認済み" :
        a.status === "rejected" ? "却下" : "承認待ち";

      const title = `【講師申請/${statusJa}】${a.language || ""} / ${short(a.teacher_id)}`;

      return {
        id: `avail:${a.id}`,
        title,
        start: a.start_time,
        end: a.end_time,
        backgroundColor: c.bg,
        borderColor: c.border,
        textColor: c.text,
        extendedProps: { kind: "avail", row: a }
      };
    });

    return [...slotEvents, ...availEvents];
  }

  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: "timeGridWeek",
    locale: "ja",
    nowIndicator: true,
    height: "auto",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    slotMinTime: "08:00:00",
    slotMaxTime: "23:00:00",
    eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
    events: async (info, success, failure) => {
      try {
        const events = await buildEvents();
        success(events);
      } catch (e) {
        console.error("calendar load error:", e);
        failure(e);
      }
    },
    eventClick: (info) => {
      const kind = info.event.extendedProps?.kind;

      if (kind === "slot") {
        // Jump to the slots table area so admin can find it
        document.querySelector("#admin-slots-body")?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (kind === "avail") {
        document.querySelector("#admin-availability-body")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  });

  calendar.render();

  // Optional refresh hook for other scripts
  window.__adminCalendarRefetch = () => calendar.refetchEvents();
})();
