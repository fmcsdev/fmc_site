// assets/register.js

// 1) Initialize Supabase
const SUPABASE_URL = 'https://dsbvgomhugvjruqykbmr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const btn = document.getElementById('registerBtn');
  const statusEl = document.getElementById('registerStatus');

  if (!form) return;

  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg || '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');
    if (btn) btn.disabled = true;

    // --- Required fields ---
    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    // --- Optional fields from your form ---
    const language = document.getElementById('language')?.value || null;
    const level = document.getElementById('level')?.value || null;
    const notes = document.getElementById('notes')?.value.trim() || null;

    // Paper-form fields
    const romajiName = document.getElementById('romajiName')?.value.trim() || null;
    const ageRaw = document.getElementById('age')?.value;
    const age = ageRaw ? Number(ageRaw) : null;

    const gender = document.getElementById('gender')?.value || null;

    // students.birthday is DATE. Keep as 'YYYY-MM-DD' or null.
    const birthday = document.getElementById('birthday')?.value || null;

    const phone = document.getElementById('phone')?.value.trim() || null;
    const address = document.getElementById('address')?.value.trim() || null;

    // Course fields
    const course = document.getElementById('course')?.value || null; // select value
    const classType = document.getElementById('classType')?.value || null;
    const lessonLengthRaw = document.getElementById('lessonLength')?.value;
    const lessonLengthMin = lessonLengthRaw ? Number(lessonLengthRaw) : null;
    const term = document.getElementById('term')?.value || null;

    // Availability
    const preferredDays = Array.from(document.querySelectorAll('.dayChk:checked')).map(
      (x) => x.value
    );

    // Learning
    const goal = document.getElementById('goal')?.value.trim() || null;
    const textbook = document.getElementById('textbook')?.value.trim() || null;

    // Other
    const paymentMethod = document.getElementById('payment')?.value || null;
    const joinEvents = document.getElementById('joinEvents')?.value || null;

    // Basic validation
    if (!fullName || !email || !password) {
      setStatus('必須項目を入力してください。');
      if (btn) btn.disabled = false;
      return;
    }

    // Prevent NaN from being inserted
    const safeAge = Number.isFinite(age) ? age : null;
    const safeLessonLength = Number.isFinite(lessonLengthMin) ? lessonLengthMin : null;

    try {
      setStatus('登録中...');

      // 1) Create auth user
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) throw signUpError;

      const user = signUpData.user;
      if (!user) throw new Error('User creation failed (no user returned).');
      setStatus('登録が完了しました！確認メールをご確認のうえ、ログインしてください。');

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } catch (err) {
      console.error('Register error:', err);
      setStatus('エラー: ' + (err?.message || '不明なエラー'));
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});
