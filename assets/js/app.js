// app.js - Manejo de autenticación y plan de estudios
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Constantes de Supabase y cuentas ---
const SUPABASE_URL = 'https://njzzuqdnigafpymgvizr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qenp1cWRuaWdhZnB5bWd2aXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTE1NjQsImV4cCI6MjA3MTYyNzU2NH0.eq_o2LFRxX2tLMvXpkc-jJFuzIX_orjBFAoWWyAVqt8';
const VIEWER_EMAIL = 'viewer@fiuba.local';   // cuenta compartida
const ADMIN_EMAIL = 'juanpablo20240604@gmail.com'; // correo del editor
const ADMIN_UUID = 'e6c2299b-a401-40b2-8af9-550cd0d8c2cc';      // uuid del admin

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
let mode = null; // 'viewer' | 'admin'

// Elementos del DOM
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const signOutBtn = document.getElementById('signout-btn');
const modeBadge = document.getElementById('mode-badge');
const tabButtons = document.querySelectorAll('[role="tab"]');
const viewerForm = document.getElementById('viewer-form');
const adminForm = document.getElementById('admin-form');
const viewerError = document.getElementById('viewer-error');
const adminError = document.getElementById('admin-error');
const updatedEl = document.getElementById('updated');

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function setMode(newMode) {
  mode = newMode;
  modeBadge.textContent = newMode === 'admin' ? 'Modo editor' : 'Modo lectura';
  modeBadge.className = `badge${newMode === 'admin' ? ' admin' : ''}`;
  setEditing(newMode === 'admin');
}

// Muestra/oculta vistas
function showLogin() {
  loginView.hidden = false;
  appView.hidden = true;
  signOutBtn.hidden = true;
  modeBadge.hidden = true;
}
function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  signOutBtn.hidden = false;
  modeBadge.hidden = false;
}

// Deshabilita o habilita selects
function setEditing(enable) {
  subjectElements.forEach(({ select }) => {
    select.disabled = !enable;
  });
}

// renderiza pestañas y toggles de contraseña
function renderAuthPanel() {
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => activateTab(btn));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const buttons = Array.from(tabButtons);
        const idx = buttons.indexOf(btn);
        const next = (idx + dir + buttons.length) % buttons.length;
        buttons[next].focus();
        activateTab(buttons[next]);
        e.preventDefault();
      }
    });
  });

  function activateTab(active) {
    tabButtons.forEach((btn) => {
      const selected = btn === active;
      btn.setAttribute('aria-selected', selected);
      document.getElementById(btn.getAttribute('aria-controls')).hidden = !selected;
    });
  }

  document.querySelectorAll('.pw-wrapper').forEach((wrap) => {
    const input = wrap.querySelector('input');
    const toggle = wrap.querySelector('.toggle-pw');
    toggle.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      toggle.textContent = show ? '🙈' : '👁️';
      toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
  });
}

// login del viewer
async function loginViewer(e) {
  e.preventDefault();
  viewerError.textContent = '';
  const btn = document.getElementById('viewer-submit');
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  const pw = document.getElementById('pw-viewer').value;
  const { error } = await supabase.auth.signInWithPassword({ email: VIEWER_EMAIL, password: pw });
  btn.disabled = false;
  btn.textContent = 'Entrar';
  if (error) {
    viewerError.textContent = 'Contraseña incorrecta';
    return;
  }
}

// login del admin
async function loginAdmin(e) {
  e.preventDefault();
  adminError.textContent = '';
  const btn = document.getElementById('admin-submit');
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  const pw = document.getElementById('pw-admin').value;
  const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pw });
  btn.disabled = false;
  btn.textContent = 'Entrar';
  if (error) {
    adminError.textContent = 'Contraseña incorrecta';
    return;
  }
}

// cierra sesión
async function logout() {
  await supabase.auth.signOut();
}

// consulta última actualización
async function updateLastUpdated() {
  const { data, error } = await supabase
    .from('plan_entries')
    .select('updated_at')
    .eq('user_id', ADMIN_UUID)
    .order('updated_at', { ascending: false })
    .limit(1);
  if (error || !data || !data.length) {
    updatedEl.textContent = '—';
    return;
  }
  updatedEl.textContent = new Date(data[0].updated_at).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// restaura sesión al cargar
async function restoreSession() {
  const {
    data: { session }
  } = await supabase.auth.getSession();
  await handleSession(session);
  supabase.auth.onAuthStateChange((_evt, sess) => handleSession(sess));
}

async function handleSession(session) {
  if (session) {
    const isAdm = session.user.id === ADMIN_UUID || session.user.email === ADMIN_EMAIL;
    setMode(isAdm ? 'admin' : 'viewer');
    await initialize();
    showApp();
  } else {
    showLogin();
    setMode('viewer');
  }
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
          select.disabled = mode !== 'admin';
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
    showToast('Error al guardar', 'err');
    throw error;
  }
  showToast('Guardado', 'ok');
  updateLastUpdated();
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
        updateLastUpdated();
        console.log('RT:', payload.eventType, courseId, status);
      }
    )
    .subscribe();
}

async function initialize() {
  await loadPlan();
  subscribeRealtime();
  await updateLastUpdated();
}

// Eventos de UI
viewerForm?.addEventListener('submit', loginViewer);
adminForm?.addEventListener('submit', loginAdmin);
signOutBtn?.addEventListener('click', logout);

// Inicio
renderAuthPanel();
updateLastUpdated();
restoreSession();

