/**
 * Universal Printable Property Asset Tag Sticker Generator
 * Standardized 70mm x 40mm High-Visibility Asset Tag with Assignee / Owner
 * Formatted for NKB Manufacturing Corp. Unified ITMS + PPE System
 */
import QRCode from 'qrcode';

export function getAssetOwnerText(asset, assignment) {
  if (!asset) return 'UNASSIGNED / IN STORAGE';

  // 1. Explicit active assignment passed
  if (assignment?.employee_name && String(assignment.employee_name).trim()) {
    const dept = assignment.department_name ? ` (${assignment.department_name})` : '';
    return `${String(assignment.employee_name).trim()}${dept}`.toUpperCase();
  }
  if (assignment?.department_name && String(assignment.department_name).trim()) {
    return `${String(assignment.department_name).trim()} (DEPT)`.toUpperCase();
  }

  // 2. Direct employee name on asset
  if (asset.employee_name && String(asset.employee_name).trim()) {
    const dept = asset.department_name ? ` (${asset.department_name})` : '';
    return `${String(asset.employee_name).trim()}${dept}`.toUpperCase();
  }
  if (asset.assigned_to_name && String(asset.assigned_to_name).trim()) {
    return String(asset.assigned_to_name).trim().toUpperCase();
  }
  if (asset.assigned_to && String(asset.assigned_to).trim()) {
    return String(asset.assigned_to).trim().toUpperCase();
  }
  if (asset.assigned_employee_name && String(asset.assigned_employee_name).trim()) {
    return String(asset.assigned_employee_name).trim().toUpperCase();
  }
  if (asset.current_holder && String(asset.current_holder).trim()) {
    return String(asset.current_holder).trim().toUpperCase();
  }
  if (asset.custodian_name && String(asset.custodian_name).trim()) {
    return String(asset.custodian_name).trim().toUpperCase();
  }
  if (asset.issued_to_name && String(asset.issued_to_name).trim()) {
    return String(asset.issued_to_name).trim().toUpperCase();
  }

  // 3. Combined first + last name
  if (asset.first_name || asset.last_name) {
    const fullName = `${asset.first_name || ''} ${asset.last_name || ''}`.trim();
    if (fullName) {
      const dept = asset.department_name ? ` (${asset.department_name})` : '';
      return `${fullName}${dept}`.toUpperCase();
    }
  }

  // 4. Department only
  if (asset.department_name && String(asset.department_name).trim()) {
    return `${String(asset.department_name).trim()} (DEPT)`.toUpperCase();
  }

  // 5. String location like "Assigned to Sharmaine Santos"
  if (asset.current_location && String(asset.current_location).toLowerCase().startsWith('assigned to ')) {
    return String(asset.current_location).substring(12).trim().toUpperCase();
  }

  return 'UNASSIGNED / IN STORAGE';
}

export function getAssetModelText(asset) {
  if (!asset) return '';
  const brand = asset.brand || '';
  const model = asset.model || '';
  if (brand && model) return `${brand} ${model}`;
  return model || brand || '';
}

export function getAssetSpecsText(asset) {
  if (!asset) return '';

  // Radio specs
  if (asset.radio_frequency_band || asset.radio_channel_count || asset.call_sign) {
    const radioSpecs = [
      asset.radio_frequency_band && `Freq: ${asset.radio_frequency_band}`,
      asset.radio_channel_count && `Channels: ${asset.radio_channel_count}`,
      asset.radio_power_output && `Power: ${asset.radio_power_output}`,
      asset.call_sign && `Callsign: ${asset.call_sign}`
    ].filter(Boolean);
    if (radioSpecs.length > 0) return radioSpecs.join(' | ');
  }

  // IT hardware specs
  const hardwareSpecs = [
    asset.specs_cpu && `CPU: ${asset.specs_cpu}`,
    asset.specs_ram && `RAM: ${asset.specs_ram}`,
    asset.specs_storage && `Storage: ${asset.specs_storage}`,
    (asset.specs_os || asset.specs_win_edition) && `OS: ${asset.specs_os || ''} ${asset.specs_win_edition || ''}`.trim()
  ].filter(Boolean);

  if (hardwareSpecs.length > 0) {
    return hardwareSpecs.join(' | ');
  }

  // PPE / Equipment specs
  const ppeSpecs = [
    asset.size && `Size: ${asset.size}`,
    asset.color && `Color: ${asset.color}`,
    asset.standard_compliance && `Std: ${asset.standard_compliance}`,
    asset.material && `Material: ${asset.material}`
  ].filter(Boolean);

  if (ppeSpecs.length > 0) {
    return ppeSpecs.join(' | ');
  }

  return asset.description || asset.remarks || asset.notes || '';
}

/**
 * Trigger browser print modal for standardized 70mm x 40mm Property Asset Tag
 */
export function printAssetSticker(asset, options = {}) {
  if (!asset) return;

  const printWindow = window.open('', '_blank', 'width=700,height=500');
  if (!printWindow) {
    alert('Please allow popups to print asset sticker.');
    return;
  }

  const logoUrl = `${window.location.origin}/nkb-logo.png`;
  const assetCode = asset.asset_code || asset.code || 'AST-NKB-000000';
  const assetName = (asset.name || asset.asset_name || asset.model || 'PHYSICAL ASSET').toUpperCase();
  const modelText = getAssetModelText(asset);
  const specsText = getAssetSpecsText(asset);
  const assignedTo = getAssetOwnerText(asset, options.assignment);

  // Determine category display
  let category = asset.category_name || asset.category;
  if (!category) {
    if (asset.call_sign || asset.radio_frequency_band) {
      category = 'TWO-WAY RADIO / WALKIE-TALKIE';
    } else {
      category = 'EQUIPMENT';
    }
  }
  category = String(category).toUpperCase();

  // Serial / Batch number
  const serialNumber = (asset.serial_number || asset.batch_number || asset.barcode || 'N/A').toUpperCase();

  // Condition
  let condition = (asset.condition || asset.status || 'GOOD').toUpperCase();
  if (condition === 'ACTIVE') condition = 'GOOD / FUNCTIONAL';

  // Construct Model & Hardware Specs line
  let specsContent = '';
  if (modelText && specsText) {
    specsContent = `Model: ${modelText} &nbsp;|&nbsp; ${specsText}`;
  } else if (modelText) {
    specsContent = `Model: ${modelText}`;
  } else if (specsText) {
    specsContent = `Specs: ${specsText}`;
  } else {
    specsContent = 'Standard NKB Enterprise Hardware Specification';
  }

  const systemSubtitle = options.systemSubtitle || 'IT MANAGEMENT SYSTEM';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Property Asset Tag - ${assetCode}</title>
        <style>
          @page {
            size: 70mm 40mm;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 70mm;
            height: 40mm;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: hidden;
          }
          .sticker-card {
            width: 70mm;
            height: 40mm;
            padding: 1.8mm 2.2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 1.5px solid #000000;
            box-sizing: border-box;
            background: #ffffff;
            overflow: hidden;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.2px solid #000000;
            padding-bottom: 0.8mm;
          }
          .logo-img {
            height: 6.5mm;
            max-width: 34mm;
            object-fit: contain;
          }
          .asset-tag-badge {
            text-align: right;
          }
          .asset-tag-title {
            font-size: 4.8pt;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #333333;
            text-transform: uppercase;
            line-height: 1;
          }
          .asset-tag-code {
            font-size: 8.8pt;
            font-weight: 900;
            color: #000000;
            font-family: monospace, Arial, sans-serif;
            line-height: 1.1;
          }
          .main-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            overflow: hidden;
            padding: 0.6mm 0;
          }
          .name-block {
            margin-bottom: 0.4mm;
          }
          .field-label {
            font-size: 5pt;
            font-weight: 800;
            color: #333333;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            line-height: 1;
          }
          .name-val {
            font-size: 9pt;
            font-weight: 900;
            color: #000000;
            line-height: 1.05;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .specs-block {
            background: #f1f5f9;
            border-left: 2.5px solid #000000;
            padding: 0.4mm 1mm;
            margin: 0.4mm 0;
          }
          .specs-title {
            font-size: 4.5pt;
            font-weight: 800;
            color: #333333;
            text-transform: uppercase;
            margin-bottom: 0.2mm;
            line-height: 1;
          }
          .specs-val {
            font-size: 5pt;
            font-weight: 700;
            color: #000000;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .details-grid {
            display: flex;
            justify-content: space-between;
            gap: 1mm;
            margin: 0.3mm 0;
          }
          .grid-col {
            flex: 1;
            min-width: 0;
          }
          .grid-val {
            font-size: 6pt;
            font-weight: 900;
            color: #000000;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          }
          .assigned-row {
            border-top: 0.9px solid #000000;
            padding-top: 0.4mm;
            font-size: 6pt;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .assigned-title {
            font-weight: 900;
            color: #000000;
            margin-right: 0.8mm;
          }
          .assigned-name {
            font-weight: 900;
            color: #000000;
          }
          .footer-banner {
            border-top: 1px solid #000000;
            padding-top: 0.4mm;
            text-align: center;
          }
          .footer-main {
            font-size: 5.8pt;
            font-weight: 900;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            line-height: 1;
          }
          .footer-sub {
            font-size: 4.2pt;
            font-weight: 800;
            letter-spacing: 0.2px;
            margin-top: 0.2mm;
            text-transform: uppercase;
            line-height: 1;
            color: #222222;
          }
        </style>
      </head>
      <body>
        <div class="sticker-card">
          <div class="header-row">
            <img src="${logoUrl}" alt="NKB Logo" class="logo-img" />
            <div class="asset-tag-badge">
              <div class="asset-tag-title">PROPERTY ASSET TAG</div>
              <div class="asset-tag-code">${assetCode}</div>
            </div>
          </div>

          <div class="main-body">
            <div class="name-block">
              <div class="field-label">ASSET NAME :</div>
              <div class="name-val">${assetName}</div>
            </div>

            <div class="specs-block">
              <div class="specs-title">MODEL & HARDWARE SPECS :</div>
              <div class="specs-val">${specsContent}</div>
            </div>

            <div class="details-grid">
              <div class="grid-col">
                <div class="field-label">CATEGORY</div>
                <div class="grid-val">${category}</div>
              </div>
              <div class="grid-col">
                <div class="field-label">SERIAL NUMBER</div>
                <div class="grid-val">${serialNumber}</div>
              </div>
              <div class="grid-col">
                <div class="field-label">CONDITION</div>
                <div class="grid-val">${condition}</div>
              </div>
            </div>

            <div class="assigned-row">
              <span class="assigned-title">ASSIGNED TO:</span>
              <span class="assigned-name">${assignedTo}</span>
            </div>
          </div>

          <div class="footer-banner">
            <div class="footer-main">PROPERTY OF NKB MANUFACTURING CORP.</div>
            <div class="footer-sub">DO NOT REMOVE OR DEFACE &nbsp;|&nbsp; ${systemSubtitle}</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

/**
 * Trigger browser print modal for standardized 70mm x 40mm Spare Part / Replacement Hardware Inventory Tag
 */
export async function printInventorySticker(item, options = {}) {
  if (!item) return;

  const rawCopies = options.copies !== undefined ? parseInt(options.copies, 10) : (parseInt(item.current_quantity, 10) || 1);
  const copiesCount = Math.max(1, Math.min(rawCopies || 1, 500));

  const displayUom = (!item.unit_of_measure || /^\d+$/.test(String(item.unit_of_measure).trim())) ? 'pcs' : item.unit_of_measure;
  const itemCode = (item.item_code || item.barcode || 'SP-0000').toUpperCase();
  const itemName = (item.name || 'SPARE PART PROFILE').toUpperCase();
  const category = (item.category_name || item.category || 'HARDWARE PART').toUpperCase();
  const storageLocation = (item.storage_location || 'IT SPARE STORAGE').toUpperCase();
  const unitCost = Number(item.unit_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const reorderLevel = `${item.reorder_level !== undefined ? item.reorder_level : 5} ${displayUom}`;
  const currentStock = `${item.current_quantity !== undefined ? item.current_quantity : 0} ${displayUom}`;
  const brandModel = [item.brand && item.brand !== 'Generic' ? item.brand : '', item.model && item.model !== 'Standard' ? item.model : ''].filter(Boolean).join(' ');
  const specText = brandModel || item.remarks || item.description || 'GENUINE REPLACEMENT HARDWARE';

  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(itemCode, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('Failed to generate QR for inventory item:', err);
  }

  const printWindow = window.open('', '_blank', 'width=700,height=500');
  if (!printWindow) {
    alert('Please allow popups to print spare part sticker.');
    return;
  }

  const logoUrl = `${window.location.origin}/nkb-logo.png`;

  const cardsHtml = Array.from({ length: copiesCount }, (_, idx) => {
    const pieceBadge = copiesCount > 1 
      ? `<span style="font-size: 5pt; font-weight: 800; background: #000; color: #fff; padding: 0.2mm 0.8mm; border-radius: 0.5mm; margin-left: 0.8mm;">UNIT ${idx + 1} OF ${copiesCount}</span>` 
      : '';

    return `
      <div class="sticker-page">
        <div class="sticker-card">
          <div class="header-row">
            <img src="${logoUrl}" alt="NKB Logo" class="logo-img" />
            <div class="tag-badge">
              <div class="tag-title">SPARE PART INVENTORY TAG ${pieceBadge}</div>
              <div class="tag-code">${itemCode}</div>
            </div>
          </div>

          <div class="main-body">
            <div class="left-col">
              <div>
                <div class="field-label">PART NAME</div>
                <div class="name-val">${itemName}</div>
              </div>

              <div class="specs-val">${specText.toUpperCase()}</div>

              <div class="details-grid">
                <div>
                  <div class="field-label">CATEGORY</div>
                  <div class="grid-val">${category}</div>
                </div>
                <div>
                  <div class="field-label">BIN / LOCATION</div>
                  <div class="grid-val">${storageLocation}</div>
                </div>
              </div>

              <div class="details-grid">
                <div>
                  <div class="field-label">${copiesCount > 1 ? 'UNIT PIECE' : 'CURRENT STOCK'}</div>
                  <div class="grid-val">${copiesCount > 1 ? `PC #${idx + 1} / ${copiesCount}` : currentStock}</div>
                </div>
                <div>
                  <div class="field-label">REORDER LEVEL</div>
                  <div class="grid-val">${reorderLevel}</div>
                </div>
                <div>
                  <div class="field-label">EST UNIT COST</div>
                  <div class="grid-val">₱ ${unitCost}</div>
                </div>
              </div>
            </div>

            <div class="right-col">
              ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="qr-img" />` : ''}
              <div class="qr-caption">SCAN SKU / PART</div>
              ${copiesCount > 1 ? `<div style="font-size: 4pt; font-weight: 900; color: #444; margin-top: 0.3mm;">#${idx + 1} OF ${copiesCount}</div>` : ''}
            </div>
          </div>

          <div class="footer-banner">
            <div class="footer-main">PROPERTY OF NKB MANUFACTURING CORP.</div>
            <div class="footer-sub">DO NOT REMOVE OR DEFACE &nbsp;|&nbsp; SPARE PARTS INVENTORY</div>
          </div>
        </div>
      </div>
    `;
  }).join('\n');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Spare Part Tags (${copiesCount} copies) - ${itemCode}</title>
        <style>
          @page {
            size: 70mm 40mm;
            margin: 0mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, Helvetica, sans-serif;
            background: #ffffff;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .sticker-page {
            width: 70mm;
            height: 40mm;
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
            display: flex;
            overflow: hidden;
          }
          .sticker-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .sticker-card {
            width: 70mm;
            height: 40mm;
            padding: 1.8mm 2.2mm;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 1.5px solid #000000;
            box-sizing: border-box;
            background: #ffffff;
            overflow: hidden;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1.2px solid #000000;
            padding-bottom: 0.8mm;
          }
          .logo-img {
            height: 6.5mm;
            max-width: 32mm;
            object-fit: contain;
          }
          .tag-badge {
            text-align: right;
          }
          .tag-title {
            font-size: 4.8pt;
            font-weight: 800;
            letter-spacing: 0.5px;
            color: #333333;
            text-transform: uppercase;
            line-height: 1;
          }
          .tag-code {
            font-size: 8.8pt;
            font-weight: 900;
            color: #000000;
            font-family: monospace, Arial, sans-serif;
            line-height: 1.1;
          }
          .main-body {
            flex: 1;
            display: flex;
            gap: 1.5mm;
            overflow: hidden;
            padding: 0.6mm 0;
          }
          .left-col {
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-width: 0;
          }
          .right-col {
            width: 20mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-left: 1px dashed #666666;
            padding-left: 1.2mm;
          }
          .field-label {
            font-size: 4.6pt;
            font-weight: 800;
            color: #444444;
            text-transform: uppercase;
            letter-spacing: 0.2px;
            line-height: 1;
          }
          .name-val {
            font-size: 8.5pt;
            font-weight: 900;
            color: #000000;
            line-height: 1.1;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-top: 0.2mm;
          }
          .specs-val {
            font-size: 5pt;
            font-weight: 700;
            color: #222222;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            background: #f1f5f9;
            padding: 0.3mm 0.8mm;
            border-left: 2px solid #000000;
            margin: 0.3mm 0;
          }
          .details-grid {
            display: flex;
            justify-content: space-between;
            gap: 1mm;
          }
          .grid-val {
            font-size: 5.8pt;
            font-weight: 900;
            color: #000000;
            text-transform: uppercase;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          }
          .qr-img {
            width: 17mm;
            height: 17mm;
            object-fit: contain;
          }
          .qr-caption {
            font-size: 4.4pt;
            font-weight: 900;
            color: #111111;
            text-align: center;
            margin-top: 0.3mm;
            letter-spacing: 0.3px;
          }
          .footer-banner {
            border-top: 1px solid #000000;
            padding-top: 0.4mm;
            text-align: center;
          }
          .footer-main {
            font-size: 5.6pt;
            font-weight: 900;
            letter-spacing: 0.4px;
            text-transform: uppercase;
            line-height: 1;
          }
          .footer-sub {
            font-size: 4.2pt;
            font-weight: 800;
            letter-spacing: 0.2px;
            margin-top: 0.2mm;
            text-transform: uppercase;
            line-height: 1;
            color: #222222;
          }
        </style>
      </head>
      <body>
        ${cardsHtml}

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}
