/**
 * Enhanced PDF Bullet Symbols Utility
 * Provides extended bullet symbols with Unicode, Emoji, and Mixed variants
 * 
 * User-requested symbols: •·∙◦❖✔☒☑⇢➔➙➜✅⚠️◼️▪️☒
 * Plus additional variants for comprehensive formatting
 */

export const EXTENDED_BULLET_SYMBOLS = {
  // ─── UNICODE SYMBOLS ─────────────────────────────────────────────────────
  unicode: {
    // Dots & Circles
    dot: '•',                    // Standard dot
    dotSmall: '·',               // Smaller dot
    dotMid: '∙',                 // Middle dot
    circle: '◦',                 // Hollow circle
    circleSmall: '∘',            // Small circle
    circleSolid: '●',            // Solid circle
    
    // Squares
    square: '◼',                 // Solid square
    squareSolid: '▪',            // Solid square (alt)
    squareHollow: '☐',           // Hollow square
    squareHollow2: '□',          // Hollow square (alt)
    squareCross: '☒',            // Crossed square
    squareCheck: '☑',            // Checked square
    squareRounded: '▢',          // Rounded square
    
    // Diamonds & Geometrics
    diamond: '◆',                // Solid diamond
    diamondHollow: '◇',          // Hollow diamond
    star: '★',                   // Solid star
    starOutline: '☆',            // Outline star
    
    // Arrows & Chevrons
    arrow: '➔',                  // Single arrow
    arrowDouble: '⇢',            // Double arrow
    arrowRight: '➙',             // Arrow right variant
    arrowRightLong: '➜',         // Long arrow right
    chevron: '›',                // Single chevron
    chevronDouble: '»',          // Double chevron
    
    // Special Symbols
    checkmark: '✔',              // Checkmark
    checkmarkHeavy: '✅',         // Heavy checkmark
    crossmark: '✘',              // Cross mark
    crossmarkHeavy: '✘',         // Heavy cross
    warning: '⚠️',               // Warning
    alert: '⚠',                  // Alert
    
    // Variations
    triangleRight: '▶',          // Triangle right
    triangleLeft: '◀',           // Triangle left
    triangleUp: '▲',             // Triangle up
    triangleDown: '▼',           // Triangle down
    dash: '—',                   // Em dash
    dashEn: '–',                 // En dash
    
    // Decorative
    fleuron: '❖',                // Fleuron (decorative)
    lozenge: '◊',                // Lozenge
    section: '§',                // Section symbol
    pilcrow: '¶',                // Paragraph symbol
    dagger: '†',                 // Dagger
    doubleDagger: '‡',           // Double dagger
  },

  // ─── EMOJI SYMBOLS ───────────────────────────────────────────────────────
  emoji: {
    dot: '🔹',                   // Orange dot
    dotSmall: '◾',               // Small dot
    dotMid: '🟠',                // Orange circle
    circle: '⭕',                // Circle
    circleSmall: '🔵',           // Blue circle
    circleSolid: '🔴',           // Red circle
    
    square: '🔲',                // Square
    squareSolid: '🟫',           // Brown square
    squareHollow: '⬜',           // White square
    squareHollow2: '⬛',          // Black square
    squareCross: '❌',            // Cross
    squareCheck: '☑️',            // Check
    squareRounded: '🟪',          // Purple square
    
    diamond: '💎',               // Diamond
    diamondHollow: '🔷',          // Diamond outline
    star: '⭐',                   // Star
    starOutline: '✨',            // Star outline
    
    arrow: '➡️',                 // Arrow
    arrowDouble: '⤳',            // Double arrow
    arrowRight: '👉',            // Pointing finger
    arrowRightLong: '🔜',         // Arrow right
    chevron: '›',                // Chevron
    chevronDouble: '»',          // Double chevron
    
    checkmark: '✅',             // Checkmark
    checkmarkHeavy: '👍',         // Thumbs up
    crossmark: '❌',             // Cross mark
    crossmarkHeavy: '❌',         // Heavy cross
    warning: '⚠️',               // Warning
    alert: '🚨',                 // Alert
    
    triangleRight: '▶️',         // Triangle
    triangleLeft: '◀️',          // Triangle left
    triangleUp: '⬆️',            // Triangle up
    triangleDown: '⬇️',          // Triangle down
    dash: '➖',                  // Dash
    dashEn: '➖',                // Dash
    
    fleuron: '🌟',               // Sparkle
    lozenge: '◊',                // Lozenge
    section: '📌',               // Pin
    pilcrow: '📍',               // Marker
    dagger: '⚔️',                // Crossed swords
    doubleDagger: '🗡️',          // Sword
  },

  // ─── MIXED SYMBOLS (Unicode + Emoji) ─────────────────────────────────────
  mixed: {
    dot: '•',
    dotSmall: '·',
    dotMid: '∙',
    circle: '◦',
    circleSmall: '∘',
    circleSolid: '●',
    
    square: '☐',
    squareSolid: '▪',
    squareHollow: '☑',
    squareHollow2: '☒',
    squareCross: '✘',
    squareCheck: '✔',
    squareRounded: '▢',
    
    diamond: '◆',
    diamondHollow: '◇',
    star: '⭐',
    starOutline: '☆',
    
    arrow: '➔',
    arrowDouble: '⇢',
    arrowRight: '➙',
    arrowRightLong: '➜',
    chevron: '›',
    chevronDouble: '»',
    
    checkmark: '✔️',
    checkmarkHeavy: '✅',
    crossmark: '✘',
    crossmarkHeavy: '❌',
    warning: '⚠️',
    alert: '🚨',
    
    triangleRight: '▶',
    triangleLeft: '◀',
    triangleUp: '▲',
    triangleDown: '▼',
    dash: '—',
    dashEn: '–',
    
    fleuron: '❖',
    lozenge: '◊',
    section: '§',
    pilcrow: '¶',
    dagger: '†',
    doubleDagger: '‡',
  }
};

/**
 * Get a specific bullet symbol
 * @param key Symbol key (e.g., 'dot', 'checkmark')
 * @param style Symbol style ('unicode', 'emoji', 'mixed')
 * @returns The requested symbol string
 */
export function getBulletSymbol(
  key: keyof typeof EXTENDED_BULLET_SYMBOLS.unicode,
  style: 'unicode' | 'emoji' | 'mixed' = 'unicode'
): string {
  const symbols = EXTENDED_BULLET_SYMBOLS[style] as Record<string, string>;
  return symbols[key] || '•';
}

/**
 * Get all symbols for a style
 * @param style Symbol style ('unicode', 'emoji', 'mixed')
 * @returns Array of all symbols for the style
 */
export function getAllBulletSymbols(
  style: 'unicode' | 'emoji' | 'mixed' = 'unicode'
): string[] {
  return Object.values(EXTENDED_BULLET_SYMBOLS[style]);
}

/**
 * Get symbol categories
 */
export function getSymbolCategories(): {
  [key: string]: (keyof typeof EXTENDED_BULLET_SYMBOLS.unicode)[]
} {
  return {
    dots: ['dot', 'dotSmall', 'dotMid', 'circle', 'circleSmall', 'circleSolid'],
    squares: ['square', 'squareSolid', 'squareHollow', 'squareHollow2', 'squareCross', 'squareCheck'],
    diamonds: ['diamond', 'diamondHollow'],
    stars: ['star', 'starOutline'],
    arrows: ['arrow', 'arrowDouble', 'arrowRight', 'arrowRightLong'],
    checks: ['checkmark', 'checkmarkHeavy', 'crossmark', 'crossmarkHeavy'],
    triangles: ['triangleRight', 'triangleLeft', 'triangleUp', 'triangleDown'],
    special: ['warning', 'alert', 'dash', 'fleuron', 'lozenge', 'section']
  };
}

/**
 * Create a bullet point with custom symbol
 * @param text Bullet text
 * @param symbol Custom symbol or key
 * @returns Formatted bullet string
 */
export function createBullet(
  text: string,
  symbol: string | keyof typeof EXTENDED_BULLET_SYMBOLS.unicode = 'dot',
  style: 'unicode' | 'emoji' | 'mixed' = 'unicode'
): string {
  const bulletSymbol = typeof symbol === 'string' && symbol.length > 1
    ? getBulletSymbol(symbol as keyof typeof EXTENDED_BULLET_SYMBOLS.unicode, style)
    : symbol;
  
  return `${bulletSymbol} ${text}`;
}

/**
 * Create formatted bullet list
 * @param items Text items
 * @param symbol Bullet symbol
 * @param style Symbol style
 * @returns Formatted bullet list as string array
 */
export function createBulletList(
  items: string[],
  symbol: string = '•',
  style: 'unicode' | 'emoji' | 'mixed' = 'unicode'
): string[] {
  const bulletSymbol = typeof symbol === 'string' && symbol.length > 1
    ? getBulletSymbol(symbol as keyof typeof EXTENDED_BULLET_SYMBOLS.unicode, style)
    : symbol;
  
  return items.map(item => `${bulletSymbol} ${item}`);
}

/**
 * Rotate through bullet symbols for variety
 * @param index Index for rotation
 * @param style Symbol style
 * @returns Rotated symbol
 */
export function getRotatedBullet(
  index: number,
  style: 'unicode' | 'emoji' | 'mixed' = 'unicode'
): string {
  const symbols = getAllBulletSymbols(style);
  return symbols[index % symbols.length];
}

/**
 * Create multi-symbol list with rotation
 * @param items Text items
 * @param style Symbol style
 * @returns List with rotated symbols
 */
export function createRotatedBulletList(
  items: string[],
  style: 'unicode' | 'emoji' | 'mixed' = 'unicode'
): string[] {
  return items.map((item, i) => `${getRotatedBullet(i, style)} ${item}`);
}

/**
 * Get symbol preview (for UI selection)
 * @param style Symbol style
 * @returns Preview grid data
 */
export function getSymbolPreview(style: 'unicode' | 'emoji' | 'mixed' = 'unicode'): {
  [key: string]: { [key: string]: string }
} {
  const categories = getSymbolCategories();
  const preview: { [key: string]: { [key: string]: string } } = {};

  for (const [category, keys] of Object.entries(categories)) {
    preview[category] = {};
    for (const key of keys) {
      preview[category][key] = getBulletSymbol(key as keyof typeof EXTENDED_BULLET_SYMBOLS.unicode, style);
    }
  }

  return preview;
}
