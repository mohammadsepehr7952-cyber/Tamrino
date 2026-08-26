import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---- Supabase config (Barbod_gym project) ----
const SUPABASE_URL = 'https://akragiujygurdhyqwxof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_JQHdwikpM4U9GQhiTQrs-Q_y07l-jFA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = document.getElementById('app');
let currentUser = null;
let timerInterval = null;

const toFaDigits = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
const todayISO = () => new Date().toISOString().slice(0, 10);

// index = JS Date.getDay() (0 = Sunday ... 6 = Saturday)
const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
// display order starting from Saturday (Persian week start)
const PERSIAN_WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

// Renders the avatar as an uploaded photo if the user has one, otherwise their initial letter.
function avatarHTML(user, name, extraClass = '', id = '') {
  const url = user?.user_metadata?.avatar_url;
  const idAttr = id ? `id="${id}"` : '';
  if (url) return `<img src="${url}" ${idAttr} class="avatar ${extraClass}" alt="${name}" />`;
  return `<div ${idAttr} class="avatar ${extraClass}">${name[0]?.toUpperCase() ?? '🙂'}</div>`;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// Enter key moves to the next input in the form; on the last one, it submits.
// Works with dynamically added rows (e.g. exercise rows) because it re-scans on every Enter press.
function enableEnterNav(container, submitBtn) {
  if (!container) return;
  container.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.tagName !== 'INPUT') return;
    e.preventDefault();
    const fields = Array.from(container.querySelectorAll('input'));
    const idx = fields.indexOf(e.target);
    if (idx > -1 && idx < fields.length - 1) {
      fields[idx + 1].focus();
    } else {
      submitBtn?.click();
    }
  });
}

function ring(pct, size, strokeColor, label, sub) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(pct, 100) / 100) * c;
  return `
    <div class="ring-wrap" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="#2C2C2E" stroke-width="6" fill="none"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${strokeColor}" stroke-width="6" fill="none"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
          style="transition: stroke-dashoffset 400ms ease"/>
      </svg>
      <div class="ring-label">
        <span class="pct mono">${label}</span>
        ${sub ? `<span class="sub">${sub}</span>` : ''}
      </div>
    </div>`;
}

// ---------------- AUTH SCREEN ----------------
function renderAuth(mode = 'signin') {
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-brand">
        <img src="logo.png" alt="Tamrino" class="brand-logo-img" />
        <p>برنامه تمرینت، دیگه رو کاغذ نه</p>
      </div>
      <div class="auth-card">
        <div class="field">
          <label>ایمیل</label>
          <input class="input" id="email" type="email" placeholder="you@example.com" />
        </div>
        <div class="field">
          <label>رمز عبور</label>
          <input class="input" id="password" type="password" placeholder="••••••••" />
        </div>
        <p class="error-text" id="authError"></p>
        <button class="btn-primary" id="authSubmit">${mode === 'signin' ? 'ورود' : 'ساخت حساب'}</button>
      </div>
      <div class="auth-toggle">
        <span>${mode === 'signin' ? 'حساب نداری؟' : 'قبلاً ثبت‌نام کردی؟'}</span>
        <button class="btn-ghost" id="authToggle">${mode === 'signin' ? 'ثبت‌نام کن' : 'وارد شو'}</button>
      </div>
    </div>`;

  document.getElementById('authToggle').onclick = () => renderAuth(mode === 'signin' ? 'signup' : 'signin');
  enableEnterNav(document.querySelector('.auth-card'), document.getElementById('authSubmit'));

  document.getElementById('authSubmit').onclick = async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errEl = document.getElementById('authError');
    errEl.textContent = '';
    if (!email || !password) { errEl.textContent = 'ایمیل و رمز رو وارد کن'; return; }

    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) { errEl.textContent = error.message; return; }
    if (mode === 'signup') toast('ثبت‌نام شد! اگه تایید ایمیل فعاله، ایمیلتو چک کن.');
  };
}

// ---------------- NAME PROMPT (first time only) ----------------
function renderNamePrompt() {
  app.innerHTML = `
    <div class="auth-screen">
      <div class="auth-brand">
        <div class="logo">👋</div>
        <h1>اسمت چیه؟</h1>
        <p>قبل از چیدن برنامه‌ی تمرین، بگو باهات چی صدات کنیم</p>
      </div>
      <div class="auth-card">
        <div class="field">
          <label>اسم</label>
          <input class="input" id="nameInput" placeholder="مثلاً باربد" />
        </div>
        <p class="error-text" id="nameError"></p>
        <button class="btn-primary" id="nameSubmit">ثبت و ادامه</button>
      </div>
    </div>`;
  enableEnterNav(document.querySelector('.auth-card'), document.getElementById('nameSubmit'));

  document.getElementById('nameSubmit').onclick = async () => {
    const val = document.getElementById('nameInput').value.trim();
    const errEl = document.getElementById('nameError');
    if (!val) { errEl.textContent = 'اسمتو بنویس'; return; }
    const { error } = await supabase.auth.updateUser({ data: { full_name: val } });
    if (error) { errEl.textContent = error.message; return; }
    renderApp();
  };
}

// ---------------- APP SHELL ----------------
async function renderApp() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  const name = user.user_metadata?.full_name;
  if (!name) { renderNamePrompt(); return; }

  app.innerHTML = `
    <div class="top-bar">
      ${avatarHTML(user, name, 'avatar-sm', 'avatarBtn')}
      <img src="logo.png" alt="Tamrino" class="top-bar-logo" />
      <button class="icon-btn" id="historyBtn" title="تاریخچه">🕘</button>
    </div>
    <div class="header">
      <div class="greeting">
        <h2>سلام، ${name}</h2>
        <p id="dateLabel"></p>
        <p id="programLabel" class="program-label"></p>
      </div>
    </div>
    <div id="content"></div>
  `;
  document.getElementById('dateLabel').textContent = new Date().toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
  const programLabel = programStatusLabel(user);
  const programLabelEl = document.getElementById('programLabel');
  if (programLabel) { programLabelEl.textContent = programLabel; } else { programLabelEl.remove(); }

  document.getElementById('avatarBtn').onclick = () => openProfileSheet(name);
  document.getElementById('historyBtn').onclick = () => renderHistory();

  await loadToday();
}

// Computes "هفته X از برنامه Y هفته‌ای" from the user's stored program settings.
function programStatusLabel(user) {
  const weeks = user.user_metadata?.program_weeks;
  const start = user.user_metadata?.program_start_date;
  if (!weeks || !start) return null;
  const startDate = new Date(start + 'T00:00:00');
  const today = new Date(todayISO() + 'T00:00:00');
  const diffDays = Math.floor((today - startDate) / 86400000);
  const currentWeek = Math.floor(diffDays / 7) + 1;
  if (currentWeek < 1) return null;
  return `هفته ${toFaDigits(currentWeek)} از برنامه‌ی ${toFaDigits(weeks)} هفته‌ای`;
}

// ---------------- PROFILE SHEET ----------------
function closeProfileSheet() {
  document.getElementById('profileOverlay')?.remove();
}

function openAvatarViewer(url) {
  const viewer = document.createElement('div');
  viewer.className = 'avatar-viewer';
  viewer.innerHTML = `<img src="${url}" alt="عکس پروفایل" />`;
  viewer.onclick = () => viewer.remove();
  document.body.appendChild(viewer);
}

// Resizes/compresses an image file client-side (fixes mobile-camera photos that are far too large to upload).
function compressImage(file, maxDim = 600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فایل خونده نشد'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('فرمت این عکس پشتیبانی نمیشه (مثلاً HEIC آیفون) — یه عکس JPG/PNG امتحان کن'));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height >= width && height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob); else reject(new Error('تبدیل عکس ناموفق بود'));
        }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function openProfileSheet(name) {
  closeProfileSheet();
  const overlay = document.createElement('div');
  overlay.id = 'profileOverlay';
  overlay.className = 'overlay-backdrop';
  overlay.innerHTML = `
    <div class="profile-sheet">
      <div class="sheet-handle"></div>
      <div class="profile-header">
        ${avatarHTML(currentUser, name, 'avatar-lg', 'avatarLgImg')}
        <h3 style="margin:0">${name}</h3>
        <input type="file" id="avatarFileInput" accept="image/*" style="display:none" />
      </div>
      <div class="profile-row" id="rowChangePhoto">🖼 تغییر عکس پروفایل</div>
      <div class="profile-row" id="rowEditName">✏️ ویرایش نام</div>
      <div class="profile-row" id="rowTemplates">🗂 قالب‌های هفتگی</div>
      <div class="profile-row" id="rowProgram">📅 دوره‌ی برنامه</div>
      <div class="profile-row" id="rowLogout">⎋ خروج از حساب</div>
      <div class="profile-row danger" id="rowDelete">🗑 حذف حساب</div>
      <div class="profile-row" id="rowClose" style="color:var(--text-dim); justify-content:center">بستن</div>
    </div>`;
  overlay.onclick = (e) => { if (e.target === overlay) closeProfileSheet(); };
  document.body.appendChild(overlay);

  document.getElementById('rowClose').onclick = closeProfileSheet;

  if (currentUser.user_metadata?.avatar_url) {
    document.getElementById('avatarLgImg').onclick = () => openAvatarViewer(currentUser.user_metadata.avatar_url);
  }

  document.getElementById('rowChangePhoto').onclick = () => {
    document.getElementById('avatarFileInput').click();
  };

  document.getElementById('avatarFileInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('این فایل خیلی بزرگه، یه عکس دیگه انتخاب کن'); return; }

    toast('در حال آماده‌سازی عکس...');
    let blob;
    try {
      blob = await compressImage(file);
    } catch (err) {
      toast('خطا در خوندن عکس: ' + err.message);
      return;
    }

    toast('در حال آپلود...');
    const path = `${currentUser.id}/avatar.jpg`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' });
    if (uploadError) { toast('خطا در آپلود: ' + uploadError.message); return; }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = data.publicUrl + '?t=' + Date.now();
    await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });

    toast('عکس پروفایل به‌روزرسانی شد ✅');
    closeProfileSheet();
    renderApp();
  };

  document.getElementById('rowEditName').onclick = async () => {
    const newName = prompt('اسم جدید رو وارد کن:', name);
    if (newName === null || !newName.trim()) return;
    await supabase.auth.updateUser({ data: { full_name: newName.trim() } });
    closeProfileSheet();
    renderApp();
  };

  document.getElementById('rowLogout').onclick = async () => {
    closeProfileSheet();
    await supabase.auth.signOut();
  };

  document.getElementById('rowTemplates').onclick = () => {
    closeProfileSheet();
    renderTemplates();
  };

  document.getElementById('rowProgram').onclick = () => {
    closeProfileSheet();
    renderProgramSettings();
  };

  document.getElementById('rowDelete').onclick = async () => {
    const ok = confirm('مطمئنی می‌خوای حسابت رو کامل حذف کنی؟ همه‌ی برنامه‌ها و تاریخچه‌ت پاک میشه و برنگشتنی‌ه.');
    if (!ok) return;
    const { error } = await supabase.rpc('delete_own_account');
    if (error) { toast('خطا: ' + error.message); return; }
    closeProfileSheet();
    await supabase.auth.signOut();
  };
}

// ---------------- TODAY DATA ----------------
async function loadToday() {
  const { data: workout } = await supabase
    .from('workouts')
    .select('*, exercises(*)')
    .eq('workout_date', todayISO())
    .maybeSingle();

  if (workout) {
    workout.exercises.sort((a, b) => a.order_index - b.order_index);
    renderToday(workout);
    return;
  }

  const todayWeekday = new Date().getDay();
  const { data: template } = await supabase
    .from('templates')
    .select('*, template_exercises(*)')
    .eq('weekday', todayWeekday)
    .maybeSingle();

  if (template) {
    await cloneTemplateToToday(template);
  } else {
    renderBuilder(todayWeekday);
  }
}

async function cloneTemplateToToday(template) {
  const { data: workout, error } = await supabase.from('workouts').insert({
    user_id: currentUser.id,
    workout_date: todayISO(),
    title: template.title,
    level: template.level,
    duration_min: template.duration_min,
    gym_name: template.gym_name,
  }).select().single();

  if (error) { toast('خطا: ' + error.message); renderBuilder(new Date().getDay()); return; }

  const exList = [...template.template_exercises]
    .sort((a, b) => a.order_index - b.order_index)
    .map(e => ({
      workout_id: workout.id,
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      weight_kg: e.weight_kg,
      icon: e.icon,
      order_index: e.order_index,
      group_id: e.group_id,
    }));

  if (exList.length) await supabase.from('exercises').insert(exList);

  loadToday();
}

// Groups consecutive exercises that share a group_id (superset/triset) into one render item.
function groupExercises(exercises) {
  const out = [];
  let i = 0;
  while (i < exercises.length) {
    const e = exercises[i];
    if (e.group_id) {
      const group = [e];
      let j = i + 1;
      while (j < exercises.length && exercises[j].group_id === e.group_id) {
        group.push(exercises[j]);
        j++;
      }
      out.push({ type: 'group', exercises: group });
      i = j;
    } else {
      out.push({ type: 'single', ex: e });
      i++;
    }
  }
  return out;
}

function renderToday(w) {
  const content = document.getElementById('content');
  const total = w.exercises.length;
  const doneCount = w.exercises.filter(e => e.done).length;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  content.innerHTML = `
    <div class="today-card">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <p class="eyebrow">تمرین امروز</p>
        <button class="btn-ghost" id="editWorkoutBtn" style="padding:2px 6px">✏️ ویرایش برنامه</button>
      </div>
      <div class="row-top">
        <div>
          <h3>${w.title}</h3>
          <div class="tags">
            ${w.level ? `<span class="tag">${w.level}</span>` : ''}
            ${w.duration_min ? `<span class="tag">${toFaDigits(w.duration_min)} دقیقه</span>` : ''}
            <span class="tag">${toFaDigits(total)} حرکت</span>
            ${w.gym_name ? `<span class="tag">${w.gym_name}</span>` : ''}
          </div>
        </div>
        ${ring(pct, 76, 'var(--danger)', toFaDigits(pct) + '٪', 'تکمیل')}
      </div>
      <div style="margin-top:20px">
        <button class="btn-primary" id="startBtn" ${w.started_at ? 'style="display:none"' : ''}>▶ شروع تمرین</button>
        ${w.finished_at ? `
          <div class="finished-banner">
            <p>🎉 تمرین امروز تموم شد — ${w.duration_min ? toFaDigits(w.duration_min) + ' دقیقه' : ''} · ${toFaDigits(doneCount)} از ${toFaDigits(total)} حرکت</p>
            <button class="btn-ghost" id="undoFinishBtn">بازگشت به تمرین</button>
          </div>` : ''}
      </div>
    </div>

    <div class="stats-row">
      <div class="stat" data-field="avg_heart_rate">${ring(Math.min((w.avg_heart_rate||0)/2,100), 64, '#5DADE2', w.avg_heart_rate ? toFaDigits(w.avg_heart_rate) : '−')}<span class="label">ضربان میانگین</span></div>
      <div class="stat" data-field="active_minutes">${ring(Math.min((w.active_minutes||0),100), 64, 'var(--accent)', w.active_minutes ? toFaDigits(w.active_minutes) : '−')}<span class="label">دقیقه فعال</span></div>
      <div class="stat" data-field="calories">${ring(Math.min((w.calories||0)/5,100), 64, 'var(--danger)', w.calories ? toFaDigits(w.calories) : '−')}<span class="label">کالری</span></div>
    </div>

    <div class="section-title"><h4>حرکات امروز</h4>${!w.started_at ? '<span style="font-size:12px;color:var(--text-dim)">🔒 اول تمرین رو شروع کن</span>' : ''}</div>
    <div class="exercise-list ${!w.started_at ? 'locked' : ''}">
      ${groupExercises(w.exercises).map(item => {
        if (item.type === 'single') {
          const e = item.ex;
          return `
            <div class="exercise-item ${e.done ? 'done' : ''}" data-ids="${e.id}">
              <div class="check">✓</div>
              <div class="ex-icon">${e.icon || '🏋️'}</div>
              <div class="ex-info">
                <div class="name">${e.name}</div>
                <div class="meta">${e.sets ? toFaDigits(e.sets) + ' ست' : ''}${e.reps ? ' × ' + toFaDigits(e.reps) + ' تکرار' : ''}${e.weight_kg ? ' · ' + toFaDigits(e.weight_kg) + ' کیلوگرم' : ''}</div>
              </div>
            </div>`;
        }
        const allDone = item.exercises.every(e => e.done);
        const label = item.exercises.length === 2 ? 'سوپرست' : item.exercises.length === 3 ? 'تری‌ست' : `گروه (${toFaDigits(item.exercises.length)} حرکت)`;
        const ids = item.exercises.map(e => e.id).join(',');
        return `
          <div class="exercise-item group-item ${allDone ? 'done' : ''}" data-ids="${ids}">
            <div class="check">✓</div>
            <div class="ex-icon">🔗</div>
            <div class="ex-info">
              <div class="group-label">${label}</div>
              ${item.exercises.map(e => `
                <div class="group-sub">
                  <span class="name">${e.name}</span>
                  <span class="meta">${e.sets ? toFaDigits(e.sets) + ' ست' : ''}${e.reps ? ' × ' + toFaDigits(e.reps) + ' تکرار' : ''}${e.weight_kg ? ' · ' + toFaDigits(e.weight_kg) + ' کیلوگرم' : ''}</span>
                </div>
              `).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>
    ${w.started_at && !w.finished_at ? `
      <div class="timer-bar">
        <span class="time mono" id="timerDisplay">۰۰:۰۰</span>
        <button class="finish-btn" id="finishBtn">پایان تمرین</button>
      </div>` : ''}
  `;

  // checkbox toggles (works for both single exercises and grouped superset/triset cards)
  content.querySelectorAll('.exercise-item').forEach(el => {
    el.onclick = async () => {
      if (!w.started_at) { toast('اول باید «شروع تمرین» رو بزنی 🔒'); return; }
      const ids = el.dataset.ids.split(',');
      const involved = w.exercises.filter(x => ids.includes(x.id));
      const newDone = !involved.every(x => x.done);
      await supabase.from('exercises')
        .update({ done: newDone, done_at: newDone ? new Date().toISOString() : null })
        .in('id', ids);
      loadToday();
    };
  });

  // stat rings -> manual entry
  content.querySelectorAll('.stat').forEach(el => {
    el.onclick = async () => {
      const field = el.dataset.field;
      const labelMap = { avg_heart_rate: 'ضربان قلب میانگین', active_minutes: 'دقیقه فعال', calories: 'کالری سوزانده‌شده' };
      const val = prompt(`${labelMap[field]} رو وارد کن:`);
      if (val === null || val === '' || isNaN(val)) return;
      await supabase.from('workouts').update({ [field]: parseInt(val) }).eq('id', w.id);
      loadToday();
    };
  });

  const startBtn = document.getElementById('startBtn');
  if (startBtn) startBtn.onclick = async () => {
    await supabase.from('workouts').update({ started_at: new Date().toISOString() }).eq('id', w.id);
    loadToday();
  };

  document.getElementById('editWorkoutBtn').onclick = () => renderEditWorkout(w);

  if (w.started_at && !w.finished_at) startTimerDisplay(w.started_at);

  const finishBtn = document.getElementById('finishBtn');
  if (finishBtn) finishBtn.onclick = async () => {
    clearInterval(timerInterval);
    const elapsedMin = Math.max(1, Math.round((Date.now() - new Date(w.started_at).getTime()) / 60000));
    await supabase.from('workouts').update({ finished_at: new Date().toISOString(), duration_min: elapsedMin }).eq('id', w.id);
    toast('تمرین امروز به پایان رسید 💪');
    loadToday();
  };

  const undoFinishBtn = document.getElementById('undoFinishBtn');
  if (undoFinishBtn) undoFinishBtn.onclick = async () => {
    await supabase.from('workouts').update({ finished_at: null }).eq('id', w.id);
    loadToday();
  };
}

function startTimerDisplay(startedAt) {
  clearInterval(timerInterval);
  const start = new Date(startedAt).getTime();
  const el = document.getElementById('timerDisplay');
  const tick = () => {
    const diff = Math.floor((Date.now() - start) / 1000);
    const mm = String(Math.floor(diff / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    if (el) el.textContent = toFaDigits(mm) + ':' + toFaDigits(ss);
  };
  tick();
  timerInterval = setInterval(tick, 1000);
}

// ---------------- BUILDER (no workout today yet) ----------------
let exerciseRowCount = 0;
function exerciseRowHTML(idx) {
  return `
    <div class="ex-row" data-row="${idx}">
      <input class="input" placeholder="اسم حرکت" data-f="name" />
      <input class="input" placeholder="ست" type="number" data-f="sets" />
      <input class="input" placeholder="تکرار" type="number" data-f="reps" />
      <input class="input" placeholder="وزن" type="number" data-f="weight_kg" />
      <button class="link-btn" data-link="${idx}" title="پیوند به حرکت بعدی (سوپرست/تری‌ست)">🔗</button>
      <div class="move-btns">
        <button class="move-btn" data-move="up" title="جابه‌جایی به بالا">▲</button>
        <button class="move-btn" data-move="down" title="جابه‌جایی به پایین">▼</button>
      </div>
      <button class="remove-btn" data-remove="${idx}">✕</button>
    </div>`;
}

// Shared wiring for remove / link-to-next / reorder buttons on an exercise row.
function wireExerciseRow(row, idx, rowsEl) {
  if (row.dataset.linked === undefined) row.dataset.linked = 'false';
  row.querySelector(`[data-remove="${idx}"]`).onclick = (e) => {
    e.target.closest('.ex-row').remove();
  };
  row.querySelector(`[data-link="${idx}"]`).onclick = (e) => {
    const linked = row.dataset.linked === 'true';
    row.dataset.linked = linked ? 'false' : 'true';
    e.target.classList.toggle('active', !linked);
    row.classList.toggle('linked', !linked);
  };
  row.querySelector('[data-move="up"]').onclick = () => {
    const prev = row.previousElementSibling;
    if (prev) rowsEl.insertBefore(row, prev);
  };
  row.querySelector('[data-move="down"]').onclick = () => {
    const next = row.nextElementSibling;
    if (next) rowsEl.insertBefore(next, row);
  };
}

function renderBuilder(weekday) {
  const content = document.getElementById('content');
  exerciseRowCount = 0;
  content.innerHTML = `
    <div class="empty-state">
      <p>هنوز برنامه‌ای برای امروز ثبت نشده</p>
      ${weekday !== undefined ? `<button class="btn-ghost" id="goTemplates">می‌خوای ${WEEKDAYS[weekday]}‌ها همیشه همین برنامه باشه؟ یه قالب ثابت بساز ←</button>` : ''}
    </div>
    <div class="builder">
      <div class="field"><label>عنوان روز</label><input class="input" id="b_title" placeholder="مثلاً روز سینه و پشت‌بازو" /></div>
      <div class="grid2">
        <div class="field"><label>سطح</label><input class="input" id="b_level" placeholder="متوسط" /></div>
        <div class="field"><label>مدت (دقیقه)</label><input class="input" id="b_duration" type="number" placeholder="45" /></div>
      </div>
      <div class="field"><label>باشگاه</label><input class="input" id="b_gym" placeholder="نام باشگاه (اختیاری)" /></div>

      <div class="section-title" style="padding:0"><h4>حرکات</h4><button class="btn-ghost" id="addRow">+ افزودن حرکت</button></div>
      <div id="exRows"></div>

      <button class="btn-primary" id="saveWorkout" style="margin-top:8px">ذخیره برنامه امروز</button>
    </div>
  `;

  const rowsEl = document.getElementById('exRows');
  enableEnterNav(document.querySelector('.builder'), document.getElementById('saveWorkout'));
  document.getElementById('goTemplates')?.addEventListener('click', () => renderTemplateEditor(null, weekday));
  const addRow = () => {
    const idx = exerciseRowCount++;
    rowsEl.insertAdjacentHTML('beforeend', exerciseRowHTML(idx));
    const row = rowsEl.querySelector(`[data-row="${idx}"]`);
    wireExerciseRow(row, idx, rowsEl);
  };
  document.getElementById('addRow').onclick = addRow;
  addRow(); addRow(); // start with 2 empty rows

  document.getElementById('saveWorkout').onclick = async () => {
    const title = document.getElementById('b_title').value.trim();
    if (!title) { toast('عنوان روز رو بنویس'); return; }

    const { data: workout, error } = await supabase.from('workouts').insert({
      user_id: currentUser.id,
      workout_date: todayISO(),
      title,
      level: document.getElementById('b_level').value.trim() || null,
      duration_min: parseInt(document.getElementById('b_duration').value) || null,
      gym_name: document.getElementById('b_gym').value.trim() || null,
    }).select().single();

    if (error) { toast('خطا: ' + error.message); return; }

    const rows = [...rowsEl.querySelectorAll('.ex-row')];
    let currentGroup = null;
    const exercises = rows.map((row, i) => {
      if (currentGroup === null && row.dataset.linked === 'true') currentGroup = crypto.randomUUID();
      const group_id = currentGroup;
      if (row.dataset.linked !== 'true') currentGroup = null;
      return {
        workout_id: workout.id,
        name: row.querySelector('[data-f="name"]').value.trim(),
        sets: parseInt(row.querySelector('[data-f="sets"]').value) || null,
        reps: parseInt(row.querySelector('[data-f="reps"]').value) || null,
        weight_kg: parseFloat(row.querySelector('[data-f="weight_kg"]').value) || null,
        order_index: i,
        group_id,
      };
    }).filter(e => e.name);

    if (exercises.length) await supabase.from('exercises').insert(exercises);

    toast('برنامه امروز ذخیره شد ✅');
    loadToday();
  };
}

// ---------------- HISTORY ----------------
async function renderHistory() {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="empty-state"><p>در حال بارگذاری...</p></div>`;

  const { data: workouts } = await supabase
    .from('workouts')
    .select('*, exercises(*)')
    .order('workout_date', { ascending: false });

  content.innerHTML = `
    <div class="section-title"><h4>تاریخچه‌ی تمرین‌ها</h4><button class="btn-ghost" id="backToToday">بازگشت به امروز</button></div>
    <div class="exercise-list">
      ${(workouts && workouts.length) ? workouts.map(w => {
        const total = w.exercises.length;
        const done = w.exercises.filter(e => e.done).length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const dateLabel = new Date(w.workout_date).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });
        return `
          <div class="exercise-item" data-id="${w.id}" style="cursor:pointer">
            <div class="ex-icon">${w.finished_at ? '✅' : '📋'}</div>
            <div class="ex-info">
              <div class="name">${w.title}</div>
              <div class="meta">${dateLabel} · ${toFaDigits(pct)}٪ تکمیل</div>
            </div>
          </div>`;
      }).join('') : `<div class="empty-state"><p>هنوز تمرینی ثبت نشده</p></div>`}
    </div>
  `;

  document.getElementById('backToToday').onclick = () => loadToday();
  content.querySelectorAll('.exercise-item[data-id]').forEach(el => {
    el.onclick = () => renderHistoryDetail(workouts.find(w => w.id === el.dataset.id));
  });
}

function renderHistoryDetail(w) {
  const content = document.getElementById('content');
  const exercises = [...w.exercises].sort((a, b) => a.order_index - b.order_index);
  const total = exercises.length;
  const done = exercises.filter(e => e.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const dateLabel = new Date(w.workout_date).toLocaleDateString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long' });

  content.innerHTML = `
    <div class="section-title"><h4>${dateLabel}</h4><button class="btn-ghost" id="backToHistory">بازگشت</button></div>
    <div class="today-card">
      <div class="row-top">
        <div>
          <h3>${w.title}</h3>
          <div class="tags">
            ${w.level ? `<span class="tag">${w.level}</span>` : ''}
            ${w.duration_min ? `<span class="tag">${toFaDigits(w.duration_min)} دقیقه</span>` : ''}
            <span class="tag">${toFaDigits(total)} حرکت</span>
            ${w.gym_name ? `<span class="tag">${w.gym_name}</span>` : ''}
          </div>
        </div>
        ${ring(pct, 76, 'var(--success)', toFaDigits(pct) + '٪', 'تکمیل')}
      </div>
    </div>
    <div class="stats-row">
      <div class="stat">${ring(Math.min((w.avg_heart_rate || 0) / 2, 100), 64, '#5DADE2', w.avg_heart_rate ? toFaDigits(w.avg_heart_rate) : '−')}<span class="label">ضربان میانگین</span></div>
      <div class="stat">${ring(Math.min((w.active_minutes || 0), 100), 64, 'var(--accent)', w.active_minutes ? toFaDigits(w.active_minutes) : '−')}<span class="label">دقیقه فعال</span></div>
      <div class="stat">${ring(Math.min((w.calories || 0) / 5, 100), 64, 'var(--danger)', w.calories ? toFaDigits(w.calories) : '−')}<span class="label">کالری</span></div>
    </div>
    <div class="section-title"><h4>حرکات</h4></div>
    <div class="exercise-list">
      ${groupExercises(exercises).map(item => {
        if (item.type === 'single') {
          const e = item.ex;
          return `
            <div class="exercise-item ${e.done ? 'done' : ''}" style="cursor:default">
              <div class="check">✓</div>
              <div class="ex-icon">${e.icon || '🏋️'}</div>
              <div class="ex-info">
                <div class="name">${e.name}</div>
                <div class="meta">${e.sets ? toFaDigits(e.sets) + ' ست' : ''}${e.reps ? ' × ' + toFaDigits(e.reps) + ' تکرار' : ''}${e.weight_kg ? ' · ' + toFaDigits(e.weight_kg) + ' کیلوگرم' : ''}</div>
              </div>
            </div>`;
        }
        const allDone = item.exercises.every(e => e.done);
        const label = item.exercises.length === 2 ? 'سوپرست' : item.exercises.length === 3 ? 'تری‌ست' : `گروه (${toFaDigits(item.exercises.length)} حرکت)`;
        return `
          <div class="exercise-item group-item ${allDone ? 'done' : ''}" style="cursor:default">
            <div class="check">✓</div>
            <div class="ex-icon">🔗</div>
            <div class="ex-info">
              <div class="group-label">${label}</div>
              ${item.exercises.map(e => `
                <div class="group-sub">
                  <span class="name">${e.name}</span>
                  <span class="meta">${e.sets ? toFaDigits(e.sets) + ' ست' : ''}${e.reps ? ' × ' + toFaDigits(e.reps) + ' تکرار' : ''}${e.weight_kg ? ' · ' + toFaDigits(e.weight_kg) + ' کیلوگرم' : ''}</span>
                </div>
              `).join('')}
            </div>
          </div>`;
      }).join('')}
    </div>
  `;

  document.getElementById('backToHistory').onclick = () => renderHistory();
}

// ---------------- EDIT TODAY'S WORKOUT ----------------
function renderEditWorkout(w) {
  const content = document.getElementById('content');
  exerciseRowCount = 0;
  const existingExercises = [...w.exercises].sort((a, b) => a.order_index - b.order_index);

  content.innerHTML = `
    <div class="section-title"><h4>ویرایش برنامه‌ی امروز</h4><button class="btn-ghost" id="backToToday">بازگشت</button></div>
    <div class="builder">
      <div class="field"><label>عنوان روز</label><input class="input" id="b_title" value="${w.title ?? ''}" /></div>
      <div class="grid2">
        <div class="field"><label>سطح</label><input class="input" id="b_level" value="${w.level ?? ''}" /></div>
        <div class="field"><label>مدت (دقیقه)</label><input class="input" id="b_duration" type="number" value="${w.duration_min ?? ''}" /></div>
      </div>
      <div class="field"><label>باشگاه</label><input class="input" id="b_gym" value="${w.gym_name ?? ''}" /></div>

      <div class="section-title" style="padding:0"><h4>حرکات</h4><button class="btn-ghost" id="addRow">+ افزودن حرکت</button></div>
      <div id="exRows"></div>

      <button class="btn-primary" id="saveEdit" style="margin-top:8px">ذخیره تغییرات</button>
    </div>
  `;

  document.getElementById('backToToday').onclick = () => loadToday();

  const rowsEl = document.getElementById('exRows');
  enableEnterNav(document.querySelector('.builder'), document.getElementById('saveEdit'));

  const addRow = (prefill) => {
    const idx = exerciseRowCount++;
    rowsEl.insertAdjacentHTML('beforeend', exerciseRowHTML(idx));
    const row = rowsEl.querySelector(`[data-row="${idx}"]`);
    if (prefill) {
      row.querySelector('[data-f="name"]').value = prefill.name ?? '';
      row.querySelector('[data-f="sets"]').value = prefill.sets ?? '';
      row.querySelector('[data-f="reps"]').value = prefill.reps ?? '';
      row.querySelector('[data-f="weight_kg"]').value = prefill.weight_kg ?? '';
    }
    wireExerciseRow(row, idx, rowsEl);
    return row;
  };
  document.getElementById('addRow').onclick = () => addRow();

  if (existingExercises.length) {
    existingExercises.forEach((ex, i) => {
      const row = addRow(ex);
      const next = existingExercises[i + 1];
      if (ex.group_id && next && next.group_id === ex.group_id) {
        row.dataset.linked = 'true';
        row.classList.add('linked');
        row.querySelector('.link-btn').classList.add('active');
      }
    });
  } else {
    addRow(); addRow();
  }

  document.getElementById('saveEdit').onclick = async () => {
    const title = document.getElementById('b_title').value.trim();
    if (!title) { toast('عنوان روز رو بنویس'); return; }

    await supabase.from('workouts').update({
      title,
      level: document.getElementById('b_level').value.trim() || null,
      duration_min: parseInt(document.getElementById('b_duration').value) || null,
      gym_name: document.getElementById('b_gym').value.trim() || null,
    }).eq('id', w.id);

    await supabase.from('exercises').delete().eq('workout_id', w.id);

    const rows = [...rowsEl.querySelectorAll('.ex-row')];
    let currentGroup = null;
    const exercises = rows.map((row, i) => {
      if (currentGroup === null && row.dataset.linked === 'true') currentGroup = crypto.randomUUID();
      const group_id = currentGroup;
      if (row.dataset.linked !== 'true') currentGroup = null;
      return {
        workout_id: w.id,
        name: row.querySelector('[data-f="name"]').value.trim(),
        sets: parseInt(row.querySelector('[data-f="sets"]').value) || null,
        reps: parseInt(row.querySelector('[data-f="reps"]').value) || null,
        weight_kg: parseFloat(row.querySelector('[data-f="weight_kg"]').value) || null,
        order_index: i,
        group_id,
      };
    }).filter(e => e.name);

    if (exercises.length) await supabase.from('exercises').insert(exercises);

    toast('برنامه‌ی امروز به‌روزرسانی شد ✅');
    loadToday();
  };
}

// ---------------- PROGRAM LENGTH SETTINGS ----------------
function renderProgramSettings() {
  const content = document.getElementById('content');
  const weeks = currentUser.user_metadata?.program_weeks;
  const start = currentUser.user_metadata?.program_start_date;

  // If already set, prefill "which week am I on" with the currently-computed week (not necessarily 1).
  let currentWeek = 1;
  if (weeks && start) {
    const startDate = new Date(start + 'T00:00:00');
    const today = new Date(todayISO() + 'T00:00:00');
    currentWeek = Math.max(1, Math.floor((today - startDate) / 86400000 / 7) + 1);
  }

  content.innerHTML = `
    <div class="section-title"><h4>دوره‌ی برنامه</h4><button class="btn-ghost" id="backToToday">بازگشت</button></div>
    <div class="builder">
      <p style="color:var(--text-dim); font-size:13px; margin:0 0 4px">اینجا تعیین می‌کنی برنامه‌ات چند هفته‌ست، تا بالای صفحه همیشه بدونی الان هفته‌ی چندمی — دیگه لازم نیست جایی یادداشتش کنی.</p>
      <div class="field"><label>این برنامه چند هفته‌ست؟</label><input class="input" id="pw_weeks" type="number" placeholder="مثلاً 12" value="${weeks ?? ''}" /></div>
      <div class="field"><label>الان تو کدوم هفته‌ای؟ (اگه تازه شروع کردی بذار ۱)</label><input class="input" id="pw_start" type="number" placeholder="مثلاً 1" value="${weeks ? currentWeek : ''}" /></div>
      <button class="btn-primary" id="saveProgram" style="margin-top:8px">ذخیره</button>
      ${weeks ? `<button class="btn-ghost" id="deleteProgram" style="color:var(--danger)">🗑 حذف دوره</button>` : ''}
    </div>
  `;

  document.getElementById('backToToday').onclick = () => loadToday();
  enableEnterNav(document.querySelector('.builder'), document.getElementById('saveProgram'));

  document.getElementById('saveProgram').onclick = async () => {
    const w = parseInt(document.getElementById('pw_weeks').value);
    const sw = parseInt(document.getElementById('pw_start').value) || 1;
    if (!w || w < 1) { toast('تعداد هفته رو درست وارد کن'); return; }

    // Back-calculate an effective start date so "today" lands on week `sw`.
    const startDate = new Date(todayISO() + 'T00:00:00');
    startDate.setDate(startDate.getDate() - (sw - 1) * 7);
    const startISO = startDate.toISOString().slice(0, 10);

    await supabase.auth.updateUser({ data: { program_weeks: w, program_start_date: startISO } });
    toast('دوره‌ی برنامه ذخیره شد ✅');
    renderApp();
  };

  const deleteBtn = document.getElementById('deleteProgram');
  if (deleteBtn) deleteBtn.onclick = async () => {
    await supabase.auth.updateUser({ data: { program_weeks: null, program_start_date: null } });
    toast('دوره‌ی برنامه حذف شد');
    renderApp();
  };
}

// ---------------- WEEKLY TEMPLATES ----------------
async function renderTemplates() {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="empty-state"><p>در حال بارگذاری...</p></div>`;

  const { data: templates } = await supabase.from('templates').select('*, template_exercises(*)');
  const byWeekday = {};
  (templates || []).forEach(t => { byWeekday[t.weekday] = t; });

  content.innerHTML = `
    <div class="section-title"><h4>قالب‌های هفتگی</h4><button class="btn-ghost" id="backToToday">بازگشت</button></div>
    <div class="exercise-list">
      ${PERSIAN_WEEK_ORDER.map(wd => {
        const t = byWeekday[wd];
        return `
          <div class="exercise-item" data-weekday="${wd}" style="cursor:pointer">
            <div class="ex-icon">${t ? '📋' : '➕'}</div>
            <div class="ex-info">
              <div class="name">${WEEKDAYS[wd]}</div>
              <div class="meta">${t ? t.title + (t.template_exercises.length ? ' · ' + toFaDigits(t.template_exercises.length) + ' حرکت' : '') : 'قالبی ثبت نشده'}</div>
            </div>
            ${t ? `<button class="remove-btn" data-del="${t.id}" title="حذف قالب">✕</button>` : ''}
          </div>`;
      }).join('')}
    </div>
  `;

  document.getElementById('backToToday').onclick = () => loadToday();

  content.querySelectorAll('.exercise-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) return;
      const wd = parseInt(el.dataset.weekday);
      renderTemplateEditor(byWeekday[wd] || null, wd);
    });
  });

  content.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = confirm('این قالب حذف بشه؟ (برنامه‌های روزهای قبلی که ازش کپی شدن پاک نمیشن)');
      if (!ok) return;
      await supabase.from('templates').delete().eq('id', btn.dataset.del);
      renderTemplates();
    });
  });
}

function renderTemplateEditor(template, weekday) {
  const content = document.getElementById('content');
  exerciseRowCount = 0;
  const existingExercises = template ? [...template.template_exercises].sort((a, b) => a.order_index - b.order_index) : [];

  content.innerHTML = `
    <div class="section-title"><h4>قالب ${WEEKDAYS[weekday]}</h4><button class="btn-ghost" id="backToTemplates">بازگشت</button></div>
    <div class="builder">
      <div class="field"><label>عنوان روز</label><input class="input" id="t_title" placeholder="مثلاً روز سینه و پشت‌بازو" value="${template?.title ?? ''}" /></div>
      <div class="grid2">
        <div class="field"><label>سطح</label><input class="input" id="t_level" placeholder="متوسط" value="${template?.level ?? ''}" /></div>
        <div class="field"><label>مدت (دقیقه)</label><input class="input" id="t_duration" type="number" placeholder="45" value="${template?.duration_min ?? ''}" /></div>
      </div>
      <div class="field"><label>باشگاه</label><input class="input" id="t_gym" placeholder="نام باشگاه (اختیاری)" value="${template?.gym_name ?? ''}" /></div>

      <div class="section-title" style="padding:0"><h4>حرکات</h4><button class="btn-ghost" id="addRow">+ افزودن حرکت</button></div>
      <div id="exRows"></div>

      <button class="btn-primary" id="saveTemplate" style="margin-top:8px">ذخیره قالب ${WEEKDAYS[weekday]}</button>
    </div>
  `;

  document.getElementById('backToTemplates').onclick = () => renderTemplates();

  const rowsEl = document.getElementById('exRows');
  enableEnterNav(document.querySelector('.builder'), document.getElementById('saveTemplate'));

  const addRow = (prefill) => {
    const idx = exerciseRowCount++;
    rowsEl.insertAdjacentHTML('beforeend', exerciseRowHTML(idx));
    const row = rowsEl.querySelector(`[data-row="${idx}"]`);
    if (prefill) {
      row.querySelector('[data-f="name"]').value = prefill.name ?? '';
      row.querySelector('[data-f="sets"]').value = prefill.sets ?? '';
      row.querySelector('[data-f="reps"]').value = prefill.reps ?? '';
      row.querySelector('[data-f="weight_kg"]').value = prefill.weight_kg ?? '';
    }
    wireExerciseRow(row, idx, rowsEl);
    return row;
  };
  document.getElementById('addRow').onclick = () => addRow();

  if (existingExercises.length) {
    existingExercises.forEach((ex, i) => {
      const row = addRow(ex);
      const next = existingExercises[i + 1];
      if (ex.group_id && next && next.group_id === ex.group_id) {
        row.dataset.linked = 'true';
        row.classList.add('linked');
        row.querySelector('.link-btn').classList.add('active');
      }
    });
  } else {
    addRow(); addRow();
  }

  document.getElementById('saveTemplate').onclick = async () => {
    const title = document.getElementById('t_title').value.trim();
    if (!title) { toast('عنوان روز رو بنویس'); return; }

    let templateId = template?.id;
    if (templateId) {
      await supabase.from('templates').update({
        title,
        level: document.getElementById('t_level').value.trim() || null,
        duration_min: parseInt(document.getElementById('t_duration').value) || null,
        gym_name: document.getElementById('t_gym').value.trim() || null,
      }).eq('id', templateId);
      await supabase.from('template_exercises').delete().eq('template_id', templateId);
    } else {
      const { data: newTemplate, error } = await supabase.from('templates').insert({
        user_id: currentUser.id,
        weekday,
        title,
        level: document.getElementById('t_level').value.trim() || null,
        duration_min: parseInt(document.getElementById('t_duration').value) || null,
        gym_name: document.getElementById('t_gym').value.trim() || null,
      }).select().single();
      if (error) { toast('خطا: ' + error.message); return; }
      templateId = newTemplate.id;
    }

    const rows = [...rowsEl.querySelectorAll('.ex-row')];
    let currentGroup = null;
    const exercises = rows.map((row, i) => {
      if (currentGroup === null && row.dataset.linked === 'true') currentGroup = crypto.randomUUID();
      const group_id = currentGroup;
      if (row.dataset.linked !== 'true') currentGroup = null;
      return {
        template_id: templateId,
        name: row.querySelector('[data-f="name"]').value.trim(),
        sets: parseInt(row.querySelector('[data-f="sets"]').value) || null,
        reps: parseInt(row.querySelector('[data-f="reps"]').value) || null,
        weight_kg: parseFloat(row.querySelector('[data-f="weight_kg"]').value) || null,
        order_index: i,
        group_id,
      };
    }).filter(e => e.name);

    if (exercises.length) await supabase.from('template_exercises').insert(exercises);

    toast('قالب ذخیره شد ✅');
    renderTemplates();
  };
}

// ---------------- BOOT ----------------
supabase.auth.onAuthStateChange((_event, session) => {
  clearInterval(timerInterval);
  if (session?.user) { currentUser = session.user; renderApp(); }
  else renderAuth('signin');
});
