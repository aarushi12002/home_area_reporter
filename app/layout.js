import "./globals.css";
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
          Public records, clearly bounded. No forecasts or complete-coverage
          claims.
        </footer>
      </body>
    </html>
  );
}
