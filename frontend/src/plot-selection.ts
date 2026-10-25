/** Both 2D and raycast grids share top-left cell coordinates and the 12-cell limit. */
export function plotRectangle(
  a: [number, number],
  b: [number, number],
  cols: number,
  rows: number,
) {
  const x = Math.max(0, Math.min(cols - 1, Math.min(a[0], b[0]))),
    y = Math.max(0, Math.min(rows - 1, Math.min(a[1], b[1])));
  return {
    x,
    y,
    w: Math.min(12, cols - x, Math.abs(a[0] - b[0]) + 1),
    h: Math.min(12, rows - y, Math.abs(a[1] - b[1]) + 1),
  };
}
