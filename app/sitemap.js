import { BLOG_POSTS, BLOG_ORIGIN } from "../lib/blog.mjs";
export default function sitemap() {
  return ["", "/coverage", "/privacy", "/blog"].map((path) => ({ url: BLOG_ORIGIN + path }))
    .concat(BLOG_POSTS.map((post) => ({ url: `${BLOG_ORIGIN}/blog/${post.slug}`, lastModified: post.date })));
}
