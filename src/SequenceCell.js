/**
 * Shared path drawing for nucleotide and amino-acid chevrons.
 * Callers supply geometry, colors, and any glyph transforms.
 */

/** Unscaled vertical padding around nucleotide and amino-acid fonts. */
export const CELL_VERTICAL_PADDING = 2.5;

/**
 * Trace a chevron, optionally rotating its vertices without changing the canvas
 * transform. This lets horizontal letters sit inside directional circular cells.
 * @param {CanvasRenderingContext2D} ctx - Drawing context.
 * @param {Number} x - Cell center x coordinate.
 * @param {Number} y - Cell center y coordinate.
 * @param {Number} direction - Reading direction along the local x axis, 1 or -1.
 * @param {Object} cell - Geometry containing halfWidth, halfHeight, tipLength,
 *   and an optional optical tipCenterOffset toward the upper edge in the reading direction.
 * @param {Number} [cos=1] - Cosine of the cell rotation.
 * @param {Number} [sin=0] - Sine of the cell rotation.
 * @returns {undefined} Replaces the current path; does not fill, stroke, or change transforms.
 */
export const traceChevron = (ctx, x, y, direction, cell, cos = 1, sin = 0) => {
  const dx = direction * cell.halfWidth * cos;
  const dy = direction * cell.halfWidth * sin;
  const tipDx = direction * cell.tipLength * cos;
  const tipDy = direction * cell.tipLength * sin;
  const heightDx = -cell.halfHeight * sin;
  const heightDy = cell.halfHeight * cos;
  const tailX = x - dx;
  const tailY = y - dy;
  const tipX = x + dx;
  const tipY = y + dy;
  const shoulderX = tipX - tipDx;
  const shoulderY = tipY - tipDy;
  // Apply the same optical shift to the point and notch, preserving shared edges.
  const tipCenterOffset = direction * (cell.tipCenterOffset || 0);
  const centerDx = tipCenterOffset * sin;
  const centerDy = -tipCenterOffset * cos;
  ctx.beginPath();
  ctx.moveTo(tailX - heightDx, tailY - heightDy);
  ctx.lineTo(shoulderX - heightDx, shoulderY - heightDy);
  ctx.lineTo(tipX + centerDx, tipY + centerDy);
  ctx.lineTo(shoulderX + heightDx, shoulderY + heightDy);
  ctx.lineTo(tailX + heightDx, tailY + heightDy);
  ctx.lineTo(tailX + tipDx + centerDx, tailY + tipDy + centerDy);
  ctx.closePath();
};

/**
 * Trace curved chevron edges at exact map positions on short circular maps.
 * @param {Canvas} canvas - Viewer canvas supplying map geometry.
 * @param {CanvasRenderingContext2D} ctx - Map drawing context, with no glyph transform.
 * @param {Number} middle - Map position at the cell center.
 * @param {Number} centerOffset - Cell radius in screen pixels.
 * @param {Number} strand - Forward (1) or reverse (-1) reading direction.
 * @param {Object} cell - Cell geometry, including pixelsPerBp.
 * @returns {undefined} Replaces the current path in map coordinates; does not paint it.
 */
export const traceCurvedChevron = (canvas, ctx, middle, centerOffset, strand, cell) => {
  const halfBp = cell.halfWidth / cell.pixelsPerBp;
  const tipBp = cell.tipLength / cell.pixelsPerBp;
  const tail = middle - strand * halfBp;
  const tip = middle + strand * halfBp;
  const shoulder = tip - strand * tipBp;
  const tipRadius = centerOffset + strand * (cell.tipCenterOffset || 0);
  const tipPoint = canvas.pointForBp(tip, tipRadius);
  const innerShoulder = canvas.pointForBp(shoulder, centerOffset - cell.halfHeight);
  const notchPoint = canvas.pointForBp(tail + strand * tipBp, tipRadius);
  ctx.beginPath();
  canvas.path('map', centerOffset + cell.halfHeight, tail, shoulder, strand === -1);
  ctx.lineTo(tipPoint.x, tipPoint.y);
  ctx.lineTo(innerShoulder.x, innerShoulder.y);
  canvas.path('map', centerOffset - cell.halfHeight, shoulder, tail, strand === 1, 'noMoveTo');
  ctx.lineTo(notchPoint.x, notchPoint.y);
  ctx.closePath();
};
