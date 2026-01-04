// assets/admin.js
// Admin dashboard: view teacher availabilities + slots & (later) reservations
// STATUS-SAFE: works even if reservation_slots.status does NOT exist.

const { createClient: createClientAdmin } = window.supabase;

const SUPABASE_URL_A  = "https://dsbvgomhugvjruqykbmr.supabase.co";
const SUPABASE_ANON_A = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

const supabaseA = createClientAdmin(SUPABASE_URL_A, SUPABASE_ANON_A, {
  auth: { persistSession: true, detectSessionInUrl: true }
});

// Cache whether reservation_slots.status exists
let RES_SLOTS_HAS_STATUS = null;

document.addEventListener("DOMContentLoaded", () => {
  initAdmin().catch(err => {
    console.error("Admin init error:", err);
    alert("管理者ページの読み込み中にエラーが発生しました。");
  });
});

async function initAdmin() {
  await requireAuthAdmin("admin");
  setupLogoutAdmin();

  // detect status column once
  await detectReservationSlotStatusColumn();

  // Optional: if your HTML includes the modal for adding slots, enable it
  setupAddSlotModal();

  await Promise.all([
    loadTeacherAvailabilitiesForAdmin(),
    loadSlotsForAdmin()
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
    switch (profile.role) {
      case "teacher":   window.location.href = "../teacher/index.html"; break;
      case "student":   window.location.href = "../student/index.html"; break;
      case "guardian":  window.location.href = "../guardian/index.html"; break;
      default:          window.location.href = "../login.html"; break;
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
 * Detect if reservation_slots.status exists.
 * We do this by attempting a select that includes status.
 */
async function detectReservationSlotStatusColumn() {
  if (RES_SLOTS_HAS_STATUS !== null) return RES_SLOTS_HAS_STATUS;

  const { error } = await supabaseA
    .from("reservation_slots")
    .select("id, status")
    .limit(1);

  if (error && isMissingColumnError(error)) {
    RES_SLOTS_HAS_STATUS = false;
  } else if (error) {
    // Unknown error. Don't assume status exists.
    console.warn("detectReservationSlotStatusColumn unexpected error:", error);
    RES_SLOTS_HAS_STATUS = false;
  } else {
    RES_SLOTS_HAS_STATUS = true;
  }
  return RES_SLOTS_HAS_STATUS;
}

function isMissingColumnError(err) {
  const msg = String(err?.message || err || "");
  const code = String(err?.code || "");
  return code === "42703" || msg.includes('column "status" does not exist');
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

  const teacherIds = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
  const teacherNameMap = await fetchTeacherNames(teacherIds);

  tbody.innerHTML = "";
  let pendingCount = 0;
  let approvedCount = 0;
  let todayReservationsCount = 0;

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
        <button class="btn-xs btn-outline" data-action="approve-avail" data-id="${row.id}">承認</button>
        <button class="btn-xs btn-ghost text-slate-500 ml-1" data-action="reject-avail" data-id="${row.id}">却下</button>
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

    const approveBtn = tr.querySelector('[data-action="approve-avail"]');
    const rejectBtn  = tr.querySelector('[data-action="reject-avail"]');
    const slotBtn    = tr.querySelector('[data-action="create-slot"]');

    approveBtn?.addEventListener("click", async () => {
      const ok = await updateAvailabilityStatus(row.id, "approved");
      if (ok) await loadTeacherAvailabilitiesForAdmin();
      window.__adminCalendarRefetch?.();
    });

    rejectBtn?.addEventListener("click", async () => {
      const ok = await updateAvailabilityStatus(row.id, "rejected");
      if (ok) await loadTeacherAvailabilitiesForAdmin();
      window.__adminCalendarRefetch?.();
    });

    slotBtn?.addEventListener("click", async () => {
      const capacityStr = window.prompt("この予約枠の定員を入力してください（例：3）", "1");
      if (capacityStr === null) return;
      const capacity = parseInt(capacityStr, 10);
      if (!Number.isFinite(capacity) || capacity <= 0) {
        alert("有効な定員を入力してください。");
        return;
      }

      const ok = await createSlotFromAvailability({
        teacher_id: row.teacher_id,
        language: row.language,
        start_time: row.start_time,
        end_time: row.end_time,
        capacity
      });

      if (ok) {
        await loadSlotsForAdmin();
        window.__adminCalendarRefetch?.();
        alert("予約枠を作成しました。");
      }
    });
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

  const { data, error } = await supabaseA
    .from("user_profiles")
    .select("id, user_id, login_id, display_name")
    .in("user_id", teacherIds);

  if (error) {
    console.warn("fetchTeacherNames error:", error);
    return map;
  }

  (data || []).forEach(row => {
    const label =
      (row.display_name && row.display_name.trim()) ||
      (row.login_id && row.login_id.trim()) ||
      shortIdA(row.user_id || row.id);

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

/** Create reservation_slots row from a teacher availability row (status-safe) */
async function createSlotFromAvailability(avail) {
  try {
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

    // Build insert payload
    const payload = {
      teacher_id: avail.teacher_id,
      language: avail.language,
      start_time: avail.start_time,
      end_time: avail.end_time,
      capacity: avail.capacity
    };

    // only include status if column exists
    if (RES_SLOTS_HAS_STATUS) payload.status = "active";

    let ins = await supabaseA.from("reservation_slots").insert(payload);

    // If our detection was wrong, retry without status
    if (ins.error && isMissingColumnError(ins.error)) {
      RES_SLOTS_HAS_STATUS = false;
      delete payload.status;
      ins = await supabaseA.from("reservation_slots").insert(payload);
    }

    if (ins.error) {
      console.error("createSlotFromAvailability insert error:", ins.error);
      alert("予約枠の作成に失敗しました。");
      return false;
    }

    return true;
  } catch (e) {
    console.error("createSlotFromAvailability unexpected error:", e);
    return false;
  }
}

/**
 * Load all reservation slots that students can book (admin view) (status-safe)
 */
async function loadSlotsForAdmin() {
  const tbody = document.getElementById("admin-slots-body");
  if (!tbody) return;

  // your table has 8 columns in admin/index.html, but fallback is ok
  tbody.innerHTML = "<tr><td colspan='8'>読み込み中...</td></tr>";

  // Build select list
  const baseCols = "id, teacher_id, language, start_time, end_time, capacity";
  const cols = RES_SLOTS_HAS_STATUS ? `${baseCols}, status` : baseCols;

  let res = await supabaseA
    .from("reservation_slots")
    .select(cols)
    .order("start_time", { ascending: true });

  // If status missing, retry without it
  if (res.error && isMissingColumnError(res.error)) {
    RES_SLOTS_HAS_STATUS = false;
    res = await supabaseA
      .from("reservation_slots")
      .select(baseCols)
      .order("start_time", { ascending: true });
  }

  const { data, error } = res;

  if (error) {
    console.error("loadSlotsForAdmin error:", error);
    tbody.innerHTML = "<tr><td colspan='8' class='text-red-500'>読み込みエラー</td></tr>";
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = "<tr><td colspan='8'>まだ予約枠は作成されていません。</td></tr>";
    return;
  }

  const teacherIds = [...new Set(data.map(r => r.teacher_id).filter(Boolean))];
  const teacherNameMap = await fetchTeacherNames(teacherIds);

  tbody.innerHTML = "";

  data.forEach(row => {
    const teacherName = teacherNameMap[row.teacher_id] || shortIdA(row.teacher_id);
    const dateStr     = formatDateOnlyA(row.start_time);
    const timeRange   = formatTimeRangeA(row.start_time, row.end_time);

    // if no status column, pretend active
    const statusValue = RES_SLOTS_HAS_STATUS ? (row.status || "active") : "active";

    const statusLabel = statusValue === "active"
      ? "公開中"
      : statusValue === "closed"
      ? "停止中"
      : "下書き";

    const canToggle = RES_SLOTS_HAS_STATUS;
    const toggleLabel = statusValue === "active" ? "停止" : "公開";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${teacherName}</td>
      <td>${row.language || ""}</td>
      <td>—</td>
      <td>${dateStr} ${timeRange}</td>
      <td>${dateStr} ${formatTimeRangeA(row.start_time, row.end_time)}</td>
      <td>${row.capacity ?? 1}</td>
      <td>${statusLabel}</td>
      <td>
        ${
          canToggle
            ? `<button class="btn-xs btn-outline"
                  data-action="toggle-slot-status"
                  data-id="${row.id}"
                  data-status="${statusValue}">
                  ${toggleLabel}
               </button>`
            : `<span class="text-xs text-slate-400">（status未対応）</span>`
        }
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
          window.__adminCalendarRefetch?.();
        }
      });
    }
  });
}

/** Update reservation slot status (公開 / 停止) (status-safe) */
async function updateSlotStatus(slotId, newStatus) {
  if (!RES_SLOTS_HAS_STATUS) {
    alert("reservation_slots に status カラムが無いため、公開/停止の切替はできません。");
    return false;
  }

  let res = await supabaseA
    .from("reservation_slots")
    .update({ status: newStatus })
    .eq("id", slotId);

  if (res.error && isMissingColumnError(res.error)) {
    RES_SLOTS_HAS_STATUS = false;
    alert("reservation_slots に status カラムが無いようです。");
    return false;
  }

  if (res.error) {
    console.error("updateSlotStatus error:", res.error);
    alert("予約枠の状態更新に失敗しました。");
    return false;
  }
  return true;
}

/* ===== Add Slot Modal (optional) =====
   Works if your admin/index.html contains the modal IDs:
   slotModal, slotModalClose, slotCancel, slotSave
   slotTeacherId, slotLanguage, slotCourseId, slotStart, slotEnd, slotCapacity, slotStatus
*/
function setupAddSlotModal() {
  const openBtn = document.getElementById("admin-add-slot");
  const modal   = document.getElementById("slotModal");
  if (!openBtn || !modal) return; // modal not present -> ignore

  const closeX  = document.getElementById("slotModalClose");
  const cancel  = document.getElementById("slotCancel");
  const save    = document.getElementById("slotSave");

  const teacherIdEl = document.getElementById("slotTeacherId");
  const langEl      = document.getElementById("slotLanguage");
  const courseEl    = document.getElementById("slotCourseId");
  const startEl     = document.getElementById("slotStart");
  const endEl       = document.getElementById("slotEnd");
  const capEl       = document.getElementById("slotCapacity");
  const statusEl    = document.getElementById("slotStatus");

  const open  = () => { modal.classList.remove("modal-hidden"); document.body.style.overflow = "hidden"; };
  const close = () => { modal.classList.add("modal-hidden"); document.body.style.overflow = ""; };

  openBtn.addEventListener("click", async () => {
    open();
    await loadCoursesIntoModal(courseEl);
    if (!RES_SLOTS_HAS_STATUS && statusEl) statusEl.disabled = true;
  });

  closeX?.addEventListener("click", close);
  cancel?.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    if (e.target === modal.firstElementChild) close();
  });

  save?.addEventListener("click", async () => {
    const teacher_id = (teacherIdEl?.value || "").trim();
    const language   = (langEl?.value || "").trim();
    const course_id  = (courseEl?.value || "").trim() || null;

    const startLocal = startEl?.value;
    const endLocal   = endEl?.value;

    const capacity = parseInt(capEl?.value || "1", 10);
    const status   = statusEl?.value || "active";

    if (!teacher_id) return alert("teacher_id を入力してください。");
    if (!startLocal || !endLocal) return alert("開始/終了を入力してください。");
    if (!Number.isFinite(capacity) || capacity <= 0) return alert("定員が不正です。");

    const start_time = new Date(startLocal).toISOString();
    const end_time   = new Date(endLocal).toISOString();
    if (new Date(end_time) <= new Date(start_time)) return alert("終了時間は開始時間より後にしてください。");

    const { data: existing, error: exErr } = await supabaseA
      .from("reservation_slots")
      .select("id")
      .eq("teacher_id", teacher_id)
      .eq("start_time", start_time);

    if (exErr) {
      console.error(exErr);
      return alert("重複チェックに失敗しました。");
    }
    if (existing && existing.length) return alert("同じ時間帯の予約枠が既に存在します。");

    const payload = {
      teacher_id,
      language,
      course_id,
      start_time,
      end_time,
      capacity
    };
    if (RES_SLOTS_HAS_STATUS) payload.status = status;

    let ins = await supabaseA.from("reservation_slots").insert(payload);

    if (ins.error && isMissingColumnError(ins.error)) {
      RES_SLOTS_HAS_STATUS = false;
      delete payload.status;
      ins = await supabaseA.from("reservation_slots").insert(payload);
    }

    if (ins.error) {
      console.error("insert slot error:", ins.error);
      return alert("保存に失敗しました。reservation_slots のカラム名を確認してください。");
    }

    close();
    await loadSlotsForAdmin();
    window.__adminCalendarRefetch?.();
    alert("予約枠を追加しました。");
  });
}

async function loadCoursesIntoModal(courseSelectEl) {
  if (!courseSelectEl) return;

  courseSelectEl.innerHTML = `<option value="">読み込み中...</option>`;

  const { data, error } = await supabaseA
    .from("courses")
    .select("id, title_ja, duration_min, sort_order")
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("load courses error:", error);
    courseSelectEl.innerHTML = `<option value="">（読み込み失敗）</option>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    courseSelectEl.innerHTML = `<option value="">（コースなし）</option>`;
    return;
  }

  courseSelectEl.innerHTML =
    `<option value="">（コース未設定）</option>` +
    rows.map(c => {
      const title = (c.title_ja || "コース");
      const dur = c.duration_min != null ? `（${c.duration_min}分）` : "";
      return `<option value="${c.id}">${title}${dur}</option>`;
    }).join("");
}

/* ===== helpers ===== */

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

function todayStringA() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}
async function createSlotsFromTemplates({
  rangeStartDate,   // "2026-01-05"
  rangeEndDate,     // "2026-01-11"
  weekdays,         // [0..6] where 0=Sun ... 6=Sat
  teacher_id,
  language,
  course_id = null,
  capacity = 1,
  slotType = null,  // null = all, or "class"/"reservation"
  status = "active"
}) {
  // 1) load templates
  let q = supabaseA
    .from("time_slot_templates")
    .select("id, start_local, end_local, slot_type, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (slotType) q = q.eq("slot_type", slotType);

  const { data: templates, error: tErr } = await q;
  if (tErr) throw tErr;
  if (!templates?.length) {
    alert("テンプレの時間枠がありません。time_slot_templates を確認してください。");
    return;
  }

  // 2) build inserts
  const start = new Date(rangeStartDate + "T00:00:00");
  const end   = new Date(rangeEndDate + "T00:00:00");

  const inserts = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (!weekdays.includes(dow)) continue;

    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    for (const t of templates) {
      // t.start_local comes like "13:30:00"
      const start_time = new Date(`${dateStr}T${t.start_local}+09:00`).toISOString();
      const end_time   = new Date(`${dateStr}T${t.end_local}+09:00`).toISOString();

      inserts.push({
        teacher_id,
        language,
        course_id,
        capacity,
        status,
        template_id: t.id,
        start_time,
        end_time
      });
    }
  }

  if (!inserts.length) {
    alert("作成する枠がありません（曜日/日付を確認）");
    return;
  }

  // 3) insert (best effort)
  const { error: insErr } = await supabaseA.from("reservation_slots").insert(inserts);
  if (insErr) {
    console.error(insErr);
    alert("枠の作成に失敗しました。重複や制約を確認してください。");
    return;
  }

  alert(`予約枠を作成しました（${inserts.length}件）`);
  await loadSlotsForAdmin();
  window.__adminCalendarRefetch?.();
}
