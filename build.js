// Construye dist/MDY_Presentaciones.html: un solo archivo que funciona sin internet.
// Uso: node build.js
const fs = require('fs');
const path = require('path');
const r = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const b64 = (p) => fs.readFileSync(path.join(__dirname, p)).toString('base64');
const seguro = (js) => js.replace(/<\/script/gi, '<\\/script');

const libs = [
  r('node_modules/pptxgenjs/dist/pptxgen.bundle.js'),
  r('node_modules/xlsx/dist/xlsx.core.min.js'),
].join('\n;\n');
const assets = 'window.MDY_ASSETS = ' + JSON.stringify({
  portada: 'image/jpeg;base64,' + b64('assets/portada.jpg'),
  separador: 'image/jpeg;base64,' + b64('assets/separador.jpg'),
  cierre: 'image/jpeg;base64,' + b64('assets/cierre.jpg'),
  logoGrande: 'image/png;base64,' + b64('assets/logo_grande.png'),
  logoChico: 'image/png;base64,' + b64('assets/logo_chico.png'),
}) + ';';

let html = r('src/index.html');
const partes = {
  '/*__ESTILOS__*/': r('src/styles.css'),
  '/*__LIBS__*/': seguro(libs),
  '/*__ASSETS__*/': assets,
  '/*__CORE__*/': seguro(r('src/core.js')),
  '/*__DECK__*/': seguro(r('src/deck.js')),
  '/*__APP__*/': seguro(r('src/app.js')),
};
for (const [k, v] of Object.entries(partes)) html = html.split(k).join(v);
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const out = path.join(__dirname, 'dist', 'MDY_Presentaciones.html');
fs.writeFileSync(out, html);
console.log('OK', out, (html.length / 1024 / 1024).toFixed(2) + ' MB');
