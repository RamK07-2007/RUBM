-- ================================================================
-- RUBM v3.0 — Supabase Database Setup
-- Ejecutar UNA SOLA VEZ en: Supabase Dashboard > SQL Editor
-- ================================================================


-- ================================================================
-- 1. TABLA: profiles
--    Extiende auth.users con información adicional del usuario.
--    Se crea automáticamente vía trigger al registrar un usuario.
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT        NOT NULL DEFAULT '',
  rol         TEXT        NOT NULL DEFAULT 'usuario'
                          CHECK (rol IN ('admin', 'usuario', 'lector')),
  empresa_id  UUID        NULL,           -- preparado para multi-empresa futura
  activo      BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_access TIMESTAMPTZ NULL
);

COMMENT ON TABLE  public.profiles              IS 'Perfil extendido de cada usuario autenticado.';
COMMENT ON COLUMN public.profiles.rol          IS 'Rol del usuario: admin | usuario | lector';
COMMENT ON COLUMN public.profiles.empresa_id   IS 'Reservado para soporte multi-empresa futuro.';


-- ================================================================
-- 2. TABLA: cajitas
--    Cada cajita representa un equipo identificado por IMEI.
-- ================================================================
CREATE TABLE IF NOT EXISTS public.cajitas (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  imei        TEXT        NOT NULL,
  modem       TEXT        NOT NULL DEFAULT '',
  sim         TEXT        NOT NULL DEFAULT '',
  empresa_id  UUID        NULL,           -- reservado para multi-empresa
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        NOT NULL REFERENCES public.profiles(id),
  updated_by  UUID        NOT NULL REFERENCES public.profiles(id),
  CONSTRAINT cajitas_imei_unique UNIQUE (imei)
);

COMMENT ON TABLE  public.cajitas              IS 'Equipos/cajitas identificados por IMEI.';
COMMENT ON COLUMN public.cajitas.created_by   IS 'Usuario que creó la cajita (auditoría).';
COMMENT ON COLUMN public.cajitas.updated_by   IS 'Último usuario en modificar la cajita (auditoría).';


-- ================================================================
-- 3. TABLA: reportes
--    Cada reporte pertenece a una cajita.
--    Se elimina en cascada si se elimina la cajita.
-- ================================================================
CREATE TABLE IF NOT EXISTS public.reportes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cajita_id   UUID        NOT NULL REFERENCES public.cajitas(id) ON DELETE CASCADE,
  fecha       DATE        NULL,
  nombre      TEXT        NOT NULL DEFAULT '',
  estado      TEXT        NOT NULL DEFAULT '',
  notas       TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID        NOT NULL REFERENCES public.profiles(id),
  updated_by  UUID        NOT NULL REFERENCES public.profiles(id)
);

COMMENT ON TABLE  public.reportes             IS 'Reportes de servicio asociados a cada cajita.';
COMMENT ON COLUMN public.reportes.cajita_id   IS 'FK a cajitas. Cascade delete.';
COMMENT ON COLUMN public.reportes.created_by  IS 'Usuario que creó el reporte (auditoría).';
COMMENT ON COLUMN public.reportes.updated_by  IS 'Último usuario en modificar el reporte (auditoría).';


-- ================================================================
-- 4. TRIGGERS — updated_at automático
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger en cajitas
DROP TRIGGER IF EXISTS trg_cajitas_updated_at ON public.cajitas;
CREATE TRIGGER trg_cajitas_updated_at
  BEFORE UPDATE ON public.cajitas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Trigger en reportes
DROP TRIGGER IF EXISTS trg_reportes_updated_at ON public.reportes;
CREATE TRIGGER trg_reportes_updated_at
  BEFORE UPDATE ON public.reportes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Trigger en profiles
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- ================================================================
-- 5. TRIGGER — Crear profile automáticamente al registrarse
-- ================================================================

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'nombre',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();


-- ================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajitas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;


-- ── PROFILES ──────────────────────────────────────────────────

-- Los usuarios solo pueden ver y editar su propio perfil
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);


-- ── CAJITAS ───────────────────────────────────────────────────
-- Modelo empresa: todos los usuarios autenticados comparten las cajitas.
-- En el futuro se puede agregar filtro por empresa_id.

CREATE POLICY "cajitas_select_authenticated"
  ON public.cajitas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "cajitas_insert_authenticated"
  ON public.cajitas FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "cajitas_update_authenticated"
  ON public.cajitas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "cajitas_delete_authenticated"
  ON public.cajitas FOR DELETE
  TO authenticated
  USING (true);


-- ── REPORTES ──────────────────────────────────────────────────

CREATE POLICY "reportes_select_authenticated"
  ON public.reportes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reportes_insert_authenticated"
  ON public.reportes FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "reportes_update_authenticated"
  ON public.reportes FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "reportes_delete_authenticated"
  ON public.reportes FOR DELETE
  TO authenticated
  USING (true);


-- ================================================================
-- 7. REALTIME — Habilitar para cajitas y reportes
-- ================================================================

-- Habilita la replicación en tiempo real para ambas tablas
ALTER PUBLICATION supabase_realtime ADD TABLE public.cajitas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reportes;


-- ================================================================
-- ✅ FIN DEL SCRIPT
-- ================================================================
-- Después de ejecutar este script:
--
--   1. Ir a Authentication > Providers > Email
--      → La confirmación de email ya está habilitada por defecto.
--      → Si quieren desactivarla para testing: apagar "Confirm email".
--
--   2. Ir a Authentication > URL Configuration
--      → Agregar la URL de la app en "Redirect URLs" para que el
--        link de reset de contraseña funcione correctamente.
--
--   3. (Opcional) Ir a Database > Replication y verificar que
--      cajitas y reportes figuren como tablas replicadas.
-- ================================================================
