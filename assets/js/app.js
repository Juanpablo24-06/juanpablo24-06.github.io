// app.js - Manejo de autenticación y plan de estudios
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Constantes de Supabase (reemplaza con las tuyas) ---
const SUPABASE_URL = 'https://njzzuqdnigafpymgvizr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qenp1cWRuaWdhZnB5bWd2aXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTE1NjQsImV4cCI6MjA3MTYyNzU2NH0.eq_o2LFRxX2tLMvXpkc-jJFuzIX_orjBFAoWWyAVqt8';
const VIEWER_EMAIL = 'viewer@fiuba.local';
const ADMIN_EMAIL = 'juanpablo20240604@gmail.com';
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
let planChannel = null;
let isAdmin = false;

// Elementos del DOM
const viewerForm = document.getElementById('viewer-form');
const adminForm = document.getElementById('admin-form');
const showAdminBtn = document.getElementById('show-admin-btn');
const authMsg = document.getElementById('auth-msg');
const signOutBtn = document.getElementById('signout-btn');

function showError(msg) {
  authMsg.textContent = msg;
}
function clearError() {
  authMsg.textContent = '';
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

// Deshabilita o habilita selects
function setEditing(enable) {
  subjectElements.forEach(({ select }) => {
    select.disabled = !enable;
  });
}

// Descarga cursos y plan
async function fetchCourses() {
  const { data, error } = await supabase
    .from('courses')
    .select('id,name,year,cuat,pos')
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
    const elem = subjectElements.get(row.course_id);
    if (!elem) return;
    elem.select.value = row.status;
    elem.pill.classList.remove(...states.map((s) => `estado-${s.value}`));
    elem.pill.classList.add(`estado-${row.status}`);
  });
}

// Renderiza cursos y sus selects
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

  Object.keys(grouped)
    .sort((a, b) => a - b)
    .forEach((year) => {
      const yearData = grouped[year];
      const details = document.createElement('details');
      details.className = 'plan-year';
      details.open = true;
      const summary = document.createElement('summary');
      summary.className = 'year-header';
      summary.textContent = `Año ${year}`;
      const steps = document.createElement('div');
      steps.className = 'year-steps';
      const cuats = Object.keys(yearData).sort((a, b) => a - b);
      cuats.forEach(() => {
        const step = document.createElement('span');
        step.className = 'step';
        steps.appendChild(step);
      });
      summary.appendChild(steps);
      details.appendChild(summary);
      const grid = document.createElement('div');
      grid.className = 'cuatimestres';
      cuats.forEach((cuat) => {
        const col = document.createElement('div');
        col.className = 'cuatrimestre';
        const h4 = document.createElement('h4');
        h4.textContent = `Cuatr. ${cuat}`;
        col.appendChild(h4);
        yearData[cuat].forEach((course) => {
          const pill = document.createElement('div');
          pill.className = 'materia-pill estado-futura';
          pill.dataset.courseId = course.id;
          const span = document.createElement('span');
          span.textContent = course.name;
          pill.appendChild(span);
          const select = document.createElement('select');
          select.dataset.courseId = course.id;
          states.forEach((st) => {
            const opt = document.createElement('option');
            opt.value = st.value;
            opt.textContent = st.label;
            select.appendChild(opt);
          });
          select.value = 'futura';
          select.disabled = !isAdmin;
          select.addEventListener('change', async () => {
            const status = select.value;
            pill.classList.remove(...states.map((s) => `estado-${s.value}`));
            pill.classList.add(`estado-${status}`);
            try {
              await upsertPlanEntry(course.id, status);
            } catch (err) {
              console.error('DB:', err);
            }
          });
          pill.appendChild(select);
          col.appendChild(pill);
          subjectElements.set(course.id, { pill, select });
        });
        grid.appendChild(col);
      });
      details.appendChild(grid);
      container.appendChild(details);
    });
}

// Inserta/actualiza el plan
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
        const elem = subjectElements.get(courseId);
        if (!elem) return;
        elem.select.value = status;
        elem.pill.classList.remove(...states.map((s) => `estado-${s.value}`));
        elem.pill.classList.add(`estado-${status}`);
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

