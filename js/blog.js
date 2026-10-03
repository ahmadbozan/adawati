/* المدونة: قائمة المقالات + عرض مقال. كل النصوص تدخل عبر textContent (بدون innerHTML). */
(() => {
"use strict";
const C = window.APP_CONFIG;
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const $ = (s) => document.querySelector(s);
const SITE = "https://ahmadbozan.github.io/adawati/";

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) { if (v == null || v === false) continue; k === "class" ? (el.className = v) : el.setAttribute(k, v === true ? "" : String(v)); }
  kids.flat().forEach((k) => { if (k != null && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k))); });
  return el;
}
const fmtDate = (d) => new Date(d).toLocaleDateString("ar", { dateStyle: "long" });

function renderBody(text) {
  const box = h("div", { class: "article-body" });
  text.split(/\n{2,}/).forEach((blk) => {
    const lines = blk.split("\n").map((l) => l.trimEnd()).filter(Boolean);
    if (!lines.length) return;
    if (lines[0].startsWith("## ")) { box.append(h("h2", {}, lines[0].slice(3))); lines.shift(); if (!lines.length) return; }
    if (lines.every((l) => l.startsWith("- "))) box.append(h("ul", {}, lines.map((l) => h("li", {}, l.slice(2)))));
    else box.append(h("p", { style: "white-space:pre-line" }, lines.join("\n")));
  });
  return box;
}
function setMeta(title, desc, url) {
  document.title = title + " — أدواتي";
  const set = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', "content", desc);
  set('link[rel="canonical"]', "href", url);
  set('meta[property="og:title"]', "content", title);
  set('meta[property="og:description"]', "content", desc);
  set('meta[property="og:url"]', "content", url);
}
function jsonLd(post, url) {
  const s = document.createElement("script"); s.type = "application/ld+json";
  s.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: post.title, description: post.excerpt, datePublished: post.created_at, dateModified: post.updated_at, author: { "@type": "Person", name: "ahmad bozan" }, mainEntityOfPage: url, inLanguage: "ar" });
  document.head.append(s);
}

async function main() {
  const slug = new URLSearchParams(location.search).get("p");
  const staticList = $("#staticList"), dyn = $("#dyn"), single = $("#single");
  if (slug) {
    staticList.hidden = true; dyn.hidden = true; single.hidden = false;
    single.replaceChildren(h("p", { class: "muted" }, "جاري التحميل…"));
    const { data } = await sb.from("posts").select("*").eq("slug", slug).eq("published", true).maybeSingle();
    if (!data) { single.replaceChildren(h("h1", {}, "المقال غير موجود"), h("p", {}, "ربما انحذف أو تغيّر رابطه."), h("p", {}, h("a", { href: "blog.html" }, "← كل المقالات"))); return; }
    const url = SITE + "blog.html?p=" + data.slug;
    setMeta(data.title, data.excerpt || data.title, url); jsonLd(data, url);
    single.replaceChildren(h("h1", {}, data.title), h("p", { class: "muted small-text" }, fmtDate(data.created_at) + " — ahmad bozan"), renderBody(data.body),
      h("p", {}, h("a", { href: "index.html" }, "جرّب الأدوات مجاناً"), " · ", h("a", { href: "blog.html" }, "كل المقالات")));
    return;
  }
  const { data } = await sb.from("posts").select("slug,title,excerpt,created_at").eq("published", true).order("created_at", { ascending: false }).limit(100);
  if (data && data.length) {
    dyn.hidden = false;
    dyn.replaceChildren(h("h2", {}, "أحدث المقالات"), ...data.map((p) => h("div", { class: "result", style: "flex-direction:column;align-items:flex-start;gap:.2rem" },
      h("a", { href: "blog.html?p=" + encodeURIComponent(p.slug), style: "font-weight:600;font-size:1.05rem" }, p.title),
      h("div", { class: "muted small-text" }, fmtDate(p.created_at)), p.excerpt ? h("div", { class: "muted" }, p.excerpt) : null)));
  }
}
main().catch(() => { /* ignore */ });
})();
