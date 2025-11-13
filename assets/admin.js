// assets/admin.js
// Admin dashboard: see counts, teacher availabilities, slots, and reservations.

const { createClient } = window.supabase;

const SUPABASE_URL  = "https://dsbvgomhugvjruqykbmr.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

document.addEventListener("DOMContentLoaded", () => {
  initAdmin().catch(err => {
    console.error("Admin init error:", err);
    alert("管理ページの読み込み中にエラーが発生しました。");
  });
});

async function initAdmin() {
  const user = await requireAuthAndRole("admin");
  setupLogout();

  await Promise.all([
    loadSummaryCards(),
    loadTeacherAvailabilities(),
    loadReservationSlots(),
    loadReservations()
  ]);

  const addSlotBtn = document.getElementById("admin-add-slot");
  if (addSlotBtn) {
    addSlotBtn.addEventListener("click", handleAddSlotPrompt);
  }
}

/**
 * Require auth + admin role
 */
async function requireAuthAndRole(requiredRole) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    // Not logged in -> back to login
    window.location.href = "../login.html?redirect=" + encodeURIComponent(window.location.pathname);
    throw new Error("Not logged in");
  }

  const user = data.user;

  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("role, display_name")
    .eq("user_id", user.id)
    .single();

  if (profileErr || !profile) {
    console.warn("Profile not found, redirecting to login");
    window.location.href = "../login.html";
    throw new Error("Profile not found");
  }

  // Set header name
  const name = profile.display_name || user.email || "Admin";
  const nameEl = document.getElementById("userDisplayName");
  if (nameEl) nameEl.textContent = name;

  // Role check
  if (profile.role !== requiredRole) {
    console.warn("Role not admin, redirecting based on role:", profile.role);
    switch (profile.role) {
      case "teacher":
        window.location.href = "../teacher/index.html";
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

/**
 * Logout in header + drawer
 */
function setupLogout() {
  const btns = [
    document.getElementById("logoutBtn"),
    document.getElementById("logoutBtnMobile")
  ].filter(Boolean);

  btns.forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "../login.html";
    });
  });
}

/**
 * Summary cards
 */
async function loadSummaryCards() {
  const todayCountEl = document.getElementById("admin-today-count");
  const activeSlotsEl = document.getElementById("admin-active-slots");
  const pendingAvailEl = document.getElementById("admin-pending-avail");

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  // 今日の予約数
  const { data: todaysRes, error: resErr } = await supabase
    .from("reservations")
    .select("id, slot_id, status, slot:slot_id(start_time)")
    .eq("status", "booked")
    .gte("slot.start_time", startOfDay)
    .lt("slot.start_time", endOfDay);

  if (!resErr && todaysRes && todayCountEl) {
    todayCountEl.textContent = String(todaysRes.length);
  }

  // 有効な予約枠
  const { data: activeSlots, error: slotErr } = await supabase
    .from("reservation_slots")
    .select("id")
    .eq("is_active", true)
    .gte("start_time", new Date().toISOString());

  if (!slotErr && activeSlots && activeSlotsEl) {
    activeSlotsEl.textContent = String(activeSlots.length);
  }

  // 未承認の講師スケジュール
  const { data: pendingAvail, error: availErr } = await supabase
    .from("teacher_availabilities")
    .select("id")
    .eq("status", "pending");

  if (!availErr && pendingAvail && pendingAvailEl) {
    pendingAvailEl.textContent = String(pendingAvail.length);
  }
}

/**
 * Teacher availabilities table
 */
async function loadTeacherAvailabilities() {
  const tbody = document.getElementById("admin-availability-body");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='6'>読み込み中...</td></tr>";

  const { data, error } = await supabase
    .from("teacher_availabilities")
    .select("id, teacher_id, language, start_time, end_time, status, note")
    .order("start_time", { ascending: true })
    .limit(100);

  if (error) {
    console.error("loadTeacherAvailabilities error:", error);
    tbody.innerHTML = "<tr><td colspan='6'>読み込みエラー</td></tr>";
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>申請中のスケジュールはありません。</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  data.forEach(row => {
    const tr = document.createElement("tr");

    const start = formatDateTime(row.start_time);
    const end   = formatDateTime(row.end_time);

    tr.innerHTML = `
      <td>${shortId(row.teacher_id)}</td>
      <td>${row.language || ""}</td>
      <td>${start}</td>
      <td>${end}</td>
      <td>${statusBadge(row.status)}</td>
      <td>
        <button class="text-xs btn-primary px-2 py-1" data-action="make-slot" data-id="${row.id}">
          予約枠を作成
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // handle "make-slot" (simple prompt style)
  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='make-slot']");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (!id) return;

    const ok = window.confirm("この申請から予約枠を作成しますか？");
    if (!ok) return;

    await createSlotFromAvailability(parseInt(id, 10));
    await Promise.all([
      loadTeacherAvailabilities(),
      loadReservationSlots()
    ]);
  }, { once: true });
}

/**
 * Create reservation slot from teacher_availabilities (simple version)
 */
async function createSlotFromAvailability(availId) {
  const { data: avail, error } = await supabase
    .from("teacher_availabilities")
    .select("*")
    .eq("id", availId)
    .single();

  if (error || !avail) {
    alert("申請の取得に失敗しました。");
    return;
  }

  const capacity = window.prompt("この枠の定員を入力してください（例: 1）", "1");
  const capNum = capacity ? Number(capacity) : 1;

  const { error: insErr } = await supabase.from("reservation_slots").insert({
    teacher_id: avail.teacher_id,
    language: avail.language,
    start_time: avail.start_time,
    end_time: avail.end_time,
    capacity: capNum,
    is_active: true,
    source_availability_id: avail.id
  });

  if (insErr) {
    console.error("createSlotFromAvailability insert error:", insErr);
    alert("予約枠の作成に失敗しました。");
    return;
  }

  await supabase
    .from("teacher_availabilities")
    .update({ status: "approved" })
    .eq("id", avail.id);

  alert("予約枠を作成しました。");
}

/**
 * Reservation slots table
 */
async function loadReservationSlots() {
  const tbody = document.getElementById("admin-slots-body");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='7'>読み込み中...</td></tr>";

  const { data, error } = await supabase
    .from("reservation_slots")
    .select("id, teacher_id, language, start_time, end_time, capacity, is_active")
    .order("start_time", { ascending: true })
    .limit(200);

  if (error) {
    console.error("loadReservationSlots error:", error);
    tbody.innerHTML = "<tr><td colspan='7'>読み込みエラー</td></tr>";
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>予約枠がありません。</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  data.forEach(row => {
    const tr = document.createElement("tr");
    const start = formatDateTime(row.start_time);
    const end   = formatDateTime(row.end_time);
    const state = row.is_active ? "有効" : "停止中";

    tr.innerHTML = `
      <td>${shortId(row.teacher_id)}</td>
      <td>${row.language || ""}</td>
      <td>${start}</td>
      <td>${end}</td>
      <td>${row.capacity ?? ""}</td>
      <td>${state}</td>
      <td>
        <button class="text-xs px-2 py-1 border rounded" data-action="toggle" data-id="${row.id}">
          切り替え
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-action='toggle']");
    if (!btn) return;
    const id = parseInt(btn.getAttribute("data-id"), 10);
    const row = data.find(r => r.id === id);
    if (!row) return;

    const { error: updErr } = await supabase
      .from("reservation_slots")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);

    if (updErr) {
      console.error("toggle slot error:", updErr);
      alert("状態の更新に失敗しました。");
      return;
    }
    await loadReservationSlots();
  }, { once: true });
}

/**
 * Reservations overview table
 */
async function loadReservations() {
  const tbody = document.getElementById("admin-reservation-body");
  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='6'>読み込み中...</td></tr>";

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id,
      status,
      created_at,
      slot:slot_id (
        start_time,
        end_time,
        language,
        teacher_id
      ),
      student_id
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("loadReservations error:", error);
    tbody.innerHTML = "<tr><td colspan='6'>読み込みエラー</td></tr>";
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>予約はまだありません。</td></tr>";
    return;
  }

  tbody.innerHTML = "";
  data.forEach(row => {
    const slot = row.slot || {};
    const date = slot.start_time ? formatDateOnly(slot.start_time) : "";
    const time = slot.start_time ? formatTimeRange(slot.start_time, slot.end_time) : "";
    const lang = slot.language || "";
    const teacherLabel = shortId(slot.teacher_id);
    const studentLabel = shortId(row.student_id);
    const statusLabel = row.status === "booked" ? "予約中" : "キャンセル";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${date}</td>
      <td>${time}</td>
      <td>${lang}</td>
      <td>${teacherLabel}</td>
      <td>${studentLabel}</td>
      <td>${statusLabel}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Simple prompt-based slot add (no availability)
 */
async function handleAddSlotPrompt() {
  const teacherId = window.prompt("講師の user_id を入力してください（開発用）", "");
  if (!teacherId) return;
  const language  = window.prompt("言語（例: Spanish）", "Spanish") || "Spanish";
  const date      = window.prompt("日付（YYYY-MM-DD）", "");
  const startTime = window.prompt("開始時間（HH:MM）", "19:00");
  const endTime   = window.prompt("終了時間（HH:MM）", "20:00");
  const capacity  = Number(window.prompt("定員（例: 1）", "1") || "1");

  if (!date || !startTime || !endTime) {
    alert("日付と時間は必須です。");
    return;
  }

  const startIso = new Date(`${date}T${startTime}:00`).toISOString();
  const endIso   = new Date(`${date}T${endTime}:00`).toISOString();

  const { error } = await supabase.from("reservation_slots").insert({
    teacher_id: teacherId,
    language,
    start_time: startIso,
    end_time: endIso,
    capacity,
    is_active: true
  });

  if (error) {
    console.error("add slot error:", error);
    alert("予約枠の追加に失敗しました。");
    return;
  }
  alert("予約枠を追加しました。");
  await loadReservationSlots();
}

/* ========= Helpers ========= */

function shortId(id) {
  if (!id) return "";
  return String(id).slice(0, 6) + "…";
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${h}:${min}`;
}

function formatDateOnly(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatTimeRange(startIso, endIso) {
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

function statusBadge(status) {
  if (status === "approved") return "承認済み";
  if (status === "rejected") return "却下";
  return "未承認";
}
