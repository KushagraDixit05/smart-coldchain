const CLASS_BY_STATUS = {
  InTransit: "badge-intransit",
  Breached: "badge-breached",
  Delivered: "badge-delivered",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge ${CLASS_BY_STATUS[status] || ""}`}>
      <span className="badge-dot" />
      {status === "InTransit" ? "In Transit" : status}
    </span>
  );
}
