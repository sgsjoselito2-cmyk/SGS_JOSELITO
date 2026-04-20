-- SQL para configurar la gestión de usuarios y permisos
-- Ejecuta este script en el editor SQL de Supabase (SQL Editor)

-- 1. Crear tabla de permisos
CREATE TABLE IF NOT EXISTS public.user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email TEXT,
    level INTEGER NOT NULL DEFAULT 1, -- 1: TOP 5, 2: TOP 15, 3: TOP 60
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de seguridad
-- Permitir que cualquier usuario autenticado lea su propio permiso
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Permitir que los usuarios de Nivel 3 gestionen todos los permisos
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_permissions
        WHERE user_id = auth.uid() AND level = 3
    )
);

-- 4. Funión y Trigger para crear automáticamente el permiso Nivel 1 al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_permissions (user_id, email, level)
    VALUES (NEW.id, NEW.email, 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si ya existe para evitar errores al re-ejecutar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5. Función para manejar la actualización de 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_permissions_updated_at ON public.user_permissions;

CREATE TRIGGER update_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- NOTA: Para que un usuario sea Admin (Nivel 3) por primera vez, 
-- puedes ejecutar este comando manualmente con su ID de usuario:
-- UPDATE public.user_permissions SET level = 3 WHERE email = 'tu-email@ejemplo.com';
