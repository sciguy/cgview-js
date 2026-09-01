class CGVPerformance {

  /**
   * Benchmark CGView drawing at representative zoom levels.
   *
   * The benchmark runs sequentially so each timing measures one completed
   * operation. Consumers should await the public `ready` promise.
   *
   * @param {Viewer} cgv - Viewer to benchmark.
   * @param {String} name - Display name for the benchmark.
   * @param {Number} iterations - Number of recorded iterations.
   * @param {Object} options - Benchmark configuration.
   * @param {Number} options.warmupIterations - Unrecorded warm-up iterations.
   * @param {Number[]} options.zoomLevels - Zoom factors to benchmark.
   * @param {Number} options.timeout - Readiness timeout in milliseconds.
   */
  constructor(cgv, name = 'My Test', iterations = 3, options = {}) {
    this.cgv = cgv;
    this.name = name;
    this.iterations = iterations;
    this.warmupIterations = options.warmupIterations ?? 1;
    this.zoomLevels = options.zoomLevels ?? [1, 5, 10];
    this.timeout = options.timeout ?? 60_000;
    this.results = {};

    for (const zoomLevel of this.zoomLevels) {
      this.results[zoomLevel] = {
        visibleRange: undefined,
        drawFast: [],
        drawFull: []
      };
    }

    this.ready = this.run();
  }

  async run() {
    await this.waitForSequenceTracks();

    const totalIterations = this.warmupIterations + this.iterations;
    for (let iteration = 0; iteration < totalIterations; iteration++) {
      const record = iteration >= this.warmupIterations;
      for (const zoomLevel of this.zoomLevels) {
        await this.zoomTo(zoomLevel);
        await this.measureDraws(zoomLevel, record);
      }
    }

    return this.results;
  }

  async waitForSequenceTracks() {
    const sequenceTracksReady = () => this.cgv.tracks().every((track) => {
      return track.dataMethod !== 'sequence' || track.loadProgress === 100;
    });

    await this.waitUntil(sequenceTracksReady, 'sequence-generated tracks');
  }

  zoomTo(zoomLevel) {
    const bp = (zoomLevel === 1) ? 0 : 1;
    return new Promise((resolve) => {
      this.cgv.zoomTo(bp, zoomLevel, {duration: 0, callback: resolve});
    });
  }

  async measureDraws(zoomLevel, record) {
    const cgv = this.cgv;
    const result = this.results[zoomLevel];
    result.visibleRange = cgv.backbone.visibleRange.length;

    let start = performance.now();
    cgv.drawFast();
    const drawFast = performance.now() - start;

    start = performance.now();
    cgv.drawFull();
    await this.waitUntil(() => !cgv.layout.fullDrawInProgress, 'full draw');
    const drawFull = performance.now() - start;

    if (record) {
      result.drawFast.push(drawFast);
      result.drawFull.push(drawFull);
    }
  }

  waitUntil(predicate, description) {
    const start = performance.now();

    return new Promise((resolve, reject) => {
      const check = () => {
        if (predicate()) {
          resolve();
        } else if ((performance.now() - start) >= this.timeout) {
          reject(new Error(`Timed out waiting for ${description}`));
        } else {
          setTimeout(check, 1);
        }
      };

      check();
    });
  }

  summary() {
    return this.zoomLevels.map((zoomLevel) => {
      const result = this.results[zoomLevel];
      return {
        zoomLevel,
        visibleRange: result.visibleRange,
        drawFast: this.statistics(result.drawFast),
        drawFull: this.statistics(result.drawFull)
      };
    });
  }

  statistics(samples) {
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      median: this.percentile(sorted, 0.5),
      p90: this.percentile(sorted, 0.9),
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }

  percentile(sortedSamples, percentile) {
    if (sortedSamples.length === 0) return undefined;
    const index = Math.ceil(percentile * sortedSamples.length) - 1;
    return sortedSamples[Math.max(0, index)];
  }

  toJSON() {
    return {
      schemaVersion: 1,
      name: this.name,
      featureCount: this.cgv.features().length,
      width: this.cgv.width,
      height: this.cgv.height,
      iterations: this.iterations,
      warmupIterations: this.warmupIterations,
      zoomLevels: this.zoomLevels,
      results: this.results,
      summary: this.summary()
    };
  }

  report() {
    const featureCount = d3.format(',')(this.cgv.features().length);
    let text = `<pre><strong>${this.name} [${featureCount} features]</strong>\n`;
    text += 'Median draw time (ms)\n';
    text += '  Zoom    Fast    Full    Visible Range (bp)\n';

    for (const result of this.summary()) {
      const zoom = `${result.zoomLevel}x`.padStart(6);
      const fast = Math.round(result.drawFast.median).toString().padStart(8);
      const full = Math.round(result.drawFull.median).toString().padStart(8);
      const visibleRange = d3.format(',')(result.visibleRange).padStart(22);
      text += `${zoom}${fast}${full}${visibleRange}\n`;
    }

    text += '--------------------------------\nDetails:\n';
    for (const zoomLevel of this.zoomLevels) {
      const result = this.results[zoomLevel];
      const fast = result.drawFast.map((value) => value.toFixed(2)).join(', ');
      const full = result.drawFull.map((value) => value.toFixed(2)).join(', ');
      text += ` - Zoom ${zoomLevel}x fast: ${fast}\n`;
      text += ` - Zoom ${zoomLevel}x full: ${full}\n`;
    }

    return `${text}</pre>`;
  }

}

globalThis.CGVPerformance = CGVPerformance;
