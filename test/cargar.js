// Uso: node test/cargar.js <archivos.xlsx...>  -> imprime insights (prueba local, no se usa en la herramienta)
const XLSX = require('xlsx');
const MDY = require('../src/core.js');
function leer(p) {
  const wb = XLSX.readFile(p, { cellDates: false });
  const hojas = {};
  for (const n of wb.SheetNames) hojas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
  return { hojas };
}
const estado = MDY.estadoVacio();
for (const f of process.argv.slice(2)) {
  const r = MDY.interpretarLibro(leer(f));
  console.log(f.split('/').pop(), '->', r.tipo, r.resumen || r.error);
  MDY.incorporar(estado, r, f);
}
module.exports = estado;
if (require.main === module) {
  const mes = MDY.mesesDisponibles(estado).pop();
  console.log('Meses', MDY.mesesDisponibles(estado), 'ultima', MDY.ultimaFechaDatos(estado, mes));
  for (const c of ['premium', 'fullclaro']) for (const i of ['ns', 'tmg', 'rell', 'ct']) {
    for (const m of [MDY.util.mesAnterior(mes), mes]) {
      const x = MDY.insights(estado, c, i, m);
      console.log(`\n== ${c} ${i} ${m}\nORIGEN:\n - ${x.origen.join('\n - ')}\nRESULTADO:\n - ${x.resultado.join('\n - ')}`);
    }
  }
}
