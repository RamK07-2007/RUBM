/**
 * RUBM v3.0 — Premium Animated Background (Gooey Mesh Gradient)
 * bg.js
 *
 * Gestiona la interacción del mouse con el fondo animado HTML/CSS.
 * - Sigue al cursor con la burbuja .interactive (easing suave)
 * - Detecta proximidad a las burbujas g1-g5 y activa .is-near
 *   para que la burbuja interactiva se extienda sin separarse
 */

export function initBackground() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  const interBubble = document.querySelector('.interactive');
  if (!interBubble) return;

  // Registrar las burbujas estáticas para detectar proximidad
  const staticBubbles = [
    document.querySelector('.g1'),
    document.querySelector('.g2'),
    document.querySelector('.g3'),
    document.querySelector('.g4'),
    document.querySelector('.g5'),
  ].filter(Boolean);

  let curX = 0;
  let curY = 0;
  let tgX = window.innerWidth / 2;
  let tgY = window.innerHeight / 2;

  // Umbral de proximidad en px (si el mouse se acerca a menos de esto de
  // cualquier burbuja estática, la interactiva se "extiende")
  const PROXIMITY_THRESHOLD = 260;

  function getCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function dist(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  window.addEventListener('mousemove', (event) => {
    tgX = event.clientX;
    tgY = event.clientY;
  });

  function move() {
    curX += (tgX - curX) / 18;  // easing factor — higher = slower & smoother
    curY += (tgY - curY) / 18;

    interBubble.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;

    // Check if the cursor is near any static blob
    const isNear = staticBubbles.some((blob) => {
      const c = getCenter(blob);
      return dist(tgX, tgY, c.x, c.y) < PROXIMITY_THRESHOLD;
    });

    // Toggle the CSS class that makes the interactive bubble expand
    interBubble.classList.toggle('is-near', isNear);

    requestAnimationFrame(move);
  }

  move();
}
