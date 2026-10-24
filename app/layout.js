import "./globals.css";
import "leaflet/dist/leaflet.css";
import Analytics from "../components/Analytics";
export const metadata = {
  title: "Home Area Reporter — What is changing in this ZIP?",
  description:
    "Source-backed Seattle development applications and permit research.",
};
export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>
          <a className="brand" href="/">
            HOME AREA REPORTER
          </a>
          <span>Seattle · free early preview</span>
        </header>
        {children}
        <footer>
          Based on Seattle city records. Plans can change.
          <a href="/privacy">Privacy</a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
