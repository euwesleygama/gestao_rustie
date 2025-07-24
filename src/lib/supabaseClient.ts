import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://olkffpuztahfrivgeuaj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sa2ZmcHV6dGFoZnJpdmdldWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDgxMTUsImV4cCI6MjA2ODc4NDExNX0.6At8zFI7NIs8sRdD_5wXjyhKLzzUBSIpj6N4KUbm288';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 