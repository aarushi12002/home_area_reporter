"use client";
import { useEffect, useState } from "react";
export default function Report() {
  const [zip, setZip] = useState(""),
    [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0),
    [visibleCount, setVisibleCount] = useState(20);
  useEffect(() => {
    const controller = new AbortController();
    const z = new URLSearchParams(window.location.search).get("zip") || "";
    setZip(z);
    setLoading(true);
    setError("");
    setData(null);
    setVisibleCount(20);
    if (!/^98\d{3}$/.test(z)) {
      setError("Enter a five-digit Seattle-area ZIP beginning with 98.");
      setLoading(false);
      return () => controller.abort();
    }
    fetch("/api/report?zip=" + encodeURIComponent(z), {
      signal: controller.signal,
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok && !d.coverage)
          throw new Error(d.error || "Unable to generate report.");
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [attempt]);
  return (
    <main>
      <div className="row">
        <a href="/">← Check another ZIP</a>
        {data && (
          <button className="secondary" onClick={() => window.print()}>
            Print / save PDF
          </button>
        )}
      </div>
      <p className="eyebrow">AREA RESEARCH · FREE PREVIEW</p>
      <h1>
        {zip || "Seattle"}
        <br />
        <span className="muted">Development brief.</span>
      </h1>
      {loading && (
        <section className="notice" role="status">
          <h2>Checking official permit records…</h2>
          <p>
            Building and land-use sources are queried independently. This can
            take up to 20 seconds; any unavailable source will stay visibly
            marked.
          </p>
        </section>
      )}
      {error && (
        <section className="notice" role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((x) => x + 1)}>Try again</button>
        </section>
      )}
      {data && (
        <>
          <section className="notice">
            <h2>
              {data.status === "unavailable"
                ? "Sources unavailable"
                : data.status === "partial"
                  ? "Partial report — coverage gaps"
                  : data.projects.length
                    ? "Documented activity to investigate"
                    : "No matching activity in the examined records"}
            </h2>
            <p>
              {data.status === "unavailable"
                ? "We could not complete either source search. No conclusion can be drawn about development in this ZIP."
                : `${data.projects.length} grouped development record${data.projects.length === 1 ? "" : "s"} matched our filter.`}
            </p>
            {!data.projects.length && data.status !== "unavailable" && (
              <p>
                This may reflect an unsupported ZIP, missing ZIP fields, record
                filters or limited coverage. It is not a “no development”
                finding.
              </p>
            )}
            <p className="muted">
              Retrieved {new Date(data.generatedAt).toLocaleString()} ·{" "}
              {data.cached
                ? "cached response; timestamps retained"
                : "live API lookup"}
            </p>
          </section>
          <h2>Source coverage</h2>
          <div className="grid coverage">
            {data.coverage.map((s) => (
              <article key={s.id}>
                <h3>
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.name} ↗
                  </a>
                </h3>
                <p>
                  {s.status === "ok"
                    ? "Search succeeded"
                    : s.status === "limited"
                      ? "Query cap reached — incomplete"
                      : "Source failed — incomplete"}
                </p>
                <p className="muted">
                  {s.recordsExamined} records examined ·{" "}
                  {new Date(s.retrievedAt).toLocaleString()}
                </p>
                {s.error && <p>{s.error}</p>}
              </article>
            ))}
          </div>
          {data.status !== "ready" && (
            <button
              className="secondary"
              onClick={() => setAttempt((x) => x + 1)}
            >
              Retry sources
            </button>
          )}
          <h2>Development records</h2>
          <p>
            Newest available source event dates first. Undated records follow;
            their age and current relevance need verification.
          </p>
          <p className="muted">
            Cancelled, completed, expired and routine administrative work are
            filtered. Explicitly linked permits are grouped; other duplicates
            may remain. Units are not summed.
          </p>
          <div className="projects">
            {data.projects.slice(0, visibleCount).map((p) => (
              <article className="project" key={p.id}>
                <div className="row">
                  <span className="eyebrow">{p.primary.stage}</span>
                  <span className="tag">{p.primary.status}</span>
                </div>
                <h2>{p.address}</h2>
                <p>{p.primary.description}</p>
                <p>
                  {p.primary.date
                    ? "Source event date: " +
                      p.primary.date +
                      " (decision, issuance or application where supplied)"
                    : "Source event date unavailable — age and current relevance unverified."}
                </p>
                {p.primary.added !== null && (
                  <p>
                    Housing units added, as recorded: {p.primary.added}
                    {p.primary.removed !== null
                      ? ` · removed: ${p.primary.removed}`
                      : ""}
                  </p>
                )}
                <div className="implication">
                  <h3>What to investigate</h3>
                  <p>{p.consideration}</p>
                </div>
                <details>
                  <summary>
                    Evidence · {p.records.length} linked record
                    {p.records.length === 1 ? "" : "s"}
                  </summary>
                  {p.records.map((x) => (
                    <div className="record" key={x.sourceId + x.id}>
                      <a href={x.url} target="_blank" rel="noreferrer">
                        {x.source} · {x.id} ↗
                      </a>
                      <p>Original status: {x.status}</p>
                      {x !== p.primary && <p>{x.description}</p>}
                    </div>
                  ))}
                </details>
              </article>
            ))}
          </div>
          {data.projects.length > visibleCount && (
            <button
              className="secondary"
              onClick={() => setVisibleCount((x) => x + 20)}
            >
              Show 20 more records ({data.projects.length - visibleCount}{" "}
              remaining)
            </button>
          )}
          <section className="notice">
            <h2>Read this report in context</h2>
            <ul>
              {data.limits.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p>
              City of Seattle datasets: Building Permits and Land Use Permits,
              labeled Public Domain. Linked documents may carry separate rights.
              This report is not a physical inspection or legal determination.
            </p>
          </section>
        </>
      )}
    </main>
  );
}
