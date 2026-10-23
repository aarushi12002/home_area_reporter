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
      <p>This release does not include Google Analytics, advertising trackers, sale of personal data or use of listing information for advertising. Data is used to provide the neighborhood-research features you request. Public permit records describe projects and can include addresses; they are separate from the listing context you choose to share.</p>
      <h2>Your choices</h2>
      <p>Keep listing-location sharing off to use ZIP-only reports. You can edit the ZIP before searching, clear the extension’s local storage, or uninstall it. You can decline to open a full report or request a Soundscore. For questions about the service, use the support contact published with the Chrome Web Store listing. Do not include personal information in public project discussions.</p>
      <p><a href="/">Back to Home Area Reporter</a></p>
    </main>
  );
}
