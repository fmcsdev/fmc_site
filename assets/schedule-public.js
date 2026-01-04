/* assets/schedule-public.js
   Public schedule (before login):
   - Shows course cards + available slots (table)
   - Shows available slots in FullCalendar
   - Clicking "Reserve" or calendar event redirects to login.html with redirect back + slot id
*/

const { createClient } = window.supabase;

const SUPABASE_URL  = "https://dsbvgomhugvjruqykbmr.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I"; // <- same as admin.js

const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

const courseRoot = document.getElementById("public-course-schedules");
const calEl = document.getElementById("publicCalendar");

function esc(s="") {
  return String(s)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}
function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function loginUrlWithRedirect(extraParams = {}) {
  // Redirect back to schedule after login
  const redirect = encodeURIComponent("/schedule.html");
  const qs = new URLSearchParams({ redirect: "/schedule.html", ...extraParams });
  // keep consistent with your existing login redirect logic:
  // login.html?redirect=/schedule.html&slot=xxx
  return `login.html?${qs.toString()}`;
}

async function fetchPublicCourses() {
  const { data, error } = await sb
    .from("courses")
    .select("id, title_ja, duration_min, language, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchActiveFutureSlots() {
  const { data, error } = await sb
    .from("reservation_slots")
    .select("id, course_id, start_time, end_time, capacity, status")
    .eq("status", "active")
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

function renderCourseCards(courses, slots) {
  if (!courseRoot) return;

  const byCourse = new Map();
  slots.forEach(s => {
    if (!byCourse.has(s.course_id)) byCourse.set(s.course_id, []);
    byCourse.get(s.course_id).push(s);
  });

  courseRoot.innerHTML = "";

  if (!courses.length) {
    courseRoot.innerHTML = `<div class="card">現在公開中のコースがありません。</div>`;
    return;
  }

  courses.forEach(c => {
    const list = byCourse.get(c.id) || [];

    const card = document.createElement("div");
    card.className = "schedule-block mb-6";

    card.innerHTML = `
      <div class="schedule-headbar">
        <div>
          <h3 class="font-extrabold text-lg">${esc(c.title_ja)}（${esc(c.duration_min)}分）</h3>
          <p class="text-xs text-slate-500 mt-1">${esc(c.language || "")}</p>
        </div>
        <div class="chips">
          <span class="chip">${esc(c.duration_min)}分</span>
          <a class="btn-primary text-xs px-3 py-2" href="${loginUrlWithRedirect()}">
            予約する（ログイン）
          </a>
        </div>
      </div>

      <div class="table-wrap">
        ${
          list.length
            ? `
              <table class="schedule-table text-sm w-full">
                <thead>
                  <tr>
                    <th class="schedule-head">日付</th>
                    <th class="schedule-head">開始</th>
                    <th class="schedule-head">終了</th>
                    <th class="schedule-head">定員</th>
                    <th class="schedule-head">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${list.map(s => `
                    <tr>
                      <td>${esc(fmtDate(s.start_time))}</td>
                      <td>${esc(fmtTime(s.start_time))}</td>
                      <td>${esc(fmtTime(s.end_time))}</td>
                      <td>${esc(s.capacity ?? 1)}</td>
                      <td>
                        <a class="btn-outline text-xs px-3 py-2 inline-block"
                           href="${loginUrlWithRedirect({ slot: s.id })}">
                          予約する
                        </a>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            `
            : `<div class="p-4 text-sm text-slate-600">現在このコースの予約枠はありません。</div>`
        }
      </div>
    `;

    courseRoot.appendChild(card);
  });
}

function buildCourseLabelMap(courses) {
  const map = {};
  courses.forEach(c => {
    const title = (c.title_ja || "").trim();
    const dur = c.duration_min != null ? `${c.duration_min}分` : "";
    map[c.id] = title ? (dur ? `${title}（${dur}）` : title) : (dur || "コース");
  });
  return map;
}

function renderCalendar(courses, slots) {
  if (!calEl || !window.FullCalendar) return;

  const courseLabel = buildCourseLabelMap(courses);

  const events = slots.map(s => {
    const label = courseLabel[s.course_id] || "予約枠";
    const start = s.start_time;
    const end = s.end_time;

    return {
      id: s.id,
      title: label,
      start,
      end,
      // active slots only; keep a consistent color
      backgroundColor: "#3b82f6",
      borderColor: "#3b82f6",
      textColor: "#ffffff",
      extendedProps: { slotId: s.id, courseId: s.course_id }
    };
  });

  const calendar = new FullCalendar.Calendar(calEl, {
    initialView: "timeGridWeek",
    height: "auto",
    locale: "ja",
    nowIndicator: true,
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "dayGridMonth,timeGridWeek,timeGridDay"
    },
    slotMinTime: "08:00:00",
    slotMaxTime: "23:00:00",
    eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
    events,
    eventClick: (info) => {
      const slotId = info.event.id;
      // Go to login with redirect back + slot id
      window.location.href = loginUrlWithRedirect({ slot: slotId });
    }
  });

  calendar.render();
}

async function initPublicSchedule() {
  // Loading placeholders
  if (courseRoot) courseRoot.innerHTML = `<div class="card">読み込み中...</div>`;
  if (calEl) calEl.innerHTML = `<div class="card">読み込み中...</div>`;

  const [courses, slots] = await Promise.all([
    fetchPublicCourses(),
    fetchActiveFutureSlots()
  ]);

  // Clear calendar placeholder and render properly
  if (calEl) calEl.innerHTML = "";
  renderCalendar(courses, slots);

  // Render course tables/cards
  renderCourseCards(courses, slots);

  // If no slots, show a friendly message under calendar
  if (calEl && slots.length === 0) {
    calEl.innerHTML = `<div class="card text-slate-600">現在、予約可能な枠がありません。</div>`;
  }
}

initPublicSchedule().catch(err => {
  console.error(err);
  if (courseRoot) courseRoot.innerHTML = `<div class="card text-red-600">読み込みに失敗しました：${esc(err.message || err)}</div>`;
  if (calEl) calEl.innerHTML = `<div class="card text-red-600">読み込みに失敗しました：${esc(err.message || err)}</div>`;
});
