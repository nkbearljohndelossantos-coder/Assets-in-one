/**
 * Label Layout & Auto-Fit Typography Engine for 70mm x 40mm Asset Sticker Tags
 * Ensures zero clipping, clean word-wrapping, and dynamic font scaling.
 */

export const LABEL_FONT = 'Arial, Helvetica, "Segoe UI", Roboto, sans-serif'
export const LABEL_INFO_TEXT_WIDTH = 360 // 700px total - 225px QR column - 44px margins - 71px safety gap = 360px
export const LABEL_LOCATION_WIDTH = 640 // 700px - 48px margins - 12px safety

let measureCanvas = null

function getMeasureCtx(fontSize, fontStyle = 'italic', fontWeight = '900', fontFamily = LABEL_FONT) {
  if (!measureCanvas && typeof document !== 'undefined') {
    measureCanvas = document.createElement('canvas')
  }
  if (!measureCanvas) {
    return {
      measureText: (t) => ({ width: String(t || '').length * fontSize * 0.70 }),
    }
  }
  const ctx = measureCanvas.getContext('2d')
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  return ctx
}

export function measureLineWidth(text, fontSize, fontStyle = 'italic', fontWeight = '900', fontFamily = LABEL_FONT) {
  const ctx = getMeasureCtx(fontSize, fontStyle, fontWeight, fontFamily)
  // Include 15% safety margin for italic slant overhang, letter kerning, and subpixel rendering
  return (ctx.measureText(String(text || '')).width || 0) * 1.15
}

/**
 * Wraps text into lines by words with balanced line distribution and zero overflow.
 */
export function wrapTextIntoLines(text, maxWidth, fontSize, fontStyle = 'italic', fontWeight = '900', fontFamily = LABEL_FONT) {
  const clean = String(text || '').trim().toUpperCase()
  if (!clean) return ['']

  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length <= 1) return [clean]

  // If the entire text fits comfortably on 1 line within maxWidth, keep it as 1 line
  if (measureLineWidth(clean, fontSize, fontStyle, fontWeight, fontFamily) <= maxWidth) {
    return [clean]
  }

  // Try 2-line balanced split first to avoid awkward 1-word trailing lines
  let best2 = null
  let minDiff2 = 9999
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(' ')
    const l2 = words.slice(i).join(' ')
    const w1 = measureLineWidth(l1, fontSize, fontStyle, fontWeight, fontFamily)
    const w2 = measureLineWidth(l2, fontSize, fontStyle, fontWeight, fontFamily)
    if (w1 <= maxWidth && w2 <= maxWidth) {
      const diff = Math.abs(l1.length - l2.length)
      if (diff < minDiff2) {
        minDiff2 = diff
        best2 = [l1, l2]
      }
    }
  }
  if (best2) return best2

  // Try 3-line balanced split if 2-line doesn't fit
  let best3 = null
  let minDiff3 = 9999
  for (let i = 1; i < words.length - 1; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const l1 = words.slice(0, i).join(' ')
      const l2 = words.slice(i, j).join(' ')
      const l3 = words.slice(j).join(' ')
      const w1 = measureLineWidth(l1, fontSize, fontStyle, fontWeight, fontFamily)
      const w2 = measureLineWidth(l2, fontSize, fontStyle, fontWeight, fontFamily)
      const w3 = measureLineWidth(l3, fontSize, fontStyle, fontWeight, fontFamily)
      if (w1 <= maxWidth && w2 <= maxWidth && w3 <= maxWidth) {
        const avg = (l1.length + l2.length + l3.length) / 3
        const variance = Math.pow(l1.length - avg, 2) + Math.pow(l2.length - avg, 2) + Math.pow(l3.length - avg, 2)
        if (variance < minDiff3) {
          minDiff3 = variance
          best3 = [l1, l2, l3]
        }
      }
    }
  }
  if (best3) return best3

  // Fallback greedy wrapping
  const lines = []
  let current = ''

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    const w = measureLineWidth(candidate, fontSize, fontStyle, fontWeight, fontFamily)
    if (w <= maxWidth) {
      current = candidate
    } else {
      if (current) {
        lines.push(current)
        current = word
      } else {
        lines.push(word)
        current = ''
      }
    }
  }
  if (current) {
    lines.push(current)
  }
  return lines.length ? lines : ['']
}

/**
 * Auto-fits text into maxWidth x maxHeight with maxLines.
 * Iteratively shrinks fontSize from maxSize down to minSize until:
 * 1) lines.length <= maxLines
 * 2) EVERY single line's width <= maxWidth
 * 3) Total block height <= maxHeight
 */
export function fitLabelText(
  text,
  maxWidth,
  maxHeight,
  minSize = 10,
  maxSize = 22,
  maxLines = 2,
  fontStyle = 'italic',
  fontWeight = '900',
  fontFamily = LABEL_FONT
) {
  const clean = String(text || '').trim().toUpperCase()
  if (!clean) {
    return { fontSize: maxSize, lineHeight: 1.15, lines: ['—'], blockHeight: Math.ceil(maxSize * 1.15) }
  }

  // Iterate from maxSize down to minSize with 0.5px granularity
  for (let fontSize = maxSize; fontSize >= minSize; fontSize -= 0.5) {
    const lineHeight = fontSize <= 13 ? 1.12 : 1.16
    const lines = wrapTextIntoLines(clean, maxWidth, fontSize, fontStyle, fontWeight, fontFamily)

    if (lines.length > maxLines) continue

    const allLinesFitWidth = lines.every((line) => {
      return measureLineWidth(line, fontSize, fontStyle, fontWeight, fontFamily) <= maxWidth
    })
    if (!allLinesFitWidth) continue

    const blockHeight = Math.ceil(lines.length * fontSize * lineHeight)
    if (blockHeight <= maxHeight) {
      return { fontSize, lineHeight, lines, blockHeight }
    }
  }

  // Fallback at minSize if text is unusually massive
  const fallbackSize = minSize
  const lineHeight = 1.12
  let lines = wrapTextIntoLines(clean, maxWidth, fallbackSize, fontStyle, fontWeight, fontFamily)
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines)
    let last = lines[maxLines - 1]
    while (last.length > 0 && measureLineWidth(`${last}…`, fallbackSize, fontStyle, fontWeight, fontFamily) > maxWidth) {
      last = last.slice(0, -1)
    }
    lines[maxLines - 1] = `${last}…`
  }

  return {
    fontSize: fallbackSize,
    lineHeight,
    lines,
    blockHeight: Math.ceil(lines.length * fallbackSize * lineHeight),
  }
}

/**
 * Builds all fitted typography blocks for the 700x400 sticker.
 */
export function buildAssetLabelFields({
  name,
  category,
  serial,
  location,
  textWidth = LABEL_INFO_TEXT_WIDTH,
  locationWidth = LABEL_LOCATION_WIDTH,
}) {
  // Asset Name: up to 3 lines, max 21px down to 9.5px, max height 75px
  const nameFit = fitLabelText(name, textWidth, 75, 9.5, 21, 3, 'italic', '900')

  // Category: up to 2 lines, max 17px down to 10px, max height 38px
  const catFit = fitLabelText(category, textWidth, 38, 10, 17, 2, 'italic', '900')

  // Serial Number: 1 or 2 lines, max 19px down to 10px, max height 40px
  const serialFit = fitLabelText(serial, textWidth, 40, 10, 19, 2, 'italic', '900')

  // Location: up to 2 lines, max 10.5px down to 8px, max height 28px
  const locationFit = fitLabelText(location, locationWidth, 28, 8, 10.5, 2, 'normal', 'bold')

  return { nameFit, catFit, serialFit, locationFit }
}
