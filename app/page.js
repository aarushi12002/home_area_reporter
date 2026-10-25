export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">Before the offer. Beyond the listing.</p>
        <h1>
          See tomorrow’s neighborhood before paying today’s price.
        </h1>
        <p className="intro">
          Your next neighborhood. Your money. Fewer surprises.
        </p>
        <form action="/report" data-analytics="zip-search">
          <label htmlFor="zip">ZIP code</label>
          <div className="inputrow">
            <input
              id="zip"
              name="zip"
              required
              pattern="[0-9]{5}"
              inputMode="numeric"
              maxLength={5}
              placeholder="98103"
              title="Enter a five-digit ZIP code"
            />
            <button>Check this area →</button>
          </div>
        </form>
        <p className="muted">
          Seattle reports become available as each area passes review. Coverage varies by ZIP.
        </p>
      </section>
      <section className="grid">
        <article>
          <h2>What’s planned</h2>
          <p>
            New housing plans, building proposals and city decisions.
          </p>
        </article>
        <article>
          <h2>Check the source</h2>
          <p>
            Links to Seattle’s city records so you can explore each project.
          </p>
        </article>
        <article>
          <h2>A quick local picture</h2>
          <p>
            Start with local building plans. A deeper Pro report is coming soon.
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
