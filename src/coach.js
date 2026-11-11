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

  function pitch(estado, camp, ind, mes, textos) {
    const e = escenario(estado, camp, ind, mes);
    if (!e) return null;
    const esc = ESCENARIOS[e.id];
    const nombre = `${NOMBRE[ind]} ${MDY.CAMPANAS[camp].nombre}`;
    const pasos = [];
    if (ind === 'hc') {
      const h = MDY.headcountResumen(estado, camp);
      pasos.push(`Abre con la foto: ${h.operadores ?? 's/d'} operadores, ${h.cumpl != null ? U.pct(h.cumpl) : 's/d'} del dimensionado.`);
      pasos.push('Recorre la línea de tiempo: qué movimientos ya se cerraron y cuáles siguen pendientes.');
      pasos.push('Cierra con el impacto en cobertura por turno y lo que necesitas (ingresos, traslados, fechas).');
    } else {
      const titular = `${nombre}: ${fmt(ind, e.valor)} vs objetivo ${ind === 'tmg' ? U.seg(e.obj) : U.pct(e.obj, 0)}${e.prev != null ? ` (${delta(ind, e.valor, e.prev)} vs ${U.mesNombre(U.mesAnterior(mes)).toLowerCase()})` : ''}.`;
      if (e.id === 'logro') {
        pasos.push(`Titular: ${titular} Dilo primero, en una frase.`);
        pasos.push('Atribuye el resultado a las acciones concretas (nombra 1 o 2 de la sección ACCIÓN) y al equipo responsable.');
        pasos.push('Muestra que es sostenible: evolución semanal estable y el riesgo que vas a vigilar.');
        pasos.push('Pedido: mantener los recursos/condiciones que hicieron posible el resultado.');
      } else if (e.id === 'sostener') {
        pasos.push(`Titular: ${titular}`);
        pasos.push('Reconoce la señal antes de que te la señalen: "seguimos en objetivo, pero estamos perdiendo margen".');
        pasos.push('Explica la causa con un dato del ORIGEN (día, franja o semana que explica el retroceso).');
        pasos.push('Compromiso preventivo: acción con responsable y fecha para no salir del objetivo.');
      } else if (e.id === 'avance') {
        pasos.push(`Titular: ${titular}`);
        pasos.push(`Enfoca la tendencia: la brecha se redujo; ${e.proy ? `al ritmo actual alcanzamos el objetivo en ~${e.proy} mes(es)` : 'muestra la evolución semanal como prueba'}.`);
        pasos.push('Conecta la mejora con las acciones ejecutadas (evidencia de que el plan funciona).');
        pasos.push('Cierra con lo que falta para cerrar la brecha y el próximo hito medible.');
      } else if (e.id === 'alerta') {
        pasos.push(`Titular sin rodeos: ${titular}`);
        pasos.push('Causa raíz con datos: usa 1 o 2 hallazgos del ORIGEN (cobertura, día crítico, franja, asesores).');
        pasos.push('Plan de acción con dueño, fecha y meta medible para el próximo corte (evita acciones genéricas).');
        pasos.push('Pedido explícito: qué necesitas del directorio (personal, horarios, decisión del cliente).');
      } else {
        pasos.push(`Titular: ${titular}`);
        pasos.push('Muestra la evolución semanal para dar contexto.');
        pasos.push('Cierra con la acción principal y el resultado esperado al próximo corte.');
      }
    }
    const hallazgos = String((textos && textos.origen) || '').split('\n').filter(Boolean).slice(0, 2);
    return {
      escenario: e.id, nombreEscenario: esc.nombre, color: esc.color, mensaje: esc.mensaje,
      pasos, preguntas: PREGUNTAS[ind] || [], hallazgos, proy: e.proy,
    };
  }

  function notasLamina(p) {
    if (!p) return '';
    return [
      `ESCENARIO: ${p.nombreEscenario.toUpperCase()} — ${p.mensaje}`,
      '',
      'CÓMO EXPONERLO:',
      ...p.pasos.map((x, i) => `${i + 1}. ${x}`),
      ...(p.hallazgos.length ? ['', 'DATOS DE RESPALDO:', ...p.hallazgos.map((x) => `• ${x}`)] : []),
      '',
      'PREGUNTAS PROBABLES (prepara la respuesta):',
      ...p.preguntas.map((x) => `• ${x}`),
    ].join('\n');
  }

  function guionHTML(estado, mes, fechaCorte, creditos) {
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const colores = { VERDE: ['#d4edda', '#1e8e4e'], AMBAR: ['#fdf1de', '#b8730f'], ROJO: ['#f8e1e1', '#c0392b'] };
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
        bloque += `<section><h3>${esc(NOMBRE[ind])} <span style="background:${bg};color:${fg}">${esc(p.nombreEscenario)}</span></h3>
          <p class="msg">${esc(p.mensaje)}</p>
          <ol>${p.pasos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
          ${t.accion ? `<h4>Plan de acción (lámina)</h4><ul>${t.accion.split('\n').filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${acc.length ? `<h4>Acciones sugeridas por Pulso CX</h4><ul>${acc.map((a) => `<li>${esc(a.texto)} <em>(${esc(a.porque)})</em></li>`).join('')}</ul>` : ''}
          <h4>Preguntas probables</h4><ul>${p.preguntas.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>`;
      }
      if (bloque) html += `<h2>${esc(MDY.CAMPANAS[camp].nombre)}</h2>${bloque}`;
    }
    const cr = creditos || {};
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Guion de exposición · ${esc(U.mesLargo(mes))}</title>
<style>body{font-family:Arial,sans-serif;color:#18261e;max-width:900px;margin:30px auto;padding:0 20px;line-height:1.45}
h1{color:#007640;margin-bottom:4px}h2{background:#007640;color:#fff;padding:8px 14px;border-radius:6px;margin-top:34px}
h3{margin:22px 0 4px}h3 span{font-size:12px;padding:3px 10px;border-radius:10px;margin-left:8px;vertical-align:middle}
h4{margin:12px 0 4px;color:#007640;font-size:13px;text-transform:uppercase;letter-spacing:.4px}.msg{color:#5a6d62;font-style:italic;margin:2px 0 8px}
section{border-bottom:1px solid #dde6de;padding-bottom:12px}em{color:#5a6d62}.pie{color:#5a6d62;font-size:12px;margin-top:30px}
@media print{h2{-webkit-print-color-adjust:exact;print-color-adjust:exact}section{break-inside:avoid}}</style></head><body>
<h1>Guion de exposición</h1><div>${esc(U.mesLargo(mes))} · información al ${fechaCorte ? U.ddmmyyyy(fechaCorte) : '—'}</div>
${html}<p class="pie">Generado con ${esc(cr.app || 'Pulso CX')}${cr.autor ? ' · Desarrollado por ' + esc(cr.autor) : ''}</p></body></html>`;
  }

  const api = { ESCENARIOS, escenario, accionesSugeridas, pitch, notasLamina, guionHTML };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MDY_COACH = api;
})(typeof window !== 'undefined' ? window : globalThis);
