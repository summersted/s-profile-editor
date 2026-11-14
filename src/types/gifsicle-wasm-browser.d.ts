declare module "gifsicle-wasm-browser" {
  interface GifsicleInput {
    file: string | File | Blob | ArrayBuffer;
    name: string;
  }
  interface GifsicleRunOptions {
    input: GifsicleInput[];
    command: string[];
    folder?: string[];
    isStrict?: boolean;
  }
  const gifsicle: {
    /** Resolves with the files written to /out — empty if the command failed, null if the worker crashed. */
    run(options: GifsicleRunOptions): Promise<File[] | null>;
  };
  export default gifsicle;
}
