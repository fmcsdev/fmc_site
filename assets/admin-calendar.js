// assets/admin-calendar.js
// Calendar view: reservation_slots + teacher_availabilities

(function () {
  const calEl = document.getElementById("adminCalendar");
  if (!calEl || !window.FullCalendar || !window.supabaseClient) return;

  const sb = window.supabaseClient; // ✅ reuse existing client

  // Colors
  const COLORS = {
    slot_active:   { bg: "#3b82f6", border: "#3b82f6", text: "#fff" },
    slot_closed:   { bg: "#9ca3af", border: "#9ca3af", text: "#fff" },
    avail_pending: { bg: "#f59e0b", border: "#f59e0b", text: "#111827" },
    avail_approved:{ bg: "#22c55e", border: "#22c55e", text: "#0b1220" },
    avail_rejected:{ bg: "#ef4444", border: "#ef4444", text: "#fff" }
  };

  function isMissingColumnError(err) {
    const msg = err?.message || "";
    return msg.includes("42703") || msg.includes("status");
  }

  async function fetchSlotsSafe() {
    let res = await sb
      .from("reservation_slots")
      .select("id, teacher_id, language, course_id, start_time, end_time, capacity, status")
      .order("start_time");

    if (res.error && isMissingColumnError(res.error)) {
      res = await sb
        .from("reservation_slots")
        .select("id, teacher_id, language, course_id, start_time, end_time, capacity")
        .order("start_time");

      if (!res.error && res.data) {
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
      .order("start_time");

    if (error) throw error;
    return data || [];
  }

  async function fetchCourses() {
    const { data } = await sb
      .from("courses")
      .select("id, title_ja, duration_min");

    return data || [];
  }

  function courseMap(courses) {
    const map = {};
    courses.forEach(c => {
      map[c.id] = c.title_ja
        ? `${c.title_ja}${c.duration_min ? `（${c.duration_min}分）` : ""}`
        : "コース";
    });
    return map;
  }

  function short(id) {
    return id ? String(id).slice(0, 6) + "…" : "";
  }

  async function buildEvents() {
    const [slots, avails, courses] = await Promise.all([
      fetchSlotsSafe(),
      fetchAvailabilities(),
      fetchCourses()
    ]);

    const cMap = courseMap(courses);

    const slotEvents = slots.map(s => ({
      id: `slot:${s.id}`,
      title: `【予約枠】${cMap[s.course_id] || "未設定"} / ${s.language} / ${short(s.teacher_id)}`,
      start: s.start_time,
      end: s.end_time,
      backgroundColor: COLORS[s.status === "closed" ? "slot_closed" : "slot_active"].bg,
      borderColor: COLORS[s.status === "closed" ? "slot_closed" : "slot_active"].border,
      textColor: "#fff",
      extendedProps: { kind: "slot" }
    }));

    const availEvents = avails.map(a => ({
      id: `avail:${a.id}`,
      title: `【講師申請】${a.language} / ${short(a.teacher_id)}`,
      start: a.start_time,
      end: a.end_time,
      backgroundColor: COLORS[`avail_${a.status || "pending"}`].bg,
      borderColor: COLORS[`avail_${a.status || "pending"}`].border,
      textColor: COLORS[`avail_${a.status || "pending"}`].text,
      extendedProps: { kind: "avail" }
    }));

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
    events: async (_, success, failure) => {
      try {
        success(await buildEvents());
      } catch (e) {
        console.error(e);
        failure(e);
      }
    }
  });

  calendar.render();

  // allow admin.js to refresh calendar
  window.__adminCalendarRefetch = () => calendar.refetchEvents();
})();
