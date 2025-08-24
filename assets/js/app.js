import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Claves públicas de Supabase (cámbialas por las tuyas si es necesario)
const SUPABASE_URL = 'https://njzzuqdnigafpymgvizr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qenp1cWRuaWdhZnB5bWd2aXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTE1NjQsImV4cCI6MjA3MTYyNzU2NH0.eq_o2LFRxX2tLMvXpkc-jJFuzIX_orjBFAoWWyAVqt8';

// Inicializa el cliente
export let supabase;

export function initSupabase() {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

// Estados posibles
const states = [
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'cursando', label: 'Cursando' },
  { value: 'regular', label: 'Regular con final' },
  { value: 'futura', label: 'Futura' },
  { value: 'recursar', label: 'A recursar' }
];

// Mapa de elementos por course_id
const subjectElements = new Map();
let planChannel = null;

// Muestra un mensaje breve
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// Obtiene el usuario actual
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Maneja el retorno del magic link
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(location.href);
    if (error) console.error('AUTH:', error);
    history.replaceState(null, '', '/');
  }
}

// Obtiene la sesión actual
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Descarga cursos
export async function fetchCourses() {
    const { data, error } = await supabase
      .from('courses')
      .select('id,name,year,cuat,pos')
      .order('year')
      .order('cuat')
      .order('pos');
    if (error) {
      console.error('DB:', error);
      toast(error.message);
      return [];
    }
    return data || [];
  }

// Carga el plan para el usuario
export async function loadPlan(user) {
    const courses = await fetchCourses();
    renderCourses(courses);
    const { data: entries, error } = await supabase
      .from('plan_entries')
      .select('course_id,status')
      .eq('user_id', user.id);
    if (error) {
      console.error('DB:', error);
      toast(error.message);
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

// Hace upsert del estado
export async function upsertPlanEntry(courseId, status) {
  const user = await getCurrentUser();
  const { error } = await supabase
    .from('plan_entries')
    .upsert({ user_id: user.id, course_id: courseId, status });
  if (error) {
    console.error('DB:', error);
    throw error;
  }
}

// Suscribe a cambios en tiempo real
export function subscribeRealtime(user) {
  planChannel?.unsubscribe();
  planChannel = supabase
    .channel('public:plan_entries')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'plan_entries', filter: `user_id=eq.${user.id}` },
      (payload) => {
        const data = payload.new ?? payload.old;
        const courseId = data.course_id;
        const status = payload.eventType === 'DELETE' ? 'futura' : data.status;
        const elem = subjectElements.get(courseId);
        if (!elem) return;
        elem.select.value = status;
        elem.pill.classList.remove(...states.map((s) => `estado-${s.value}`));
        elem.pill.classList.add(`estado-${status}`);
      }
    )
    .subscribe();
}

// Renderiza el formulario de login
export function handleLogin() {
  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://juanpablo24-06.github.io/',
        shouldCreateUser: true
      }
    });
    const msg = document.getElementById('auth-msg');
    msg.textContent = error ? error.message : 'Enviado, revisa tu correo.';
    if (error) console.error('AUTH:', error);
  });
  const signOutBtn = document.getElementById('signout-btn');
  signOutBtn?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('AUTH:', error);
  });
}

// Muestra/oculta vistas
function showLogin() {
  document.getElementById('login-view').hidden = false;
  document.getElementById('app-view').hidden = true;
  document.getElementById('signout-btn').hidden = true;
}
function showApp() {
  document.getElementById('login-view').hidden = true;
  document.getElementById('app-view').hidden = false;
  document.getElementById('signout-btn').hidden = false;
}

// Renderiza los cursos y selects
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
          select.setAttribute('aria-label', `${course.name} — Futura`);
          select.addEventListener('change', async () => {
            const status = select.value;
            pill.classList.remove(...states.map((s) => `estado-${s.value}`));
            pill.classList.add(`estado-${status}`);
            try {
              await upsertPlanEntry(course.id, status);
            } catch (err) {
              toast(err.message);
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

// Inicializa la app
async function initialize() {
  const user = await getCurrentUser();
  if (!user) return;
  await loadPlan(user);
  subscribeRealtime(user);
}

// Inicio
initSupabase();
handleLogin();
await handleRedirect();
const session = await getSession();
if (session) {
  showApp();
  await initialize();
} else {
  showLogin();
}

supabase.auth.onAuthStateChange(async (_evt, sess) => {
  if (sess) {
    showApp();
    await initialize();
  } else {
    showLogin();
  }
});
