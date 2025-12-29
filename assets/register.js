const SUPABASE_URL = 'https://dsbvgomhugvjruqykbmr.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const btn = document.getElementById('registerBtn');
  const statusEl = document.getElementById('registerStatus');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    btn.disabled = true;

    const fullName = document.getElementById('fullName')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    const language = document.getElementById('language')?.value || null;
    const level = document.getElementById('level')?.value || null;
    const notes = document.getElementById('notes')?.value.trim() || null;

    // Extra fields (from your paper form)
    const romajiName = document.getElementById('romajiName')?.value.trim() || null;
    const age = Number(document.getElementById('age')?.value) || null;
    const gender = document.getElementById('gender')?.value || null;
    const birthday = document.getElementById('birthday')?.value || null;
    const phone = document.getElementById('phone')?.value.trim() || null;
    const address = document.getElementById('address')?.value.trim() || null;

    const course = document.getElementById('course')?.value.trim() || null;
    const classType = document.getElementById('classType')?.value || null;
    const lessonLength = Number(document.getElementById('lessonLength')?.value) || null;
    const term = document.getElementById('term')?.value || null;

    const days = Array.from(document.querySelectorAll('.dayChk:checked')).map(x => x.value);

    const goal = document.getElementById('goal')?.value.trim() || null;
    const textbook = document.getElementById('textbook')?.value.trim() || null;
    const payment = document.getElementById('payment')?.value || null;
    const joinEvents = document.getElementById('joinEvents')?.value || null;

    if (!fullName || !email || !password) {
      statusEl.textContent = '必須項目を入力してください。';
      btn.disabled = false;
      return;
    }

    try {
      statusEl.textContent = '登録中...';

      // 1) Create auth user ✅ (use supabaseClient)
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) throw signUpError;

      const user = signUpData.user;
      if (!user) throw new Error('User creation failed.');

      // 2) Insert into user_profiles ✅
      const { data: profileData, error: profileError } = await supabaseClient
        .from('user_profiles')
        .insert({
          user_id: user.id,
          role: 'student',
          login_id: email,
          display_name: fullName,
        })
        .select('id')
        .single();

      if (profileError) throw profileError;

      const userProfileId = profileData.id;

      // 3) Insert into students ✅
      // Store all the extra “paper-form” data as JSON for now
      const applicationJson = {
        romaji_name: romajiName,
        age,
        gender,
        birthday,
        phone,
        address,
        course,
        class_type: classType,
        lesson_length_min: lessonLength,
        term,
        preferred_days: days,
        goal,
        textbook,
        payment_method: payment,
        join_events: joinEvents,
      };

      const { error: studentError } = await supabaseClient.from('students').insert({
        user_profile_id: userProfileId,
        name: fullName,
        full_name: fullName,
        preferred_language: language,
        level: level,
        notes: notes,
        application_json: applicationJson, // 👈 you need this column
      });

      if (studentError) throw studentError;

      statusEl.textContent = '登録が完了しました！確認メールをご確認のうえ、ログインしてください。';

      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'エラー: ' + (err?.message ?? '不明なエラー');
      btn.disabled = false;
    } finally {
      btn.disabled = false;
    }
  });
});
