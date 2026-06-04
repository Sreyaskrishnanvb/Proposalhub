/* ════════════════════════════════════════
   ProposalHub — login.js
   Handles login, register, redirect
════════════════════════════════════════ */

let loginRole = 'student';
let regRole   = 'student';

/* ── Tab switch ── */
function switchTab(tab) {
  document.getElementById('tabLogin').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
  document.getElementById('formLogin').classList.toggle('active', tab === 'login');
  document.getElementById('formRegister').classList.toggle('active', tab === 'register');
  document.getElementById('authTitle').textContent = tab === 'login' ? 'Welcome back' : 'Create account';
  document.getElementById('authSub').textContent   = tab === 'login' ? 'Sign in to your account' : 'Fill in your details below';
  clearErrors();
}

/* ── Role selector ── */
function setRole(el, form) {
  const parent = form === 'login' ? '#formLogin' : '#formRegister';
  document.querySelectorAll(`${parent} .role-opt`).forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  if (form === 'login') loginRole = el.dataset.role;
  else                   regRole   = el.dataset.role;
}

/* ── Password toggle ── */
function togglePw(id, btn) {
  const input = document.getElementById(id);
  input.type  = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

/* ── Clear errors ── */
function clearErrors() {
  document.getElementById('loginError').textContent    = '';
  document.getElementById('registerError').textContent = '';
  document.querySelectorAll('.err').forEach(el => el.classList.remove('err'));
}

function setError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
}

function markErr(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('err');
}

/* ── LOGIN ── */
async function handleLogin() {
  clearErrors();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const course   = document.getElementById('loginCourse').value;

  let valid = true;
  if (!username) { markErr('loginUsername'); valid = false; }
  if (!password) { markErr('loginPassword'); valid = false; }
  if (!course)   { markErr('loginCourse');   valid = false; }
  if (!valid)    { setError('loginError', '⚠️ Please fill in all fields.'); return; }

  const btn = document.querySelector('#formLogin .btn-auth');
  btn.textContent = 'Signing in…';
  btn.disabled = true;

  try {
    const res = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, course, role: loginRole })
    });

    const data = await res.json();

    if (!res.ok) {
      setError('loginError', '❌ ' + data.error);
      btn.innerHTML = '<span>Login</span> <span class="btn-arrow">→</span>';
      btn.disabled = false;
      return;
    }

    // Save session
    localStorage.setItem('ph_token',    data.token);
    localStorage.setItem('ph_role',     data.role);
    localStorage.setItem('ph_username', data.username);
    window.location.href = 'index.html';

  } catch {
    setError('loginError', '❌ Could not connect to server.');
    btn.innerHTML = '<span>Login</span> <span class="btn-arrow">→</span>';
    btn.disabled = false;
  }
}

/* ── REGISTER ── */
async function handleRegister() {
  clearErrors();

  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const confirm  = document.getElementById('regConfirmPassword').value.trim();
  const course   = document.getElementById('regCourse').value;
  const doj      = document.getElementById('regDoj').value;

  let valid = true;
  if (!username) { markErr('regUsername');        valid = false; }
  if (!email)    { markErr('regEmail');           valid = false; }
  if (!password) { markErr('regPassword');        valid = false; }
  if (!confirm)  { markErr('regConfirmPassword'); valid = false; }
  if (!course)   { markErr('regCourse');          valid = false; }
  if (!doj)      { markErr('regDoj');             valid = false; }
  if (!valid)    { setError('registerError', '⚠️ Please fill in all fields.'); return; }

  if (password !== confirm) {
    markErr('regPassword'); markErr('regConfirmPassword');
    setError('registerError', '❌ Passwords do not match.'); return;
  }
  if (password.length < 6) {
    markErr('regPassword');
    setError('registerError', '❌ Password must be at least 6 characters.'); return;
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    markErr('regEmail');
    setError('registerError', '❌ Enter a valid email address.'); return;
  }

  const btn = document.querySelector('#formRegister .btn-auth');
  btn.textContent = 'Creating account…';
  btn.disabled = true;

  try {
    const res = await fetch('http://localhost:5000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, course, doj, role: regRole })
    });

    const data = await res.json();

    if (!res.ok) {
      setError('registerError', '❌ ' + data.error);
      btn.innerHTML = '<span>Create Account</span> <span class="btn-arrow">→</span>';
      btn.disabled = false;
      return;
    }

    // Auto login after register
    const loginRes = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, course, role: regRole })
    });

    const loginData = await loginRes.json();

    const errEl = document.getElementById('registerError');
    errEl.style.color = 'var(--green)';
    errEl.textContent = '✅ Account created! Redirecting…';

    localStorage.setItem('ph_token',    loginData.token);
    localStorage.setItem('ph_role',     loginData.role);
    localStorage.setItem('ph_username', loginData.username);

    setTimeout(() => window.location.href = 'index.html', 1200);

  } catch {
    setError('registerError', '❌ Could not connect to server.');
    btn.innerHTML = '<span>Create Account</span> <span class="btn-arrow">→</span>';
    btn.disabled = false;
  }
}

/* ── On page load: if already logged in, redirect ── */
window.addEventListener('DOMContentLoaded', () => {
  const role = localStorage.getItem('ph_role');
  if (role) window.location.href = 'index.html';
});