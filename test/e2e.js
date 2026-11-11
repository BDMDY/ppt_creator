// Prueba de punta a punta: node test/e2e.js <carpeta_salida> <archivos.xlsx...>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const out = process.argv[2]; const files = process.argv.slice(3);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 900 } });
  await ctx.route(/^https?:/, (r) => { console.log('BLOQUEADO (red):', r.request().url()); r.abort(); });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../dist/MDY_Presentaciones.html'));
  await page.setInputFiles('#archivos', files);
  await page.waitForSelector('#resultadoCarga table');
  console.log((await page.innerText('#resultadoCarga')).trim());
  await page.screenshot({ path: out + '/ui1.png', fullPage: true });
  // Manual: retención
  await page.click('[data-tab=manual]');
  await page.click('[data-sub=ret]');
  for (const [m, r, c] of [['2026-08', '72.5', '27.5'], ['2026-09', '74.3', '25.7'], ['2026-10', '81.5', '18.5']]) {
    const f = page.locator('#sub-ret [data-camp=premium] .nuevo-ret');
    await f.locator('[name=mes]').fill(m); await f.locator('[name=ret]').fill(r); await f.locator('[name=canc]').fill(c);
    await f.locator('button').click();
  }
  // Headcount
  await page.click('[data-sub=hc]');
  const hc = page.locator('#sub-hc [data-camp=premium]');
  const set = async (loc, v) => { await loc.fill(v); await loc.dispatchEvent('change'); };
  await set(hc.locator('[data-hc=operadores]'), '16');
  await set(hc.locator('[data-hc=ftes]'), '15.5');
  await set(hc.locator('[data-hc=dimensionado]'), '17.5');
  await set(hc.locator('[data-turno=Tarde][data-k=requerido]'), '8');
  await set(hc.locator('[data-turno=Tarde][data-k=actual]'), '4');
  const ev = hc.locator('.nuevo-ev');
  await ev.locator('[name=fecha]').fill('2026-10-29'); await ev.locator('[name=tipo]').selectOption('Traslado entre campañas');
  await ev.locator('[name=cantidad]').fill('3'); await ev.locator('[name=turno]').selectOption('Tarde'); await ev.locator('[name=estado]').selectOption('En proceso');
  await ev.locator('[name=comentario]').fill('3 agentes de Full Claro a Premium'); await ev.locator('button').click();
  await page.screenshot({ path: out + '/ui2.png', fullPage: true });
  // Compromiso
  await page.click('[data-sub=comp]'); await page.click('#sub-comp [data-accion=add]');
  const c = page.locator('#sub-comp tr[data-i="0"]');
  for (const [k, v] of [['indicador', 'NS · Premium'], ['compromiso', 'Cerrar cobertura turno tarde'], ['responsable', 'Jefatura Premium'], ['fecha', '15/11']]) await set(c.locator(`[data-k=${k}]`), v);
  // Revisar
  await page.click('[data-tab=revisar]');
  await page.waitForSelector('#laminas .lam');
  if (process.env.CORTE) { await page.fill('#fechaCorte', process.env.CORTE); await page.dispatchEvent('#fechaCorte', 'change'); await page.waitForSelector('#laminas .lam'); console.log((await page.innerText('#laminas .info')).trim()); }
  await page.locator('textarea[data-texto="premium.ns"][data-campo=accion]').fill('Cambio de dinámica de alertas en línea.\nProyección diaria de asistencia.');
  await page.locator('input[data-texto="premium.ns"][data-campo=cierreTexto]').fill('Ausentismo de domingos impide cumplir el objetivo.');
  await page.screenshot({ path: out + '/ui3.png', fullPage: false });
  // Descargar
  await page.click('[data-tab=descargar]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnGenerar')]);
  const destino = out + '/' + dl.suggestedFilename(); await dl.saveAs(destino);
  console.log('Descargado:', destino);
  await page.reload();
  const n = await page.evaluate(() => Object.keys(window.__mdy.estado.manual.retencion.premium).length);
  console.log('Retención persistida tras recargar:', n, 'meses');
  console.log('Errores:', errores.length ? errores : 'ninguno');
  await browser.close();
})();
