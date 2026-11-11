/* =====================================================================
 * MDY Presentaciones — interfaz (sin servidor, sin internet)
 * ===================================================================== */
(function () {
  'use strict';
  const MDY = window.MDY, DECK = window.MDY_DECK, U = MDY.util;
  const CLAVE = 'mdy_presentaciones_v1';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CAMPS = ['premium', 'fullclaro'];
  const TIPOS_EVENTO = Object.keys(DECK.COLOR_EVENTO);
  const ESTADOS_EVENTO = ['Planificado', 'En proceso', 'Cerrado'];
  const TURNOS = ['Mañana', 'Tarde', 'Noche'];

  /* ------------------------------ estado ------------------------------ */
  let estado;
  function cargarEstado() {
    try {
      const raw = localStorage.getItem(CLAVE);
      estado = raw ? fusionar(MDY.estadoVacio(), JSON.parse(raw)) : MDY.estadoVacio();
    } catch (e) { estado = MDY.estadoVacio(); }
  }
  function fusionar(base, x) {
    if (x == null || typeof x !== 'object' || Array.isArray(x)) return x == null ? base : x;
    const out = Array.isArray(base) ? [] : { ...base };
    for (const k of Object.keys(x)) out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? fusionar(base[k], x[k]) : x[k];
    return out;
  }
  let tGuardar;
  function guardar() {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => {
      try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { aviso('No se pudo guardar en el navegador: ' + e.message); }
    }, 250);
  }
  function aviso(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3200); }

  /* ------------------------------ pestañas ------------------------------ */
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    $$('section.tab').forEach((s) => s.classList.toggle('on', s.id === 'tab-' + b.dataset.tab));
    if (b.dataset.tab === 'revisar') pintarRevisar();
    if (b.dataset.tab === 'descargar') pintarDescargar();
    if (b.dataset.tab === 'manual') pintarManual();
  });
  $('#subManual').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#subManual button').forEach((x) => x.classList.toggle('on', x === b));
    $$('.subsec').forEach((s) => s.classList.toggle('on', s.id === 'sub-' + b.dataset.sub));
  });

  /* ------------------------------ 1. carga ------------------------------ */
  const drop = $('#drop'), inp = $('#archivos');
  drop.addEventListener('click', () => inp.click());
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); procesarArchivos([...e.dataTransfer.files]); });
  inp.addEventListener('change', () => { procesarArchivos([...inp.files]); inp.value = ''; });

  function leerArchivo(f) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => {
        try {
          const wb = XLSX.read(new Uint8Array(fr.result), { type: 'array', cellDates: false });
          const hojas = {};
          for (const n of wb.SheetNames) hojas[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
          res({ hojas });
        } catch (e) { rej(e); }
      };
      fr.onerror = () => rej(fr.error);
      fr.readAsArrayBuffer(f);
    });
  }
  async function procesarArchivos(files) {
    const out = [];
    for (const f of files) {
      try {
        const r = MDY.interpretarLibro(await leerArchivo(f));
        if (r.tipo === 'desconocido') out.push({ f: f.name, ok: false, t: r.error });
        else { MDY.incorporar(estado, r, f.name); out.push({ f: f.name, ok: true, t: r.resumen }); }
      } catch (e) { out.push({ f: f.name, ok: false, t: 'No se pudo leer: ' + e.message }); }
    }
    $('#resultadoCarga').innerHTML = `<table class="t"><tr><th>Archivo</th><th>Resultado</th></tr>${out.map((o) => `<tr><td>${esc(o.f)}</td><td class="${o.ok ? 'ok' : 'falta'}">${o.ok ? '✔ ' : '✖ '}${esc(o.t)}</td></tr>`).join('')}</table>`;
    const meses = MDY.mesesDisponibles(estado);
    if (meses.length) { estado.corte.mes = meses[meses.length - 1]; estado.corte.fecha = MDY.ultimaFechaDatos(estado, estado.corte.mes) || estado.corte.fecha; }
    guardar(); pintarCarga();
    aviso(`${out.filter((o) => o.ok).length} de ${out.length} archivo(s) cargados`);
  }

  function pintarCarga() {
    const meses = MDY.mesesDisponibles(estado);
    const ult = (obj) => { const k = Object.keys(obj).sort(); return k.length ? k[k.length - 1] : null; };
    $('#estadoDatos').innerHTML = `<div class="estado-datos">${CAMPS.map((c) => {
      const d = estado.datos[c];
      const um = ult(d.mensual), ud = ult(d.diario), ur = ult(d.rell), uc = ult(d.ct);
      const li = (n, v) => `<div>${v ? '<span class="ok">✔</span>' : '<span class="falta">✖</span>'} ${n}: ${v ? esc(v) : '<span class="muted">sin datos</span>'}</div>`;
      return `<div class="chip"><b>${MDY.CAMPANAS[c].nombre}</b>
        ${li('Operación mensual', um && `hasta ${U.mesLabel(um)} (${Object.keys(d.mensual).length} meses)`)}
        ${li('Operación diaria', ud && `hasta ${U.ddmmyyyy(ud)}`)}
        ${li('Rellamadas', ur && `hasta ${U.ddmmyyyy(ur)}`)}
        ${li('Oportunidades CT', uc && `${Object.keys(d.ct).map(U.mesLabel).join(', ')}`)}
        ${li('Retención (manual)', Object.keys(estado.manual.retencion[c] || {}).length && Object.keys(estado.manual.retencion[c]).sort().map(U.mesLabel).join(', '))}
        ${li('Headcount (manual)', estado.manual.headcount[c].operadores != null && `${estado.manual.headcount[c].operadores} operadores`)}
      </div>`;
    }).join('')}</div>${meses.length ? `<p class="muted" style="margin-top:10px">Meses con información: ${meses.map(U.mesLabel).join(' · ')}</p>` : ''}`;
    $('#historial').innerHTML = estado.cargas.length
      ? `<table class="t"><tr><th>Fecha</th><th>Archivo</th><th>Contenido</th></tr>${estado.cargas.slice(0, 15).map((c) => `<tr><td>${new Date(c.fecha).toLocaleString('es-PE')}</td><td>${esc(c.archivo)}</td><td>${esc(c.resumen)}</td></tr>`).join('')}</table>`
      : '<p class="muted">Aún no se cargó ningún archivo.</p>';
  }

  /* ------------------------------ 2. manual ------------------------------ */
  function pintarManual() { pintarHC(); pintarRet(); pintarComp(); pintarCasos(); pintarAses(); pintarObj(); }

  function numOrNull(v) { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; }

  // ---- Headcount
  function pintarHC() {
    $('#sub-hc').innerHTML = `<div class="info">Registra cada movimiento cuando ocurra (ingresos, ceses, traslados, cambios de turno). La lámina de Headcount arma la línea de tiempo con los últimos 8 movimientos y la foto actual.</div>
    <div class="grid2">${CAMPS.map((c) => {
      const h = estado.manual.headcount[c];
      const turnos = TURNOS.map((t) => (h.turnos || []).find((x) => x.turno === t) || { turno: t, requerido: '', actual: '' });
      const ev = [...(h.eventos || [])].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      const r = MDY.headcountResumen(estado, c);
      return `<div class="card" data-camp="${c}">
        <h2>${MDY.CAMPANAS[c].nombre}</h2>
        <h3>Foto actual</h3>
        <div class="fila">
          <label>Operadores <input type="number" data-hc="operadores" value="${h.operadores ?? ''}" style="width:100px"></label>
          <label>FTEs <input type="number" step="0.5" data-hc="ftes" value="${h.ftes ?? ''}" style="width:100px"></label>
          <label>FTEs dimensionados <input type="number" step="0.5" data-hc="dimensionado" value="${h.dimensionado ?? ''}" style="width:120px"></label>
          <div class="muted">Cumplimiento: <b>${r.cumpl != null ? U.pct(r.cumpl) : '—'}</b></div>
        </div>
        <h3>Cobertura por turno <span class="muted">(opcional)</span></h3>
        <table class="t"><tr><th>Turno</th><th class="c">Requerido</th><th class="c">Actual</th></tr>
          ${turnos.map((t) => `<tr><td>${t.turno}</td><td><input type="number" data-turno="${t.turno}" data-k="requerido" value="${t.requerido ?? ''}"></td><td><input type="number" data-turno="${t.turno}" data-k="actual" value="${t.actual ?? ''}"></td></tr>`).join('')}
        </table>
        <h3>Nuevo movimiento</h3>
        <div class="fila nuevo-ev">
          <label>Fecha <input type="date" name="fecha"></label>
          <label>Tipo <select name="tipo">${TIPOS_EVENTO.map((t) => `<option>${t}</option>`).join('')}</select></label>
          <label>Cantidad <input type="number" name="cantidad" style="width:80px"></label>
          <label>Turno <select name="turno"><option></option>${TURNOS.map((t) => `<option>${t}</option>`).join('')}</select></label>
          <label>Modalidad <select name="modalidad"><option></option><option>Full Time</option><option>Part Time</option></select></label>
          <label>Estado <select name="estado">${ESTADOS_EVENTO.map((t) => `<option ${t === 'Cerrado' ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
          <label style="flex:1;min-width:220px">Comentario <input type="text" name="comentario" placeholder="Ej.: Traslado de 3 agentes de Full Claro a Premium"></label>
          <button class="b" data-accion="addEv">Agregar</button>
        </div>
        <h3>Línea de tiempo</h3>
        ${ev.length ? `<div class="timeline">${ev.map((e) => `<div class="ev">
            <div class="f">${e.fecha ? U.ddmmyyyy(e.fecha) : '—'}</div>
            <div class="p" style="border-color:#${DECK.COLOR_EVENTO[e.tipo] || '5A6D62'};${e.estado === 'Cerrado' ? `background:#${DECK.COLOR_EVENTO[e.tipo] || '5A6D62'}` : ''}"></div>
            <div class="d"><b style="color:#${DECK.COLOR_EVENTO[e.tipo] || '5A6D62'}">${e.cantidad ? (e.tipo === 'Cese / Retiro' ? '−' : '+') + Math.abs(e.cantidad) + ' ' : ''}${esc(e.tipo)}</b>
              <small>${esc([e.turno, e.modalidad].filter(Boolean).join(' · '))}</small>
              <select data-ev="${e.id}" data-k="estado" style="padding:2px 4px;font-size:12px;margin-left:6px">${ESTADOS_EVENTO.map((t) => `<option ${t === e.estado ? 'selected' : ''}>${t}</option>`).join('')}</select>
              <button class="x" data-accion="delEv" data-id="${e.id}" title="Eliminar">✕</button>
              ${e.comentario ? `<div><small>${esc(e.comentario)}</small></div>` : ''}</div></div>`).join('')}</div>` : '<p class="muted">Sin movimientos registrados.</p>'}
      </div>`;
    }).join('')}</div>`;
  }
  $('#sub-hc').addEventListener('change', (e) => {
    const card = e.target.closest('[data-camp]'); if (!card) return;
    const h = estado.manual.headcount[card.dataset.camp];
    if (e.target.dataset.hc) h[e.target.dataset.hc] = numOrNull(e.target.value);
    else if (e.target.dataset.turno) {
      h.turnos = h.turnos || [];
      let t = h.turnos.find((x) => x.turno === e.target.dataset.turno);
      if (!t) { t = { turno: e.target.dataset.turno, requerido: null, actual: null }; h.turnos.push(t); }
      t[e.target.dataset.k] = numOrNull(e.target.value);
      h.turnos.sort((a, b) => TURNOS.indexOf(a.turno) - TURNOS.indexOf(b.turno));
    } else if (e.target.dataset.ev) {
      const ev = h.eventos.find((x) => x.id === e.target.dataset.ev); if (ev) ev[e.target.dataset.k] = e.target.value;
      pintarHC();
    } else return;
    guardar();
  });
  $('#sub-hc').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]'); if (!b) return;
    const card = b.closest('[data-camp]'); const h = estado.manual.headcount[card.dataset.camp];
    if (b.dataset.accion === 'addEv') {
      const f = b.closest('.nuevo-ev'); const v = (n) => f.querySelector(`[name=${n}]`).value;
      if (!v('fecha')) { aviso('Indica la fecha del movimiento'); return; }
      h.eventos = h.eventos || [];
      h.eventos.push({ id: 'e' + Date.now(), fecha: v('fecha'), tipo: v('tipo'), cantidad: numOrNull(v('cantidad')), turno: v('turno'), modalidad: v('modalidad'), estado: v('estado'), comentario: v('comentario') });
      guardar(); pintarHC(); aviso('Movimiento agregado');
    }
    if (b.dataset.accion === 'delEv' && confirm('¿Eliminar este movimiento?')) { h.eventos = h.eventos.filter((x) => x.id !== b.dataset.id); guardar(); pintarHC(); }
  });

  // ---- Retención
  function pintarRet() {
    $('#sub-ret').innerHTML = `<div class="info">Ingresa cada mes los valores que comparte el cliente (en %). Con el histórico se arma el gráfico de Retención/Cancelación y la fila del Resumen Ejecutivo.</div>
    <div class="grid2">${CAMPS.map((c) => {
      const d = estado.manual.retencion[c] || {};
      const meses = Object.keys(d).sort();
      return `<div class="card" data-camp="${c}"><h2>${MDY.CAMPANAS[c].nombre}</h2>
        <table class="t"><tr><th>Mes</th><th class="c">% Retención</th><th class="c">% Cancelación</th><th>Observación</th><th></th></tr>
        ${meses.map((m) => `<tr data-mes="${m}"><td><b>${U.mesLabel(m)}</b></td>
          <td><input type="number" step="0.01" data-k="ret" value="${d[m].ret != null ? +(d[m].ret * 100).toFixed(2) : ''}"></td>
          <td><input type="number" step="0.01" data-k="canc" value="${d[m].canc != null ? +(d[m].canc * 100).toFixed(2) : ''}"></td>
          <td><input type="text" data-k="obs" value="${esc(d[m].obs || '')}"></td>
          <td><button class="x" data-accion="delRet">✕</button></td></tr>`).join('')}
        </table>
        <div class="fila nuevo-ret" style="margin-top:10px">
          <label>Mes <input type="month" name="mes"></label>
          <label>% Retención <input type="number" step="0.01" name="ret" style="width:100px" placeholder="81.5"></label>
          <label>% Cancelación <input type="number" step="0.01" name="canc" style="width:100px" placeholder="18.5"></label>
          <button class="b" data-accion="addRet">Agregar mes</button>
        </div></div>`;
    }).join('')}</div>`;
  }
  $('#sub-ret').addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-mes]'); if (!tr) return;
    const c = e.target.closest('[data-camp]').dataset.camp; const k = e.target.dataset.k;
    const o = estado.manual.retencion[c][tr.dataset.mes];
    o[k] = k === 'obs' ? e.target.value : (numOrNull(e.target.value) == null ? null : numOrNull(e.target.value) / 100);
    guardar();
  });
  $('#sub-ret').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]'); if (!b) return;
    const c = b.closest('[data-camp]').dataset.camp;
    estado.manual.retencion[c] = estado.manual.retencion[c] || {};
    if (b.dataset.accion === 'addRet') {
      const f = b.closest('.nuevo-ret'); const v = (n) => f.querySelector(`[name=${n}]`).value;
      if (!v('mes') || numOrNull(v('ret')) == null) { aviso('Indica el mes y el % de retención'); return; }
      const canc = numOrNull(v('canc'));
      estado.manual.retencion[c][v('mes')] = { ret: numOrNull(v('ret')) / 100, canc: canc == null ? null : canc / 100, obs: '' };
      guardar(); pintarRet(); aviso('Mes agregado');
    }
    if (b.dataset.accion === 'delRet' && confirm('¿Eliminar este mes?')) { delete estado.manual.retencion[c][b.closest('tr').dataset.mes]; guardar(); pintarRet(); }
  });

  // ---- Compromisos
  function pintarComp() {
    const l = estado.manual.compromisos;
    $('#sub-comp').innerHTML = `<div class="card"><h2>Compromisos y próximo corte</h2>
      <p class="ayuda">Se muestran en la lámina de Cierre. Actualiza el estado cada semana; elimina los que ya no quieras mostrar.</p>
      <table class="t"><tr><th style="width:20%">Indicador</th><th>Compromiso</th><th style="width:16%">Responsable</th><th style="width:12%">Fecha</th><th style="width:12%">Estado</th><th></th></tr>
      ${l.map((c, i) => `<tr data-i="${i}"><td><input data-k="indicador" value="${esc(c.indicador)}"></td><td><input data-k="compromiso" value="${esc(c.compromiso)}"></td>
        <td><input data-k="responsable" value="${esc(c.responsable)}"></td><td><input data-k="fecha" value="${esc(c.fecha)}" placeholder="dd/mm o Próx. corte"></td>
        <td><select data-k="estado">${['Pendiente', 'En curso', 'Cerrado'].map((x) => `<option ${x === c.estado ? 'selected' : ''}>${x}</option>`).join('')}</select></td>
        <td><button class="x" data-accion="del">✕</button></td></tr>`).join('')}
      </table><div style="margin-top:10px"><button class="b" data-accion="add">+ Agregar compromiso</button></div></div>`;
  }
  $('#sub-comp').addEventListener('change', (e) => { const tr = e.target.closest('tr[data-i]'); if (!tr) return; estado.manual.compromisos[+tr.dataset.i][e.target.dataset.k] = e.target.value; guardar(); });
  $('#sub-comp').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]'); if (!b) return;
    if (b.dataset.accion === 'add') estado.manual.compromisos.push({ indicador: '', compromiso: '', responsable: '', fecha: '', estado: 'Pendiente' });
    if (b.dataset.accion === 'del') estado.manual.compromisos.splice(+b.closest('tr').dataset.i, 1);
    guardar(); pintarComp();
  });

  // ---- Casos operativos
  function pintarCasos() {
    const l = estado.manual.casos;
    $('#sub-casos').innerHTML = `<div class="info">Incidentes puntuales (formato causa raíz). Cada caso marcado genera una lámina.</div>
      ${l.map((c, i) => `<div class="card" data-i="${i}">
        <div class="fila" style="justify-content:space-between"><label style="flex:1">Título <input data-k="titulo" value="${esc(c.titulo)}" placeholder="Incidente OCC / Asesor"></label>
          <label class="check"><input type="checkbox" data-k="incluir" ${c.incluir !== false ? 'checked' : ''}> Incluir en el PPT</label>
          <button class="x" data-accion="del" title="Eliminar">✕</button></div>
        <div class="grid2" style="margin-top:10px">
          <div class="campo"><div class="et">QUÉ PASÓ</div><textarea data-k="que">${esc(c.que)}</textarea></div>
          <div class="campo"><div class="et">CAUSA RAÍZ</div><textarea data-k="causa">${esc(c.causa)}</textarea></div>
          <div class="campo"><div class="et">ACCIÓN CORRECTIVA</div><textarea data-k="accion">${esc(c.accion)}</textarea></div>
          <div class="campo"><div class="et">ESTADO</div><textarea data-k="estado">${esc(c.estado)}</textarea></div>
        </div></div>`).join('')}
      <button class="b" data-accion="add">+ Agregar caso</button>`;
  }
  $('#sub-casos').addEventListener('input', (e) => { const card = e.target.closest('[data-i]'); if (!card || !e.target.dataset.k) return; estado.manual.casos[+card.dataset.i][e.target.dataset.k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; guardar(); });
  $('#sub-casos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-accion]'); if (!b) return;
    if (b.dataset.accion === 'add') estado.manual.casos.push({ titulo: '', que: '', causa: '', accion: '', estado: '', incluir: true });
    if (b.dataset.accion === 'del') { if (!confirm('¿Eliminar este caso?')) return; estado.manual.casos.splice(+b.closest('[data-i]').dataset.i, 1); }
    guardar(); pintarCasos();
  });

  // ---- Asesores
  function pintarAses() {
    const a = estado.manual.asesores || {};
    const n = Object.keys(a).length;
    const sinNombre = new Set();
    for (const c of CAMPS) for (const m of Object.values(estado.datos[c].ct)) for (const cod of Object.keys(m.asesores)) if (!a[cod]) sinNombre.add(cod);
    $('#sub-ases').innerHTML = `<div class="card"><h2>Listado de asesores (código → nombre)</h2>
      <p class="ayuda">El reporte de oportunidades trae solo el código del asesor. Copia desde Excel dos columnas (código y nombre) y pégalas aquí para ver nombres en el ranking. Se guardan para las próximas semanas.</p>
      <textarea id="pegarAses" rows="8" style="width:100%" placeholder="E3082895&#9;Pérez Gómez, Ana&#10;E3072722&#9;Flores Ruiz, Carlos"></textarea>
      <div class="fila" style="margin-top:8px"><button class="b" id="btnAses">Guardar listado</button><span class="muted">${n} asesores con nombre${sinNombre.size ? ` · ${sinNombre.size} códigos sin nombre en los reportes` : ''}</span></div>
      ${sinNombre.size ? `<p class="muted" style="margin-top:10px">Sin nombre: ${[...sinNombre].sort().join(', ')}</p>` : ''}</div>`;
    $('#btnAses').onclick = () => {
      let k = 0;
      for (const l of $('#pegarAses').value.split(/\r?\n/)) {
        const p = l.split(/\t|;|,(?=\s*[A-Za-zÁÉÍÓÚÑ])/).map((x) => x.trim()).filter(Boolean);
        if (p.length >= 2) { estado.manual.asesores[p[0]] = p.slice(1).join(', '); k++; }
      }
      guardar(); pintarAses(); aviso(`${k} asesores guardados`);
    };
  }

  // ---- Objetivos
  function pintarObj() {
    const o = estado.config.objetivos, t = estado.config.tolerancia;
    const campo = (et, path, val, step = '0.1', suf = '%') => `<label>${et} <span style="display:flex;gap:4px;align-items:center"><input type="number" step="${step}" data-path="${path}" value="${val}" style="width:90px"> ${suf}</span></label>`;
    $('#sub-obj').innerHTML = `<div class="card"><h2>Objetivos</h2><p class="ayuda">Se usan en gráficos, KPIs, semáforo e insights.</p>
      <div class="fila">
        ${campo('Nivel de Servicio', 'objetivos.ns', +(o.ns * 100).toFixed(2))}
        ${campo('TMG Premium', 'objetivos.tmg.premium', o.tmg.premium, '1', 's')}
        ${campo('TMG Full Claro', 'objetivos.tmg.fullclaro', o.tmg.fullclaro, '1', 's')}
        ${campo('% Rellamada (máx.)', 'objetivos.rell', +(o.rell * 100).toFixed(2))}
        ${campo('Aprovechamiento CT', 'objetivos.ct', +(o.ct * 100).toFixed(2))}
        ${campo('Retención', 'objetivos.ret', +(o.ret * 100).toFixed(2))}
        ${campo('Adherencia franja', 'objetivos.adh', +(o.adh * 100).toFixed(2))}
      </div>
      <h3>Semáforo ámbar (tolerancia)</h3><p class="ayuda">Si el indicador no cumple pero está a esta distancia del objetivo, se marca ÁMBAR; si no, ROJO.</p>
      <div class="fila">
        ${campo('NS', 'tolerancia.ns', +(t.ns * 100).toFixed(2), '0.1', 'pp')}
        ${campo('TMG', 'tolerancia.tmg', +(t.tmg * 100).toFixed(2), '1', '% sobre obj.')}
        ${campo('Rellamada', 'tolerancia.rell', +(t.rell * 100).toFixed(2), '0.1', 'pp')}
        ${campo('CT', 'tolerancia.ct', +(t.ct * 100).toFixed(2), '0.1', 'pp')}
        ${campo('Retención', 'tolerancia.ret', +(t.ret * 100).toFixed(2), '0.1', 'pp')}
      </div></div>`;
  }
  $('#sub-obj').addEventListener('change', (e) => {
    const p = e.target.dataset.path; if (!p) return;
    const v = numOrNull(e.target.value); if (v == null) return;
    const partes = p.split('.'); let o = estado.config;
    for (let i = 0; i < partes.length - 1; i++) o = o[partes[i]];
    o[partes[partes.length - 1]] = p.startsWith('objetivos.tmg') ? v : v / 100;
    guardar(); aviso('Objetivo actualizado');
  });

  /* ------------------------------ 3. revisar ------------------------------ */
  function mesesSeleccionables() {
    const s = new Set(MDY.mesesDisponibles(estado));
    for (const c of CAMPS) Object.keys(estado.manual.retencion[c] || {}).forEach((m) => s.add(m));
    return [...s].sort().reverse();
  }
  function textoGuardado(mes, clave) {
    estado.manual.textos[mes] = estado.manual.textos[mes] || {};
    return (estado.manual.textos[mes][clave] = estado.manual.textos[mes][clave] || {});
  }

  function kpisHTML(vista, c, ind, mes) {
    const o = estado.config.objetivos;
    const k = (et, v) => `<div class="k"><span>${et}</span><b>${v}</b></div>`;
    if (ind === 'ns') { const m = MDY.opsMes(vista, c, mes); return k('NS mensual', U.pct(m && m.ns, 2)) + k('Objetivo', U.pct(o.ns, 0)); }
    if (ind === 'tmg') { const m = MDY.opsMes(vista, c, mes); return k('TMG mensual', m ? Math.round(m.tmg) + ' s' : 's/d') + k('Objetivo', o.tmg[c] + ' s'); }
    if (ind === 'rell') { const r = MDY.rellMes(vista, c, mes); return k('Rellamada mensual', U.pct(r && r.pct, 2)) + k('Objetivo', '≤ ' + U.pct(o.rell, 0)); }
    if (ind === 'ct') { const a = MDY.ctMes(vista, c, mes); return k('Aprovechamiento', a ? U.pct(a.c / a.g) : 's/d') + k('Aprov. / Generadas', a ? `${a.c} / ${a.g}` : 's/d'); }
    if (ind === 'ret') { const s = MDY.retencionSerie(vista, c, mes, 1); return k('Retención', s.length ? U.pct(s[0].ret) : 's/d') + k('Objetivo', U.pct(o.ret, 0)); }
    if (ind === 'hc') { const h = MDY.headcountResumen(vista, c); return k('Staff actual', h.operadores != null ? h.operadores + ' operadores' : 's/d') + k('Cumplimiento', h.cumpl != null ? U.pct(h.cumpl) : 's/d'); }
    return '';
  }

  function coachHTML(vista, c, ind, mes, t, clave) {
    const C = window.MDY_COACH; if (!C) return '';
    const p = C.pitch(vista, c, ind, mes, t);
    const acc = C.accionesSugeridas(vista, c, ind, mes);
    if (!p && !acc.length) return '';
    const actuales = String(t.accion || '').split('\n').map((x) => x.trim());
    const sug = acc.map((a, i) => {
      const usada = actuales.includes(a.texto);
      return `<div class="sug ${usada ? 'usada' : ''}"><div style="flex:1">${esc(a.texto)}<small>${esc(a.porque)}</small></div>
        <button class="b2" style="padding:4px 9px;font-size:12px" data-agregar="${clave}" data-i="${i}" ${usada ? 'disabled' : ''}>${usada ? '✔ En el plan' : '+ Agregar'}</button></div>`;
    }).join('');
    const pit = p ? `<div class="pitch"><b>Escenario:</b> <span class="pill ${p.color}">${esc(p.nombreEscenario)}</span>
        <div class="msg" style="margin-top:4px">${esc(p.mensaje)}</div>
        <ol>${p.pasos.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        <div class="muted"><b>Preguntas probables:</b> ${p.preguntas.map(esc).join(' · ')}</div></div>` : '';
    return `<div class="coach"><div><h4>ACCIONES SUGERIDAS</h4>${sug || '<span class="muted">Sin sugerencias para este escenario.</span>'}</div>
      <div><h4>CÓMO EXPONERLO (va en las notas del orador)</h4>${pit}</div></div>`;
  }

  function pintarRevisar() {
    const meses = mesesSeleccionables();
    const sel = $('#selMes');
    if (!estado.corte.mes || !meses.includes(estado.corte.mes)) estado.corte.mes = meses[0] || null;
    sel.innerHTML = meses.map((m) => `<option value="${m}" ${m === estado.corte.mes ? 'selected' : ''}>${U.mesLargo(m)}</option>`).join('');
    if (!estado.corte.fecha && estado.corte.mes) estado.corte.fecha = MDY.ultimaFechaDatos(estado, estado.corte.mes);
    $('#fechaCorte').value = estado.corte.fecha || '';
    const mes = estado.corte.mes;
    if (!mes) { $('#laminas').innerHTML = '<div class="aviso">Primero carga los reportes en el paso 1.</div>'; return; }
    const filtro = $('#selCamp').value;
    const vista = MDY.recortar(estado, estado.corte.fecha);
    let html = '';
    const ultimo = MDY.ultimaFechaDatos(estado, mes);
    if (estado.corte.fecha) html += `<div class="info">Se usa la información <b>hasta el ${U.ddmmyyyy(estado.corte.fecha)}</b>${ultimo && ultimo > estado.corte.fecha ? ` (hay datos cargados hasta el ${U.ddmmyyyy(ultimo)} que no se consideran)` : ''}.</div>`;
    for (const a of vista.avisosCorte || []) html += `<div class="aviso">${esc(a)}</div>`;
    // Resumen ejecutivo
    const mejoroAuto = DECK.mejorasAuto(vista, mes).join(' ');
    const mejoro = (estado.manual.resumen[mes] && estado.manual.resumen[mes].mejoro != null) ? estado.manual.resumen[mes].mejoro : mejoroAuto;
    html += `<div class="lam"><div class="cab"><div class="tit"><small>RESUMEN EJECUTIVO</small>Estado de indicadores · ${U.mesNombre(mes)}</div></div>
      <div class="cuerpo" style="grid-template-columns:1fr">
        <table class="t"><tr><th>Indicador</th>${CAMPS.map((c) => `<th class="c">${MDY.CAMPANAS[c].nombre}</th><th class="c">Estado</th>`).join('')}</tr>
        ${[['ns', 'Nivel de Servicio'], ['tmg', 'TMG'], ['rell', '% Rellamada'], ['ct', 'Oportunidades aprovechadas'], ['ret', 'Tasa de retención']].map(([id, n]) => `<tr><td><b>${n}</b></td>${CAMPS.map((c) => {
          const v = MDY.valorIndicador(vista, c, id, mes); const t = MDY.textosLamina(vista, mes, c, id); const auto = MDY.semaforo(id, v, estado, c);
          return `<td class="c">${v == null ? 's/d' : id === 'tmg' ? Math.round(v) : U.pct(v)}</td><td class="c"><select data-sem="${c}.${id}"><option value="">Auto${auto ? ': ' + auto : ''}</option>${['VERDE', 'AMBAR', 'ROJO'].map((s) => `<option ${t.semaforo === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td>`;
        }).join('')}</tr>`).join('')}</table>
        <div class="campo" style="margin-top:12px"><div class="et">LO QUE SÍ MEJORÓ ESTA SEMANA <button class="mini" data-restaurar-mejoro>↺ usar sugerencia automática</button></div>
        <textarea data-mejoro rows="2">${esc(mejoro)}</textarea></div></div></div>`;

    for (const c of CAMPS) {
      if (filtro !== 'todas' && filtro !== c) continue;
      for (const ind of MDY.INDICADORES) {
        const t = MDY.textosLamina(vista, mes, c, ind.id);
        const clave = `${c}.${ind.id}`;
        const datos = ind.id === 'nsdiario' ? MDY.opsDiasMes(vista, c, mes).length > 0 : ind.id === 'ctdet' ? !!MDY.ctMes(vista, c, mes) : DECK.tieneDatos(vista, mes, c, ind.id);
        const v = MDY.valorIndicador(vista, c, ind.id, mes);
        const sem = t.semaforo || MDY.semaforo(ind.id, v, estado, c);
        const cab = `<div class="cab"><div class="tit"><small>${MDY.CAMPANAS[c].kicker}</small>${ind.nombre} ${sem ? `<span class="pill ${sem}">${sem}</span>` : ''}</div>
          <label class="check"><input type="checkbox" data-incluir="${clave}" ${t.incluir ? 'checked' : ''} ${datos ? '' : 'disabled'}> Incluir lámina</label></div>`;
        if (!datos) {
          const falta = { ns: 'el reporte de operación', tmg: 'el reporte de operación', nsdiario: 'el reporte diario de operación', rell: 'el reporte de rellamadas', ct: 'el reporte de oportunidades', ctdet: 'el reporte de oportunidades', ret: 'el registro manual de retención', hc: 'el registro manual de headcount' }[ind.id];
          html += `<div class="lam">${cab}<div class="cuerpo" style="grid-template-columns:1fr"><span class="muted">Sin datos para ${U.mesLargo(mes)}: falta ${falta}. La lámina no se generará.</span></div></div>`;
          continue;
        }
        if (ind.sinTextos) { html += `<div class="lam">${cab}<div class="cuerpo" style="grid-template-columns:1fr"><span class="muted">Lámina automática (gráfico + tabla), no requiere textos.</span></div></div>`; continue; }
        const area = (campo, et, val, edit, filas = 4) => `<div class="campo"><div class="et">${et} ${edit ? `<button class="mini" data-restaurar="${clave}" data-campo="${campo}">↺ usar sugerencia automática</button>` : (campo === 'origen' || campo === 'resultado' ? '<em>sugerencia automática</em>' : '')}</div>
          <textarea data-texto="${clave}" data-campo="${campo}" rows="${filas}">${esc(val)}</textarea></div>`;
        html += `<div class="lam">${cab}<div class="cuerpo"><div class="kpis">${kpisHTML(vista, c, ind.id, mes)}</div><div>
          ${area('origen', 'ORIGEN', t.origen, t.editado.origen, 5)}
          ${ind.id === 'ret' ? area('deteccion', 'DETECCIÓN', t.deteccion, false, 3) : ''}
          ${area('accion', 'ACCIÓN <em>(una por línea · se copia del mes anterior)</em>', t.accion, false, 4)}
          ${area('resultado', 'RESULTADO', t.resultado, t.editado.resultado, 4)}
          <div class="campo"><div class="et">CIERRE DE LÁMINA <em>(opcional)</em></div><div class="cierre-row">
            <select data-texto="${clave}" data-campo="cierreTipo">${['PARCIAL', 'REPLANTEAMIENTO', 'IMPACTO', 'PROYECCIÓN', 'LOGRO'].map((x) => `<option ${x === t.cierreTipo ? 'selected' : ''}>${x}</option>`).join('')}</select>
            <input type="text" data-texto="${clave}" data-campo="cierreTexto" value="${esc(t.cierreTexto)}" placeholder="Conclusión de la semana para esta lámina"></div></div>
        </div>${coachHTML(vista, c, ind.id, mes, t, clave)}</div></div>`;
      }
    }
    $('#laminas').innerHTML = html;
  }
  $('#selMes').addEventListener('change', (e) => { estado.corte.mes = e.target.value; estado.corte.fecha = MDY.ultimaFechaDatos(estado, estado.corte.mes) || estado.corte.fecha; guardar(); pintarRevisar(); });
  $('#fechaCorte').addEventListener('change', (e) => {
    estado.corte.fecha = e.target.value || null;
    if (estado.corte.fecha && estado.corte.fecha.slice(0, 7) !== estado.corte.mes && mesesSeleccionables().includes(estado.corte.fecha.slice(0, 7))) estado.corte.mes = estado.corte.fecha.slice(0, 7);
    guardar(); pintarRevisar();
  });
  $('#selCamp').addEventListener('change', pintarRevisar);
  $('#laminas').addEventListener('input', (e) => {
    const mes = estado.corte.mes;
    if (e.target.dataset.texto) { textoGuardado(mes, e.target.dataset.texto)[e.target.dataset.campo] = e.target.value; guardar(); }
    if (e.target.hasAttribute('data-mejoro')) { estado.manual.resumen[mes] = { mejoro: e.target.value }; guardar(); }
  });
  $('#laminas').addEventListener('change', (e) => {
    const mes = estado.corte.mes;
    if (e.target.dataset.incluir) { textoGuardado(mes, e.target.dataset.incluir).incluir = e.target.checked; guardar(); }
    if (e.target.dataset.sem) { textoGuardado(mes, e.target.dataset.sem).semaforo = e.target.value || null; guardar(); pintarRevisar(); }
  });
  $('#laminas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-restaurar]');
    if (b) { delete textoGuardado(estado.corte.mes, b.dataset.restaurar)[b.dataset.campo]; guardar(); pintarRevisar(); return; }
    if (e.target.closest('[data-restaurar-mejoro]')) { delete estado.manual.resumen[estado.corte.mes]; guardar(); pintarRevisar(); return; }
    const ag = e.target.closest('[data-agregar]');
    if (ag) {
      const [c, ind] = ag.dataset.agregar.split('.');
      const vista = MDY.recortar(estado, estado.corte.fecha);
      const a = window.MDY_COACH.accionesSugeridas(vista, c, ind, estado.corte.mes)[+ag.dataset.i];
      const t = MDY.textosLamina(estado, estado.corte.mes, c, ind);
      const g = textoGuardado(estado.corte.mes, ag.dataset.agregar);
      g.accion = [String(t.accion || '').trim(), a.texto].filter(Boolean).join('\n');
      guardar(); pintarRevisar(); aviso('Acción agregada al plan');
    }
  });

  /* ------------------------------ 4. descargar ------------------------------ */
  function pintarDescargar() {
    const mes = estado.corte.mes || mesesSeleccionables()[0];
    $('#resumenGen').innerHTML = mes ? `Mes: <b>${U.mesLargo(mes)}</b> · Actualizado al <b>${estado.corte.fecha ? U.ddmmyyyy(estado.corte.fecha) : '—'}</b>` : '<span class="falta">Primero carga los reportes en el paso 1.</span>';
    $('#proxCorte').value = estado.corte.proxCorte || '';
  }
  $('#proxCorte').addEventListener('input', (e) => { estado.corte.proxCorte = e.target.value; guardar(); });

  $('#btnGenerar').addEventListener('click', async () => {
    const mes = estado.corte.mes || mesesSeleccionables()[0];
    if (!mes) { aviso('Primero carga los reportes'); return; }
    const secciones = {}; $$('[data-sec]').forEach((x) => (secciones[x.dataset.sec] = x.checked));
    const btn = $('#btnGenerar'); btn.disabled = true; btn.textContent = 'Generando…';
    try {
      const pptx = DECK.generar(window.PptxGenJS, MDY.recortar(estado, estado.corte.fecha), { notas: $('#chkNotas').checked, mes, fechaCorte: estado.corte.fecha, assets: window.MDY_ASSETS || {}, proxCorte: estado.corte.proxCorte, secciones });
      const buf = await pptx.write({ outputType: 'arraybuffer' });
      // Re-empaquetar sin entradas de carpeta (mejor compatibilidad con OneDrive/SharePoint)
      const zin = await JSZip.loadAsync(buf), zout = new JSZip();
      const nombres = Object.keys(zin.files).filter((n) => !zin.files[n].dir);
      for (const n of nombres) zout.file(n, await zin.files[n].async('uint8array'), { createFolders: false });
      const blob = await zout.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
      const f = estado.corte.fecha ? estado.corte.fecha.split('-').reverse().slice(0, 2).join('.') : U.mesLabel(mes);
      descargar(blob, `PRESENTACION_MDY_${f}.pptx`);
      aviso('Presentación descargada');
    } catch (e) { console.error(e); aviso('Error al generar: ' + e.message); }
    btn.disabled = false; btn.textContent = '⬇ Descargar PPT';
  });
  $('#btnGuion').addEventListener('click', () => {
    const mes = estado.corte.mes || mesesSeleccionables()[0];
    if (!mes) { aviso('Primero carga los reportes'); return; }
    const html = window.MDY_COACH.guionHTML(MDY.recortar(estado, estado.corte.fecha), mes, estado.corte.fecha, window.PULSO_CREDITOS);
    const f = estado.corte.fecha ? estado.corte.fecha.split('-').reverse().slice(0, 2).join('.') : U.mesLabel(mes);
    descargar(new Blob([html], { type: 'text/html' }), `GUION_EXPOSICION_${f}.html`);
    aviso('Guion descargado (ábrelo en el navegador o imprímelo en PDF)');
  });
  function descargar(blob, nombre) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  $('#btnExportar').addEventListener('click', () => {
    descargar(new Blob([JSON.stringify(estado)], { type: 'application/json' }), `respaldo_mdy_${new Date().toISOString().slice(0, 10)}.json`);
  });
  $('#btnImportar').addEventListener('click', () => $('#archivoRespaldo').click());
  $('#archivoRespaldo').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((t) => { estado = fusionar(MDY.estadoVacio(), JSON.parse(t)); guardar(); pintarTodo(); aviso('Respaldo restaurado'); })
      .catch((er) => aviso('Respaldo inválido: ' + er.message));
    e.target.value = '';
  });
  $('#btnBorrar').addEventListener('click', () => {
    if (!confirm('Se borrarán TODOS los datos cargados y registros manuales de este navegador. ¿Continuar? (Te recomendamos descargar un respaldo antes)')) return;
    estado = MDY.estadoVacio(); localStorage.removeItem(CLAVE); pintarTodo(); aviso('Datos borrados');
  });

  function pintarTodo() { pintarCarga(); pintarManual(); }

  /* ------------------------------ créditos y apertura ------------------------------ */
  const CR = window.PULSO_CREDITOS || { app: 'Pulso CX', version: '', autor: '', cargo: '' };
  const firma = `Desarrollado por <b>${esc(CR.autor)}</b>${CR.cargo ? ' · ' + esc(CR.cargo) : ''}`;
  $('#splashCred').innerHTML = firma;
  $('#creditos').innerHTML = `${esc(CR.app)} ${CR.version ? 'v' + esc(CR.version) : ''} · ${firma} · © ${new Date().getFullYear()}`;
  const splash = $('#splash');
  const cerrarSplash = () => { splash.classList.add('fuera'); setTimeout(() => splash.remove(), 700); };
  splash.addEventListener('click', cerrarSplash);
  setTimeout(cerrarSplash, matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 3300);
  cargarEstado();
  pintarTodo();
  // expuesto para pruebas
  window.__mdy = { get estado() { return estado; } };
})();
