// assets/register.js

// 1) Initialize Supabase
// 👉 Use the SAME values you already use in login.js
const SUPABASE_URL = 'https://YOUR-PROJECT-ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) Registration flow:
// - signUp in auth.users
// - insert into user_profiles (role = 'student')
// - insert into students (using user_profile_id)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registerForm');
  const btn = document.getElementById('registerBtn');
  const statusEl = document.getElementById('registerStatus');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = '';
    btn.disabled = true;

    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const language = document.getElementById('language').value || null;
    const level = document.getElementById('level').value || null;
    const notes = document.getElementById('notes').value.trim() || null;

    if (!fullName || !email || !password) {
      statusEl.textContent = '必須項目を入力してください。';
      btn.disabled = false;
      return;
    }

    try {
      // 1) Create auth user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        console.error('signUpError', signUpError);
        statusEl.textContent = '登録に失敗しました：' + signUpError.message;
        btn.disabled = false;
        return;
      }

      const user = signUpData.user;
      if (!user) {
        statusEl.textContent = '登録に失敗しました。もう一度お試しください。';
        btn.disabled = false;
        return;
      }

      // 2) Insert into user_profiles (role = student)
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          role: 'student',
          login_id: email,       // you can change this to something else later
          display_name: fullName,
        })
        .select('id')
        .single();

      if (profileError) {
        console.error('profileError', profileError);
        statusEl.textContent =
          'プロフィール作成に失敗しました。運営までお問い合わせください。';
        btn.disabled = false;
        return;
      }

      const userProfileId = profileData.id;

      // 3) Insert into students (link via user_profile_id)
      const { error: studentError } = await supabase.from('students').insert({
        user_profile_id: userProfileId,
        name: fullName,           // existing column
        full_name: fullName,      // new detailed name column
        preferred_language: language,
        level: level,
        notes: notes,
        // birthday is optional; can be added later if you put it in the form
      });

      if (studentError) {
        console.error('studentError', studentError);
        statusEl.textContent =
          '生徒情報の保存に失敗しました。運営までお問い合わせください。';
        btn.disabled = false;
        return;
      }

      // Everything OK
      statusEl.textContent =
        '登録が完了しました！確認メールをご確認のうえ、ログインしてください。';

      // Optional: redirect to login after a short delay
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'エラーが発生しました。時間をおいて再度お試しください。';
      btn.disabled = false;
    }
  });
});
