"use client";
import { useEffect, useRef, useState } from "react";
import ProjectMap from "../../components/ProjectMap";
import Soundscore from "../../components/Soundscore";
import { trackAnalyticsEvent } from "../../lib/analytics.mjs";

const STAGES = {
  permitted: "Permitted",
  in_review: "In review",
  early_proposal: "Early proposal",
  uncertain: "Status needs review",
};

function FactorIcon({ type }) {
  const paths = {
    parking: "M7 21V3h6a5 5 0 0 1 0 10H7m0-7h6a2 2 0 0 1 0 4H7",
    disruption: "m12 3 10 18H2L12 3Zm0 6v5m0 3h.01",
    upgrades: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-5 9 3 3 7-7",
    medical: "M8 3h8v5h5v8h-5v5H8v-5H3V8h5V3Z",
    work: "M3 7h18v14H3V7Zm5 0V3h8v4M3 12c6 3 12 3 18 0M10 13v3h4v-3",
    housing: "M4 21V7h10v14M14 11h6v10M8 11h2m-2 4h2m-2 4h2m7-4h1m-1 4h1M2 21h20M7 7V3h4v4",
    views: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    economy: "M3 10h18l-2-6H5l-2 6Zm1 0v10h16V10M9 20v-6h6v6M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0",
    transport: "M6 17V5c0-3 12-3 12 0v12H6Zm0-9h12M8 21l2-4m6 4-2-4M9 13h.01M15 13h.01",
    zoning: "m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5",
    prices: "M3 3v18h18M7 15l4-5 4 3 6-8M17 5h4v4",
    lock: "M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4M12 14v3",
  };
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[type] || paths.prices} />
    </svg>
  );
}

function DecisionSignals({ signals = [] }) {
  const [audience, setAudience] = useState("all");
  if (!signals.length) return null;
  const visible = signals.filter((signal) => audience === "all" || signal.audience.includes(audience));
  const ordered = audience === "business"
    ? [...visible].sort((a, b) => ["shops", "commercial", "housing", "parking", "disruption", "views", "upgrades"].indexOf(a.id) - ["shops", "commercial", "housing", "parking", "disruption", "views", "upgrades"].indexOf(b.id))
    : visible;
  return (
    <div className="decision-signals">
      <div className="decision-heading">
        <h3>What this could mean for you</h3>
        <div className="audience-switch" role="group" aria-label="Tailor neighborhood signals">
          {[["all", "All"], ["home", "Buying / renting a home"], ["business", "Retail / commercial"]].map(([id, label]) => (
            <button key={id} className="secondary" aria-pressed={audience === id} onClick={() => { setAudience(id); trackAnalyticsEvent("audience_selected", { audience: id }); }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="impact-grid" aria-label="Permit-based neighborhood signals">
        {ordered.map((signal) => (
          <article className="impact-card decision-card" key={signal.id}>
            <div className="impact-card-heading">
              <span className="factor-icon"><FactorIcon type={signal.id === "shops" ? "economy" : signal.id === "commercial" ? "work" : signal.id} /></span>
              <h3>{signal.title}</h3>
            </div>
            <strong className="decision-metric">{signal.metric}</strong>
            <p className="decision-fact">{signal.fact}</p>
            <p className="impact-takeaway">{signal.takeaways[audience === "business" || signal.audience.length === 1 ? "business" : "home"]}</p>
            <details className="signal-examples">
              <summary>Example projects</summary>
              {signal.examples.map((example) => (
                <div key={example.projectId}>
                  {example.sourceUrl ? <a href={example.sourceUrl} target="_blank" rel="noreferrer">{example.address || "Project details"} ↗</a> : <strong>{example.address || "Project details"}</strong>}
                  <span>{example.stage}</span><p>{example.description}</p>
                </div>
              ))}
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}

function ZipProfile({ profile }) {
  return (
    <section className="zip-profile" aria-labelledby="zip-profile-heading">
      <p className="eyebrow">ABOUT THIS ZIP</p>
      <h2 id="zip-profile-heading">{profile.area}</h2>
      <p className="zip-character">{profile.character}</p>
      <div className="zip-profile-grid">
        {profile.groups.map((group) => (
          <div className="zip-profile-group" key={group.id}>
            <h3><FactorIcon type={group.id === "shopping" ? "economy" : group.id} />{group.title}</h3>
            <ul>
              {group.places.map((item) => (
                <li key={item.name}>
                  <a href={item.url} title={item.address} target="_blank" rel="noreferrer">{item.name}</a>
                  {item.relation === "nearby" && <span className="nearby-label">Nearby · {item.postalCode}</span>}
                  {item.note && <small className="muted">{item.note}</small>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="zip-reviewed">Highlights for {profile.zip} and nearby · Checked {new Date(profile.reviewedAt).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}</p>
    </section>
  );
}

function ProPreview({ topics }) {
  const dialog = useRef(null);
  const previewTopics = topics.map((topic) => topic.id === "transport" ? { ...topic, title: "Future transit changes" } : topic);
  return (
    <section className="pro-preview" aria-labelledby="pro-heading">
      <div className="pro-blurred" aria-hidden="true" inert>
        <div className="pro-mock-metrics">
          {previewTopics.map(({ title }) => (
            <div key={title}><span>{title}</span><strong>— —</strong><div className="pro-skeleton" /></div>
          ))}
        </div>
        <svg className="pro-mock-chart" viewBox="0 0 600 100" preserveAspectRatio="none">
          <path d="M0 70H600M0 40H600M0 10H600" stroke="currentColor" opacity=".2" />
          <path d="M0 65Q60 80 100 50T200 60T300 35T400 50T500 25T600 35" fill="none" stroke="currentColor" strokeWidth="4" />
        </svg>
      </div>
      <div className="pro-preview-content">
        <span className="pro-label"><FactorIcon type="lock" /> PRO REPORT · PREVIEW</span>
        <h2 id="pro-heading">Go deeper with Pro</h2>
        <div className="pro-topics" aria-label="Planned Pro topics">
          {previewTopics.map(({ id, title }) => <span key={id}><FactorIcon type={id} />{title}</span>)}
        </div>
        <p>Future transit changes, zoning, property prices and rental trends.</p>
        <button onClick={() => { dialog.current.showModal(); trackAnalyticsEvent("pro_interest"); }}>Upgrade to Pro <span aria-hidden="true">↗</span></button>
        <p className="pro-availability">Coming soon · These topics are not available yet.</p>
      </div>
      <dialog ref={dialog} className="pro-dialog" aria-labelledby="pro-dialog-heading">
        <span className="pro-label"><FactorIcon type="lock" /> PRO · COMING SOON</span>
        <h2 id="pro-dialog-heading">A deeper look at your area</h2>
        <p>Planned for Pro: future transit changes, zoning changes, property-price history and rental trends.</p>
        <p className="muted">We are connecting the additional data sources. This blurred preview is illustrative; upgrading cannot unlock these topics yet. Checkout is coming soon.</p>
        <p>Planned pricing: <strong>$10 for one report</strong> or <strong>$20 for five</strong>.</p>
        <form method="dialog"><button>Back to report</button></form>
      </dialog>
    </section>
  );
}

function CompletionTarget({ timeline }) {
  if (!timeline) return <span className="timeline-unknown">Completion not announced</span>;
  const title = timeline.kind === "construction_window" ? (timeline.pastTarget ? "Past construction window · update pending" : "Construction window") : timeline.pastTarget ? "Past target · completion unconfirmed" : timeline.kind === "phase_target" ? "Phase target" : timeline.kind === "program_target" ? "Program target" : "Estimated completion";
  return <span className={`completion-target${timeline.pastTarget ? " past-target" : ""}`}><span>{title}</span><strong>{timeline.label}</strong>{timeline.phase && <small>{timeline.phase}</small>}</span>;
}

function PublicProjects({ projects, civicProjects = [] }) {
  if (!projects.length && !civicProjects.length) return null;
  return (
    <section className="public-projects" aria-labelledby="public-projects-title">
      <div className="section-heading"><h2 id="public-projects-title">Parks & public improvements</h2></div>
      <div className="public-projects-grid">
        {projects.map((project) => (
          <article className="public-project-card" key={project.id}>
            <p className="eyebrow">{project.category} · {project.stage}</p>
            <h3><a href={project.sourceUrl} target="_blank" rel="noreferrer">{project.title} ↗</a></h3>
            <p>{project.summary}</p><p className="public-impact">{project.impact}</p>
            <CompletionTarget timeline={project.timeline} />
            {project.milestone && <p className="muted">{project.milestone}</p>}
          </article>
        ))}
        {civicProjects.map((project) => (
          <article className="public-project-card" key={project.id}>
            <p className="eyebrow">City permit · {STAGES[project.stage] || "Review status"}</p>
            <h3>{project.address || project.displayAddress}</h3><p>{project.summary}</p>
            <CompletionTarget timeline={project.timeline} />
            <a href={project.sourceUrl} target="_blank" rel="noreferrer">See city record ↗</a>
          </article>
        ))}
      </div>
    </section>
  );
}

function ProjectCard({ project }) {
  return (
    <article className="project">
      <div className="row">
        <span className="eyebrow">
          {STAGES[project.stage] || "Building activity"}
        </span>
        {project.scaleBand && <span className="tag">{project.scaleBand}</span>}
      </div>
      <h2>{project.address || project.displayAddress}</h2>
      <p>{project.summary}</p>
      <div className="project-timeline"><CompletionTarget timeline={project.timeline} /></div>
      {project.reasons?.length > 0 && (
        <p className="project-reasons">{project.reasons.join(" · ")}</p>
      )}
      {!project.reasons?.length && (
        <p className="muted">
          {project.status || project.originalStatus}
          {project.lastActivityAt
            ? ` · ${new Date(project.lastActivityAt).toLocaleDateString()}`
            : " · Activity date unavailable"}
        </p>
      )}
      <p className="muted">
        {project.evidenceCount || 0} official record
        {(project.evidenceCount || 0) === 1 ? "" : "s"}. A recorded permit or
        decision does not confirm construction has started.
      </p>
      {project.sourceUrl && (
        <a href={project.sourceUrl} target="_blank" rel="noreferrer">
          See city records ↗
        </a>
      )}
    </article>
  );
}

export default function Report() {
  const [zipProfile, setZipProfile] = useState(null);
  const [publicProjects, setPublicProjects] = useState([]);
  const [noiseLocation, setNoiseLocation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingFull, setLoadingFull] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [context, setContext] = useState({
    zip: "",
    address: "",
    query: "",
    location: null,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zip = params.get("zip") || "";
    const query = new URLSearchParams({ zip });
    for (const key of ["lat", "lng"])
      if (params.has(key)) query.set(key, params.get(key));
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lng"));
    setContext({
      zip,
      address: params.get("address") || "",
      query: query.toString(),
      location:
        params.has("lat") &&
        params.has("lng") &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
          ? { latitude, longitude }
          : null,
    });
  }, []);

  useEffect(() => {
    if (!context.query) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/area-summary?${context.query}${attempt ? `&refresh=${attempt}` : ""}`, { signal: controller.signal, cache: attempt ? "no-store" : "default" })
      .then(async (response) => {
        const body = await response.json();
        setZipProfile(body.zipProfile || null);
        setPublicProjects(body.publicProjects || []);
        if (!response.ok || body.status === "preparing") throw new Error(body.error || "Unable to build summary.");
        return body;
      })
      .then((body) => {
        setSummary(body);
        trackAnalyticsEvent("report_loaded", { zip: body.zip, coverage: body.sourceStatus === "baseline_only" ? "baseline_only" : body.sourceStatus === "partial" ? "partial" : body.sourceStatus === "unavailable" ? "unavailable" : "complete" });
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, context.query]);

  async function loadProjects(cursor = "0", generation = summary?.generation) {
    setLoadingFull(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects?${context.query}&cursor=${encodeURIComponent(cursor)}${generation ? `&generation=${encodeURIComponent(generation)}` : ""}`,
      );
      const body = await response.json();
      if (response.status === 409 && body.code === "REPORT_UPDATED") {
        setProjects([]); setNextCursor(null); setFullOpen(false);
        setSummary(null); setAttempt((value) => value + 1);
        return;
      }
      if (!response.ok || body.status === "preparing") throw new Error(body.error || "Unable to load evidence.");
      setProjects((current) =>
        cursor === "0" ? body.items : [...current, ...body.items],
      );
      setCoverage(body.coverage || []);
      setNextCursor(body.nextCursor);
      setFullOpen(true);
      if (cursor === "0") trackAnalyticsEvent("full_report_opened");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingFull(false);
    }
  }

  const mapProjects = summary
    ? [
        ...new Map(
          [...summary.highlights, ...(fullOpen ? projects : [])].map((project) => [
            project.id,
            project,
          ]),
        ).values(),
      ].slice(0, 100)
    : [];

  return (
    <main className="report-page">
      <div className="row">
        <a href="/">← Check another ZIP</a>
        {summary && (
          <button className="secondary" onClick={() => window.print()}>
            Print / save PDF
          </button>
        )}
      </div>
      <h1>
        {context.address || context.zip || "Your area"}
        <br />
        <span className="muted">{summary?.reportType === "baseline" ? "Your neighborhood snapshot." : "What may change nearby."}</span>
      </h1>
      {zipProfile && <ZipProfile profile={zipProfile} />}
      {loading && (
        <section className="notice" role="status">
          <h2>Loading your neighborhood report…</h2>
          <p>
            Checking available coverage.
          </p>
        </section>
      )}
      {error && (
        <section className="notice" role="alert">
          <p>{error}</p>
          {!summary && (
            <button onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </button>
          )}
        </section>
      )}
      {!summary && <PublicProjects projects={publicProjects} />}
      {summary?.reportType === "baseline" && (
        <section className="notice">
          <h2>Your neighborhood at a glance</h2>
          <p className="muted">Historical estimates for {summary.baseline.provenance.observationPeriod || summary.baseline.vintage}. Census areas approximate ZIPs; local project coverage is not connected here yet.</p>
          <div className="grid">
            {Object.entries(summary.baseline.metrics).map(([key, metric]) => (
              <article key={key}><h3>{metric.label}</h3><strong>{metric.displayValue || (metric.estimate == null ? "Not available" : metric.unit === "USD" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(metric.estimate) : metric.estimate.toLocaleString())}</strong>
                {metric.marginOfError != null && <p className="muted">Margin of error: ±{metric.marginOfError.toLocaleString()}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
      {summary && summary.reportType !== "baseline" && (
        <>
          <section className="notice summary-hero">
            <div className="snapshot-overview">
              <div className="snapshot-context">
                <p className="eyebrow">NEIGHBORHOOD SNAPSHOT</p>
                <h2>What’s planned. What it could mean.</h2>
                {summary.impactSummary && (
                  <div className="snapshot-story">
                    <p><strong>What’s planned</strong><span>{summary.impactSummary.changesSummary}</span></p>
                    <p><strong>What it could mean</strong><span>{summary.impactSummary.overview}</span></p>
                  </div>
                )}
                {summary.sourceStatus === "partial" && (
                  <p className="impact-coverage" role="note">
                    Some city records may be missing from this search.
                  </p>
                )}
                {summary.sharedZip && <p className="impact-coverage">This ZIP crosses city limits. Project coverage includes Seattle municipal records only.</p>}
                {summary.awaitingUpdate && <p className="impact-coverage" role="status">An update is pending. Showing the last complete report.</p>}
              </div>
              <section className="snapshot-map" aria-labelledby="snapshot-map-title">
                <div className="section-heading">
                  <h2 id="snapshot-map-title">Projects in this ZIP</h2>
                  <span className="tag">Top {summary.highlights.length}</span>
                </div>
                <ProjectMap projects={mapProjects} location={context.location} zip={context.zip} noiseLocation={noiseLocation} onLocationSelect={setNoiseLocation} />
              </section>
            </div>
            <DecisionSignals signals={summary.decisionSignals} />
            <p className="snapshot-project-headline">{summary.headline}</p>
            <div className="pipeline-counts" aria-label="Documented project stages">
              <div>
                <strong>{summary.counts.permitted}</strong>
                <span>Permitted</span>
              </div>
              <div>
                <strong>{summary.counts.inReview}</strong>
                <span>In review</span>
              </div>
              <div>
                <strong>{summary.counts.earlyProposal}</strong>
                <span>Early proposal</span>
              </div>
            </div>
            <p className="muted snapshot-refreshed">
              Last checked{" "}
              {summary.refreshedAt
                ? new Date(summary.refreshedAt).toLocaleString()
                : "recently"}
              . Permits do not confirm construction.
            </p>
          </section>

          <PublicProjects projects={publicProjects} civicProjects={summary.civicProjects || []} />
          <Soundscore location={noiseLocation || context.location} />
          <ProPreview topics={summary.impactSummary.items.filter((impact) => impact.score === null)} />

          <div className="section-heading">
            <div>
              <h2>Project details</h2>
            </div>
          </div>
          {summary.highlights.map((project) => (
            <ProjectCard project={project} key={project.id} />
          ))}
          {!summary.highlights.length && (
            <section className="notice">
              No recent building plans were found in the available city records.
            </section>
          )}

          {!fullOpen && (
            <button
              className="secondary full-report-button"
              disabled={loadingFull}
              onClick={() => loadProjects("0")}
            >
              {loadingFull
                ? "Loading evidence…"
                : `Open full report${summary.moreCount ? ` · ${summary.moreCount} more` : ""}`}
            </button>
          )}

          {fullOpen && (
            <section className="full-report">
              <div className="section-heading">
                <div>
                  <h2>More project details</h2>
                </div>
              </div>
              {projects.map((project) => (
                <ProjectCard project={project} key={project.id} />
              ))}
              {nextCursor && (
                <button
                  className="secondary"
                  disabled={loadingFull}
                  onClick={() => loadProjects(nextCursor)}
                >
                  {loadingFull ? "Loading…" : "Show 20 more"}
                </button>
              )}
              <details className="coverage-details">
                <summary>Sources and what’s included</summary>
                {coverage.map((source) => (
                  <article key={source.id}>
                    <h3>
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.name} ↗
                      </a>
                    </h3>
                    <p>
                      {source.status || "unknown"} ·{" "}
                      {source.recordsReceived ?? source.recordsExamined ?? 0}{" "}
                      records
                    </p>
                    {source.error && <p>{source.error}</p>}
                  </article>
                ))}
                <p>
                  This report covers connected official sources only. Missing
                  records do not establish that no change is planned.
                </p>
              </details>
            </section>
          )}
        </>
      )}
    </main>
  );
}
