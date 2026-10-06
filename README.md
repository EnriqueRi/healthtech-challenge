# HealthTech Challenge · prototipos

Prototipos interactivos para tres retos del **Innovation Challenge de Xartec Salut (HealthTech2030)**:

## Idea principal: Alè

**Alè** es una IA que llama cada mañana al paciente con EPOC, conversa con él un minuto y analiza su voz: cuánto aguanta un «aaaa», el tono, las pausas para respirar y la tos. Compara al paciente consigo mismo y, si detecta un cambio, avisa al centro de salud para confirmarlo con una PCR capilar.

En el prototipo la llamada ocurre en el navegador: la voz es real (micrófono) y el análisis también; los umbrales son inventados. Funciona mejor en Chrome. Para ver una alerta: haz una llamada marcando «Guardar esta llamada como mi voz normal» y repítela con un «aaaa» corto, pausas y tos. Sin micrófono, usa los modos de demostración.

## Todos los prototipos

| Reto | Prototipo | Qué hace |
|---|---|---|
| **IDIAP Jordi Gol · Early Detection** | **Alè** (idea principal) | Llamada con IA que analiza voz, respiración y tos frente a la voz normal del paciente. |
| **IDIAP Jordi Gol · Early Detection** | EPOC Alerta | Control diario desde el móvil: síntomas, saturación, tos grabada y foto del esputo. Avisa al centro de salud, que lo confirma con una PCR capilar. |
| **Almirall · Decoding Disease** | HS Tracker | Registro de lesiones de hidradenitis (IHS4), panel del dermatólogo y un modelo de riesgo de brote de demostración. |
| **AFANOC · Care Journey** | Mi camino | El día del niño o adolescente con cáncer, el reparto de tareas en la familia y un resumen para la visita. |

## Cómo probarlo

Abre la página publicada (GitHub Pages) desde el móvil o el ordenador. No hay que instalar nada.

## Importante

- Es un **prototipo para enseñar la idea**. No es un producto sanitario ni da diagnósticos.
- Todos los datos son **inventados**. No se guarda ni se envía nada: todo ocurre en el navegador.
- El micrófono (tos y llamada de Alè) se usa solo en el propio dispositivo: el audio no se guarda ni se envía.

## Archivos

- `index.html` – estructura de las pantallas
- `styles.css` – diseño (adaptado a móvil)
- `app.js` – lógica de los prototipos con app
- `ale.js` – la llamada de Alè y el análisis de voz
- `Propuesta_HealthTech_Challenge.pdf` – documento explicativo

Autor: Enrique Rivas · 2026
