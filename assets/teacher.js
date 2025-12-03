// assets/teacher.js
// Teacher dashboard: calendar-based availability + own availability + reservations.

const { createClient: createClientTeacher } = window.supabase;

const SUPABASE_URL_T  = "https://dsbvgomhugvjruqykbmr.supabase.co";
const SUPABASE_ANON_T = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

const supabaseT = createClientTeacher(SUPABASE_URL_T, SUPABASE_ANON_T, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

// ===== Fixed schedule definitions =====
// Weekday slots
const WEEKDAY_SLOTS = [
  { code: "1", label: "1コマ", start: "09:00", end: "10:35" },
  { code: "2", label: "2コマ", start: "10:40", end: "12:20" },
  { code: "3", label: "3コマ", start: "13:45", end: "15:20" },
  { code: "4", label: "4コマ", start: "15:30", end: "17:05" },
  { code: "5", label: "5コマ", start: "18:40", end: "20:15" },
  { code: "6", label: "6コマ", start: "20:25", end: "22:00" }
];

// Weekend slots (2–5 only)
const WEEKEND_SLOTS = [
  { code: "2", label: "2コマ", start: "10:45", end: "12:20" },
  { code: "3", label: "3コマ", start: "13:45", end: "15:20" },
  { code: "4", label: "4コマ", start: "15:30", end: "17:05" },
  { code: "5", label: "5コマ", start: "18:40", end: "20:15" }
];

// Calendar state
let currentTeacherUser = null;
let currentYear = null;
let currentMonth = null; // 0-11

document.addEventListener("DOMContentLoaded", () => {
  initTeacher().catch(err => {
    console.error("Teacher init error:", err);
    alert("講師ページの読み込み中にエラーが発生しました。");
  });
});

async function initTeacher() {
  const user = await requireAuthTeacher("teacher");
  currentTeacherUser = user;
  setupLogoutTeacher();

  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();

  setupCalendarNav();
  await refreshCalendar();
  await Promise.all([
    loadOwnAvailabilities(user),
    loadOwnReservations(user)
  ]);
}

/* ==========================
   Auth & logout
========================== */

async function requireAuthTeacher(requiredRole) {
  const { data, error } = await supabaseT.auth.getUser();
  if (error || !data.user) {
    window.location.href = "../login.html?redirect=" + encodeURIComponent(window.location.pathname);
    throw new Error("Not logged in");
  }
  const user = data.user;

  const { data: profile, error: profileErr } = await supabaseT
    .from("user_profiles")
    .select("role, display_name")
    .eq("user_id", user.id)
    .single();

  if (profileErr || !profile) {
    window.location.href = "../login.html";
    throw new Error("Profile not found");
  }

  const name = profile.display_name || user.email || "Teacher";
  const nameEl = document.getElementById("userDisplayName");
  if (nameEl) nameEl.textContent = name;

  if (profile.role !== requiredRole) {
    switch (profile.role) {
      case "admin":
        window.location.href = "../admin/index.html";
        break;
      case "student":
      default:
        window.location.href = "../student/index.html";
        break;
    }
    throw new Error("Wrong role");
  }

  return user;
}

function setupLogoutTeacher() {
  const btns = [
    document.getElementById("logoutBtn"),
    document.getElementById("logoutBtnMobile")
  ].filter(Boolean);

  btns.forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseT.auth.signOut();
      window.location.href = "../login.html";
    });
  });
}

/* ==========================
   Calendar UI
========================== */

function setupCalendarNav() {
  const prevBtn = document.getElementById("calPrev");
  const nextBtn = document.getElementById("calNext");

  if (prevBtn) {
    prevBtn.addEventListener("click", async () => {
      currentMonth -= 1;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear -= 1;
      }
      await refreshCalendar();
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", async () => {
      currentMonth += 1;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear += 1;
      }
      await refreshCalendar();
    });
  }
}

async function refreshCalendar() {
  const statusEl = document.getElementById("teacher-availability-status");
  const labelEl  = document.getElementById("calLabel");
  const gridEl   = document.getElementById("teacherCalendar");
  if (!gridEl || !labelEl) return;

  const langSel = document.getElementById("teacherLanguage");
  const language = langSel ? (langSel.value || "") : "";

  const ymLabel = `${currentYear}年${String(currentMonth + 1).padStart(2, "0")}月`;
  labelEl.textContent = ymLabel;

  // Load existing availability for this month (all languages)
  const monthAvailMap = await loadMonthAvailabilityMap(
    currentTeacherUser,
    currentYear,
    currentMonth
  );

  // Build calendar
  gridEl.innerHTML = "";
  const firstDay = new Date(currentYear, currentMonth, 1);
  const firstDow = firstDay.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Empty cells before 1st
  for (let i = 0; i < firstDow; i++) {
    const empty = document.createElement("div");
    gridEl.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(currentYear, currentMonth, day);
    const dow = d.getDay(); // 0 Sun - 6 Sat
    const isWeekend = (dow === 0 || dow === 6);
    const slots = isWeekend ? WEEKEND_SLOTS : WEEKDAY_SLOTS;
    const dateKey = formatDateKey(d); // YYYY-MM-DD

    const cell = document.createElement("div");
    cell.className = "border rounded-lg bg-white p-2 flex flex-col gap-1";

    const dateLabel = document.createElement("div");
    dateLabel.className = "text-[11px] font-semibold mb-1";
    const dowStr = ["日","月","火","水","木","金","土"][dow];
    dateLabel.textContent = `${day}(${dowStr})`;
    cell.appendChild(dateLabel);

    if (!slots.length) {
      const noSlot = document.createElement("div");
      noSlot.className = "text-[11px] text-slate-400";
      noSlot.textContent = "コマなし";
      cell.appendChild(noSlot);
    } else {
      slots.forEach(slot => {
        const key = `${dateKey}|${slot.code}|${language || "__any__"}`;

        const row = document.createElement("label");
        row.className = "flex items-center gap-1 text-[11px]";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "h-3 w-3";
        cb.dataset.date = dateKey;
        cb.dataset.code = slot.code;
        cb.dataset.start = slot.start;
        cb.dataset.end = slot.end;

        // Checked if we already have availability for this date/slot/language
        const existing = monthAvailMap[key];
        cb.checked = !!existing;

        cb.addEventListener("change", async (e) => {
          const langSel2 = document.getElementById("teacherLanguage");
          const lang2 = langSel2 ? (langSel2.value || "") : "";
          if (!lang2) {
            if (statusEl) statusEl.textContent = "先に担当言語を選択してください。";
            // revert checkbox
            cb.checked = !cb.checked;
            return;
          }
          if (statusEl) statusEl.textContent = "更新中…";

          const ok = await toggleSlotAvailability(
            currentTeacherUser,
            e.target.checked,
            e.target.dataset.date,
            e.target.dataset.start,
            e.target.dataset.end,
            lang2
          );

          if (!ok) {
            // revert on error
            cb.checked = !cb.checked;
          } else {
            // Reload table & calendar to stay in sync
            await loadOwnAvailabilities(currentTeacherUser);
            await refreshCalendar();
            if (statusEl) statusEl.textContent = "更新しました。";
          }
        });

        const text = document.createElement("span");
        text.textContent = `${slot.label} ${slot.start}〜${slot.end}`;

        row.appendChild(cb);
        row.appendChild(text);
        cell.appendChild(row);
      });
    }

    gridEl.appendChild(cell);
  }
}

// Loads this teacher's availability for the month and returns a map:
// key = "YYYY-MM-DD|slotCode|language(or __any__)" -> true
async function loadMonthAvailabilityMap(user, year, month) {
  const map = {};
  if (!user) return map;

  const from = new Date(year, month, 1);
  const to   = new Date(year, month + 1, 1);

  const { data, error } = await supabaseT
    .from("teacher_availabilities")
    .select("id, start_time, end_time, language")
    .eq("teacher_id", user.id)
    .gte("start_time", from.toISOString())
    .lt("start_time", to.toISOString());

  if (error) {
    console.error("loadMonthAvailabilityMap error:", error);
    return map;
  }

  (data || []).forEach(row => {
    const start = new Date(row.start_time);
    const end   = row.end_time ? new Date(row.end_time) : null;

    const dateKey = formatDateKey(start); // local date
    const dow = start.getDay();
    const isWeekend = (dow === 0 || dow === 6);
    const slots = isWeekend ? WEEKEND_SLOTS : WEEKDAY_SLOTS;

    const sh = String(start.getHours()).padStart(2, "0") + ":" +
               String(start.getMinutes()).padStart(2, "0");
    const eh = end
      ? String(end.getHours()).padStart(2, "0") + ":" +
        String(end.getMinutes()).padStart(2, "0")
      : "";

    const slot = slots.find(s => s.start === sh && s.end === eh);
    if (!slot) return;

    const lang = row.language || "";
    const key = `${dateKey}|${slot.code}|${lang || "__any__"}`;
    map[key] = true;
  });

  return map;
}

// Insert or delete one slot for this teacher
async function toggleSlotAvailability(user, isOn, dateStr, startHHMM, endHHMM, language) {
  try {
    const startIso = toIso(dateStr, startHHMM);
    const endIso   = toIso(dateStr, endHHMM);

    if (isOn) {
      // avoid duplicates
      const { data: existing, error: exErr } = await supabaseT
        .from("teacher_availabilities")
        .select("id")
        .eq("teacher_id", user.id)
        .eq("language", language)
        .eq("start_time", startIso);

      if (exErr) {
        console.error("check existing availability error:", exErr);
        return false;
      }
      if (existing && existing.length > 0) {
        return true; // already exists
      }

      const { error } = await supabaseT
        .from("teacher_availabilities")
        .insert({
          teacher_id: user.id,
          language,
          start_time: startIso,
          end_time: endIso,
          note: "",
          status: "pending"
        });

      if (error) {
        console.error("insert availability error:", error);
        return false;
      }
    } else {
      const { error } = await supabaseT
        .from("teacher_availabilities")
        .delete()
        .eq("teacher_id", user.id)
        .eq("language", language)
        .eq("start_time", startIso);

      if (error) {
        console.error("delete availability error:", error);
        return false;
      }
    }

    return true;
  } catch (e) {
    console.error("toggleSlotAvailability unexpected error:", e);
    return false;
  }
}

/* ==========================
   Existing tables (unchanged)
========================== */

async function loadOwnAvailabilities(user) {
  const tbody = document.getElementById("teacher-availability-body");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='4'>読み込み中...</td></tr>";

  const { data, error } = await supabaseT
    .from("teacher_availabilities")
    .select("id, language, start_time, end_time, status")
    .eq("teacher_id", user.id)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("loadOwnAvailabilities error:", error);
    tbody.innerHTML = "<tr><td colspan='4'>読み込みエラー</td></tr>";
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='4'>まだ空き時間は登録されていません。</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  data.forEach(row => {
    const date = formatDateOnlyT(row.start_time);
    const time = formatTimeRangeT(row.start_time, row.end_time);
    const statusLabel = row.status === "approved"
      ? "承認済み"
      : row.status === "rejected"
      ? "却下"
      : "承認待ち";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td>${time}</td>
      <td>${row.language || ""}</td>
      <td>${statusLabel}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadOwnReservations(user) {
  const tbody = document.getElementById("teacher-reservation-body");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='5'>読み込み中...</td></tr>";

  const { data: slots, error: slotErr } = await supabaseT
    .from("reservation_slots")
    .select("id, start_time, end_time, language, teacher_id")
    .eq("teacher_id", user.id)
    .order("start_time", { ascending: true });

  if (slotErr) {
    console.error("loadOwnReservations slots error:", slotErr);
    tbody.innerHTML = "<tr><td colspan='5'>読み込みエラー</td></tr>";
    return;
  }
  if (!slots || slots.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5'>予約枠がまだありません。</td></tr>";
    return;
  }

  const slotIds = slots.map(s => s.id);
  const { data: res, error: resErr } = await supabaseT
    .from("reservations")
    .select("id, slot_id, student_id, status")
    .in("slot_id", slotIds)
    .order("id", { ascending: true });

  if (resErr) {
    console.error("loadOwnReservations res error:", resErr);
    tbody.innerHTML = "<tr><td colspan='5'>読み込みエラー</td></tr>";
    return;
  }
  if (!res || res.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5'>まだ予約はありません。</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  const slotMap = new Map(slots.map(s => [s.id, s]));

  res.forEach(row => {
    const slot = slotMap.get(row.slot_id);
    if (!slot) return;

    const date = formatDateOnlyT(slot.start_time);
    const time = formatTimeRangeT(slot.start_time, slot.end_time);
    const lang = slot.language || "";
    const studentLabel = shortIdT(row.student_id);
    const statusLabel  = row.status === "booked" ? "予約中" : "キャンセル";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td>${time}</td>
      <td>${lang}</td>
      <td>${studentLabel}</td>
      <td>${statusLabel}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================
   Helpers
========================== */

function shortIdT(id) {
  if (!id) return "";
  return String(id).slice(0, 6) + "…";
}

function formatDateOnlyT(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatTimeRangeT(startIso, endIso) {
  if (!startIso) return "";
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  const sh = String(s.getHours()).padStart(2, "0");
  const sm = String(s.getMinutes()).padStart(2, "0");
  if (!e) return `${sh}:${sm}`;
  const eh = String(e.getHours()).padStart(2, "0");
  const em = String(e.getMinutes()).padStart(2, "0");
  return `${sh}:${sm}〜${eh}:${em}`;
}

function formatDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toIso(dateStr, hhmm) {
  // dateStr 'YYYY-MM-DD', hhmm 'HH:MM'
  return new Date(`${dateStr}T${hhmm}:00`).toISOString();
}
