const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
env.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2 && !line.trim().startsWith('#')) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
  }
});
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

function cleanColorDisplayName(rawColor) {
  if (!rawColor) return '';
  let str = rawColor.trim();
  // Si contiene /, eliminar todo lo anterior a la barra: ej "JABON/, NEGRO 10" -> "NEGRO 10"
  if (str.includes('/')) {
    str = str.split('/').slice(1).join('/').trim();
  }
  // Eliminar comas iniciales o sobrantes: ej ", NEGRO 10" -> "NEGRO 10"
  str = str.replace(/^[,\s-]+/, '').trim();

  // Si tiene un código numérico al final precedido de espacio o guion:
  // ej: "AMARILLO 10605" -> "AMARILLO", "NEGRO 10" -> "NEGRO", "CREMA 197" -> "CREMA", "CAFE 80431" -> "CAFE", "ROJO-3392" -> "ROJO", "TERRA 3656" -> "TERRA"
  // pero conservar nombres compuestos válidos como "AZUL OSCURO" o "VERDE BOTELLA"
  const matchNumericCode = str.match(/^(.*?)[-\s]+(\d{1,6})$/);
  if (matchNumericCode && matchNumericCode[1].trim().length >= 3) {
    str = matchNumericCode[1].trim();
  }
  return str;
}

function resolveColorAndFabric(cut, fabricsList, colorsList) {
  const fabricObj = (fabricsList || []).find(f => String(f.id) === String(cut.fabric_id)) || cut.fabrics;
  let rawFabricName = fabricObj?.nombre_tela || fabricObj?.nombre || fabricObj?.codigo_tela || cut.tela || cut.fabric_name || '';

  let colorObj = cut.colors || (cut.color_id ? (colorsList || []).find(c => String(c.id) === String(cut.color_id)) : null);
  let rawColorString = cut.color || cut.color_name || cut.nombre_color || '';
  let fabricName = rawFabricName || '—';

  // 1. Extraer nombre de tela y color inicial si viene separado por , o / o -
  if (rawFabricName) {
    let cleanFab = rawFabricName.trim();
    if (cleanFab.includes(',')) {
      const parts = cleanFab.split(',');
      fabricName = parts[0].replace(/\/$/, '').trim() || '—';
      if (!rawColorString && parts[1]) {
        rawColorString = parts.slice(1).join(' ').trim();
      }
    } else if (cleanFab.includes('/')) {
      const parts = cleanFab.split('/');
      fabricName = parts[0].trim() || '—';
      if (!rawColorString && parts[1]) {
        rawColorString = parts.slice(1).join(' ').trim();
      }
    } else if (cleanFab.includes('-')) {
      const parts = cleanFab.split('-');
      fabricName = parts[0].trim() || '—';
      if (!rawColorString && parts[1]) {
        rawColorString = parts.slice(1).join(' ').trim();
      }
    }
  }

  // 2. Si no tenemos colorObj aún, buscar en el maestro de colores
  if (!colorObj && (rawColorString || rawFabricName)) {
    const sortedColors = [...(colorsList || [])].sort((a, b) => ((b.nombre_color || '').length - (a.nombre_color || '').length));

    // A. Buscar en rawColorString si existe
    if (rawColorString) {
      const cleanCand = cleanColorDisplayName(rawColorString).toUpperCase();
      const firstWord = cleanCand.split(/[\s-]+/)[0];

      colorObj = sortedColors.find(c => {
        const cClean = cleanColorDisplayName(c.nombre_color || '').toUpperCase();
        return cClean && (cClean === cleanCand || cClean === firstWord || (cClean.length >= 3 && cleanCand.startsWith(cClean)));
      });
    }

    // B. Si aún no encuentra, buscar si alguna palabra en rawFabricName coincide con un color
    if (!colorObj && rawFabricName) {
      const rawUpper = rawFabricName.toUpperCase();
      for (const c of sortedColors) {
        const cClean = cleanColorDisplayName(c.nombre_color || '').toUpperCase();
        if (!cClean || cClean.length < 3) continue;
        const regex = new RegExp(`(^|[^a-zA-Z0-9])${cClean}([^a-zA-Z0-9]|$)`, 'i');
        if (regex.test(rawUpper)) {
          colorObj = c;
          break;
        }
      }
    }
  }

  let finalColorName = '';
  if (colorObj) {
    finalColorName = cleanColorDisplayName(colorObj.nombre_color || colorObj.codigo_color || '');
  } else if (rawColorString) {
    finalColorName = cleanColorDisplayName(rawColorString);
  }

  const colorHex = colorObj?.hex_color || '';
  return { colorName: finalColorName, colorHex, fabricName };
}

async function run() {
  const { data: colors } = await supabase.from('colors').select('*');
  const { data: fabrics } = await supabase.from('fabrics').select('*');
  const { data: cuts } = await supabase.from('cuts')
    .select('*, fabrics(*), colors(*)')
    .or('product_id.eq.461960b8-5d1a-45e7-9485-af40e2dc50e8,product_id.eq.4576e8f3-8cb3-46f8-a007-e82864a2cc9a');

  cuts.forEach(cut => {
    const res = resolveColorAndFabric(cut, fabrics, colors);
    console.log(`Original: "${cut.fabrics?.nombre_tela}" => Color: "${res.colorName}", Hex: "${res.colorHex}", Fabric: "${res.fabricName}"`);
  });
}
run();
