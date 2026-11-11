/* =====================================================================
 * Pulso CX — recomendaciones de plan de acción y pitch de exposición
 * Reglas basadas en los datos (sin IA, funciona sin internet).
 * ===================================================================== */
(function (root) {
  'use strict';
  const MDY = root.MDY || (typeof require !== 'undefined' ? require('./core.js') : null);
  const U = MDY.util;

  const ESCENARIOS = {
    logro: { nombre: 'Logro', color: 'VERDE', mensaje: 'Cumplimos y mejoramos: mostrar el resultado y explicar qué lo hizo posible.' },
    sostener: { nombre: 'Cumple con alerta', color: 'AMBAR', mensaje: 'Seguimos en objetivo, pero la tendencia empeora: anticipar el riesgo antes de que lo pregunten.' },
    avance: { nombre: 'En recuperación', color: 'AMBAR', mensaje: 'Aún no llegamos, pero la tendencia es correcta: mostrar la brecha que ya cerramos y cuándo llegamos.' },
    alerta: { nombre: 'Alerta', color: 'ROJO', mensaje: 'Fuera de objetivo y empeorando: reconocer la brecha, mostrar la causa raíz con datos y pedir lo necesario.' },
    estable: { nombre: 'Sin referencia', color: 'AMBAR', mensaje: 'No hay mes anterior para comparar: centrar la exposición en la brecha vs objetivo y la evolución semanal.' },
  };
  // dirección: +1 = mayor es mejor, -1 = menor es mejor
  const DIR = { ns: 1, tmg: -1, rell: -1, ct: 1, ret: 1 };
  const NOMBRE = { ns: 'Nivel de Servicio', tmg: 'TMG', rell: '% Rellamada', ct: 'Aprovechamiento de CT', ret: 'Retención', hc: 'Headcount' };

  function fmt(ind, v) { return v == null ? 's/d' : ind === 'tmg' ? U.seg(v) : U.pct(v); }
  function delta(ind, a, b) { return ind === 'tmg' ? U.signo(a - b, 0, ' s') : U.pp(a - b); }

  function objetivo(estado, camp, ind) {
    const o = estado.config.objetivos;
    return ind === 'tmg' ? o.tmg[camp] : o[ind];
  }

  function escenario(estado, camp, ind, mes) {
    if (ind === 'hc') {
      const h = MDY.headcountResumen(estado, camp);
      if (h.cumpl == null) return { id: 'estable' };
      return { id: h.cumpl >= 0.98 ? 'logro' : 'alerta', valor: h.cumpl };
    }
    const v = MDY.valorIndicador(estado, camp, ind, mes);
    if (v == null) return null;
    const prev = MDY.valorIndicador(estado, camp, ind, U.mesAnterior(mes));
    const obj = objetivo(estado, camp, ind);
    const d = DIR[ind];
    const cumple = d > 0 ? v >= obj : v <= obj;
    if (prev == null) return { id: cumple ? 'logro' : 'estable', valor: v, obj, cumple };
    const mejora = (v - prev) * d > (ind === 'tmg' ? 5 : 0.002);
    const empeora = (v - prev) * d < -(ind === 'tmg' ? 5 : 0.002);
    let id;
    if (cumple) id = empeora ? 'sostener' : 'logro';
    else id = mejora ? 'avance' : 'alerta';
    // proyección de llegada al objetivo al ritmo actual (solo si está en recuperación)
    let proy = null;
    if (id === 'avance') {
      const ritmo = Math.abs(v - prev);
      const brecha = Math.abs(obj - v);
      if (ritmo > 0) proy = Math.ceil(brecha / ritmo);
    }
    return { id, valor: v, prev, obj, cumple, proy };
  }

  /* ------------------------------ acciones sugeridas ------------------------------ */
  function accionesSugeridas(estado, camp, ind, mes) {
    const out = [];
    const add = (texto, porque) => out.push({ texto, porque });
    const obj = estado.config.objetivos;
    if (ind === 'ns') {
      const m = MDY.opsMes(estado, camp, mes); if (!m) return out;
      const dias = MDY.opsDiasMes(estado, camp, mes);
      const sobreDim = m.varTraf != null && m.varTraf <= -0.2;
      if (sobreDim) add('Revisar con WFM/cliente el dimensionamiento: el tráfico real está muy por debajo del proyectado; proponer ajuste del forecast y del requerimiento de horas.', `Tráfico ${U.pct(-m.varTraf, 0)} bajo lo dimensionado.`);
      else if (m.cumplRQ != null && m.cumplRQ < 0.92) {
        const def = (m.hrsDim - m.hrs) / Math.max(1, dias.length || 30) / 8;
        add(`Cerrar el déficit de cobertura (≈ ${U.num(def, 1)} agentes/día): reprogramar horarios hacia las franjas con déficit y habilitar horas extra focalizadas.`, `Cumplimiento de horas requeridas de ${U.pct(m.cumplRQ)}.`);
        add('Proyección diaria de asistencia con el ausentismo real de las últimas semanas y sobre-planificación en los días críticos.', 'El déficit de horas explica la caída del NS.');
      }
      const fds = dias.filter((d) => [0, 6].includes(U.dow(d.fecha)));
      const lv = dias.filter((d) => ![0, 6].includes(U.dow(d.fecha)));
      if (fds.length && lv.length) {
        const nf = MDY.sumarOps(fds.map((d) => estado.datos[camp].diario[d.fecha])).ns;
        const nl = MDY.sumarOps(lv.map((d) => estado.datos[camp].diario[d.fecha])).ns;
        if (nl - nf >= 0.05) add('Plan de fines de semana: rol fijo de domingos, incentivo por asistencia dominical y back-up desde otra campaña.', `NS fin de semana ${U.pct(nf)} vs ${U.pct(nl)} L-V.`);
      }
      if (m.adh != null && m.adh < obj.adh - 0.1 && !sobreDim) add('Control de adherencia en línea: alertas cada 30 min por estados no productivos y seguimiento del supervisor por franja.', `Adherencia por franja de ${U.pct(m.adh)}.`);
      if (m.abandono != null && m.abandono > 0.1) add('Activar protocolo de contingencia cuando la cola supere el umbral (mover agentes de back-office / pausas escalonadas).', `Abandono de ${U.pct(m.abandono)}.`);
    }
    if (ind === 'tmg') {
      const m = MDY.opsMes(estado, camp, mes); if (!m) return out;
      const desv = m.tmg / obj.tmg[camp] - 1;
      if (desv > 0.3) add('Coaching focalizado en el 20% de asesores con mayor TMG, con meta individual semanal (PDA medible).', `Desviación de ${U.signo(desv * 100, 1, '%')}.`);
      if (desv > 0.2) add('Auditoría de llamadas largas (> 20 min): identificar motivos, tiempos en espera y ACW; cerrar brechas de proceso.', 'Las llamadas largas concentran la desviación.');
      const ingresos = (estado.manual.headcount[camp].eventos || []).filter((e) => /Ingreso|OJT/.test(e.tipo) && e.fecha && e.fecha >= `${U.mesAnterior(mes)}-01`);
      if (ingresos.length) add('Acompañamiento de la nueva promoción: líder en línea para consultas y guía rápida de procesos frecuentes.', `${ingresos.length} ingreso(s) recientes registrados en headcount.`);
      add('Disponibilizar a un líder para atención de requerimientos en línea (consultas, escalamientos) que alargan la llamada.', 'Reduce tiempos de espera interna.');
    }
    if (ind === 'rell') {
      const r = MDY.rellMes(estado, camp, mes); if (!r) return out;
      const dias = MDY.rellDias(estado, camp, mes);
      const cruce = dias.filter((d) => { const op = estado.datos[camp].diario[d.fecha]; return op && d.pct > r.pct + 0.08 && MDY.sumarOps([op]).ns < obj.ns - 0.15; });
      if (cruce.length) add('Atacar el abandono para bajar la rellamada: los picos coinciden con días de NS bajo (clientes que no fueron atendidos y vuelven a llamar).', `Pico(s): ${cruce.map((d) => U.ddmm(d.fecha)).join(', ')}.`);
      add('Auditoría de rellamadas por motivo en 4 cortes del día y coaching a los asesores con más casos.', `${U.num(r.rell)} rellamadas en el mes.`);
      add('Devolución proactiva de llamadas cortadas y contención desde la segunda llamada detectada.', 'Evita la tercera llamada del mismo cliente.');
      const dom = dias.filter((d) => U.dow(d.fecha) === 0);
      if (dom.length) {
        const pd = dom.reduce((s, d) => s + d.rell, 0) / Math.max(1, dom.reduce((s, d) => s + d.aten, 0));
        if (pd - r.pct >= 0.03) add('Reforzar resolución en fines de semana (supervisor de guardia y acceso a áreas de soporte).', `Domingos con ${U.pct(pd)} de rellamada.`);
      }
    }
    if (ind === 'ct') {
      const a = MDY.ctMes(estado, camp, mes); if (!a) return out;
      const f = a.franjas; const p = (x) => (x.g ? x.c / x.g : null);
      const peor = [['tarde', p(f.T)], ['noche', p(f.N)]].filter((x) => x[1] != null).sort((x, y) => x[1] - y[1])[0];
      if (peor && p(f.M) != null && p(f.M) - peor[1] >= 0.05) add(`Refuerzo del ofrecimiento en el turno ${peor[0]}: recordatorio a mitad de turno y seguimiento del supervisor a las oportunidades del día.`, `Turno ${peor[0]} ${U.pct(peor[1])} vs mañana ${U.pct(p(f.M))}.`);
      const ases = MDY.ctAsesores(estado, a, 10);
      if (ases.length >= 4) {
        const med = MDY.mediana(ases.map((x) => x.pct));
        const bajos = ases.filter((x) => x.pct < med).length;
        add(`PDA para los ${bajos} asesores bajo la mediana (${U.pct(med, 0)}) con meta individual, y duplas con los mejores (${ases.slice(0, 2).map((x) => x.nombre).join(', ')}).`, 'Brecha amplia entre asesores.');
      }
      const top = Object.entries(a.perdidas).sort((x, y) => y[1] - x[1])[0];
      if (top) add(`Guion de oferta específico para llamadas de "${top[0].toLowerCase()}", el motivo con más oportunidades desperdiciadas.`, `${top[1]} oportunidades perdidas en ese motivo.`);
      add('Reforzar el esquema de comisiones (calculadora + tabla) y revisar semanalmente los motivos de no aceptación.', 'Sostiene la motivación al ofrecimiento.');
    }
    if (ind === 'ret') {
      const e = escenario(estado, camp, 'ret', mes);
      if (e && !e.cumple) {
        add('Calibración semanal de llamadas de cancelación: verificar el uso escalonado de armas de retención.', `Retención ${fmt('ret', e.valor)} vs objetivo ${U.pct(e.obj, 0)}.`);
        add('Medir la efectividad por tipificación (OCC, NS D+1) para identificar qué arma retiene más.', 'Permite focalizar la oferta.');
      } else add('Documentar y replicar las buenas prácticas de retención en clínicas de calidad.', 'Sostener el resultado.');
    }
    if (ind === 'hc') {
      const h = MDY.headcountResumen(estado, camp);
      for (const t of h.turnos || []) if (t.requerido && t.actual < t.requerido) add(`Cerrar ${t.requerido - t.actual} posición(es) en turno ${t.turno.toLowerCase()} (traslados internos o nuevo ingreso).`, `Cobertura ${t.actual}/${t.requerido}.`);
      const pend = (h.eventos || []).filter((e) => e.estado !== 'Cerrado');
      if (pend.length) add('Asignar responsable y fecha a los movimientos pendientes y revisarlos en el próximo corte.', `${pend.length} movimiento(s) sin cerrar.`);
      if (h.vac > 0) add(`Presentar plan de staffing para cubrir ${U.num(h.vac, 1)} FTE de vacante.`, `Cumplimiento ${U.pct(h.cumpl)}.`);
    }
    return out;
  }

  /* ------------------------------ pitch de exposición ------------------------------ */
  const PREGUNTAS = {
    ns: ['¿Qué día/franja explica la caída?', '¿Cuántos agentes faltan para cumplir?', '¿Cuándo llegamos al objetivo?'],
    tmg: ['¿Qué asesores concentran la desviación?', '¿Es un tema de personal nuevo o de proceso?', '¿Qué impacto tiene en el NS?'],
    rell: ['¿Por qué vuelven a llamar los clientes?', '¿Qué asesores generan más rellamadas?', '¿Está relacionado con el abandono?'],
    ct: ['¿Por qué no se aceptan las ofertas?', '¿Quiénes son los mejores y qué hacen distinto?', '¿Cuántas migraciones más podemos lograr?'],
    ret: ['¿Qué arma de retención funciona mejor?', '¿Cuánto se pierde por cada punto de retención?'],
    hc: ['¿Cuándo se cierran las vacantes?', '¿Qué turno está más descubierto?'],
  };

  /* Impacto en las personas (PATHOS): traduce el indicador a clientes / equipo */
  function impacto(estado, camp, ind, mes, e) {
    const positivo = e.id === 'logro' || e.id === 'avance';
    if (ind === 'ns') {
      const m = MDY.opsMes(estado, camp, mes);
      if (!m) return null;
      const noAt = m.rec - m.umbral;
      return positivo
        ? `${U.num(m.umbral)} clientes fueron atendidos a tiempo este mes; detrás del número hay un equipo que sostuvo la cobertura.`
        : `${U.num(m.aband)} clientes colgaron sin ser atendidos y ${U.num(noAt)} esperaron más de lo comprometido: es la primera experiencia que se llevan de nosotros.`;
    }
    if (ind === 'tmg') {
      const m = MDY.opsMes(estado, camp, mes); if (!m) return null;
      const extra = Math.round(m.tmg - e.obj);
      return extra > 0
        ? `Cada cliente pasa en promedio ${extra} s más al teléfono de lo previsto (${U.num((extra * (m.rec - m.aband)) / 3600)} horas del cliente en el mes); también es tiempo de cola para el siguiente.`
        : 'El cliente resuelve en menos tiempo: menos espera para todos los que están en cola.';
    }
    if (ind === 'rell') {
      const r = MDY.rellMes(estado, camp, mes); if (!r) return null;
      return `${U.num(r.rell)} veces un cliente tuvo que volver a llamar porque su caso no quedó resuelto: ${positivo ? 'cada punto que bajamos es un cliente que no repite la molestia.' : 'es esfuerzo doble para él y para el equipo.'}`;
    }
    if (ind === 'ct') {
      const a = MDY.ctMes(estado, camp, mes); if (!a) return null;
      return positivo
        ? `${U.num(a.c)} clientes ya migraron a una mejor tecnología gracias al ofrecimiento del equipo.`
        : `${U.num(a.g - a.c)} clientes que podían migrar a una mejor tecnología se fueron sin la oferta: es servicio que dejamos de darles (y comisión que el equipo deja de ganar).`;
    }
    if (ind === 'ret') {
      if (e.valor == null) return null;
      return `De cada 100 clientes que llaman para irse, hoy retenemos ${Math.round(e.valor * 100)}${positivo ? ': el equipo está convenciendo a más clientes de quedarse.' : '; cada punto son clientes que se pierden.'}`;
    }
    if (ind === 'hc') {
      const h = MDY.headcountResumen(estado, camp);
      return h.cumpl != null && h.cumpl < 1
        ? `El equipo opera con el ${U.pct(h.cumpl, 0)} de la dotación: la carga extra la absorben las personas que sí están (y se nota en ausentismo y rotación).`
        : 'El equipo está completo: es la base para sostener los indicadores.';
    }
    return null;
  }

  // Orden retórico recomendado según el escenario
  const ORDEN = {
    logro: ['PATHOS', 'LOGOS', 'ETHOS', 'PROPUESTA'],
    sostener: ['LOGOS', 'ETHOS', 'PATHOS', 'PROPUESTA'],
    avance: ['LOGOS', 'ETHOS', 'PATHOS', 'PROPUESTA'],
    alerta: ['ETHOS', 'LOGOS', 'PATHOS', 'PROPUESTA'],
    estable: ['LOGOS', 'PATHOS', 'ETHOS', 'PROPUESTA'],
  };
  const QUE_ES = {
    ETHOS: 'Credibilidad: quién eres, qué asumes y qué ya hiciste',
    PATHOS: 'Emoción: el impacto en clientes y equipo',
    LOGOS: 'Lógica: el dato, la causa y la tendencia',
    PROPUESTA: 'Cierre: qué propones y qué necesitas',
  };

  function pitch(estado, camp, ind, mes, textos) {
    const e = escenario(estado, camp, ind, mes);
    if (!e) return null;
    const esc = ESCENARIOS[e.id];
    const nombre = `${NOMBRE[ind]} ${MDY.CAMPANAS[camp].nombre}`;
    const acciones = String((textos && textos.accion) || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const hallazgos = String((textos && textos.origen) || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const comp = (estado.manual.compromisos || []);
    const cerrados = comp.filter((c) => c.estado === 'Cerrado').length;
    const sug = accionesSugeridas(estado, camp, ind, mes);

    // LOGOS
    const logos = [];
    if (ind === 'hc') {
      const h = MDY.headcountResumen(estado, camp);
      logos.push(`${h.operadores ?? 's/d'} operadores, ${h.cumpl != null ? U.pct(h.cumpl) : 's/d'} del headcount dimensionado${h.vac > 0 ? `; vacante de ${U.num(h.vac, 1)} FTE` : ''}.`);
    } else {
      logos.push(`${nombre}: ${fmt(ind, e.valor)} vs objetivo ${ind === 'tmg' ? U.seg(e.obj) : U.pct(e.obj, 0)}${e.prev != null ? ` (${delta(ind, e.valor, e.prev)} vs ${U.mesNombre(U.mesAnterior(mes)).toLowerCase()})` : ''}.`);
    }
    hallazgos.slice(1, 3).forEach((h) => logos.push(h));
    if (e.id === 'avance' && e.proy) logos.push(`Al ritmo actual alcanzamos el objetivo en ~${e.proy} mes(es).`);

    // ETHOS
    const ethos = [];
    if (e.id === 'alerta') ethos.push('Asume la brecha en primera persona y sin rodeos: "No estamos donde nos comprometimos y estos son los motivos".');
    if (e.id === 'sostener') ethos.push('Anticípate al directorio: "Seguimos en objetivo, pero ya detectamos la señal y estamos actuando".');
    if (e.id === 'logro') ethos.push('Atribuye el resultado al equipo y a decisiones concretas, no a la suerte.');
    if (e.id === 'avance') ethos.push('Muestra que el plan funciona: la mejora es consecuencia de lo que se ejecutó.');
    if (acciones.length) ethos.push(`Lo que ya hicimos: ${acciones.slice(0, 2).join(' / ')}`);
    else ethos.push('Menciona 1 o 2 acciones ya ejecutadas con fecha (completa la sección ACCIÓN).');
    if (comp.length) ethos.push(`Cumplimiento de compromisos: ${cerrados} de ${comp.length} cerrados desde el último corte.`);

    // PATHOS
    const pathos = [];
    const imp = impacto(estado, camp, ind, mes, e);
    if (imp) pathos.push(imp);
    if (e.id === 'logro') pathos.push('Reconoce con nombre a las personas o equipos que lo hicieron posible.');
    if (e.id === 'alerta') pathos.push('Habla del cliente antes que del indicador: lo que vivió es lo que hay que cambiar.');

    // PROPUESTA
    const prop = [];
    if (e.id === 'logro') prop.push('Pide mantener las condiciones (recursos, horarios, foco) que generaron el resultado.');
    if (e.id === 'sostener') prop.push(`Acción preventiva con responsable y fecha${sug[0] ? `: ${sug[0].texto}` : '.'}`);
    if (e.id === 'avance') prop.push(`Siguiente hito medible para el próximo corte${sug[0] ? `; reforzar con: ${sug[0].texto}` : '.'}`);
    if (e.id === 'alerta') {
      prop.push(`Plan con dueño, fecha y meta medible${sug[0] ? `: ${sug[0].texto}` : '.'}`);
      prop.push('Pedido explícito al directorio: qué decisión o recurso necesitas para cerrar la brecha.');
    }
    if (e.id === 'estable') prop.push('Acción principal y resultado esperado al próximo corte.');

    const bloques = { LOGOS: logos, ETHOS: ethos, PATHOS: pathos, PROPUESTA: prop };
    const secuencia = ORDEN[e.id].map((k) => ({ tipo: k, queEs: QUE_ES[k], puntos: bloques[k] })).filter((b) => b.puntos.length);
    return {
      escenario: e.id, nombreEscenario: esc.nombre, color: esc.color, mensaje: esc.mensaje, titulo: nombre,
      secuencia, preguntas: PREGUNTAS[ind] || [], proy: e.proy,
    };
  }

  function notasLamina(p) {
    if (!p) return '';
    return [
      `${p.titulo.toUpperCase()} — ESCENARIO: ${p.nombreEscenario.toUpperCase()}`,
      p.mensaje,
      '',
      ...p.secuencia.flatMap((b, i) => [`${i + 1}. ${b.tipo} (${b.queEs})`, ...b.puntos.map((x) => `   • ${x}`)]),
      '',
      'PREGUNTAS PROBABLES:',
      ...p.preguntas.map((x) => `   • ${x}`),
    ].join('\n');
  }

  function guionHTML(estado, mes, fechaCorte, creditos) {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const colores = { VERDE: ['#d4edda', '#1e8e4e'], AMBAR: ['#fdf1de', '#b8730f'], ROJO: ['#f8e1e1', '#c0392b'] };
    const colTipo = { ETHOS: '#2e6da4', PATHOS: '#b8456b', LOGOS: '#007640', PROPUESTA: '#7a5208' };
    let html = '';
    for (const camp of ['premium', 'fullclaro']) {
      let bloque = '';
      for (const ind of ['ns', 'tmg', 'rell', 'ct', 'ret', 'hc']) {
        const t = MDY.textosLamina(estado, mes, camp, ind);
        if (!t.incluir) continue;
        const p = pitch(estado, camp, ind, mes, t);
        if (!p) continue;
        const enPlan = String(t.accion || '').split('\n').map((x) => x.trim());
        const acc = accionesSugeridas(estado, camp, ind, mes).filter((a) => !enPlan.includes(a.texto));
        const [bg, fg] = colores[p.color];
        bloque += `<section><h3>${esc(NOMBRE[ind])} <span class="esc" style="background:${bg};color:${fg}">${esc(p.nombreEscenario)}</span></h3>
          <p class="msg">${esc(p.mensaje)}</p>
          ${p.secuencia.map((b, i) => `<div class="b"><div class="t" style="color:${colTipo[b.tipo]}">${i + 1}. ${b.tipo} <small>· ${esc(b.queEs)}</small></div><ul>${b.puntos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}
          ${acc.length ? `<h4>Otras acciones sugeridas</h4><ul>${acc.map((a) => `<li>${esc(a.texto)} <em>(${esc(a.porque)})</em></li>`).join('')}</ul>` : ''}
          <h4>Preguntas probables</h4><ul>${p.preguntas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
      }
      if (bloque) html += `<h2>${esc(MDY.CAMPANAS[camp].nombre)}</h2>${bloque}`;
    }
    const cr = creditos || {};
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Guion de exposición · ${esc(U.mesLargo(mes))}</title>
<style>body{font-family:Arial,sans-serif;color:#18261e;max-width:900px;margin:30px auto;padding:0 20px;line-height:1.45}
h1{color:#007640;margin-bottom:4px}h2{background:#007640;color:#fff;padding:8px 14px;border-radius:6px;margin-top:34px}
h3{margin:22px 0 4px}.esc{font-size:12px;padding:3px 10px;border-radius:10px;margin-left:8px;vertical-align:middle}
h4{margin:12px 0 4px;color:#5a6d62;font-size:12px;text-transform:uppercase;letter-spacing:.4px}.msg{color:#5a6d62;font-style:italic;margin:2px 0 8px}
.b{margin:8px 0}.b .t{font-weight:bold;font-size:13.5px}.b .t small{font-weight:normal;color:#5a6d62}.b ul{margin:4px 0}
.leyenda{background:#f5f8f5;border:1px solid #dde6de;border-radius:6px;padding:10px 14px;font-size:13px;margin-top:14px}
section{border-bottom:1px solid #dde6de;padding-bottom:12px}em{color:#5a6d62}.pie{color:#5a6d62;font-size:12px;margin-top:30px}
@media print{h2,.esc{-webkit-print-color-adjust:exact;print-color-adjust:exact}section{break-inside:avoid}}</style></head><body>
<h1>Guion de exposición</h1><div>${esc(U.mesLargo(mes))} · información al ${fechaCorte ? U.ddmmyyyy(fechaCorte) : '—'}</div>
<div class="leyenda"><b>Esquema Ethos · Pathos · Logos.</b> <b style="color:${colTipo.ETHOS}">Ethos</b>: credibilidad (asumir, mostrar lo hecho). <b style="color:${colTipo.PATHOS}">Pathos</b>: impacto en clientes y equipo. <b style="color:${colTipo.LOGOS}">Logos</b>: datos, causa y tendencia. El orden cambia según el escenario: en <b>Alerta</b> se abre con Ethos (asumir la brecha); en <b>Logro</b> con Pathos (reconocer al equipo); en <b>Recuperación</b> y <b>Cumple con alerta</b> con Logos (la tendencia). Siempre se cierra con una <b>Propuesta</b>.</div>
${html}<p class="pie">Generado con ${esc(cr.app || 'Pulso CX')}${cr.autor ? ' · Desarrollado por ' + esc(cr.autor) : ''}</p></body></html>`;
  }

  const api = { ESCENARIOS, escenario, accionesSugeridas, pitch, notasLamina, guionHTML };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MDY_COACH = api;
})(typeof window !== 'undefined' ? window : globalThis);
