/**
 * SVG filter that maps luminance to the 4 classic Game Boy greens
 * (#0f380f #576833 #7F8E5A #A8B987). Referenced with `filter: url(#gb-palette)`.
 */
export function PaletteFilter() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <filter id="gb-palette" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"
        />
        <feComponentTransfer>
          <feFuncR type="discrete" tableValues="0.059 0.341 0.498 0.659" />
          <feFuncG type="discrete" tableValues="0.220 0.408 0.557 0.725" />
          <feFuncB type="discrete" tableValues="0.059 0.200 0.353 0.529" />
        </feComponentTransfer>
      </filter>
    </svg>
  );
}