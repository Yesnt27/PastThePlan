/** Resolves a file in /public. */
export const asset = (path: string) =>
  `/${path.replace(/^\//, "")}`

export const photo = (name: string) => asset(`assets/photos/${name}.jpg`)

/** Icons and art exported from the Figma comps. File names are the export hashes; keep them as-is. */
export const art = {
  // 01 Book – closed (Talent Design Comp)
  logo: asset("assets/book/ca89a.svg"),
  plusGlyph: asset("assets/book/96930.svg"),
  filterButton: asset("assets/book/24adb.svg"),
  backButton: asset("assets/book/e4edc.svg"),
  forwardButton: asset("assets/book/749c2.svg"),
  pencilButton: asset("assets/book/7ad94.svg"),
  stackButton: asset("assets/book/cb925.svg"),
  closeButton: asset("assets/book/0d4a7.svg"),
  spine: asset("assets/book/76103.png"),
  paperTexture: asset("assets/book/a56a7.png"),
  creatureBlue: asset("assets/book/d99ae.svg"),
  creatureEyes: asset("assets/book/f792f.svg"),
  creaturePurple: asset("assets/book/6aa5a.svg"),
  creatureGreen: asset("assets/book/7e319.svg"),
  // ASI:One frames (Lore Keeper flow)
  send: asset("assets/asi/d4ac4.svg"),
  pencil: asset("assets/asi/a6275.svg"),
  plus: asset("assets/asi/8ec55.svg"),
  search: asset("assets/asi/f56d6.svg"),
  check: asset("assets/asi/44b2f.svg"),
  lock: asset("assets/asi/0d3dd.svg"),
  chevronRight: asset("assets/asi/64c79.svg"),
} as const
