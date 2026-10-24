export const metadata = { title: "Privacy — Home Area Reporter" };

export default function Privacy() {
  return (
    <main className="privacy-page">
      <p className="eyebrow">HOME AREA REPORTER</p>
      <h1>Privacy</h1>
      <p className="muted">Updated October 22, 2026</p>
      <h2>What the extension reads</h2>
      <p>When you open the extension on Redfin or Zillow, it checks the active tab’s URL and reads listing information on that page to find a ZIP code, address and coordinates. It may read the page title and text to find a supported ZIP. This extraction happens locally in your browser. We do not read your browsing history or other tabs.</p>
      <h2>What is sent to the reporter website</h2>
      <p>Choosing Check this area sends the selected ZIP to the reporter backend. Listing-location sharing is off by default. If you turn it on, coordinates are included in the report/map requests, and the listing address is included when you open the full report. The Redfin or Zillow listing URL is not sent.</p>
      <h2>Storage and service providers</h2>
      <p>The extension stores only the reporter website origin in Chrome’s local extension storage. Listing addresses and coordinates are not saved in that storage or in our permit database. The database stores public project evidence, and permit/transit responses may be cached to provide the report. Hosting providers may process request information, including IP addresses and request URLs, in operational logs under their own retention settings. Optional listing information in a URL can also remain in browser history.</p>
      <p>Map tiles are requested from the configured map provider. The default low-volume map uses OpenStreetMap tiles; the provider can receive your IP address and requested map area. The transit overlay uses King County route data. The optional Soundscore action sends your selected map coordinates to HowLoud only when you choose Check Soundscore and that service is configured. We do not cache Soundscore results.</p>
      <h2>Analytics and use of data</h2>
      <p>The website supports optional Google Analytics 4 to measure visits, ZIP searches, successful report loads, home/commercial view selections, full-report opens and interest in the coming-soon Pro report. When enabled, Google Analytics loads only after you choose Allow analytics. No Analytics requests are sent before permission; choosing No thanks keeps it blocked. The extension popup and embedded map are not instrumented.</p>
      <p>Analytics events use fixed page names and categorical actions, plus a selected five-digit ZIP where relevant. We exclude listing addresses, coordinates, listing URLs, query strings, page-title addresses and full referrer URLs from these events. Automatic enhanced measurement, advertising personalization and Google Signals are disabled. Google can process usage events, browser/device information and IP addresses to provide analytics, and can set first-party Analytics cookies after permission. These are not anonymous visits. See <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google’s privacy policy</a>.</p>
      <p>Your analytics choice is stored in this browser’s local storage. Use Analytics preferences at the bottom of the website to change it. Withdrawing permission removes this site’s Analytics cookies and reloads the page to stop the loaded tag; it does not delete data Google already received. Local development, preview deployments and embedded map pages do not send analytics. This service does not sell personal data or use listing information for advertising. Public permit records describe projects and can include addresses; they are separate from the listing context you choose to share.</p>
      <h2>Your choices</h2>
      <p>Keep listing-location sharing off to use ZIP-only reports. You can edit the ZIP before searching, clear the extension’s local storage, or uninstall it. You can decline to open a full report or request a Soundscore. For questions about the service, use the support contact published with the Chrome Web Store listing. Do not include personal information in public project discussions.</p>
      <p><a href="/">Back to Home Area Reporter</a></p>
    </main>
  );
}
