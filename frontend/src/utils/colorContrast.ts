/**
 * Calculate relative luminance of a color according to WCAG 2.0
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Parse a hex color string to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Handle 3-digit hex codes
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null
}

/**
 * Determines whether to use black or white text on a given background color
 * for optimal contrast and readability.
 *
 * @param backgroundColor - Hex color string (e.g., '#FF6B6B' or 'FF6B6B')
 * @returns '#000000' for black text or '#FFFFFF' for white text
 */
export function getContrastTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) {
    // Fallback to white if color parsing fails
    return '#FFFFFF'
  }

  const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b)

  // Use white text for dark backgrounds, black text for light backgrounds
  // Threshold of 0.5 works well for most cases
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}
