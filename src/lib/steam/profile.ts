/**
 * Geometry of a Steam profile page, in CSS px at 100% browser zoom.
 * Origin: top-left corner of the centred content column, at the top of the
 * profile area — which is also where the profile background starts.
 *
 * MEASURED on a live (saved) profile page, desktop layout, 2026-11-14 — see
 * docs/steam-specs.md. The background is drawn at its native size
 * (`background-size: auto`), centred, from the top, no repeat; below it the
 * page is black. Content is centred too, so their relative position doesn't
 * depend on the window width — which is what makes "cut the panel out of the
 * background" line up on any screen.
 */

export const PROFILE = {
  /** Steam profile backgrounds are 1920 wide (1080 or 1200 tall) and rendered at native size. */
  bgWidth: 1920,
  bgHeight: 1080,
  contentWidth: 976,
  /** Profile header band (avatar, name, level) at the top of the content column. */
  headerHeight: 224,
  leftColWidth: 652,
  rightColX: 676,
  rightColWidth: 288,
} as const;

/** Inside one showcase block (`.profile_customization_block`), px. */
export const SHOWCASE_BOX = {
  padTop: 15,
  padX: 10,
  padBottom: 11,
  /** Every artwork image sits in a link with a 1px black border. */
  border: 1,
} as const;

/** The parts of the layout a user may need to nudge; editable in the UI. */
export interface ProfileLayout {
  /** y where the first showcase block starts (profile header + content padding above it). */
  headerHeight: number;
  /** x of the showcase column inside the content column. */
  leftColX: number;
  /** Height of a showcase's title bar. 0 on the measured profile: Steam hid it. */
  panelHeader: number;
  /** Vertical space between two showcase blocks. */
  panelGap: number;
}

export const DEFAULT_LAYOUT: ProfileLayout = {
  headerHeight: PROFILE.headerHeight + 16,
  leftColX: 12,
  panelHeader: 0,
  panelGap: 12,
};

/** Input bounds for the calibration fields. */
export const LAYOUT_LIMITS: Record<keyof ProfileLayout, { min: number; max: number }> = {
  headerHeight: { min: 0, max: 800 },
  leftColX: { min: 0, max: 100 },
  panelHeader: { min: 0, max: 120 },
  panelGap: { min: 0, max: 120 },
};

/** x of the right column (level, badges…). Cosmetic only: nothing is cut from it. */
export function rightColX(): number {
  return PROFILE.rightColX;
}
