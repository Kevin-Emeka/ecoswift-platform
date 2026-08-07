interface SkylineSilhouetteProps {
  className?: string;
}

const BUILDINGS = [
  { x: 0, w: 40, h: 120 },
  { x: 42, w: 60, h: 200 },
  { x: 104, w: 34, h: 90 },
  { x: 140, w: 48, h: 260 },
  { x: 190, w: 30, h: 140 },
  { x: 222, w: 56, h: 320 },
  { x: 280, w: 38, h: 180 },
  { x: 320, w: 50, h: 240 },
  { x: 372, w: 34, h: 110 },
  { x: 408, w: 44, h: 290 },
  { x: 454, w: 30, h: 160 },
  { x: 486, w: 60, h: 350 },
  { x: 548, w: 36, h: 200 },
  { x: 586, w: 46, h: 130 },
  { x: 634, w: 40, h: 260 },
  { x: 676, w: 32, h: 100 },
  { x: 710, w: 54, h: 220 },
  { x: 766, w: 38, h: 300 },
  { x: 806, w: 44, h: 150 },
  { x: 852, w: 48, h: 240 },
];

/**
 * Abstract, geometric skyline — deliberately not a photo. Avoids licensing a
 * real "New York skyline" stock image while still giving hero sections that
 * financial-district silhouette.
 */
export function SkylineSilhouette({ className }: SkylineSilhouetteProps) {
  return (
    <svg
      viewBox="0 0 900 360"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      aria-hidden="true"
    >
      {BUILDINGS.map((b, i) => (
        <g key={i}>
          <rect x={b.x} y={360 - b.h} width={b.w} height={b.h} fill="rgba(255,255,255,0.06)" />
          {Array.from({ length: Math.floor(b.h / 22) }).map((_, row) =>
            Array.from({ length: Math.max(1, Math.floor(b.w / 14)) }).map((_, col) => {
              const lit = (i * 7 + row * 3 + col) % 5 === 0;
              if (!lit) return null;
              return (
                <rect
                  key={`${row}-${col}`}
                  x={b.x + 5 + col * 14}
                  y={360 - b.h + 8 + row * 22}
                  width={4}
                  height={6}
                  fill="rgba(147,197,253,0.55)"
                />
              );
            }),
          )}
        </g>
      ))}
    </svg>
  );
}
