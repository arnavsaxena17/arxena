/**
 * Apply chroma key effect to a video frame on canvas
 * @param sourceVideo - Source video element
 * @param targetCanvas - Target canvas element
 * @param options - Chroma key options
 */
export const applyChromaKey = (
  sourceVideo: HTMLVideoElement,
  targetCanvas: HTMLCanvasElement,
  options: {
    minHue: number; // Minimum hue value (0-360)
    maxHue: number; // Maximum hue value (0-360)
    minSaturation: number; // Minimum saturation (0-1)
    threshold: number; // Threshold for green detection
  },
): void => {
  // Get canvas context
  const ctx = targetCanvas.getContext('2d', {
    willReadFrequently: true,
    alpha: true,
  });

  if (!ctx || sourceVideo.readyState < 2) return;

  // Set canvas dimensions to match video
  targetCanvas.width = sourceVideo.videoWidth;
  targetCanvas.height = sourceVideo.videoHeight;

  // Clear canvas
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

  // Draw video frame to canvas
  ctx.drawImage(sourceVideo, 0, 0, targetCanvas.width, targetCanvas.height);

  // Get image data for processing
  const imageData = ctx.getImageData(
    0,
    0,
    targetCanvas.width,
    targetCanvas.height,
  );
  const data = imageData.data;

  // Process each pixel
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Convert RGB to HSV
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    // Calculate hue
    let h = 0;
    if (delta === 0) {
      h = 0;
    } else if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }

    h = Math.round(h * 60);
    if (h < 0) h += 360;

    // Calculate saturation and value
    const s = max === 0 ? 0 : delta / max;
    const v = max / 255;

    // Check if pixel is in the green screen range
    const isGreen =
      h >= options.minHue &&
      h <= options.maxHue &&
      s > options.minSaturation &&
      v > 0.15 &&
      g > r * options.threshold &&
      g > b * options.threshold;

    // Apply transparency for green pixels
    if (isGreen) {
      const greenness = (g - Math.max(r, b)) / (g || 1);
      const alphaValue = Math.max(0, 1 - greenness * 4);
      data[i + 3] = alphaValue < 0.2 ? 0 : Math.round(alphaValue * 255);
    }
  }

  // Put processed image data back to canvas
  ctx.putImageData(imageData, 0, 0);
};

/**
 * Setup continuous chroma keying
 * @param sourceVideo - Source video element
 * @param targetCanvas - Target canvas element
 * @param options - Chroma key options
 * @returns - Function to stop the processing
 */
export const setupChromaKey = (
  sourceVideo: HTMLVideoElement,
  targetCanvas: HTMLCanvasElement,
  options: {
    minHue: number;
    maxHue: number;
    minSaturation: number;
    threshold: number;
  },
): (() => void) => {
  let animationFrameId: number | null = null;

  // Processing function
  const render = () => {
    applyChromaKey(sourceVideo, targetCanvas, options);
    animationFrameId = requestAnimationFrame(render);
  };

  // Start rendering
  render();

  // Return cleanup function
  return () => {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }
  };
};
