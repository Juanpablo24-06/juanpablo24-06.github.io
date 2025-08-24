// app.js - UI/UX mejorada manteniendo la lógica con Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// --- Constantes de Supabase (usa tus valores reales) ---
const SUPABASE_URL = 'https://njzzuqdnigafpymgvizr.supabase.co'; // URL del proyecto
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qenp1cWRuaWdhZnB5bWd2aXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTE1NjQsImV4cCI6MjA3MTYyNzU2NH0.eq_o2LFRxX2tLMvXpkc-jJFuzIX_orjBFAoWWyAVqt8'; // anon key
const VIEWER_EMAIL = 'viewer@fiuba.local';   // cuenta de solo lectura
const ADMIN_EMAIL  = 'juanpablo20240604@gmail.com'; // cuenta editora
const ADMIN_UUID   = 'e6c2299b-a401-40b2-8af9-550cd0d8c2cc'; // id del admin

let supabase; // cliente global
let mode = 'viewer'; // modo actual
const states = [
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'cursando', label: 'Cursando' },
  { value: 'regular',  label: 'Regular con final' },
  { value: 'futura',   label: 'Futura' },
  { value: 'recursar', label: '¡A recursar!' }
];
const controls = new Map(); // course_id -> segmented control
const saveTimers = new Map(); // timers de debounce
let channel; // realtime channel

// ---- Helpers de UI ----
function qs(id){ return document.getElementById(id); }
function toast(msg){
  const t = qs('toast');
  t.textContent = msg;
  t.classList.add('show');
  t.hidden = false;
  setTimeout(()=>{ t.classList.remove('show'); },1500);
}
function showAuth(msg){ qs('auth-msg').textContent = msg || ''; }
function showSkeleton(){
  const yrs = qs('years');
  yrs.innerHTML = '';
  for(let i=0;i<5;i++){
    const sk = document.createElement('div');
    sk.className = 'skeleton';
    yrs.appendChild(sk);
  }
}

// ---- Supabase ----
export function initSupabase(){
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export async function loadCourses(){
  const { data, error } = await supabase
    .from('courses')
    .select('id,name,year,cuat,pos')
    .gte('year',2)
    .order('year')
    .order('cuat')
    .order('pos');
  if(error){ console.error(error); return []; }
  return data;
}

export async function loadPlan(){
  const { data, error } = await supabase
    .from('plan_entries')
    .select('course_id,status')
    .eq('user_id', ADMIN_UUID);
  if(error){ console.error(error); return {}; }
  const map = {};
  (data||[]).forEach(r=> map[r.course_id] = r.status );
  return map;
}

export function applyPlanToUI(plan){
  Object.entries(plan).forEach(([courseId,status])=>{
    updateControl(Number(courseId), status);
  });
}

export function renderYearPanels(courses){
  const yrs = qs('years');
  yrs.innerHTML = '';
  const grouped = new Map();
  courses.forEach(c=>{
    if(!grouped.has(c.year)) grouped.set(c.year,{});
    if(!grouped.get(c.year)[c.cuat]) grouped.get(c.year)[c.cuat] = [];
    grouped.get(c.year)[c.cuat].push(c);
  });
  [...grouped.keys()].sort((a,b)=>a-b).forEach(year=>{
    const yearSection = document.createElement('section');
    yearSection.className = 'year';
    const title = document.createElement('h2');
    title.className = 'year-title';
    title.textContent = `Año ${year}`;
    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    const cuats = Object.keys(grouped.get(year)).map(Number).sort((a,b)=>a-b);
    cuats.forEach((cuat,idx)=>{
      const b = document.createElement('span');
      b.className = 'badge';
      b.style.setProperty('--i', idx/(cuats.length-1 || 1));
      b.textContent = cuat + '°';
      timeline.appendChild(b);
    });
    title.appendChild(timeline);
    yearSection.appendChild(title);
    const quarters = document.createElement('div');
    quarters.className = 'quarters';
    cuats.forEach(cuat=>{
      quarters.appendChild(renderQuarter(grouped.get(year)[cuat], cuat));
    });
    yearSection.appendChild(quarters);
    yrs.appendChild(yearSection);
  });
}

export function renderQuarter(courses, cuat){
  const q = document.createElement('div');
  q.className = 'quarter';
  const names = {3:'Tercer Cuat.',4:'Cuarto Cuat.',5:'Quinto Cuat.',6:'Sexto Cuat.',7:'Séptimo Cuat.',8:'Octavo Cuat.',9:'Noveno Cuat.',10:'Décimo Cuat.',11:'Undécimo Cuat.'};
  const h = document.createElement('h3');
  h.textContent = names[cuat] || `Cuat. ${cuat}`;
  q.appendChild(h);
  courses.forEach(course=>{
    const c = document.createElement('div');
    c.className = 'course';
    const span = document.createElement('span');
    span.className = 'title';
    span.textContent = course.name;
    span.title = course.name;
    const control = statusControl(course.id, 'futura', mode !== 'admin');
    controls.set(course.id, control);
    c.append(span, control);
    q.appendChild(c);
  });
  return q;
}

export function statusControl(courseId, currentStatus, disabled){
  const group = document.createElement('div');
  group.className = 'segmented';
  group.setAttribute('role','radiogroup');
  if(disabled){ group.classList.add('disabled'); group.setAttribute('aria-disabled','true'); }
  states.forEach(s=>{
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = s.label;
    btn.dataset.value = s.value;
    btn.className = `state-${s.value}`;
    btn.setAttribute('role','radio');
    btn.setAttribute('aria-checked', s.value===currentStatus);
    if(s.value===currentStatus) btn.classList.add('active');
    if(disabled) btn.disabled = true;
    btn.addEventListener('click', ()=>{
      if(btn.disabled) return;
      updateControl(courseId, s.value);
      saveStatus(courseId, s.value);
    });
    group.appendChild(btn);
  });
  return group;
}

function updateControl(courseId, status){
  const group = controls.get(courseId);
  if(!group) return;
  group.querySelectorAll('button').forEach(btn=>{
    const active = btn.dataset.value === status;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active);
  });
}

export function saveStatus(courseId, status){
  if(mode !== 'admin') return;
  clearTimeout(saveTimers.get(courseId));
  saveTimers.set(courseId, setTimeout(async()=>{
    toast('guardando…');
    const { error } = await supabase
      .from('plan_entries')
      .upsert({ user_id: ADMIN_UUID, course_id: courseId, status });
    if(error){ console.error(error); toast('error'); }
    else toast('guardado ✓');
  },250));
}

export function subscribeRealtime(){
  channel?.unsubscribe();
  channel = supabase.channel('public:plan_entries')
    .on('postgres_changes',{ event:'*', schema:'public', table:'plan_entries', filter:`user_id=eq.${ADMIN_UUID}`}, payload => {
      const data = payload.new ?? payload.old;
      const status = payload.eventType === 'DELETE' ? 'futura' : data.status;
      updateControl(data.course_id, status);
    })
    .subscribe();
}

export function setMode(m){
  mode = m;
  const editing = mode === 'admin';
  qs('login-view').hidden = true;
  qs('app-view').hidden = false;
  qs('logout-btn').hidden = false;
  controls.forEach(group=>{
    group.classList.toggle('disabled', !editing);
    group.querySelectorAll('button').forEach(btn=>{ btn.disabled = !editing; });
  });
}

export async function restoreSession(){
  const { data:{ session } } = await supabase.auth.getSession();
  if(session){
    const m = session.user.email === ADMIN_EMAIL ? 'admin' : 'viewer';
    setMode(m);
    await startApp();
  }
}

export async function logout(){
  await supabase.auth.signOut();
  location.reload();
}

// ---- Inicio ----
async function startApp(){
  showSkeleton();
  const courses = await loadCourses();
  renderLegend();
  renderYearPanels(courses);
  const plan = await loadPlan();
  applyPlanToUI(plan);
  subscribeRealtime();
}

function renderLegend(){
  const cont = qs('legend');
  cont.innerHTML = '';
  states.forEach(s=>{
    const p = document.createElement('span');
    p.className = `pill state-${s.value} disabled`;
    p.textContent = s.label;
    cont.appendChild(p);
  });
}

// Eventos de login
qs('viewer-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  showAuth('');
  const pw = qs('pw-viewer').value;
  const { error } = await supabase.auth.signInWithPassword({ email: VIEWER_EMAIL, password: pw });
  if(error){ showAuth('Contraseña incorrecta'); return; }
  setMode('viewer');
  await startApp();
});

qs('show-admin')?.addEventListener('click',()=>{
  const f = qs('admin-form');
  f.hidden = !f.hidden;
});

qs('admin-form')?.addEventListener('submit', async (e)=>{
  e.preventDefault();
  showAuth('');
  const pw = qs('pw-admin').value;
  const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: pw });
  if(error){ showAuth('Contraseña incorrecta'); return; }
  setMode('admin');
  await startApp();
});

qs('logout-btn')?.addEventListener('click', logout);

// Inicialización
initSupabase();
restoreSession();
