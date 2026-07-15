/**
 * RUBM v3.0 — Supabase Client Configuration
 * config.js
 *
 * Este módulo exporta el cliente de Supabase como singleton.
 * La clave `anon` es segura de exponer en el cliente porque:
 *   1. Row Level Security (RLS) está habilitado en todas las tablas.
 *   2. Los usuarios no autenticados no pueden leer ni escribir datos.
 *   3. Cada usuario solo puede operar sobre sus propios datos de perfil.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = 'https://bzmvnsgqtflpknnqadrj.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bXZuc2dxdGZscGtubnFhZHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMjE5NDQsImV4cCI6MjA5OTY5Nzk0NH0.2_6ETtertlcOt-OaHpjqKCzUGw1BMh2z6_UA3Bq6390';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession:      true,   // sesión persiste entre recargas
    autoRefreshToken:    true,   // renueva el JWT antes de que expire
    detectSessionInUrl:  true,   // captura el token de reset-password de la URL
  },
});
