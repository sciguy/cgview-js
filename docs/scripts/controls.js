
// Helper to add click handlers to buttons
const onClick = function(id, func) {
  const btn = document.getElementById(id);
  btn?.addEventListener('click', func);
}

// Reset Map Button
onClick('btn-reset', () => {
  cgv.reset();
});

// Zoom In Button
onClick('btn-zoom-in', () => {
   cgv.zoomIn()
});

// Zoom Out Button
onClick('btn-zoom-out', () => {
   cgv.zoomOut()
});

// Move Left/Counter-Clockwise
onClick('btn-move-left', () => {
  cgv.moveLeft();
});

// Move Right/Clockwise
onClick('btn-move-right', () => {
  cgv.moveRight();
});

// Change Map Format Linear <-> Circular
onClick('btn-toggle-format', () => {
  const format = (cgv.format == 'circular') ? 'linear' : 'circular';
  cgv.settings.update({ format: format });
  cgv.draw();
});

// Invert the Map Colors
onClick('btn-invert-colors', () => {
  cgv.invertColors();
});

// Move to Random Feature
onClick('btn-random-feature', () => {
  // Choose a random feature
  const number = Math.ceil(Math.random() * cgv.features().length);
  const feature = cgv.features(number);
  // Take 1.5 seconds to move to the feature (the default is 1 second)
  feature.moveTo(1500);
});

// Download PNG
onClick('btn-download', () => {
  const height = 2000;
  // Here we adjust the width to be proportional to the height
  const width = cgv.width / cgv.height * height;
  cgv.io.downloadImage(width, height, 'cgview_map.png');
});

// Toggle Labels
onClick('btn-toggle-labels', () => {
  cgv.annotation.update({visible: !cgv.annotation.visible});
  cgv.draw();
});

// Toggle Random Animation
onClick('btn-animate', () => {
  cgv.isAnimating ? cgv.stopAnimate() : cgv.animate();
});

