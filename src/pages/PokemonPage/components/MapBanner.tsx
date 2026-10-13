/** Map name shown for a moment when entering a map (fades out with CSS, then calls onDone). */
export function MapBanner({ text, onDone }: { text: string; onDone: () => void }) {
  return (
    <div className="gb-banner" onAnimationEnd={onDone}>
      {text}
    </div>
  );
}