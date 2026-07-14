-- SQL script to create the 'resumen_productividad' table in Supabase.
-- Run this in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.resumen_productividad (
    fecha DATE NOT NULL,
    area TEXT NOT NULL,
    producto TEXT NOT NULL,
    duracion_min NUMERIC NOT NULL DEFAULT 0,
    cantidad NUMERIC NOT NULL DEFAULT 0,
    personas INTEGER NOT NULL DEFAULT 0,
    unidades_hora NUMERIC NOT NULL DEFAULT 0,
    pph NUMERIC NOT NULL DEFAULT 0,
    obj_maquina NUMERIC NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (fecha, area, producto)
);

-- Disable Row Level Security (RLS) to ensure direct sync works seamlessly
ALTER TABLE public.resumen_productividad DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anonymous and authenticated users
GRANT ALL ON TABLE public.resumen_productividad TO anon;
GRANT ALL ON TABLE public.resumen_productividad TO authenticated;
GRANT ALL ON TABLE public.resumen_productividad TO postgres;
GRANT ALL ON TABLE public.resumen_productividad TO service_role;
