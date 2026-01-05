// assets/admin.js
// Admin dashboard: teacher availabilities + reservation slots
// ✅ reservation_slots.teacher_id = teachers.id (NOT auth.users, NOT user_profiles)

const supabaseA = window.supabaseClient;

document.addEventListener("DOMContentLoaded", () => {
  initAdmin().catch(err => {
    console.error("Admin init error:", err);
    alert("管理者ページの読み込み中にエラーが発生しました。");
  });
});

async function initAdmin() {
  await requireAuthAdmin("admin");
  setupLogoutAdmin();
  setupAddSlotButton();

  await Promise.all([
    loadTeacherAvailabilitiesForAdmin(),
    loadSlotsForAdmin()
  ]);
}

/* =========================
   Auth / Role
========================= */

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

/* =========================
   Teacher Availabilities
   (still auth-based in your current schema)
========================= */

async function loadTeacherAvailabilitiesForAdmin() {
  const tbody       = document.getElementById("admin-availability-body");
  const pendingEl   = document.getElementById("admin-pending-avail");
  const activeSlots = document.getElementById("admin-active-slots");
  const todayCount  = document.getElementById("admin-today-count");

  if (!tbody) return;
  tbody.innerHTML = "<tr><td colspan='6'>読み込み中...</td></tr>";

  // NOTE: teacher_availabilities.teacher_id may be auth.user_id in your current setup.
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
  const teacherNameMap = await fetchAuthTeacherNames(teacherIds);

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
      todayReservationsCount++; // placeholder
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
      <td>${escapeHtml(teacherName)}</td>
      <td>${escapeHtml(row.language || "")}</td>
      <td>${escapeHtml(formatDateOnlyA(row.start_time))} ${escapeHtml(timeRange)}</td>
      <td>${escapeHtml(formatDateOnlyA(row.end_time))} ${escapeHtml(formatTimeRangeA(row.start_time, row.end_time))}</td>
      <td>${escapeHtml(statusLabel)}</td>
      <td>
        <button class="btn-xs btn-outline" data-action="approve-avail" data-id="${row.id}">承認</button>
        <button class="btn-xs btn-ghost text-slate-500 ml-1" data-action="reject-avail" data-id="${row.id}">却下</button>
        <button
          class="btn-xs btn-primary ml-2"
          data-action="create-slot"
          data-start="${row.start_time}"
          data-end="${row.end_time}"
          data-language="${row.language || ""}"
        >予約枠を作成</button>
      </td>
    `;
    tbody.appendChild(tr);

    tr.querySelector('[data-action="approve-avail"]')?.addEventListener("click", async () => {
      const ok = await updateAvailabilityStatus(row.id, "approved");
      if (ok) await loadTeacherAvailabilitiesForAdmin();
    });

    tr.querySelector('[data-action="reject-avail"]')?.addEventListener("click", async () => {
      const ok = await updateAvailabilityStatus(row.id, "rejected");
      if (ok) await loadTeacherAvailabilitiesForAdmin();
    });

    tr.querySelector('[data-action="create-slot"]')?.addEventListener("click", async () => {
      const defaults = {
        teacher_id: "",
        course_id: "",
        language: row.language || "",
        start_time: row.start_time,
        end_time: row.end_time,
        capacity: 1,
        status: "active"
      };

      const result = await openSlotModal(defaults);
      if (!result) return;

      const ok = await createReservationSlot(result);
      if (ok) {
        await loadSlotsForAdmin();
        alert("予約枠を作成しました。");
        window.__adminCalendarRefetch?.();
      }
    });
  });

  if (pendingEl)   pendingEl.textContent   = String(pendingCount);
  if (activeSlots) activeSlots.textContent = String(approvedCount);
  if (todayCount)  todayCount.textContent  = String(todayReservationsCount);
}

async function fetchAuthTeacherNames(authTeacherIds) {
  const map = {};
  if (!authTeacherIds.length) return map;

  const { data, error } = await supabaseA
    .from("user_profiles")
    .select("user_id, login_id, display_name")
    .in("user_id", authTeacherIds);

  if (error) {
    console.warn("fetchAuthTeacherNames error:", error);
    return map;
  }

  data.forEach(row => {
    const label =
      (row.display_name && row.display_name.trim()) ||
      (row.login_id && row.login_id.trim()) ||
      shortIdA(row.user_id);

    if (row.user_id) map[row.user_id] = label;
  });

  return map;
}

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

/* =========================
   Reservation Slots (teacher_id = teachers.id)
========================= */

async function loadSlotsForAdmin() {
  const tbody = document.getElementById("admin-slots-body");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='8'>読み込み中...</td></tr>";

  // status optional (schema compatibility)
  let res = await supabaseA
    .from("reservation_slots")
    .select("id, teacher_id, language, course_id, start_time, end_time, capacity, status")
    .order("start_time", { ascending: true });

  if (res.error && /status/i.test(res.error.message || "")) {
    res = await supabaseA
      .from("reservation_slots")
      .select("id, teacher_id, language, course_id, start_time, end_time, capacity")
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
  const teacherNameMap = await fetchTeacherNamesFromTeachers(teacherIds);

  tbody.innerHTML = "";

  data.forEach(row => {
    const teacherName = teacherNameMap[row.teacher_id] || shortIdA(row.teacher_id);
    const dateStr     = formatDateOnlyA(row.start_time);
    const timeRange   = formatTimeRangeA(row.start_time, row.end_time);

    const hasStatus = ("status" in row);
    const statusVal = hasStatus ? row.status : "active";
    const statusLabel =
      statusVal === "active" ? "公開中" :
      statusVal === "closed" ? "停止中" :
      "下書き";

    const toggleLabel = statusVal === "active" ? "停止" : "公開";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(teacherName)}</td>
      <td>${escapeHtml(row.language || "")}</td>
      <td>${escapeHtml(row.course_id || "")}</td>
      <td>${escapeHtml(dateStr)} ${escapeHtml(timeRange)}</td>
      <td>${escapeHtml(dateStr)} ${escapeHtml(formatTimeRangeA(row.start_time, row.end_time))}</td>
      <td>${row.capacity ?? 1}</td>
      <td>${escapeHtml(statusLabel)}</td>
      <td>
        ${hasStatus ? `
          <button
            class="btn-xs btn-outline"
            data-action="toggle-slot-status"
            data-id="${row.id}"
            data-status="${statusVal}"
          >${toggleLabel}</button>
        ` : `<span class="text-xs text-slate-400">status未対応</span>`}
      </td>
    `;
    tbody.appendChild(tr);

    if (hasStatus) {
      tr.querySelector('[data-action="toggle-slot-status"]')?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const current = btn.dataset.status || "active";
        const next = current === "active" ? "closed" : "active";
        const ok = await updateSlotStatus(row.id, next);
        if (ok) await loadSlotsForAdmin();
      });
    }
  });
}

async function fetchTeacherNamesFromTeachers(teacherIds) {
  const map = {};
  if (!teacherIds.length) return map;

  const { data, error } = await supabaseA
    .from("teachers")
    .select("id, display_name")
    .in("id", teacherIds);

  if (error) {
    console.warn("fetchTeacherNamesFromTeachers error:", error);
    return map;
  }

  data.forEach(t => {
    map[t.id] = t.display_name || shortIdA(t.id);
  });

  return map;
}

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

/* =========================
   Create Slot Modal
========================= */

let __teachersCache = null;
let __coursesCache  = null;

async function fetchTeachersActive() {
  if (__teachersCache) return __teachersCache;

  const { data, error } = await supabaseA
    .from("teachers")
    .select("id, display_name")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) throw error;
  __teachersCache = data || [];
  return __teachersCache;
}

async function fetchCoursesActive() {
  if (__coursesCache) return __coursesCache;

  const { data, error } = await supabaseA
    .from("courses")
    .select("id, title_ja, duration_min")
    .eq("is_active", true)
    .order("title_ja", { ascending: true });

  if (error) throw error;
  __coursesCache = data || [];
  return __coursesCache;
}

function setupAddSlotButton() {
  const btn = document.getElementById("admin-add-slot");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const defaults = {
      teacher_id: "",
      course_id: "",
      language: "",
      start_time: new Date(`${dateStr}T13:30:00+09:00`).toISOString(),
      end_time: new Date(`${dateStr}T14:15:00+09:00`).toISOString(),
      capacity: 1,
      status: "active"
    };

    const result = await openSlotModal(defaults);
    if (!result) return;

    const ok = await createReservationSlot(result);
    if (ok) {
      await loadSlotsForAdmin();
      alert("予約枠を追加しました。");
      window.__adminCalendarRefetch?.();
    }
  });
}

async function openSlotModal(defaults) {
  // Always recreate modal cleanly if structure is broken
  let modal = document.getElementById("slotModal");
  if (modal) modal.remove();

  modal = document.createElement("div");
  modal.id = "slotModal";
  modal.className = "fixed inset-0 z-[60] hidden";
  modal.innerHTML = `
    <div class="absolute inset-0 bg-black/40"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4">
      <div class="w-full max-w-xl bg-white rounded-2xl border border-slate-200 shadow-xl">
        <div class="px-4 py-3 border-b flex items-center justify-between">
          <div class="font-bold">予約枠の作成 / 編集</div>
          <button type="button" class="p-2 rounded hover:bg-slate-100" data-close>×</button>
        </div>

        <div class="p-4 grid gap-3">
          <div class="grid md:grid-cols-2 gap-3">
            <label class="text-sm">
              <div class="text-xs text-slate-500 mb-1">講師</div>
              <select class="w-full border rounded-lg px-3 py-2" data-field="teacher"></select>
            </label>
            <label class="text-sm">
              <div class="text-xs text-slate-500 mb-1">コース</div>
              <select class="w-full border rounded-lg px-3 py-2" data-field="course"></select>
            </label>
          </div>

          <div class="grid md:grid-cols-3 gap-3">
            <label class="text-sm">
              <div class="text-xs text-slate-500 mb-1">言語（表示用）</div>
              <input class="w-full border rounded-lg px-3 py-2" data-field="language" placeholder'例：スペイン語'>
            </label>
            <label class="text-sm">
              <div class="text-xs text-slate-500 mb-1">定員</div>
              <input type="number" min="1" class="w-full border rounded-lg px-3 py-2" data-field="capacity" value="1">
            </label>
            <label class="text-sm">
              <div class="text-xs text-slate-500 mb-1">状態</div>
              <select class="w-full border rounded-lg px-3 py-2" data-field="status">
                <option value="active">公開中</option>
                <option value="closed">停止中</option>
                <option value="draft">下書き</option>
              </select>
            </label>
          </div>

          <div class="grid md:grid-cols-2 gap-3">
            <label class="text-sm">
              <div class="text-xs text-slate-500 mb-1">開始（JST）</div>
              <input type="datetime-local" class="w-full border rounded-lg px-3 py-2" data-field="start">
            </label>
            <label class="text-sm">
              <div class="text-xs text-slate-500 mb-1">終了（JST）</div>
              <input type="datetime-local" class="w-full border rounded-lg px-3 py-2" data-field="end">
            </label>
          </div>

          <div class="text-xs text-slate-500">
            ※ ここで作成した枠が、学生側の「予約可能枠」になります（status=active のみ公開）。
          </div>
        </div>

        <div class="px-4 py-3 border-t flex items-center justify-end gap-2">
          <button class="btn-outline text-xs px-3 py-2" data-close>キャンセル</button>
          <button class="btn-primary text-xs px-3 py-2" data-save>保存</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const backdrop = modal.firstElementChild;
  modal.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => hideModal(modal));
  });
  modal.addEventListener("click", (e) => {
    if (e.target === backdrop) hideModal(modal);
  });

  // Load teacher/course lists
  const [teachers, courses] = await Promise.all([fetchTeachersActive(), fetchCoursesActive()]);

  const teacherSel = modal.querySelector('[data-field="teacher"]');
  const courseSel  = modal.querySelector('[data-field="course"]');

  if (!teacherSel || !courseSel) {
    console.error("Modal fields missing");
    alert("モーダルの初期化に失敗しました（フィールドが見つかりません）。");
    hideModal(modal);
    return null;
  }

  teacherSel.innerHTML = `
    <option value="">選択してください</option>
    ${teachers.map(t => `<option value="${t.id}">${escapeHtml(t.display_name)}</option>`).join("")}
  `;
  courseSel.innerHTML = `
    <option value="">選択してください</option>
    ${courses.map(c => `<option value="${c.id}">${escapeHtml(c.title_ja)}（${c.duration_min}分）</option>`).join("")}
  `;

  // Fill defaults
  teacherSel.value = defaults.teacher_id || "";
  courseSel.value  = defaults.course_id || "";

  modal.querySelector('[data-field="language"]').value = defaults.language || "";
  modal.querySelector('[data-field="capacity"]').value = String(defaults.capacity ?? 1);
  modal.querySelector('[data-field="status"]').value = defaults.status || "active";

  modal.querySelector('[data-field="start"]').value = toDatetimeLocalJST(defaults.start_time);
  modal.querySelector('[data-field="end"]').value   = toDatetimeLocalJST(defaults.end_time);

  return new Promise((resolve) => {
    const saveBtn = modal.querySelector("[data-save]");

    const onSave = () => {
      const teacher_id = teacherSel.value;       // ✅ teachers.id
      const course_id  = courseSel.value;

      const language = modal.querySelector('[data-field="language"]').value.trim();
      const capacity = parseInt(modal.querySelector('[data-field="capacity"]').value, 10) || 1;
      const status   = modal.querySelector('[data-field="status"]').value;

      const startLocal = modal.querySelector('[data-field="start"]').value;
      const endLocal   = modal.querySelector('[data-field="end"]').value;

      if (!teacher_id) { alert("講師を選択してください。"); return; }
      if (!course_id)  { alert("コースを選択してください。"); return; }
      if (!startLocal || !endLocal) { alert("開始と終了を入力してください。"); return; }

      const start_time = fromDatetimeLocalJST(startLocal);
      const end_time   = fromDatetimeLocalJST(endLocal);

      if (new Date(end_time) <= new Date(start_time)) {
        alert("終了は開始より後にしてください。");
        return;
      }

      hideModal(modal);
      resolve({ teacher_id, course_id, language, capacity, status, start_time, end_time });
    };

    saveBtn.addEventListener("click", onSave, { once: true });

    showModal(modal);

    const cancelHandler = () => {
      if (modal.classList.contains("hidden")) return;
      hideModal(modal);
      resolve(null);
    };

    modal.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", cancelHandler, { once: true });
    });
  });
}

function showModal(modal) {
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function hideModal(modal) {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

/* =========================
   Insert slot (teacher_id = teachers.id)
========================= */

async function createReservationSlot(payload) {
  // best-effort duplicate check (teacher_id + start_time)
  const { data: existing, error: exErr } = await supabaseA
    .from("reservation_slots")
    .select("id")
    .eq("teacher_id", payload.teacher_id)
    .eq("start_time", payload.start_time);

  if (exErr) {
    console.error("check existing slot error:", exErr);
    alert("重複チェックに失敗しました。");
    return false;
  }
  if (existing && existing.length > 0) {
    alert("同じ時間帯の予約枠が既に存在します。");
    return false;
  }

  const { error } = await supabaseA
    .from("reservation_slots")
    .insert({
      teacher_id: payload.teacher_id,  // ✅ teachers.id
      course_id: payload.course_id,
      language: payload.language,
      start_time: payload.start_time,
      end_time: payload.end_time,
      capacity: payload.capacity,
      status: payload.status
    });

  if (error) {
    console.error("createReservationSlot error:", error);
    alert("予約枠の作成に失敗しました。");
    return false;
  }
  return true;
}

/* =========================
   Helpers
========================= */

function shortIdA(id) {
  if (!id) return "";
  return String(id).slice(0, 6) + "…";
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
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

function toDatetimeLocalJST(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function fromDatetimeLocalJST(localValue) {
  return new Date(localValue + ":00+09:00").toISOString();
}
