import '../docs/test/rendering-profile';

describe('development rendering profiler', () => {
  let profile;

  afterEach(() => { profile?.restore(); });

  function fixture() {
    let time = 0;
    const viewer = {};
    class Feature {
      constructor() { this.viewer = viewer; }
      draw() {
        time += 3;
        if (this.error) { throw this.error; }
        return this;
      }
    }
    const feature = new Feature();
    class Index {
      run(callback) {
        time += 2;
        callback(feature);
        time += 5;
        return 'finished';
      }
    }
    class Slot {
      constructor() { this.viewer = viewer; this._featureNCList = new Index(); }
      draw() { return this._featureNCList.run(item => item.draw()); }
    }
    class Context {
      constructor() { this._fillStyle = 'black'; }
      get fillStyle() { return this._fillStyle; }
      set fillStyle(value) { if (value) { this._fillStyle = value; } }
      beginPath() { time += 1; return this; }
    }
    const slot = new Slot();
    const context = new Context();
    Object.assign(viewer, {
      features: () => [feature], plots: () => [], slots: () => [slot],
      layout: {delegate: {}, drawFast() { return slot.draw(); }},
      canvas: {layerNames: ['map'], context: () => context},
    });
    return {viewer, feature, slot, context, now: () => time};
  }

  test('subtracts feature callback time from interval traversal and preserves return values', () => {
    const {viewer, now} = fixture();
    profile = new CGVRenderingProfile(viewer, {now});
    expect(viewer.layout.drawFast()).toBe('finished');
    const {timings} = profile.snapshot();
    expect(timings['lookup.run']).toEqual({calls: 1, inclusiveMs: 10, selfMs: 7});
    expect(timings['feature.draw']).toEqual({calls: 1, inclusiveMs: 3, selfMs: 3});
    expect(timings['slot.draw']).toEqual({calls: 1, inclusiveMs: 10, selfMs: 0});
    expect(timings['layout.drawFast']).toEqual({calls: 1, inclusiveMs: 10, selfMs: 0});
  });

  test('counts assignments separately from effective native style changes and restores descriptors', () => {
    const {viewer, context, now} = fixture();
    const originalMethod = context.beginPath;
    const originalStyle = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(context), 'fillStyle');
    profile = new CGVRenderingProfile(viewer, {now});
    expect(context.beginPath()).toBe(context);
    context.fillStyle = 'red';
    context.fillStyle = 'red';
    context.fillStyle = '';
    const {canvas, timings} = profile.snapshot();
    expect(canvas.methods.beginPath).toBe(1);
    expect(canvas.styles.fillStyle).toBe(3);
    expect(canvas.styleChanges.fillStyle).toBe(1);
    expect(canvas.layers.map.styles.fillStyle).toBe(3);
    expect(timings['context.beginPath']).toEqual({calls: 1, inclusiveMs: 1, selfMs: 1});
    profile.restore();
    expect(context.beginPath).toBe(originalMethod);
    expect(Object.hasOwn(context, 'beginPath')).toBe(false);
    expect(Object.hasOwn(context, 'fillStyle')).toBe(false);
    expect(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(context), 'fillStyle')).toEqual(originalStyle);
    expect(context.fillStyle).toBe('red');
  });

  test('unwinds failed calls, permits reset, and returns detached snapshots', () => {
    const {viewer, feature, now} = fixture();
    const error = new Error('render failed');
    feature.error = error;
    profile = new CGVRenderingProfile(viewer, {now});
    expect(() => viewer.layout.drawFast()).toThrow(error);
    expect(profile.snapshot().timings['lookup.run'].selfMs).toBe(2);
    profile.reset();
    expect(profile.snapshot().timings).toEqual({});
    feature.error = undefined;
    viewer.layout.drawFast();
    const first = profile.snapshot();
    viewer.layout.drawFast();
    expect(first.timings['feature.draw'].calls).toBe(1);
    expect(profile.snapshot().timings['feature.draw'].calls).toBe(2);
  });

  test('restores shared prototypes without overwriting subsequent method replacements', () => {
    const {viewer, feature, now} = fixture();
    const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(feature), 'draw');
    profile = new CGVRenderingProfile(viewer, {now});
    expect(() => new CGVRenderingProfile(viewer)).toThrow('Only one');
    const replacement = () => 'replacement';
    viewer.layout.drawFast = replacement;
    profile.restore();
    profile.restore();
    expect(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(feature), 'draw')).toEqual(original);
    expect(viewer.layout.drawFast).toBe(replacement);
    const next = new CGVRenderingProfile(viewer, {now});
    next.restore();
  });
});
