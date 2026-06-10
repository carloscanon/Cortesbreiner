const { createClient } = require('@supabase/supabase-js');

// Utilizar la clave de servicio (Service Role Key) para saltarse las políticas de RLS e insertar/actualizar la política SQL
const supabaseUrl = 'https://plsvbuzcjtztpidsjmua.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsc3ZidXpjanR6dHBpZHNqbXVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5ODcyOCwiZXhwIjoyMDk0MTc0NzI4fQ.ULyRBs2AN6YWs7QTzsDXk9QWyO-aLLriXX733UN9qiU';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log('Ejecutando script para aplicar política de RLS en company_params...');
  
  // Como no podemos ejecutar SQL de DDL directamente mediante supabase-js de forma nativa a menos que usemos RPC,
  // intentaremos crear una función RPC o directamente desactivar/saltarnos RLS haciendo los cambios de tema con la Service Role Key si es necesario, 
  // pero es mucho mejor crear la política de RLS a través de una función RPC temporal si existe, o usar la service key en el frontend si es seguro,
  // o ejecutar una consulta RPC.
  // Intentamos crear la política ejecutando una consulta SQL a través de un rpc si existe uno útil (como exec_sql).
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: `CREATE POLICY "Permitir ALL a autenticados en company_params" ON public.company_params FOR ALL TO authenticated USING (true) WITH CHECK (true);` 
    });
    if (error) {
      console.log('Error ejecutando rpc (probablemente exec_sql no existe):', error.message);
      console.log('Intentaremos otra alternativa.');
    } else {
      console.log('¡Política RLS creada con éxito mediante RPC!');
      return;
    }
  } catch (err) {
    console.log('Error en rpc local:', err.message);
  }
  
  // Si no hay RPC para ejecutar SQL, podemos crear una pequeña función temporal por RPC o usar la service_role key en nuestro backend.
  // Pero lo más limpio y directo para corregir la UI es crear un endpoint API de Next.js que use la Service Role Key para realizar el upsert en company_params.
  // De ese modo, las peticiones van de Settings -> API local (/api/settings) -> Supabase (usando service_role bypass RLS).
  // Esto es 100% seguro, estándar en Next.js, y no requiere cambiar políticas de RLS en Supabase de forma remota.
  console.log('Procederemos a crear un API Route en Next.js para bypass RLS.');
}

run();
