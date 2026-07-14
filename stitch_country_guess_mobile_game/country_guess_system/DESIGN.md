---
name: Country Guess System
colors:
  surface: '#f4fafd'
  surface-dim: '#d4dbde'
  surface-bright: '#f4fafd'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef5f8'
  surface-container: '#e8eff2'
  surface-container-high: '#e2e9ec'
  surface-container-highest: '#dde4e7'
  on-surface: '#161d1f'
  on-surface-variant: '#474554'
  inverse-surface: '#2a3234'
  inverse-on-surface: '#ebf2f5'
  outline: '#787586'
  outline-variant: '#c8c4d7'
  surface-tint: '#5847d2'
  primary: '#5341cd'
  on-primary: '#ffffff'
  primary-container: '#6c5ce7'
  on-primary-container: '#faf6ff'
  inverse-primary: '#c6bfff'
  secondary: '#006b55'
  on-secondary: '#ffffff'
  secondary-container: '#6dfad2'
  on-secondary-container: '#00725b'
  tertiary: '#a62a30'
  on-tertiary: '#ffffff'
  tertiary-container: '#c84245'
  on-tertiary-container: '#fff5f4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e4dfff'
  primary-fixed-dim: '#c6bfff'
  on-primary-fixed: '#160066'
  on-primary-fixed-variant: '#4029ba'
  secondary-fixed: '#6dfad2'
  secondary-fixed-dim: '#4bddb7'
  on-secondary-fixed: '#002018'
  on-secondary-fixed-variant: '#005140'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b0'
  on-tertiary-fixed: '#410006'
  on-tertiary-fixed-variant: '#8c1520'
  background: '#f4fafd'
  on-background: '#161d1f'
  surface-variant: '#dde4e7'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '800'
    lineHeight: 34px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 20px
  lg: 32px
  xl: 48px
  container-max: 600px
  gutter: 16px
---

## Brand & Style

The design system is built to evoke a high-energy, "game show" atmosphere that remains clean, modern, and highly legible. It targets a broad audience, from casual mobile gamers to social groups, prioritizing immediate clarity and a sense of "fun-first" interaction.

The style is a hybrid of **Minimalism** and **Tactile Playfulness**. It utilizes heavy whitespace to keep the focus on game content (maps, flags, and clues), while employing bold, exaggerated UI elements that feel satisfying to interact with. The aesthetic is friendly and optimistic, avoiding the clutter of traditional mobile games in favor of a polished, edutainment-focused interface.

## Colors

The palette is anchored by a warm, off-white background to reduce eye strain during extended play sessions. 

- **Primary (Electric Purple):** Used for main actions, active states, and brand-heavy elements like headers or progress bars.
- **Success (Green):** Reserved strictly for correct guesses and positive feedback loops.
- **Danger (Coral Red):** Used for incorrect guesses, time-outs, and destructive actions.
- **Neutral (Light Gray):** Applied to "hidden" states, such as unrevealed letters or inactive tiles, providing a clear "blank slate" visual.
- **Text (Near Black):** Ensures high contrast against the light background and bright accent colors.

## Typography

This design system utilizes **Plus Jakarta Sans** for its friendly, rounded terminals and exceptional legibility. The type scale is intentionally bold and "loud" to reflect the game-show energy.

- **Headlines:** Always uses the boldest weights (700-800). Display and Large headlines should be tight in tracking to create a punchy, impactful look.
- **Body:** Set at a medium weight (500) to maintain visual weight against the thick borders and vibrant colors of the UI.
- **Labels:** Used for metadata (e.g., "Round 1/10" or "Player Rank"). These are often set in uppercase with slight tracking to differentiate them from interactive elements.

## Layout & Spacing

The layout philosophy follows a **fixed-width container model** optimized for mobile-first interactions. On larger screens, the content is centered with a maximum width of 600px to maintain the "handheld game" feel.

- **Rhythm:** A base-8 spacing system is used. Vertical rhythm is generous to ensure touch targets for game tiles and buttons are never cramped.
- **Grid:** A simple 12-column fluid grid is used within the main container, though most game elements (like the country-guess grid) use a custom flex-basis to ensure tiles remain square.
- **Safe Areas:** 16px horizontal margins are maintained on mobile to prevent content from touching the screen edges.

## Elevation & Depth

To achieve a tactile, "clickable" feel without looking dated, the design system uses **soft ambient shadows** rather than harsh outlines.

- **Depth Levels:** There are only three levels of depth.
    - **Level 0 (Surface):** The #FAFAF8 background.
    - **Level 1 (Cards/Tiles):** Subtle 4px vertical offset shadow with 10% opacity, creating a "lifted" appearance.
    - **Level 2 (Active/Modals):** High-impact 12px blur shadows used for pop-up results or selected state feedback.
- **Interactions:** When a button or tile is pressed, it should "depress" (shadow disappears or reduces and the element translates Y + 2px) to simulate a physical button press.

## Shapes

The shape language is defined by large, friendly radii. This softness counteracts the high-contrast colors to keep the vibe approachable.

- **Standard Elements:** Buttons, input fields, and main cards use a 0.5rem (8px) radius.
- **Large Elements:** Game containers and modal sheets use a 1.5rem (24px) radius for a "bubbly" feel.
- **Interactive Tiles:** Squares used for "letter guessing" or "flag selection" use a 1rem (16px) radius to emphasize their importance as touch targets.

## Components

### Buttons
- **Primary:** Background #6C5CE7, white text, bold weight. Features a "thick" bottom border (3px) in a slightly darker shade to create a 3D effect.
- **Secondary:** White background with #6C5CE7 border and text.

### Game Tiles (Wordle-inspired)
- **Default State:** Background #DFE6E9, no border.
- **Correct State:** Background #00B894, white text.
- **Incorrect State:** Background #FF6B6B, white text.
- **Animation:** Successful guesses should trigger a "pop" scale animation (1.1x).

### Cards
- Used for clues and player stats. White background, rounded-xl (1.5rem), with a soft Level 1 shadow. Content inside should be center-aligned.

### Input Fields
- Specifically for text-based guesses. Large font size (24px), center-aligned, with a thick #DFE6E9 bottom border that turns #6C5CE7 on focus.

### Progress Bars (Timer)
- Height of 12px, fully rounded (pill). The track is #DFE6E9, and the fill is #6C5CE7. For the final 5 seconds of a round, the fill color should animate to #FF6B6B.