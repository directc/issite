// auth.js - общий файл аутентификации
const SUPABASE_URL = 'https://pnqliwwrebtnngtmmfwc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDYyMzA1ODQsImV4cCI6MjA2MTgwNjU4NH0.mqjU6-ow_BgjsioIe7IHo_5l5LrIWgThTJ0ciIJLEk0';

// Клиент для обычных операций
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Клиент только для админ-панели
const supabaseAdminClient = supabase.createClient(
  SUPABASE_URL, 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWxpd3dyZWJ0bm5ndG1tZndjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjIzMDU4NCwiZXhwIjoyMDYxODA2NTg0fQ.Cfey4xKHpAVbVogrFG-QRR9MR-oMbqrn-QLl_haCc6M', 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);