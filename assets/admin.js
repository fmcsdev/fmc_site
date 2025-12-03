// assets/admin.js
// Admin dashboard: view teacher availabilities + (later) slots & reservations

const { createClient: createClientAdmin } = window.supabase;

const SUPABASE_URL_A  = "https://dsbvgomhugvjruqykbmr.supabase.co";
const SUPABASE_ANON_A = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

const supabaseA = createClientAdmin(SUPABASE_URL_A, SUPABASE_ANON_A, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

document.addEventListener("DOMContentLoaded", () => {
  initAdmin().catch(err => {
    console.error("Admin init error:", err);
    alert("管理者ページの読み込み中にエラーが発生しました。");
  });
});

async function initAdmin() {
  const user = await requireAuthAdmin("admin");
  setupLogoutAdmin();

  await Promise.all([
    loadTeacherAvailabilitiesForAdmin(),
    loadSlotsForAdmin()
    // later: loadReservationsForAdmin()
  ]);
}


/**
 * Require auth + admin role
 */
async function requireAuthAdmin(requiredRole) {
  const { data, error } = await supabaseA.auth.getUser();
  if (error || !data.user) {
    window.location.href = "../login.html?redirect=" + encodeURIComponent(window.location.pathname);
    throw new Error("Not logged in");
  }
  const user = data.user;

  const { data: profile, error: profileErr } = await supabaseA
    .from("user_profiles")
    .select("role, login_id")
    .eq("user_id", user.id)
    .single();

  if (profileErr || !profile) {
    console.error("Admin profile error:", profileErr);
    window.location.href = "../login.html";
    throw new Error("Profile not found");
  }

  const name = profile.login_id || user.email || "Admin";
  const nameEl = document.getElementById("userDisplayName");
  if (nameEl) nameEl.textContent = name;

  if (profile.role !== requiredRole) {
    // send them to correct dashboard
    switch (profile.role) {
      case "teacher":
        window.location.href = "../teacher/index.html";
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

function setupLogoutAdmin() {
  const btns = [
    document.getElementById("logoutBtn"),
    document.getElementById("logoutBtnMobile")
  ].filter(Boolean);

  btns.forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseA.auth.signOut();
      window.location.href = "../login.html";
    });
  });
}

/**
 * Load all teacher availabilities for admin view
 */
async function loadTeacherAvailabilitiesForAdmin() {
  const tbody       = document.getElementById("admin-availability-body");
  const pendingEl   = document.getElementById("admin-pending-avail");
  const activeSlots = document.getElementById("admin-active-slots");
  const todayCount  = document.getElementById("admin-today-count");

  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='6'>読み込み中...</td></tr>";

  const { data, error } = await supabaseA
    .from("teacher_availabilities")
    .select("id, teacher_id, language, start_time, end_time, status")
    .order("start_time", { ascending: true });

  if (error) {
    console.error("loadTeacherAvailabilitiesForAdmin error:", error);
    tbody.innerHTML = "<tr><td colspan='6' class='text-red-500'>読み込みエラー</td></tr>";
    if (pendingEl)   pendingEl.textContent = "0";
    if (activeSlots) activeSlots.textContent = "0";
    if (todayCount)  todayCount.textContent = "0";
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6'>まだ講師からのスケジュール申請はありません。</td></tr>";
    if (pendingEl)   pendingEl.textContent = "0";
    if (activeSlots) activeSlots.textContent = "0";
    if (todayCount)  todayCount.textContent = "0";
    return;
  }

  // Map teacher_id -> name (login_id) for display
  const teacherIds = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
  const teacherNameMap = await fetchTeacherNames(teacherIds);

  tbody.innerHTML = "";
  let pendingCount = 0;
  let approvedCount = 0;
  let todayReservationsCount = 0; // TODO: later connect to reservations table

  const todayStr = todayStringA();

  data.forEach(row => {
  if (row.status === "pending") pendingCount++;
  if (row.status === "approved") approvedCount++;

  const startDateStr = formatDateOnlyA(row.start_time);
  if (startDateStr === todayStr && row.status === "approved") {
    todayReservationsCount++; // 仮
  }

  const teacherName = teacherNameMap[row.teacher_id] || shortIdA(row.teacher_id);
  const timeRange   = formatTimeRangeA(row.start_time, row.end_time);
  const statusLabel = row.status === "approved"
    ? "承認済み"
    : row.status === "rejected"
    ? "却下"
    : "承認待ち";

  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${teacherName}</td>
    <td>${row.language || ""}</td>
    <td>${formatDateOnlyA(row.start_time)} ${timeRange}</td>
    <td>${formatDateOnlyA(row.end_time)} ${formatTimeRangeA(row.start_time, row.end_time)}</td>
    <td>${statusLabel}</td>
    <td>
      <button
        class="btn-xs btn-outline"
        data-action="approve-avail"
        data-id="${row.id}"
      >承認</button>
      <button
        class="btn-xs btn-ghost text-slate-500 ml-1"
        data-action="reject-avail"
        data-id="${row.id}"
      >却下</button>
      <button
        class="btn-xs btn-primary ml-2"
        data-action="create-slot"
        data-id="${row.id}"
        data-teacher-id="${row.teacher_id}"
        data-language="${row.language || ""}"
        data-start="${row.start_time}"
        data-end="${row.end_time}"
      >予約枠を作成</button>
    </td>
  `;
  tbody.appendChild(tr);

  // Attach handlers
  const approveBtn = tr.querySelector('[data-action="approve-avail"]');
  const rejectBtn  = tr.querySelector('[data-action="reject-avail"]');
  const slotBtn    = tr.querySelector('[data-action="create-slot"]');

  if (approveBtn) {
    approveBtn.addEventListener("click", async () => {
      const ok = await updateAvailabilityStatus(row.id, "approved");
      if (ok) await loadTeacherAvailabilitiesForAdmin();
    });
  }

  if (rejectBtn) {
    rejectBtn.addEventListener("click", async () => {
      const ok = await updateAvailabilityStatus(row.id, "rejected");
      if (ok) await loadTeacherAvailabilitiesForAdmin();
    });
  }

  if (slotBtn) {
    slotBtn.addEventListener("click", async () => {
      const capacityStr = window.prompt("この予約枠の定員を入力してください（例：3）", "1");
      if (capacityStr === null) return; // cancelled
      const capacity = parseInt(capacityStr, 10);
      if (!Number.isFinite(capacity) || capacity <= 0) {
        alert("有効な定員を入力してください。");
        return;
      }
      const ok = await createSlotFromAvailability({
        id: row.id,
        teacher_id: row.teacher_id,
        language: row.language,
        start_time: row.start_time,
        end_time: row.end_time,
        capacity
      });
      if (ok) {
        await loadSlotsForAdmin();
        alert("予約枠を作成しました。");
      }
    });
  }
});


  if (pendingEl)   pendingEl.textContent   = String(pendingCount);
  if (activeSlots) activeSlots.textContent = String(approvedCount);
  if (todayCount)  todayCount.textContent  = String(todayReservationsCount);
}

/**
 * Get teacher names from user_profiles
 */
async function fetchTeacherNames(teacherIds) {
  const map = {};
  if (!teacherIds.length) return map;

  console.log("teacherIds used for name lookup:", teacherIds);

  const { data, error } = await supabaseA
    .from("user_profiles")
    .select("id, user_id, login_id, display_name")
    .in("user_id", teacherIds);   // we'll also map by id just in case

  if (error) {
    console.warn("fetchTeacherNames error:", error);
    return map;
  }

  console.log("user_profiles rows for name mapping:", data);

  data.forEach(row => {
    const label =
      (row.display_name && row.display_name.trim()) ||
      (row.login_id && row.login_id.trim()) ||
      shortIdA(row.user_id || row.id);

    // map by both user_id and id so whichever matches teacher_id works
    if (row.user_id) map[row.user_id] = label;
    if (row.id)      map[row.id]      = label;
  });

  return map;
}
/** Update teacher_availabilities.status */
async function updateAvailabilityStatus(id, status) {
  const { error } = await supabaseA
    .from("teacher_availabilities")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("updateAvailabilityStatus error:", error);
    alert("スケジュールの状態更新に失敗しました。");
    return false;
  }
  return true;
}
/** Create reservation_slots row from a teacher availability row */
async function createSlotFromAvailability(avail) {
  try {
    // すでに同じ teacher_id + start_time の予約枠がないかチェック
    const { data: existing, error: exErr } = await supabaseA
      .from("reservation_slots")
      .select("id")
      .eq("teacher_id", avail.teacher_id)
      .eq("start_time", avail.start_time);

    if (exErr) {
      console.error("check existing slot error:", exErr);
      return false;
    }
    if (existing && existing.length > 0) {
      alert("同じ時間帯の予約枠が既に存在します。");
      return false;
    }

    const { error } = await supabaseA
      .from("reservation_slots")
      .insert({
        teacher_id: avail.teacher_id,
        language: avail.language,
        start_time: avail.start_time,
        end_time: avail.end_time,
        capacity: avail.capacity,
        status: "active"
      });

    if (error) {
      console.error("createSlotFromAvailability insert error:", error);
      alert("予約枠の作成に失敗しました。");
      return false;
    }

    return true;
  } catch (e) {
    console.error("createSlotFromAvailability unexpected error:", e);
    return false;
  }
}



/* ===== helpers (admin) ===== */

function shortIdA(id) {
  if (!id) return "";
  return String(id).slice(0, 6) + "…";
}

function formatDateOnlyA(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function formatTimeRangeA(startIso, endIso) {
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
/**
 * Load all reservation slots that students can book (admin view)
 */
async function loadSlotsForAdmin() {
  const tbody = document.getElementById("admin-slots-body");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='7'>読み込み中...</td></tr>";

  const { data, error } = await supabaseA
    .from("reservation_slots")
    .select("id, teacher_id, language, start_time, end_time, capacity, status")
    .order("start_time", { ascending: true });

  if (error) {
    console.error("loadSlotsForAdmin error:", error);
    tbody.innerHTML = "<tr><td colspan='7' class='text-red-500'>読み込みエラー</td></tr>";
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7'>まだ予約枠は作成されていません。</td></tr>";
    return;
  }

  // resolve teacher names
  const teacherIds = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
  const teacherNameMap = await fetchTeacherNames(teacherIds);

  tbody.innerHTML = "";
  data.forEach(row => {
    const teacherName = teacherNameMap[row.teacher_id] || shortIdA(row.teacher_id);
    const dateStr     = formatDateOnlyA(row.start_time);
    const timeRange   = formatTimeRangeA(row.start_time, row.end_time);
    const statusLabel = row.status === "active"
      ? "公開中"
      : row.status === "closed"
      ? "停止中"
      : "下書き";

    const toggleLabel = row.status === "active" ? "停止" : "公開";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${teacherName}</td>
      <td>${row.language || ""}</td>
      <td>${dateStr} ${timeRange}</td>
      <td>${dateStr} ${formatTimeRangeA(row.start_time, row.end_time)}</td>
      <td>${row.capacity ?? 1}</td>
      <td>${statusLabel}</td>
      <td>
        <button
          class="btn-xs btn-outline"
          data-action="toggle-slot-status"
          data-id="${row.id}"
          data-status="${row.status}"
        >
          ${toggleLabel}
        </button>
      </td>
    `;
    tbody.appendChild(tr);

    const toggleBtn = tr.querySelector('[data-action="toggle-slot-status"]');
    if (toggleBtn) {
      toggleBtn.addEventListener("click", async () => {
        const current = toggleBtn.dataset.status || "active";
        const next = current === "active" ? "closed" : "active";
        const ok = await updateSlotStatus(row.id, next);
        if (ok) {
          await loadSlotsForAdmin();
        }
      });
    }
  });
}

/** Update reservation slot status (公開 / 停止) */
async function updateSlotStatus(slotId, newStatus) {
  const { error } = await supabaseA
    .from("reservation_slots")
    .update({ status: newStatus })
    .eq("id", slotId);

  if (error) {
    console.error("updateSlotStatus error:", error);
    alert("予約枠の状態更新に失敗しました。");
    return false;
  }
  return true;
}

function todayStringA() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
