'use strict';

const fs = require('fs');
const path = require('path');
const { app, dialog, BrowserWindow } = require('electron');

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------- CSV ----------------
function toCSV(secciones) {
  const q = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [];
  for (const sec of secciones) {
    if (sec.titulo) lineas.push(q(sec.titulo));
    if (sec.encabezados) lineas.push(sec.encabezados.map(q).join(','));
    for (const fila of sec.filas || []) lineas.push(fila.map(q).join(','));
    lineas.push('');
  }
  return '﻿' + lineas.join('\r\n'); // BOM para que Excel lea acentos
}

// ---------------- HTML para PDF ----------------
function tablaHTML(encabezados, filas) {
  return `<table><thead><tr>${encabezados.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function documentoHTML(titulo, subtitulo, cuerpoHTML) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { font-family: "Segoe UI", Arial, sans-serif; }
    body { margin: 32px; color: #1a1a1a; }
    h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: .06em; }
    .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
    h2 { font-size: 14px; margin: 22px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-bottom: 8px; }
    th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid #e3ddd2; }
    th { background: #f4f1ec; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
    td.n, th.n { text-align: right; }
    .kpis { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0; }
    .kpi { border: 1px solid #e3ddd2; border-radius: 8px; padding: 10px 14px; min-width: 130px; }
    .kpi .k { font-size: 10px; color: #666; text-transform: uppercase; }
    .kpi .v { font-size: 16px; font-weight: 700; margin-top: 2px; }
    .foot { margin-top: 24px; font-size: 10px; color: #999; }
  </style></head><body>
    <h1>BESO DE CAFÉ</h1>
    <div class="sub">${esc(subtitulo)}</div>
    <h2 style="border:none;font-size:16px">${esc(titulo)}</h2>
    ${cuerpoHTML}
    <div class="foot">Generado el ${new Date().toLocaleString('es-MX')}</div>
  </body></html>`;
}

// ---------------- Armado por reporte ----------------
function armar(tipo, data) {
  const periodo = `Periodo: ${data.desde} a ${data.hasta}`;
  if (tipo === 'resumen') {
    const kpis = [
      ['Ventas', data.ventas], ['Ingreso neto', money(data.ingreso_neto)],
      ['Costo (inversión)', money(data.costo)], ['Ganancia', money(data.ganancia)],
      ['Margen', data.margen + '%'], ['Ticket promedio', money(data.ticket_promedio)],
      ['Efectivo', money(data.por_metodo.efectivo)], ['Transferencia', money(data.por_metodo.transferencia)],
      ['Costo de merma', money(data.merma_costo)],
    ];
    const csv = [
      { titulo: 'Resumen de ganancias — ' + periodo, encabezados: ['Concepto', 'Valor'], filas: [
        ['Ventas', data.ventas], ['Ingreso bruto', data.ingreso_bruto], ['Descuentos', data.descuentos],
        ['Ingreso neto', data.ingreso_neto], ['Costo (inversión)', data.costo], ['Ganancia', data.ganancia],
        ['Margen %', data.margen], ['Ticket promedio', data.ticket_promedio],
        ['Efectivo', data.por_metodo.efectivo], ['Transferencia', data.por_metodo.transferencia],
        ['Costo de merma', data.merma_costo],
      ] },
      { titulo: 'Por día', encabezados: ['Fecha', 'Ventas', 'Ingreso neto', 'Costo', 'Ganancia'],
        filas: data.por_dia.map((d) => [d.fecha, d.ventas, d.ingreso_neto, d.costo, d.ganancia]) },
    ];
    const html = `<div class="kpis">${kpis.map(([k, v]) => `<div class="kpi"><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
      <h2>Por día</h2>${tablaHTML(['Fecha', 'Ventas', 'Ingreso neto', 'Costo', 'Ganancia'],
        data.por_dia.map((d) => [d.fecha, d.ventas, money(d.ingreso_neto), money(d.costo), money(d.ganancia)]))}`;
    return { titulo: 'Resumen de ganancias', periodo, csv, html };
  }
  if (tipo === 'productos') {
    const enc = ['Producto', 'Unidades', 'Ingreso', 'Inversión (costo)', 'Ganancia', 'Margen %'];
    const filas = data.filas.map((p) => [p.producto, p.unidades, p.ingreso_neto, p.costo, p.ganancia, p.margen]);
    filas.push(['TOTAL', data.total.unidades, data.total.ingreso_neto, data.total.costo, data.total.ganancia, data.total.margen]);
    const html = tablaHTML(enc, data.filas.map((p) => [p.producto, p.unidades, money(p.ingreso_neto), money(p.costo), money(p.ganancia), p.margen + '%'])
      .concat([['TOTAL', data.total.unidades, money(data.total.ingreso_neto), money(data.total.costo), money(data.total.ganancia), data.total.margen + '%']]));
    return { titulo: 'Ganancias por producto', periodo, csv: [{ titulo: 'Ganancias por producto — ' + periodo, encabezados: enc, filas }], html };
  }
  if (tipo === 'insumos') {
    const enc = ['Insumo', 'Cantidad usada', 'Unidad', 'Costo'];
    const filas = data.filas.map((r) => [r.nombre, r.cantidad, r.unidad_base, r.costo]);
    filas.push(['TOTAL', '', '', data.total_costo]);
    return {
      titulo: 'Insumos más usados', periodo,
      csv: [{ titulo: 'Insumos más usados — ' + periodo, encabezados: enc, filas }],
      html: tablaHTML(enc, data.filas.map((r) => [r.nombre, r.cantidad, r.unidad_base, money(r.costo)]).concat([['TOTAL', '', '', money(data.total_costo)]])),
    };
  }
  if (tipo === 'inversion') {
    const encP = ['Insumo', 'Cantidad', 'Unidad', 'Costo'];
    const encT = ['Insumo', 'Cantidad total', 'Unidad', 'Costo total'];
    const csv = [];
    let htmlProd = '';
    for (const p of data.productos) {
      csv.push({
        titulo: `${p.producto}  (${p.unidades} vendido/s) — inversión ${p.costo}`,
        encabezados: encP,
        filas: p.insumos.map((i) => [i.nombre, i.cantidad, i.unidad_base, i.costo]),
      });
      htmlProd += `<h2>${esc(p.producto)} <span style="font-weight:400;color:#666">· ${p.unidades} vendido/s · inversión ${money(p.costo)}</span></h2>` +
        tablaHTML(encP, p.insumos.map((i) => [i.nombre, i.cantidad, i.unidad_base, money(i.costo)]));
    }
    csv.push({
      titulo: `TOTAL POR INSUMO — inversión total ${data.total_costo}`,
      encabezados: encT,
      filas: data.total_insumos.map((t) => [t.nombre, t.cantidad, t.unidad_base, t.costo])
        .concat([['INVERSIÓN TOTAL', '', '', data.total_costo]]),
    });
    const htmlTotal = `<h2 style="border-top:2px solid #999;padding-top:8px">Total por insumo (todo el periodo)</h2>` +
      tablaHTML(encT, data.total_insumos.map((t) => [t.nombre, t.cantidad, t.unidad_base, money(t.costo)])
        .concat([['INVERSIÓN TOTAL', '', '', money(data.total_costo)]]));
    return {
      titulo: 'Desglose de inversión por producto',
      periodo,
      csv: csv.length ? csv : [{ titulo: 'Sin ventas en el periodo — ' + periodo, encabezados: [], filas: [] }],
      html: (htmlProd || '<p>Sin ventas en el periodo.</p>') + htmlTotal,
    };
  }
  // merma
  const enc = ['Insumo', 'Cantidad', 'Unidad', 'Costo'];
  return {
    titulo: 'Costo de merma', periodo,
    csv: [
      { titulo: 'Merma por insumo — ' + periodo, encabezados: enc, filas: data.por_insumo.map((r) => [r.nombre, r.cantidad, r.unidad_base, r.costo]).concat([['TOTAL', '', '', data.total_costo]]) },
      { titulo: 'Merma por motivo', encabezados: ['Motivo', 'Eventos', 'Costo'], filas: data.por_motivo.map((r) => [r.motivo, r.eventos, r.costo]) },
    ],
    html: `${tablaHTML(enc, data.por_insumo.map((r) => [r.nombre, r.cantidad, r.unidad_base, money(r.costo)]).concat([['TOTAL', '', '', money(data.total_costo)]]))}
      <h2>Por motivo</h2>${tablaHTML(['Motivo', 'Eventos', 'Costo'], data.por_motivo.map((r) => [r.motivo, r.eventos, money(r.costo)]))}`,
  };
}

// Una sola ventana oculta reutilizable para generar PDFs (más estable que crear una cada vez).
let pdfWin = null;
function getPdfWin() {
  if (pdfWin && !pdfWin.isDestroyed()) return pdfWin;
  pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false, images: false, offscreen: false },
  });
  pdfWin.on('closed', () => { pdfWin = null; });
  return pdfWin;
}

async function htmlToPDF(html) {
  const dataUrl = 'data:text/html;charset=utf-8;base64,' + Buffer.from(html, 'utf8').toString('base64');
  const opts = { printBackground: true, pageSize: 'Letter', margins: { marginType: 'default' } };
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const win = getPdfWin();
      await win.loadURL(dataUrl);
      return await win.webContents.printToPDF(opts);
    } catch (err) {
      if (pdfWin && !pdfWin.isDestroyed()) pdfWin.destroy();
      pdfWin = null;
      if (intento === 2) throw new Error('No se pudo generar el PDF: ' + err.message);
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}

async function exportar({ formato, tipo, data }) {
  const armado = armar(tipo, data);
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const stamp = `${data.desde}_a_${data.hasta}`;
  const baseName = `${tipo}_${stamp}`;

  if (formato === 'csv') {
    const res = await dialog.showSaveDialog(win, {
      title: 'Guardar reporte (Excel/CSV)',
      defaultPath: path.join(app.getPath('documents'), baseName + '.csv'),
      filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }],
    });
    if (res.canceled || !res.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(res.filePath, toCSV(armado.csv), 'utf8');
    return { ok: true, path: res.filePath };
  }

  // PDF vía ventana oculta + printToPDF
  const res = await dialog.showSaveDialog(win, {
    title: 'Guardar reporte (PDF)',
    defaultPath: path.join(app.getPath('documents'), baseName + '.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };

  const html = documentoHTML(armado.titulo, armado.periodo, armado.html);
  const pdf = await htmlToPDF(html);
  fs.writeFileSync(res.filePath, pdf);
  return { ok: true, path: res.filePath };
}

module.exports = { exportar };
