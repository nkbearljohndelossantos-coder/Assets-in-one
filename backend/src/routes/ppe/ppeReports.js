const express = require('express');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const db = require('../../config/db');
const { authenticateToken } = require('../../middleware/auth');
const { calcStraightLine, money } = require('../../utils/depreciation');

const ppeReportsRouter = express.Router();

async function fetchAssetsFiltered({ category, month, year }) {
  let query = db('ppe_assets')
    .whereNull('deleted_at');

  if (category) {
    query = query.where('category_name', category);
  }
  if (year) {
    query = query.whereRaw("strftime('%Y', purchase_date) = ?", [String(year)]);
  }
  if (month) {
    const mo = String(month).padStart(2, '0');
    query = query.whereRaw("strftime('%m', purchase_date) = ?", [mo]);
  }

  return await query.orderBy('category_name', 'asc').orderBy('asset_name', 'asc');
}

function decorateWithDepreciation(assets, asOf) {
  return assets.map((a) => {
    const d = calcStraightLine({
      acquisitionCost: a.acquisition_cost,
      salvageValue: a.salvage_value,
      usefulLifeYears: a.useful_life_years,
      purchaseDate: a.purchase_date,
      asOfDate: asOf,
    });
    return { ...a, depreciation: d };
  });
}

// 1. EXCEL ASSETS REPORT
ppeReportsRouter.get('/assets.xlsx', authenticateToken, async (req, res, next) => {
  try {
    const category = req.query.category ? String(req.query.category) : null;
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;
    const asOf = req.query.asOf ? String(req.query.asOf) : new Date().toISOString().slice(0, 10);

    const assets = await fetchAssetsFiltered({ category, month, year });
    const rows = decorateWithDepreciation(assets, asOf);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NKB Unified ITMS & PPE System';
    wb.created = new Date();
    const ws = wb.addWorksheet('PPE Assets & Valuation');

    ws.columns = [
      { header: 'Room ID', key: 'room_id', width: 14 },
      { header: 'Room Name', key: 'room_name', width: 20 },
      { header: 'Asset Code', key: 'asset_code', width: 18 },
      { header: 'Asset Name', key: 'asset_name', width: 28 },
      { header: 'GL Account', key: 'gl_account', width: 18 },
      { header: 'Category', key: 'category_name', width: 18 },
      { header: 'Serial Number', key: 'serial_number', width: 18 },
      { header: 'Acquisition Date', key: 'purchase_date', width: 15 },
      { header: 'Acquisition Cost', key: 'acquisition_cost', width: 16 },
      { header: 'Useful Life (Yrs)', key: 'useful_life_years', width: 16 },
      { header: 'Salvage Value', key: 'salvage_value', width: 16 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Assigned To', key: 'assigned_to', width: 20 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Annual Dep.', key: 'annual_dep', width: 16 },
      { header: 'Monthly Dep.', key: 'monthly_dep', width: 16 },
      { header: 'Accumulated Dep.', key: 'accum_dep', width: 18 },
      { header: 'Net Book Value', key: 'net_book_value', width: 18 },
    ];

    // Style Header Row
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' } // Navy blue
    };

    let totalCost = 0;
    let totalDep = 0;
    let totalNBV = 0;

    for (const r of rows) {
      const cost = Number(r.acquisition_cost) || 0;
      const accum = r.depreciation.accumulatedDepreciation;
      const nbv = r.depreciation.netBookValue;
      totalCost += cost;
      totalDep += accum;
      totalNBV += nbv;

      const row = ws.addRow({
        room_id: r.room_id || 'N/A',
        room_name: r.room_name || 'N/A',
        asset_code: r.asset_code,
        asset_name: r.asset_name,
        gl_account: r.gl_account || '1500',
        category_name: r.category_name,
        serial_number: r.serial_number || 'N/A',
        purchase_date: r.purchase_date,
        acquisition_cost: cost,
        useful_life_years: r.useful_life_years,
        salvage_value: Number(r.salvage_value) || 0,
        status: r.status,
        assigned_to: r.assigned_to || 'Unassigned',
        location: r.location || 'N/A',
        annual_dep: r.depreciation.annualDepreciation,
        monthly_dep: r.depreciation.monthlyDepreciation,
        accum_dep: accum,
        net_book_value: nbv,
      });

      // Number formatting
      row.getCell('acquisition_cost').numFmt = '#,##0.00';
      row.getCell('salvage_value').numFmt = '#,##0.00';
      row.getCell('annual_dep').numFmt = '#,##0.00';
      row.getCell('monthly_dep').numFmt = '#,##0.00';
      row.getCell('accum_dep').numFmt = '#,##0.00';
      row.getCell('net_book_value').numFmt = '#,##0.00';
    }

    // Add totals summary row
    const totalRow = ws.addRow({
      room_id: 'TOTALS',
      asset_name: `${rows.length} Asset(s)`,
      acquisition_cost: totalCost,
      accum_dep: totalDep,
      net_book_value: totalNBV
    });
    totalRow.font = { bold: true };
    totalRow.getCell('acquisition_cost').numFmt = '#,##0.00';
    totalRow.getCell('accum_dep').numFmt = '#,##0.00';
    totalRow.getCell('net_book_value').numFmt = '#,##0.00';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ppe-assets-valuation-${asOf}.xlsx"`);
    await wb.xlsx.write(res);
    return res.end();
  } catch (err) {
    return next(err);
  }
});

// 2. PDF ASSETS REPORT
ppeReportsRouter.get('/assets.pdf', authenticateToken, async (req, res, next) => {
  try {
    const category = req.query.category ? String(req.query.category) : null;
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;
    const asOf = req.query.asOf ? String(req.query.asOf) : new Date().toISOString().slice(0, 10);

    const assets = await fetchAssetsFiltered({ category, month, year });
    const rows = decorateWithDepreciation(assets, asOf);

    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="ppe-report-${asOf}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).font('Helvetica-Bold').text('NKB Manufacturing - PPE Asset & Valuation Report', { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(`As of Date: ${asOf} | Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    let totalCost = 0;
    let totalDep = 0;
    let totalNBV = 0;

    for (const r of rows) {
      totalCost += Number(r.acquisition_cost) || 0;
      totalDep += r.depreciation.accumulatedDepreciation;
      totalNBV += r.depreciation.netBookValue;
    }

    doc.fontSize(11).font('Helvetica-Bold').text(`Total Assets: ${rows.length}   |   Total Acquisition Cost: PHP ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}   |   Total Net Book Value: PHP ${totalNBV.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    doc.moveDown(1);

    // Table Header
    const colX = [36, 120, 240, 340, 420, 490, 570, 660, 740];
    const headers = ['Code', 'Name', 'Category', 'Acq. Date', 'Cost', 'Accum. Dep.', 'Net Book Val.', 'Status', 'Assigned To'];

    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, colX[i], doc.y, { width: 85 });
    });
    doc.moveDown(0.5);
    doc.moveTo(36, doc.y).lineTo(800, doc.y).stroke('#CBD5E1');
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(8);
    for (const a of rows.slice(0, 100)) {
      if (doc.y > 540) {
        doc.addPage({ margin: 36, size: 'A4', layout: 'landscape' });
        doc.fontSize(9).font('Helvetica-Bold');
        headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: 85 }));
        doc.moveDown(0.5);
        doc.moveTo(36, doc.y).lineTo(800, doc.y).stroke('#CBD5E1');
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(8);
      }

      const y = doc.y;
      doc.text(a.asset_code || '', colX[0], y, { width: 80, ellipsis: true });
      doc.text(a.asset_name || '', colX[1], y, { width: 115, ellipsis: true });
      doc.text(a.category_name || '', colX[2], y, { width: 95, ellipsis: true });
      doc.text(String(a.purchase_date || ''), colX[3], y, { width: 75 });
      doc.text(Number(a.acquisition_cost).toFixed(2), colX[4], y, { width: 65, align: 'right' });
      doc.text(a.depreciation.accumulatedDepreciation.toFixed(2), colX[5], y, { width: 75, align: 'right' });
      doc.text(a.depreciation.netBookValue.toFixed(2), colX[6], y, { width: 85, align: 'right' });
      doc.text(a.status || '', colX[7], y, { width: 75 });
      doc.text(a.assigned_to || 'Unassigned', colX[8], y, { width: 80, ellipsis: true });
      doc.moveDown(0.6);
    }

    doc.end();
  } catch (err) {
    return next(err);
  }
});

module.exports = { ppeReportsRouter };
