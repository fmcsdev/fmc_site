// assets/admin-calendar.js
(function () {
  // Only run on admin dashboard if calendar exists
  const calEl = document.getElementById("adminCalendar");
  if (!calEl) return;

  // Use the same Supabase credentials as admin.js (keep consistent)
  const { createClient } = window.supabase;

  const SUPABASE_URL  = "https://dsbvgomhugvjruqykbmr.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, detectSessionInUrl: true }
  });

  function statusColor(kind, status) {
    // kind: "slot" | "avail"
    if (kind === "slot") {
      if (status === "active") return "#3b82f6";  // blue
      if (status === "closed") return "#94a3b8";  // slate
      return "#a855f7";                            // purple fallback
    }
    // avail
    if (status === "approved") return "#22c55e";   // green
    if (status === "pending") return "#f59e0b";    // orange
    if (status === "rejected") return "#ef4444";   // red
    return "#64748b";
  }

  function slotTitle(s) {
    // You can expand later to include course name once you join courses
    return `予約枠 (${s.language || ""})`;
  }

  function availTitle(a) {
    const label = a.status === "approved" ? "講師申請(承認済み)"
      : a.status === "pending" ? "講師申請(承認待ち)"
      : a.status === "rejected" ? "講師申請(却下)"
      : "講師申請";
    return `${label} (${a.language || ""})`;
  }

  async function fetchEvents(rangeStart, rangeEnd) {
    // fetch slots within calendar range
    const { data: slots, error: sErr } = await sb
      .from("reservation_slots")
      .select("id, language, start_time, end_time, status, teacher_id")
      .gte("start_time", rangeStart.toISOString())
      .lte("start_time", rangeEnd.toISOString())
      .order("start_time", { ascending: true });

    if (sErr) {
      console.warn("calendar slots error:", sErr);
    }

    // fetch teacher availabilities within range
    const { data: avails, error: aErr } = await sb
      .from("teacher_availabilities")
      .select("id, language, start_time, end_time, status, teacher_id")
      .gte("start_time", rangeStart.toISOString())
      .lte("start_time", rangeEnd.toISOString())
      .order("start_time", { ascending: true });

    if (aErr) {
      console.warn("calendar avails error:", aErr);
    }

    const events = [];

    (slots || []).forEach(s => {
      events.push({
        id: "slot-" + s.id,
        title: slotTitle(s),
        start: s.start_time,
        end: s.end_time,
        backgroundColor: statusColor("slot", s.status),
        borderColor: statusColor("slot", s.status),
        textColor: "#ffffff",
        extendedProps: { kind: "slot", raw: s }
      });
    });

    (avails || []).forEach(a => {
      events.push({
        id: "avail-" + a.id,
        title: availTitle(a),
        start: a.start_time,
        end: a.end_time,
        backgroundColor: statusColor("avail", a.status),
        borderColor: statusColor("avail", a.status),
        textColor: "#111827",
        extendedProps: { kind: "avail", raw: a }
      });
    });

    return events;
  }

  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: "dayGridMonth",
    height: "auto",
    nowIndicator: true,
    locale: "ja",
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
    events: async (info, successCallback, failureCallback) => {
      try {
        const events = await fetchEvents(info.start, info.end);
        successCallback(events);
      } catch (e) {
        console.error("calendar events failed:", e);
        failureCallback(e);
      }
    },
    eventClick: (info) => {
      const { kind, raw } = info.event.extendedProps || {};
      if (!raw) return;

      // Simple details popup (you can replace with a nicer modal later)
      const start = new Date(raw.start_time).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      const end   = new Date(raw.end_time).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      alert(
        `種類: ${kind}\n` +
        `言語: ${raw.language || ""}\n` +
        `状態: ${raw.status || ""}\n` +
        `開始: ${start}\n` +
        `終了: ${end}`
      );
    }
  });

  calendar.render();

  // Optional: allow admin.js to refresh calendar after changes
  window.__adminCalendarRefetch = () => calendar.refetchEvents();
})();
