// assets/login.js
const { createClient } = window.supabase;

console.log("✅ login.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 DOM is ready!");

  const SUPABASE_URL  = "https://dsbvgomhugvjruqykbmr.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

  // ✅ IMPORTANT: Use a unique variable name to avoid collisions with window.supabase
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, detectSessionInUrl: true }
  });

  const idEl = document.getElementById("identifier");
  const pwEl = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const statusEl = document.getElementById("status");
  const togglePw = document.getElementById("togglePw");

  const setStatus = (msg, isError = false) => {
    statusEl.textContent = msg;
    statusEl.classList.toggle("text-red-600", isError);
    statusEl.classList.toggle("text-slate-600", !isError);
  };

  const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  async function resolveToEmail(identifier) {
    if (isEmail(identifier)) return identifier.toLowerCase();

    const { data, error } = await sb.rpc("resolve_identifier_email", { p_identifier: identifier });
    if (error || !data) throw new Error("User ID not found.");
    return data;
  }

  async function getUserRole(userId) {
    const { data, error } = await sb
      .from("user_profiles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error || !data?.role) throw new Error("Unable to get role.");
    return data.role;
  }

  async function getStudentStatus(userId) {
    const { data, error } = await sb
      .from("user_profiles")
      .select("entrance_fee_paid")
      .eq("user_id", userId)
      .single();

    // If the column doesn't exist yet, you'll get an error here.
    if (error) throw new Error("Unable to get student status.");
    return { entrance_fee_paid: !!data?.entrance_fee_paid };
  }

  function safeRedirectFromQuery() {
    const u = new URL(window.location.href);
    const redirect = u.searchParams.get("redirect");
    // ✅ only allow internal redirects
    if (redirect && redirect.startsWith("/")) return redirect;
    return null;
  }

  async function login() {
    const identifier = (idEl.value || "").trim();
    const password = pwEl.value || "";

    if (!identifier) return setStatus("Enter your user ID or email.", true);
    if (!password) return setStatus("Enter your password.", true);

    loginBtn.disabled = true;
    setStatus("Authenticating...");

    try {
      const email = await resolveToEmail(identifier);

      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);

      const role = await getUserRole(data.user.id);

      // redirect logic (safe)
      const forced = safeRedirectFromQuery();
      if (forced) {
        window.location.href = forced;
        return;
      }

      switch (role) {
        case "teacher":
          window.location.href = "/teacher/dashboard.html";
          return;

        case "admin":
          window.location.href = "/admin/dashboard.html";
          return;

        case "student": {
          const status = await getStudentStatus(data.user.id);

          if (status.entrance_fee_paid) {
            window.location.href = "/student/student-dashboard.html";
          } else {
            // ✅ FIXED PATH
            window.location.href = "/student/student-pre-entrance.html";
          }
          return;
        }

        default:
          window.location.href = "/student/student-dashboard.html";
          return;
      }

    } catch (e) {
      setStatus(`Error: ${e.message}`, true);
      loginBtn.disabled = false;
    }
  }

  loginBtn.addEventListener("click", login);
  idEl.addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  pwEl.addEventListener("keydown", e => { if (e.key === "Enter") login(); });

  if (togglePw) {
    togglePw.addEventListener("click", () => {
      const type = pwEl.type === "password" ? "text" : "password";
      pwEl.type = type;
      togglePw.textContent = type === "password" ? "👁" : "🙈";
    });
  }

  // Mobile drawer (your existing logic)
  const drawer   = document.querySelector("[data-drawer]");
  const openBtn  = document.querySelector("[data-drawer-open]");
  const closeBtn = document.querySelector("[data-drawer-close]");
  const backdrop = document.querySelector("[data-backdrop]");

  if (openBtn && drawer && backdrop) {
    const openDrawer = () => {
      drawer.classList.replace("drawer-hidden", "drawer-visible");
      backdrop.classList.replace("backdrop-hidden", "backdrop-visible");
    };
    const closeDrawer = () => {
      drawer.classList.replace("drawer-visible", "drawer-hidden");
      backdrop.classList.replace("backdrop-visible", "backdrop-hidden");
    };
    openBtn.addEventListener("click", openDrawer);
    (closeBtn || document).addEventListener("click", (e) => {
      if (e.target?.hasAttribute?.("data-drawer-close")) closeDrawer();
    });
    backdrop.addEventListener("click", closeDrawer);
  }
});
