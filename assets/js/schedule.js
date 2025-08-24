import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://njzzuqdnigafpymgvizr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qenp1cWRuaWdhZnB5bWd2aXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTE1NjQsImV4cCI6MjA3MTYyNzU2NH0.eq_o2LFRxX2tLMvXpkc-jJFuzIX_orjBFAoWWyAVqt8";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
let events = [];

async function fetchAndRender() {
  const { data, error } = await supabase.from('events').select('*');
  if (error) {
    console.error('Error al cargar eventos', error);
    // Render an empty schedule so the grid is visible even if Supabase fails
    buildSchedule([]);
    return;
  }
  events = data || [];
  buildSchedule(events);
}

function buildSchedule(events) {
  const grid = document.getElementById('schedule');
  if (!grid) return;
  grid.innerHTML = '';

  // Encabezados de días
  days.forEach((day, index) => {
    const cell = document.createElement('div');
    cell.className = 'day-header';
    cell.textContent = day;
    cell.style.gridColumn = index + 2;
    cell.style.gridRow = 1;
    grid.appendChild(cell);
  });

  // Etiquetas de horas de 9:00 a 22:00
  for (let h = 9; h <= 22; h++) {
    const label = document.createElement('div');
    label.className = 'time-label';
    label.textContent = `${h}:00`;
    label.style.gridColumn = 1;
    label.style.gridRow = h - 9 + 2;
    grid.appendChild(label);
  }

  // Cuadrícula para bordes
  for (let h = 9; h < 22; h++) {
    for (let d = 0; d < 7; d++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.style.gridColumn = d + 2;
      slot.style.gridRow = h - 9 + 2;
      grid.appendChild(slot);
    }
  }

  // Eventos
  events.forEach(evt => {
    const el = document.createElement('div');
    el.className = 'event';
    el.setAttribute('aria-label', `${evt.title}, ${evt.start}:00 a ${evt.end}:00`);
    el.style.gridColumn = evt.day + 2;
    el.style.gridRow = `${evt.start - 9 + 2} / ${evt.end - 9 + 2}`;
    el.innerHTML = `<strong>${evt.title}</strong><span>${evt.start}–${evt.end}</span>`;
    grid.appendChild(el);
  });
}

function setupRealtime() {
  supabase
    .channel('public:events')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
      fetchAndRender();
    })
    .subscribe();
}

window.addEvent = async function(title, day, start, end) {
  const { error } = await supabase.from('events').insert([{ title, day, start, end }]);
  if (error) {
    console.error('Error al agregar evento', error);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  fetchAndRender();
  setupRealtime();
});
