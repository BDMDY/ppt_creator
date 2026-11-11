// Prueba local: node test/generar.js salida.pptx <archivos...>
const fs = require('fs'), path = require('path');
const PptxGenJS = require('pptxgenjs');
const out = process.argv[2]; process.argv.splice(2, 1);
const estado = require('./cargar.js');
const MDY = require('../src/core.js');
const DECK = require('../src/deck.js');
const a = (f, t) => `${t};base64,` + fs.readFileSync(path.join(__dirname, '../assets', f)).toString('base64');
const assets = { portada: a('portada.jpg', 'image/jpeg'), separador: a('separador.jpg', 'image/jpeg'), cierre: a('cierre.jpg', 'image/jpeg'), logoGrande: a('logo_grande.png', 'image/png'), logoChico: a('logo_chico.png', 'image/png') };
// datos manuales de ejemplo
const m = estado.manual;
m.retencion.premium = { '2026-07': { ret: 0.731, canc: 0.2689 }, '2026-08': { ret: 0.725, canc: 0.2752 }, '2026-09': { ret: 0.743, canc: 0.257 }, '2026-10': { ret: 0.815, canc: 0.1852 } };
m.retencion.fullclaro = { '2026-08': { ret: 0.80, canc: 0.20 }, '2026-09': { ret: 0.82, canc: 0.18 }, '2026-10': { ret: 0.853, canc: 0.147 } };
Object.assign(m.headcount.premium, { operadores: 16, ftes: 15.5, dimensionado: 17.6, turnos: [{ turno: 'Mañana', requerido: 8, actual: 9 }, { turno: 'Tarde', requerido: 8, actual: 4 }], eventos: [
  { fecha: '2026-09-30', tipo: 'Ingreso a capacitación', cantidad: 7, turno: 'Mañana', modalidad: 'Full Time', estado: 'Cerrado', comentario: 'Inyección OJT' },
  { fecha: '2026-10-15', tipo: 'Cese / Retiro', cantidad: 2, turno: 'Tarde', estado: 'Cerrado', comentario: 'Retiro por impacto en fines de semana' },
  { fecha: '2026-10-29', tipo: 'Traslado entre campañas', cantidad: 3, turno: 'Tarde', estado: 'En proceso', comentario: '3 agentes de Full Claro a Premium' }] });
m.textos['2026-11'] = { 'premium.ns': { accion: 'Cambio de dinámica de alertas en línea por estados no productivos.\nProyección diaria de asistencia basada en ausentismo.', cierreTipo: 'PARCIAL', cierreTexto: 'Impacto en turno tarde y domingos impide cumplir el objetivo.' } };
m.compromisos = [{ indicador: 'Nivel de Servicio · Premium', compromiso: 'Cerrar cobertura de turno tarde', responsable: 'Jefatura Premium', fecha: '2026-11-15', estado: 'En curso' }];
m.casos = [{ titulo: 'Incidente OCC / Asesor', que: 'Se detectó incumplimiento…', causa: 'Se escaló a otra área…', accion: 'Llamado de atención…', estado: 'En cierre' }];
const pptx = DECK.generar(PptxGenJS, estado, { mes: '2026-11', fechaCorte: '2026-11-10', assets, proxCorte: 'semana del 16 de noviembre' });
pptx.writeFile({ fileName: out }).then((f) => console.log('ok', f));
