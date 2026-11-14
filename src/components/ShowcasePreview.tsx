"use client";

import type { SlicePlan, SourceImage } from "@/lib/types";

interface ShowcasePreviewProps {
  source: SourceImage;
  plan: SlicePlan;
}

/**
 * CSS background-position percentage places the same percentage point of the
 * image and the box at the same spot. Solving that for "box edge 0 shows
 * source pixel `pos`" gives pos / (srcSize - winSize) * 100.
 */
function bgPositionPct(pos: number, srcSize: number, winSize: number): number {
  const denom = srcSize - winSize;
  if (Math.abs(denom) < 0.001) return 0;
  return (pos / denom) * 100;
}

export default function ShowcasePreview({ source, plan }: ShowcasePreviewProps) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-sm border border-black/40 bg-background"
        style={{ aspectRatio: `${plan.strip.w} / ${plan.strip.h}` }}
      >
        {plan.slices.map((s) => {
          const sizeW = (source.width / s.source.w) * 100;
          const sizeH = (source.height / s.source.h) * 100;
          const posX = bgPositionPct(s.source.x, source.width, s.source.w);
          const posY = bgPositionPct(s.source.y, source.height, s.source.h);
          return (
            <div
              key={s.index}
              className="absolute"
              style={{
                left: `${(s.strip.x / plan.strip.w) * 100}%`,
                top: `${(s.strip.y / plan.strip.h) * 100}%`,
                width: `${(s.strip.w / plan.strip.w) * 100}%`,
                height: `${(s.strip.h / plan.strip.h) * 100}%`,
                backgroundImage: `url(${source.previewUrl})`,
                backgroundSize: `${sizeW}% ${sizeH}%`,
                backgroundPosition: `${posX}% ${posY}%`,
                backgroundRepeat: "no-repeat",
              }}
            />
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Темні смужки — це фон сторінки профілю, що проглядає крізь зазори між слотами. Саме так це
        виглядатиме на самому Steam.
        {source.kind === "gif" && (
          <>
            {" "}
            Анімація у превʼю: кадри в різних слотах можуть трохи розсинхронитись — це лише
            особливість цього попереднього перегляду, на самі файли не впливає.
          </>
        )}
      </p>
    </div>
  );
}
