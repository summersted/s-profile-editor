const EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** File name for a slot, with the extension matching the blob's actual format. */
export function sliceFileName(index: number, mime: string): string {
  return `slice-${index + 1}.${EXTENSIONS[mime] ?? "png"}`;
}

/** Trigger a browser download for each file. Staggered: browsers drop simultaneous ones. */
export function downloadAll(files: ReadonlyArray<{ url: string; filename: string }>): void {
  files.forEach((file, i) => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = file.url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 150);
  });
}
