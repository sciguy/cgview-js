// ColorPicker
//////////////////////////////////////////////////////////////////////////////

import Color from './Color';
import utils from './Utils';
import * as d3 from 'd3';

/**
 * @private
 */
class ColorPicker {


  /**
   * The ColorPicker is based on the [Flexi Color Picker](http://www.daviddurman.com/flexi-color-picker).
   * Color is stored internally as HSV, as well as a Color object.
   * @private
   */
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this._object = options.object;
    this.container = d3.select(`#${containerId}`).node();
    this.localStorageKey = "cgv-colorpicker-favorites";
    this._width = utils.defaultFor(options.width, 100);
    this._height = utils.defaultFor(options.height, 100);

    this._color = new Color( utils.defaultFor(options.colorString, 'rgba(255,0,0,1)') );
    this.hsv = this._color.hsv;
    this.opacity = this._color.opacity;
    this.favorites = [];
    this.maxFavorites = 6;

    this.onChange = options.onChange;
    this.onClose = options.onClose;

    this.container.innerHTML = this._colorpickerHTMLSnippet();
    d3.select(this.container).classed('cp-dialog', true);
    this.dialogElement = this.container.getElementsByClassName('cp-dialog')[0];
    this.slideElement = this.container.getElementsByClassName('cp-color-slider')[0];
    this.pickerElement = this.container.getElementsByClassName('cp-color-picker')[0];
    this.alphaElement = this.container.getElementsByClassName('cp-alpha-slider')[0];
    this.slideIndicator = this.container.getElementsByClassName('cp-color-slider-indicator')[0];
    this.pickerIndicator = this.container.getElementsByClassName('cp-color-picker-indicator')[0];
    this.pickerIndicatorRect1 = this.container.getElementsByClassName('cp-picker-indicator-rect-1')[0];
    this.alphaIndicator = this.container.getElementsByClassName('cp-alpha-slider-indicator')[0];
    this.currentColorIndicator = this.container.getElementsByClassName('cp-color-current')[0];
    this.originalColorIndicator = this.container.getElementsByClassName('cp-color-original')[0];
    this.hexInput = this.container.getElementsByClassName('cp-hex-input')[0];
    this.rgbRInput = this.container.getElementsByClassName('cp-rgb-r-input')[0];
    this.rgbGInput = this.container.getElementsByClassName('cp-rgb-g-input')[0];
    this.rgbBInput = this.container.getElementsByClassName('cp-rgb-b-input')[0];
    this.rgbRLabel = this.container.querySelector('.cp-rgb-r-input + .cp-number-label');
    this.rgbGLabel = this.container.querySelector('.cp-rgb-g-input + .cp-number-label');
    this.rgbBLabel = this.container.querySelector('.cp-rgb-b-input + .cp-number-label');
    this.alphaNumber = this.container.getElementsByClassName('cp-alpha-number')[0];
    this.swatchesElement = this.container.getElementsByClassName('cp-dialog-swatches')[0];
    this.doneButton = this.container.getElementsByClassName('cp-done-button')[0];
    this._configureView();
    this.addSwatches();
    this.favoritesElement = this.container.getElementsByClassName('cp-dialog-favorites')[0];

    // Prevent the indicators from getting in the way of mouse events
    // this.slideIndicator.style.pointerEvents = 'none';
    // this.pickerIndicator.style.pointerEvents = 'none';
    // this.alphaIndicator.style.pointerEvents = 'none';

    // D3Event will be passed the the listerners as first argument
    d3.select(this.slideElement).on('mousedown.click', this.slideListener());
    d3.select(this.pickerElement).on('mousedown.click', this.pickerListener());
    d3.select(this.alphaElement).on('mousedown.click', this.alphaListener());
    d3.select(this.originalColorIndicator).on('mousedown.click', this.originalColorListener());
    d3.select(this.doneButton).on('mousedown.click', this.doneListener());

    this.enableDragging(this, this.slideElement, this.slideListener());
    this.enableDragging(this, this.pickerElement, this.pickerListener());
    this.enableDragging(this, this.alphaElement, this.alphaListener());
    // TEMP disable dragging of dialog until we work on number inputs
    this.enableDragging(this, this.container, this.dialogListener());

    this.enableDragging(this, this.slideIndicator, this.slideListener());
    this.enableDragging(this, this.pickerIndicator, this.pickerListener());
    this.enableDragging(this, this.alphaIndicator, this.alphaListener());

    d3.select(this.hexInput).on('blur', this.hexListener());
    d3.select(this.hexInput).on('keydown', this.hexListener());
    d3.select(this.rgbRInput).on('input', this.rgbListener());
    d3.select(this.rgbGInput).on('input', this.rgbListener());
    d3.select(this.rgbBInput).on('input', this.rgbListener());

    // Prevent the number inputs from getting in the way of mouse events
    d3.selectAll('.cp-number-div input').on('mousedown', (e) => { e.stopPropagation() });

    this.enableDragging(this, this.rgbRLabel, this.rgbLabelListener(this.rgbRLabel, 'red'));
    this.enableDragging(this, this.rgbGLabel, this.rgbLabelListener(this.rgbGLabel, 'green'));
    this.enableDragging(this, this.rgbBLabel, this.rgbLabelListener(this.rgbBLabel, 'blue'));

    this.setColor(this._color);

    d3.select(this.container).style('visibility', 'hidden');
  }

  get color() {
    return this._color;
  }

  /**
   * Get or set the object currently associated with the color picker
   * @private
   */
  get object() {
    return this._object;
  }

  set object(value) {
    this._object = value;
  }

  updateColor() {
    this._color.hsv = this.hsv;
    // console.log(this.color.rgbString)
    this._color.opacity = this.opacity;
    this.updateIndicators();
    const pickerRgbString = Color.rgb2String( Color.hsv2rgb( {h: this.hsv.h, s: 1, v: 1} ) );
    this.pickerElement.style.backgroundColor = pickerRgbString;
    this.pickerIndicatorRect1.style.backgroundColor = this.color.rgbString;
    this.slideIndicator.style.backgroundColor = pickerRgbString;
    d3.select(this.alphaElement).selectAll('stop').attr('stop-color', this.color.rgbString);
    this.currentColorIndicator.style.backgroundColor = this.color.rgbaString;
    this.onChange && this.onChange(this.color);
  }

  setColor(value, updateOriginalColor=true) {
    this._color.setColor(value);
    this.hsv = this._color.hsv;
    this.opacity = Number(this._color.opacity.toFixed(2));
    if (updateOriginalColor) {
      this.originalColorIndicator.style.backgroundColor = this._color.rgbaString;
    }
    this.updateColor();
  }

  updateIndicators() {
    const hsv = this.hsv;
    const slideY = hsv.h * this.slideElement.offsetHeight / 360;
    const pickerHeight = this.pickerElement.offsetHeight;
    const pickerX = hsv.s * this.pickerElement.offsetWidth;
    const pickerY = pickerHeight - (hsv.v * pickerHeight);
    const alphaX = this.alphaElement.offsetWidth * this.opacity;

    const pickerIndicator = this.pickerIndicator;
    const slideIndicator = this.slideIndicator;
    const alphaIndicator = this.alphaIndicator;
    slideIndicator.style.top = `${slideY - (slideIndicator.offsetHeight / 2)}px`;
    pickerIndicator.style.top = `${pickerY - (pickerIndicator.offsetHeight / 2)}px`;
    pickerIndicator.style.left = `${pickerX - (pickerIndicator.offsetWidth / 2)}px`;
    alphaIndicator.style.left = `${alphaX - (alphaIndicator.offsetWidth / 2)}px`;

    this.hexInput.value = this.color.hex;
    this.rgbRInput.value = this.color.rgb.r;
    this.rgbGInput.value = this.color.rgb.g;
    this.rgbBInput.value = this.color.rgb.b;

    this.alphaNumber.innerHTML = `${Math.round(this.opacity * 100)}`;

    this.updateFavorites();
    this.highlightSwatches();
    this.highlightFavoriteBtn();
  }

  setPosition(pos) {
    this.container.style.left = `${pos.x}px`;
    this.container.style.top = `${pos.y}px`;
  }

  get width() {
    return this.container.offsetWidth;
  }

  get height() {
    return this.container.offsetHeight;
  }

  _colorpickerHTMLSnippet() {
    return [
      '<div class="cp-color-picker-wrapper">',
      '<div class="cp-color-picker"></div>',
      // '<div class="cp-color-picker-indicator"></div>',
      '<div class="cp-color-picker-indicator">',
      '<div class="cp-picker-indicator-rect-1"></div>',
      '<div class="cp-picker-indicator-rect-2"></div>',
      '</div>',
      '</div>',
      '<div class="cp-color-slider-wrapper">',
      '<div class="cp-color-slider"></div>',
      // '<div class="cp-color-slider-indicator"></div>',
      '<div class="cp-color-slider-indicator">',
      '<div class="cp-color-indicator-rect-1"></div>',
      '<div class="cp-color-indicator-rect-2"></div>',
      '</div>',
      '</div>',
      '<div class="cp-alpha-wrapper">',
      '<div class="cp-alpha-slider-wrapper">',
      '<div class="cp-alpha-slider"></div>',
      // '<div class="cp-alpha-slider-indicator"></div>',
      '<div class="cp-alpha-slider-indicator">',
      '<div class="cp-alpha-indicator-rect-1"></div>',
      '<div class="cp-alpha-indicator-rect-2"></div>',
      '</div>',
      '</div>',
      '<div class="cp-alpha-number"></div>',
      '</div>',
      '<div class="cp-dialog-numbers">',
      '<div class="cp-number-div cp-hex-div"><input type="text" class="cp-hex-input"  spellcheck="false" /><div class="cp-number-label">Hex</div></div>',
      '<div class="cp-number-div"><input type="text" maxlength="3" class="cp-rgb-r-input" /><div class="cp-number-label">R</div></div>',
      '<div class="cp-number-div"><input type="text" maxlength="3" class="cp-rgb-g-input" /><div class="cp-number-label">G</div></div>',
      '<div class="cp-number-div"><input type="text" maxlength="3" class="cp-rgb-b-input" /><div class="cp-number-label">B</div></div>',
      '</div>',
      '<div class="cp-dialog-swatches">',
      '</div>',
      '<div class="cp-dialog-footer">',
      '<div class="cp-footer-color-section">',
      '<div class="cp-color-original" title="Original Color"></div>',
      '<div class="cp-color-current"></div>',
      '</div>',
      '<div class="cp-footer-button-section">',
      '<button class="cp-done-button">Done</button>',
      '</div>',
      '</div>'

    ].join('');
  }

  /**
   * Create slide, picker, and alpha markup
   * The container ID is used to make unique ids for the SVG defs
   * @private
   */
  _configureView() {
    const containerId = this.containerId;
    const slide = $el('svg', { xmlns: 'http://www.w3.org/2000/svg', version: '1.1', width: '20px', height: '100px' },
      [
        $el('defs', {},
          $el('linearGradient', { id: `${containerId}-gradient-hsv`, x1: '0%', y1: '100%', x2: '0%', y2: '0%'},
            [
              $el('stop', { offset: '0%', 'stop-color': '#FF0000', 'stop-opacity': '1' }),
              $el('stop', { offset: '13%', 'stop-color': '#FF00FF', 'stop-opacity': '1' }),
              $el('stop', { offset: '25%', 'stop-color': '#8000FF', 'stop-opacity': '1' }),
              $el('stop', { offset: '38%', 'stop-color': '#0040FF', 'stop-opacity': '1' }),
              $el('stop', { offset: '50%', 'stop-color': '#00FFFF', 'stop-opacity': '1' }),
              $el('stop', { offset: '63%', 'stop-color': '#00FF40', 'stop-opacity': '1' }),
              $el('stop', { offset: '75%', 'stop-color': '#0BED00', 'stop-opacity': '1' }),
              $el('stop', { offset: '88%', 'stop-color': '#FFFF00', 'stop-opacity': '1' }),
              $el('stop', { offset: '100%', 'stop-color': '#FF0000', 'stop-opacity': '1' })
            ]
          )
        ),
        $el('rect', { x: '0', y: '0', width: '20px', height: '100px', rx: '2px', fill: `url(#${containerId}-gradient-hsv)`})
      ]
    );

    const picker = $el('svg', { xmlns: 'http://www.w3.org/2000/svg', version: '1.1', width: '100px', height: '100px' },
      [
        $el('defs', {},
          [
            $el('linearGradient', { id: `${containerId}-gradient-black`, x1: '0%', y1: '100%', x2: '0%', y2: '0%'},
              [
                $el('stop', { offset: '0%', 'stop-color': '#000000', 'stop-opacity': '1' }),
                $el('stop', { offset: '100%', 'stop-color': '#CC9A81', 'stop-opacity': '0' })
              ]
            ),
            $el('linearGradient', { id: `${containerId}-gradient-white`, x1: '0%', y1: '100%', x2: '100%', y2: '100%'},
              [
                $el('stop', { offset: '0%', 'stop-color': '#FFFFFF', 'stop-opacity': '1' }),
                $el('stop', { offset: '100%', 'stop-color': '#CC9A81', 'stop-opacity': '0' })
              ]
            )
          ]
        ),
        $el('rect', { x: '0', y: '0', width: '100px', height: '100px', rx: '2px', fill: `url(#${containerId}-gradient-white)`}),
        $el('rect', { x: '0', y: '0', width: '100px', height: '100px', rx: '2px', fill: `url(#${containerId}-gradient-black)`})
      ]
    );

    const alpha = $el('svg', { xmlns: 'http://www.w3.org/2000/svg', version: '1.1', width: '100px', height: '10px', style: 'position: absolute;' },
      [
        $el('defs', {},
          [
            $el('linearGradient', { id: `${containerId}-alpha-gradient` },
              [
                $el('stop', { offset: '0%', 'stop-color': '#FFFFFF', 'stop-opacity': '0' }),
                $el('stop', { offset: '100%', 'stop-color': '#FFFFFF', 'stop-opacity': '1' })
              ]
            ),
            $el('pattern', { id: `${containerId}-alpha-squares`, x: '0', y: '0', width: '10px', height: '10px', patternUnits: 'userSpaceOnUse' },
              [
                $el('rect', { x: '0', y: '0', width: '10px', height: '10px', fill: 'white'}),
                $el('rect', { x: '0', y: '0', width: '5px', height: '5px', fill: 'lightgray'}),
                $el('rect', { x: '5px', y: '5px', width: '5px', height: '5px', fill: 'lightgray'})
              ]
            )
          ]
        ),
        $el('rect', { x: '0', y: '0', width: '100px', height: '10px', rx: '2px', fill: `url(#${containerId}-alpha-squares)`}),
        $el('rect', { x: '0', y: '0', width: '100px', height: '10px', rx: '2px', fill: `url(#${containerId}-alpha-gradient)`})
      ]
    );

    this.slideElement.appendChild(slide);
    this.pickerElement.appendChild(picker);
    this.alphaElement.appendChild(alpha);
  }

  addSwatches() {
    const cp = this;
    // Paired R Brew Colors (light on top, dark on bottom)
    const swatchHexColors = [
      "#FFFFFF", "#A6CEE3", "#B2DF8A", "#FB9A99", "#FDBF6F", "#CAB2D6", "#FFFF99",
      "#000000", "#1F78B4", "#33A02C", "#E31A1C", "#FF7F00", "#6A3D9A", "#B15928"
    ];

    const swatchColors = swatchHexColors.map(hexColor => new Color(hexColor).rgbaString);
    // console.log(swatchColors);

    const swatchDivs = swatchColors.map(color => `<div class="cp-swatch" data-rgba-string='${color}' title='${color}' style="background-color: ${color}"></div>`).join('');
    cp.swatchesElement.innerHTML = `${swatchDivs}<div class='cp-dialog-favorites'></div>`;

    const swatches = cp.swatchesElement.getElementsByClassName('cp-swatch');
    for (const swatch of swatches) {
      swatch.addEventListener('click', function(e) {
        // console.log(swatch.dataset)
        const color = swatch.dataset.rgbaString;
        cp.setColor(color, false);
      });
    }
  }

  loadFavorites() {
    const cp = this;
    const favoritesString = localStorage.getItem(this.localStorageKey) || '[]';
    let favorites = JSON.parse(favoritesString);
    favorites = Array.isArray(favorites) ? favorites : [];
    cp.favorites = favorites.slice(0, cp.maxFavorites);
    this.updateFavorites();
  }

  updateFavorites() {
    const cp = this;
    // Favorite Swatches
    const currentColor = cp.color.rgbaString;
    const swatchDivs = cp.favorites?.map(color => `<div data-rgba-string='${color}' title="${color}" class="cp-swatch ${(color === currentColor) ? 'cp-swatch-active' : ''}" style="background-color: ${color}"></div>`).join('');

    // Blank Swatches
    const blanksCount = cp.maxFavorites - cp.favorites.length;
    const blankSVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 15 15'><path d='M15 0 L0 15 '/><path d='M0 0 L15 15 ' /></svg>";
    const blanks = Array(blanksCount).fill(`<div class="cp-swatch-blank">${blankSVG}</div>`).join('');

    // Star Favorite SVG
    const svgStar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 51 48"><path fill="none" stroke="#000" d="m25,1 6,17h18l-14,11 5,17-15-10-15,10 5-17-14-11h18z"/></svg>';

    // Put is all together
    cp.favoritesElement.innerHTML = `<div class='cp-favorite-btn' title='Favorite current color'>${svgStar}</div>${swatchDivs}${blanks}`;

    // Add click handler to favorite star and store favorite color in local storage
    this.favoriteBtn = this.container.querySelector('.cp-favorite-btn');
    d3.select(this.favoriteBtn).on('click', () => {
      if (cp.favorites.includes(cp.color.rgbaString)) {
        cp.favorites = cp.favorites.filter(color => color !== cp.color.rgbaString);
      } else {
        cp.favorites.unshift(cp.color.rgbaString);
      }
      cp.favorites = cp.favorites.slice(0, cp.maxFavorites);
      localStorage.setItem(this.localStorageKey, JSON.stringify(cp.favorites));
      cp.updateIndicators();
    });

    // Highlight the favorite button if the current color is a favorite
    cp.highlightFavoriteBtn();

    // Add favorite swatch click handler
    const swatches = cp.favoritesElement.getElementsByClassName('cp-swatch');
    for (const swatch of swatches) {
      swatch.addEventListener('click', function(e) {
        const color = swatch.dataset.rgbaString;
        cp.setColor(color, false);
      });
    }
  }

  // apply the active class to the swatches that matches the current color
  highlightSwatches() {
    const cp = this;
    const currentColor = cp.color.rgbaString;
    const swatches = cp.swatchesElement.getElementsByClassName('cp-swatch');
    for (const swatch of swatches) {
      const swatchColor = new Color(swatch.style.backgroundColor);
      // console.log(swatchColor.rgbaString, currentColor)
      if (swatchColor.rgbaString === currentColor) {
        swatch.classList.add('cp-swatch-active');
      } else {
        swatch.classList.remove('cp-swatch-active');
      }
    }
  }

  highlightFavoriteBtn() {
    const cp = this;
    const currentColor = cp.color.rgbaString;
    if (cp.favorites.includes(currentColor)) {
      cp.favoriteBtn.classList.add('cp-favorite-btn-active');
      cp.favoriteBtn.title = 'Unfavorite current color';
    } else {
      cp.favoriteBtn.classList.remove('cp-favorite-btn-active');
      cp.favoriteBtn.title = 'Favorite current color';
    }
  }

  /**
  * Enable drag&drop color selection.
  * @param {object} ctx ColorPicker instance.
  * @param {DOMElement} element HSV slide element or HSV picker element.
  * @param {Function} listener Function that will be called whenever mouse is dragged over the element with event object as argument.
   * @private
  */
  enableDragging(ctx, element, listener) {
    d3.select(element).on('mousedown', function(d3EventMouseDown) {
      d3EventMouseDown.preventDefault();
      d3EventMouseDown.stopPropagation();
      const mouseStart = mousePosition(element, d3EventMouseDown);
      d3.select(document).on('mousemove.colordrag', function(d3EventMouseMove) {
        if (document.selection) {
          document.selection.empty();
        } else {
          window.getSelection().removeAllRanges();
        }
        listener(d3EventMouseMove, mouseStart);
      });
      d3.select(document).on('mouseup', function() {
        d3.select(document).on('mousemove.colordrag', null);
      });
    });
  }

  /**
   * Return click event handler for the slider.
   * Sets picker background color and calls ctx.callback if provided.
   * @private
   */
  slideListener() {
    const cp = this;
    const slideElement = cp.slideElement;
    return function(d3Event, mouseStart) {
      const mouse = mousePosition(slideElement, d3Event);
      cp.hsv.h = mouse.y / slideElement.offsetHeight * 360;// + cp.hueOffset;
      // Hack to fix indicator bug
      if (cp.hsv.h >= 359) { cp.hsv.h = 359;}
      cp.updateColor();
    };
  }

  /**
   * Return click event handler for the picker.
   * Calls ctx.callback if provided.
   * @private
   */
  pickerListener() {
    const cp = this;
    const pickerElement = cp.pickerElement;
    return function(d3Event, mouseStart) {
      const width = pickerElement.offsetWidth;
      const height = pickerElement.offsetHeight;
      const mouse = mousePosition(pickerElement, d3Event);
      cp.hsv.s = mouse.x / width;
      cp.hsv.v = (height - mouse.y) / height;
      cp.updateColor();
    };
  }

  /**
   * Return click event handler for the alpha.
   * Sets alpha background color and calls ctx.callback if provided.
   * @private
   */
  alphaListener() {
    const cp = this;
    const alphaElement = cp.alphaElement;
    return function(d3Event, mouseStart) {
      const mouse = mousePosition(alphaElement, d3Event);
      const opacity =  mouse.x / alphaElement.offsetWidth;
      cp.opacity = Number(opacity.toFixed(2));
      cp.updateColor();
    };
  }

  /**
   * Return click event handler for the RGB Labels.
   * Sets alpha background color and calls ctx.callback if provided.
   * @private
   */
  rgbLabelListener(labelElement, colorName) {
    const cp = this;
    const rInput = cp.rgbRInput;
    const gInput = cp.rgbGInput;
    const bInput = cp.rgbBInput;
    return function(d3Event, mouseStart) {
      let currentValue = parseInt(rInput.value);
      if (colorName === 'green') { currentValue = parseInt(gInput.value); }
      if (colorName === 'blue') { currentValue = parseInt(bInput.value); }
      const mouse = mousePosition(labelElement, d3Event, false);
      const mouseDistance = Math.floor(mouse.x - mouseStart.x);
      let newValue = currentValue + mouseDistance
      newValue = utils.constrain(newValue, 0, 255);
      const hsv = Color.rgb2hsv({
        r: (colorName === 'red')   ? newValue: parseInt(rInput.value),
        g: (colorName === 'green') ? newValue: parseInt(gInput.value),
        b: (colorName === 'blue')  ? newValue: parseInt(bInput.value),
      });
      cp.hsv = hsv;
      cp.updateColor();
      mouseStart.x = mouse.x;
    };
  }


  /**
   * Return change event handler for Hex input.
   * This will also allow Hex values, color names and rgb() values.
   * SHould be called for blur and keydown events. But all keydown events are ignored unless it is the enter key.
   * @private
   */
  hexListener() {
    const cp = this;
    const hexInput = cp.hexInput;
    return function(d3Event) {
      if (d3Event.type === 'keydown' && d3Event.keyCode !== 13) { return; }

      // Add "#" if values are hex values
      let value = hexInput.value;
      let regex = new RegExp(/^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
      if (regex.test(value)) {
        value = "#" + value;
      }

      // If nothing is provided, set to current color
      if (value === '') {
        value = cp.color.rgbString;
      }

      cp.setColor(value, false);
    };
  }

  /**
   * Return change event handler for RGB input.
   * @private
   */
  rgbListener() {
    const cp = this;
    const rInput = cp.rgbRInput;
    const gInput = cp.rgbGInput;
    const bInput = cp.rgbBInput;
    return function(d3Event) {
      // console.log(d3Event)
      // console.log(rInput.value, gInput.value, bInput.value)

      let r = parseInt(rInput.value.replace(/[^0-9]/g, ''));
      if (r > 255) { r = 255; }
      let g = parseInt(gInput.value.replace(/[^0-9]/g, ''));
      if (g > 255) { g = 255; }
      let b = parseInt(bInput.value.replace(/[^0-9]/g, ''));
      if (b > 255) { b = 255; }
      // console.log(r, g, b)

      const hsv = Color.rgb2hsv({r, g, b});
      cp.hsv = hsv;
      // console.log(Color.hsv2rgb(hsv))

      cp.updateColor();
    };
  }

  /**
   * Return click event handler for the dialog.
   * @private
   */
  dialogListener() {
    const cp = this;
    const container = cp.container;
    return function(d3Event, mouseStart) {
      const parentOffset = utils.getOffset(container.offsetParent);
      const offsetX = parentOffset.left;
      const offsetY = parentOffset.top;
      container.style.left = `${d3Event.pageX - offsetX - mouseStart.x}px`;
      container.style.top = `${d3Event.pageY - offsetY - mouseStart.y}px`;
    };
  }


  /**
   * Return click event handler for the original color.
   * @private
   */
  originalColorListener() {
    const cp = this;
    return function() {
      cp.setColor(cp.originalColorIndicator.style.backgroundColor);
    };
  }

  /**
   * Return click event handler for the done button.
   * @private
   */
  doneListener() {
    const cp = this;
    return function() {
      cp.onChange = undefined;
      cp.close();
    };
  }

  get visible() {
    return d3.select(this.container).style('visibility') === 'visible';
  }

  set visible(value) {
    value ? this.open() : this.close();
  }

  open(object) {
    this.loadFavorites();
    if (object) { this.object = object; }
    const box = d3.select(this.container);
    box.style('visibility', 'visible');
    box.transition().duration(200)
      .style('opacity', 1);
    return this;
  }

  close() {
    d3.select(this.container).transition().duration(200)
      .style('opacity', 0)
      .on('end', function() {
        d3.select(this).style('visibility', 'hidden');
      });
    this.onClose && this.onClose();
    this.onClose = undefined;
    return this;
  }

}

/**
 * Create SVG element.
 * @private
 */
function $el(el, attrs, children) {
  el = document.createElementNS('http://www.w3.org/2000/svg', el);
  for (const key in attrs) el.setAttribute(key, attrs[key]);
  if (Object.prototype.toString.call(children) !== '[object Array]') children = [children];
  const len = (children[0] && children.length) || 0;
  for (let i = 0; i < len; i++) el.appendChild(children[i]);
  return el;
}

/**
 * Return mouse position relative to the element el.
 * constrain (when true) keesp the mouse values within the element
 * @private
 */
function mousePosition(element, d3Event, constrain=true) {
  const width = element.offsetWidth;
  const height = element.offsetHeight;

  const pos = d3.pointer(d3Event, element);

  const mouse = {x: pos[0], y: pos[1]};
  if (constrain) {
    if (mouse.x > width) {
      mouse.x = width;
    } else if (mouse.x < 0) {
      mouse.x = 0;
    }
    if (mouse.y > height) {
      mouse.y = height;
    } else if (mouse.y < 0) {
      mouse.y = 0;
    }
  }
  return mouse;
}

export default ColorPicker;


