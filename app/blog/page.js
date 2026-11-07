import Link from "next/link";
import { BLOG_POSTS, BLOG_ORIGIN } from "../../lib/blog.mjs";
export const metadata = { title: "Product updates | Home Area Reporter", description: "New features, coverage updates and practical ways to use your neighborhood report.", alternates: { canonical: `${BLOG_ORIGIN}/blog` } };
export default function Blog() {
  return <main><h1>What’s new</h1><p className="intro">New features, useful context, and where we cover next.</p>
    {BLOG_POSTS.toSorted((a, b) => b.date.localeCompare(a.date)).map((post) => <article className="notice" key={post.slug}>
      <time dateTime={post.date}>{post.date}</time><h2><Link href={`/blog/${post.slug}`}>{post.title}</Link></h2><p>{post.summary}</p><Link href={`/blog/${post.slug}`}>Read the update →</Link>
    </article>)}
  </main>;
}
