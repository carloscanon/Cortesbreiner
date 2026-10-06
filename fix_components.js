const fs = require('fs');
const path = require('path');

const replacements = [
  { p: /GestiÃ³n/g, r: 'Gestión' },
  { p: /Ã³/g, r: 'ó' },
  { p: /Ã“/g, r: 'Ó' },
  { p: /Ã©/g, r: 'é' },
  { p: /Ã‰/g, r: 'É' },
  { p: /Ã­/g, r: 'í' },
  { p: /Ã /g, r: 'Í' },
  { p: /Ã¡/g, r: 'á' },
  { p: /Ã /g, r: 'Á' },
  { p: /Ãº/g, r: 'ú' },
  { p: /Ãš/g, r: 'Ú' },
  { p: /Ã±/g, r: 'ñ' },
  { p: /Ã‘/g, r: 'Ñ' }
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('components');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  replacements.forEach(rep => {
    if (content.match(rep.p)) {
      content = content.replace(rep.p, rep.r);
      changed = true;
    }
  });
  if (changed) {
    console.log('Fixed', file);
    fs.writeFileSync(file, content, 'utf8');
  }
});
