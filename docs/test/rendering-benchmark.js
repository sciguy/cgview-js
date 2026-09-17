/* Development-only synthetic rendering benchmark. Never included in CGView bundles. */
(() => {
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

  /**
   * Generate a deterministic, overlapping feature map without a sequence string.
   * Coordinates remain JS integers. Mutates no viewer; allocates the returned JSON.
   * @param {Object} options - count, seed, format, decoration, labels, plotPoints, shading.
   * @returns {Object} CGView JSON and a compact dataset identity.
   * @example CGVRenderingBenchmark.generate({count: 10000, seed: 42, format: 'circular', decoration: 'arc'});
   */
  function generate(options) {
    const {count, seed = 42, format = 'circular', decoration = 'arc', labels = 0,
      plotPoints = 0, shading = false} = options;
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(count * 1000)) {
      throw new Error('count must be a positive integer with exact genomic coordinates');
    }
    const length = Math.max(1_000_000, count * 1000);
    let state = seed >>> 0;
    let fingerprint = 2166136261;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const hash = value => { fingerprint = Math.imul(fingerprint ^ value, 16777619) >>> 0; };
    const features = new Array(count);
    const labelCount = Math.min(count, labels);
    let named = 0;
    for (let i = 0; i < count; i++) {
      const start = 1 + Math.floor(i * length / count + random() * (length / count) * 0.2);
      const span = 200 + Math.floor(random() * 1600);
      const stop = ((start + span - 2) % length) + 1;
      const strand = random() < 0.5 ? -1 : 1;
      const style = Math.floor(random() * 4);
      const hasLabel = named < labelCount && i >= Math.floor(named * count / labelCount);
      features[i] = {start, stop, strand, source: 'synthetic', legend: `Style ${style}`,
        ...(hasLabel ? {name: `Feature ${i + 1}`} : {})};
      if (hasLabel) named++;
      hash(start); hash(stop); hash(strand); hash(style);
    }
    const tracks = [{name: 'Features', dataMethod: 'source', dataKeys: ['synthetic'],
      position: 'both', separateFeaturesBy: 'strand'}];
    const plots = [];
    if (plotPoints) {
      const positions = new Array(plotPoints);
      const scores = new Array(plotPoints);
      for (let i = 0; i < plotPoints; i++) {
        positions[i] = 1 + Math.floor(i * length / plotPoints);
        scores[i] = 0.6 * Math.sin(i / 73) + 0.3 * Math.sin(i / 7);
      }
      plots.push({name: 'Signal', source: 'signal', positions, scores, baseline: 0,
        axisMin: -1, axisMax: 1, legendPositive: 'Style 0', legendNegative: 'Style 1'});
      tracks.push({name: 'Signal', dataType: 'plot', dataMethod: 'source', dataKeys: ['signal'], position: 'inside'});
    }
    return {
      identity: {generator: 'lcg-spaced-overlap-v1', seed, count, sequenceLength: length,
        featureFingerprint: fingerprint.toString(16).padStart(8, '0'), labels: named, plotPoints,
        minArcLength: 1, styles: 4, featureSpanBp: [200, 1799]},
      json: {cgview: {
        version: globalThis.CGView?.version || '1.9.0', sequence: {length},
        settings: {format, showShading: shading, showBorder: false},
        annotation: {visible: labels > 0, labelPosition: 'outside'},
        legend: {visible: false, defaultMinArcLength: 1,
          items: ['#3870a0', '#b14b48', '#4e9253', '#9268a8'].map((swatchColor, i) =>
            ({name: `Style ${i}`, swatchColor, decoration, minArcLength: 1}))},
        features, tracks, plots,
      }},
    };
  }

  /** Summarize millisecond samples while retaining every observation. */
  function statistics(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    const percentile = p => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] ?? null;
    return {samples, median: percentile(0.5), p90: percentile(0.9), min: sorted[0] ?? null,
      max: sorted.at(-1) ?? null};
  }

  /** Wait for progressive slots, including the zero-pending-timer case. */
  async function settle(viewer, timeout = 120_000) {
    const start = performance.now();
    while (viewer.layout.fullDrawInProgress) {
      if (performance.now() - start > timeout) throw new Error('Full drawing did not settle');
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  async function zoomTo(viewer, zoom) {
    await settle(viewer);
    const focusBp = Math.floor(viewer.sequence.length * 0.37);
    await new Promise(resolve => viewer.zoomTo(zoom === 1 ? 0 : focusBp, zoom,
      {duration: 0, callback: resolve}));
    await settle(viewer);
    return focusBp;
  }

  function heap() {
    if (!performance.memory) return null;
    return {usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit};
  }

  // Independent count probes do not include Feature.draw callbacks or profiler overhead.
  function visibility(viewer) {
    let visibleFeatures = 0;
    const start = performance.now();
    const slots = viewer.layout.visibleSlots().map(slot => {
      const range = slot.visibleRange;
      const count = slot.hasFeatures && range ? slot._featureNCList.count(range.start, range.stop) : 0;
      visibleFeatures += count;
      return {features: slot.hasFeatures ? slot.features().length : 0, visibleFeatures: count,
        range: range ? {start: range.start, stop: range.stop, length: range.length} : null,
        thickness: slot.thickness, centerOffset: slot.centerOffset};
    });
    return {visibleFeatures, slots, lookupMs: performance.now() - start};
  }

  async function interaction(viewer, zoom, frames, focusBp) {
    const cpu = [];
    const intervals = [];
    let previous;
    // The interval recorded on each frame belongs to the preceding navigation draw.
    // Three unrecorded draws allow the RAF cadence to settle; the final RAF drains the last draw.
    for (let i = 0; i <= frames + 3; i++) {
      const timestamp = await nextFrame();
      if (i > 3) intervals.push(timestamp - previous);
      previous = timestamp;
      if (i === frames + 3) break;
      const start = performance.now();
      const direction = i % 2 === 0 ? 1 : -1;
      viewer.layout.zoom(zoom * (direction === 1 ? 1.02 : 1), focusBp);
      viewer.layout.translate(direction * 2, direction);
      viewer.drawFast();
      if (i >= 3) cpu.push(performance.now() - start);
    }
    await zoomTo(viewer, zoom);
    return {cpu: statistics(cpu), frameIntervals: statistics(intervals),
      description: 'Scripted layout zoom/pan plus drawFast in RAF; excludes DOM input dispatch, includes browser scheduling/raster pressure in intervals, not GPU completion or displayed FPS.'};
  }

  function hitTesting(viewer, repeats = 200) {
    const slot = viewer.layout.visibleSlots().find(item => item.hasFeatures && item.visibleRange);
    if (!slot) return {queries: 0, totalMs: 0, hits: 0};
    let hits = 0;
    const range = slot.visibleRange;
    const start = performance.now();
    for (let i = 0; i < repeats; i++) {
      const bp = ((Math.floor(range.start + range.length * i / repeats) - 1) % viewer.sequence.length) + 1;
      const point = viewer.canvas.pointForBp(bp, slot.centerOffset);
      const result = viewer.eventMonitor._getElement(slot, bp, slot.centerOffset, point.x, point.y);
      if (result.elementType === 'feature') hits++;
    }
    return {queries: repeats, totalMs: performance.now() - start, hits};
  }

  /**
   * Run a scenario on a dedicated benchmark page. Creates one Viewer in #map.
   * Timed passes have no profiler installed; diagnostics are separate and restored.
   * @param {Object} options - Dataset options plus zooms, iterations, warmups, frames, profile.
   * @returns {Promise<Object>} Metadata, raw timings, heap observations, and optional profiles.
   * @example await CGVRenderingBenchmark.run({count: 10000, format: 'circular', decoration: 'arc', zooms: [1,10,1000], iterations: 5, warmups: 2, frames: 12});
   */
  async function run(options) {
    const memoryBefore = heap();
    let start = performance.now();
    let dataset = generate(options);
    const generationMs = performance.now() - start;
    const identity = dataset.identity;
    const memoryWithJSON = heap();
    start = performance.now();
    const viewer = new CGView.Viewer('#map', {width: options.width || 600, height: options.height || 600,
      SVGContext: svgcanvas.Context});
    const viewerCreationMs = performance.now() - start;
    start = performance.now();
    viewer.io.loadJSON(dataset.json);
    const loadJSONSyncMs = performance.now() - start;
    await settle(viewer);
    const loadJSONSettledMs = performance.now() - start;
    dataset = null;
    // Without forced GC, the released JSON may still occupy heap memory.
    const memoryAfterLoad = heap();
    const records = [];
    for (const zoom of options.zooms) {
      const focusBp = await zoomTo(viewer, zoom);
      if (Math.abs(viewer.zoomFactor - zoom) > 1e-6) throw new Error(`Zoom ${zoom} was clamped to ${viewer.zoomFactor}`);
      const samples = {drawFast: [], drawFull: [], drawExport: []};
      for (let round = 0; round < options.warmups + options.iterations; round++) {
        // Rotate order to limit systematic fast/full/export warm-cache bias.
        const methods = ['drawFast', 'drawFull', 'drawExport'];
        methods.push(...methods.splice(0, round % methods.length));
        for (const method of methods) {
          await nextFrame();
          start = performance.now();
          viewer.layout[method]();
          if (method === 'drawFull') await settle(viewer);
          const elapsed = performance.now() - start;
          if (round >= options.warmups) samples[method].push(elapsed);
        }
      }
      const record = {zoom, ...visibility(viewer),
        ...Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, statistics(values)])),
        interaction: await interaction(viewer, zoom, options.frames, focusBp),
        hitTesting: hitTesting(viewer), memory: heap()};
      records.push(record);
    }
    // Finish every ordinary sample before installing wrappers. Even restored
    // wrappers can deoptimize hot call sites and bias subsequent timing passes.
    if (options.profile) {
      for (const record of records) {
        await zoomTo(viewer, record.zoom);
        const profile = new CGVRenderingProfile(viewer);
        try {
          record.profile = {};
          for (const method of ['drawFast', 'drawFull', 'drawExport']) {
            await nextFrame();
            profile.reset();
            start = performance.now();
            viewer.layout[method]();
            if (method === 'drawFull') await settle(viewer);
            record.profile[method] = {elapsedMs: performance.now() - start, ...profile.snapshot()};
          }
          profile.reset();
          hitTesting(viewer);
          record.profile.hitTesting = profile.snapshot();
        } finally {
          profile.restore();
        }
      }
    }
    return {dataset: identity, width: viewer.width, height: viewer.height,
      pixelRatio: viewer.canvas.pixelRatio, featureCount: viewer.features().length,
      fastFeaturesPerSlot: viewer.layout.fastFeaturesPerSlot,
      setup: {generationMs, viewerCreationMs, loadJSONSyncMs, loadJSONSettledMs},
      memory: {before: memoryBefore, withJSON: memoryWithJSON, afterLoad: memoryAfterLoad,
        note: 'Chromium JS heap observations without forced GC, not retained heap, process RSS, or Canvas/GPU memory.'},
      records};
  }

  globalThis.CGVRenderingBenchmark = {generate, statistics, settle, run};
})();
