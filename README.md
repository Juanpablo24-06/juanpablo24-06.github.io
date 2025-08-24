# Sitio para GitHub Pages

Este repositorio contiene un sitio estático para publicar en `https://<tu-usuario>.github.io`.

## Estructura
- `index.html`: página principal
- `styles.css`: estilos

## Publicación
1. Ve a **Settings → Pages**.
2. En **Build and deployment**, elige **Deploy from a branch**.
3. Elige la rama `main` y la carpeta `/ (root)`.
4. Guarda. La URL será `https://<tu-usuario>.github.io`.

## Edición
Puedes editar los archivos desde el navegador (icono ✏️) o pulsando `.` en el repo para abrir el editor web.

## Horario semanal
Los eventos de "Mi Horario Semanal" se editan en `assets/js/schedule.js`. Cada elemento del arreglo `events` tiene la forma:

```js
{ title: "Materia", day: 1, start: 9, end: 12 }
```

- `title`: nombre a mostrar.
- `day`: número del día (1=Lunes, 7=Domingo).
- `start` y `end`: horas en formato 24 h.

Agrega, elimina o modifica estos objetos para actualizar tu horario sin tocar el HTML.
