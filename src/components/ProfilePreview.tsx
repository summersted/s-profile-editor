"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import { ownFileRect, panelKey } from "@/lib/steam/plan";
import { PROFILE, SHOWCASE_BOX, rightColX, type ProfileLayout } from "@/lib/steam/profile";
import { FILE_LIMIT_BYTES, SHOWCASES } from "@/lib/steam/showcases";
import type { PlannedSlice, SliceFile, SlicePlan, SourceImage } from "@/lib/types";

/**
 * Browser window width the mock profile is laid out for, CSS px. Only decides
 * how much background shows left and right of the content column; the whole
 * page is then scaled down to fit the preview box.
 */
const VIEWPORT = 1280;

/** Content column / header band fill, measured on a live profile (MidnightTheme). */
const STEAM_COLUMN_BG = "rgba(10, 14, 32, 0.93)";

interface ProfilePreviewProps {
  plan: SlicePlan;
  layout: ProfileLayout;
  /** Background image URL; null = nothing uploaded yet. */
  imageUrl: string | null;
  /** `panelKey` → user's own file covering that panel instead of the background. */
  overrides: Readonly<Record<string, SourceImage>>;
  files: SliceFile[];
  slicing: boolean;
  optimizing: Readonly<Record<number, unknown>>;
  onSlotClick: (index: number) => void;
}

/**
 * Mock of a Steam profile page: background at its real position, a profile
 * header, the right column, and the showcases. Each showcase slot shows the
 * exact piece of background its file was cut from (or the user's own file),
 * so "seamless or not" is judged here before anything is uploaded to Steam.
 */
export default function ProfilePreview({
  plan,
  layout,
  imageUrl,
  overrides,
  files,
  slicing,
  optimizing,
  onSlotClick,
}: ProfilePreviewProps) {
  const { m } = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostWidth, setHostWidth] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => setHostWidth(entry.contentRect.width));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const scale = hostWidth / VIEWPORT;
  const panelType = new Map(plan.panels.map((p) => [p.index, p.showcaseId]));
  const contentLeft = (VIEWPORT - PROFILE.contentWidth) / 2;
  const fileByIndex = new Map(files.map((f) => [f.index, f]));

  /** Background layer positioned so it lines up with the page background. */
  const bgAt = (x: number, y: number): CSSProperties =>
    imageUrl
      ? {
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: `${plan.bg.w}px ${plan.bg.h}px`,
          backgroundPosition: `${x}px ${y}px`,
          backgroundRepeat: "no-repeat",
        }
      : {};

  return (
    <div
      ref={hostRef}
      className="relative w-full overflow-hidden rounded-sm border border-black/40 bg-black"
      style={{ height: plan.page.h * scale }}
    >
      {scale > 0 && (
        <div
          className="absolute left-0 top-0 origin-top-left select-none"
          style={{
            width: VIEWPORT,
            height: plan.page.h,
            transform: `scale(${scale})`,
            ...bgAt(contentLeft + plan.bg.x, plan.bg.y),
          }}
        >
          <div
            className="absolute top-0"
            style={{ left: contentLeft, width: PROFILE.contentWidth, height: plan.page.h }}
          >
            {/* Steam covers the content column almost opaquely; showcase art is the only "window" into the background. */}
            <div className="absolute inset-0" style={{ background: STEAM_COLUMN_BG }} />
            <ProfileHeader height={PROFILE.headerHeight} />
            <RightColumn top={PROFILE.headerHeight + 16} />

            {plan.panels.map((p) => (
              <div
                key={p.index}
                className="absolute bg-black/30"
                style={{ left: p.box.x, top: p.box.y, width: p.box.w, height: p.box.h }}
              >
                {layout.panelHeader > 0 && (
                  <div
                    className="flex items-center px-[10px] text-[16px] text-white"
                    style={{ height: layout.panelHeader }}
                  >
                    {m.showcases[p.showcaseId].title}
                  </div>
                )}
              </div>
            ))}

            {plan.slices
                .filter((s) => s.slot === 0 && SHOWCASES[panelType.get(s.panel) ?? "featured"].captionHeight > 0)
                .map((s) => (
                  <span
                    key={s.index}
                    className="absolute truncate text-[13px] leading-[19px] text-muted"
                    style={{
                      left: s.page.x,
                      top: s.page.y + s.page.h + SHOWCASE_BOX.border + 4,
                      width: s.page.w,
                    }}
                  >
                    {m.profile.artworkTitle}
                  </span>
                ))}

            {plan.slices.map((s) => {
              const own = overrides[panelKey(s.panel)];
              const drawn = own && ownFileRect(own, plan.panels[s.panel].strip);
              return (
                <Slot
                  key={s.index}
                  slice={s}
                  file={fileByIndex.get(s.index)}
                  custom={!!own}
                  interactive={imageUrl !== null}
                  slicing={slicing}
                  optimizing={optimizing[s.index] !== undefined}
                  background={
                    own && drawn
                      ? {
                          // Same placement the cutter uses (ownFileRect): one picture across the panel.
                          backgroundImage: `url(${own.previewUrl})`,
                          backgroundSize: `${drawn.w}px ${drawn.h}px`,
                          backgroundPosition: `${drawn.x - s.page.x}px ${drawn.y - s.page.y}px`,
                          backgroundRepeat: "no-repeat",
                        }
                      : bgAt(plan.bg.x - s.page.x, plan.bg.y - s.page.y)
                  }
                  onClick={() => onSlotClick(s.index)}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Slot({
  slice,
  file,
  custom,
  interactive,
  slicing,
  optimizing,
  background,
  onClick,
}: {
  slice: PlannedSlice;
  file: SliceFile | undefined;
  /** Shows the user's own file instead of the background. */
  custom: boolean;
  /** Clickable at all (false before a background is loaded). */
  interactive: boolean;
  slicing: boolean;
  optimizing: boolean;
  background: CSSProperties;
  onClick: () => void;
}) {
  const { m, bytes } = useI18n();
  const { page } = slice;
  const empty = slice.coverage === 0 && !custom;
  const oversize = file ? file.blob.size > FILE_LIMIT_BYTES : false;

  let badge: string | null = null;
  if (empty) badge = m.slot.outside;
  else if (optimizing) badge = m.slot.compressing;
  else if (slicing && (!file || file.custom !== custom)) badge = m.slot.slicing;
  else if (file) badge = bytes(file.blob.size);

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      aria-label={m.slot.name(slice.index + 1)}
      className="group absolute outline outline-1 outline-black enabled:cursor-pointer enabled:hover:ring-4 enabled:hover:ring-accent enabled:focus-visible:ring-4 enabled:focus-visible:ring-accent"
      style={{ left: page.x, top: page.y, width: page.w, height: page.h, ...background }}
    >
      {empty && <span className="absolute inset-0 border-2 border-dashed border-white/20" />}
      {badge && (
        <span
          className={`absolute bottom-2 right-2 rounded px-2 py-1 text-[13px] leading-none ${
            oversize ? "bg-warn-bg text-warn" : "bg-black/70 text-foreground"
          }`}
        >
          {badge}
        </span>
      )}
      {custom && (
        <span className="absolute bottom-2 left-2 rounded bg-accent px-2 py-1 text-[13px] leading-none text-ink">
          {m.slot.ownFile}
        </span>
      )}
      {interactive && (
        <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[13px] leading-none text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {m.slot.clickHint(slice.index + 1)}
        </span>
      )}
    </button>
  );
}

/** Avatar, name, level — just enough to judge composition. */
function ProfileHeader({ height }: { height: number }) {
  const { m } = useI18n();
  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height }}>
      <div className="flex gap-6 pl-6 pr-6 pt-[34px]">
        <div className="h-[168px] w-[168px] shrink-0 border-2 border-line-hover bg-gradient-to-br from-line to-background" />
        <div className="flex flex-1 flex-col gap-2 pt-1">
          <span className="text-[24px] text-white">{m.profile.nickname}</span>
          <span className="text-[13px] text-muted">{m.profile.country}</span>
          <span className="mt-5 h-3 w-3/4 rounded bg-white/10" />
          <span className="h-3 w-1/2 rounded bg-white/10" />
        </div>
        <div className="flex w-[250px] flex-col gap-4 pt-1">
          <span className="flex items-center gap-3 text-[22px] text-foreground">
            {m.profile.level}
            <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-level text-[17px]">
              42
            </span>
          </span>
          <span className="w-fit rounded-sm bg-white/10 px-4 py-1.5 text-[13px] text-foreground">
            {m.profile.editProfile}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Status, badges, games, friends — placeholders in Steam's right column. */
function RightColumn({ top }: { top: number }) {
  const { m } = useI18n();
  const block = (title: string, rows: number) => (
    <div className="flex flex-col gap-2">
      <span className="text-[15px] text-foreground">{title}</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="h-3 rounded bg-white/10" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
  return (
    <div
      className="absolute flex flex-col gap-6 pt-2"
      style={{ left: rightColX(), top, width: PROFILE.rightColWidth }}
    >
      <span className="text-[18px] text-online">{m.profile.online}</span>
      <div className="flex flex-col gap-2">
        <span className="text-[15px] text-foreground">{m.profile.badges}</span>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="aspect-square rounded-full bg-white/10" />
          ))}
        </div>
      </div>
      {block(m.profile.games, 3)}
      {block(m.profile.groups, 2)}
      {block(m.profile.friends, 4)}
    </div>
  );
}
