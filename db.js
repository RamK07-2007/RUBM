/**
 * RUBM v3.0 — Data Access Layer
 * db.js
 *
 * Todas las operaciones contra Supabase se centralizan aquí.
 * app.js nunca llama a supabase directamente — siempre usa este módulo.
 *
 * Convenciones:
 *  - Todas las funciones son async y lanzan Error en caso de fallo.
 *  - Los IDs de usuario (created_by / updated_by) se obtienen del cliente de auth.
 *  - Los perfiles de creador/modificador se resuelven con un JOIN en la query.
 */

import { supabase } from './config.js';

/* =========================================================================
   HELPERS INTERNOS
   ========================================================================= */

/**
 * Retorna el UID del usuario autenticado actualmente.
 * @returns {string}
 * @throws {Error} si no hay sesión activa
 */
async function currentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('No hay sesión activa.');
  return session.user.id;
}

/**
 * Lanza un Error descriptivo a partir del objeto de error de Supabase.
 * @param {object} error
 * @param {string} context - descripción de la operación
 */
function throwDbError(error, context = '') {
  const msg = error?.message ?? JSON.stringify(error);
  throw new Error(`[DB${context ? ` · ${context}` : ''}] ${msg}`);
}


/* =========================================================================
   PROFILE
   ========================================================================= */

/**
 * Obtiene el perfil del usuario autenticado.
 * @returns {Promise<{id, nombre, rol, activo, created_at, last_access}>}
 */
export async function getUserProfile() {
  const uid = await currentUserId();

  const { data, error } = await supabase
    .from('profiles')
    .select('id, nombre, rol, activo, created_at, last_access, avatar_url')
    .eq('id', uid)
    .single();

  if (error) throwDbError(error, 'getUserProfile');
  return data;
}

/**
 * Actualiza el perfil del usuario autenticado.
 * @param {{ nombre?: string, avatar_url?: string }} payload
 */
export async function updateUserProfile({ nombre, avatar_url }) {
  const uid = await currentUserId();
  const patch = {};
  if (nombre !== undefined) patch.nombre = nombre.trim();
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', uid)
    .select('id, nombre, rol, activo, created_at, last_access, avatar_url')
    .single();

  if (error) throwDbError(error, 'updateUserProfile');
  return data;
}

/**
 * Actualiza last_access del usuario actual a NOW().
 */
export async function touchLastAccess() {
  const uid = await currentUserId();
  await supabase
    .from('profiles')
    .update({ last_access: new Date().toISOString() })
    .eq('id', uid);
  // No lanzamos error si falla — es no-crítico
}


/* =========================================================================
   CAJITAS
   ========================================================================= */

/**
 * Obtiene todas las cajitas con información de auditoría.
 * @returns {Promise<Array>}
 */
export async function getCajitas() {
  const { data, error } = await supabase
    .from('cajitas')
    .select(`
      id,
      imei,
      modem,
      sim,
      created_at,
      updated_at,
      created_by,
      updated_by,
      creator:profiles!cajitas_created_by_fkey ( nombre, avatar_url ),
      updater:profiles!cajitas_updated_by_fkey ( nombre, avatar_url )
    `)
    .order('imei', { ascending: true });

  if (error) throwDbError(error, 'getCajitas');
  return data ?? [];
}

/**
 * Crea una nueva cajita.
 * @param {{ imei: string, modem?: string, sim?: string }} payload
 * @returns {Promise<object>} La cajita creada
 */
export async function createCajita({ imei, modem = '', sim = '' }) {
  const uid = await currentUserId();

  const { data, error } = await supabase
    .from('cajitas')
    .insert({
      imei:       imei.trim(),
      modem:      modem.trim(),
      sim:        sim.trim(),
      created_by: uid,
      updated_by: uid,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error(`Ya existe una cajita con IMEI "${imei}".`);
    throwDbError(error, 'createCajita');
  }
  return data;
}

/**
 * Actualiza los datos de una cajita existente.
 * @param {string} id - UUID de la cajita
 * @param {{ imei?: string, modem?: string, sim?: string }} payload
 * @returns {Promise<object>} La cajita actualizada
 */
export async function updateCajita(id, { imei, modem, sim }) {
  const uid = await currentUserId();

  const patch = { updated_by: uid };
  if (imei  !== undefined) patch.imei  = imei.trim();
  if (modem !== undefined) patch.modem = modem.trim();
  if (sim   !== undefined) patch.sim   = sim.trim();

  const { data, error } = await supabase
    .from('cajitas')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') throw new Error(`Ya existe una cajita con el IMEI indicado.`);
    throwDbError(error, 'updateCajita');
  }
  return data;
}

/**
 * Elimina una cajita (y sus reportes en cascada).
 * @param {string} id - UUID de la cajita
 */
export async function deleteCajita(id) {
  const { error } = await supabase
    .from('cajitas')
    .delete()
    .eq('id', id);

  if (error) throwDbError(error, 'deleteCajita');
}

/**
 * Busca cajitas cuyo IMEI contenga el texto dado.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchCajitas(query) {
  const { data, error } = await supabase
    .from('cajitas')
    .select(`
      id, imei, modem, sim, created_at, updated_at,
      creator:profiles!cajitas_created_by_fkey ( nombre, avatar_url ),
      updater:profiles!cajitas_updated_by_fkey ( nombre, avatar_url )
    `)
    .ilike('imei', `%${query}%`)
    .order('imei', { ascending: true });

  if (error) throwDbError(error, 'searchCajitas');
  return data ?? [];
}


/* =========================================================================
   REPORTES
   ========================================================================= */

/**
 * Obtiene todos los reportes de una cajita.
 * @param {string} cajitaId - UUID de la cajita
 * @returns {Promise<Array>}
 */
export async function getReportes(cajitaId) {
  const { data, error } = await supabase
    .from('reportes')
    .select(`
      id,
      cajita_id,
      fecha,
      nombre,
      estado,
      notas,
      created_at,
      updated_at,
      created_by,
      updated_by,
      creator:profiles!reportes_created_by_fkey ( nombre, avatar_url ),
      updater:profiles!reportes_updated_by_fkey ( nombre, avatar_url )
    `)
    .eq('cajita_id', cajitaId)
    .order('created_at', { ascending: true });

  if (error) throwDbError(error, 'getReportes');
  return data ?? [];
}

/**
 * Crea un nuevo reporte.
 * @param {string} cajitaId
 * @param {{ fecha?, nombre?, estado?, notas? }} payload
 */
export async function createReporte(cajitaId, { fecha = null, nombre = '', estado = '', notas = '' }) {
  const uid = await currentUserId();

  const { data, error } = await supabase
    .from('reportes')
    .insert({
      cajita_id:  cajitaId,
      fecha:      fecha   || null,
      nombre:     nombre.trim(),
      estado:     estado.trim(),
      notas:      notas.trim(),
      created_by: uid,
      updated_by: uid,
    })
    .select(`
      id, cajita_id, fecha, nombre, estado, notas,
      created_at, updated_at,
      creator:profiles!reportes_created_by_fkey ( nombre, avatar_url ),
      updater:profiles!reportes_updated_by_fkey ( nombre, avatar_url )
    `)
    .single();

  if (error) throwDbError(error, 'createReporte');
  return data;
}

/**
 * Actualiza un reporte existente.
 * @param {string} id - UUID del reporte
 * @param {{ fecha?, nombre?, estado?, notas? }} payload
 */
export async function updateReporte(id, { fecha, nombre, estado, notas }) {
  const uid = await currentUserId();

  const patch = { updated_by: uid };
  if (fecha   !== undefined) patch.fecha   = fecha  || null;
  if (nombre  !== undefined) patch.nombre  = nombre.trim();
  if (estado  !== undefined) patch.estado  = estado.trim();
  if (notas   !== undefined) patch.notas   = notas.trim();

  const { data, error } = await supabase
    .from('reportes')
    .update(patch)
    .eq('id', id)
    .select(`
      id, cajita_id, fecha, nombre, estado, notas,
      created_at, updated_at,
      creator:profiles!reportes_created_by_fkey ( nombre, avatar_url ),
      updater:profiles!reportes_updated_by_fkey ( nombre, avatar_url )
    `)
    .single();

  if (error) throwDbError(error, 'updateReporte');
  return data;
}

/**
 * Elimina un reporte.
 * @param {string} id - UUID del reporte
 */
export async function deleteReporte(id) {
  const { error } = await supabase
    .from('reportes')
    .delete()
    .eq('id', id);

  if (error) throwDbError(error, 'deleteReporte');
}
