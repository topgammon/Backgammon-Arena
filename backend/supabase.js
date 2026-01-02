import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseKey = supabaseServiceRoleKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️  Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) in your .env file');
} else if (!supabaseServiceRoleKey) {
  console.warn('⚠️  WARNING: Using SUPABASE_ANON_KEY instead of SUPABASE_SERVICE_ROLE_KEY. Database updates may fail due to RLS policies.');
  console.warn('   For ELO updates to work, you MUST use SUPABASE_SERVICE_ROLE_KEY in the backend.');
} else {
  console.log('✅ Using SUPABASE_SERVICE_ROLE_KEY - RLS policies will be bypassed');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

