export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Before the offer. Beyond the listing.</p>
        <h1>
          What’s changing
          <br />
          in this area?
        </h1>
        <p className="intro">
          See a focused view of documented housing and development activity,
          ranked for usefulness instead of receiving hundreds of permit rows.
        </p>
        <form action="/report">
          <label htmlFor="zip">Seattle ZIP code</label>
          <div className="inputrow">
            <input
              id="zip"
              name="zip"
              required
              pattern="9810[1-5]"
              inputMode="numeric"
              maxLength={5}
              placeholder="98103"
              title="Enter a ZIP code from 98101 through 98105"
            />
            <button>Check this area →</button>
          </div>
        </form>
        <p className="muted">
          Initial preview areas: 98101, 98102, 98103, 98104 and 98105.
        </p>
      </section>
      <section className="grid">
        <article>
          <h2>Documented activity</h2>
          <p>
            Building and land-use applications, project descriptions,
            housing-unit fields and recorded decisions.
          </p>
        </article>
        <article>
          <h2>Traceable evidence</h2>
          <p>
            Official City of Seattle records with original permit statuses and
            source links.
          </p>
        </article>
        <article>
          <h2>Clear limits</h2>
          <p>
            Transit, parking and public infrastructure coverage are coming
            later. Missing records do not mean no change.
          </p>
        </article>
      </section>
      <section className="notice">
        <h2>Free early release</h2>
        <p>
            The focused view shows up to fifteen current highlights. Open the full
            report only when you want source coverage and additional evidence.
        </p>
      </section>
    </main>
  );
}
