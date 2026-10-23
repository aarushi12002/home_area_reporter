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
          Beyond the listing. See how nearby changes could affect your daily
          life—and what you get for your money.
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
