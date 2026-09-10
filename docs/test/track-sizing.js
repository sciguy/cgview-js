// Track sizing controls use the library's computed overview readout and sizing
// operation. No per-session baseline or layout calculations are kept here.
(function initializeTrackSizingControls() {
  const trackSelect = document.getElementById('track-sizing-track');
  const modeSelect = document.getElementById('track-sizing-mode');
  const numberInput = document.getElementById('track-sizing-value');
  const valueLabel = document.getElementById('track-sizing-value-label');
  const slider = document.getElementById('track-sizing-slider');
  const overviewOutput = document.getElementById('track-sizing-overview');
  const renderedOutput = document.getElementById('track-sizing-rendered');
  const countOutput = document.getElementById('track-sizing-count');
  const help = document.getElementById('track-sizing-help');
  const status = document.getElementById('track-sizing-status');
  let syncFrame;
  let drawFrame;
  let errorMessage = '';
  let editingNumber = false;

  function selectedTrack() {
    return cgv.tracks().find(track => track.cgvID === trackSelect.value);
  }

  function displayNumber(value) {
    return Number.isFinite(value) ? String(Number(value.toPrecision(5))) : 'n/a';
  }

  function syncControls() {
    const tracks = cgv.tracks();
    const track = selectedTrack() || tracks.find(item => item.visible) || tracks[0];
    const options = tracks.map((item, index) => ({
      value: item.cgvID,
      text: `${index + 1}. ${item.name} (${item.type === 'plot' ? 'Plot' : 'Feature'}${item.visible ? '' : ', hidden'})`,
    }));
    // Avoid rebuilding a focused selector on every zoom/slider event.
    if (options.length !== trackSelect.options.length || options.some((item, i) =>
      item.value !== trackSelect.options[i].value || item.text !== trackSelect.options[i].text)) {
      trackSelect.replaceChildren(...options.map(item => new Option(item.text, item.value)));
    }
    trackSelect.value = track?.cgvID || '';
    trackSelect.disabled = tracks.length === 0;
    const slots = track?.visible ? track.slots().filter(slot => slot.visible) : [];
    const overview = track?.computedInitialSlotThickness;
    const unavailable = cgv.loading ? 'Wait for the map to finish loading.' :
      !track ? 'This map has no tracks to resize.' :
      !track.visible ? 'Show this track before resizing it here.' :
      slots.length === 0 ? 'This track has no visible slots to resize.' :
      !Number.isFinite(overview) || overview <= 0 ? 'Overview sizing is unavailable for this layout.' : '';
    for (const control of [numberInput, slider, modeSelect]) {
      control.disabled = Boolean(unavailable);
    }
    const pixels = modeSelect.value === 'pixels';
    valueLabel.textContent = pixels ? 'Pixels per slot' : 'Relative ratio';
    slider.setAttribute('aria-label', valueLabel.textContent);
    help.textContent = pixels ?
      'Pixels per visible slot at zoom 1, excluding dividers. Preserves other overview widths. Zoom and canvas resizing can change widths; shared limits may prevent extreme targets.' :
      'Actual thicknessRatio weight. Redistributes existing space, so other tracks may change width. Equal ratios give equal slot widths.';
    const value = pixels ? overview : track?.thicknessRatio;
    // Zoom/settings/resize events can refresh readouts between keystrokes.
    // Keep the pending numeric edit until it is submitted or loses focus.
    if (!editingNumber || unavailable) {
      numberInput.value = unavailable ? '' : String(Number(value.toPrecision(12)));
    }
    // Extend the slider for existing values; the numeric input has no upper
    // bound. Both represent the actual API value, not a saved original ratio.
    slider.min = String(Math.min(pixels ? 0.1 : 0.05, value || 1));
    slider.max = String(Math.max(pixels ? 100 : 5, Math.ceil(value || 1)));
    slider.value = String(value || slider.min);
    slider.setAttribute('aria-valuetext', `${displayNumber(value)} ${pixels ? 'pixels per slot at overview' : 'relative ratio'}`);
    overviewOutput.value = displayNumber(overview);
    renderedOutput.value = displayNumber(slots[0]?.thickness);
    countOutput.value = String(slots.length);
    status.textContent = unavailable || errorMessage;
  }

  function requestSync() {
    if (syncFrame !== undefined) { return; }
    syncFrame = requestAnimationFrame(() => {
      syncFrame = undefined;
      syncControls();
    });
  }

  function requestDraw(full) {
    if (drawFrame !== undefined) { cancelAnimationFrame(drawFrame); }
    drawFrame = requestAnimationFrame(() => {
      drawFrame = undefined;
      full ? cgv.drawFull() : cgv.drawFast();
      syncControls();
    });
  }

  function applyValue(value, full = false) {
    editingNumber = false;
    const track = selectedTrack();
    if (!track || numberInput.disabled) { return; }
    try {
      track.setThickness(value, {mode: modeSelect.value});
      errorMessage = '';
      syncControls();
      requestDraw(full);
    } catch (error) {
      errorMessage = error.message;
      syncControls();
    }
  }

  numberInput.addEventListener('input', () => { editingNumber = true; });
  numberInput.addEventListener('change', () => applyValue(numberInput.valueAsNumber, true));
  numberInput.addEventListener('blur', () => {
    editingNumber = false;
    syncControls();
  });
  slider.addEventListener('input', () => applyValue(slider.valueAsNumber));
  slider.addEventListener('change', () => requestDraw(true));
  for (const select of [trackSelect, modeSelect]) {
    select.addEventListener('change', () => {
      editingNumber = false;
      errorMessage = '';
      syncControls();
    });
  }
  for (const event of ['tracks-add', 'tracks-update', 'tracks-remove', 'tracks-moved',
    'settings-update', 'viewer-update', 'zoom', 'zoom-end', 'features-add', 'features-update',
    'features-remove', 'plots-add', 'plots-update', 'plots-remove', 'contigs-update', 'sequence-update']) {
    cgv.on(`${event}.track-sizing`, requestSync);
  }
  cgv.on('cgv-json-load.track-sizing', () => {
    editingNumber = false;
    errorMessage = '';
    requestSync(); // The load event precedes synchronous record replacement.
  });
  // Viewer.resize() has no resize event. Observe the viewer's DOM dimensions
  // to catch both the page's size checkbox and direct API canvas resizing.
  const resizeObserver = new ResizeObserver(requestSync);
  resizeObserver.observe(document.getElementById('my-viewer'));
  syncControls();
})();
