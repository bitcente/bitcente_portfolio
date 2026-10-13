interface Props {
  value: number;
  max: number;
}

export function HpBar({ value, max }: Props) {
  return (
    <div className="gb-hp">
      <span className="gb-hp-label">HP</span>
      <div className="gb-hp-track">
        <div className="gb-hp-fill" style={{ width: `${(100 * value) / max}%` }} />
      </div>
    </div>
  );
}