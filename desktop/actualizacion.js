// Elige qué versión de la app abrir: la incluida en el .exe o una actualización
// (PulsoCX.html) colocada junto al .exe. Gana la de versión más alta.
const fs = require('fs');
const path = require('path');

function versionDe(archivo) {
  try {
    const txt = fs.readFileSync(archivo, 'utf8');
    const m = txt.match(/PULSO_CREDITOS\s*=\s*\{[^}]*"version"\s*:\s*"(\d+(?:\.\d+)*)"/);
    return m ? m[1] : null;
  } catch (e) { return null; }
}
function comparar(a, b) {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; }
  return 0;
}
function elegirHtml(incluido, carpetas) {
  let mejor = { archivo: incluido, version: versionDe(incluido) || '0', origen: 'incluida' };
  for (const dir of carpetas.filter(Boolean)) {
    let nombres = [];
    try { nombres = fs.readdirSync(dir).filter((n) => /^PulsoCX.*\.html$/i.test(n)); } catch (e) { continue; }
    for (const n of nombres) {
      const f = path.join(dir, n); const v = versionDe(f);
      if (v && comparar(v, mejor.version) > 0) mejor = { archivo: f, version: v, origen: 'actualizacion' };
    }
  }
  return mejor;
}
module.exports = { elegirHtml, versionDe, comparar };
