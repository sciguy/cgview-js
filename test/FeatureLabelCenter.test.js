import FeatureLabelRenderer from '../src/FeatureLabelRenderer';

// Independent centroid oracle: approximate the drawn outline with a polygon
// and integrate its signed area and first moments (the shoelace formula).
function polygonCentroid(points) {
  let area = 0, x = 0, y = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    area += cross;
    x += (a[0] + b[0]) * cross;
    y += (a[1] + b[1]) * cross;
  }
  return [x / (3 * area), y / (3 * area)];
}

function clipPolygon(points, signedDistance) {
  const clipped = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = signedDistance(a), db = signedDistance(b);
    if (da <= 0) { clipped.push(a); }
    if ((da <= 0) !== (db <= 0)) {
      const t = da / (da - db);
      clipped.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return clipped;
}

describe('Area-weighted inline label anchor', () => {
  const linear = new FeatureLabelRenderer({viewer: {format: 'linear'}});
  const circular = new FeatureLabelRenderer({viewer: {format: 'circular'}});

  test.each([0, 6, 64, 200, 300])('matches a linear polygon centroid for head length %i', head => {
    const length = 300, width = 64, body = length - head;
    const [x] = polygonCentroid([[0, 0], [body, 0], [length, width / 2], [body, width], [0, width]]);
    expect(linear._arrowCenterShift(length, head, width, 0)).toBeCloseTo(length / 2 - x, 10);
  });

  test.each([80, 250, 1000])('matches independently sampled circular outlines at radius %i', radius => {
    for (const span of [0.2, 1, 2.5, 5.5]) {
      for (const headFraction of [0.05, 0.3, 0.8]) {
        const length = radius * span, head = Math.min(32, length * headFraction), width = 32;
        const tail = -span / 2, tip = span / 2, base = tip - head / radius;
        const points = [], steps = 2000;
        const add = (angle, r) => points.push([r * Math.cos(angle), r * Math.sin(angle)]);
        for (let i = 0; i <= steps; i++) { add(tail + (base - tail) * i / steps, radius + width / 2); }
        add(tip, radius);
        for (let i = 0; i <= steps; i++) { add(base + (tail - base) * i / steps, radius - width / 2); }
        const [x, y] = polygonCentroid(points);
        const expected = -radius * Math.atan2(y, x);
        expect(circular._arrowCenterShift(length, head, width, radius)).toBeCloseTo(expected, 3);
      }
    }
  });

  test.each([1e8, 1e12])('converges to linear centering at radius %i', radius => {
    expect(circular._arrowCenterShift(300, 64, 64, radius))
      .toBeCloseTo(linear._arrowCenterShift(300, 64, 64, 0), 8);
  });

  test('matches independently clipped linear polygons as a head enters view', () => {
    for (const outside of [0, 0.1, 8, 32, 63.9, 64, 80]) {
      const span = 300, head = 64, width = 64, length = span - outside;
      const shape = [[0, 0], [span - head, 0], [span, width / 2], [span - head, width], [0, width]];
      const [x] = polygonCentroid(clipPolygon(shape, p => p[0] - length));
      expect(linear._arrowCenterShift(length, head, width, 0, outside)).toBeCloseTo(length / 2 - x, 8);
    }
  });

  test.each([80, 250, 1000])('matches clipped circular outlines at radius %i', radius => {
    for (const span of [0.5, 1, 2]) for (const outside of [0.1, 8, 16, 31.9]) {
      const head = 32, width = 32, length = radius * span - outside;
      const tail = -span / 2, tip = span / 2, base = tip - head / radius;
      const clip = tip - outside / radius;
      const points = [], steps = 2000;
      const add = (angle, r) => points.push([r * Math.cos(angle), r * Math.sin(angle)]);
      for (let i = 0; i <= steps; i++) { add(tail + (base - tail) * i / steps, radius + width / 2); }
      add(tip, radius);
      for (let i = 0; i <= steps; i++) { add(base + (tail - base) * i / steps, radius - width / 2); }
      const polygon = clipPolygon(points, p => p[1] * Math.cos(clip) - p[0] * Math.sin(clip));
      const [x, y] = polygonCentroid(polygon);
      expect(circular._arrowCenterShift(length, head, width, radius, outside))
        .toBeCloseTo(-radius * Math.atan2(y, x) - outside / 2, 3);
    }
  });

  test('has no displacement without a head and stays finite for clipped or degenerate shapes', () => {
    for (const radius of [0, 10, 100, 1e12]) {
      expect(circular._arrowCenterShift(100, 0, 20, radius)).toBe(0);
      const shift = circular._arrowCenterShift(10, 40, 20, radius);
      expect(Number.isFinite(shift)).toBe(true);
      expect(shift).toBeGreaterThanOrEqual(0);
      expect(shift).toBeLessThanOrEqual(5);
    }
  });
});
