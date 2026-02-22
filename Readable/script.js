// Slider elements
const bgRed = document.getElementById('bg-red');
const bgGreen = document.getElementById('bg-green');
const bgBlue = document.getElementById('bg-blue');
const textRed = document.getElementById('text-red');
const textGreen = document.getElementById('text-green');
const textBlue = document.getElementById('text-blue');
const textSize = document.getElementById('text-size');
const areaWidth = document.getElementById('area-width');

// Value display elements
const bgRedValue = document.getElementById('bg-red-value');
const bgGreenValue = document.getElementById('bg-green-value');
const bgBlueValue = document.getElementById('bg-blue-value');
const textRedValue = document.getElementById('text-red-value');
const textGreenValue = document.getElementById('text-green-value');
const textBlueValue = document.getElementById('text-blue-value');
const textSizeValue = document.getElementById('text-size-value');
const areaWidthValue = document.getElementById('area-width-value');

// Swatch elements
const bgSwatch = document.getElementById('bg-swatch');
const textSwatch = document.getElementById('text-swatch');
const bgLargeSwatch = document.getElementById('bg-large-swatch');
const textLargeSwatch = document.getElementById('text-large-swatch');
const bgRgbDisplay = document.getElementById('bg-rgb-display');
const textRgbDisplay = document.getElementById('text-rgb-display');

// Preview element
const textPreview = document.getElementById('text-preview');

// Calculation display elements
const lumBg = document.getElementById('lum-bg');
const lumText = document.getElementById('lum-text');
const contrastRatioDisplay = document.getElementById('contrast-ratio');

// Badge elements
const badgeAA = document.getElementById('badge-aa');
const badgeAAA = document.getElementById('badge-aaa');
const aaStatus = document.getElementById('aa-status');
const aaaStatus = document.getElementById('aaa-status');

// WCAG thresholds
const AA_THRESHOLD = 4.5;
const AAA_THRESHOLD = 7.0;

/**
 * Calculate the relative luminance of an RGB color using WCAG 2.1 formula
 * @param {number} r - Red channel (0-255)
 * @param {number} g - Green channel (0-255)
 * @param {number} b - Blue channel (0-255)
 * @returns {number} Relative luminance (0-1)
 */
function calculateLuminance(r, g, b) {
  const linearize = (channel) => {
    const sRGB = channel / 255;
    if (sRGB <= 0.04045) {
      return sRGB / 12.92;
    } else {
      return Math.pow((sRGB + 0.055) / 1.055, 2.4);
    }
  };

  const rLinear = linearize(r);
  const gLinear = linearize(g);
  const bLinear = linearize(b);

  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two luminance values
 * @param {number} l1 - Luminance 1
 * @param {number} l2 - Luminance 2
 * @returns {number} Contrast ratio
 */
function calculateContrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Main update function - called on every slider change
 */
function update() {
  // Read all slider values
  const bgR = parseInt(bgRed.value);
  const bgG = parseInt(bgGreen.value);
  const bgB = parseInt(bgBlue.value);
  const txtR = parseInt(textRed.value);
  const txtG = parseInt(textGreen.value);
  const txtB = parseInt(textBlue.value);
  const size = parseInt(textSize.value);
  const width = parseInt(areaWidth.value);

  // Update value displays
  bgRedValue.textContent = bgR;
  bgGreenValue.textContent = bgG;
  bgBlueValue.textContent = bgB;
  textRedValue.textContent = txtR;
  textGreenValue.textContent = txtG;
  textBlueValue.textContent = txtB;
  textSizeValue.textContent = size + 'px';
  areaWidthValue.textContent = width + 'px';

  // Create RGB strings
  const bgColor = `rgb(${bgR}, ${bgG}, ${bgB})`;
  const textColor = `rgb(${txtR}, ${txtG}, ${txtB})`;

  // Update swatches
  bgSwatch.style.backgroundColor = bgColor;
  textSwatch.style.backgroundColor = textColor;
  bgLargeSwatch.style.backgroundColor = bgColor;
  textLargeSwatch.style.backgroundColor = textColor;
  bgRgbDisplay.textContent = bgColor;
  textRgbDisplay.textContent = textColor;

  // Update preview box
  textPreview.style.backgroundColor = bgColor;
  textPreview.style.color = textColor;
  textPreview.style.fontSize = size + 'px';
  textPreview.style.width = width + 'px';

  // Calculate luminance values
  const l1 = calculateLuminance(bgR, bgG, bgB);
  const l2 = calculateLuminance(txtR, txtG, txtB);

  // Calculate contrast ratio
  const ratio = calculateContrastRatio(l1, l2);

  // Update calculation displays
  lumBg.textContent = l1.toFixed(4);
  lumText.textContent = l2.toFixed(4);
  contrastRatioDisplay.textContent = ratio.toFixed(2) + ' : 1';

  // Update AA badge
  if (ratio >= AA_THRESHOLD) {
    badgeAA.classList.remove('fail');
    badgeAA.classList.add('pass');
    aaStatus.textContent = 'PASS';
  } else {
    badgeAA.classList.remove('pass');
    badgeAA.classList.add('fail');
    aaStatus.textContent = 'FAIL';
  }

  // Update AAA badge
  if (ratio >= AAA_THRESHOLD) {
    badgeAAA.classList.remove('fail');
    badgeAAA.classList.add('pass');
    aaaStatus.textContent = 'PASS';
  } else {
    badgeAAA.classList.remove('pass');
    badgeAAA.classList.add('fail');
    aaaStatus.textContent = 'FAIL';
  }
}

// Attach event listeners to all sliders
const sliders = [bgRed, bgGreen, bgBlue, textRed, textGreen, textBlue, textSize, areaWidth];
sliders.forEach(slider => {
  slider.addEventListener('input', update);
});

// Initialize display on page load
update();
