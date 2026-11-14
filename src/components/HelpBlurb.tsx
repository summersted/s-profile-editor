"use client";

import { useI18n } from "@/lib/i18n";

const DEVTOOLS_SNIPPET = `document.getElementsByName('image_width')[0].value = 1000;
document.getElementsByName('image_height')[0].value = 1;`;

export default function HelpBlurb() {
  const { m } = useI18n();
  return (
    <details className="rounded-md border border-line bg-panel p-3 text-sm text-foreground">
      <summary className="cursor-pointer select-none font-semibold text-accent">
        {m.help.summary}
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-xs text-muted">
        {m.help.steps.map((text, i) => (
          <p key={i}>
            {i + 1}. {text}
          </p>
        ))}
        <pre className="overflow-x-auto rounded bg-ink p-2 text-[11px] text-foreground">
          {DEVTOOLS_SNIPPET}
        </pre>
        <p>{m.help.trickNote}</p>
      </div>
    </details>
  );
}
