/**
 * RUBM v3.0 — Main Application
 * app.js
 *
 * Orquesta autenticación, UI y acceso a datos.
 * Usa ES Modules: importa config, db y realtime.
 *
 * Flujo de arranque:
 *   1. DOMContentLoaded → escuchar cambios de sesión de Supabase
 *   2. onAuthStateChange:
 *      - Sin sesión → mostrar pantalla de Auth
 *      - Con sesión → inicializar la app principal
 *
 * Secciones:
 *   1. Imports
 *   2. Constants & DOM helpers
 *   3. Application State
 *   4. Auth UI
 *   5. Toast System
 *   6. Modal System
 *   7. Utility / Security
 *   8. Migration (localStorage → Supabase)
 *   9. Cajita Management
 *  10. Box List Rendering
 *  11. Report Management
 *  12. Report Card Rendering
 *  13. Realtime Handlers
 *  14. Keyboard & Focus Handlers
 *  15. App Initialization
 */

/* =========================================================================
   1. IMPORTS
   ========================================================================= */

import { supabase }                        from './config.js';
import * as db                             from './db.js';
import { startRealtime, stopRealtime }     from './realtime.js';
import { initBackground }                  from './bg.js';


/* =========================================================================
   2. CONSTANTS & DOM HELPERS
   ========================================================================= */

const TOAST_DURATION = 3500;

/** @param {string} sel @returns {Element|null} */
const qs  = (sel)       => document.querySelector(sel);

/** @param {string} sel @returns {NodeList} */
const qsa = (sel)       => document.querySelectorAll(sel);


/* =========================================================================
   3. APPLICATION STATE
   ========================================================================= */

/** @type {Array<object>} Lista de cajitas cargadas desde Supabase */
let cajitas = [];

/** @type {string|null} ID (UUID) de la cajita seleccionada */
let selectedCajitaId = null;

/** @type {Array<object>} Reportes de la cajita seleccionada */
let reportes = [];

/** @type {string|null} ID del reporte actualmente en modo edición */
let editingReporteId = null;

/** @type {string|null} ID del reporte que se está por eliminar */
let reporteToDelete = null;

/** @type {string|null} ID de la cajita que se está por eliminar */
let cajitaToDelete = null;

/** @type {string|null} ID de la cajita en edición en el modal */
let cajitaBeingEdited = null;

/** Indica si hay cambios sin guardar en el reporte en edición */
let dirty = false;

/** IMEI/cajitaId al que el usuario quiere cambiar (si hay cambios sin guardar) */
let pendingSwitchCajitaId = null;

/** Usuario actualmente autenticado */
let currentUser = null;

/** Perfil del usuario actual */
let currentProfile = null;

/** Flag para saber si la app principal ya está iniciada */
let isAppInitialized = false;


/* =========================================================================
   3b. DOM REFERENCES (lazy – evaluadas después del DOMContentLoaded)
   ========================================================================= */

let dom = {};

function cacheDom() {
  dom = {
    /* ── Secciones ── */
    sectionAuth:            qs('#sectionAuth'),
    sectionApp:             qs('#sectionApp'),

    /* ── Auth ── */
    authLoginView:          qs('#authLoginView'),
    authRegisterView:       qs('#authRegisterView'),
    authResetView:          qs('#authResetView'),

    loginEmail:             qs('#loginEmail'),
    loginPassword:          qs('#loginPassword'),
    loginBtn:               qs('#loginBtn'),
    loginError:             qs('#loginError'),
    goToRegister:           qs('#goToRegister'),
    goToReset:              qs('#goToReset'),

    registerNombre:         qs('#registerNombre'),
    registerEmail:          qs('#registerEmail'),
    registerPassword:       qs('#registerPassword'),
    registerPasswordConf:   qs('#registerPasswordConf'),
    registerBtn:            qs('#registerBtn'),
    registerError:          qs('#registerError'),
    goToLogin:              qs('#goToLogin'),
    goToLoginFromReset:     qs('#goToLoginFromReset'),

    resetEmail:             qs('#resetEmail'),
    resetBtn:               qs('#resetBtn'),
    resetMsg:               qs('#resetMsg'),

    /* ── Header de la app ── */
    searchInput:            qs('#searchInput'),
    searchBtn:              qs('#searchBtn'),
    addBoxBtn:              qs('#addBoxBtn'),
    openListBtn:            qs('#openListBtn'),
    themeToggleBtn:         qs('#themeToggleBtn'),
    openProfileBtn:         qs('#openProfileBtn'),
    userNombreDisplay:      qs('#userNombreDisplay'),
    userAvatarDisplay:      qs('#userAvatarDisplay'),
    logoutBtn:              qs('#logoutBtn'),

    /* ── Usuarios Activos ── */
    onlineUsersBtn:         qs('#onlineUsersBtn'),
    onlineUsersDropdown:    qs('#onlineUsersDropdown'),
    onlineUsersCount:       qs('#onlineUsersCount'),
    onlineUsersList:        qs('#onlineUsersList'),

    /* ── Modal: Perfil ── */
    modalProfile:           qs('#modalProfile'),
    profileNameInput:       qs('#profileNameInput'),
    profileAvatarInput:     qs('#profileAvatarInput'),
    selectAvatarBtn:        qs('#selectAvatarBtn'),
    cropperCanvas:          qs('#cropperCanvas'),
    zoomSlider:             qs('#zoomSlider'),
    cancelProfile:          qs('#cancelProfile'),
    saveProfile:            qs('#saveProfile'),

    /* ── Contenido principal ── */
    emptyNotice:            qs('#emptyNotice'),
    reportsSection:         qs('#reportsSection'),
    selectedImeiTitle:      qs('#selectedImeiTitle'),
    reportsList:            qs('#reportsList'),
    addReportBtn:           qs('#addReportBtn'),

    /* ── Modal: Nueva cajita ── */
    modalAddBox:            qs('#modalAddBox'),
    newImeiInput:           qs('#newImeiInput'),
    newModemInput:          qs('#newModemInput'),
    newSimInput:            qs('#newSimInput'),
    cancelAddImei:          qs('#cancelAddImei'),
    confirmAddImei:         qs('#confirmAddImei'),

    /* ── Modal: Lista cajitas ── */
    modalListBoxes:         qs('#modalListBoxes'),
    boxListContainer:       qs('#boxListContainer'),
    closeListBtn:           qs('#closeListBtn'),

    /* ── Modal: Confirmar cambio con cambios sin guardar ── */
    modalConfirmLeave:      qs('#modalConfirmLeave'),
    cancelLeave:            qs('#cancelLeave'),
    confirmLeave:           qs('#confirmLeave'),

    /* ── Modal: Confirmar eliminar reporte ── */
    modalConfirmDelete:     qs('#modalConfirmDelete'),
    cancelDelete:           qs('#cancelDelete'),
    confirmDelete:          qs('#confirmDelete'),
    confirmDeleteText:      qs('#confirmDeleteText'),

    /* ── Modal: Editar cajita ── */
    modalEditBox:           qs('#modalEditBox'),
    editImeiInput:          qs('#editImeiInput'),
    editModemInput:         qs('#editModemInput'),
    editSimInput:           qs('#editSimInput'),
    currentImeiText:        qs('#currentImeiText'),
    cancelEditBox:          qs('#cancelEditBox'),
    confirmEditBox:         qs('#confirmEditBox'),

    /* ── Modal: Confirmar eliminar cajita ── */
    modalConfirmDeleteBox:  qs('#modalConfirmDeleteBox'),
    cancelDeleteBox:        qs('#cancelDeleteBox'),
    confirmDeleteBox:       qs('#confirmDeleteBox'),
    confirmDeleteBoxText:   qs('#confirmDeleteBoxText'),

    /* ── Modal: Resultados de búsqueda ── */
    modalSearchResults:     qs('#modalSearchResults'),
    searchResultsContainer: qs('#searchResultsContainer'),
    closeSearchResults:     qs('#closeSearchResults'),
  };
}


/* =========================================================================
   4. AUTH UI
   ========================================================================= */

/** Muestra la sección de auth y oculta la app */
function showAuth(view = 'login') {
  dom.sectionAuth.style.display = '';
  dom.sectionApp.style.display  = 'none';
  stopRealtime();
  showAuthView(view);
}

/** Muestra la sección de app y oculta auth */
function showApp() {
  dom.sectionAuth.style.display = 'none';
  dom.sectionApp.style.display  = '';
}

/** Cambia entre login / register / reset dentro del panel de auth */
function showAuthView(view) {
  dom.authLoginView.style.display    = view === 'login'    ? '' : 'none';
  dom.authRegisterView.style.display = view === 'register' ? '' : 'none';
  dom.authResetView.style.display    = view === 'reset'    ? '' : 'none';

  clearAuthErrors();

  if (view === 'login')    { dom.loginEmail?.focus(); }
  if (view === 'register') { dom.registerNombre?.focus(); }
  if (view === 'reset')    { dom.resetEmail?.focus(); }
}

function clearAuthErrors() {
  if (dom.loginError)    { dom.loginError.textContent    = ''; dom.loginError.style.display    = 'none'; }
  if (dom.registerError) { dom.registerError.textContent = ''; dom.registerError.style.display = 'none'; }
  if (dom.resetMsg)      { dom.resetMsg.textContent      = ''; dom.resetMsg.className          = 'auth-msg'; }
}

/** @param {HTMLElement} el @param {string} msg */
function showAuthError(el, msg) {
  if (!el) return;
  el.textContent    = msg;
  el.style.display  = '';
}

/** Valida fortaleza de contraseña */
function validatePassword(pw) {
  if (pw.length < 8)             return 'La contraseña debe tener al menos 8 caracteres.';
  if (!/[A-Z]/.test(pw))         return 'La contraseña debe contener al menos una mayúscula.';
  if (!/[0-9]/.test(pw))         return 'La contraseña debe contener al menos un número.';
  return null;
}

function initAuthListeners() {
  /* Navegación entre vistas */
  dom.goToRegister?.addEventListener('click',       () => showAuthView('register'));
  dom.goToLogin?.addEventListener('click',          () => showAuthView('login'));
  dom.goToReset?.addEventListener('click',          () => showAuthView('reset'));
  dom.goToLoginFromReset?.addEventListener('click', () => showAuthView('login'));

  /* LOGIN */
  dom.loginBtn?.addEventListener('click', async () => {
    const email    = dom.loginEmail.value.trim();
    const password = dom.loginPassword.value;

    if (!email || !password) {
      showAuthError(dom.loginError, 'Completá email y contraseña.');
      return;
    }

    setAuthLoading(dom.loginBtn, true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setAuthLoading(dom.loginBtn, false);

    if (error) {
      const friendlyMsg =
        error.message.includes('Invalid login') || error.message.includes('invalid_credentials')
          ? 'Email o contraseña incorrectos.'
          : error.message;
      showAuthError(dom.loginError, friendlyMsg);
    }
    // Si no hay error, onAuthStateChange se dispara automáticamente
  });

  /* REGISTRO */
  dom.registerBtn?.addEventListener('click', async () => {
    const nombre   = dom.registerNombre.value.trim();
    const email    = dom.registerEmail.value.trim();
    const password = dom.registerPassword.value;
    const passConf = dom.registerPasswordConf.value;

    if (!nombre || !email || !password || !passConf) {
      showAuthError(dom.registerError, 'Completá todos los campos.');
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) { showAuthError(dom.registerError, pwError); return; }

    if (password !== passConf) {
      showAuthError(dom.registerError, 'Las contraseñas no coinciden.');
      return;
    }

    setAuthLoading(dom.registerBtn, true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: 'https://ramk07-2007.github.io/RUBM/'
      },
    });

    setAuthLoading(dom.registerBtn, false);

    if (error) {
      showAuthError(dom.registerError, error.message);
    } else {
      showAuthError(dom.registerError, '');
      dom.registerError.style.display = 'none';
      showAuthView('login');
      showToast('✉ Revisá tu email para confirmar tu cuenta.', 'info');
    }
  });

  /* RESET PASSWORD */
  dom.resetBtn?.addEventListener('click', async () => {
    const email = dom.resetEmail.value.trim();
    if (!email) {
      dom.resetMsg.textContent = 'Ingresá tu email.';
      dom.resetMsg.className   = 'auth-msg auth-msg--error';
      return;
    }

    setAuthLoading(dom.resetBtn, true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ramk07-2007.github.io/RUBM/',
    });

    setAuthLoading(dom.resetBtn, false);

    if (error) {
      dom.resetMsg.textContent = error.message;
      dom.resetMsg.className   = 'auth-msg auth-msg--error';
    } else {
      dom.resetMsg.textContent = 'Enviamos el link de recuperación a tu email.';
      dom.resetMsg.className   = 'auth-msg auth-msg--success';
    }
  });

  /* LOGOUT */
  dom.logoutBtn?.addEventListener('click', async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      fullReset();
      showAuth('login');
      showToast('Sesión cerrada correctamente.', 'success');
    } catch (err) {
      showToast('Error al cerrar sesión: ' + err.message, 'error');
    }
  });

  /* Enter key en auth forms */
  dom.loginPassword?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.loginBtn.click();
  });
  dom.registerPasswordConf?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.registerBtn.click();
  });
  dom.resetEmail?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.resetBtn.click();
  });
}

/**
 * Muestra/oculta el estado loading en un botón.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 */
function setAuthLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText ?? btn.textContent;
  btn.textContent = loading ? 'Cargando…' : btn.dataset.originalText;
}


/* =========================================================================
   5. TOAST NOTIFICATION SYSTEM
   ========================================================================= */

const TOAST_ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

/**
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='info']
 */
function showToast(message, type = 'info') {
  const container = qs('#toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  // Añadimos el botón de cerrar
  toast.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${TOAST_ICONS[type] ?? 'ℹ'}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    <button type="button" class="toast__close" aria-label="Cerrar">&times;</button>
  `;

  container.appendChild(toast);

  const removeToast = () => {
    if (toast.classList.contains('is-hiding')) return;
    toast.classList.add('is-hiding');
    // Escuchar el final de la animación o forzar la eliminación por seguridad
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 400); // fallback
  };

  const closeBtn = toast.querySelector('.toast__close');
  closeBtn.addEventListener('click', removeToast);

  if (type !== 'error') {
    // Solo los mensajes que NO son de error se ocultan automáticamente
    setTimeout(() => {
      if (toast.parentElement) removeToast();
    }, TOAST_DURATION);
  }
}


/* =========================================================================
   6. MODAL SYSTEM
   ========================================================================= */

function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = 'flex';
  modalEl.classList.add('is-open');
  modalEl.setAttribute('aria-hidden', 'false');
  requestAnimationFrame(() => {
    const focusable = modalEl.querySelector(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    focusable?.focus();
  });
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.display = 'none';
  modalEl.classList.remove('is-open');
  modalEl.setAttribute('aria-hidden', 'true');
}

function initModalBehaviors() {
  /* Click fuera de modales no-confirmación los cierra */
  qsa('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target !== overlay) return;
      const confirmations = [
        dom.modalConfirmDelete,
        dom.modalConfirmLeave,
        dom.modalConfirmDeleteBox,
      ];
      if (confirmations.includes(overlay)) return;
      closeModal(overlay);
    });
  });

  /* Escape cierra modales no-confirmación */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const confirmations = [
      dom.modalConfirmDelete,
      dom.modalConfirmLeave,
      dom.modalConfirmDeleteBox,
    ];
    qsa('.modal-overlay').forEach((overlay) => {
      if (!confirmations.includes(overlay)) closeModal(overlay);
    });
  });
}


/* =========================================================================
   7. UTILITIES / SECURITY
   ========================================================================= */

/**
 * Sanitiza HTML para prevenir XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {string} str @returns {string}
 */
function escapeAttr(str) { return escapeHtml(str); }

/**
 * Formatea una fecha ISO o string de fecha a formato local.
 * @param {string|null} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Formatea timestamp de auditoría (fecha + hora).
 * @param {string|null} ts
 * @returns {string}
 */
function formatTimestamp(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Devuelve la inicial del primer nombre para el avatar de la card */
function getInitial(nombre = '') {
  return (nombre.trim()[0] ?? '?').toUpperCase();
}

/** Manejo del beforeunload para cambios sin guardar */
function updateBeforeUnload() {
  window.onbeforeunload = dirty ? () => 'Hay cambios sin guardar.' : null;
}

/** Resetea el estado de datos de la app (sin tocar sesión ni listeners UI) */
function clearAppState() {
  cajitas             = [];
  selectedCajitaId    = null;
  reportes            = [];
  editingReporteId    = null;
  reporteToDelete     = null;
  cajitaToDelete      = null;
  cajitaBeingEdited   = null;
  dirty               = false;
  pendingSwitchCajitaId = null;
  // NOTA: isAppInitialized NO se resetea aquí
  // Los listeners de UI se registran una sola vez en initUI() y persisten.
  updateBeforeUnload();
}

/** Resetea COMPLETAMENTE el estado incluyendo isAppInitialized (solo en logout). */
function fullReset() {
  clearSelection();
  stopRealtime();
  isAppInitialized = false;
  currentUser      = null;
  currentProfile   = null;
}

/** Obtiene la cajita seleccionada del array local */
function getSelectedCajita() {
  return cajitas.find((c) => c.id === selectedCajitaId) ?? null;
}


/* =========================================================================
   8. MIGRACIÓN: localStorage → Supabase
   ========================================================================= */

/**
 * Si el usuario tiene datos en el localStorage del formato anterior,
 * los migra a Supabase y luego limpia el localStorage.
 */
async function migrateFromLocalStorage() {
  const LEGACY_KEY = 'imei_historial_v1_v2';
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;

  let legacyData;
  try { legacyData = JSON.parse(raw); } catch { return; }

  const imeis = Object.keys(legacyData ?? {});
  if (imeis.length === 0) return;

  showToast(`Migrando ${imeis.length} cajita(s) desde el sistema anterior…`, 'info');

  let migrated = 0;
  let errors   = 0;

  for (const imei of imeis) {
    const box = legacyData[imei];
    if (!box?.imei) continue;

    try {
      const cajita = await db.createCajita({
        imei:  box.imei,
        modem: box.modem ?? '',
        sim:   box.sim   ?? '',
      });

      for (const r of (box.reports ?? [])) {
        await db.createReporte(cajita.id, {
          fecha:   r.fecha   ?? r.date ?? '',
          nombre:  r.nombre  ?? r.name ?? '',
          estado:  r.estado  ?? r.status ?? '',
          notas:   r.notas   ?? r.notes ?? '',
        });
      }
      migrated++;
    } catch (err) {
      // Si ya existe el IMEI lo saltamos silenciosamente
      if (!err.message?.includes('Ya existe')) errors++;
    }
  }

  localStorage.removeItem(LEGACY_KEY);

  if (migrated > 0) {
    showToast(`✓ Migración completada: ${migrated} cajita(s) importada(s).`, 'success');
  }
  if (errors > 0) {
    showToast(`${errors} cajita(s) no pudieron migrarse. Revisar consola.`, 'warning');
  }
}


/* =========================================================================
   9. CAJITA MANAGEMENT
   ========================================================================= */

function renderCajitaTitle() {
  const cajita = getSelectedCajita();
  if (!cajita || !dom.selectedImeiTitle) return;

  dom.selectedImeiTitle.style.display = '';
  dom.selectedImeiTitle.textContent =
    `IMEI: ${cajita.imei}  ·  Modem: ${cajita.modem || '—'}  ·  SIM: ${cajita.sim || '—'}`;
}

async function selectCajita(id) {
  selectedCajitaId    = id;
  dirty               = false;
  pendingSwitchCajitaId = null;
  editingReporteId    = null;
  updateBeforeUnload();

  if (dom.searchInput) dom.searchInput.value = '';

  dom.emptyNotice.style.display = 'none';
  dom.reportsSection.hidden     = false;
  renderCajitaTitle();

  if (dom.addReportBtn) dom.addReportBtn.style.display = '';

  // Cargar reportes desde Supabase
  setLoading(true);
  try {
    reportes = await db.getReportes(id);
    renderReportsList();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function clearSelection() {
  clearAppState();

  if (dom.searchInput)       dom.searchInput.value  = '';
  if (dom.reportsSection)    dom.reportsSection.hidden = true;
  if (dom.emptyNotice)       dom.emptyNotice.style.display = '';
  if (dom.reportsList)       dom.reportsList.innerHTML = '';
  if (dom.selectedImeiTitle) {
    dom.selectedImeiTitle.style.display = 'none';
    dom.selectedImeiTitle.textContent   = '';
  }
  if (dom.addReportBtn)      dom.addReportBtn.style.display = 'none';

  [
    dom.modalEditBox,
    dom.modalConfirmDeleteBox,
    dom.modalConfirmDelete,
    dom.modalConfirmLeave,
  ].forEach(closeModal);
}

/** Muestra/oculta un spinner simple */
function setLoading(on) {
  const el = qs('#loadingSpinner');
  if (el) el.style.display = on ? '' : 'none';
}

/* ── Modal: Nueva cajita ── */

function initAddBoxModal() {
  dom.addBoxBtn?.addEventListener('click', () => {
    dom.newImeiInput.value  = '';
    dom.newModemInput.value = '';
    dom.newSimInput.value   = '';
    openModal(dom.modalAddBox);
  });

  dom.cancelAddImei?.addEventListener('click', () => closeModal(dom.modalAddBox));

  dom.confirmAddImei?.addEventListener('click', async () => {
    const imei  = (dom.newImeiInput.value ?? '').trim();
    const modem = (dom.newModemInput.value ?? '').trim();
    const sim   = (dom.newSimInput.value ?? '').trim();

    if (!imei) {
      showToast('El código IMEI es obligatorio.', 'warning');
      dom.newImeiInput.focus();
      return;
    }

    setAuthLoading(dom.confirmAddImei, true);
    try {
      const cajita = await db.createCajita({ imei, modem, sim });

      // Añadir al estado local para evitar recargar todo
      cajitas.push({ ...cajita, creator: { nombre: currentProfile?.nombre ?? '' }, updater: { nombre: currentProfile?.nombre ?? '' } });
      cajitas.sort((a, b) => a.imei.localeCompare(b.imei));

      closeModal(dom.modalAddBox);
      await selectCajita(cajita.id);
      showToast(`Cajita ${cajita.imei} creada correctamente.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAuthLoading(dom.confirmAddImei, false);
    }
  });

  dom.newImeiInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') dom.confirmAddImei.click();
  });
}

/* ── Modal: Editar cajita ── */

function openEditBoxModal(cajitaId) {
  const cajita = cajitas.find((c) => c.id === cajitaId);
  if (!cajita) return;

  cajitaBeingEdited = cajitaId;

  if (dom.currentImeiText) dom.currentImeiText.textContent = cajita.imei;
  if (dom.editImeiInput)   dom.editImeiInput.value  = cajita.imei;
  if (dom.editModemInput)  dom.editModemInput.value = cajita.modem ?? '';
  if (dom.editSimInput)    dom.editSimInput.value   = cajita.sim   ?? '';

  openModal(dom.modalEditBox);
}

function initEditBoxModal() {
  dom.cancelEditBox?.addEventListener('click', () => {
    cajitaBeingEdited = null;
    closeModal(dom.modalEditBox);
  });

  dom.confirmEditBox?.addEventListener('click', async () => {
    if (!cajitaBeingEdited) return;

    const newImei  = (dom.editImeiInput.value ?? '').trim();
    const newModem = (dom.editModemInput.value ?? '').trim();
    const newSim   = (dom.editSimInput.value ?? '').trim();

    if (!newImei) {
      showToast('El IMEI no puede estar vacío.', 'warning');
      dom.editImeiInput.focus();
      return;
    }

    setAuthLoading(dom.confirmEditBox, true);
    try {
      const updated = await db.updateCajita(cajitaBeingEdited, {
        imei: newImei, modem: newModem, sim: newSim,
      });

      // Actualizar estado local
      const idx = cajitas.findIndex((c) => c.id === cajitaBeingEdited);
      if (idx !== -1) {
        cajitas[idx] = {
          ...cajitas[idx],
          imei:  updated.imei,
          modem: updated.modem,
          sim:   updated.sim,
          updated_at: updated.updated_at,
          updater: { nombre: currentProfile?.nombre ?? '' },
        };
        cajitas.sort((a, b) => a.imei.localeCompare(b.imei));
      }

      if (selectedCajitaId === cajitaBeingEdited) {
        renderCajitaTitle();
      }

      cajitaBeingEdited = null;
      closeModal(dom.modalEditBox);
      showToast('Cajita actualizada.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAuthLoading(dom.confirmEditBox, false);
    }
  });
}

/* ── Modal: Confirmar eliminar cajita ── */

function openConfirmDeleteBox(cajitaId) {
  cajitaToDelete = cajitaId;
  const cajita = cajitas.find((c) => c.id === cajitaId);
  if (dom.confirmDeleteBoxText) {
    dom.confirmDeleteBoxText.textContent =
      `¿Eliminar la cajita "${cajita?.imei ?? cajitaId}" y todos sus reportes? Esta acción no se puede deshacer.`;
  }
  openModal(dom.modalConfirmDeleteBox);
}

function initDeleteBoxModal() {
  dom.cancelDeleteBox?.addEventListener('click', () => {
    cajitaToDelete = null;
    closeModal(dom.modalConfirmDeleteBox);
  });

  dom.confirmDeleteBox?.addEventListener('click', async () => {
    if (!cajitaToDelete) return;

    const wasSelected = selectedCajitaId === cajitaToDelete;
    const deletedId   = cajitaToDelete;
    const deletedImei = cajitas.find((c) => c.id === deletedId)?.imei ?? deletedId;

    setAuthLoading(dom.confirmDeleteBox, true);
    try {
      await db.deleteCajita(deletedId);

      cajitas = cajitas.filter((c) => c.id !== deletedId);
      cajitaToDelete = null;
      closeModal(dom.modalConfirmDeleteBox);
      closeModal(dom.modalListBoxes);

      if (wasSelected) clearSelection();

      showToast(`Cajita ${deletedImei} eliminada.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAuthLoading(dom.confirmDeleteBox, false);
    }
  });
}

/* ── Modal: Confirm Leave (cambios sin guardar) ── */

function resetLeaveModal() {
  const title = dom.modalConfirmLeave?.querySelector('.modal__title');
  const text  = dom.modalConfirmLeave?.querySelector('.modal-text');
  if (title) title.textContent = '¿Descartar cambios?';
  if (text)  text.textContent  = 'Tenés cambios sin guardar en el reporte actual. Si continuás, se perderán.';
  if (dom.confirmLeave) dom.confirmLeave.textContent = 'Descartar y continuar';
}

function initLeaveModal() {
  dom.cancelLeave?.addEventListener('click', () => {
    pendingSwitchCajitaId = null;
    resetLeaveModal();
    closeModal(dom.modalConfirmLeave);
  });

  dom.confirmLeave?.addEventListener('click', async () => {
    const pending = pendingSwitchCajitaId;
    pendingSwitchCajitaId = null;
    dirty = false;
    updateBeforeUnload();

    cancelEditReport();
    resetLeaveModal();
    closeModal(dom.modalConfirmLeave);

    if (pending) {
      await selectCajita(pending);
    }
  });
}

/* =========================================================================
   XX. PERFIL Y CROPPER
   ========================================================================= */

let cropperImg = null;
let cropperZoom = 1;
let cropperPanX = 0;
let cropperPanY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;

function drawCropper() {
  const canvas = dom.cropperCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!cropperImg) return;

  const w = cropperImg.width * cropperZoom;
  const h = cropperImg.height * cropperZoom;

  // Center the image + pan
  const x = (canvas.width - w) / 2 + cropperPanX;
  const y = (canvas.height - h) / 2 + cropperPanY;

  ctx.drawImage(cropperImg, x, y, w, h);
}

function initProfileModal() {
  dom.openProfileBtn?.addEventListener('click', () => {
    dom.profileNameInput.value = currentProfile?.nombre || '';
    if (currentProfile?.avatar_url) {
      cropperImg = new Image();
      cropperImg.onload = () => {
        cropperZoom = 1; cropperPanX = 0; cropperPanY = 0;
        // Ajustar zoom inicial para cubrir el canvas
        const minScale = Math.max(200 / cropperImg.width, 200 / cropperImg.height);
        cropperZoom = minScale;
        if (dom.zoomSlider) dom.zoomSlider.value = minScale;
        drawCropper();
      };
      cropperImg.src = currentProfile.avatar_url;
    } else {
      cropperImg = null;
      drawCropper();
    }
    openModal(dom.modalProfile);
  });

  dom.cancelProfile?.addEventListener('click', () => {
    closeModal(dom.modalProfile);
    dom.profileAvatarInput.value = '';
  });

  dom.selectAvatarBtn?.addEventListener('click', () => {
    dom.profileAvatarInput.click();
  });

  dom.profileAvatarInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      cropperImg = new Image();
      cropperImg.onload = () => {
        // Reset pan/zoom
        cropperPanX = 0; cropperPanY = 0;
        const minScale = Math.max(200 / cropperImg.width, 200 / cropperImg.height);
        cropperZoom = minScale;
        if (dom.zoomSlider) dom.zoomSlider.value = minScale;
        drawCropper();
      };
      cropperImg.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Eventos del Canvas
  const canvas = dom.cropperCanvas;
  if (canvas) {
    canvas.addEventListener('mousedown', (e) => {
      if (!cropperImg) return;
      isDragging = true;
      startX = e.clientX - cropperPanX;
      startY = e.clientY - cropperPanY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      cropperPanX = e.clientX - startX;
      cropperPanY = e.clientY - startY;
      drawCropper();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('wheel', (e) => {
      if (!cropperImg) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      cropperZoom = Math.max(0.1, Math.min(3, cropperZoom + delta));
      if (dom.zoomSlider) dom.zoomSlider.value = cropperZoom;
      drawCropper();
    });
  }

  dom.zoomSlider?.addEventListener('input', (e) => {
    if (!cropperImg) return;
    cropperZoom = parseFloat(e.target.value);
    drawCropper();
  });

  // Guardar perfil
  dom.saveProfile?.addEventListener('click', async () => {
    const nombre = dom.profileNameInput.value.trim();
    let avatarBase64 = currentProfile?.avatar_url;

    if (cropperImg && canvas) {
      // Exportar solo el área recortada (círculo virtual de 192px en un canvas de 200x200)
      avatarBase64 = canvas.toDataURL('image/webp', 0.8);
    }

    setAuthLoading(dom.saveProfile, true);
    try {
      currentProfile = await db.updateUserProfile({ nombre, avatar_url: avatarBase64 });
      updateProfileUI();
      renderReportsList(); // Refrescar avatars
      closeModal(dom.modalProfile);
      showToast('Perfil actualizado correctamente.', 'success');
      
      // Actualizar presence si es necesario
      import('./realtime.js').then(rt => {
        rt.initPresence(currentProfile, renderOnlineUsers);
      });
      
    } catch (err) {
      showToast('Error guardando perfil: ' + err.message, 'error');
    } finally {
      setAuthLoading(dom.saveProfile, false);
    }
  });
}

function updateProfileUI() {
  if (dom.userNombreDisplay) {
    dom.userNombreDisplay.textContent = currentProfile?.nombre || currentUser?.email || '';
  }
  if (dom.userAvatarDisplay) {
    if (currentProfile?.avatar_url) {
      dom.userAvatarDisplay.src = currentProfile.avatar_url;
      dom.userAvatarDisplay.style.display = 'block';
    } else {
      dom.userAvatarDisplay.style.display = 'none';
    }
  }
}

/* =========================================================================
   XY. ONLINE USERS (PRESENCE)
   ========================================================================= */

function initOnlineUsers() {
  dom.onlineUsersBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = dom.onlineUsersDropdown.hidden;
    dom.onlineUsersDropdown.hidden = !isHidden;
    dom.onlineUsersBtn.setAttribute('aria-expanded', !isHidden);
  });

  document.addEventListener('click', (e) => {
    if (!dom.onlineUsersBtn?.contains(e.target) && !dom.onlineUsersDropdown?.contains(e.target)) {
      if (dom.onlineUsersDropdown) dom.onlineUsersDropdown.hidden = true;
      if (dom.onlineUsersBtn) dom.onlineUsersBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

function renderOnlineUsers(users) {
  if (dom.onlineUsersCount) {
    dom.onlineUsersCount.textContent = users.length;
  }
  if (dom.onlineUsersList) {
    dom.onlineUsersList.innerHTML = '';
    users.forEach(u => {
      const el = document.createElement('div');
      el.className = 'online-user-item';
      
      let avatarHtml = `<div class="avatar-sm" style="display:flex;align-items:center;justify-content:center;background:var(--color-surface);font-weight:bold;font-size:12px;">${getInitial(u.nombre)}</div>`;
      if (u.avatar_url) {
        avatarHtml = `<img src="${escapeAttr(u.avatar_url)}" class="avatar-sm" alt="Avatar">`;
      }
      
      el.innerHTML = `
        ${avatarHtml}
        <div class="online-user-item__info">
          <span class="online-user-item__name">${escapeHtml(u.nombre)}</span>
        </div>
      `;
      dom.onlineUsersList.appendChild(el);
    });
  }
}


/* =========================================================================
   10. BOX LIST RENDERING
   ========================================================================= */

/** Construye e inyecta los elementos de cajita en un contenedor. */
function renderBoxItems(container, items) {
  container.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-muted';
    empty.style.padding = '12px';
    empty.textContent = 'No se encontraron cajitas.';
    container.appendChild(empty);
    return;
  }

  items.forEach((cajita) => {
    const item = document.createElement('div');
    item.className = 'box-item';
    item.setAttribute('role', 'listitem');

    const reportCount = cajita.reporte_count ?? '—';

    item.innerHTML = `
      <div class="box-item__info">
        <div class="box-item__imei">${escapeHtml(cajita.imei)}</div>
        <div class="box-item__meta">
          <span>Modem: ${escapeHtml(cajita.modem || '—')}</span>
          <span>SIM: ${escapeHtml(cajita.sim || '—')}</span>
        </div>
      </div>
      <div class="box-actions">
        <button type="button" class="btn btn--sm btn--primary js-select-box"
          data-id="${escapeAttr(cajita.id)}"
          aria-label="Seleccionar cajita ${escapeAttr(cajita.imei)}">Seleccionar</button>
        <button type="button" class="btn btn--sm js-edit-box"
          data-id="${escapeAttr(cajita.id)}"
          aria-label="Editar cajita ${escapeAttr(cajita.imei)}">Editar</button>
        <button type="button" class="btn btn--sm btn--danger js-delete-box"
          data-id="${escapeAttr(cajita.id)}"
          aria-label="Eliminar cajita ${escapeAttr(cajita.imei)}">Eliminar</button>
      </div>
    `;
    container.appendChild(item);
  });

  /* Event delegation */
  container.onclick = (e) => {
    const btn = e.target.closest('button[data-id]');
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains('js-select-box')) {
      if (dirty) {
        pendingSwitchCajitaId = id;
        openModal(dom.modalConfirmLeave);
        closeModal(dom.modalListBoxes);
        closeModal(dom.modalSearchResults);
        return;
      }
      selectCajita(id);
      closeModal(dom.modalListBoxes);
      closeModal(dom.modalSearchResults);
    } else if (btn.classList.contains('js-edit-box')) {
      openEditBoxModal(id);
      closeModal(dom.modalListBoxes);
      closeModal(dom.modalSearchResults);
    } else if (btn.classList.contains('js-delete-box')) {
      openConfirmDeleteBox(id);
    }
  };
}

function renderBoxList(filter) {
  const items = filter
    ? cajitas.filter((c) => c.imei.includes(filter))
    : [...cajitas];

  const title = qs('#modalListBoxesTitle');
  if (title) {
    title.textContent = filter
      ? `Cajitas que contienen "${filter}"`
      : 'Lista de cajitas';
  }

  renderBoxItems(dom.boxListContainer, items);
}

function initBoxListModal() {
  dom.openListBtn?.addEventListener('click', () => {
    renderBoxList();
    openModal(dom.modalListBoxes);
  });
  dom.closeListBtn?.addEventListener('click', () => closeModal(dom.modalListBoxes));
}

function initSearch() {
  dom.searchBtn?.addEventListener('click', handleSearch);
  dom.searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });
  dom.closeSearchResults?.addEventListener('click', () => closeModal(dom.modalSearchResults));
}

async function handleSearch() {
  const query = (dom.searchInput.value ?? '').trim();
  if (!query) {
    showToast('Ingresá un código IMEI para buscar.', 'warning');
    dom.searchInput.focus();
    return;
  }

  // Buscar localmente primero (más rápido)
  const local = cajitas.filter((c) => c.imei.includes(query));

  if (local.length === 1) {
    // Resultado único → seleccionar directamente
    if (dirty) {
      pendingSwitchCajitaId = local[0].id;
      openModal(dom.modalConfirmLeave);
      return;
    }
    await selectCajita(local[0].id);
    return;
  }

  if (local.length > 1) {
    renderBoxItems(dom.searchResultsContainer, local);
    openModal(dom.modalSearchResults);
    const title = qs('#modalSearchResultsTitle');
    if (title) title.textContent = `Resultados para "${query}"`;
    return;
  }

  // No encontrado localmente → buscar en Supabase
  try {
    const results = await db.searchCajitas(query);
    if (results.length === 0) {
      showToast(`No se encontró ninguna cajita con IMEI "${query}".`, 'warning');
      return;
    }
    renderBoxItems(dom.searchResultsContainer, results);
    openModal(dom.modalSearchResults);
    const title = qs('#modalSearchResultsTitle');
    if (title) title.textContent = `Resultados para "${query}"`;
  } catch (err) {
    showToast(err.message, 'error');
  }
}


/* =========================================================================
   11. REPORT MANAGEMENT
   ========================================================================= */

function initAddReportBtn() {
  dom.addReportBtn?.addEventListener('click', () => {
    if (editingReporteId) {
      showToast('Guardá o cancelá el reporte en edición antes de agregar uno nuevo.', 'warning');
      return;
    }
    addNewReport();
  });
}

function addNewReport() {
  if (!selectedCajitaId) return;

  // Crea un reporte temporal en el array local con id 'new'
  const tempReport = {
    id:         '__new__',
    cajita_id:  selectedCajitaId,
    fecha:      '',
    nombre:     '',
    estado:     '',
    notas:      '',
    created_at: null,
    updated_at: null,
    creator:    { nombre: currentProfile?.nombre ?? '', avatar_url: currentProfile?.avatar_url ?? null },
    updater:    { nombre: currentProfile?.nombre ?? '', avatar_url: currentProfile?.avatar_url ?? null },
  };

  reportes.push(tempReport);
  editingReporteId = '__new__';
  dirty = true;
  updateBeforeUnload();
  renderReportsList();

  // Scroll al final
  setTimeout(() => {
    const newWrapper = dom.reportsList?.lastElementChild;
    if (newWrapper) newWrapper.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, 50);
}

/* ── Modal: Confirmar eliminar reporte ── */

function openConfirmDeleteReport(reporteId) {
  reporteToDelete = reporteId;
  const r = reportes.find((r) => r.id === reporteId);
  if (dom.confirmDeleteText) {
    dom.confirmDeleteText.textContent =
      `¿Eliminar el reporte del ${formatDate(r?.fecha)} creado por ${r?.creator?.nombre ?? ''}? Esta acción no se puede deshacer.`;
  }
  openModal(dom.modalConfirmDelete);
}

function initDeleteReportModal() {
  dom.cancelDelete?.addEventListener('click', () => {
    reporteToDelete = null;
    closeModal(dom.modalConfirmDelete);
  });

  dom.confirmDelete?.addEventListener('click', async () => {
    if (!reporteToDelete) return;

    setAuthLoading(dom.confirmDelete, true);
    try {
      if (reporteToDelete !== '__new__') {
        await db.deleteReporte(reporteToDelete);
      }
      reportes = reportes.filter((r) => r.id !== reporteToDelete);
      reporteToDelete = null;
      closeModal(dom.modalConfirmDelete);
      renderReportsList();
      showToast('Reporte eliminado.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAuthLoading(dom.confirmDelete, false);
    }
  });
}


/* =========================================================================
   12. REPORT CARD RENDERING
   ========================================================================= */

/**
 * Renderiza la lista completa de reportes de la cajita seleccionada.
 */
function renderReportsList() {
  if (!dom.reportsList) return;

  if (reportes.length === 0) {
    dom.reportsList.innerHTML = `
      <div class="card card--empty" role="status">
        <div class="card__empty-icon" aria-hidden="true">📋</div>
        <p>Esta cajita no tiene reportes todavía.</p>
        <button type="button" id="addReportBtnInline" class="btn btn--outline">
          + Agregar primer reporte
        </button>
      </div>`;

    qs('#addReportBtnInline')?.addEventListener('click', addNewReport);
    return;
  }

  // Remove empty state if present
  const empty = dom.reportsList.querySelector('.card--empty');
  if (empty) empty.remove();

  // 1. Get current wrappers in DOM
  const currentWrappers = Array.from(dom.reportsList.querySelectorAll('.card-wrapper'));
  
  // 2. Remove wrappers for deleted reports
  currentWrappers.forEach((w) => {
    if (!reportes.find((r) => r.id === w.dataset.id)) {
      w.remove();
    }
  });

  // 3. Update or append wrappers in order
  reportes.forEach((r, idx) => {
    const isEditing = r.id === '__new__' || r.id === editingReporteId;
    let wrapper = dom.reportsList.querySelector(`.card-wrapper[data-id="${r.id}"]`);
    
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'card-wrapper';
      wrapper.dataset.id = r.id;
      wrapper.innerHTML = `
        <div class="card-number-container">
          <span class="card-number-val">${idx + 1}</span>
        </div>
        <div class="card-content-container"></div>
      `;
      dom.reportsList.appendChild(wrapper);
    } else {
      dom.reportsList.appendChild(wrapper); // Moves it to correct position if needed
      
      const numSpan = wrapper.querySelector('.card-number-val');
      if (numSpan && numSpan.textContent !== String(idx + 1)) {
        numSpan.classList.remove('number-pop');
        void numSpan.offsetWidth; // trigger reflow
        numSpan.textContent = idx + 1;
        numSpan.classList.add('number-pop');
      }
    }

    // Update inner card content
    const contentContainer = wrapper.querySelector('.card-content-container');
    contentContainer.innerHTML = '';
    const cardEl = isEditing ? buildEditCard(r) : buildViewCard(r);
    contentContainer.appendChild(cardEl);
  });
}

/**
 * Construye una card en modo visualización.
 * @param {object} r - Reporte
 * @returns {HTMLElement}
 */
function buildViewCard(r) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = r.id;

  const initial    = getInitial(r.nombre || '?');
  const creador    = r.creator?.nombre ?? '—';
  const modificador = r.updater?.nombre ?? '—';
  const fechaMod   = formatTimestamp(r.updated_at);
  const fechaCreac = formatTimestamp(r.created_at);

  // Helper for inline avatars
  const renderAuditAvatar = (user) => {
    if (user?.avatar_url) {
      return `<img src="${escapeAttr(user.avatar_url)}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:6px;border:1px solid var(--color-border);">`;
    }
    return '';
  };

  const renderCardLeft = () => {
    if (r.creator?.avatar_url) {
      return `<img src="${escapeAttr(r.creator.avatar_url)}" alt="" class="card__left" style="object-fit:cover; padding:0; border:none; border-radius:50%; background:var(--color-surface-alt);">`;
    }
    return `<div class="card__left" aria-hidden="true">${escapeHtml(initial)}</div>`;
  };

  card.innerHTML = `
    ${renderCardLeft()}
    <div class="card__middle">
      <div class="row">
        <div class="field">
          <div class="label">Fecha</div>
          <div class="value">${escapeHtml(formatDate(r.fecha))}</div>
        </div>
        <div class="field">
          <div class="label">Nombre</div>
          <div class="value">${escapeHtml(r.nombre)}</div>
        </div>
      </div>
      <div class="row" style="margin-top: var(--space-3);">
        <div class="field">
          <div class="label">Estado</div>
          <div class="value">${escapeHtml(r.estado)}</div>
        </div>
        <div class="field">
          <div class="label">Bitácora</div>
          <div class="value">${escapeHtml(r.notas)}</div>
        </div>
      </div>
      <div class="card-audit" style="display:flex; flex-direction:column; gap:6px; margin-top:12px;">
        <span title="Fecha de creación: ${escapeAttr(fechaCreac)}" style="display:flex; align-items:center;">
          ${renderAuditAvatar(r.creator)}
          <span>Creado por <strong>${escapeHtml(creador)}</strong> — ${escapeHtml(fechaCreac)}</span>
        </span>
        ${r.updated_at !== r.created_at ? `
        <span title="Última modificación" style="display:flex; align-items:center;">
          ${renderAuditAvatar(r.updater)}
          <span>· Modificado por <strong>${escapeHtml(modificador)}</strong> — ${escapeHtml(fechaMod)}</span>
        </span>` : ''}
      </div>
    </div>
    <div class="card__actions">
      <div class="card__actions-row">
        <button type="button" class="btn btn--sm js-edit-report"
          data-id="${escapeAttr(r.id)}" aria-label="Editar reporte">Editar</button>
        <button type="button" class="btn btn--sm btn--danger js-delete-report"
          data-id="${escapeAttr(r.id)}" aria-label="Eliminar reporte">Borrar</button>
      </div>
    </div>
  `;

  card.querySelector('.js-edit-report')?.addEventListener('click', () => startEditReport(r.id));
  card.querySelector('.js-delete-report')?.addEventListener('click', () => openConfirmDeleteReport(r.id));

  return card;
}

/**
 * Construye una card en modo edición.
 * @param {object} r - Reporte (puede ser el temporal '__new__')
 * @returns {HTMLElement}
 */
function buildEditCard(r) {
  const card = document.createElement('div');
  card.className = 'card card--editing';
  card.dataset.id = r.id;

  card.innerHTML = `
    <div class="card__middle card__middle--full">
      <div class="row">
        <div class="field form-group">
          <label class="form-label" for="editFecha_${escapeAttr(r.id)}">Fecha</label>
          <input type="date" id="editFecha_${escapeAttr(r.id)}"
            class="form-input" value="${escapeAttr(r.fecha ?? '')}" autocomplete="off">
        </div>
        <div class="field form-group">
          <label class="form-label" for="editNombre_${escapeAttr(r.id)}">Nombre</label>
          <input type="text" id="editNombre_${escapeAttr(r.id)}"
            class="form-input" value="${escapeAttr(r.nombre ?? '')}" placeholder="Nombre del técnico">
        </div>
      </div>
      <div class="row" style="margin-top: var(--space-3);">
        <div class="field form-group">
          <label class="form-label" for="editEstado_${escapeAttr(r.id)}">Estado</label>
          <input type="text" id="editEstado_${escapeAttr(r.id)}"
            class="form-input" value="${escapeAttr(r.estado ?? '')}" placeholder="Estado del equipo">
        </div>
        <div class="field form-group" style="flex: 2;">
          <label class="form-label" for="editNotas_${escapeAttr(r.id)}">Bitácora</label>
          <textarea id="editNotas_${escapeAttr(r.id)}"
            class="form-input" placeholder="Entrada de bitácora...">${escapeHtml(r.notas ?? '')}</textarea>
        </div>
      </div>
      <div class="card__actions-row" style="margin-top: var(--space-4); justify-content: flex-end;">
        <button type="button" class="btn btn--sm js-cancel-report"
          data-id="${escapeAttr(r.id)}">Cancelar</button>
        <button type="button" class="btn btn--sm btn--primary js-save-report"
          data-id="${escapeAttr(r.id)}">Guardar</button>
      </div>
    </div>
  `;

  /* Marcar dirty en cualquier cambio en el form */
  card.querySelectorAll('input, textarea').forEach((input) => {
    input.addEventListener('input', () => {
      dirty = true;
      updateBeforeUnload();
    });
  });

  card.querySelector('.js-save-report')?.addEventListener('click', () => saveReport(r.id, card));
  card.querySelector('.js-cancel-report')?.addEventListener('click', () => {
    if (r.id === '__new__') {
      reportes = reportes.filter((rep) => rep.id !== '__new__');
      editingReporteId = null;
      dirty = false;
      updateBeforeUnload();
      renderReportsList();
    } else {
      cancelEditReport();
    }
  });

  return card;
}

function startEditReport(id) {
  if (editingReporteId && editingReporteId !== id) {
    showToast('Guardá o cancelá el reporte actual antes de editar otro.', 'warning');
    return;
  }
  editingReporteId = id;
  dirty = true;
  updateBeforeUnload();
  renderReportsList();
}

function cancelEditReport() {
  editingReporteId = null;
  dirty = false;
  updateBeforeUnload();
  // Quitar cualquier '__new__' no guardado
  reportes = reportes.filter((r) => r.id !== '__new__');
  renderReportsList();
}

async function saveReport(id, cardEl) {
  const safeId = (sel) => cardEl.querySelector(`#${sel}_${CSS.escape(id)}`);

  const fecha   = safeId('editFecha')?.value   ?? '';
  const nombre  = safeId('editNombre')?.value  ?? '';
  const estado  = safeId('editEstado')?.value  ?? '';
  const notas   = safeId('editNotas')?.value   ?? '';

  const saveBtn = cardEl.querySelector('.js-save-report');
  setAuthLoading(saveBtn, true);

  try {
    let saved;
    if (id === '__new__') {
      saved = await db.createReporte(selectedCajitaId, { fecha, nombre, estado, notas });
      reportes = reportes.filter((r) => r.id !== '__new__');
      reportes.push(saved);
    } else {
      saved = await db.updateReporte(id, { fecha, nombre, estado, notas });
      const idx = reportes.findIndex((r) => r.id === id);
      if (idx !== -1) reportes[idx] = saved;
    }

    editingReporteId = null;
    dirty = false;
    updateBeforeUnload();
    renderReportsList();
    showToast('Reporte guardado correctamente.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setAuthLoading(saveBtn, false);
  }
}


/* =========================================================================
   13. REALTIME HANDLERS
   ========================================================================= */

function initRealtime() {
  startRealtime({
    onCajitasChange: handleCajitaChange,
    onReportesChange: handleReporteChange,
  });
}

/**
 * Maneja cambios en tiempo real de la tabla cajitas.
 * Actualiza el estado local sin recargar todo.
 */
async function handleCajitaChange({ type, record }) {
  if (type === 'INSERT') {
    // Solo añadir si no tenemos esa cajita ya
    if (!cajitas.find((c) => c.id === record.id)) {
      // El record de Realtime no tiene los joins de perfiles —
      // hacemos un fetch específico de esa cajita
      try {
        const fresh = await db.searchCajitas(record.imei);
        const cajita = fresh.find((c) => c.id === record.id);
        if (cajita) {
          cajitas.push(cajita);
          cajitas.sort((a, b) => a.imei.localeCompare(b.imei));
        }
      } catch (_) { /* no-op */ }
    }
  } else if (type === 'UPDATE') {
    const idx = cajitas.findIndex((c) => c.id === record.id);
    if (idx !== -1) {
      cajitas[idx] = { ...cajitas[idx], ...record };
    }
    if (selectedCajitaId === record.id) renderCajitaTitle();
  } else if (type === 'DELETE') {
    cajitas = cajitas.filter((c) => c.id !== record.id);
    if (selectedCajitaId === record.id) {
      clearSelection();
      showToast('La cajita seleccionada fue eliminada por otro usuario.', 'warning');
    }
  }
}

/**
 * Maneja cambios en tiempo real de la tabla reportes.
 */
async function handleReporteChange({ type, record }) {
  if (record.cajita_id !== selectedCajitaId) return;

  if (type === 'INSERT') {
    if (!reportes.find((r) => r.id === record.id)) {
      // Fetch del reporte completo con joins de perfiles
      try {
        const freshReportes = await db.getReportes(selectedCajitaId);
        const newR = freshReportes.find((r) => r.id === record.id);
        if (newR) {
          reportes.push(newR);
          if (!editingReporteId) renderReportsList();
        }
      } catch (_) { /* no-op */ }
    }
  } else if (type === 'UPDATE') {
    if (editingReporteId === record.id) return; // no pisar edición en curso
    const idx = reportes.findIndex((r) => r.id === record.id);
    if (idx !== -1) {
      try {
        const freshReportes = await db.getReportes(selectedCajitaId);
        const updated = freshReportes.find((r) => r.id === record.id);
        if (updated) reportes[idx] = updated;
        if (!editingReporteId) renderReportsList();
      } catch (_) { /* no-op */ }
    }
  } else if (type === 'DELETE') {
    if (editingReporteId === record.id) {
      editingReporteId = null;
      dirty = false;
      updateBeforeUnload();
      showToast('El reporte que estabas editando fue eliminado por otro usuario.', 'warning');
    }
    reportes = reportes.filter((r) => r.id !== record.id);
    renderReportsList();
  }
}


/* =========================================================================
   14. APP INITIALIZATION
   ========================================================================= */

/**
 * Inicializa todos los módulos de la app principal.
 * Solo se llama cuando hay sesión autenticada.
 */
async function initApp(user) {
  currentUser = user;

  if (isAppInitialized) {
    // Re-login: solo recargar datos y mostrar la app
    try {
      cajitas = await db.getCajitas();
      if (selectedCajitaId) {
        reportes = await db.getReportes(selectedCajitaId);
        renderReportsList();
      }
    } catch (e) {
      console.warn(e);
    }
    showApp();
    return;
  }
  isAppInitialized = true;

  // Cargar perfil (siempre, por si cambió de cuenta)
  try {
    currentProfile = await db.getUserProfile();
    await db.touchLastAccess();
    updateProfileUI();
  } catch (_) {
    if (dom.userNombreDisplay) dom.userNombreDisplay.textContent = user.email;
  }

  // Migrar datos del localStorage si los hay
  await migrateFromLocalStorage();

  // Cargar cajitas
  setLoading(true);
  try {
    cajitas = await db.getCajitas();
  } catch (err) {
    showToast('Error cargando cajitas: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }

  initRealtime();
  
  // Iniciar Presence
  import('./realtime.js').then(rt => {
    rt.initPresence(currentProfile, renderOnlineUsers);
  });

  // Mostrar la app
  showApp();
}

/**
 * Inicializa TODOS los event listeners de la UI exactamente una vez.
 * NUNCA llamar desde initApp para evitar listeners duplicados.
 */
function initUI() {
  initModalBehaviors();
  initAddBoxModal();
  initEditBoxModal();
  initDeleteBoxModal();
  initLeaveModal();
  initDeleteReportModal();
  initBoxListModal();
  initSearch();
  initAddReportBtn();
  initProfileModal();
  initOnlineUsers();
}


/* =========================================================================
   15. ENTRY POINT — Arranque controlado por Supabase Auth
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar fondo premium fluido
  initBackground();

  cacheDom();

  // Inicializar TODA la UI una única vez (listeners, modales, etc.)
  initUI();
  initAuthListeners();

  // Inicializar Tema (Claro/Oscuro)
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  if (dom.themeToggleBtn) {
    // Icon SVG paths
    const MOON_PATH = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';
    const SUN_PATH  = 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42M12 5a7 7 0 1 0 0 14A7 7 0 0 0 12 5z';

    function updateThemeIcon(isDark) {
      const iconEl = document.getElementById('themeIcon');
      if (!iconEl) return;
      // Clear existing paths
      while (iconEl.firstChild) iconEl.removeChild(iconEl.firstChild);
      if (isDark) {
        // Show sun icon (dark mode → click to go light)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '5');
        iconEl.appendChild(circle);
        SUN_PATH.split('M').filter(Boolean).forEach((d) => {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M' + d.trim());
          iconEl.appendChild(path);
        });
      } else {
        // Show moon icon (light mode → click to go dark)
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', MOON_PATH);
        iconEl.appendChild(path);
      }
    }

    dom.themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme === 'dark');
    });

    // Set initial icon based on saved theme
    updateThemeIcon((localStorage.getItem('theme') || 'light') === 'dark');
  }

  // Supabase Auth gestiona el estado de sesión globalmente
  supabase.auth.onAuthStateChange(async (event, session) => {

    if (event === 'PASSWORD_RECOVERY') {
      // El usuario llegó desde el link de reset → mostrar form de nueva contraseña
      // (Implementación avanzada: se puede agregar un modal de cambio de contraseña)
      showToast('Podés cambiar tu contraseña en la configuración de tu cuenta.', 'info');
      // Por ahora redirigimos al login
      showAuth('login');
      return;
    }

    if (session?.user) {
      // Usuario autenticado
      await initApp(session.user);
    } else {
      // Sin sesión → mostrar auth y hacer reset completo
      fullReset();
      showAuth('login');
    }
  });

  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./service-worker.js')
        .catch((err) => console.warn('Service Worker:', err));
    });
  }
});