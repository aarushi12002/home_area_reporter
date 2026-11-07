import "./globals.css";
import "leaflet/dist/leaflet.css";
import Analytics from "../components/Analytics";
export const metadata = {
  title: "Home Area Reporter — What is changing in this ZIP?",
  description:
    "Development plans and neighborhood context by ZIP.",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>
          <a className="brand" href="/">
            HOME AREA REPORTER
          </a>
          <nav aria-label="Main navigation"><a href="/coverage">Coverage</a> · <a href="/blog">Updates</a></nav>
        </header>
        {children}
        <footer>
          Coverage varies by area. Plans can change.
          <a href="/privacy">Privacy</a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
