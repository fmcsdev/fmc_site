// assets/register.js

// 1) Initialize Supabase (anon key is OK on frontend)
const SUPABASE_URL = 'https://dsbvgomhugvjruqykbmr.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzYnZnb21odWd2anJ1cXlrYm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzIwNzksImV4cCI6MjA3ODQ0ODA3OX0.FHX45XbBfpeNtnnCLc9wvoyxOM6w2vIIjOcIZWfb-_I';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ register.js loaded v2');

  const form = document.getElementById('registerForm');
  const btn = document.getElementById('registerBtn');
  const statusEl = document.getElementById('registerStatus');

  if (!form) return;

  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg || '';
  };

  const getVal = (id) => document.getElementById(id)?.value ?? '';
  const getTrim = (id) => (document.getElementById(id)?.value || '').trim();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');
    if (btn) btn.disabled = true;

    // Required
    const fullName = getTrim('fullName');
    const email = getTrim('email');
    const password = getVal('password');

    if (!fullName || !email || !password) {
      setStatus('必須項目を入力してください。');
      if (btn) btn.disabled = false;
      return;
    }

    // Optional fields
    const romajiName = getTrim('romajiName') || null;

    const ageRaw = getVal('age');
    const age = ageRaw ? Number(ageRaw) : null;
    const safeAge = Number.isFinite(age) ? age : null;

    const gender = getVal('gender') || null;
    const birthday = getVal('birthday') || null;

    const phone = getTrim('phone') || null;
    const address = getTrim('address') || null;

    const course = getVal('course') || null;
    const classType = getVal('classType') || null;

    const lessonLengthRaw = getVal('lessonLength');
    const lessonLengthMin = lessonLengthRaw ? Number(lessonLengthRaw) : null;
    const safeLessonLength = Number.isFinite(lessonLengthMin) ? lessonLengthMin : null;

    const term = getVal('term') || null;

    const komaRaw = getVal('koma');
    const koma = komaRaw ? Number(komaRaw) : null;
    const safeKoma = Number.isFinite(koma) ? koma : null;

    const preferredDays = Array.from(document.querySelectorAll('.dayChk:checked')).map(
      (x) => x.value
    );

    const preferredTime = getTrim('preferredTime') || null;

    const language = getVal('language') || null;
    const level = getVal('level') || null;

    const goal = getTrim('goal') || null;
    const textbook = getTrim('textbook') || null;
    const notes = getTrim('notes') || null;

    const paymentMethod = getVal('payment') || null;
    const joinEvents = getVal('joinEvents') || null;

    // ✅ This metadata is what the DB trigger will copy into user_profiles/students
    const meta = {
      full_name: fullName,
      romaji_name: romajiName,
      age: safeAge,
      gender,
      birthday,
      phone,
      address,

      course,
      class_type: classType,
      lesson_length_min: safeLessonLength,
      term,
      koma: safeKoma,

      preferred_days: preferredDays,
      preferred_time: preferredTime,

      preferred_language: language,
      level,
      goal,
      textbook,
      payment_method: paymentMethod,
      join_events: joinEvents,
      notes,
    };

    try {
      setStatus('登録中...');

      console.log('Submitting signUp:', { email, meta });

      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: meta,
          // ✅ change this to your actual Netlify domain (important for email links)
          emailRedirectTo: 'https://fmc-site.vercel.app/login.html',
        },
      });

      console.log('signUp result:', { data, error });

      if (error) throw error;

      // When email confirmation is ON, session is usually null here (that’s normal).
      setStatus('登録が完了しました！確認メールをご確認のうえ、ログインしてください。');

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } catch (err) {
      console.error('❌ Register error:', err);
      setStatus('エラー: ' + (err?.message || '不明なエラー'));
    } finally {
      if (btn) btn.disabled = false;
    }
  });
});
