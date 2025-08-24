// app.js - Manejo de autenticación y plan de estudios
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Constantes de Supabase (pegar aquí las 5 credenciales) ---
const SUPABASE_URL = 'https://njzzuqdnigafpymgvizr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qenp1cWRuaWdhZnB5bWd2aXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTE1NjQsImV4cCI6MjA3MTYyNzU2NH0.eq_o2LFRxX2tLMvXpkc-jJFuzIX_orjBFAoWWyAVqt8';
const VIEWER_EMAIL = 'viewer@fiuba.local';
const ADMIN_EMAIL = 'Juanpablo20240604@gmail.com';
const ADMIN_UUID = 'e6c2299b-a401-40b2-8af9-550cd0d8c2cc';

// Inicializa el cliente
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estados para los selects
const states = [
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'cursando', label: 'Cursando' },
  { value: 'regular', label: 'Regular con final' },
  { value: 'futura', label: 'Futura' },
  { value: 'recursar', label: 'A recursar' }
];

// Referencias y variables de estado
const subjectElements = new Map();
const pending = new Map(); // timers para debounce
let planChannel = null;
let isAdmin = false;

// Elementos del DOM
const viewerForm = document.getElementById('viewer-form');
const adminForm = document.getElementById('admin-form');
const showAdminBtn = document.getElementById('show-admin-btn');
const authMsg = document.getElementById('auth-msg');
const signOutBtn = document.getElementById('signout-btn');
const toast = document.getElementById('toast');

function showError(msg) {
  authMsg.textContent = msg;
}
function clearError() {
  authMsg.textContent = '';
}

function showToast(msg, isError = false) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.toggle('error', isError);
  toast.hidden = false;
  setTimeout(() => {
    toast.hidden = true;
  }, 1500);
}

// Muestra/oculta vistas
function showLogin() {
  document.getElementById('login-view').hidden = false;
  document.getElementById('app-view').hidden = true;
  signOutBtn.hidden = true;
}
function showApp() {
  document.getElementById('login-view').hidden = true;
  document.getElementById('app-view').hidden = false;
  signOutBtn.hidden = false;
}

// Deshabilita o habilita controles de estado
function setEditing(enable) {
  subjectElements.forEach(({ group, buttons }) => {
    group.setAttribute('aria-disabled', enable ? 'false' : 'true');
    buttons.forEach((b) => (b.disabled = !enable));
  });
}

// Descarga cursos y plan
async function fetchCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id,name,year,cuat,pos')
    .gte('year', 2)
    .order('year')
    .order('cuat')
    .order('pos');
  if (error) {
    console.error('DB:', error);
    return [];
  }
  return data || [];
}

async function loadPlan() {
  renderSkeleton();
  const courses = await fetchCourses();
  renderCourses(courses);
  const { data: entries, error } = await supabase
    .from('plan_entries')
    .select('course_id,status')
    .eq('user_id', ADMIN_UUID);
  if (error) {
    console.error('DB:', error);
    return;
  }
  (entries || []).forEach((row) => {
    applyStatus(row.course_id, row.status);
  });
}

function applyStatus(courseId, status) {
  const elem = subjectElements.get(courseId);
  if (!elem) return;
  elem.buttons.forEach((b) => {
    const checked = b.dataset.value === status;
    b.setAttribute('aria-checked', checked ? 'true' : 'false');
  });
}

function renderSkeleton() {
  const container = document.getElementById('ruta-estudios');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const s = document.createElement('div');
    s.className = 'skeleton';
    container.appendChild(s);
  }
}

// Agrupa cursos por año y cuatrimestre y dibuja las tarjetas
function renderCourses(courses) {
  const container = document.getElementById('ruta-estudios');
  if (!container) return;
  container.innerHTML = '';
  subjectElements.clear();

  const grouped = {};
  courses.forEach((c) => {
    grouped[c.year] = grouped[c.year] || {};
    grouped[c.year][c.cuat] = grouped[c.year][c.cuat] || [];
    grouped[c.year][c.cuat].push(c);
  });

  const cuatLabels = {
    3: 'Tercer',
    4: 'Cuarto',
    5: 'Quinto',
    6: 'Sexto',
    7: 'Séptimo',
    8: 'Octavo',
    9: 'Noveno',
    10: 'Décimo',
    11: 'Undécimo'
  };

  Object.keys(grouped)
    .sort((a, b) => a - b)
    .forEach((year) => {
      const yearPanel = document.createElement('div');
      yearPanel.className = 'year-panel';
      const h3 = document.createElement('h3');
      h3.textContent = `Año ${year}`;
      yearPanel.appendChild(h3);
      const timeline = document.createElement('div');
      timeline.className = 'timeline';
      yearPanel.appendChild(timeline);
      const cuatGrid = document.createElement('div');
      cuatGrid.className = 'cuat-grid';

      const yearData = grouped[year];
      Object.keys(yearData)
        .sort((a, b) => a - b)
        .forEach((cuat) => {
          const cuatPanel = document.createElement('div');
          cuatPanel.className = 'cuat-panel';
          const h4 = document.createElement('h4');
          h4.textContent = cuatLabels[cuat] || `Cuat. ${cuat}`;
          cuatPanel.appendChild(h4);

          yearData[cuat].forEach((course) => {
            const card = document.createElement('div');
            card.className = 'subject-card';
            const name = document.createElement('span');
            name.textContent = course.name;
            card.appendChild(name);

            const group = document.createElement('div');
            group.className = 'estado-pills';
            group.setAttribute('role', 'radiogroup');

            const buttons = [];
            states.forEach((s) => {
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.textContent = s.label;
              btn.className = s.value;
              btn.dataset.value = s.value;
              btn.setAttribute('role', 'radio');
              btn.setAttribute('aria-checked', 'false');
              btn.addEventListener('click', () => {
                if (!isAdmin) return;
                applyStatus(course.id, s.value);
                debounceSave(course.id, s.value);
              });
              group.appendChild(btn);
              buttons.push(btn);
            });

            card.appendChild(group);
            cuatPanel.appendChild(card);
            subjectElements.set(course.id, { card, group, buttons });
            applyStatus(course.id, 'futura');
          });

          cuatGrid.appendChild(cuatPanel);
        });

      yearPanel.appendChild(cuatGrid);
      container.appendChild(yearPanel);
    });
}

function debounceSave(courseId, status) {
  clearTimeout(pending.get(courseId));
  const t = setTimeout(async () => {
    try {
      await upsertPlanEntry(courseId, status);
      showToast('Guardado ✓');
    } catch (err) {
      console.error('DB:', err);
      showToast('Error al guardar', true);
    }
  }, 250);
  pending.set(courseId, t);
}

// Inserta/actualiza el plan en plan_entries usando upsert
async function upsertPlanEntry(courseId, status) {
  const { error } = await supabase
    .from('plan_entries')
    .upsert({ user_id: ADMIN_UUID, course_id: courseId, status });
  if (error) {
    console.error('DB:', error);
    throw error;
  }
}

// Realtime para plan_entries
function subscribeRealtime() {
  planChannel?.unsubscribe();
  planChannel = supabase
    .channel('public:plan_entries')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'plan_entries' },
      (payload) => {
        const data = payload.new ?? payload.old;
        if (data.user_id !== ADMIN_UUID) return;
        const courseId = data.course_id;
        const status = payload.eventType === 'DELETE' ? 'futura' : data.status;
        applyStatus(courseId, status);
        console.log('RT:', payload.eventType, courseId, status);
      }
    )
    .subscribe();
}

async function initialize() {
  await loadPlan();
  subscribeRealtime();
  setEditing(isAdmin);
}

// Manejo de sesiones
async function handleSession(session) {
  if (session) {
    isAdmin = session.user.email === ADMIN_EMAIL;
    await initialize();
    showApp();
  } else {
    showLogin();
  }
}

// Eventos de login
viewerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const pw = document.getElementById('pw-viewer').value;
  const { error } = await supabase.auth.signInWithPassword({
    email: VIEWER_EMAIL,
    password: pw,
  });
  if (error) {
    console.error('AUTH:', error);
    showError('Contraseña incorrecta');
    return;
  }
  console.log('AUTH: viewer login OK');
});

showAdminBtn?.addEventListener('click', () => {
  adminForm.hidden = !adminForm.hidden;
});

adminForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  const pw = document.getElementById('pw-admin').value;
  const { error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: pw,
  });
  if (error) {
    console.error('AUTH:', error);
    showError('Contraseña incorrecta');
    return;
  }
  console.log('AUTH: admin login OK');
});

signOutBtn?.addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error('AUTH:', error);
  console.log('AUTH: signed out');
});

// Inicio: revisa si hay sesión
const {
  data: { session }
} = await supabase.auth.getSession();
handleSession(session);

supabase.auth.onAuthStateChange((_evt, sess) => {
  handleSession(sess);
});

