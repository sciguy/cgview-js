/* Development-only rendering diagnostics. Load after CGView, never in its bundle. */

/**
 * Reversibly profile a loaded viewer's synchronous rendering work.
 *
 * Stable metric prefixes: feature, slot, plot, lookup, layout, geometry, canvas,
 * labels.calculate, labels.annotation, labels.inline, labels.track, context,
 * color, and hitTest. Each metric has calls, inclusiveMs, and selfMs. Self time
 * excludes nested instrumented calls, including Feature.draw callbacks inside
 * NCList.run; it still includes uninstrumented work and profiler overhead.
 *
 * Canvas methods/style assignments are counted separately, by layer and in
 * total. Style changes compare the native value before and after assignment.
 * Annotation.draw combines painting with overlap filtering and preparation;
 * named calculation methods and native text/path calls provide partial, not
 * exact, separation. Native Canvas timings measure submission, not GPU finish.
 * Color.setColor counts initialization and explicit resets, not allocations.
 *
 * Install after data loading and layout selection, with no draw in progress.
 * One profiler may be active per page because feature/index/color prototypes
 * are wrapped without adding properties to millions of feature instances.
 * Reloaded data and replaced layout delegates require reinstalling the profiler.
 * Use separate diagnostic passes, never instrumented timings as a baseline.
 *
 * @example
 * const profile = new CGVRenderingProfile(viewer);
 * profile.reset();
 * viewer.drawFast();
 * const diagnostics = profile.snapshot();
 * profile.restore();
 */
class CGVRenderingProfile {
  /**
   * @param {Viewer} viewer - Loaded viewer to inspect.
   * @param {Object} [options] - Diagnostic options.
   * @param {Function} [options.now] - Clock injection for deterministic tests.
   * @returns {CGVRenderingProfile} Profiler with installed reversible wrappers.
   * @throws {Error} If another profiler is active in this page.
   */
  constructor(viewer, options = {}) {
    if (CGVRenderingProfile.active) {
      throw new Error('Only one CGVRenderingProfile may be active per page');
    }
    this.viewer = viewer;
    this._now = options.now || (() => performance.now());
    this._undo = [];
    this._wrapped = new WeakMap();
    this._stack = [];
    this._skippedHooks = [];
    this._restored = false;
    this.reset();
    CGVRenderingProfile.active = this;
    try {
      this._install();
    } catch (error) {
      this.restore();
      throw error;
    }
  }

  /** Clear collected diagnostics without changing installed wrappers. */
  reset() {
    if (this._stack.length) { throw new Error('Cannot reset during an instrumented call'); }
    this._timings = Object.create(null);
    this._canvas = {methods: {}, styles: {}, styleChanges: {}, layers: {}};
  }

  /** @returns {Object} Detached, JSON-serializable diagnostic counters. */
  snapshot() {
    return JSON.parse(JSON.stringify({
      timings: this._timings,
      canvas: this._canvas,
      skippedHooks: this._skippedHooks,
      notes: [
        'Diagnostic timings include wrapper overhead; use separate uninstrumented baseline passes.',
        'Self time excludes nested instrumented calls. Inclusive times must not be summed.',
        'Canvas timings measure CPU submission, not rasterization, GPU completion, or presentation.',
        'Annotation draw includes unseparated overlap filtering; native text includes ruler and other UI text.',
        'Color.setColor counts construction and explicit resets, not exact object allocations.',
      ],
    }));
  }

  /** Remove wrappers, preserving any later replacement made by another caller. */
  restore() {
    if (this._stack.length) { throw new Error('Cannot restore during an instrumented call'); }
    if (this._restored) { return; }
    for (let i = this._undo.length - 1; i >= 0; i--) { this._undo[i](); }
    this._undo.length = 0;
    this._restored = true;
    if (CGVRenderingProfile.active === this) { CGVRenderingProfile.active = undefined; }
  }

  _time(key, callback) {
    const frame = {children: 0};
    const start = this._now();
    this._stack.push(frame);
    try {
      return callback();
    } finally {
      const elapsed = this._now() - start;
      this._stack.pop();
      const metric = this._timings[key] ||
        (this._timings[key] = {calls: 0, inclusiveMs: 0, selfMs: 0});
      metric.calls++;
      metric.inclusiveMs += elapsed;
      metric.selfMs += Math.max(0, elapsed - frame.children);
      const parent = this._stack[this._stack.length - 1];
      if (parent) { parent.children += elapsed; }
    }
  }

  _installDescriptor(target, name, replacement, key) {
    const original = Object.getOwnPropertyDescriptor(target, name);
    try {
      Object.defineProperty(target, name, replacement);
    } catch (error) {
      this._skippedHooks.push(`${key}: ${error.message}`);
      return;
    }
    this._undo.push(() => {
      const current = Object.getOwnPropertyDescriptor(target, name);
      const unchanged = current && (replacement.value ? current.value === replacement.value :
        current.get === replacement.get && current.set === replacement.set);
      if (!unchanged) { return; }
      if (original) { Object.defineProperty(target, name, original); }
      else { delete target[name]; }
    });
  }

  _wrap(target, name, key, {accept, before} = {}) {
    if (!target || typeof target[name] !== 'function') { return; }
    let names = this._wrapped.get(target);
    if (!names) { names = new Set(); this._wrapped.set(target, names); }
    if (names.has(name)) { return; }
    names.add(name);
    const original = target[name];
    const profile = this;
    const wrapped = function(...args) {
      if (accept && !accept(this)) { return original.apply(this, args); }
      if (before) { before(); }
      return profile._time(key, () => original.apply(this, args));
    };
    const own = Object.getOwnPropertyDescriptor(target, name);
    this._installDescriptor(target, name, {
      configurable: true, enumerable: own?.enumerable ?? false, writable: true, value: wrapped,
    }, key);
  }

  _countCanvas(layer, kind, name) {
    const counters = this._canvas;
    counters[kind][name] = (counters[kind][name] || 0) + 1;
    const local = counters.layers[layer] ||
      (counters.layers[layer] = {methods: {}, styles: {}, styleChanges: {}});
    local[kind][name] = (local[kind][name] || 0) + 1;
  }

  _wrapStyle(context, layer, name) {
    let owner = context;
    let descriptor;
    while (owner && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(owner, name);
      owner = Object.getPrototypeOf(owner);
    }
    if (!descriptor?.get || !descriptor?.set) {
      this._skippedHooks.push(`context.${layer}.${name}: no native accessor`);
      return;
    }
    const profile = this;
    this._installDescriptor(context, name, {
      configurable: true,
      enumerable: descriptor.enumerable,
      get() { return descriptor.get.call(this); },
      set(value) {
        profile._countCanvas(layer, 'styles', name);
        const previous = descriptor.get.call(this);
        descriptor.set.call(this, value);
        if (descriptor.get.call(this) !== previous) {
          profile._countCanvas(layer, 'styleChanges', name);
        }
      },
    }, `context.${layer}.${name}`);
  }

  _install() {
    const viewer = this.viewer;
    const layout = viewer.layout;
    const canvas = viewer.canvas;
    const annotation = viewer.annotation;
    const inlineLabels = annotation?._featureLabelRenderer;
    const slots = viewer.slots?.() || [];
    const feature = viewer.features?.()[0];
    const plots = viewer.plots?.() || [];
    const plot = plots[0];
    const belongsToViewer = object => object.viewer === viewer;

    for (const [example, method, key] of [
      [feature, 'draw', 'feature.draw'],
      [slots[0], 'draw', 'slot.draw'],
      [plot, 'draw', 'plot.draw'],
    ]) {
      if (example) {
        this._wrap(Object.getPrototypeOf(example), method, key, {accept: belongsToViewer});
      }
    }

    const indexes = new Set(slots.map(slot => slot._featureNCList).filter(Boolean));
    if (annotation?._labelsNCList) { indexes.add(annotation._labelsNCList); }
    for (const index of indexes) {
      for (const method of ['run', 'count', 'find']) {
        this._wrap(Object.getPrototypeOf(index), method, `lookup.${method}`, {
          accept: object => indexes.has(object),
        });
      }
    }

    for (const method of ['drawFast', 'drawFull', 'drawMapWithoutSlots', 'drawAllSlots',
      'drawSlotWithTimeOut', 'drawForeground', 'updateLayout', '_adjustProportions']) {
      this._wrap(layout, method, `layout.${method}`);
    }
    for (const method of ['pointForBp', 'bpForPoint', 'centerOffsetForPoint', 'domainsFor',
      'adjustBpScaleRange', 'visibleRangeForCenterOffset', 'pixelsPerBp', 'path',
      '_pathAsAdaptivePolyline']) {
      this._wrap(layout?.delegate, method, `geometry.${method}`);
    }
    for (const method of ['path', 'drawElement', 'drawTextAlongArc']) {
      this._wrap(canvas, method, `canvas.${method}`);
    }

    this._wrap(annotation, 'draw', 'labels.annotation.draw');
    for (const method of ['visibleLabels', '_sortByPriority', '_onlyFavoriteLabels',
      '_calculatePositions', '_calculatePriorityLabelRectsFast', '_calculatePriorityLabelRects',
      '_calculateLabelRects']) {
      this._wrap(annotation, method, `labels.calculate.${method}`);
    }
    this._wrap(annotation, 'drawLabelLine', 'labels.annotation.drawLine');
    this._wrap(inlineLabels, 'draw', 'labels.inline.draw');
    for (const method of ['_placementsForSlot', '_nonOverlappingPlacements',
      'visibleInlineFeatures', '_measurementFor', 'metricsFor']) {
      this._wrap(inlineLabels, method, `labels.calculate.${method}`);
    }
    for (const method of ['_drawStraightLabel', '_drawCurvedLabel']) {
      this._wrap(inlineLabels, method, `labels.inline.${method}`);
    }
    this._wrap(layout?._trackLabelRenderer, 'draw', 'labels.track.draw');
    this._wrap(layout?._trackLabelRenderer, '_planForSlot', 'labels.calculate.trackPlan');
    for (const placement of [annotation?.labelPlacementFast, annotation?.labelPlacementFull]) {
      this._wrap(placement, 'placeLabels', 'labels.calculate.placeLabels');
    }
    for (const item of plots) {
      this._wrap(item._renderer, '_plotGeometry', 'plot.geometry');
      this._wrap(item._renderer, '_samplesForRange', 'plot.samples');
    }
    this._wrap(viewer.eventMonitor, '_createEvent', 'hitTest.event');
    this._wrap(viewer.eventMonitor, '_getElement', 'hitTest.element');

    const color = viewer.settings?.backgroundColor;
    if (color) {
      for (const method of ['copy', 'lighten', 'darken', 'setColor']) {
        this._wrap(Object.getPrototypeOf(color), method, `color.${method}`);
      }
    }

    const methods = ['beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'ellipse',
      'bezierCurveTo', 'quadraticCurveTo', 'rect', 'fill', 'stroke', 'fillRect', 'strokeRect',
      'clearRect', 'fillText', 'strokeText', 'measureText', 'save', 'restore', 'translate',
      'rotate', 'scale', 'transform', 'setTransform', 'resetTransform', 'setLineDash',
      'clip', 'drawImage'];
    const styles = ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin',
      'globalAlpha', 'globalCompositeOperation', 'font', 'textAlign', 'textBaseline'];
    for (const layer of canvas?.layerNames || []) {
      const context = canvas.context(layer);
      for (const method of methods) {
        this._wrap(context, method, `context.${method}`, {
          before: () => this._countCanvas(layer, 'methods', method),
        });
      }
      for (const style of styles) { this._wrapStyle(context, layer, style); }
    }
  }
}

globalThis.CGVRenderingProfile = CGVRenderingProfile;
