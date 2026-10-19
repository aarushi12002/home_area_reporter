"use client";
import { useEffect, useState } from "react";
import ProjectMap from "../../components/ProjectMap";

const STAGES = {
  permitted: "Permitted",
  in_review: "In review",
  early_proposal: "Early proposal",
  uncertain: "Status needs review",
};

function ProjectCard({ project }) {
  return (
    <article className="project">
      <div className="row">
        <span className="eyebrow">
          {STAGES[project.stage] || "Documented activity"}
        </span>
        {project.scaleBand && <span className="tag">{project.scaleBand}</span>}
      </div>
      <h2>{project.address || project.displayAddress}</h2>
      <p>{project.summary}</p>
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
          Review official evidence ↗
        </a>
      )}
    </article>
  );
}

export default function Report() {
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
    fetch(`/api/area-summary?${context.query}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to build summary.");
        return body;
      })
      .then(setSummary)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, context.query]);

  async function loadProjects(cursor = "0") {
    setLoadingFull(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects?${context.query}&cursor=${encodeURIComponent(cursor)}`,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to load evidence.");
      setProjects((current) =>
        cursor === "0" ? body.items : [...current, ...body.items],
      );
      setCoverage(body.coverage || []);
      setNextCursor(body.nextCursor);
      setFullOpen(true);
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
      ]
    : [];

  return (
    <main>
      <div className="row">
        <a href="/">← Check another ZIP</a>
        {summary && (
          <button className="secondary" onClick={() => window.print()}>
            Print / save PDF
          </button>
        )}
      </div>
      <p className="eyebrow">AREA RESEARCH · DOCUMENTED CHANGE PIPELINE</p>
      <h1>
        {context.address || context.zip || "Seattle"}
        <br />
        <span className="muted">What may change nearby.</span>
      </h1>
      {loading && (
        <section className="notice" role="status">
          <h2>Building a focused neighborhood view…</h2>
          <p>
            Reviewing current documented projects without loading the full
            permit archive.
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
      {summary && (
        <>
          <section className="notice summary-hero">
            <p className="eyebrow">NEIGHBORHOOD SNAPSHOT</p>
            <h2>{summary.headline}</h2>
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
            <p className="muted">
              Official records refreshed{" "}
              {summary.refreshedAt
                ? new Date(summary.refreshedAt).toLocaleString()
                : "recently"}
              . These are documented stages, not predictions or confirmation of
              construction.
            </p>
          </section>

          <div className="section-heading">
            <div>
              <p className="eyebrow">PRIMARY VIEW</p>
              <h2>Changes worth investigating</h2>
            </div>
            <span className="tag">Top {summary.highlights.length}</span>
          </div>
          <ProjectMap projects={mapProjects} location={context.location} />
          {summary.highlights.map((project) => (
            <ProjectCard project={project} key={project.id} />
          ))}
          {!summary.highlights.length && (
            <section className="notice">
              No recent, sufficiently supported project highlights are available
              for this area.
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
                  <p className="eyebrow">FULL REPORT</p>
                  <h2>Current project evidence</h2>
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
                <summary>Source coverage and limitations</summary>
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
