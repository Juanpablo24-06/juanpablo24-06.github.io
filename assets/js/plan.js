const plan = [
  {
    anio: 2,
    cuatimestres: {
      "Tercer Cuat.": [
        "Análisis Matemático II",
        "Introducción a la Ingeniería Mecánica",
        "Física de los Sistemas de Partículas",
        "Química Básica"
      ],
      "Cuarto Cuat.": [
        "Conocimiento de Materiales Metálicos",
        "Diseño Mecánico",
        "Álgebra Lineal",
        "Mecánica Clásica del Cuerpo Rígido"
      ]
    }
  },
  {
    anio: 3,
    cuatimestres: {
      "Quinto Cuat.": [
        "Mecanismos",
        "Introducción a la Ciencia de Datos",
        "Introducción a la Mecánica del Sólido Deformable",
        "Termodinámica",
        "Análisis Matemático III"
      ],
      "Sexto Cuat.": [
        "Electricidad y Magnetismo",
        "Modelación Numérica",
        "Conocimiento de Materiales No Metálicos",
        "Probabilidad y Estadística",
        "Legislación y Ejercicio Profesional"
      ]
    }
  },
  {
    anio: 4,
    cuatimestres: {
      "Séptimo Cuat.": [
        "Ensayos Industriales",
        "Electrotecnia General",
        "Economía y Organización",
        "Taller de Manufactura Mecánica",
        "Mecánica de Fluidos"
      ],
      "Octavo Cuat.": [
        "Taller de Electrónica",
        "Proyecto de Instrumentación",
        "Máquinas Térmicas",
        "Impacto Social, Ambiental y Desarrollo Sustentable",
        "Tecnología Mecánica"
      ]
    }
  },
  {
    anio: 5,
    cuatimestres: {
      "Noveno Cuat.": [
        "Sistemas de Almacenamiento",
        "Transferencia de Calor y Masa y sus Instalaciones",
        "Daño y Fractura de Elementos Mecánicos",
        "Máquinas Eléctricas",
        "Sistemas de Control y Automatización"
      ],
      "Décimo Cuat.": [
        "Turbomáquinas",
        "Proyecto de Instalaciones Industriales",
        "Electivas/Optativas",
        "Trabajo Profesional de Ingeniería Mecánica o Tesis de Ingeniería Mecánica (4/12 créditos)"
      ]
    }
  },
  {
    anio: 6,
    cuatimestres: {
      "Undécimo Cuat.": [
        "Electivas/Optativas",
        "Elementos de Máquinas",
        "Mantenimiento y Calidad",
        "Trabajo Profesional de Ingeniería Mecánica o Tesis de Ingeniería Mecánica (8/12 créditos)"
      ]
    }
  }
];

const states = [
  { value: "aprobada", label: "✓ Aprobada" },
  { value: "cursando", label: "■ Cursando" },
  { value: "regular", label: "● Regular con final" },
  { value: "futura", label: "○ Futura" },
  { value: "recursar", label: "! A recursar" }
];

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

const subjectElements = {};

function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function renderPlan() {
  const container = document.getElementById("ruta-estudios");
  if (!container) return;

  const { data: rows } = await supabaseClient
    .from("subject_states")
    .select("subject_slug,status");
  const savedStates = {};
  (rows || []).forEach((row) => {
    savedStates[row.subject_slug] = row.status;
  });

  plan.forEach((anio) => {
    const details = document.createElement("details");
    details.className = "plan-year";
    details.open = true;

    const summary = document.createElement("summary");
    summary.className = "year-header";
    summary.textContent = `Año ${anio.anio}`;

    const steps = document.createElement("div");
    steps.className = "year-steps";
    const stepCount = Object.keys(anio.cuatimestres).length;
    for (let i = 0; i < stepCount; i++) {
      const step = document.createElement("span");
      step.className = "step";
      steps.appendChild(step);
    }
    summary.appendChild(steps);
    details.appendChild(summary);

    const grid = document.createElement("div");
    grid.className = "cuatimestres";

    Object.entries(anio.cuatimestres).forEach(([nombre, materias]) => {
      const col = document.createElement("div");
      col.className = "cuatrimestre";
      const h4 = document.createElement("h4");
      h4.textContent = nombre;
      col.appendChild(h4);

      materias.forEach((materia) => {
        const pill = document.createElement("div");
        pill.className = "materia-pill";

        const span = document.createElement("span");
        span.textContent = materia;
        pill.appendChild(span);

        const select = document.createElement("select");
        states.forEach((st) => {
          const opt = document.createElement("option");
          opt.value = st.value;
          opt.textContent = st.label;
          select.appendChild(opt);
        });

        const key = slugify(materia);
        const saved = savedStates[key] || "futura";
        select.value = saved;
        pill.classList.add(`estado-${saved}`);
        const initial = states.find((s) => s.value === saved);
        select.setAttribute("aria-label", `${materia} — ${initial.label}`);

        select.addEventListener("change", async () => {
          pill.classList.remove(
            ...states.map((s) => `estado-${s.value}`)
          );
          pill.classList.add(`estado-${select.value}`);
          await supabaseClient.from("subject_states").upsert({
            subject_slug: key,
            status: select.value,
          });
          const label = states.find((s) => s.value === select.value).label;
          select.setAttribute("aria-label", `${materia} — ${label}`);
        });

        pill.appendChild(select);
        col.appendChild(pill);
        subjectElements[key] = { pill, select, materia };
      });

      grid.appendChild(col);
    });

    details.appendChild(grid);
    container.appendChild(details);
  });

  const reset = document.createElement("button");
  reset.textContent = "Restablecer estados";
  reset.addEventListener("click", async () => {
    if (confirm("¿Borrar todos los estados guardados?")) {
      await supabaseClient.from("subject_states").delete().neq("id", 0);
      location.reload();
    }
  });
  container.appendChild(reset);

  supabaseClient
    .channel("public:subject_states")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "subject_states" },
      (payload) => {
        const slug = payload.new
          ? payload.new.subject_slug
          : payload.old.subject_slug;
        const status = payload.new ? payload.new.status : "futura";
        const elem = subjectElements[slug];
        if (!elem) return;
        elem.pill.classList.remove(
          ...states.map((s) => `estado-${s.value}`)
        );
        elem.pill.classList.add(`estado-${status}`);
        elem.select.value = status;
        const label = states.find((s) => s.value === status).label;
        elem.select.setAttribute(
          "aria-label",
          `${elem.materia} — ${label}`
        );
      }
    )
    .subscribe();
}

renderPlan();
