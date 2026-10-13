/** The nurse's healing machine: one ball per creature lights up in turn. */
export function HealAnimation({ count }: { count: number }) {
  return (
    <div className="gb-heal">
      <div className="gb-heal-balls">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="gb-heal-ball" style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </div>
      <div>HEALING...</div>
    </div>
  );
}