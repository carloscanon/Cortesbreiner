import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const envRaw = fs.readFileSync('.env.local', 'utf8')
const env = {}
envRaw.split('\n').forEach(line => {
  if(line.includes('=')){
    const [k, ...v] = line.split('=')
    env[k.trim()] = v.join('=').trim().replace(/^"|"$/g, '')
  }
})

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['SUPABASE_SERVICE_ROLE_KEY'])

supabase.from('sewing_orders')
  .select('*, products(*), sewing_order_sizes(*, sizes(*))').then(d => {
      const str = JSON.stringify(d.data);
      console.log('Payload size MB:', (Buffer.byteLength(str, 'utf8') / 1024 / 1024).toFixed(2));
  })
