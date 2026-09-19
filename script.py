import urllib.request, json
env = dict(line.strip().split('=', 1) for line in open('.env.local') if '=' in line and not line.startswith('#'))
req = urllib.request.Request(env['NEXT_PUBLIC_SUPABASE_URL'].replace('\"', '') + '/rest/v1/workshops?select=id,nombre_taller&id=eq.8430120b-e7ba-44c0-ae40-df6622f5e9fc')
req.add_header('apikey', env['SUPABASE_SERVICE_ROLE_KEY'].replace('\"', ''))
req.add_header('Authorization', 'Bearer ' + env['SUPABASE_SERVICE_ROLE_KEY'].replace('\"', ''))
data = json.loads(urllib.request.urlopen(req).read().decode())
print(data)
