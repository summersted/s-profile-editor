"use client";

import { useRef, useState } from "react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  error: string | null;
  loading?: boolean;
  fileName?: string;
  /** One-line summary of the loaded file (size, frames…). */
  fileInfo?: string;
}

const ACCEPT = "image/gif,image/png,image/jpeg,.gif,.png,.jpg,.jpeg";

export default function UploadZone({ onFile, error, loading, fileName, fileInfo }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${
          dragOver
            ? "border-accent bg-accent/10"
            : "border-line bg-panel hover:border-line-hover"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8 text-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16V4m0 0 4 4m-4-4-4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
          />
        </svg>
        <p className="text-sm text-foreground">
          Перетягни GIF, PNG або JPG сюди, або натисни щоб вибрати файл
        </p>
        {loading ? (
          <p className="text-xs text-muted">Читаємо файл…</p>
        ) : (
          fileName && (
            <p className="max-w-full truncate text-xs text-muted">
              {fileName}
              {fileInfo && <span className="block">{fileInfo}</span>}
            </p>
          )
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="rounded-md border border-danger-line bg-danger-bg px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
