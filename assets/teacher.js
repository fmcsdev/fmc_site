// assets/teacher.js
// Teacher dashboard: submit availability + view own availability and reservations.

const { createClient: createClientTeacher } = window.supabase;

const SUPABASE_URL_T  = "https://dsbvgomhugvjruqykbmr.supabase.co";
const SUPABASE_ANON_T = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

const supabaseT = createClientTeacher(SUPABASE_URL_T, SUPABASE_ANON_T, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

document.addEventListener("DOMContentLoaded", () => {
  initTeacher().catch(err => {
    console.error("Teacher init error:", err);
    alert("講師ページの読み込み中にエラーが発生しました。");
  });
});

async function initTeacher() {
  const user = await requireAuthTeacher("teacher");
  setupLogoutTeacher();
  setupAvailabilityForm(user);

  await Promise.all([
    loadOwnAvailabilities(user),
    loadOwnReservations(user)
  ]);
}

/**
 * Require auth + teacher role
 */
async function requireAuthTeacher(requiredRole) {
  const { data, error } = await supabaseT.auth.getUser();
  if (error || !data.user) {
    window.location.href = "../login.html?redirect=" + encodeURIComponent(window.location.pathname);
    throw new Error("Not logged in");
  }
  const user = data.user;

  const { data: profile, error: profileErr } = await supabaseT
    .from("user_profiles")
    .select("role, login_id")
    .eq("user_id", user.id)
    .single();

  if (profileErr || !profile) {
    console.error("Teacher profile error:", profileErr);
    window.location.href = "../login.html";
    throw new Error("Profile not found");
  }

  const name = profile.login_id || user.email || "Teacher";
  const nameEl = document.getElementById("userDisplayName");
  if (nameEl) nameEl.textContent = name;

  if (profile.role !== requiredRole) {
    // redirect to correct dashboard if role mismatch
    switch (profile.role) {
      case "admin":
        window.location.href = "../admin/index.html";
        break;
      case "student":
        window.location.href = "../student/index.html";
        break;
      case "guardian":
        window.location.href = "../guardian/index.html";
        break;
      default:
        window.location.href = "../login.html";
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

/**
 * Availability form submit
 */
function setupAvailabilityForm(user) {
  const form = document.getElementById("teacher-availability-form");
  const statusEl = document.getElementById("teacher-availability-status");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const language = (fd.get("language") || "").toString();
    const date     = (fd.get("date") || "").toString();
    const start    = (fd.get("start") || "").toString();
    const end      = (fd.get("end") || "").toString();
    const note     = (fd.get("note") || "").toString();

    if (!language || !date || !start || !end) {
      if (statusEl) statusEl.textContent = "言語・日付・開始・終了は必須です。";
      return;
    }

    const startIso = new Date(`${date}T${start}:00`).toISOString();
    const endIso   = new Date(`${date}T${end}:00`).toISOString();

    if (statusEl) statusEl.textContent = "送信中...";

    const { error } = await supabaseT.from("teacher_availabilities").insert({
      teacher_id: user.id,
      language,
      start_time: startIso,
      end_time: endIso,
      note,
      status: "pending"
    });

    if (error) {
      console.error("insert availability error:", error);
      if (statusEl) statusEl.textContent = "登録に失敗しました。";
      return;
    }

    form.reset();
    if (statusEl) statusEl.textContent = "送信しました。（承認待ち）";
    await loadOwnAvailabilities(user);
  });
}

/**
 * Own availability list
 */
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

/**
 * Reservations for this teacher
 */
async function loadOwnReservations(user) {
  const tbody = document.getElementById("teacher-reservation-body");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='5'>読み込み中...</td></tr>";

  // First: get slots for this teacher
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

/* ===== helpers (teacher) ===== */

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
