// assets/student.js
// Student dashboard: search slots, book lessons, view own reservations.

const { createClient: createClientStudent } = window.supabase;

const SUPABASE_URL_S  = "https://dsbvgomhugvjruqykbmr.supabase.co";
const SUPABASE_ANON_S = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

const supabaseS = createClientStudent(SUPABASE_URL_S, SUPABASE_ANON_S, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

let currentUserStudent = null;
let allSlots = [];
let reservationsBySlot = new Map(); // slotId -> count

document.addEventListener("DOMContentLoaded", () => {
  initStudent().catch(err => {
    console.error("Student init error:", err);
    alert("予約ページの読み込み中にエラーが発生しました。");
  });
});

async function initStudent() {
  const user = await requireAuthStudent("student");
  currentUserStudent = user;
  setupLogoutStudent();
  setupFilterForm();

  await Promise.all([
    loadTeacherFilterOptions(),
    loadSlotsAndReservations(),
    loadMyReservations()
  ]);
}

/**
 * Require auth (role: student or fallback when no strict role)
 */
async function requireAuthStudent(preferredRole) {
  const { data, error } = await supabaseS.auth.getUser();
  if (error || !data.user) {
    window.location.href = "../login.html?redirect=" + encodeURIComponent(window.location.pathname);
    throw new Error("Not logged in");
  }
  const user = data.user;

  const { data: profile, error: profileErr } = await supabaseS
    .from("user_profiles")
    .select("role, display_name")
    .eq("user_id", user.id)
    .single();

  if (profileErr || !profile) {
    // no profile? treat as student for now
    const nameEl = document.getElementById("userDisplayName");
    if (nameEl) nameEl.textContent = user.email || "Student";
    return user;
  }

  const name = profile.display_name || user.email || "Student";
  const nameEl = document.getElementById("userDisplayName");
  if (nameEl) nameEl.textContent = name;

  // If role is clearly not student, route them
  if (profile.role === "admin") {
    window.location.href = "../admin/index.html";
    throw new Error("Wrong role");
  }
  if (profile.role === "teacher") {
    window.location.href = "../teacher/index.html";
    throw new Error("Wrong role");
  }

  return user;
}

function setupLogoutStudent() {
  const btns = [
    document.getElementById("logoutBtn"),
    document.getElementById("logoutBtnMobile")
  ].filter(Boolean);

  btns.forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseS.auth.signOut();
      window.location.href = "../login.html";
    });
  });
}

function setupFilterForm() {
  const form = document.getElementById("student-filter-form");
  if (!form) return;
  form.addEventListener("change", () => {
    renderSlotsTable(); // filter client-side
  });
}

/**
 * Teacher select options (for filter)
 */
async function loadTeacherFilterOptions() {
  const select = document.getElementById("student-filter-teacher");
  if (!select) return;

  const { data, error } = await supabaseS
    .from("user_profiles")
    .select("user_id, display_name, role")
    .eq("role", "teacher")
    .order("display_name", { ascending: true });

  if (error) {
    console.error("loadTeacherFilterOptions error:", error);
    return;
  }

  // keep existing "すべて" option
  while (select.options.length > 1) {
    select.remove(1);
  }
  (data || []).forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.user_id;
    opt.textContent = t.display_name || shortIdS(t.user_id);
    select.appendChild(opt);
  });
}

/**
 * Load active slots + reservation counts
 */
async function loadSlotsAndReservations() {
  const nowIso = new Date().toISOString();

  const { data: slots, error: slotErr } = await supabaseS
    .from("reservation_slots")
    .select("id, teacher_id, language, start_time, end_time, capacity, is_active")
    .eq("is_active", true)
    .gte("start_time", nowIso)
    .order("start_time", { ascending: true });

  if (slotErr) {
    console.error("loadSlotsAndReservations slots error:", slotErr);
    const tbody = document.getElementById("student-slots-body");
    if (tbody) tbody.innerHTML = "<tr><td colspan='6'>読み込みエラー</td></tr>";
    return;
  }

  allSlots = slots || [];

  if (!allSlots.length) {
    const tbody = document.getElementById("student-slots-body");
    if (tbody) tbody.innerHTML = "<tr><td colspan='6'>現在予約可能な枠はありません。</td></tr>";
    return;
  }

  const slotIds = allSlots.map(s => s.id);

  const { data: res, error: resErr } = await supabaseS
    .from("reservations")
    .select("slot_id, status")
    .in("slot_id", slotIds)
    .eq("status", "booked");

  reservationsBySlot.clear();
  if (!resErr && res) {
    res.forEach(r => {
      const current = reservationsBySlot.get(r.slot_id) || 0;
      reservationsBySlot.set(r.slot_id, current + 1);
    });
  }

  renderSlotsTable();
}

/**
 * Render slots (filtered by form)
 */
function renderSlotsTable() {
  const tbody = document.getElementById("student-slots-body");
  const statusEl = document.getElementById("student-slots-status");
  if (!tbody) return;

  if (!allSlots.length) {
    tbody.innerHTML = "<tr><td colspan='6'>現在予約可能な枠はありません。</td></tr>";
    if (statusEl) statusEl.textContent = "";
    return;
  }

  const form = document.getElementById("student-filter-form");
  let langFilter = "";
  let teacherFilter = "";
  let fromDate = "";
  let toDate = "";

  if (form) {
    const fd = new FormData(form);
    langFilter = (fd.get("language") || "").toString();
    teacherFilter = (fd.get("teacher") || "").toString();
    fromDate = (fd.get("from") || "").toString();
    toDate   = (fd.get("to") || "").toString();
  }

  const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
  const to   = toDate   ? new Date(toDate + "T23:59:59") : null;

  const filtered = allSlots.filter(s => {
    if (langFilter && s.language !== langFilter) return false;
    if (teacherFilter && s.teacher_id !== teacherFilter) return false;

    const st = new Date(s.start_time);
    if (from && st < from) return false;
    if (to && st > to) return false;

    return true;
  });

  tbody.innerHTML = "";

  if (!filtered.length) {
    tbody.innerHTML = "<tr><td colspan='6'>条件に一致する枠がありません。</td></tr>";
    if (statusEl) statusEl.textContent = "";
    return;
  }

  filtered.forEach(slot => {
    const booked = reservationsBySlot.get(slot.id) || 0;
    const capacity = slot.capacity ?? 1;
    const remaining = Math.max(capacity - booked, 0);

    const date = formatDateOnlyS(slot.start_time);
    const time = formatTimeRangeS(slot.start_time, slot.end_time);
    const lang = slot.language || "";
    const teacherLabel = shortIdS(slot.teacher_id);

    const disabled = remaining <= 0 ? "disabled" : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td>${time}</td>
      <td>${lang}</td>
      <td>${teacherLabel}</td>
      <td>${remaining}</td>
      <td>
        <button class="text-xs btn-primary px-2 py-1 ${disabled ? "opacity-50 cursor-not-allowed" : ""}"
                data-slot-id="${slot.id}" ${disabled}>
          ${remaining > 0 ? "予約する" : "満席"}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Add click listener (delegate)
  tbody.onclick = async (e) => {
    const btn = e.target.closest("button[data-slot-id]");
    if (!btn || btn.disabled) return;
    const slotId = parseInt(btn.getAttribute("data-slot-id"), 10);
    await handleBooking(slotId);
  };

  if (statusEl) {
    statusEl.textContent = `表示中の枠: ${filtered.length}件`;
  }
}

/**
 * Create a reservation
 */
async function handleBooking(slotId) {
  if (!currentUserStudent) return;
  const ok = window.confirm("この枠を予約しますか？");
  if (!ok) return;

  const { error } = await supabaseS.from("reservations").insert({
    slot_id: slotId,
    student_id: currentUserStudent.id,
    status: "booked"
  });

  if (error) {
    console.error("booking error:", error);
    if (error.message?.includes("duplicate")) {
      alert("すでにこの枠を予約しています。");
    } else {
      alert("予約に失敗しました。");
    }
    return;
  }

  alert("予約しました。");
  await Promise.all([
    loadSlotsAndReservations(),
    loadMyReservations()
  ]);
}

/**
 * My reservations table (for this page)
 */
async function loadMyReservations() {
  const tbody = document.getElementById("student-reservation-body");
  if (!tbody || !currentUserStudent) return;
  tbody.innerHTML = "<tr><td colspan='6'>読み込み中...</td></tr>";

  const { data, error } = await supabaseS
    .from("reservations")
    .select(`
      id,
      slot_id,
      status,
      created_at,
      slot:slot_id (
        start_time,
        end_time,
        language,
        teacher_id
      )
    `)
    .eq("student_id", currentUserStudent.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadMyReservations error:", error);
    tbody.innerHTML = "<tr><td colspan='6'>読み込みエラー</td></tr>";
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>まだ予約はありません。</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  data.forEach(row => {
    const slot = row.slot || {};
    const date = formatDateOnlyS(slot.start_time);
    const time = formatTimeRangeS(slot.start_time, slot.end_time);
    const lang = slot.language || "";
    const teacherLabel = shortIdS(slot.teacher_id);
    const statusLabel = row.status === "booked" ? "予約中" : "キャンセル";

    const disableCancel = row.status !== "booked";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td>${time}</td>
      <td>${lang}</td>
      <td>${teacherLabel}</td>
      <td>${statusLabel}</td>
      <td>
        <button class="text-xs px-2 py-1 border rounded ${disableCancel ? "opacity-40 cursor-not-allowed" : ""}"
                data-res-id="${row.id}" ${disableCancel ? "disabled" : ""}>
          キャンセル
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.onclick = async (e) => {
    const btn = e.target.closest("button[data-res-id]");
    if (!btn || btn.disabled) return;
    const id = parseInt(btn.getAttribute("data-res-id"), 10);
    const ok = window.confirm("この予約をキャンセルしますか？");
    if (!ok) return;

    const { error: updErr } = await supabaseS
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (updErr) {
      console.error("cancel error:", updErr);
      alert("キャンセルに失敗しました。");
      return;
    }

    alert("キャンセルしました。");
    await Promise.all([
      loadSlotsAndReservations(),
      loadMyReservations()
    ]);
  };
}

/* ===== Helpers (student) ===== */

function shortIdS(id) {
  if (!id) return "";
  return String(id).slice(0, 6) + "…";
}

function formatDateOnlyS(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatTimeRangeS(startIso, endIso) {
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
