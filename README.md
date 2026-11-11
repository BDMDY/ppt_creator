# MDY Presentaciones

Herramienta para armar la presentación semanal de indicadores de **MDY Customer Experience** (Premium y Full Claro) con el estilo de siempre: portada, resumen ejecutivo con semáforo, láminas por indicador (Origen / Acción / Resultado), headcount, compromisos, casos operativos y cierre.

**Es un solo archivo:** `dist/MDY_Presentaciones.html`. Se abre con doble clic en Chrome o Edge, no necesita instalación, internet ni Claude. Los datos no salen de tu computadora.

## Uso semanal (≈ 15 minutos)

1. **Cargar datos** — arrastra los reportes de la semana (puedes soltar todos juntos):
   | Reporte | Cómo lo reconoce |
   |---|---|
   | Operación mensual (Premium / Full Claro) | Columna `Periodo` + `NS` |
   | Operación diaria del mes en curso | Columna `Fecha` + `NS` |
   | Rellamadas (mes cerrado y mes en curso) | Columna `FECHA - Día` + `Rellamadas` |
   | Oportunidades CT (`OPORTUNIDADES_FC_PREMIUM_MDY_…`) | Hoja `BASE` (detalle por interacción) |

   La campaña y el periodo se leen de la nota **"Filtros aplicados"** al pie de cada reporte. Cada carga actualiza el histórico (los meses anteriores se conservan).
2. **Registro manual** — lo que solo tú conoces:
   - **Headcount:** foto actual (operadores, FTEs, dimensionado, cobertura por turno) y movimientos como línea de tiempo (ingresos, ceses, traslados, cambios de turno).
   - **Retención:** % de retención y cancelación de cada mes (lo que comparte el cliente).
   - **Compromisos**, **Casos operativos**, **Asesores** (código → nombre) y **Objetivos**.
3. **Revisar láminas** — Origen y Resultado vienen redactados automáticamente desde los datos (desviaciones, tendencias, días críticos, cruces entre indicadores, brechas por asesor y por franja). Edítalos con tu criterio; la Acción se arrastra del mes anterior. Puedes forzar el semáforo y apagar láminas.
4. **Descargar PPT** — genera el `.pptx` editable (gráficos nativos de PowerPoint).

> Los datos se guardan en el navegador. Usa **Descargar respaldo** de vez en cuando y **Restaurar respaldo** si cambias de computadora o se limpia el navegador.

## Cálculos

- **Semanas:** días 1–7, 8–14, 15–21, 22–28 y 29–fin de mes, **ponderadas por volumen** (no promedio simple de porcentajes).
- **NS** = atendidas en umbral / recibidas · **TMG** semanal ponderado por llamadas atendidas · **Rellamada** = rellamadas / atendidas · **Aprovechamiento CT** = oportunidades cumplidas / generadas.
- **Semáforo:** verde si cumple el objetivo, ámbar si está dentro de la tolerancia configurada, rojo en otro caso.

## Para desarrolladores

```bash
npm install          # pptxgenjs + xlsx (se incrustan en el HTML)
node build.js        # genera dist/MDY_Presentaciones.html
node test/generar.js salida.pptx <reportes.xlsx...>   # prueba sin navegador
node test/e2e.js <carpeta> <reportes.xlsx...>          # prueba completa en Chromium (Playwright)
```

- `src/core.js` — lectura de reportes, cálculos, semáforo e insights.
- `src/deck.js` — generación del PPT (estilo MDY).
- `src/app.js`, `src/index.html`, `src/styles.css` — interfaz.
- `assets/` — imágenes de portada, separador, cierre y logos.

Los reportes con datos reales **no** se versionan (ver `.gitignore`).
