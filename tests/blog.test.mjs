import test from "node:test";
import assert from "node:assert/strict";
import { BLOG_POSTS, blogPost, blogMetadata, BLOG_ORIGIN } from "../lib/blog.mjs";
import sitemap from "../app/sitemap.js";
test("release posts have unique safe routes, valid dates, usable CTAs and share metadata", () => {
  assert.equal(new Set(BLOG_POSTS.map((p) => p.slug)).size, BLOG_POSTS.length);
  for (const post of BLOG_POSTS) {
    assert.match(post.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Number.isFinite(Date.parse(post.date)));
    assert.ok(post.sections.every((s) => s.title && s.paragraphs.length));
    assert.match(post.cta.href, /^\/report\?zip=\d{5}$/);
    assert.equal(blogMetadata(post).alternates.canonical, `${BLOG_ORIGIN}/blog/${post.slug}`);
    assert.ok(sitemap().some((entry) => entry.url === blogMetadata(post).alternates.canonical));
  }
  assert.equal(blogPost("../../private"), null);
  assert.equal(blogPost("missing-release"), null);
});
