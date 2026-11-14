"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface TaskView {
  id: string;
  title: string;
  /** What's happening right now. */
  stage: string;
  /** Extra line: exact settings, pass counter… */
  detail?: string | null;
  /** 0..100, or null when there's no way to measure (indeterminate bar). */
  percent: number | null;
  /** Jump to the thing this task is about. */
  onOpen?: () => void;
}

interface TaskTrayProps {
  tasks: TaskView[];
  /**
   * Changes whenever a modal dialog opens or changes. The tray lives in the
   * browser's top layer (a manual popover); re-showing it puts it above the
   * newest dialog, so it stays visible in the same corner on every screen.
   */
  raiseKey: string;
}

/**
 * Fixed status tray in the bottom-right corner listing background work
 * (cutting, optimizing, rendering). Work keeps running when a dialog is
 * closed; this is where you watch it.
 */
export default function TaskTray({ tasks, raiseKey }: TaskTrayProps) {
  const { m } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const visible = tasks.length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== "function") return;
    // Next frame: a dialog opened in this same commit calls showModal() in its own
    // effect; raising after it keeps the tray above the dialog, not under its backdrop.
    const frame = requestAnimationFrame(() => {
      try {
        if (el.matches(":popover-open")) el.hidePopover();
        if (visible) el.showPopover();
      } catch {
        // Popover API missing or element detached: the tray just isn't shown on top.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, raiseKey]);

  const overall =
    tasks.length > 0 && tasks.every((t) => t.percent !== null)
      ? Math.round(tasks.reduce((s, t) => s + (t.percent ?? 0), 0) / tasks.length)
      : null;

  return (
    <div
      ref={ref}
      popover="manual"
      role="status"
      aria-live="polite"
      className="fixed inset-auto bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 m-0 max-w-[calc(100vw-2rem)] overflow-visible border-0 bg-transparent p-0 text-foreground"
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title={m.tasks.expand}
          className="flex items-center gap-2 rounded-full border border-line bg-ink/95 px-3 py-2 text-xs shadow-lg shadow-black/60"
        >
          <Spinner />
          {m.tasks.title(tasks.length)}
          {overall !== null && <span className="text-accent">{overall}%</span>}
        </button>
      ) : (
        <div className="w-80 max-w-full rounded-md border border-line bg-ink/95 shadow-lg shadow-black/60 backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
              <Spinner />
              {m.tasks.title(tasks.length)}
            </span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label={m.tasks.collapse}
              title={m.tasks.collapse}
              className="rounded px-1.5 text-muted hover:text-foreground"
            >
              ▾
            </button>
          </div>
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {tasks.map((t) => (
              <li key={t.id} className="border-b border-line/60 last:border-b-0">
                <button
                  type="button"
                  disabled={!t.onOpen}
                  onClick={t.onOpen}
                  title={t.onOpen ? m.tasks.openHint : undefined}
                  className="flex w-full flex-col gap-1.5 px-3 py-2 text-left enabled:hover:bg-line/40"
                >
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{t.title}</span>
                    {t.percent !== null && <span className="shrink-0 text-xs text-accent">{t.percent}%</span>}
                  </span>
                  <span className="h-1.5 w-full overflow-hidden rounded bg-line">
                    {t.percent !== null ? (
                      <span className="block h-full bg-accent transition-[width] duration-300" style={{ width: `${t.percent}%` }} />
                    ) : (
                      <span className="block h-full w-1/3 animate-pulse bg-accent" />
                    )}
                  </span>
                  <span className="truncate text-xs text-muted">{t.stage}</span>
                  {t.detail && <span className="truncate text-xs text-muted">{t.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return <span aria-hidden className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />;
}
