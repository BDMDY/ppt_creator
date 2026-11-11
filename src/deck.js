/* =====================================================================
 * MDY Presentaciones — generador del PPT (estilo MDY Customer Experience)
 * Requiere: PptxGenJS (global o pasado como parámetro), MDY (core.js)
 * ===================================================================== */
(function (root) {
  'use strict';
  const MDY = root.MDY || (typeof require !== 'undefined' ? require('./core.js') : null);
  const COACH = () => root.MDY_COACH || (typeof require !== 'undefined' ? require('./coach.js') : null);
  let notasActivas = true;
  const U = MDY.util;

  const C = {
    verde: '007640', verdeClaro: '05BC57', menta: 'CFEBDC', texto: '18261E', gris: '5A6D62',
    caja: 'F5F8F5', borde: 'DDE6DE', objetivo: 'A6A6A6', blanco: 'FFFFFF',
    rojoF: 'F8E1E1', rojoT: 'C0392B', ambarF: 'FDF1DE', ambarT: 'D4881C', verdeF: 'D4EDDA', verdeT: '1E8E4E',
    mejoroF: 'E3F2E8',
  };
  const FONT = 'Arial';
  const W = 13.333;

  const CIERRES = {
    PARCIAL: { fondo: 'FDF1DE', color: '9C6B12' },
    REPLANTEAMIENTO: { fondo: 'F8E1E1', color: 'B23A3A' },
    IMPACTO: { fondo: 'F8E1E1', color: 'B23A3A' },
    'PROYECCIÓN': { fondo: 'E3F2E8', color: C.verde },
    LOGRO: { fondo: 'E3F2E8', color: C.verde },
  };
  const SEMAF = {
    ROJO: { f: C.rojoF, t: C.rojoT }, AMBAR: { f: C.ambarF, t: C.ambarT }, VERDE: { f: C.verdeF, t: C.verdeT },
  };

  /* ------------------------------ piezas comunes ------------------------------ */
  function cabecera(s, kicker, titulo) {
    s.background = { color: C.blanco };
    s.addShape('rect', { x: 0, y: 0, w: W, h: 0.95, fill: { color: C.verde }, line: { color: C.verde, width: 0 } });
    s.addText(kicker, { x: 0.5, y: 0.14, w: 9.5, h: 0.28, fontFace: FONT, fontSize: 10.5, bold: true, color: C.verdeClaro, margin: 0, isTextBox: true });
    s.addText(titulo, { x: 0.5, y: 0.42, w: 9.8, h: 0.46, fontFace: FONT, fontSize: 22, bold: true, color: C.blanco, margin: 0, isTextBox: true });
    s.addText('MDY', { x: 11.15, y: 0.18, w: 1.68, h: 0.32, fontFace: FONT, fontSize: 15, bold: true, color: C.blanco, align: 'right', margin: 0, isTextBox: true });
    s.addText('CUSTOMER EXPERIENCE', { x: 10.65, y: 0.52, w: 2.18, h: 0.22, fontFace: FONT, fontSize: 6.5, color: C.menta, align: 'right', margin: 0, isTextBox: true });
  }
  function pie(s, izq) {
    s.addText(izq, { x: 0.5, y: 7.16, w: 9.0, h: 0.26, fontFace: FONT, fontSize: 8.5, italic: true, color: C.gris, margin: 0, isTextBox: true });
    s.addText('MDY Customer Experience', { x: 9.83, y: 7.16, w: 3.0, h: 0.26, fontFace: FONT, fontSize: 8.5, color: C.gris, align: 'right', margin: 0, isTextBox: true });
  }
  function kpi(s, x, etiqueta, valor, w = 2.62) {
    s.addShape('roundRect', { x, y: 1.15, w, h: 0.82, fill: { color: C.caja }, line: { color: C.borde, width: 0.75 }, rectRadius: 0.06 });
    s.addText(etiqueta, { x: x + 0.16, y: 1.22, w: w - 0.3, h: 0.24, fontFace: FONT, fontSize: 8.5, bold: true, color: C.verde, margin: 0, isTextBox: true });
    s.addText(valor, { x: x + 0.16, y: 1.45, w: w - 0.3, h: 0.46, fontFace: FONT, fontSize: 21, bold: true, color: C.texto, margin: 0, isTextBox: true });
  }
  function leyenda(s, y, texto, x = 0.5, w = 5.5) {
    s.addText(texto, { x, y, w, h: 0.26, fontFace: FONT, fontSize: 10, bold: true, color: C.gris, margin: 0, isTextBox: true });
  }
  function marco(s, x, y, w, h) {
    s.addShape('rect', { x, y, w, h, fill: { color: C.blanco }, line: { color: C.verde, width: 1.25 } });
  }
  function aViñetas(texto) {
    return String(texto || '').split('\n').map((l) => l.replace(/^\s*[-•·*]\s*/, '').trim()).filter(Boolean);
  }
  function cierre(s, tipo, texto) {
    if (!texto || !texto.trim()) return;
    const st = CIERRES[tipo] || CIERRES.PARCIAL;
    s.addShape('roundRect', { x: 0.5, y: 6.22, w: 12.33, h: 0.86, fill: { color: st.fondo }, line: { color: st.fondo, width: 0 }, rectRadius: 0.05 });
    s.addText([
      { text: tipo + ':  ', options: { bold: true, color: st.color } },
      { text: texto.trim(), options: { color: C.texto } },
    ], { x: 0.8, y: 6.26, w: 11.8, h: 0.78, fontFace: FONT, fontSize: 12, valign: 'middle', margin: 0, isTextBox: true });
  }

  // Panel derecho ORIGEN / ACCIÓN / RESULTADO con altura proporcional al contenido
  function panel(s, secciones, y0 = 1.08, y1 = 6.12) {
    const secs = secciones.map((x) => ({ ...x, items: aViñetas(x.texto) })).filter((x) => x.items.length || x.siempre);
    if (!secs.length) return;
    const anchoTxt = 5.28;
    let tam = 12.5;
    const lineas = (t) => secs.reduce((acc, x) => acc + Math.max(1, x.items.reduce((a, it) => a + Math.ceil((it.length + 2) / ((anchoTxt * 72) / (t * 0.52))), 0)), 0);
    const alto = (t) => (t / 72) * 1.32;
    const gap = 0.14;
    const disp = y1 - y0 - gap * (secs.length - 1);
    while (tam > 9 && lineas(tam) * alto(tam) > disp) tam -= 0.5;
    const total = lineas(tam);
    let y = y0;
    secs.forEach((x, i) => {
      const n = Math.max(1, x.items.reduce((a, it) => a + Math.ceil((it.length + 2) / ((anchoTxt * 72) / (tam * 0.52))), 0));
      const h = Math.max(0.55, (disp * n) / total);
      s.addText(x.etiqueta, { x: 6.3, y: y + 0.05, w: 1.25, h: 0.3, fontFace: FONT, fontSize: 9.5, bold: true, color: C.verde, margin: 0, isTextBox: true });
      if (x.items.length) {
        s.addText(x.items.map((it, k) => ({ text: it, options: { bullet: { indent: 14 }, breakLine: k < x.items.length - 1, paraSpaceAfter: 2 } })),
          { x: 7.55, y, w: anchoTxt, h, fontFace: FONT, fontSize: tam, color: C.texto, valign: 'top', margin: [2, 0, 0, 0], isTextBox: true });
      }
      y += h;
      if (i < secs.length - 1) {
        s.addShape('line', { x: 6.3, y: y + gap / 2, w: 6.53, h: 0, line: { color: C.borde, width: 0.75 } });
        y += gap;
      }
    });
  }

  function opcionesLinea(fmt, extra = {}) {
    return Object.assign({
      catAxisLabelColor: C.gris, valAxisLabelColor: C.gris, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8,
      catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT,
      valGridLine: { color: 'E6ECE7', size: 0.5 }, catGridLine: { style: 'none' },
      valAxisLabelFormatCode: fmt, dataLabelFormatCode: fmt,
      showLegend: true, legendPos: 'b', legendFontSize: 8, legendFontFace: FONT, legendColor: C.gris,
      lineDataSymbolSize: 6, lineSize: 2,
    }, extra);
  }

  // Línea real (con etiquetas) + línea objetivo (sin etiquetas)
  function graficoLinea(pptx, s, box, etiquetas, valores, objetivo, nombre, fmt, rango) {
    marco(s, box.x, box.y, box.w, box.h);
    const pad = 0.05;
    const datosReal = [{ name: nombre, labels: etiquetas, values: valores.map((v) => (v == null ? null : v)) }];
    const tipos = [
      { type: pptx.ChartType.line, data: datosReal, options: { chartColors: [C.verde], showValue: true, dataLabelPosition: 't', dataLabelFontSize: 8, dataLabelColor: C.texto, dataLabelFontFace: FONT, lineDataSymbol: 'circle' } },
    ];
    if (objetivo != null) {
      tipos.push({ type: pptx.ChartType.line, data: [{ name: 'Objetivo', labels: etiquetas, values: etiquetas.map(() => objetivo) }], options: { chartColors: [C.objetivo], showValue: false, lineDataSymbol: 'none', lineSize: 1.5 } });
    }
    const opts = opcionesLinea(fmt, { x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad });
    if (rango) { if (rango.min != null) opts.valAxisMinVal = rango.min; if (rango.max != null) opts.valAxisMaxVal = rango.max; }
    s.addChart(tipos, opts);
  }

  function graficoBarras(pptx, s, box, etiquetas, series, fmt, colores, extra = {}) {
    marco(s, box.x, box.y, box.w, box.h);
    const pad = 0.05;
    s.addChart(pptx.ChartType.bar, series.map((x) => ({ name: x.nombre, labels: etiquetas, values: x.valores })), Object.assign(opcionesLinea(fmt, {
      x: box.x + pad, y: box.y + pad, w: box.w - 2 * pad, h: box.h - 2 * pad,
      barDir: 'col', chartColors: colores, showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 7.5, dataLabelColor: C.texto,
      showLegend: series.length > 1, barGapWidthPct: 60,
    }), extra));
  }

  function rangoPct(valores, objetivo) {
    const v = valores.filter((x) => x != null).concat(objetivo != null ? [objetivo] : []);
    if (!v.length) return null;
    const min = Math.max(0, Math.floor((Math.min(...v) - 0.1) * 10) / 10);
    const max = Math.min(1, Math.ceil((Math.max(...v) + 0.08) * 10) / 10);
    return { min, max };
  }
  function rangoNum(valores, objetivo) {
    const v = valores.filter((x) => x != null).concat(objetivo != null ? [objetivo] : []);
    if (!v.length) return null;
    const min = Math.max(0, Math.floor((Math.min(...v) * 0.85) / 100) * 100);
    const max = Math.ceil((Math.max(...v) * 1.08) / 100) * 100;
    return { min, max };
  }

  // Dos gráficos apilados en la columna izquierda (mensual arriba, semanal abajo)
  function dosGraficos(pptx, s, g1, g2, titulo) {
    leyenda(s, 2.02, titulo);
    if (g2 && g2.etiquetas.length) {
      g1(pptx, s, { x: 0.5, y: 2.3, w: 5.5, h: 1.88 });
      g2.dibujar(pptx, s, { x: 0.5, y: 4.26, w: 5.5, h: 1.86 });
    } else {
      g1(pptx, s, { x: 0.5, y: 2.3, w: 5.5, h: 3.82 });
    }
  }

  /* ------------------------------ láminas ------------------------------ */
  function laminaPortada(pptx, A) {
    const s = pptx.addSlide();
    s.background = { color: C.verde };
    if (A.portada) s.addImage({ data: A.portada, x: 0, y: 0, w: W, h: 7.5, sizing: { type: 'cover', w: W, h: 7.5 } });
    s.addShape('rect', { x: 0, y: 0, w: W, h: 7.5, fill: { color: C.verde, transparency: 60 }, line: { color: C.verde, width: 0 } });
    if (A.logoGrande) s.addImage({ data: A.logoGrande, x: 4.58, y: 2.97, w: 7.24, h: 3.05 });
    s.addText('“Trascendemos cambiando el\nmundo en cada llamada”', { x: 0.25, y: 1.37, w: 7.41, h: 1.04, fontFace: FONT, fontSize: 28, bold: true, color: C.blanco, margin: [0, 0, 0, 8], isTextBox: true });
  }

  function laminaSeparador(pptx, A, camp) {
    const s = pptx.addSlide();
    s.background = { color: C.verde };
    if (A.separador) s.addImage({ data: A.separador, x: 0, y: 0, w: W, h: 7.5, sizing: { type: 'cover', w: W, h: 7.5 } });
    s.addShape('rect', { x: 0, y: 0, w: W, h: 7.5, fill: { color: C.verde, transparency: 60 }, line: { color: C.verde, width: 0 } });
    s.addShape('rect', { x: 1.02, y: 1.7, w: 11.15, h: 3.16, fill: { color: C.blanco, transparency: 100 }, line: { color: 'D9EFE2', width: 1.5 } });
    s.addShape('rect', { x: 2.36, y: 2.24, w: 8.69, h: 2.22, fill: { color: C.verde, transparency: 40 }, line: { color: C.verde, width: 0 } });
    s.addText(MDY.CAMPANAS[camp].separador, { x: 2.36, y: 2.24, w: 8.69, h: 2.22, fontFace: 'Calibri', fontSize: 48, bold: true, color: C.blanco, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    s.addShape('rect', { x: 2.62, y: 5.45, w: 8.69, h: 0.61, fill: { color: C.verde, transparency: 40 }, line: { color: C.verde, width: 0 } });
    s.addText('Valor al Cliente - Operaciones', { x: 2.62, y: 5.45, w: 8.69, h: 0.61, fontFace: 'Calibri', fontSize: 24, bold: true, color: C.blanco, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    if (A.logoChico) s.addImage({ data: A.logoChico, x: 11.52, y: 6.55, w: 1.58, h: 0.67 });
  }

  function laminaCierreFinal(pptx, A) {
    const s = pptx.addSlide();
    s.background = { color: C.verde };
    if (A.cierre) s.addImage({ data: A.cierre, x: 0, y: 0, w: W, h: 7.5, sizing: { type: 'cover', w: W, h: 7.5 } });
    s.addShape('rect', { x: 0, y: 0, w: W, h: 7.5, fill: { color: C.verde, transparency: 60 }, line: { color: C.verde, width: 0 } });
    if (A.logoGrande) s.addImage({ data: A.logoGrande, x: 3.3, y: 2.09, w: 7.24, h: 3.05 });
  }

  function fmtValor(ind, v) {
    if (v == null) return 's/d';
    if (ind === 'tmg') return String(Math.round(v));
    return U.pct(v);
  }

  function laminaResumen(pptx, estado, mes, pieTxt) {
    const s = pptx.addSlide();
    cabecera(s, 'RESUMEN EJECUTIVO', `Estado de indicadores · ${U.mesNombre(mes)}`);
    const filas = [
      ['ns', 'Nivel de Servicio'], ['tmg', 'TMG'], ['rell', '% Rellamada'], ['ct', 'Oportunidades aprovechadas'], ['ret', 'Tasa de retención'],
    ];
    const hdr = (t, al = 'center') => ({ text: t, options: { bold: true, color: C.blanco, fill: { color: C.verde }, align: al } });
    const rows = [[hdr('Indicador', 'left'), hdr('Premium'), hdr('Estado'), hdr('Full Claro Black'), hdr('Estado')]];
    for (const [id, nombre] of filas) {
      const r = [{ text: nombre, options: { bold: true, align: 'left' } }];
      for (const camp of ['premium', 'fullclaro']) {
        const v = MDY.valorIndicador(estado, camp, id, mes);
        const t = MDY.textosLamina(estado, mes, camp, id);
        const sem = t.semaforo || MDY.semaforo(id, v, estado, camp);
        r.push({ text: fmtValor(id, v), options: { align: 'center' } });
        const st = sem ? SEMAF[sem] : null;
        r.push({ text: sem || '—', options: { align: 'center', bold: true, color: st ? st.t : C.gris, fill: { color: st ? st.f : C.blanco } } });
      }
      rows.push(r);
    }
    s.addTable(rows, { x: 0.5, y: 1.4, w: 12.33, colW: [3.9, 2.1, 1.8, 2.13, 2.4], rowH: 0.43, fontFace: FONT, fontSize: 11, color: C.texto, border: { type: 'solid', pt: 0.75, color: C.borde }, valign: 'middle' });

    const mejoro = (estado.manual.resumen[mes] && estado.manual.resumen[mes].mejoro) || mejorasAuto(estado, mes).join(' ');
    if (mejoro) {
      s.addShape('roundRect', { x: 0.5, y: 4.67, w: 12.33, h: 0.95, fill: { color: C.mejoroF }, line: { color: C.mejoroF, width: 0 }, rectRadius: 0.05 });
      s.addText([
        { text: 'Lo que sí mejoró esta semana', options: { bold: true, color: C.verde, fontSize: 12.5, breakLine: true } },
        { text: mejoro, options: { color: C.texto, fontSize: 11 } },
      ], { x: 0.75, y: 4.72, w: 11.9, h: 0.85, fontFace: FONT, valign: 'top', margin: 0, isTextBox: true });
    }
    s.addText('Semáforo: rojo = brecha crítica vs. objetivo  ·  ámbar = cerca del objetivo o en proceso  ·  verde = objetivo cumplido o mejora confirmada',
      { x: 0.5, y: 5.75, w: 12.33, h: 0.24, fontFace: FONT, fontSize: 7.5, italic: true, color: C.gris, margin: 0, isTextBox: true });
    pie(s, pieTxt);
  }

  function mejorasAuto(estado, mes) {
    const out = [];
    const prev = U.mesAnterior(mes);
    const nombres = { ns: 'NS', tmg: 'TMG', rell: 'Rellamada', ct: 'Aprovechamiento CT', ret: 'Retención' };
    const mejor = { ns: 1, tmg: -1, rell: -1, ct: 1, ret: 1 };
    const cand = [];
    for (const camp of ['premium', 'fullclaro']) for (const id of Object.keys(nombres)) {
      const a = MDY.valorIndicador(estado, camp, id, mes), b = MDY.valorIndicador(estado, camp, id, prev);
      if (a == null || b == null || a === b) continue;
      const delta = (a - b) * mejor[id];
      if (delta <= 0) continue;
      const rel = id === 'tmg' ? delta / b : delta;
      const txt = id === 'tmg' ? `${nombres[id]} ${MDY.CAMPANAS[camp].nombre}: −${Math.round(delta)} s (${U.seg(b)} → ${U.seg(a)}).` : `${nombres[id]} ${MDY.CAMPANAS[camp].nombre}: ${U.pp(a - b)} (${U.pct(b)} → ${U.pct(a)}).`;
      cand.push({ rel, txt });
    }
    cand.sort((x, y) => y.rel - x.rel);
    return cand.slice(0, 3).map((x) => x.txt);
  }

  function laminaIndicador(pptx, estado, mes, camp, ind, pieTxt) {
    const t = MDY.textosLamina(estado, mes, camp, ind);
    if (!t.incluir) return;
    const s = pptx.addSlide();
    const K = MDY.CAMPANAS[camp].kicker;
    const obj = estado.config.objetivos;
    const ml = (arr) => arr.map((x) => U.mesLabel(x.mes));

    if (ind === 'ns') {
      cabecera(s, K, 'Nivel de Servicio');
      const m = MDY.opsMes(estado, camp, mes);
      kpi(s, 0.5, 'NS MENSUAL', U.pct(m && m.ns, 2)); kpi(s, 3.38, 'OBJETIVO', U.pct(obj.ns, 2));
      const serie = MDY.serieMensual(estado, camp, mes, 6), sem = MDY.opsSemanas(estado, camp, mes);
      dosGraficos(pptx, s,
        (p, sl, b) => graficoLinea(p, sl, b, ml(serie), serie.map((x) => x.ns), obj.ns, 'NS actual', '0.0%', rangoPct(serie.map((x) => x.ns), obj.ns)),
        { etiquetas: sem.map((x) => x.etiqueta), dibujar: (p, sl, b) => graficoLinea(p, sl, b, sem.map((x) => `${x.etiqueta} (${x.rango})`), sem.map((x) => x.ns), obj.ns, 'NS semanal', '0.0%', rangoPct(sem.map((x) => x.ns), obj.ns)) },
        'Evolutivo NS Mensual (%) Vs Evolutivo Semanal (%)');
    } else if (ind === 'tmg') {
      cabecera(s, K, 'TMG');
      const m = MDY.opsMes(estado, camp, mes);
      kpi(s, 0.5, 'TMG MENSUAL', m ? `${Math.round(m.tmg)} s` : 's/d'); kpi(s, 3.38, 'OBJETIVO', `${obj.tmg[camp]} s`);
      const serie = MDY.serieMensual(estado, camp, mes, 6), sem = MDY.opsSemanas(estado, camp, mes);
      dosGraficos(pptx, s,
        (p, sl, b) => graficoLinea(p, sl, b, ml(serie), serie.map((x) => Math.round(x.tmg)), obj.tmg[camp], 'TMG (s)', '#,##0', rangoNum(serie.map((x) => x.tmg), obj.tmg[camp])),
        { etiquetas: sem, dibujar: (p, sl, b) => graficoLinea(p, sl, b, sem.map((x) => `${x.etiqueta} (${x.rango})`), sem.map((x) => Math.round(x.tmg)), obj.tmg[camp], 'TMG semanal (s)', '#,##0', rangoNum(sem.map((x) => x.tmg), obj.tmg[camp])) },
        'Evolutivo TMG Mensual (s) Vs Evolutivo TMG Semanal (s)');
    } else if (ind === 'rell') {
      cabecera(s, K, '% Rellamada');
      const r = MDY.rellMes(estado, camp, mes);
      kpi(s, 0.5, 'RELLAMADA MENSUAL', U.pct(r && r.pct, 2)); kpi(s, 3.38, 'OBJETIVO', '≤ ' + U.pct(obj.rell, 0));
      const serie = MDY.rellSerieMensual(estado, camp, mes, 6), sem = MDY.rellSemanas(estado, camp, mes);
      dosGraficos(pptx, s,
        (p, sl, b) => graficoLinea(p, sl, b, ml(serie), serie.map((x) => x.pct), obj.rell, '% Rellamada', '0.0%', rangoPct(serie.map((x) => x.pct), obj.rell)),
        { etiquetas: sem, dibujar: (p, sl, b) => graficoLinea(p, sl, b, sem.map((x) => `${x.etiqueta} (${x.rango})`), sem.map((x) => x.pct), obj.rell, '% Rellamada semanal', '0.0%', rangoPct(sem.map((x) => x.pct), obj.rell)) },
        'Evolutivo de rellamada Mensual (%) VS Evolutivo Semanal (%)');
    } else if (ind === 'ct') {
      cabecera(s, K, 'Oportunidades aprovechadas (CT)');
      const a = MDY.ctMes(estado, camp, mes);
      kpi(s, 0.5, 'APROVECHAMIENTO MENSUAL', a ? U.pct(a.c / a.g) : 's/d');
      kpi(s, 3.38, 'EFECTIVIDAD (APROV. / GENERADAS)', a ? `${a.c} / ${a.g}` : 's/d');
      if (a) {
        const dias = Object.keys(a.dias).sort();
        const sem = MDY.ctSemanas(a, mes);
        leyenda(s, 2.02, 'Migraciones diarias (CT) Vs Aprovechamiento semanal (%)');
        graficoBarras(pptx, s, { x: 0.5, y: 2.3, w: 5.5, h: 1.88 }, dias.map((d) => d.slice(8)), [{ nombre: 'CT aprovechadas', valores: dias.map((d) => a.dias[d].c) }], '0', [C.verde]);
        graficoLinea(pptx, s, { x: 0.5, y: 4.26, w: 5.5, h: 1.86 }, sem.map((x) => `${x.etiqueta} (${x.rango})`), sem.map((x) => x.pct), obj.ct, '% Aprovechamiento', '0.0%', rangoPct(sem.map((x) => x.pct), obj.ct));
      }
    } else if (ind === 'ret') {
      cabecera(s, K, 'Retención/Cancelación');
      const serie = MDY.retencionSerie(estado, camp, mes, 6);
      const ult = serie[serie.length - 1];
      kpi(s, 0.5, 'RETENCIÓN (%)', ult ? U.pct(ult.ret) : 's/d');
      kpi(s, 3.38, 'OBJETIVO', U.pct(obj.ret, 0));
      leyenda(s, 2.02, 'Retención y Cancelación Mensual (%)');
      const box = { x: 0.5, y: 2.3, w: 5.5, h: 3.82 };
      marco(s, box.x, box.y, box.w, box.h);
      if (serie.length) {
        const et = serie.map((x) => U.mesLabel(x.mes));
        s.addChart(pptx.ChartType.line, [
          { name: 'Retención', labels: et, values: serie.map((x) => x.ret) },
          { name: 'Cancelación', labels: et, values: serie.map((x) => (x.canc == null ? null : x.canc)) },
        ], opcionesLinea('0.0%', { x: box.x + 0.05, y: box.y + 0.05, w: box.w - 0.1, h: box.h - 0.1, chartColors: [C.verde, C.objetivo], showValue: true, dataLabelPosition: 't', dataLabelFontSize: 8, dataLabelColor: C.texto, lineDataSymbol: 'circle', valAxisMinVal: 0, valAxisMaxVal: 1 }));
      }
    } else if (ind === 'hc') {
      cabecera(s, K, 'Headcount');
      const h = MDY.headcountResumen(estado, camp);
      kpi(s, 0.5, 'STAFF ACTUAL', h.operadores != null ? `${h.operadores} operadores` : 's/d');
      kpi(s, 3.38, 'CUMPLIMIENTO', h.cumpl != null ? U.pct(h.cumpl) : 's/d');
      lineaTiempo(s, h, mes);
    }

    const secciones = [{ etiqueta: 'ORIGEN', texto: t.origen, siempre: true }];
    if (ind === 'ret') secciones.push({ etiqueta: 'DETECCIÓN', texto: t.deteccion });
    secciones.push({ etiqueta: 'ACCIÓN', texto: t.accion, siempre: true }, { etiqueta: 'RESULTADO', texto: t.resultado, siempre: true });
    panel(s, secciones, 1.08, t.cierreTexto ? 6.1 : 6.95);
    if (notasActivas && COACH()) { const n = COACH().notasLamina(COACH().pitch(estado, camp, ind, mes, t)); if (n) s.addNotes(n); }
    cierre(s, t.cierreTipo, t.cierreTexto);
    pie(s, pieTxt);
  }

  const COLOR_EVENTO = {
    'Ingreso a capacitación': '2E86C1', 'Pase a producción (OJT)': C.verde, 'Cese / Retiro': C.rojoT,
    'Traslado entre campañas': C.ambarT, 'Cambio de turno': '7D3C98', 'Vacante abierta': '7F8C8D', 'Otro': C.gris,
  };
  function lineaTiempo(s, h, mes) {
    leyenda(s, 2.02, 'Línea de tiempo de headcount');
    const box = { x: 0.5, y: 2.3, w: 5.5, h: 3.82 };
    s.addShape('rect', { x: box.x, y: box.y, w: box.w, h: box.h, fill: { color: C.blanco }, line: { color: C.verde, width: 1.25 } });
    let yTop = box.y + 0.15;
    const turnos = (h.turnos || []).filter((t) => t.requerido);
    if (turnos.length) {
      const rows = [[
        { text: 'Turno', options: { bold: true, color: C.blanco, fill: { color: C.verde } } },
        { text: 'Requerido', options: { bold: true, color: C.blanco, fill: { color: C.verde }, align: 'center' } },
        { text: 'Actual', options: { bold: true, color: C.blanco, fill: { color: C.verde }, align: 'center' } },
        { text: 'Cobertura', options: { bold: true, color: C.blanco, fill: { color: C.verde }, align: 'center' } },
      ]];
      for (const t of turnos) {
        const cob = t.actual / t.requerido;
        const st = cob >= 1 ? SEMAF.VERDE : cob >= 0.85 ? SEMAF.AMBAR : SEMAF.ROJO;
        rows.push([{ text: t.turno }, { text: String(t.requerido), options: { align: 'center' } }, { text: String(t.actual), options: { align: 'center' } },
          { text: U.pct(cob, 0), options: { align: 'center', bold: true, color: st.t, fill: { color: st.f } } }]);
      }
      s.addTable(rows, { x: box.x + 0.15, y: yTop, w: box.w - 0.3, colW: [1.6, 1.2, 1.0, 1.4], rowH: 0.24, fontFace: FONT, fontSize: 8.5, color: C.texto, border: { type: 'solid', pt: 0.5, color: C.borde } });
      yTop += 0.24 * rows.length + 0.2;
    }
    const ev = [...(h.eventos || [])].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).slice(-8);
    if (!ev.length) {
      s.addText('Sin movimientos registrados.', { x: box.x + 0.2, y: yTop, w: box.w - 0.4, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: C.gris, isTextBox: true });
      return;
    }
    const yBot = box.y + box.h - 0.15;
    const paso = Math.min(0.48, (yBot - yTop) / ev.length);
    const xL = box.x + 1.05;
    s.addShape('line', { x: xL, y: yTop + 0.08, w: 0, h: paso * (ev.length - 1) + 0.02, line: { color: C.borde, width: 2 } });
    ev.forEach((e, i) => {
      const y = yTop + i * paso;
      const col = COLOR_EVENTO[e.tipo] || C.gris;
      s.addText(e.fecha ? U.ddmm(e.fecha) : '—', { x: box.x + 0.12, y: y - 0.02, w: 0.75, h: 0.22, fontFace: FONT, fontSize: 9, bold: true, color: C.texto, align: 'right', margin: 0, isTextBox: true });
      s.addShape('ellipse', { x: xL - 0.08, y: y + 0.02, w: 0.16, h: 0.16, fill: { color: e.estado === 'Cerrado' ? col : C.blanco }, line: { color: col, width: 1.5 } });
      const cant = e.cantidad ? `${e.cantidad > 0 && e.tipo !== 'Cese / Retiro' ? '+' : ''}${e.tipo === 'Cese / Retiro' ? '−' : ''}${Math.abs(e.cantidad)} ` : '';
      const det = [e.turno, e.modalidad].filter(Boolean).join(' · ');
      s.addText([
        { text: `${cant}${e.tipo}`, options: { bold: true, color: col } },
        { text: `${det ? '  ' + det : ''}${e.estado && e.estado !== 'Cerrado' ? '  (' + e.estado + ')' : ''}`, options: { color: C.gris } },
        ...(e.comentario ? [{ text: '\n' + e.comentario, options: { color: C.texto, fontSize: 8 } }] : []),
      ], { x: xL + 0.2, y: y - 0.03, w: box.x + box.w - xL - 0.3, h: paso, fontFace: FONT, fontSize: 9, valign: 'top', margin: 0, isTextBox: true });
    });
  }

  function laminaNSDiario(pptx, estado, mes, camp, pieTxt) {
    const dias = MDY.opsDiasMes(estado, camp, mes);
    if (!dias.length) return;
    const s = pptx.addSlide();
    cabecera(s, MDY.CAMPANAS[camp].kicker, 'Nivel de Servicio · Detalle diario');
    const obj = estado.config.objetivos;
    leyenda(s, 1.1, 'Evolutivo NS Diario (%)', 0.5, 8);
    graficoLinea(pptx, s, { x: 0.5, y: 1.38, w: 12.33, h: 2.55 }, dias.map((d) => `${d.fecha.slice(8)} ${MDY.DIAS[U.dow(d.fecha)]}`), dias.map((d) => d.ns), obj.ns, 'NS diario', '0%', { min: 0, max: 1 });
    leyenda(s, 4.08, 'Detalle por día', 0.5, 8);
    const n = dias.length;
    const colEt = 1.35;
    const colW = [colEt, ...dias.map(() => (12.33 - colEt) / n)];
    const head = [{ text: 'Día', options: { bold: true, color: C.blanco, fill: { color: C.verde } } },
      ...dias.map((d) => ({ text: `${d.fecha.slice(8)}\n${MDY.DIAS[U.dow(d.fecha)]}`, options: { bold: true, color: C.blanco, fill: { color: [0, 6].includes(U.dow(d.fecha)) ? '005A30' : C.verde }, align: 'center' } }))];
    const fila = (nombre, f, colorear) => [{ text: nombre, options: { bold: true } }, ...dias.map((d) => {
      const v = f(d); const st = colorear ? SEMAF[colorear(d)] : null;
      return { text: v, options: { align: 'center', fill: st ? { color: st.f } : undefined, color: st ? st.t : C.texto, bold: !!st } };
    })];
    const rows = [head,
      fila('NS', (d) => U.pct(d.ns, 0), (d) => MDY.semaforo('ns', d.ns, estado, camp)),
      fila('Abandono', (d) => U.pct(d.abandono, 0)),
      fila('Cumpl. RQ', (d) => U.pct(d.cumplRQ, 0), (d) => (d.cumplRQ >= 0.95 ? 'VERDE' : d.cumplRQ >= 0.85 ? 'AMBAR' : 'ROJO')),
      fila('Adh. franja', (d) => U.pct(d.adh, 0)),
      fila('TMG (s)', (d) => String(Math.round(d.tmg)), (d) => MDY.semaforo('tmg', d.tmg, estado, camp)),
      fila('Recibidas', (d) => String(d.rec)),
      fila('Var. tráfico', (d) => (d.varTraf == null ? 's/d' : (d.varTraf >= 0 ? '+' : '') + Math.round(d.varTraf * 100) + '%')),
    ];
    const fs = n > 20 ? 7 : n > 12 ? 8 : 9;
    s.addTable(rows, { x: 0.5, y: 4.36, w: 12.33, colW, rowH: 0.3, fontFace: FONT, fontSize: fs, color: C.texto, border: { type: 'solid', pt: 0.5, color: C.borde }, valign: 'middle', margin: 0.02 });
    pie(s, pieTxt);
  }

  function laminaCTDetalle(pptx, estado, mes, camp, pieTxt) {
    const a = MDY.ctMes(estado, camp, mes);
    if (!a) return;
    const s = pptx.addSlide();
    cabecera(s, MDY.CAMPANAS[camp].kicker, 'Oportunidades aprovechadas (CT) · Detalle');
    const ases = MDY.ctAsesores(estado, a, 5);
    leyenda(s, 1.1, 'Aprovechamiento por asesor (mín. 5 oportunidades)', 0.5, 6.5);
    const sel = ases.length > 16 ? [...ases.slice(0, 8), null, ...ases.slice(-8)] : ases;
    const med = MDY.mediana(ases.map((x) => x.pct));
    const h = (t, al = 'center') => ({ text: t, options: { bold: true, color: C.blanco, fill: { color: C.verde }, align: al } });
    const rows = [[h('#'), h('Asesor', 'left'), h('Generadas'), h('Aprovechadas'), h('%')]];
    sel.forEach((x) => {
      if (!x) { rows.push([{ text: '…', options: { colspan: 5, align: 'center', color: C.gris } }]); return; }
      const st = x.pct >= med ? SEMAF.VERDE : SEMAF.ROJO;
      rows.push([{ text: String(ases.indexOf(x) + 1), options: { align: 'center' } }, { text: x.nombre }, { text: String(x.g), options: { align: 'center' } }, { text: String(x.c), options: { align: 'center' } },
        { text: U.pct(x.pct, 0), options: { align: 'center', bold: true, color: st.t, fill: { color: st.f } } }]);
    });
    const rh = Math.min(0.28, 5.6 / rows.length);
    s.addTable(rows, { x: 0.5, y: 1.4, w: 6.4, colW: [0.4, 3.0, 1.0, 1.2, 0.8], rowH: rh, fontFace: FONT, fontSize: rows.length > 16 ? 8 : 9, color: C.texto, border: { type: 'solid', pt: 0.5, color: C.borde }, valign: 'middle', margin: 0.03 });

    const f = a.franjas;
    const fr = [['Mañana (<13h)', f.M], ['Tarde (13-18h)', f.T], ['Noche (>18h)', f.N]].filter((x) => x[1].g);
    leyenda(s, 1.1, 'Aprovechamiento por franja horaria', 7.3, 5.5);
    graficoBarras(pptx, s, { x: 7.3, y: 1.4, w: 5.53, h: 2.55 }, fr.map((x) => x[0]), [{ nombre: '% Aprovechamiento', valores: fr.map((x) => x[1].c / x[1].g) }], '0.0%', [C.verde], { valAxisMinVal: 0 });
    leyenda(s, 4.15, 'Motivos con más oportunidades desperdiciadas', 7.3, 5.5);
    const perd = Object.entries(a.perdidas).sort((x, y) => y[1] - x[1]).slice(0, 6);
    const tot = Object.values(a.perdidas).reduce((x, y) => x + y, 0);
    const r2 = [[h('Motivo (subclase)', 'left'), h('Casos'), h('% del total')]];
    perd.forEach(([k, v]) => r2.push([{ text: k.charAt(0) + k.slice(1).toLowerCase() }, { text: String(v), options: { align: 'center' } }, { text: U.pct(v / tot, 0), options: { align: 'center' } }]));
    s.addTable(r2, { x: 7.3, y: 4.45, w: 5.53, colW: [3.53, 0.9, 1.1], rowH: 0.27, fontFace: FONT, fontSize: 9, color: C.texto, border: { type: 'solid', pt: 0.5, color: C.borde }, valign: 'middle', margin: 0.03 });
    pie(s, pieTxt);
  }

  function laminaCompromisos(pptx, estado, pieTxt, proxCorte) {
    const lista = estado.manual.compromisos || [];
    if (!lista.length) return;
    const s = pptx.addSlide();
    cabecera(s, 'CIERRE', 'Compromisos y próximo corte');
    const h = (t) => ({ text: t, options: { bold: true, color: C.blanco, fill: { color: C.verde } } });
    const rows = [[h('Indicador'), h('Compromiso'), h('Responsable'), h('Fecha'), h('Estado')]];
    const colEst = { 'Cerrado': SEMAF.VERDE, 'En curso': SEMAF.AMBAR, 'Pendiente': SEMAF.ROJO };
    for (const c of lista.slice(0, 12)) {
      const st = colEst[c.estado];
      rows.push([{ text: c.indicador || '', options: { bold: true } }, { text: c.compromiso || '' }, { text: c.responsable || '', options: { color: C.gris } },
        { text: c.fecha ? (/^\d{4}-/.test(c.fecha) ? U.ddmm(c.fecha) : c.fecha) : 'Próx. corte', options: { bold: true, color: C.verde, align: 'center' } },
        { text: c.estado || '', options: { align: 'center', bold: true, color: st ? st.t : C.gris, fill: st ? { color: st.f } : undefined } }]);
    }
    s.addTable(rows, { x: 0.5, y: 1.15, w: 12.33, colW: [2.6, 5.2, 2.03, 1.1, 1.4], rowH: Math.min(0.45, 5.6 / rows.length), fontFace: FONT, fontSize: 9.5, color: C.texto, border: { type: 'solid', pt: 0.5, color: C.borde }, valign: 'middle' });
    pie(s, proxCorte ? `Próximo corte: ${proxCorte}` : pieTxt);
  }

  function laminaCaso(pptx, caso, pieTxt) {
    const s = pptx.addSlide();
    cabecera(s, 'CASO OPERATIVO', caso.titulo || 'Caso operativo');
    const bloques = [['QUÉ PASÓ', caso.que], ['CAUSA RAÍZ', caso.causa], ['ACCIÓN CORRECTIVA', caso.accion], ['ESTADO', caso.estado]].filter((b) => b[1]);
    let y = 1.3;
    const h = Math.min(1.35, 5.6 / Math.max(1, bloques.length));
    bloques.forEach(([et, tx], i) => {
      s.addText(et, { x: 0.5, y, w: 2.6, h: 0.35, fontFace: FONT, fontSize: 11, bold: true, color: C.verde, margin: 0, isTextBox: true });
      s.addText(tx, { x: 3.2, y, w: 9.63, h: h - 0.15, fontFace: FONT, fontSize: 13, color: C.texto, valign: 'top', margin: 0, isTextBox: true });
      y += h;
      if (i < bloques.length - 1) s.addShape('line', { x: 0.5, y: y - 0.1, w: 12.33, h: 0, line: { color: C.borde, width: 0.75 } });
    });
    pie(s, pieTxt);
  }

  /* ------------------------------ ensamblado ------------------------------ */
  function generar(PptxGenJS, estado, opciones) {
    const { mes, fechaCorte, assets = {}, proxCorte } = opciones;
    notasActivas = opciones.notas !== false;
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'MDY Customer Experience';
    pptx.title = `Presentación ${MDY.util.mesLargo(mes)}`;
    pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
    const pieTxt = `Actualizado al ${fechaCorte ? U.ddmmyyyy(fechaCorte) : ''}`;
    const sec = opciones.secciones || {};
    const on = (k) => sec[k] !== false;

    laminaPortada(pptx, assets);
    if (on('resumen')) laminaResumen(pptx, estado, mes, pieTxt);
    for (const camp of ['premium', 'fullclaro']) {
      if (!on(camp)) continue;
      laminaSeparador(pptx, assets, camp);
      for (const ind of MDY.INDICADORES) {
        if (ind.id === 'nsdiario') { if (MDY.textosLamina(estado, mes, camp, 'nsdiario').incluir) laminaNSDiario(pptx, estado, mes, camp, pieTxt); continue; }
        if (ind.id === 'ctdet') { if (MDY.textosLamina(estado, mes, camp, 'ctdet').incluir) laminaCTDetalle(pptx, estado, mes, camp, pieTxt); continue; }
        if (!tieneDatos(estado, mes, camp, ind.id)) continue;
        laminaIndicador(pptx, estado, mes, camp, ind.id, pieTxt);
      }
    }
    if (on('compromisos')) laminaCompromisos(pptx, estado, pieTxt, proxCorte);
    if (on('casos')) for (const c of (estado.manual.casos || []).filter((x) => x.incluir !== false)) laminaCaso(pptx, c, pieTxt);
    laminaCierreFinal(pptx, assets);
    return pptx;
  }

  function tieneDatos(estado, mes, camp, ind) {
    if (ind === 'ns' || ind === 'tmg') return !!MDY.opsMes(estado, camp, mes);
    if (ind === 'rell') return !!MDY.rellMes(estado, camp, mes);
    if (ind === 'ct') return !!MDY.ctMes(estado, camp, mes);
    if (ind === 'ret') return MDY.retencionSerie(estado, camp, mes, 6).length > 0;
    if (ind === 'hc') { const h = estado.manual.headcount[camp]; return h.operadores != null || (h.eventos || []).length > 0; }
    return false;
  }

  const api = { generar, tieneDatos, mejorasAuto, COLOR_EVENTO };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MDY_DECK = api;
})(typeof window !== 'undefined' ? window : globalThis);
