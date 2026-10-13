// the 4 greens of color.css as hex strings, darkest first
export function getPalette(): string[] {
  const style = getComputedStyle(document.documentElement)
  return [1, 2, 3, 4].map((i) => style.getPropertyValue("--green-" + i).trim())
}

// '#RRGGBB' to 0..1 channels, untouched by any colour management
export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.replace("#", ""), 16)
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255]
}
