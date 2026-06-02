import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://leletocvhbvuquxpyulp.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxlbGV0b2N2aGJ2dXF1eHB5dWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDg4MzIsImV4cCI6MjA5NTk4NDgzMn0.2xWzYjEZUTOEiWaLzsW3bi1Ig_LC3687uw9scvuFCpk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
