export default function NeighborhoodBaseline({ baseline }) {
  if (!baseline) return null;
  const groups = [
    ["Housing costs", ["medianGrossRent", "medianHomeValue", "monthlyOwnerCosts", "rentIncomeShare"]],
    ["Homes in the area", ["medianYearBuilt", "homes", "detachedHomes", "ownerOccupied", "renterOccupied"]],
    ["People & getting around", ["population", "transitCommuters", "workFromHome"]],
  ];
  return <section className="notice">
    <h2>Your neighborhood at a glance</h2>
    <p className="muted">Historical estimates for {baseline.provenance.observationPeriod || baseline.vintage}. Census areas approximate ZIPs. Housing figures describe the area, not today’s listings or an individual home.</p>
    {groups.map(([title, keys], index) => {
      const metrics = keys.map((key) => [key, baseline.metrics[key]]).filter(([, metric]) => metric?.estimate != null);
      if (!metrics.length) return null;
      const content = <>
        <h3>{title}</h3>
        <div className="grid">{metrics.map(([key, metric]) => <article key={key}>
          <h4>{metric.label}</h4><strong>{metric.displayValue || metric.estimate.toLocaleString("en-US")}</strong>
          {metric.marginOfError != null && <p className="muted">Margin of error: ±{metric.marginOfError.toLocaleString("en-US")}{metric.unit === "percent" ? " percentage points" : metric.unit === "year" ? " years" : ""}</p>}
        </article>)}</div>
      </>;
      return index === 0 ? <div key={title}>{content}</div> : <details key={title}><summary>{title}</summary>{content}</details>;
    })}
  </section>;
}
