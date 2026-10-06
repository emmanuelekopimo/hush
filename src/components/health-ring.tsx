export function HealthRing({ score, grade }: { score: number; grade: string }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--ok)" : score >= 50 ? "var(--due)" : "var(--bad)";
  return (
    <div className="ring" aria-label={`Vault health ${score} out of 100`}>
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={r} stroke="var(--panel-3)" strokeWidth="10" fill="none" />
        <circle cx="66" cy="66" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="ring-label">
        <div>
          <strong>{score}</strong>
          <span className="tiny muted">{grade}</span>
        </div>
      </div>
    </div>
  );
}
