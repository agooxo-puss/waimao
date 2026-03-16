import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sjokgfqpyuzrhuvrnvcz.supabase.co'
const supabaseKey = 'sb_publishable_0shlrzPR6MoWE5td6BO3Pg_onhIIWK_'

export const supabase = createClient(supabaseUrl, supabaseKey)
