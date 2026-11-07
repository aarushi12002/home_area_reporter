export const BLOG_ORIGIN = "https://home-area-reporter.vercel.app";
// Repository-managed release notes; publication dates are explicit Pacific dates.
export const BLOG_POSTS = [
  {
    slug: "more-free-housing-context", date: "2026-11-03",
    title: "More housing context in your free neighborhood report",
    summary: "Explore historical housing costs, building age and work-from-home patterns across 33,772 Census ZIP-like areas.",
    sections: [
      { title: "What changed", paragraphs: ["Free reports now include 14 Census metrics. New additions cover owner-reported home value, monthly owner costs with a mortgage, the share of income spent on rent, median building year, detached housing and working from home.", "Housing costs appear first. Expand the housing and getting-around sections when you want more detail. Available Census context also appears alongside connected local project reports."] },
      { title: "Why it helps", paragraphs: ["Use these area-level facts to put a home search in context and decide what to investigate next. They complement the development plans and official evidence in connected project reports."] },
      { title: "What to keep in mind", paragraphs: ["The 2024 ACS release describes 2020–2024 survey estimates, with uncertainty and missing values preserved. It does not give current asking prices, a property valuation, rental forecasts or ADU eligibility.", "Census ZIP Code Tabulation Areas approximate postal ZIPs; not every postal ZIP is covered. National Census context does not imply nationwide permit or zoning coverage. Paid reports are not available yet."] },
    ], cta: { label: "Explore a free report", href: "/report?zip=02139" },
  },
  {
    slug: "seattle-neighborhood-reports", date: "2026-10-26",
    title: "Seattle project reports across 31 reviewed ZIP areas",
    summary: "See what is planned, what it could mean, and the official records behind each project.",
    sections: [
      { title: "What changed", paragraphs: ["Seattle project reports cover 31 reviewed city-intersecting ZIP areas. Background refreshes prepare stored reports, so opening a report does not start a new permit download.", "The snapshot names up to two specific planned changes and explains their possible implications. Explore project markers, selected public improvements and current Metro route geography, then open official evidence when you need more detail."] },
      { title: "Why it helps", paragraphs: ["A listing describes the property. Nearby housing proposals, commercial-use work and public improvements provide another set of questions to investigate before choosing an area."] },
      { title: "Coverage and limits", paragraphs: ["Shared ZIPs contain Seattle municipal records only. Selected neighborhood and public-project highlights are not exhaustive directories. Proposed and permitted work does not confirm construction, completion or future property values.", "Coverage evolves separately by jurisdiction. Check the coverage directory for the current publication status beyond Seattle."] },
    ], cta: { label: "Try a Seattle report", href: "/report?zip=98103" },
  },
];

export function blogPost(slug) {
  return BLOG_POSTS.find((post) => post.slug === slug) || null;
}
export function blogMetadata(post) {
  const url = `${BLOG_ORIGIN}/blog/${post.slug}`;
  return { title: `${post.title} | Home Area Reporter`, description: post.summary,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.summary, url, type: "article", publishedTime: post.date },
    twitter: { card: "summary", title: post.title, description: post.summary } };
}
