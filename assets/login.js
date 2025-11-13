// assets/login.js
// assets/login.js
const { createClient } = window.supabase;

console.log("✅ login.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🌐 DOM is ready!");

  const SUPABASE_URL  = "https://dsbvgomhugvjruqykbmr.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, detectSessionInUrl: true }
  });

  const idEl = document.getElementById("identifier");
  const pwEl = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const statusEl = document.getElementById("status");
  const togglePw = document.getElementById("togglePw");

  console.log("🔘 Waiting for button click...");


const setStatus = (msg, isError = false) => {
  statusEl.textContent = msg;
  statusEl.classList.toggle("text-red-600", isError);
  statusEl.classList.toggle("text-slate-600", !isError);
};

const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

async function resolveToEmail(identifier) {
  // Email login or username login
  if (isEmail(identifier)) return identifier.toLowerCase();
  const { data, error } = await supabase.rpc("resolve_identifier_email", { p_identifier: identifier });
  if (error || !data) throw new Error("User ID not found.");
  return data;
}

async function getUserRole(userId) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", userId)
    .single();
  if (error || !data?.role) throw new Error("Unable to get role.");
  return data.role;
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    const role = await getUserRole(data.user.id);

    // redirect logic
    const u = new URL(window.location.href);
    const redirect = u.searchParams.get("redirect");
    if (redirect) return (window.location.href = redirect);

    switch (role) {
  case "teacher":  window.location.href = "/teacher/index.html";  break;
  case "admin":    window.location.href = "/admin/index.html";    break;
  case "student":  window.location.href = "/student/index.html";  break;
  default:         window.location.href = "/student/index.html";  break;
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

// Mobile drawer (same logic as other pages)
const drawer   = document.querySelector("[data-drawer]");
const openBtn  = document.querySelector("[data-drawer-open]");
const closeBtn = document.querySelector("[data-drawer-close]");
const backdrop = document.querySelector("[data-backdrop]");
if (openBtn && drawer && backdrop) {
  const openDrawer = () => { drawer.classList.replace("drawer-hidden","drawer-visible"); backdrop.classList.replace("backdrop-hidden","backdrop-visible"); };
  const closeDrawer= () => { drawer.classList.replace("drawer-visible","drawer-hidden"); backdrop.classList.replace("backdrop-visible","backdrop-hidden"); };
  openBtn.addEventListener("click", openDrawer);
  (closeBtn||document).addEventListener("click", (e)=>{ if (e.target?.hasAttribute?.("data-drawer-close")) closeDrawer(); });
  backdrop.addEventListener("click", closeDrawer);
}
});

