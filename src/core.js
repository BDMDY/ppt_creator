/* =====================================================================
 * MDY Presentaciones — núcleo: lectura de reportes, cálculos e insights
 * Funciona en el navegador (window.MDY) y en Node (module.exports).
 * ===================================================================== */
(function (root) {
  'use strict';

  const CAMPANAS = {
    premium: { id: 'premium', nombre: 'Premium', kicker: 'PREMIUM', separador: 'OPERACIONES\nPREMIUM' },
    fullclaro: { id: 'fullclaro', nombre: 'Full Claro', kicker: 'FULL CLARO BLACK', separador: 'OPERACIONES\nFULL CLARO' },
  };

  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sept', 'Oct', 'Nov', 'Dic'];
  const MESES_LARGO = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  const CONFIG_DEFECTO = {
    objetivos: {
      ns: 0.85,
      tmg: { premium: 648, fullclaro: 648 },
      rell: 0.20,
      ct: 0.30,
      ret: 0.85,
      adh: 0.93,
    },
    // Tolerancia para semáforo ÁMBAR (fuera del objetivo pero cerca)
    tolerancia: { ns: 0.05, tmg: 0.15, rell: 0.03, ct: 0.05, ret: 0.03 },
  };

  /* ------------------------------ utilidades ------------------------------ */
  const pad = (n) => String(n).padStart(2, '0');
  const mesKey = (y, m) => `${y}-${pad(m)}`;
  const mesLabel = (k) => { const [y, m] = k.split('-').map(Number); return `${MESES[m - 1]}-${String(y).slice(2)}`; };
  const mesLargo = (k) => { const [y, m] = k.split('-').map(Number); return `${MESES_LARGO[m - 1]} ${y}`; };
  const mesNombre = (k) => MESES_LARGO[Number(k.split('-')[1]) - 1];
  const mesAnterior = (k) => { let [y, m] = k.split('-').map(Number); m -= 1; if (m === 0) { m = 12; y -= 1; } return mesKey(y, m); };
  const fechaDia = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const dow = (iso) => fechaDia(iso).getUTCDay();
  const ddmm = (iso) => { const p = iso.split('-'); return `${p[2]}/${p[1]}`; };
  const ddmmyyyy = (iso) => { const p = iso.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
  const semanaDe = (iso) => Math.floor((Number(iso.split('-')[2]) - 1) / 7) + 1;
  const rangoSemana = (mes, s) => {
    const [y, m] = mes.split('-').map(Number);
    const fin = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${pad((s - 1) * 7 + 1)}-${pad(Math.min(s * 7, fin))}`;
  };
  const rangoReal = (fs) => { const o = [...fs].sort(); const a = o[0].slice(8), b = o[o.length - 1].slice(8); return a === b ? a : `${a}-${b}`; };
  const pct = (v, d = 1) => (v == null || isNaN(v) ? 's/d' : (v * 100).toFixed(d) + '%');
  const pp = (v, d = 1) => (v == null || isNaN(v) ? 's/d' : (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d) + ' pp');
  const seg = (v) => (v == null || isNaN(v) ? 's/d' : Math.round(v).toLocaleString('es-PE') + ' s');
  const num = (v, d = 0) => (v == null || isNaN(v) ? 's/d' : Number(v).toLocaleString('es-PE', { maximumFractionDigits: d, minimumFractionDigits: d }));
  const signo = (v, d = 0, suf = '') => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + suf;
  const div = (a, b) => (b ? a / b : null);
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

  function serialAISO(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'number') {
      const ms = Math.round((v - 25569) * 86400000);
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    }
    if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`;
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
    return null;
  }
  function serialHora(v) {
    if (typeof v === 'number') return Math.floor(((v % 1) * 24) + 1e-6);
    const m = String(v || '').match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) : null;
  }

  function campanaDesdeTexto(t) {
    const n = norm(t);
    if (n.includes('PREMIUM')) return 'premium';
    if (n.includes('FULL CLARO')) return 'fullclaro';
    return null;
  }

  /* ------------------------------ lectores ------------------------------ */
  // filas: matriz (array de arrays) de la primera hoja
  function leerFiltros(filas) {
    for (const f of filas) for (const c of f || []) {
      if (typeof c === 'string' && c.includes('Filtros aplicados')) {
        const campM = c.match(/SUB_CAMPA(?:Ñ|N)(?:IA|A2?)\s+es\s+([^\n]+)/i);
        const perM = c.match(/PERIODO\s+es\s+(\d{6})/i);
        return {
          texto: c,
          campana: campM ? campanaDesdeTexto(campM[1]) : null,
          periodo: perM ? `${perM[1].slice(0, 4)}-${perM[1].slice(4)}` : null,
        };
      }
    }
    return { texto: '', campana: null, periodo: null };
  }

  const COLS_OPS = {
    rec: ['Trans. Recibidas'], dimTraf: ['Trafico_Dim'], hrs: ['Hrs_Reales'], hrsDim: ['Horas_Dim'],
    tmg: ['TMG Real'], tmgDim: ['TMG Dim', 'Dim TMG'], umbral: ['Trans. Atend. Umbral'],
    aband: ['Trans. Aband.'], intAprob: ['Intervalos_Aprob'], intVal: ['Val_Intervalo'],
  };

  function indiceCols(header, mapa) {
    const idx = {};
    const H = header.map((h) => norm(h));
    for (const [k, nombres] of Object.entries(mapa)) {
      idx[k] = -1;
      for (const n of nombres) { const i = H.indexOf(norm(n)); if (i >= 0) { idx[k] = i; break; } }
    }
    return idx;
  }

  function filaOps(r, idx) {
    const o = {};
    for (const k of Object.keys(COLS_OPS)) o[k] = idx[k] >= 0 ? Number(r[idx[k]]) || 0 : 0;
    return o;
  }

  /**
   * Detecta el tipo de reporte y lo convierte a una estructura normalizada.
   * libro: { hojas: { nombre: matriz } , nombreArchivo }
   */
  function interpretarLibro(libro) {
    const nombres = Object.keys(libro.hojas);
    // ---- Oportunidades (CT): hoja BASE con detalle
    const hojaBase = nombres.find((n) => norm(n) === 'BASE');
    if (hojaBase) {
      const filas = libro.hojas[hojaBase];
      const h = (filas[0] || []).map(norm);
      if (h.includes('ASESOR') && h.includes('OPORTUNIDAD')) return leerCT(filas);
    }
    const filas = libro.hojas[nombres[0]] || [];
    const header = (filas[0] || []).map((x) => String(x == null ? '' : x).trim());
    const H = header.map(norm);
    const filtros = leerFiltros(filas);

    if (H[0] === 'PERIODO' && H.includes('NS')) return leerOps(filas, header, filtros, 'mensual');
    if (H[0] === 'FECHA' && H.includes('NS')) return leerOps(filas, header, filtros, 'diario');
    if (H[0].startsWith('FECHA - DIA') && H.includes('RELLAMADAS')) return leerRellamada(filas, header, filtros);
    return { tipo: 'desconocido', error: 'No reconozco el formato de este archivo.' };
  }

  function leerOps(filas, header, filtros, nivel) {
    const idx = indiceCols(header, COLS_OPS);
    const campana = filtros.campana;
    if (!campana) return { tipo: 'desconocido', error: 'No encontré la campaña en "Filtros aplicados".' };
    const registros = {};
    for (let i = 1; i < filas.length; i++) {
      const r = filas[i];
      if (!r || r[0] == null) continue;
      if (norm(r[0]) === 'TOTAL' || norm(r[0]) === 'PERIODO' || norm(r[0]) === 'FECHA') continue;
      let clave;
      if (nivel === 'mensual') {
        const p = String(r[0]).trim();
        if (!/^\d{6}$/.test(p)) continue;
        clave = `${p.slice(0, 4)}-${p.slice(4)}`;
      } else {
        clave = serialAISO(r[0]);
        if (!clave) continue;
      }
      registros[clave] = filaOps(r, idx);
    }
    const claves = Object.keys(registros).sort();
    return {
      tipo: nivel === 'mensual' ? 'ops_mensual' : 'ops_diario', campana, registros,
      resumen: `${CAMPANAS[campana].nombre} · ${nivel === 'mensual' ? 'Operación mensual' : 'Operación diaria'} · ${claves.length ? (nivel === 'mensual' ? mesLabel(claves[0]) + ' a ' + mesLabel(claves[claves.length - 1]) : ddmm(claves[0]) + ' a ' + ddmm(claves[claves.length - 1])) : 'sin filas'}`,
    };
  }

  function leerRellamada(filas, header, filtros) {
    const H = header.map(norm);
    const iR = H.indexOf('RELLAMADAS');
    const iA = H.findIndex((h) => h.startsWith('LLAMADAS ATENDIDAS'));
    if (!filtros.campana || !filtros.periodo) return { tipo: 'desconocido', error: 'No encontré campaña o periodo en "Filtros aplicados".' };
    const dias = {};
    for (let i = 1; i < filas.length; i++) {
      const r = filas[i];
      if (!r || typeof r[0] !== 'number' || r[0] < 1 || r[0] > 31) continue;
      dias[`${filtros.periodo}-${pad(r[0])}`] = { rell: Number(r[iR]) || 0, aten: Number(r[iA]) || 0 };
    }
    const n = Object.keys(dias).length;
    return {
      tipo: 'rellamada', campana: filtros.campana, mes: filtros.periodo, dias,
      resumen: `${CAMPANAS[filtros.campana].nombre} · Rellamadas · ${mesLargo(filtros.periodo)} (${n} días)`,
    };
  }

  function nuevoAggCT() {
    return { dias: {}, asesores: {}, franjas: { M: { g: 0, c: 0 }, T: { g: 0, c: 0 }, N: { g: 0, c: 0 } }, perdidas: {}, g: 0, c: 0 };
  }
  function leerCT(filas) {
    const H = filas[0].map(norm);
    const col = (n) => H.indexOf(norm(n));
    const iA = col('asesor'), iD = col('dia_registro'), iC = col('campana_fija'), iO = col('oportunidad'),
      iS = col('subclase'), iF = col('fecha_hora'), iCargo = col('cargo');
    const agg = {}; // campana -> mes -> agg
    let total = 0;
    for (let i = 1; i < filas.length; i++) {
      const r = filas[i];
      if (!r || !r[iA]) continue;
      const camp = campanaDesdeTexto(r[iC]) || campanaDesdeTexto(r[iCargo]);
      const dia = serialAISO(r[iD]);
      if (!camp || !dia) continue;
      const mes = dia.slice(0, 7);
      agg[camp] = agg[camp] || {};
      const a = (agg[camp][mes] = agg[camp][mes] || nuevoAggCT());
      const ok = norm(r[iO]).includes('CUMPLIDA') ? 1 : 0;
      total++;
      a.g++; a.c += ok;
      // detalle por día (permite recortar a una fecha de corte)
      const dd = (a.dias[dia] = a.dias[dia] || { g: 0, c: 0, as: {}, fr: {}, pe: {} });
      dd.g++; dd.c += ok;
      const as = String(r[iA]).trim();
      (a.asesores[as] = a.asesores[as] || { g: 0, c: 0 }); a.asesores[as].g++; a.asesores[as].c += ok;
      (dd.as[as] = dd.as[as] || [0, 0]); dd.as[as][0]++; dd.as[as][1] += ok;
      const h = serialHora(r[iF]);
      if (h != null) {
        const f = h < 13 ? 'M' : h < 18 ? 'T' : 'N';
        a.franjas[f].g++; a.franjas[f].c += ok;
        (dd.fr[f] = dd.fr[f] || [0, 0]); dd.fr[f][0]++; dd.fr[f][1] += ok;
      }
      if (!ok) {
        const s = String(r[iS] || 'SIN SUBCLASE').trim();
        a.perdidas[s] = (a.perdidas[s] || 0) + 1; dd.pe[s] = (dd.pe[s] || 0) + 1;
      }
    }
    const partes = [];
    for (const c of Object.keys(agg)) for (const m of Object.keys(agg[c])) partes.push(`${CAMPANAS[c].nombre} ${mesLabel(m)}`);
    return { tipo: 'ct', agg, resumen: `Oportunidades (CT) · ${total.toLocaleString('es-PE')} registros · ${partes.join(', ')}` };
  }

  /* ------------------------------ almacén ------------------------------ */
  function estadoVacio() {
    return {
      version: 1,
      config: JSON.parse(JSON.stringify(CONFIG_DEFECTO)),
      datos: {
        premium: { mensual: {}, diario: {}, rell: {}, ct: {} },
        fullclaro: { mensual: {}, diario: {}, rell: {}, ct: {} },
      },
      cargas: [],
      manual: {
        headcount: {
          premium: { operadores: null, ftes: null, dimensionado: null, turnos: [], eventos: [] },
          fullclaro: { operadores: null, ftes: null, dimensionado: null, turnos: [], eventos: [] },
        },
        retencion: { premium: {}, fullclaro: {} }, // mes -> { ret, canc, obs }
        asesores: {}, // código -> nombre
        compromisos: [],
        casos: [],
        textos: {}, // mes -> claveLamina -> { origen, accion, resultado, deteccion, cierreTipo, cierreTexto, semaforo }
        resumen: {}, // mes -> { mejoro }
      },
      corte: { mes: null, fecha: null },
    };
  }

  function incorporar(estado, r, nombreArchivo) {
    const d = estado.datos;
    if (r.tipo === 'ops_mensual') Object.assign(d[r.campana].mensual, r.registros);
    else if (r.tipo === 'ops_diario') Object.assign(d[r.campana].diario, r.registros);
    else if (r.tipo === 'rellamada') {
      // reemplaza el mes completo
      for (const k of Object.keys(d[r.campana].rell)) if (k.startsWith(r.mes)) delete d[r.campana].rell[k];
      Object.assign(d[r.campana].rell, r.dias);
    } else if (r.tipo === 'ct') {
      for (const c of Object.keys(r.agg)) for (const m of Object.keys(r.agg[c])) d[c].ct[m] = r.agg[c][m];
    } else return false;
    estado.cargas.unshift({ archivo: nombreArchivo, tipo: r.tipo, resumen: r.resumen, fecha: new Date().toISOString() });
    estado.cargas = estado.cargas.slice(0, 40);
    return true;
  }

  function mesesDisponibles(estado) {
    const s = new Set();
    for (const c of Object.keys(CAMPANAS)) {
      const d = estado.datos[c];
      Object.keys(d.mensual).forEach((k) => s.add(k));
      Object.keys(d.diario).forEach((k) => s.add(k.slice(0, 7)));
      Object.keys(d.rell).forEach((k) => s.add(k.slice(0, 7)));
      Object.keys(d.ct).forEach((k) => s.add(k));
    }
    return [...s].sort();
  }

  function ultimaFechaDatos(estado, mes) {
    let max = null;
    for (const c of Object.keys(CAMPANAS)) {
      const d = estado.datos[c];
      for (const k of [...Object.keys(d.diario), ...Object.keys(d.rell)]) if (k.startsWith(mes) && (!max || k > max)) max = k;
      for (const m of Object.keys(d.ct)) if (m === mes) for (const k of Object.keys(d.ct[m].dias)) if (!max || k > max) max = k;
    }
    return max;
  }

  /**
   * Devuelve una vista del estado con la información HASTA la fecha de corte (inclusive).
   * - Diario, rellamadas y CT: se descartan los días posteriores.
   * - Mes del corte: si hay detalle diario, el mes se recalcula con los días ≤ corte.
   * - Meses posteriores, retención de meses posteriores y movimientos de headcount futuros: se descartan.
   * Los textos/registros manuales se comparten (no se copian) para que las ediciones se guarden.
   */
  function recortar(estado, fechaCorte) {
    if (!fechaCorte) return estado;
    const mesCorte = fechaCorte.slice(0, 7);
    const datos = {};
    const avisos = [];
    for (const c of Object.keys(CAMPANAS)) {
      const d = estado.datos[c];
      const diario = {}, rell = {}, mensual = {}, ct = {};
      for (const [k, v] of Object.entries(d.diario)) if (k <= fechaCorte) diario[k] = v;
      for (const [k, v] of Object.entries(d.rell)) if (k <= fechaCorte) rell[k] = v;
      const hayDiarioMesCorte = Object.keys(diario).some((k) => k.startsWith(mesCorte));
      for (const [k, v] of Object.entries(d.mensual)) {
        if (k < mesCorte) mensual[k] = v;
        else if (k === mesCorte && !hayDiarioMesCorte) {
          mensual[k] = v;
          if (Object.keys(d.diario).length) avisos.push(`${CAMPANAS[c].nombre}: no hay reporte diario de ${mesLargo(mesCorte)}; se usa el acumulado mensual completo.`);
        }
      }
      for (const [m, a] of Object.entries(d.ct)) {
        if (m < mesCorte) { ct[m] = a; continue; }
        if (m > mesCorte) continue;
        const dias = Object.keys(a.dias).filter((k) => k <= fechaCorte);
        if (!dias.length) continue;
        if (!a.dias[dias[0]].as) { ct[m] = a; avisos.push(`${CAMPANAS[c].nombre}: vuelve a cargar el reporte de oportunidades de ${mesLargo(m)} para poder recortarlo por fecha.`); continue; }
        const n = nuevoAggCT();
        for (const k of dias) {
          const x = a.dias[k];
          n.dias[k] = x; n.g += x.g; n.c += x.c;
          for (const [as, [g, cc]] of Object.entries(x.as)) { (n.asesores[as] = n.asesores[as] || { g: 0, c: 0 }); n.asesores[as].g += g; n.asesores[as].c += cc; }
          for (const [f, [g, cc]] of Object.entries(x.fr)) { n.franjas[f].g += g; n.franjas[f].c += cc; }
          for (const [s, v] of Object.entries(x.pe)) n.perdidas[s] = (n.perdidas[s] || 0) + v;
        }
        ct[m] = n;
      }
      datos[c] = { mensual, diario, rell, ct };
    }
    const manual = Object.assign({}, estado.manual, {
      retencion: Object.fromEntries(Object.entries(estado.manual.retencion).map(([c, r]) => [c, Object.fromEntries(Object.entries(r || {}).filter(([m]) => m <= mesCorte))])),
      headcount: Object.fromEntries(Object.entries(estado.manual.headcount).map(([c, h]) => [c, Object.assign({}, h, { eventos: (h.eventos || []).filter((e) => !e.fecha || e.fecha <= fechaCorte) })])),
    });
    return Object.assign({}, estado, { datos, manual, avisosCorte: [...new Set(avisos)] });
  }

  /* ------------------------------ agregaciones ------------------------------ */
  function sumarOps(lista) {
    const t = { rec: 0, dimTraf: 0, hrs: 0, hrsDim: 0, umbral: 0, aband: 0, intAprob: 0, intVal: 0, tmgPeso: 0, tmgDimPeso: 0, aten: 0, dias: lista.length };
    for (const o of lista) {
      const aten = Math.max(o.rec - o.aband, 0);
      t.rec += o.rec; t.dimTraf += o.dimTraf; t.hrs += o.hrs; t.hrsDim += o.hrsDim; t.umbral += o.umbral;
      t.aband += o.aband; t.intAprob += o.intAprob; t.intVal += o.intVal;
      t.tmgPeso += o.tmg * aten; t.tmgDimPeso += o.tmgDim * aten; t.aten += aten;
    }
    return metricasOps(t);
  }
  function metricasOps(t) {
    return {
      rec: t.rec, dimTraf: t.dimTraf, hrs: t.hrs, hrsDim: t.hrsDim, umbral: t.umbral, aband: t.aband, dias: t.dias,
      ns: div(t.umbral, t.rec), abandono: div(t.aband, t.rec), varTraf: t.dimTraf ? t.rec / t.dimTraf - 1 : null,
      cumplRQ: div(t.hrs, t.hrsDim), adh: div(t.intAprob, t.intVal),
      tmg: t.tmg != null ? t.tmg : div(t.tmgPeso, t.aten), tmgDim: t.tmgDim != null ? t.tmgDim : div(t.tmgDimPeso, t.aten),
    };
  }
  function opsMes(estado, camp, mes) {
    const d = estado.datos[camp];
    const m = d.mensual[mes];
    if (m) {
      return metricasOps({ ...m, tmg: m.tmg, tmgDim: m.tmgDim, dias: null });
    }
    const dias = Object.keys(d.diario).filter((k) => k.startsWith(mes)).map((k) => d.diario[k]);
    return dias.length ? sumarOps(dias) : null;
  }
  function opsDiasMes(estado, camp, mes) {
    const d = estado.datos[camp].diario;
    return Object.keys(d).filter((k) => k.startsWith(mes)).sort().map((k) => ({ fecha: k, ...sumarOps([d[k]]), dias: 1 }));
  }
  function opsSemanas(estado, camp, mes) {
    const d = estado.datos[camp].diario;
    const grupos = {};
    for (const k of Object.keys(d)) if (k.startsWith(mes)) (grupos[semanaDe(k)] = grupos[semanaDe(k)] || []).push(d[k]);
    const fechas = {};
    for (const k of Object.keys(d)) if (k.startsWith(mes)) (fechas[semanaDe(k)] = fechas[semanaDe(k)] || []).push(k);
    return Object.keys(grupos).map(Number).sort((a, b) => a - b).map((s) => ({ semana: s, etiqueta: `Sem ${s}`, rango: rangoReal(fechas[s]), ...sumarOps(grupos[s]) }));
  }
  function serieMensual(estado, camp, mesFin, n = 6) {
    const out = [];
    let m = mesFin;
    for (let i = 0; i < n; i++) { const o = opsMes(estado, camp, m); if (o) out.unshift({ mes: m, ...o }); m = mesAnterior(m); }
    return out;
  }

  function rellMes(estado, camp, mes) {
    const d = estado.datos[camp].rell;
    let r = 0, a = 0, n = 0;
    for (const k of Object.keys(d)) if (k.startsWith(mes)) { r += d[k].rell; a += d[k].aten; n++; }
    return n ? { rell: r, aten: a, pct: div(r, a), dias: n } : null;
  }
  function rellDias(estado, camp, mes) {
    const d = estado.datos[camp].rell;
    return Object.keys(d).filter((k) => k.startsWith(mes)).sort().map((k) => ({ fecha: k, ...d[k], pct: div(d[k].rell, d[k].aten) }));
  }
  function rellSemanas(estado, camp, mes) {
    const g = {};
    for (const x of rellDias(estado, camp, mes)) { const s = semanaDe(x.fecha); g[s] = g[s] || { rell: 0, aten: 0 }; g[s].rell += x.rell; g[s].aten += x.aten; }
    const f = {};
    for (const x of rellDias(estado, camp, mes)) (f[semanaDe(x.fecha)] = f[semanaDe(x.fecha)] || []).push(x.fecha);
    return Object.keys(g).map(Number).sort((a, b) => a - b).map((s) => ({ semana: s, etiqueta: `Sem ${s}`, rango: rangoReal(f[s]), ...g[s], pct: div(g[s].rell, g[s].aten) }));
  }
  function rellSerieMensual(estado, camp, mesFin, n = 6) {
    const out = []; let m = mesFin;
    for (let i = 0; i < n; i++) { const r = rellMes(estado, camp, m); if (r) out.unshift({ mes: m, ...r }); m = mesAnterior(m); }
    return out;
  }

  function ctMes(estado, camp, mes) { return estado.datos[camp].ct[mes] || null; }
  function ctSemanas(a, mes) {
    const g = {};
    const f = {};
    for (const [k, v] of Object.entries(a.dias)) { const s = semanaDe(k); g[s] = g[s] || { g: 0, c: 0 }; g[s].g += v.g; g[s].c += v.c; (f[s] = f[s] || []).push(k); }
    return Object.keys(g).map(Number).sort((x, y) => x - y).map((s) => ({ semana: s, etiqueta: `Sem ${s}`, rango: rangoReal(f[s]), ...g[s], pct: div(g[s].c, g[s].g) }));
  }
  function ctSerieMensual(estado, camp, mesFin, n = 6) {
    const out = []; let m = mesFin;
    for (let i = 0; i < n; i++) { const a = ctMes(estado, camp, m); if (a) out.unshift({ mes: m, g: a.g, c: a.c, pct: div(a.c, a.g), porDia: a.c / Object.keys(a.dias).length }); m = mesAnterior(m); }
    return out;
  }
  function ctAsesores(estado, a, minimo = 10) {
    const nombres = estado.manual.asesores || {};
    return Object.entries(a.asesores).filter(([, v]) => v.g >= minimo)
      .map(([cod, v]) => ({ codigo: cod, nombre: nombres[cod] || cod, ...v, pct: v.c / v.g }))
      .sort((x, y) => y.pct - x.pct || y.c - x.c);
  }
  const mediana = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

  /* ------------------------------ semáforo ------------------------------ */
  function semaforo(tipo, valor, estado, camp) {
    if (valor == null) return null;
    const o = estado.config.objetivos, t = estado.config.tolerancia;
    if (tipo === 'ns') return valor >= o.ns ? 'VERDE' : valor >= o.ns - t.ns ? 'AMBAR' : 'ROJO';
    if (tipo === 'tmg') { const obj = o.tmg[camp]; return valor <= obj ? 'VERDE' : valor <= obj * (1 + t.tmg) ? 'AMBAR' : 'ROJO'; }
    if (tipo === 'rell') return valor <= o.rell ? 'VERDE' : valor <= o.rell + t.rell ? 'AMBAR' : 'ROJO';
    if (tipo === 'ct') return valor >= o.ct ? 'VERDE' : valor >= o.ct - t.ct ? 'AMBAR' : 'ROJO';
    if (tipo === 'ret') return valor >= o.ret ? 'VERDE' : valor >= o.ret - t.ret ? 'AMBAR' : 'ROJO';
    return null;
  }

  /* ------------------------------ insights ------------------------------ */
  function tendencia(vals) {
    // cuenta subidas/bajadas consecutivas al final de la serie
    let n = 0, dir = 0;
    for (let i = vals.length - 1; i > 0; i--) {
      const d = Math.sign(vals[i] - vals[i - 1]);
      if (d === 0) break;
      if (dir === 0) dir = d;
      if (d !== dir) break;
      n++;
    }
    return { n, dir };
  }

  function insightsNS(estado, camp, mes) {
    const obj = estado.config.objetivos.ns;
    const m = opsMes(estado, camp, mes);
    const prev = opsMes(estado, camp, mesAnterior(mes));
    const dias = opsDiasMes(estado, camp, mes);
    const sem = opsSemanas(estado, camp, mes);
    const origen = [], resultado = [];
    if (!m) return { origen, resultado, sinDatos: true };
    origen.push(`NS de ${pct(m.ns)} vs objetivo ${pct(obj, 0)} (desviación ${pp(m.ns - obj)}).`);
    const sobreDim = m.varTraf != null && m.varTraf <= -0.2;
    if (sobreDim) {
      origen.push(`Tráfico real ${pct(-m.varTraf, 0)} por debajo de lo dimensionado: el requerimiento de horas está sobreestimado (cumplimiento RQ de ${pct(m.cumplRQ)} y adherencia no son comparables). Revisar proyección.`);
    } else {
      if (m.cumplRQ != null && m.cumplRQ < 0.95 && m.hrsDim) {
        const def = m.hrsDim - m.hrs;
        const nd = dias.length || 30;
        origen.push(`Cumplimiento de horas requeridas de ${pct(m.cumplRQ)}: déficit de ${num(def)} h (≈ ${num(def / nd / 8, 1)} agentes de 8 h por día).`);
      }
      if (m.varTraf != null && m.varTraf >= 0.1) origen.push(`Tráfico ${pct(m.varTraf, 0)} por encima de lo dimensionado.`);
    }
    if (m.adh != null && !sobreDim) origen.push(`Adherencia por franja de ${pct(m.adh)} (objetivo ≥ ${pct(estado.config.objetivos.adh, 0)}).`);
    if (dias.length >= 4) {
      const fds = dias.filter((d) => [0, 6].includes(dow(d.fecha)));
      const lv = dias.filter((d) => ![0, 6].includes(dow(d.fecha)));
      if (fds.length && lv.length) {
        const nf = sumarOps(fds.map((d) => estado.datos[camp].diario[d.fecha])).ns;
        const nl = sumarOps(lv.map((d) => estado.datos[camp].diario[d.fecha])).ns;
        if (nl - nf >= 0.05) origen.push(`Fines de semana con NS de ${pct(nf)} vs ${pct(nl)} de lunes a viernes.`);
      }
      const criticos = dias.filter((d) => d.ns < obj).sort((a, b) => a.ns - b.ns).slice(0, 2);
      for (const c of criticos) if (c.ns < obj - 0.15) origen.push(`Día crítico ${DIAS[dow(c.fecha)]} ${ddmm(c.fecha)}: NS ${pct(c.ns)} con ${pct(c.cumplRQ, 0)} de horas cubiertas y ${pct(c.abandono)} de abandono.`);
    }
    if (prev) resultado.push(`${m.ns >= prev.ns ? 'Incremento' : 'Reducción'} de ${Math.abs((m.ns - prev.ns) * 100).toFixed(1)} pp respecto a ${mesNombre(mesAnterior(mes)).toLowerCase()} (${pct(prev.ns)} → ${pct(m.ns)}).`);
    if (sem.length >= 2) {
      const a = sem[sem.length - 1], b = sem[sem.length - 2];
      resultado.push(`${a.etiqueta} (${a.rango}): NS ${pct(a.ns)}, ${pp(a.ns - b.ns)} vs ${b.etiqueta}.`);
      const t = tendencia(sem.map((s) => s.ns));
      if (t.n >= 2) resultado.push(`${t.n + 1} semanas consecutivas ${t.dir > 0 ? 'al alza' : 'a la baja'}.`);
    }
    if (dias.length >= 4) {
      const mejor = [...dias].sort((a, b) => b.ns - a.ns)[0];
      if (m.ns < obj && mejor.ns >= obj && mejor.cumplRQ >= 0.9) resultado.push(`Cuando hay cobertura sí se cumple: ${DIAS[dow(mejor.fecha)]} ${ddmm(mejor.fecha)} con NS ${pct(mejor.ns)} y ${pct(mejor.cumplRQ, 0)} de horas cubiertas.`);
      const sobre = dias.filter((d) => d.ns >= obj).length;
      resultado.push(`${sobre} de ${dias.length} días sobre el objetivo.`);
    }
    return { origen, resultado };
  }

  function insightsTMG(estado, camp, mes) {
    const obj = estado.config.objetivos.tmg[camp];
    const m = opsMes(estado, camp, mes);
    const prev = opsMes(estado, camp, mesAnterior(mes));
    const sem = opsSemanas(estado, camp, mes);
    const dias = opsDiasMes(estado, camp, mes);
    const serie = serieMensual(estado, camp, mes, 12);
    const origen = [], resultado = [];
    if (!m) return { origen, resultado, sinDatos: true };
    origen.push(`TMG de ${seg(m.tmg)} vs objetivo ${seg(obj)} (desviación ${signo((m.tmg / obj - 1) * 100, 1, '%')}).`);
    if (serie.length >= 3) {
      const peor = [...serie].sort((a, b) => b.tmg - a.tmg)[0];
      const mejor = [...serie].sort((a, b) => a.tmg - b.tmg)[0];
      if (mejor.mes === mes) origen.push(`Mejor TMG de los últimos ${serie.length} meses.`);
      else if (peor.mes !== mes) origen.push(`Pico más alto del periodo: ${seg(peor.tmg)} en ${mesLabel(peor.mes)}.`);
    }
    if (dias.length >= 4) {
      const alto = dias.filter((d) => d.tmg > obj * 1.4).map((d) => `${ddmm(d.fecha)} (${seg(d.tmg)})`);
      if (alto.length > 4) origen.push(`${alto.length} de ${dias.length} días con desviación > 40%.`);
      else if (alto.length) origen.push(`Días con desviación > 40%: ${alto.join(', ')}.`);
    }
    if (prev) resultado.push(`${m.tmg <= prev.tmg ? 'Reducción' : 'Incremento'} de ${Math.round(Math.abs(m.tmg - prev.tmg))} s respecto a ${mesNombre(mesAnterior(mes)).toLowerCase()} (${seg(prev.tmg)} → ${seg(m.tmg)}).`);
    if (prev) resultado.push(`Desviación ${signo((prev.tmg / obj - 1) * 100, 1, '%')} → ${signo((m.tmg / obj - 1) * 100, 1, '%')} (${signo(((m.tmg - prev.tmg) / obj) * 100, 1, ' pp')}).`);
    if (sem.length >= 2) {
      const a = sem[sem.length - 1], b = sem[sem.length - 2];
      resultado.push(`${a.etiqueta} (${a.rango}): ${seg(a.tmg)}, ${signo(a.tmg - b.tmg, 0, ' s')} vs ${b.etiqueta}.`);
      const t = tendencia(sem.map((s) => s.tmg));
      if (t.n >= 2) resultado.push(`${t.n + 1} semanas consecutivas ${t.dir < 0 ? 'reduciendo' : 'aumentando'} el TMG.`);
    }
    return { origen, resultado };
  }

  function insightsRell(estado, camp, mes) {
    const obj = estado.config.objetivos.rell;
    const r = rellMes(estado, camp, mes);
    const prev = rellMes(estado, camp, mesAnterior(mes));
    const sem = rellSemanas(estado, camp, mes);
    const dias = rellDias(estado, camp, mes);
    const origen = [], resultado = [];
    if (!r) return { origen, resultado, sinDatos: true };
    origen.push(`% Rellamada de ${pct(r.pct)} vs objetivo ≤ ${pct(obj, 0)} (${num(r.rell)} rellamadas sobre ${num(r.aten)} atendidas).`);
    if (dias.length >= 5) {
      const media = r.pct;
      const atip = dias.filter((d) => d.pct > media + 0.08).sort((a, b) => b.pct - a.pct).slice(0, 3);
      for (const d of atip) {
        const op = estado.datos[camp].diario[d.fecha];
        const nsd = op ? sumarOps([op]).ns : null;
        let t = `Pico ${DIAS[dow(d.fecha)]} ${ddmm(d.fecha)}: ${pct(d.pct)}`;
        if (nsd != null && nsd < estado.config.objetivos.ns - 0.15) t += ` — coincide con NS de ${pct(nsd)} (posibles rellamadas por abandono)`;
        origen.push(t + '.');
      }
      const dom = dias.filter((d) => dow(d.fecha) === 0);
      if (dom.length) {
        const pd = div(dom.reduce((s, d) => s + d.rell, 0), dom.reduce((s, d) => s + d.aten, 0));
        if (pd - r.pct >= 0.03) origen.push(`Domingos con ${pct(pd)} de rellamada vs ${pct(r.pct)} del mes.`);
      }
    }
    if (prev) resultado.push(`${r.pct <= prev.pct ? 'Reducción' : 'Incremento'} de ${Math.abs((r.pct - prev.pct) * 100).toFixed(1)} pp vs ${mesNombre(mesAnterior(mes)).toLowerCase()} (${pct(prev.pct)} → ${pct(r.pct)}).`);
    if (sem.length >= 2) {
      const ok = sem.filter((s) => s.pct <= obj);
      const ult = sem.slice(-2);
      if (ult.every((s) => s.pct <= obj) && sem.length > 2 && !sem.every((s) => s.pct <= obj)) resultado.push(`Las últimas ${ult.length} semanas ya cumplen el objetivo (${ult.map((s) => `${s.etiqueta}: ${pct(s.pct)}`).join(' · ')}).`);
      else resultado.push(`${ok.length} de ${sem.length} semanas dentro del objetivo; ${sem[sem.length - 1].etiqueta}: ${pct(sem[sem.length - 1].pct)}.`);
      const t = tendencia(sem.map((s) => s.pct));
      if (t.n >= 2) resultado.push(`${t.n + 1} semanas consecutivas ${t.dir < 0 ? 'a la baja' : 'al alza'}.`);
    }
    return { origen, resultado };
  }

  function insightsCT(estado, camp, mes) {
    const a = ctMes(estado, camp, mes);
    const prevA = ctMes(estado, camp, mesAnterior(mes));
    const origen = [], resultado = [];
    if (!a) return { origen, resultado, sinDatos: true };
    const nd = Object.keys(a.dias).length;
    origen.push(`Aprovechamiento de ${pct(a.c / a.g)} (${num(a.c)} / ${num(a.g)} oportunidades), promedio de ${num(a.c / nd, 1)} CT diarios.`);
    const f = a.franjas;
    const fp = (x) => (x.g ? x.c / x.g : null);
    if (f.M.g && (f.T.g || f.N.g)) {
      const peor = [['tarde', fp(f.T)], ['noche', fp(f.N)]].filter((x) => x[1] != null).sort((x, y) => x[1] - y[1])[0];
      if (peor && fp(f.M) - peor[1] >= 0.05) origen.push(`Turno ${peor[0]} aprovecha ${pct(peor[1])} vs ${pct(fp(f.M))} en la mañana.`);
    }
    const perd = Object.entries(a.perdidas).sort((x, y) => y[1] - x[1]).slice(0, 3);
    if (perd.length) origen.push(`Principales motivos desperdiciados: ${perd.map(([k, v]) => `${k.toLowerCase()} (${v})`).join(', ')}.`);
    const ases = ctAsesores(estado, a, 10);
    if (ases.length >= 4) {
      const med = mediana(ases.map((x) => x.pct));
      const bajos = ases.filter((x) => x.pct < med);
      const extra = Math.round(bajos.reduce((s, x) => s + (med - x.pct) * x.g, 0));
      resultado.push(`Brecha entre asesores: ${pct(ases[0].pct, 0)} (mejor) vs ${pct(ases[ases.length - 1].pct, 0)} (menor). Si los ${bajos.length} asesores bajo la mediana llegaran a ${pct(med, 0)}, serían +${extra} CT (${pct((a.c + extra) / a.g)}).`);
    }
    if (prevA) resultado.push(`${a.c / a.g >= prevA.c / prevA.g ? 'Incremento' : 'Reducción'} de ${Math.abs((a.c / a.g - prevA.c / prevA.g) * 100).toFixed(1)} pp vs ${mesNombre(mesAnterior(mes)).toLowerCase()} (${pct(prevA.c / prevA.g)} → ${pct(a.c / a.g)}); ${num(prevA.c / Object.keys(prevA.dias).length, 1)} → ${num(a.c / nd, 1)} CT diarios.`);
    const sem = ctSemanas(a, mes);
    if (sem.length >= 2) { const x = sem[sem.length - 1], y = sem[sem.length - 2]; resultado.push(`${x.etiqueta} (${x.rango}): ${pct(x.pct)} de aprovechamiento, ${pp(x.pct - y.pct)} vs ${y.etiqueta}.`); }
    return { origen, resultado };
  }

  function retencionSerie(estado, camp, mesFin, n = 6) {
    const d = estado.manual.retencion[camp] || {};
    return Object.keys(d).filter((k) => k <= mesFin).sort().slice(-n).map((k) => ({ mes: k, ...d[k] }));
  }
  function insightsRet(estado, camp, mes) {
    const serie = retencionSerie(estado, camp, mes, 12);
    const origen = [], resultado = [];
    const act = serie.find((x) => x.mes === mes) || serie[serie.length - 1];
    if (!act || act.ret == null) return { origen, resultado, sinDatos: true };
    origen.push(`${pct(act.ret)} de retención${act.mes !== mes ? ` (último dato: ${mesLabel(act.mes)})` : ''} vs objetivo ${pct(estado.config.objetivos.ret, 0)}.`);
    if (act.canc != null) origen.push(`${pct(act.canc)} de cancelación.`);
    const i = serie.indexOf(act);
    if (i > 0) {
      const p = serie[i - 1];
      resultado.push(`${act.ret >= p.ret ? 'Mejora' : 'Caída'} de ${Math.abs((act.ret - p.ret) * 100).toFixed(1)} pp en tasa de retención vs ${mesLabel(p.mes)} (${pct(p.ret)} → ${pct(act.ret)}).`);
      const mx = Math.max(...serie.map((x) => x.ret));
      if (act.ret === mx && serie.length >= 3) resultado.push(`Mejor resultado de los últimos ${serie.length} meses.`);
    }
    return { origen, resultado };
  }

  function headcountResumen(estado, camp) {
    const h = estado.manual.headcount[camp];
    const cumpl = h.ftes != null && h.dimensionado ? h.ftes / h.dimensionado : null;
    const vac = h.dimensionado != null && h.ftes != null ? h.dimensionado - h.ftes : null;
    return { ...h, cumpl, vac };
  }
  function insightsHC(estado, camp) {
    const h = headcountResumen(estado, camp);
    const origen = [], resultado = [];
    if (h.operadores == null) return { origen, resultado, sinDatos: true };
    origen.push(`Actual: ${h.operadores} operadores${h.ftes != null ? ` (${num(h.ftes, 1)} FTEs)` : ''}${h.dimensionado ? ` vs ${num(h.dimensionado, 1)} dimensionados` : ''}.`);
    for (const t of h.turnos || []) if (t.requerido && t.actual < t.requerido) origen.push(`Falta de cobertura en turno ${t.turno.toLowerCase()} (${t.actual}/${t.requerido}, ${pct(t.actual / t.requerido, 0)} de cobertura).`);
    if (h.cumpl != null) resultado.push(`Cumplimiento de ${pct(h.cumpl)} del headcount dimensionado${h.vac > 0 ? `; vacante de ${num(h.vac, 1)} FTEs` : ''}.`);
    const pend = (h.eventos || []).filter((e) => e.estado !== 'Cerrado');
    if (pend.length) resultado.push(`${pend.length} movimiento(s) pendiente(s): ${pend.slice(0, 3).map((e) => `${e.tipo.toLowerCase()} ${e.cantidad ? '(' + e.cantidad + ')' : ''} ${e.fecha ? ddmm(e.fecha) : ''}`.replace(/\s+/g, ' ').trim()).join('; ')}.`);
    return { origen, resultado };
  }

  /* ------------------------------ láminas ------------------------------ */
  const INDICADORES = [
    { id: 'ns', nombre: 'Nivel de Servicio', titulo: 'Nivel de Servicio' },
    { id: 'nsdiario', nombre: 'NS diario', titulo: 'Nivel de Servicio', sinTextos: true },
    { id: 'tmg', nombre: 'TMG', titulo: 'TMG' },
    { id: 'rell', nombre: '% Rellamada', titulo: '% Rellamada' },
    { id: 'ct', nombre: 'Oportunidades aprovechadas (CT)', titulo: 'Oportunidades aprovechadas (CT)' },
    { id: 'ctdet', nombre: 'CT por asesor y franja', titulo: 'Oportunidades aprovechadas (CT)', sinTextos: true },
    { id: 'ret', nombre: 'Retención/Cancelación', titulo: 'Retención/Cancelación' },
    { id: 'hc', nombre: 'Headcount', titulo: 'Headcount' },
  ];

  function insights(estado, camp, ind, mes) {
    if (ind === 'ns') return insightsNS(estado, camp, mes);
    if (ind === 'tmg') return insightsTMG(estado, camp, mes);
    if (ind === 'rell') return insightsRell(estado, camp, mes);
    if (ind === 'ct') return insightsCT(estado, camp, mes);
    if (ind === 'ret') return insightsRet(estado, camp, mes);
    if (ind === 'hc') return insightsHC(estado, camp);
    return { origen: [], resultado: [] };
  }

  function valorIndicador(estado, camp, ind, mes) {
    if (ind === 'ns') { const m = opsMes(estado, camp, mes); return m ? m.ns : null; }
    if (ind === 'tmg') { const m = opsMes(estado, camp, mes); return m ? m.tmg : null; }
    if (ind === 'rell') { const r = rellMes(estado, camp, mes); return r ? r.pct : null; }
    if (ind === 'ct') { const a = ctMes(estado, camp, mes); return a ? a.c / a.g : null; }
    if (ind === 'ret') { const s = retencionSerie(estado, camp, mes, 1); return s.length ? s[0].ret : null; }
    return null;
  }

  function textosLamina(estado, mes, camp, ind) {
    const t = estado.manual.textos;
    const clave = `${camp}.${ind}`;
    const actual = (t[mes] && t[mes][clave]) || {};
    // la ACCIÓN se arrastra del último mes que la tenga
    let accionPrevia = '';
    if (actual.accion == null) {
      const meses = Object.keys(t).filter((m) => m < mes).sort().reverse();
      for (const m of meses) if (t[m][clave] && t[m][clave].accion) { accionPrevia = t[m][clave].accion; break; }
    }
    const auto = insights(estado, camp, ind, mes);
    return {
      origen: actual.origen != null ? actual.origen : auto.origen.join('\n'),
      resultado: actual.resultado != null ? actual.resultado : auto.resultado.join('\n'),
      accion: actual.accion != null ? actual.accion : accionPrevia,
      deteccion: actual.deteccion != null ? actual.deteccion : '',
      cierreTipo: actual.cierreTipo || 'PARCIAL',
      cierreTexto: actual.cierreTexto || '',
      incluir: actual.incluir != null ? actual.incluir : true,
      semaforo: actual.semaforo || null,
      auto,
      editado: { origen: actual.origen != null, resultado: actual.resultado != null },
    };
  }

  const api = {
    CAMPANAS, CONFIG_DEFECTO, INDICADORES, MESES, DIAS,
    util: { pct, pp, seg, num, signo, mesLabel, mesLargo, mesNombre, mesAnterior, ddmm, ddmmyyyy, dow, semanaDe, rangoSemana, serialAISO, norm },
    interpretarLibro, estadoVacio, incorporar, mesesDisponibles, ultimaFechaDatos, recortar,
    opsMes, opsDiasMes, opsSemanas, serieMensual, sumarOps,
    rellMes, rellDias, rellSemanas, rellSerieMensual,
    ctMes, ctSemanas, ctSerieMensual, ctAsesores, mediana,
    retencionSerie, headcountResumen,
    semaforo, insights, valorIndicador, textosLamina,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MDY = Object.assign(root.MDY || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
