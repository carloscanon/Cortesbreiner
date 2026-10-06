const fs = require('fs');

const replacements = [
  { p: /GestiÃ³n/g, r: 'Gestión' },
  { p: /Ã³rdenes/g, r: 'órdenes' },
  { p: /Ã“rdenes/g, r: 'Órdenes' },
  { p: /producciÃ³n/g, r: 'producción' },
  { p: /ConfecciÃ³n/g, r: 'Confección' },
  { p: /EnvÃ­o/g, r: 'Envío' },
  { p: /recepciÃ³n/g, r: 'recepción' },
  { p: /inspecciÃ³n/g, r: 'inspección' },
  { p: /LiquidaciÃ³n/g, r: 'Liquidación' },
  { p: /satÃ©lite/g, r: 'satélite' },
  { p: /ConfiguraciÃ³n/g, r: 'Configuración' },
  { p: /categorÃ­as/g, r: 'categorías' },
  { p: /mÃ¡rgenes/g, r: 'márgenes' },
  { p: /envÃ­os/g, r: 'envíos' },
  { p: /AnalÃ­tica/g, r: 'Analítica' },
  { p: /anÃ¡lisis/g, r: 'análisis' },
  { p: /MÃ³dulo/g, r: 'Módulo' },
  { p: /facturaciÃ³n/g, r: 'facturación' },
  { p: /electrÃ³nica/g, r: 'electrónica' },
  { p: /integraciÃ³n/g, r: 'integración' },
  { p: /tÃ¡ctil/g, r: 'táctil' },
  { p: /AdministraciÃ³n/g, r: 'Administración' },
  { p: /administraciÃ³n/g, r: 'administración' },
  { p: /DocumentaciÃ³n/g, r: 'Documentación' },
  { p: /tÃ©cnicos/g, r: 'técnicos' },
  { p: /sesiÃ³n/g, r: 'sesión' },
  { p: /Ã­conos/g, r: 'íconos' },
  { p: /RÃ¡pidas/g, r: 'Rápidas' },
  { p: /Ãndigo/g, r: 'Índigo' },
  { p: /Ãmbar/g, r: 'Ámbar' },
  { p: /TipografÃ­a/g, r: 'Tipografía' },
  { p: /VisualizaciÃ³n/g, r: 'Visualización' },
  { p: /tamaÃ±o/g, r: 'tamaño' },
  { p: /TamaÃ±o/g, r: 'Tamaño' },
  { p: /TipogrÃ¡fica/g, r: 'Tipográfica' },
  { p: /ClÃ¡sica/g, r: 'Clásica' },
  { p: /PequeÃ±o/g, r: 'Pequeño' },
  { p: /EstÃ¡ndar/g, r: 'Estándar' },
  { p: /cÃ¡lculos/g, r: 'cálculos' },
  { p: /MÃ­nimo/g, r: 'Mínimo' },
  { p: /cÃ¡lculo/g, r: 'cálculo' },
  { p: /MÃ¡ximo/g, r: 'Máximo' },
  { p: /quÃ©/g, r: 'qué' },
  { p: /nÃºmero/g, r: 'número' },
  { p: /marcaciÃ³n/g, r: 'marcación' },
  { p: /estarÃ¡n/g, r: 'estarán' },
  { p: /aparecerÃ¡n/g, r: 'aparecerán' },
  { p: /tendrÃ¡n/g, r: 'tendrán' },
  { p: /opciÃ³n/g, r: 'opción' },
  { p: /PÃ¡gina/g, r: 'Página' },
  { p: /cuÃ¡ntos/g, r: 'cuántos' },
  { p: /paginaciÃ³n/g, r: 'paginación' },
  { p: /BÃ¡sica/g, r: 'Básica' },
  { p: /PÃ©rez/g, r: 'Pérez' },
  { p: /DescripciÃ³n/g, r: 'Descripción' },
  { p: /QuÃ©/g, r: 'Qué' },
  { p: /MenÃº/g, r: 'Menú' },
  { p: /ELECTRÃ“NICO/g, r: 'ELECTRÓNICO' },
  { p: /CONTRASEÃ‘A/g, r: 'CONTRASEÑA' },
  { p: /mÃ¡s/g, r: 'más' },
  { p: /aquÃ­/g, r: 'aquí' },
  { p: /contraseÃ±a/g, r: 'contraseña' },
  // And just in case they are actually corrupted with another variant
  { p: /Gestiï¿½n/g, r: 'Gestión' },
  { p: /Gesti.n/g, r: 'Gestión' }, // safe fallback? nah, might match Gesti_n
  // Let's also check for literal Ã³
];

let file = fs.readFileSync('app/settings/page.tsx', 'utf8');

for (let i = 0; i < replacements.length; i++) {
  file = file.replace(replacements[i].p, replacements[i].r);
}

fs.writeFileSync('app/settings/page.tsx', file, 'utf8');
