import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS, blogPost, blogMetadata } from "../../../lib/blog.mjs";
export const dynamicParams = false;
export function generateStaticParams() { return BLOG_POSTS.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }) { const post = blogPost((await params).slug); return post ? blogMetadata(post) : {}; }
export default async function Post({ params }) {
  const post = blogPost((await params).slug); if (!post) notFound();
  return <main className="blog-post"><Link href="/blog">← All updates</Link><article>
    <time dateTime={post.date}>{post.date}</time><h1>{post.title}</h1><p className="intro">{post.summary}</p>
    {post.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
    <p><Link className="button-link" href={post.cta.href}>{post.cta.label} →</Link></p><p><Link href="/coverage">Check current coverage</Link></p>
  </article></main>;
}
