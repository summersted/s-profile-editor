const MB = 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(2)} МБ`;
  return `${(bytes / 1024).toFixed(1)} КБ`;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} с`;
}
