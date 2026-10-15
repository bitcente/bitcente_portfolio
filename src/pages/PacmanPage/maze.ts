// The maze of the arcade, tile by tile. The screen is 28 x 36 tiles of 8 px (224 x 288): 3 rows of score over the
// maze, the 31 rows of the maze, and 2 rows of lives and fruits under it. Everything in the game is in px of the
// maze (0, 0 is its top left corner), and the screen is drawn 3 rows lower

export const TILE = 8
export const COLS = 28
export const ROWS = 31
export const SCREEN_WIDTH = COLS * TILE
export const SCREEN_HEIGHT = 36 * TILE
// screen rows over the maze
export const MAZE_TOP = 3

// # wall, . dot, o energizer, - door of the ghost house, _ inside of the house, space nothing (a path, or the tunnel)
const LAYOUT = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "######.##### ## #####.######",
  "######.##          ##.######",
  "######.## ###--### ##.######",
  "######.## #______# ##.######",
  "      .   #______#   .      ",
  "######.## #______# ##.######",
  "######.## ######## ##.######",
  "######.##          ##.######",
  "######.## ######## ##.######",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......  .......##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
]

// row of the tunnel, the one that goes out of the maze at both sides
export const TUNNEL_ROW = 14

export const tileAt = (col: number, row: number) => {
  if (row === TUNNEL_ROW && (col < 0 || col >= COLS)) return " "
  return LAYOUT[row]?.[col] ?? "#"
}

// a tile pacman and the ghosts can go through (the ghost house and its door are only for the ghosts, scripted)
export const isOpen = (col: number, row: number) => !"#-_".includes(tileAt(col, row))
export const isWall = (col: number, row: number) => tileAt(col, row) === "#"
export const isHouse = (col: number, row: number) => "-_".includes(tileAt(col, row))

// the ghosts go slower in the tunnel, and its sides are out of the screen
export const inTunnel = (col: number, row: number) => row === TUNNEL_ROW && (col <= 5 || col >= COLS - 6)

// above the ghost house and over the start of pacman the ghosts can't turn up (unless they're blue)
export const noUpTurn = (col: number, row: number) => (row === 11 || row === 23) && col >= 12 && col <= 15

// the dots of a new maze, by tile: 1 a dot, 2 an energizer
export function freshDots() {
  return LAYOUT.map((row) => [...row].map((tile) => tile === "." ? 1 : tile === "o" ? 2 : 0))
}

export const TOTAL_DOTS = LAYOUT.join("").replace(/[^.o]/g, "").length

// px of the centre of a tile, and the tile a px is in
export const center = (tile: number) => tile * TILE + 4
export const tileOf = (px: number) => Math.floor(px / TILE)

// places, in px of the maze
// in the middle of two tiles: the centre of the house, the start of pacman and the door
export const MIDDLE_X = 14 * TILE
export const DOOR_Y = center(11)
export const HOUSE_Y = center(14)
export const PACMAN_START = { x: MIDDLE_X, y: center(23) }
export const FRUIT_PLACE = { x: MIDDLE_X, y: center(17) }
