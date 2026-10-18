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
          Explore documented housing and development activity in a Seattle ZIP
          code. See the original records, their status, and the questions worth
          asking.
        </p>
        <form action="/report">
          <label htmlFor="zip">Seattle ZIP code</label>
          <div className="inputrow">
            <input
              id="zip"
              name="zip"
              required
              pattern="98[0-9]{3}"
              inputMode="numeric"
              maxLength={5}
              placeholder="98109"
            />
            <button>Check this area →</button>
          </div>
        </form>
        <p className="muted">
          No account or payment required. Try 98109, 98103 or 98122.
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
          This first version queries the city’s public permit APIs on demand.
          Searches may take up to 20 seconds. ZIP codes identify areas; this
          report does not establish a project’s proximity or impact on a
          particular home.
        </p>
      </section>
    </main>
  );
}
