// Small pieces used only by the hospital pages. Everything else comes from ../donor/components.

export function StatusBadge({ status }) {
  if (status === "Fulfilled") return <span className="status status--ok">Fulfilled</span>;
  if (status === "Open") return <span className="status--open">Open</span>;
  return <span className="status--closed">{status}</span>;
}