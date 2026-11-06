/** Production label rendering. Copyright 2016-2026 Jason R. Grant. Apache-2.0. */
const TAU = Math.PI * 2;

/** Project eligible features without retaining drawing or layout state. @private */
export default class LabelProjection {
  /**
   * Create independent placement and drawing state for one annotation.
   * @param {Annotation} annotation - Viewer models and projection helpers.
   * @param {Object} [options={}] - gap and constrainToViewport.
   * @returns {LabelProjection} Renderer with no pending animation work.
   */
  constructor(annotation, options = {}) {
    this.annotation = annotation;
    const number = (key, fallback) => Number.isFinite(Number(options[key])) ? Number(options[key]) : fallback;
    this.options = {gap: Math.max(0, number('gap', 3)),
      constrainToViewport: options.constrainToViewport !== false};
  }

  get viewer() { return this.annotation.viewer; }

  get canvas() { return this.viewer.canvas; }

  _map(outerOffset) {
    const circular = this.viewer.format === 'circular';
    const origin = this.canvas.pointForBp(1, circular ? 0 : outerOffset + 2);
    return {circular, x: origin.x, y: origin.y, radius: Math.max(1, outerOffset + 2),
      width: this.canvas.width, height: this.canvas.height};
  }

  _parameter(bp, map) {
    const scale = this.viewer.layout.scale;
    const value = scale.bp(bp);
    return map.circular ? value : scale.x(value);
  }

  _bp(a, map) {
    const bp = map.circular ? this.viewer.layout.scale.bp.invert(a) : this.canvas.bpForPoint({x: a, y: map.y}, {float: true});
    const length = this.viewer.sequence.length;
    return ((bp - 1) % length + length) % length + 1;
  }

  _split(start, stop) {
    return start <= stop ? [[start, stop]] : [[start, this.viewer.sequence.length], [1, stop]];
  }

  _clip(ranges, map) {
    if (!map.circular) {
      return map.y < 0 || map.y > map.height ? [] : ranges.map(([a, b]) => [Math.max(0, a), Math.min(map.width, b)])
        .filter(([a, b]) => a <= b);
    }
    if (map.x - map.radius >= 0 && map.x + map.radius <= map.width &&
      map.y - map.radius >= 0 && map.y + map.radius <= map.height) { return ranges; }
    const angles = [];
    for (const x of [0, map.width]) {
      const ratio = (x - map.x) / map.radius;
      if (Math.abs(ratio) <= 1) { const a = Math.acos(ratio); angles.push(a, -a); }
    }
    for (const y of [0, map.height]) {
      const ratio = (y - map.y) / map.radius;
      if (Math.abs(ratio) <= 1) { const a = Math.asin(ratio); angles.push(a, Math.PI - a); }
    }
    const inside = a => {
      const x = map.x + map.radius * Math.cos(a), y = map.y + map.radius * Math.sin(a);
      return x >= -1e-6 && x <= map.width + 1e-6 && y >= -1e-6 && y <= map.height + 1e-6;
    };
    const clipped = [];
    for (const [start, stop] of ranges) {
      if (start === stop) { if (inside(start)) { clipped.push([start, stop]); } continue; }
      const cuts = [start, stop];
      for (const angle of angles) {
        const a = angle + Math.ceil((start - angle) / TAU) * TAU;
        if (a > start && a < stop) { cuts.push(a); }
      }
      cuts.sort((a, b) => a - b);
      for (let i = 1; i < cuts.length; i++) {
        if (inside((cuts[i - 1] + cuts[i]) / 2)) { clipped.push([cuts[i - 1], cuts[i]]); }
      }
    }
    return clipped;
  }

  _candidates(labels, map) {
    const nodes = [];
    for (const label of labels) {
      const feature = label.feature;
      const locations = feature.hasLocations ? feature.locations.flatMap(([start, stop]) =>
        this._split(start + feature.contig.lengthOffset, stop + feature.contig.lengthOffset)) :
        feature.mapStart <= feature.mapStop ? [[feature.mapStart, feature.mapStop]] :
          feature.mapRanges.map(range => [range.start, range.stop]);
      const midpoint = this._parameter(label.bpDefault, map);
      const ranges = this._clip(locations.map(([start, stop]) => {
        let a = this._parameter(start, map), b = this._parameter(stop, map);
        if (map.circular) {
          if (b < a) { b += TAU; }
          const shift = Math.round((midpoint - (a + b) / 2) / TAU) * TAU;
          a += shift;
          b += shift;
        }
        return [a, b];
      }), map);
      if (!ranges.length) { continue; }
      const preferred = ranges.map(([start, stop]) => Math.max(start, Math.min(stop, midpoint)))
        .sort((a, b) => Math.abs(a - midpoint) - Math.abs(b - midpoint))[0];
      nodes.push({id: label, width: label.width, height: label.height, favorite: feature.favorite, ranges, preferred});
    }
    return nodes;
  }

  _sameInput(candidates, map, options, old) {
    const sameObstacles = old && options.obstacles.length === old.options.obstacles.length &&
      options.obstacles.every((r, i) => ['x', 'y', 'width', 'height'].every(key => r[key] === old.options.obstacles[i][key]));
    if (!old || Object.keys(map).some(key => map[key] !== old.map[key]) ||
      !sameObstacles || Object.keys(options).some(key => key !== 'obstacles' && options[key] !== old.options[key]) ||
      candidates.length !== old.candidates.length) { return false; }
    return candidates.every((n, i) => {
      const b = old.candidates[i];
      return n.id === b.id && n.width === b.width && n.height === b.height && n.favorite === b.favorite &&
        n.preferred === b.preferred && n.ranges.length === b.ranges.length &&
        n.ranges.every(([start, stop], j) => start === b.ranges[j][0] && stop === b.ranges[j][1]);
    });
  }

  _obstacles() {
    const rectangles = [];
    for (const overlay of [this.viewer.legend, ...this.viewer.captions()]) {
      if (!overlay.visible || !overlay.box) { continue; }
      overlay.box.refresh(true);
      const {x, y, width, height} = overlay.box;
      if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
        rectangles.push({x, y, width, height});
      }
    }
    return rectangles;
  }
}
