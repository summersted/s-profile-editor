/**
 * Errors raised by lib code carry a code instead of user-facing text; the UI
 * turns the code into a message in the current language (see lib/i18n).
 */
export type ErrorCode =
  | "notGif"
  | "noFrames"
  | "zeroSize"
  | "unreadableImage"
  | "canvasUnavailable"
  | "encodeFailed"
  | "gifsicleNoOutput"
  | "gifsicleCrashed";

export interface ErrorParams {
  /** 1-based slot number, for per-slot failures. */
  slot?: number;
  /** Raw detail from a third-party tool, shown as is. */
  detail?: string;
}

/** What the user was doing when something failed; picks the fallback message. */
export type FailureKind = "read" | "slice" | "optimize";

/** A failure as stored in UI state: translated to text only when rendered. */
export interface Failure {
  kind: FailureKind;
  cause: unknown;
  /** File the failure is about, if any. */
  filename?: string;
}

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params: ErrorParams = {},
  ) {
    super(params.detail ? `${code}: ${params.detail}` : code);
    this.name = "AppError";
  }
}
