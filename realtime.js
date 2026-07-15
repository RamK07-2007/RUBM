/**
 * RUBM v3.0 — Realtime Subscriptions
 * realtime.js
 *
 * Gestiona las subscripciones a cambios en tiempo real de Supabase.
 * Cuando otro usuario crea/edita/elimina una cajita o reporte,
 * la UI se actualiza automáticamente sin recargar la página.
 */

import { supabase } from './config.js';

/** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
let activeChannel = null;

/** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
let presenceChannel = null;

/**
 * Indicador visual de estado de conexión.
 * @param {'connected'|'connecting'|'disconnected'} status
 */
function setConnectionStatus(status) {
  const el = document.getElementById('connectionStatus');
  if (!el) return;

  const labels = {
    connected:    { text: '● Sincronizado',  cls: 'status--connected'    },
    connecting:   { text: '◌ Conectando…',   cls: 'status--connecting'   },
    disconnected: { text: '○ Sin conexión',  cls: 'status--disconnected' },
  };

  const { text, cls } = labels[status] ?? labels.disconnected;
  el.textContent = text;
  el.className   = `connection-status ${cls}`;
}

/**
 * Inicia la subscripción a cambios en tiempo real.
 *
 * @param {object} handlers
 * @param {Function} handlers.onCajitasChange  - llamado cuando cambia cualquier cajita
 * @param {Function} handlers.onReportesChange - llamado cuando cambia cualquier reporte
 */
export function startRealtime({ onCajitasChange, onReportesChange }) {
  // Limpiamos suscripción anterior si existe
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  setConnectionStatus('connecting');

  activeChannel = supabase
    .channel('rubm-realtime-v1')

    /* ── Cajitas ── */
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cajitas' },
      (payload) => onCajitasChange({ type: 'INSERT', record: payload.new })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cajitas' },
      (payload) => onCajitasChange({ type: 'UPDATE', record: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'cajitas' },
      (payload) => onCajitasChange({ type: 'DELETE', record: payload.old })
    )

    /* ── Reportes ── */
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reportes' },
      (payload) => onReportesChange({ type: 'INSERT', record: payload.new })
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'reportes' },
      (payload) => onReportesChange({ type: 'UPDATE', record: payload.new, old: payload.old })
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'reportes' },
      (payload) => onReportesChange({ type: 'DELETE', record: payload.old })
    )

    /* ── Estado de conexión ── */
    .subscribe((status) => {
      if (status === 'SUBSCRIBED')  setConnectionStatus('connected');
      if (status === 'CLOSED')      setConnectionStatus('disconnected');
      if (status === 'CHANNEL_ERROR') setConnectionStatus('disconnected');
      if (status === 'TIMED_OUT')   setConnectionStatus('connecting');
    });
}

/**
 * Inicia el tracking de Presencia para saber quién está online.
 * @param {object} profile - El perfil actual (id, nombre, avatar_url)
 * @param {Function} onSync - Callback llamado cuando cambia la lista de usuarios
 */
export function initPresence(profile, onSync) {
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }

  presenceChannel = supabase.channel('online-users', {
    config: {
      presence: {
        key: profile.id,
      },
    },
  });

  presenceChannel.on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState();
    const activeUsers = [];
    
    // state is an object where keys are the presence keys (user id)
    // and values are arrays of presence objects (one user can have multiple tabs)
    for (const id in state) {
      if (state[id].length > 0) {
        // tomamos la info de la primera conexión
        activeUsers.push(state[id][0]);
      }
    }
    
    onSync(activeUsers);
  });

  presenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({
        id: profile.id,
        nombre: profile.nombre || 'Usuario sin nombre',
        avatar_url: profile.avatar_url || null,
        online_at: new Date().toISOString(),
      });
    }
  });
}

/**
 * Detiene la subscripción activa.
 */
export function stopRealtime() {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel);
    presenceChannel = null;
  }
  setConnectionStatus('disconnected');
}
