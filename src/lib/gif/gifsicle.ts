/**
 * Thin wrapper over gifsicle-wasm-browser.
 *
 * Quirks of the underlying library this hides:
 *  - every run spins up a fresh Worker, so parallel runs really are parallel;
 *  - the command string is split on spaces — no quoting, so args must not contain spaces;
 *  - a failed command resolves with an empty list (or null) instead of rejecting.
 */

/** Name the input is mounted under inside the wasm FS; reference it in args. */
export const GIF_INPUT = "in.gif";

/**
 * Runs gifsicle over one input and returns the single output, or null if
 * gifsicle produced nothing (bad args / unreadable input).
 * `args` is everything except the output flag, e.g. `-O2 --lossy=40 in.gif`.
 */
export type GifsicleRunner = (input: ArrayBuffer, args: string) => Promise<Blob | null>;

export const runGifsicle: GifsicleRunner = async (input, args) => {
  const { default: gifsicle } = await import("gifsicle-wasm-browser");
  try {
    const files = await gifsicle.run({
      // The library clones the buffer into its worker, so `input` stays usable.
      input: [{ file: input, name: GIF_INPUT }],
      command: [`${args} -o /out/out.gif`],
    });
    return files?.[0] ?? null;
  } catch (e) {
    // The library rejects with strings/undefined; normalize to a real Error.
    throw new Error(`gifsicle впав${e ? `: ${String(e)}` : ""}`);
  }
};

/** How many gifsicle workers to run at once. Each one holds a decoded copy of its input. */
export function gifConcurrency(): number {
  const cores = typeof navigator === "undefined" ? 2 : navigator.hardwareConcurrency || 2;
  return Math.max(1, Math.min(3, cores - 1));
}
