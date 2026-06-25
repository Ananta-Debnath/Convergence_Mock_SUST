// Small severity badge used in the response card and form preview.
const LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export default function SeverityChip({ severity, size = 'md' }) {
  const sev = (severity || 'low').toLowerCase();
  return (
    <span className={`sev-chip sev-${sev} sev-${size}`} title={`Severity: ${LABELS[sev] || sev}`}>
      <span className="sev-dot" aria-hidden="true" />
      {LABELS[sev] || sev}
    </span>
  );
}