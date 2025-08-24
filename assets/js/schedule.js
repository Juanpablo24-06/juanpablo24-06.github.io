const events = [
  { title: "Curso de Testing Master", day: 1, start: 9, end: 12 },
  { title: "Curso de Testing Master", day: 2, start: 9, end: 12 },
  { title: "Curso de Testing Master", day: 3, start: 9, end: 12 },
  { title: "Curso de Testing Master", day: 4, start: 9, end: 12 },
  { title: "Curso de Testing Master", day: 5, start: 9, end: 12 },
  { title: "Álgebra práctica", day: 1, start: 13, end: 15 },
  { title: "Álgebra práctica", day: 3, start: 13, end: 15 },
  { title: "Álgebra teórica", day: 1, start: 15, end: 17 },
  { title: "Álgebra teórica", day: 3, start: 15, end: 17 },
  { title: "Física de los sistemas de partículas", day: 2, start: 14, end: 17 },
  { title: "Física de los sistemas de partículas", day: 4, start: 14, end: 17 },
  { title: "Análisis matemático", day: 1, start: 20, end: 22 },
  { title: "Química básica", day: 3, start: 20, end: 22 },
  { title: "Análisis matemático II", day: 5, start: 20, end: 22 }
];

const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function buildSchedule() {
  const grid = document.getElementById("schedule");
  if (!grid) return;
  grid.innerHTML = "";

  // Encabezados de días
  days.forEach((day, index) => {
    const cell = document.createElement("div");
    cell.className = "day-header";
    cell.textContent = day;
    cell.style.gridColumn = index + 2;
    cell.style.gridRow = 1;
    grid.appendChild(cell);
  });

  // Etiquetas de horas de 9:00 a 22:00
  for (let h = 9; h <= 22; h++) {
    const label = document.createElement("div");
    label.className = "time-label";
    label.textContent = `${h}:00`;
    label.style.gridColumn = 1;
    label.style.gridRow = h - 9 + 2;
    grid.appendChild(label);
  }

  // Cuadrícula para bordes
  for (let h = 9; h < 22; h++) {
    for (let d = 0; d < 7; d++) {
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.style.gridColumn = d + 2;
      slot.style.gridRow = h - 9 + 2;
      grid.appendChild(slot);
    }
  }

  // Eventos
  events.forEach(evt => {
    const el = document.createElement("div");
    el.className = "event";
    el.setAttribute("aria-label", `${evt.title}, ${evt.start}:00 a ${evt.end}:00`);
    el.style.gridColumn = evt.day + 2;
    el.style.gridRow = `${evt.start - 9 + 2} / ${evt.end - 9 + 2}`;
    el.innerHTML = `<strong>${evt.title}</strong><span>${evt.start}–${evt.end}</span>`;
    grid.appendChild(el);
  });
}

document.addEventListener("DOMContentLoaded", buildSchedule);
