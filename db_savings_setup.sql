-- 1. Configuraciones de Ahorros
CREATE TABLE IF NOT EXISTS public.savings_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    ws_id TEXT NOT NULL,
    semanas_anio INT DEFAULT 48,
    indicators JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: To run calculations, adapt the queries below to your specific schema.
-- Ensure the columns (e.g., 'cantidad', 'kg_merma') exist in your tables (activities, mermas).

-- Example: Get activity data for PPH calculations
-- SELECT 
--     area,
--     fecha,
--     count(*) as total_actividades,
--     sum(cantidad) as total_unidades -- Replace 'cantidad' with correct column
-- FROM public.activities
-- GROUP BY area, fecha;

-- Example: Get merma data
-- SELECT 
--     area,
--     fecha,
--     sum(kg_merma) as total_merma -- Replace 'kg_merma' with correct column
-- FROM public.mermas
-- GROUP BY area, fecha;
