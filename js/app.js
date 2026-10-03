/* أدواتي — الواجهة الأمامية
 * قاعدة الأمان: كل نص ديناميكي يدخل الصفحة عبر textContent فقط (لا innerHTML إطلاقاً)،
 * وكل منطق مالي يتم في Supabase (دوال + RLS). */
(() => {
"use strict";

const C = window.APP_CONFIG;
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/* ---------------- أدوات مساعدة ---------------- */
const $ = (s) => document.querySelector(s);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (["value", "checked", "disabled", "hidden", "selected", "multiple"].includes(k)) el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  const add = (k) => {
    if (k == null || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return el;
}

const money = (n) => Number(n || 0).toFixed(2);
const fmtDate = (d) => (d ? new Date(d).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) : "—");
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(2) + " MB" : (b / 1024).toFixed(1) + " KB");

function toast(msg, type) {
  const t = h("div", { class: "toast " + (type || "") }, msg);
  $("#toasts").append(t);
  setTimeout(() => t.remove(), 4200);
}

const ERRORS = {
  rate_limited: "طلبات كتيرة بوقت قصير. جرّب بعد شوي.",
  not_authenticated: "سجّل دخولك أولاً.",
  invalid_amount: "المبلغ غير صالح.",
  invalid_method: "طريقة الدفع غير صالحة.",
  invalid_name: "الاسم لازم يكون بين 2 و40 حرف.",
  insufficient_balance: "رصيدك ما بيكفي. اشحن محفظتك أولاً.",
  already_joined: "أنت مشترك بهالسحب من قبل.",
  draw_closed: "السحب مغلق حالياً.",
  forbidden: "ما عندك صلاحية لهالإجراء.",
  not_pending: "هالطلب تمت معالجته من قبل.",
  user_not_found: "المستخدم غير موجود.",
  no_entries: "ما في مشتركين بالسحب.",
  already_closed: "السحب انتهى. ابدأ جولة جديدة.",
  fee_locked: "ما بتقدر تغيّر الرسوم بعد دخول مشتركين.",
  cannot_modify_owner: "ما بيصير تعديل حساب المالك.",
  invalid_days: "عدد الأيام بين 1 و3650.",
  invalid_password: "كلمة السر لازم تكون من 10 إلى 72 حرف.",
  banned: "حسابك معلّق. تواصل مع الإدارة.",
  disposable_email: "هالإيميل غير مسموح. استخدم إيميل حقيقي.",
};
function errMsg(e) {
  const m = (e && (e.message || e.error || e.msg)) || String(e || "");
  for (const k of Object.keys(ERRORS)) if (m.includes(k)) return ERRORS[k];
  if (/Database error saving new user/i.test(m)) return "هالإيميل غير مسموح. استخدم إيميل حقيقي.";
  if (/Invalid login credentials/i.test(m)) return "الإيميل أو كلمة السر غير صحيحة.";
  if (/already registered/i.test(m)) return "هالإيميل مسجّل من قبل.";
  if (/Email not confirmed/i.test(m)) return "أكّد إيميلك أولاً من الرسالة اللي وصلتك.";
  if (/rate limit/i.test(m)) return "محاولات كتيرة. استنى شوي وجرّب مرة ثانية.";
  return "صار خطأ. جرّب مرة ثانية.";
}

/* ---------------- الحالة ---------------- */
const state = { session: null, user: null, profile: null, content: {}, packages: [], drawVisible: false };

const DEFAULTS = {
  brand_name: "أدواتي",
  hero_title: "أدوات سريعة تشتغل داخل متصفحك",
  hero_sub: "اضغط الصور، قصّ الصوتيات، وولّد رموز QR. ملفاتك ما بتطلع من جهازك أبداً.",
  announcement: "",
  footer_text: "جميع الحقوق محفوظة لصالح ahmad bozan © 2026",
  vip_pitch: "عضوية VIP بتفتح المعالجة غير المحدودة وبتخفي الإعلانات تلقائياً.",
  tool_image_title: "الصور",
  tool_audio_title: "الصوت",
  tool_qr_title: "رمز QR",
  tool_text_title: "النصوص",
  pay_note: "حوّل المبلغ بالضبط ثم أرسل إيصال التحويل على تلغرام مع طلبك.",
  pay_sham: "",
  pay_syriatel: "",
  pay_binance: "",
  logo_url: "",
};
const CONTENT_LABELS = {
  brand_name: "اسم الموقع", hero_title: "العنوان الرئيسي", hero_sub: "الوصف تحت العنوان",
  announcement: "إعلان أعلى الصفحة (فاضي = مخفي)", footer_text: "نص الحقوق (الفوتر)",
  vip_pitch: "نص ترويج VIP", tool_image_title: "عنوان تبويب الصور",
  tool_audio_title: "عنوان تبويب الصوت", tool_qr_title: "عنوان تبويب QR", tool_text_title: "عنوان تبويب النصوص",
  pay_note: "ملاحظة الدفع (تظهر قبل الطلب)", pay_sham: "بيانات شام كاش (رقم/كود)", pay_syriatel: "بيانات سيريتل كاش (رقم)", pay_binance: "بيانات باينانس (Pay ID أو عنوان USDT + الشبكة)",
};
const T = (k) => (state.content[k] !== undefined && state.content[k] !== "" ? state.content[k] : DEFAULTS[k] || "");

const METHODS = {
  sham_cash: "شام كاش (Sham Cash)",
  syriatel_cash: "سيريتل كاش (Syriatel Cash)",
  binance_usdt: "باينانس (Binance - USDT)",
};

const isStaff = () => !!state.profile && ["admin", "owner"].includes(state.profile.role);
const can = (p) => !!state.profile && (state.profile.role === "owner" || (state.profile.role === "admin" && state.profile.permissions && state.profile.permissions[p] === true));
const isVip = () => {
  const p = state.profile;
  return !!p && (p.vip_lifetime || (p.vip_until && new Date(p.vip_until) > new Date()));
};

/* ---------------- تحميل البيانات ---------------- */
async function loadContent() {
  const { data } = await sb.from("site_content").select("key,value");
  state.content = {};
  (data || []).forEach((r) => (state.content[r.key] = r.value));
}
async function loadPackages() {
  const { data } = await sb.from("vip_packages").select("*").order("amount");
  state.packages = data || [];
}
async function loadProfile() {
  if (!state.user) { state.profile = null; return; }
  const { data } = await sb.from("profiles").select("*").eq("id", state.user.id).single();
  state.profile = data || null;
  if (state.profile && state.profile.banned) {
    state.profile = null; toast("تم تعليق حسابك. تواصل مع الإدارة.", "err");
    await sb.auth.signOut();
  }
}
async function loadDrawFlag() {
  const { data } = await sb.rpc("get_draw_public");
  state.drawVisible = !!(data && data.visible);
}

/* ---------------- الواجهة العامة (الهيدر/الفوتر/الإعلانات) ---------------- */
function applyChrome() {
  $("#brandName").textContent = T("brand_name");
  const logo = $("#logo");
  const u = T("logo_url");
  if (u && u.startsWith(C.SUPABASE_URL + "/")) { logo.src = u; logo.hidden = false; } else logo.hidden = true;
  $("#footerText").textContent = T("footer_text");
  $("#authBtn").textContent = state.user ? "خروج" : "دخول";

  const route = currentRoute();
  const links = [["#/", "الأدوات"]];
  if (state.drawVisible || isStaff()) links.push(["#/draw", "السحب"]);
  if (state.user) links.push(["#/account", "حسابي"]);
  if (isStaff()) links.push(["#/admin", "الإدارة"]);
  const nav = $("#nav");
  nav.replaceChildren(...links.map(([href, label]) =>
    h("a", { href, class: route === href.slice(1) ? "on" : "" }, label, href === "#/account" && isVip() ? h("span", { class: "vip-badge", style: "margin-inline-start:.4rem;padding:0 .5rem;font-size:.7rem" }, "VIP") : null)));
  setupAds();
}

let adsLoaded = false;
function setupAds() {
  const slots = [["#adTop", C.ADSENSE_SLOT_TOP], ["#adBottom", C.ADSENSE_SLOT_BOTTOM]];
  const show = !!C.ADSENSE_CLIENT && !isVip() && getConsent() === "yes";
  for (const [sel, slot] of slots) {
    const box = $(sel);
    if (!show || !slot) { box.hidden = true; box.replaceChildren(); continue; }
    if (!box.firstChild) {
      box.append(h("ins", { class: "adsbygoogle", style: "display:block", "data-ad-client": C.ADSENSE_CLIENT, "data-ad-slot": slot, "data-ad-format": "auto", "data-full-width-responsive": "true" }));
      box.hidden = false;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (_) { /* ignore */ }
    }
  }
  if (show && !adsLoaded) {
    adsLoaded = true;
    const s = document.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(C.ADSENSE_CLIENT);
    document.head.append(s);
  }
}

/* ---------------- نافذة حوار ---------------- */
const dlg = $("#dlg");
function openDlg(...nodes) { dlg.replaceChildren(...nodes); if (!dlg.open) dlg.showModal(); }
function closeDlg() { if (dlg.open) dlg.close(); }
dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDlg(); });

function confirmDlg(title, text, okLabel) {
  return new Promise((resolve) => {
    const done = (v) => { closeDlg(); resolve(v); };
    openDlg(h("h2", {}, title), h("p", { class: "muted" }, text),
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => done(true) }, okLabel || "تأكيد"),
        h("button", { class: "btn ghost", onclick: () => done(false) }, "إلغاء")));
  });
}

/* ---------------- المصادقة ---------------- */
function openAuth(mode) {
  mode = mode || "login";
  const email = h("input", { type: "email", required: true, autocomplete: "email", dir: "ltr", maxlength: "120" });
  const pass = h("input", { type: "password", autocomplete: mode === "signup" ? "new-password" : "current-password", dir: "ltr", maxlength: "72" });
  const err = h("p", { class: "small-text", style: "color:var(--danger)", role: "alert" });
  const title = { login: "تسجيل الدخول", signup: "إنشاء حساب", forgot: "استعادة كلمة السر" }[mode];
  const submit = h("button", { class: "btn", type: "submit" }, mode === "forgot" ? "أرسل رابط الاستعادة" : title);

  const form = h("form", { class: "stack" },
    h("h2", {}, title),
    h("div", {}, h("label", {}, "البريد الإلكتروني"), email),
    mode !== "forgot" ? h("div", {}, h("label", {}, mode === "signup" ? "كلمة السر (10 أحرف على الأقل)" : "كلمة السر"), pass) : null,
    err, submit,
    mode !== "forgot" ? h("button", { class: "btn ghost", type: "button", onclick: googleLogin }, "المتابعة عبر Google") : null,
    h("div", { class: "row between small-text" },
      mode !== "login" ? h("a", { href: "#", onclick: (e) => { e.preventDefault(); openAuth("login"); } }, "عندي حساب") : null,
      mode !== "signup" ? h("a", { href: "#", onclick: (e) => { e.preventDefault(); openAuth("signup"); } }, "حساب جديد") : null,
      mode === "login" ? h("a", { href: "#", onclick: (e) => { e.preventDefault(); openAuth("forgot"); } }, "نسيت كلمة السر؟") : null));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    submit.disabled = true;
    try {
      const em = email.value.trim().toLowerCase();
      const redirectTo = location.origin + location.pathname;
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email: em, password: pass.value });
        if (error) throw error;
        closeDlg(); toast("أهلاً فيك!", "good");
      } else if (mode === "signup") {
        if (pass.value.length < 10) throw new Error("كلمة السر لازم تكون 10 أحرف على الأقل.");
        const { data: su, error } = await sb.auth.signUp({ email: em, password: pass.value, options: { emailRedirectTo: redirectTo } });
        if (error) throw error;
        closeDlg();
        toast(su && su.session ? "تم إنشاء حسابك وسجّلنا دخولك. أهلاً فيك!" : "وصلتك رسالة تأكيد على الإيميل. أكّده ثم سجّل دخولك.", "good");
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(em, { redirectTo });
        if (error) throw error;
        closeDlg(); toast("إذا الإيميل مسجّل، وصلك رابط الاستعادة.", "good");
      }
    } catch (ex) { err.textContent = errMsg(ex); }
    submit.disabled = false;
  });
  openDlg(form);
}
async function googleLogin() {
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
  if (error) toast(errMsg(error), "err");
}

function openSetPassword(forced) {
  const p1 = h("input", { type: "password", autocomplete: "new-password", dir: "ltr", maxlength: "72" });
  const err = h("p", { class: "small-text", style: "color:var(--danger)", role: "alert" });
  const form = h("form", { class: "stack" },
    h("h2", {}, "كلمة سر جديدة"),
    forced ? h("p", { class: "hint-box" }, "الإدارة عيّنت لك كلمة سر مؤقتة. اختر كلمة سر خاصة فيك الآن.") : null,
    h("div", {}, h("label", {}, "كلمة السر الجديدة (10 أحرف على الأقل)"), p1), err,
    h("button", { class: "btn", type: "submit" }, "حفظ كلمة السر"));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (p1.value.length < 10) { err.textContent = "كلمة السر لازم تكون 10 أحرف على الأقل."; return; }
    const { error } = await sb.auth.updateUser({ password: p1.value, data: { must_change_password: false } });
    if (error) { err.textContent = errMsg(error); return; }
    closeDlg(); toast("تم تحديث كلمة السر.", "good");
  });
  openDlg(form);
}

/* ---------------- الأدوات ---------------- */
const FREE = { images: 3, imageBytes: 15 * 1048576, audioBytes: 40 * 1048576, audioSeconds: 300 };
const VIPL = { images: 100, imageBytes: 60 * 1048576, audioBytes: 300 * 1048576, audioSeconds: Infinity };
const lim = () => (isVip() ? VIPL : FREE);

function imageTool() {
  const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif,image/bmp", multiple: true });
  const fmt = h("select", {}, h("option", { value: "image/webp" }, "WebP (الأصغر حجماً)"), h("option", { value: "image/jpeg" }, "JPEG"), h("option", { value: "image/png" }, "PNG (بدون فقد)"));
  const q = h("input", { type: "range", min: "0.2", max: "1", step: "0.05", value: "0.8" });
  const qv = h("span", { class: "muted small-text" }, "80%");
  q.addEventListener("input", () => (qv.textContent = Math.round(q.value * 100) + "%"));
  const mw = h("input", { type: "number", min: "100", max: "8000", placeholder: "اتركه فاضي للحجم الأصلي", dir: "ltr" });
  const out = h("div", { class: "stack" });
  let urls = [];
  const go = h("button", { class: "btn" }, "ضغط الصور");

  go.addEventListener("click", async () => {
    let files = [...file.files];
    if (!files.length) return toast("اختر صورة أولاً.", "err");
    const L = lim();
    if (files.length > L.images) { toast(isVip() ? "الحد الأقصى " + L.images + " صورة بالمرة." : `النسخة المجانية: ${L.images} صور بالمرة. VIP بيفتح المزيد.`, "err"); files = files.slice(0, L.images); }
    urls.forEach(URL.revokeObjectURL); urls = []; out.replaceChildren();
    go.disabled = true;
    for (const f of files) {
      if (f.size > L.imageBytes) { out.append(h("p", { class: "muted" }, f.name + ": الحجم أكبر من المسموح (" + fmtSize(L.imageBytes) + ")")); continue; }
      try {
        const blob = await compressImage(f, fmt.value, Number(q.value), Number(mw.value) || 0);
        const url = URL.createObjectURL(blob); urls.push(url);
        const ext = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" }[fmt.value];
        const base = f.name.replace(/\.[^.]+$/, "").slice(0, 60);
        const pct = Math.round((1 - blob.size / f.size) * 100);
        out.append(h("div", { class: "result" }, h("img", { src: url, alt: "" }),
          h("div", { class: "info" }, h("div", {}, f.name), h("div", { class: "muted" }, fmtSize(f.size) + " ← " + fmtSize(blob.size), " ", pct > 0 ? h("span", { class: "saved" }, "وفّرت " + pct + "%") : "")),
          h("a", { class: "btn small", href: url, download: base + "-compressed." + ext }, "تنزيل")));
      } catch (_) { out.append(h("p", { style: "color:var(--danger)" }, f.name + ": تعذّرت معالجة هالملف.")); }
    }
    go.disabled = false;
  });

  return h("div", { class: "stack" },
    h("div", { class: "drop" }, h("div", {}, "اختر صورة أو أكثر (PNG, JPG, WebP, GIF, BMP)"), file),
    h("div", { class: "grid cols-2" },
      h("div", {}, h("label", {}, "الصيغة الناتجة"), fmt),
      h("div", {}, h("label", {}, "الجودة ", qv), q),
      h("div", {}, h("label", {}, "أقصى عرض (بكسل)"), mw)),
    go, out);
}
async function compressImage(file, type, quality, maxW) {
  const bmp = await createImageBitmap(file);
  let w = bmp.width, hh = bmp.height;
  if (w * hh > 60e6) throw new Error("too_large");
  if (maxW && w > maxW) { hh = Math.round((hh * maxW) / w); w = maxW; }
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = hh;
  const ctx = cv.getContext("2d");
  if (type === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, hh); }
  ctx.drawImage(bmp, 0, 0, w, hh);
  if (bmp.close) bmp.close();
  const blob = await new Promise((res) => cv.toBlob(res, type, quality));
  if (!blob) throw new Error("encode_failed");
  return blob;
}

/* ===== أدوات مشتركة ===== */
function suite(items) {
  const body = h("div", { class: "stack" });
  const pills = h("div", { class: "tabs" });
  const show = (i) => { [...pills.children].forEach((b, j) => b.classList.toggle("on", i === j)); body.replaceChildren(items[i][1]()); };
  items.forEach((it, i) => pills.append(h("button", { class: "tab sub", onclick: () => show(i) }, it[0])));
  show(0);
  return h("div", { class: "stack" }, pills, body);
}
function dlRow(thumb, name, info, url, dlName) {
  return h("div", { class: "result" }, thumb ? h("img", { src: thumb, alt: "" }) : null,
    h("div", { class: "info" }, h("div", {}, name), h("div", { class: "muted" }, info)),
    h("a", { class: "btn small", href: url, download: dlName }, "تنزيل"));
}
const IMG_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/bmp";
const tick = () => new Promise((r) => setTimeout(r, 30));

/* ===== تغيير حجم / قص الصور ===== */
function resizeTool() {
  const file = h("input", { type: "file", accept: IMG_ACCEPT, multiple: true });
  const w = h("input", { type: "number", min: "16", max: "8000", placeholder: "العرض (بكسل)", dir: "ltr" });
  const hh = h("input", { type: "number", min: "16", max: "8000", placeholder: "الارتفاع (بكسل)", dir: "ltr" });
  const mode = h("select", {}, h("option", { value: "fit" }, "الحفاظ على النسبة (داخل الأبعاد)"), h("option", { value: "crop" }, "قص من المنتصف لأبعاد دقيقة"));
  const fmt = h("select", {}, h("option", { value: "image/jpeg" }, "JPEG"), h("option", { value: "image/png" }, "PNG"), h("option", { value: "image/webp" }, "WebP"));
  const out = h("div", { class: "stack" });
  let urls = [];
  const go = h("button", { class: "btn" }, "تطبيق");
  go.addEventListener("click", async () => {
    let files = [...file.files];
    if (!files.length) return toast("اختر صورة أولاً.", "err");
    const W = Number(w.value) || 0, H = Number(hh.value) || 0;
    if (!W && !H) return toast("اكتب العرض أو الارتفاع.", "err");
    if (mode.value === "crop" && !(W && H)) return toast("القص يحتاج العرض والارتفاع معاً.", "err");
    const L = lim();
    if (files.length > L.images) { toast(isVip() ? "الحد الأقصى " + L.images + " صورة." : `النسخة المجانية: ${L.images} صور بالمرة. VIP بيفتح المزيد.`, "err"); files = files.slice(0, L.images); }
    urls.forEach(URL.revokeObjectURL); urls = []; out.replaceChildren(); go.disabled = true;
    for (const f of files) {
      if (f.size > L.imageBytes) { out.append(h("p", { class: "muted" }, f.name + ": الحجم أكبر من المسموح.")); continue; }
      try {
        const bmp = await createImageBitmap(f);
        let tw, th, sx = 0, sy = 0, sw = bmp.width, sh = bmp.height;
        if (mode.value === "crop") {
          tw = W; th = H; const r = Math.max(W / bmp.width, H / bmp.height);
          sw = W / r; sh = H / r; sx = (bmp.width - sw) / 2; sy = (bmp.height - sh) / 2;
        } else {
          const r = W && H ? Math.min(W / bmp.width, H / bmp.height) : W ? W / bmp.width : H / bmp.height;
          tw = Math.max(1, Math.round(bmp.width * r)); th = Math.max(1, Math.round(bmp.height * r));
        }
        if (tw * th > 60e6) throw new Error("too_large");
        const cv = document.createElement("canvas"); cv.width = tw; cv.height = th;
        const ctx = cv.getContext("2d");
        if (fmt.value === "image/jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, tw, th); }
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, tw, th);
        if (bmp.close) bmp.close();
        const blob = await new Promise((res) => cv.toBlob(res, fmt.value, 0.92));
        if (!blob) throw new Error("encode_failed");
        const url = URL.createObjectURL(blob); urls.push(url);
        const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[fmt.value];
        out.append(dlRow(url, f.name, `${tw}×${th} — ${fmtSize(blob.size)}`, url, f.name.replace(/\.[^.]+$/, "").slice(0, 60) + `-${tw}x${th}.` + ext));
      } catch (_) { out.append(h("p", { style: "color:var(--danger)" }, f.name + ": تعذّرت معالجة هالملف.")); }
    }
    go.disabled = false;
  });
  return h("div", { class: "stack" },
    h("div", { class: "drop" }, h("div", {}, "اختر صورة أو أكثر"), file),
    h("div", { class: "grid cols-2" }, h("div", {}, h("label", {}, "العرض"), w), h("div", {}, h("label", {}, "الارتفاع"), hh),
      h("div", {}, h("label", {}, "الوضع"), mode), h("div", {}, h("label", {}, "الصيغة"), fmt)),
    go, out);
}

/* ===== صور إلى PDF (بدون أي مكتبة) ===== */
async function imagesToPdf(files, a4) {
  const imgs = [];
  for (const f of files) {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), hgt = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = hgt;
    const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, hgt); ctx.drawImage(bmp, 0, 0, w, hgt);
    if (bmp.close) bmp.close();
    const blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.9));
    if (!blob) throw new Error("encode_failed");
    imgs.push({ w, h: hgt, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  const enc = new TextEncoder(), chunks = [], offsets = [];
  let offset = 0;
  const push = (u8) => { chunks.push(u8); offset += u8.length; };
  const str = (s) => push(enc.encode(s));
  const begin = (n) => { offsets[n] = offset; str(n + " 0 obj\n"); };
  const n = imgs.length;
  str("%PDF-1.4\n");
  begin(1); str("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  begin(2); str(`<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => 3 + 3 * i + " 0 R").join(" ")}] >>\nendobj\n`);
  imgs.forEach((im, i) => {
    const pg = 3 + 3 * i, ct = 4 + 3 * i, ix = 5 + 3 * i;
    let pw, ph, dx = 0, dy = 0, dw, dh;
    if (a4) {
      pw = 595; ph = 842; const s = Math.min((pw - 40) / im.w, (ph - 40) / im.h);
      dw = +(im.w * s).toFixed(2); dh = +(im.h * s).toFixed(2); dx = +((pw - dw) / 2).toFixed(2); dy = +((ph - dh) / 2).toFixed(2);
    } else { pw = im.w; ph = im.h; dw = im.w; dh = im.h; }
    begin(pg); str(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${ix} 0 R >> >> /Contents ${ct} 0 R >>\nendobj\n`);
    const content = `q ${dw} 0 0 ${dh} ${dx} ${dy} cm /Im0 Do Q`;
    begin(ct); str(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    begin(ix); str(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);
    push(im.bytes); str("\nendstream\nendobj\n");
  });
  const xref = offset, total = 3 + 3 * n;
  str(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) str(String(offsets[k]).padStart(10, "0") + " 00000 n \n");
  str(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}
function pdfTool() {
  const file = h("input", { type: "file", accept: IMG_ACCEPT, multiple: true });
  const size = h("select", {}, h("option", { value: "a4" }, "صفحة A4"), h("option", { value: "fit" }, "نفس مقاس الصورة"));
  const out = h("div", { class: "stack" });
  let url = null;
  const go = h("button", { class: "btn" }, "إنشاء PDF");
  go.addEventListener("click", async () => {
    let files = [...file.files];
    if (!files.length) return toast("اختر صورة أولاً.", "err");
    const L = lim();
    if (files.length > L.images) { toast(isVip() ? "الحد الأقصى " + L.images + " صورة." : `النسخة المجانية: ${L.images} صور بالملف. VIP بيفتح المزيد.`, "err"); files = files.slice(0, L.images); }
    if (files.some((f) => f.size > L.imageBytes)) return toast("إحدى الصور أكبر من المسموح.", "err");
    go.disabled = true; out.replaceChildren(h("p", { class: "muted" }, "جاري إنشاء الملف…")); await tick();
    try {
      const blob = await imagesToPdf(files, size.value === "a4");
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      out.replaceChildren(dlRow(null, `${files.length} صورة`, fmtSize(blob.size), url, "images.pdf"));
    } catch (_) { out.replaceChildren(h("p", { style: "color:var(--danger)" }, "تعذّر إنشاء الملف.")); }
    go.disabled = false;
  });
  return h("div", { class: "stack" },
    h("div", { class: "drop" }, h("div", {}, "اختر الصور بالترتيب اللي بدك ياه في الملف"), file),
    h("div", {}, h("label", {}, "مقاس الصفحة"), size), go, out);
}

/* ===== الصوت: قص + دمج + تصدير WAV/MP3 ===== */
function wavFromChannels(chs, sr) {
  const ch = chs.length, n = chs[0].length;
  const ab = new ArrayBuffer(44 + n * ch * 2), v = new DataView(ab);
  const str = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * ch * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * ch * 2, true);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const x = Math.max(-1, Math.min(1, chs[c][i]));
    v.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}
function mp3FromChannels(chs, sr) {
  if (!window.lamejs) throw new Error("no_lame");
  const nch = chs.length, enc = new window.lamejs.Mp3Encoder(nch, sr, 128);
  const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const x = Math.max(-1, Math.min(1, f[i])); o[i] = x < 0 ? x * 0x8000 : x * 0x7fff; } return o; };
  const L = toI16(chs[0]), R = nch > 1 ? toI16(chs[1]) : null, out = [], bs = 1152;
  for (let i = 0; i < L.length; i += bs) {
    const b = nch > 1 ? enc.encodeBuffer(L.subarray(i, i + bs), R.subarray(i, i + bs)) : enc.encodeBuffer(L.subarray(i, i + bs));
    if (b.length) out.push(new Uint8Array(b));
  }
  const e = enc.flush(); if (e.length) out.push(new Uint8Array(e));
  return new Blob(out, { type: "audio/mpeg" });
}
function encodeAudio(chs, sr, fmt) {
  if (fmt === "mp3") {
    try { return { blob: mp3FromChannels(chs, sr), ext: "mp3" }; } catch (_) { toast("تعذّر تصدير MP3، تم التصدير بصيغة WAV.", "err"); }
  }
  return { blob: wavFromChannels(chs, sr), ext: "wav" };
}
const audioCtx = (sr) => { const AC = window.AudioContext || window.webkitAudioContext; try { return sr ? new AC({ sampleRate: sr }) : new AC(); } catch (_) { return new AC(); } };
const fmtSelect = () => h("select", {}, h("option", { value: "mp3" }, "MP3"), h("option", { value: "wav" }, "WAV (بدون فقد)"));

function audioTool() {
  let buffer = null, outUrl = null;
  const file = h("input", { type: "file", accept: "audio/*" });
  const info = h("p", { class: "muted" }, "");
  const start = h("input", { type: "number", min: "0", step: "0.1", value: "0", dir: "ltr" });
  const end = h("input", { type: "number", min: "0", step: "0.1", value: "0", dir: "ltr" });
  const fmt = fmtSelect();
  const out = h("div", { class: "stack" });
  const go = h("button", { class: "btn", disabled: true }, "قص المقطع");

  file.addEventListener("change", async () => {
    buffer = null; go.disabled = true; out.replaceChildren();
    const f = file.files[0]; if (!f) return;
    if (f.size > lim().audioBytes) return toast("الملف أكبر من المسموح (" + fmtSize(lim().audioBytes) + ").", "err");
    info.textContent = "جاري قراءة الملف…";
    try {
      const ctx = audioCtx();
      buffer = await ctx.decodeAudioData(await f.arrayBuffer());
      if (ctx.close) ctx.close();
      const d = buffer.duration;
      info.textContent = "المدة الكلية: " + d.toFixed(1) + " ثانية";
      start.value = "0"; end.value = d.toFixed(1); start.max = end.max = d.toFixed(1);
      go.disabled = false;
    } catch (_) { info.textContent = ""; toast("ما قدرت أقرأ هالملف الصوتي.", "err"); }
  });

  go.addEventListener("click", async () => {
    if (!buffer) return;
    const s = Math.max(0, Number(start.value)), e = Math.min(buffer.duration, Number(end.value));
    if (!(e > s)) return toast("نهاية المقطع لازم تكون بعد بدايته.", "err");
    if (e - s > lim().audioSeconds) return toast("النسخة المجانية: حتى 5 دقائق للمقطع. VIP بدون حد.", "err");
    go.disabled = true; out.replaceChildren(h("p", { class: "muted" }, "جاري المعالجة…")); await tick();
    const sr = buffer.sampleRate, a = Math.floor(s * sr), n = Math.floor(e * sr) - a;
    const chs = [];
    for (let c = 0; c < Math.min(buffer.numberOfChannels, 2); c++) chs.push(buffer.getChannelData(c).subarray(a, a + n));
    const { blob, ext } = encodeAudio(chs, sr, fmt.value);
    if (outUrl) URL.revokeObjectURL(outUrl);
    outUrl = URL.createObjectURL(blob);
    out.replaceChildren(h("audio", { controls: true, src: outUrl }), h("a", { class: "btn small", href: outUrl, download: "clip." + ext }, "تنزيل (" + fmtSize(blob.size) + ")"));
    go.disabled = false;
  });

  return h("div", { class: "stack" },
    h("div", { class: "drop" }, h("div", {}, "اختر ملف صوتي (MP3, WAV, M4A, OGG…)"), file), info,
    h("div", { class: "grid cols-2" }, h("div", {}, h("label", {}, "البداية (ثانية)"), start), h("div", {}, h("label", {}, "النهاية (ثانية)"), end), h("div", {}, h("label", {}, "صيغة الناتج"), fmt)),
    go, out);
}

function mergeTool() {
  let outUrl = null;
  const file = h("input", { type: "file", accept: "audio/*", multiple: true });
  const fmt = fmtSelect();
  const out = h("div", { class: "stack" });
  const go = h("button", { class: "btn" }, "دمج المقاطع");
  go.addEventListener("click", async () => {
    const files = [...file.files];
    if (files.length < 2) return toast("اختر ملفين صوتيين على الأقل.", "err");
    if (files.length > 10) return toast("الحد الأقصى 10 ملفات.", "err");
    if (files.some((f) => f.size > lim().audioBytes)) return toast("أحد الملفات أكبر من المسموح.", "err");
    go.disabled = true; out.replaceChildren(h("p", { class: "muted" }, "جاري الدمج…")); await tick();
    try {
      const ctx = audioCtx(44100), bufs = [];
      for (const f of files) bufs.push(await ctx.decodeAudioData(await f.arrayBuffer()));
      const sr = ctx.sampleRate; if (ctx.close) ctx.close();
      const total = bufs.reduce((t, b) => t + b.length, 0);
      if (total / sr > lim().audioSeconds) { out.replaceChildren(); go.disabled = false; return toast("النسخة المجانية: حتى 5 دقائق بالمجموع. VIP بدون حد.", "err"); }
      const L = new Float32Array(total), R = new Float32Array(total);
      let pos = 0;
      for (const b of bufs) {
        const l = b.getChannelData(0), r = b.numberOfChannels > 1 ? b.getChannelData(1) : l;
        L.set(l, pos); R.set(r, pos); pos += b.length;
      }
      const { blob, ext } = encodeAudio([L, R], sr, fmt.value);
      if (outUrl) URL.revokeObjectURL(outUrl);
      outUrl = URL.createObjectURL(blob);
      out.replaceChildren(h("audio", { controls: true, src: outUrl }), h("a", { class: "btn small", href: outUrl, download: "merged." + ext }, "تنزيل (" + fmtSize(blob.size) + ")"));
    } catch (_) { out.replaceChildren(h("p", { style: "color:var(--danger)" }, "تعذّر دمج الملفات.")); }
    go.disabled = false;
  });
  return h("div", { class: "stack" },
    h("div", { class: "drop" }, h("div", {}, "اختر الملفات بالترتيب اللي بدك ياه"), file),
    h("div", {}, h("label", {}, "صيغة الناتج"), fmt), go, out);
}

/* ===== أدوات النصوص ===== */
async function copyText(v) {
  try { await navigator.clipboard.writeText(v); toast("تم النسخ", "good"); }
  catch (_) { toast("تعذّر النسخ تلقائياً. حدّد النص وانسخه.", "err"); }
}
function wordTool() {
  const t = h("textarea", { placeholder: "الصق نصك هنا…", maxlength: "200000", style: "min-height:160px" });
  const stats = h("div", { class: "grid cols-2" });
  const cell = (label, val) => h("div", { class: "result", style: "flex-direction:column;align-items:flex-start;gap:.1rem" }, h("div", { class: "muted small-text" }, label), h("div", { style: "font-size:1.5rem;font-weight:700" }, String(val)));
  const upd = () => {
    const s = t.value, words = (s.trim().match(/\S+/g) || []).length;
    const sent = (s.match(/[^.!?؟…\n]+[.!?؟…]*/g) || []).filter((x) => x.trim()).length;
    stats.replaceChildren(cell("كلمات", words), cell("أحرف", s.length), cell("أحرف بدون مسافات", s.replace(/\s/g, "").length),
      cell("أسطر", s ? s.split("\n").length : 0), cell("جمل", sent), cell("وقت القراءة (دقيقة)", words ? Math.max(1, Math.round(words / 200)) : 0));
  };
  t.addEventListener("input", upd); upd();
  return h("div", { class: "stack" }, t, stats);
}
function randInt(max) {
  const lim2 = Math.floor(4294967296 / max) * max, a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= lim2);
  return a[0] % max;
}
function passTool() {
  const len = h("input", { type: "range", min: "8", max: "64", value: "20" });
  const lv = h("span", { class: "muted" }, "20");
  len.addEventListener("input", () => { lv.textContent = len.value; gen(); });
  const sets = { up: ["أحرف كبيرة A-Z", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"], lo: ["أحرف صغيرة a-z", "abcdefghijklmnopqrstuvwxyz"], di: ["أرقام 0-9", "0123456789"], sy: ["رموز !@#$", "!@#$%^&*()-_=+[]{};:,.?"] };
  const cbs = {}, row = h("div", { class: "stack" });
  for (const [k, v] of Object.entries(sets)) { cbs[k] = h("input", { type: "checkbox", checked: true }); cbs[k].addEventListener("change", gen); row.append(h("label", { class: "row" }, cbs[k], " " + v[0])); }
  const out = h("input", { readonly: true, dir: "ltr", style: "font-family:monospace" });
  function gen() {
    const act = Object.keys(sets).filter((k) => cbs[k].checked).map((k) => sets[k][1]);
    if (!act.length) { out.value = ""; return; }
    const all = act.join(""), n = Number(len.value), chars = act.map((s) => s[randInt(s.length)]);
    while (chars.length < n) chars.push(all[randInt(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    out.value = chars.slice(0, n).join("");
  }
  gen();
  return h("div", { class: "stack" }, h("div", {}, h("label", {}, "الطول ", lv), len), row, out,
    h("div", { class: "row" }, h("button", { class: "btn", onclick: gen }, "توليد جديد"), h("button", { class: "btn ghost", onclick: () => out.value && copyText(out.value) }, "نسخ")),
    h("p", { class: "muted small-text" }, "تُولَّد داخل متصفحك فقط ولا تُرسل لأي مكان."));
}
function jsonTool() {
  const inp = h("textarea", { placeholder: '{"name":"أدواتي"}', style: "min-height:140px", dir: "ltr" });
  const out = h("textarea", { readonly: true, style: "min-height:140px", dir: "ltr" });
  const msg = h("p", { class: "small-text" });
  const run = (mode) => {
    try {
      const v = JSON.parse(inp.value);
      if (mode === "check") { msg.style.color = "var(--ok)"; msg.textContent = "JSON صالح ✓"; return; }
      out.value = mode === "min" ? JSON.stringify(v) : JSON.stringify(v, null, 2);
      msg.style.color = "var(--ok)"; msg.textContent = "تم ✓";
    } catch (e) { msg.style.color = "var(--danger)"; msg.textContent = "خطأ: " + String(e.message).slice(0, 160); }
  };
  return h("div", { class: "stack" }, inp,
    h("div", { class: "row" }, h("button", { class: "btn small", onclick: () => run("fmt") }, "تنسيق"), h("button", { class: "btn small ghost", onclick: () => run("min") }, "ضغط"),
      h("button", { class: "btn small ghost", onclick: () => run("check") }, "تحقق فقط")),
    msg, out, h("button", { class: "btn small ghost", onclick: () => out.value && copyText(out.value) }, "نسخ الناتج"));
}

const imageSuite = () => suite([["ضغط وتحويل", imageTool], ["تغيير الحجم والقص", resizeTool], ["صور إلى PDF", pdfTool]]);
const audioSuite = () => suite([["قص", audioTool], ["دمج", mergeTool]]);
const textSuite = () => suite([["عدّاد الكلمات", wordTool], ["كلمات السر", passTool], ["منسّق JSON", jsonTool]]);

function qrTool() {
  const text = h("textarea", { maxlength: "900", placeholder: "رابط أو نص…" });
  const size = h("select", {}, h("option", { value: "320" }, "صغير"), h("option", { value: "640", selected: true }, "متوسط"), h("option", { value: "1024" }, "كبير"));
  const ec = h("select", {}, h("option", { value: "L" }, "L — أقل تصحيح"), h("option", { value: "M", selected: true }, "M"), h("option", { value: "Q" }, "Q"), h("option", { value: "H" }, "H — أعلى تصحيح"));
  const fg = h("input", { type: "color", value: "#000000" });
  const bg = h("input", { type: "color", value: "#ffffff" });
  const cv = h("canvas", { class: "qr", width: "10", height: "10", hidden: true });
  const dl = h("a", { class: "btn small", hidden: true, download: "qr.png" }, "تنزيل PNG");
  const draw = () => {
    const t = text.value.trim();
    if (!t) { cv.hidden = true; dl.hidden = true; return; }
    try {
      if (window.qrcode.stringToBytesFuncs && window.qrcode.stringToBytesFuncs["UTF-8"]) window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
      const qr = window.qrcode(0, ec.value); qr.addData(t); qr.make();
      const n = qr.getModuleCount(), m = 4, cell = Math.max(1, Math.floor(Number(size.value) / (n + m * 2))), px = cell * (n + m * 2);
      cv.width = px; cv.height = px;
      const x = cv.getContext("2d"); x.fillStyle = bg.value; x.fillRect(0, 0, px, px); x.fillStyle = fg.value;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect((c + m) * cell, (r + m) * cell, cell, cell);
      cv.hidden = false; dl.hidden = false;
      cv.toBlob((b) => { if (b) { if (dl.href.startsWith("blob:")) URL.revokeObjectURL(dl.href); dl.href = URL.createObjectURL(b); } });
    } catch (_) { cv.hidden = true; dl.hidden = true; toast("النص طويل زيادة لرمز QR.", "err"); }
  };
  [text, size, ec, fg, bg].forEach((el) => el.addEventListener("input", draw));
  return h("div", { class: "stack" },
    h("div", {}, h("label", {}, "النص أو الرابط"), text),
    h("div", { class: "grid cols-2" }, h("div", {}, h("label", {}, "الحجم"), size), h("div", {}, h("label", {}, "تصحيح الأخطاء"), ec), h("div", {}, h("label", {}, "لون الرمز"), fg), h("div", {}, h("label", {}, "لون الخلفية"), bg)),
    h("div", { class: "row" }, cv), dl);
}

/* ---------------- الصفحات ---------------- */
let activeTool = 0;
function homeView() {
  const tools = [["image", T("tool_image_title"), imageSuite], ["audio", T("tool_audio_title"), audioSuite], ["qr", T("tool_qr_title"), qrTool], ["text", T("tool_text_title"), textSuite]];
  const panel = h("div", { class: "glass" });
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const show = (i) => {
    activeTool = i;
    [...tabs.children].forEach((b, j) => { b.classList.toggle("on", i === j); b.setAttribute("aria-selected", i === j); });
    panel.replaceChildren(tools[i][2]());
  };
  tools.forEach((t, i) => tabs.append(h("button", { class: "tab", role: "tab", onclick: () => show(i) }, t[1])));
  show(activeTool);
  return h("div", {},
    h("section", { class: "hero" }, h("h1", {}, T("hero_title")), h("p", {}, T("hero_sub"))),
    T("announcement") ? h("p", { class: "hint-box" }, T("announcement")) : null,
    tabs, panel,
    !isVip() ? h("div", { class: "glass row between" }, h("div", {}, h("h3", {}, "ترقية إلى VIP"), h("p", { class: "muted", style: "margin:0" }, T("vip_pitch"))),
      h("a", { class: "btn gold", href: "#/account" }, "شاهد الباقات")) : null);
}

const vipStatus = () => {
  const p = state.profile;
  if (p.vip_lifetime) return h("span", { class: "vip-badge" }, "★ VIP مدى الحياة");
  if (isVip()) return h("div", { class: "row" }, h("span", { class: "vip-badge" }, "★ VIP"), h("span", { class: "countdown", "data-cd": p.vip_until }, ""));
  return h("span", { class: "badge" }, "حساب مجاني");
};
function tickCountdowns() {
  document.querySelectorAll("[data-cd]").forEach((el) => {
    const ms = new Date(el.dataset.cd) - Date.now();
    if (ms <= 0) { el.textContent = "انتهت العضوية"; return; }
    const d = Math.floor(ms / 864e5), hh = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3);
    el.textContent = `${d} يوم ${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  });
}
setInterval(tickCountdowns, 1000);

function telegramUrl(req) {
  const p = state.profile;
  const days = req.lifetime ? "VIP مدى الحياة" : req.vip_days + " يوم VIP";
  const msg = ["📩 طلب شحن رصيد", "━━━━━━━━━━━━", `👤 الاسم: ${p.display_name || "-"}`, `✉️ البريد: ${p.email}`,
    `💵 المبلغ المطلوب: ${req.amount}$`, `⭐ مدة VIP المستحقة: ${days}`, `💳 طريقة الدفع: ${METHODS[req.method]}`,
    `🗓 تاريخ الطلب: ${fmtDate(req.created_at)}`, `🔖 رقم الطلب: #${req.id}`, "━━━━━━━━━━━━", "أرجو تزويدي بتفاصيل التحويل."].join("\n");
  return `https://t.me/${encodeURIComponent(C.OWNER_TELEGRAM)}?text=${encodeURIComponent(msg)}`;
}

async function accountView() {
  if (!state.user) return guestCard("سجّل دخولك لتشوف حسابك ومحفظتك.");
  await loadProfile();
  const p = state.profile;
  if (!p) return h("div", { class: "glass" }, "تعذّر تحميل الحساب.");
  const [txs, reqs] = await Promise.all([
    sb.from("transactions").select("*").eq("user_id", p.id).order("created_at", { ascending: false }).limit(15),
    sb.from("deposit_requests").select("*").eq("user_id", p.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const name = h("input", { value: p.display_name || "", maxlength: "40" });
  let amount = null, method = "sham_cash";
  const pkgBox = h("div", { class: "pkgs", role: "radiogroup", "aria-label": "باقات الشحن" });
  state.packages.forEach((k) => {
    const b = h("button", { type: "button", class: "pkg" + (k.lifetime ? " life" : ""), role: "radio", onclick: () => { amount = k.amount; [...pkgBox.children].forEach((x) => x.classList.remove("on")); b.classList.add("on"); } },
      h("b", {}, k.amount + "$"), h("span", {}, k.lifetime ? "VIP مدى الحياة" : k.vip_days + " يوم VIP"));
    pkgBox.append(b);
  });
  const methodSel = h("select", {}, ...Object.entries(METHODS).map(([k, v]) => h("option", { value: k }, v)));
  methodSel.addEventListener("change", () => (method = methodSel.value));
  const orderOut = h("div", { class: "stack" });
  const orderBtn = h("button", { class: "btn gold" }, "تأكيد الشحن");
  orderBtn.addEventListener("click", async () => {
    if (!amount) return toast("اختر باقة الشحن.", "err");
    orderBtn.disabled = true;
    const { data, error } = await sb.rpc("request_deposit", { p_amount: amount, p_method: method });
    orderBtn.disabled = false;
    if (error) return toast(errMsg(error), "err");
    const url = telegramUrl(data);
    orderOut.replaceChildren(h("div", { class: "hint-box" }, `تم تسجيل طلبك #${data.id}. افتح تلغرام وأرسل الرسالة الجاهزة للمالك، وبعد استلام الدفع بيتفعّل رصيدك وVIP.`),
      h("a", { class: "btn", href: url, target: "_blank", rel: "noopener noreferrer" }, "فتح تلغرام وإرسال الطلب"));
    window.open(url, "_blank", "noopener,noreferrer");
  });

  const st = { pending: ["بانتظار الدفع", "warn"], approved: ["تم", "ok"], rejected: ["مرفوض", "bad"] };
  return h("div", {},
    h("div", { class: "grid cols-2" },
      h("div", { class: "glass stack" }, h("h2", {}, "ملفي الشخصي"), vipStatus(),
        h("p", { class: "muted small-text", dir: "ltr", style: "text-align:start" }, p.email),
        h("div", {}, h("label", {}, "الاسم"), name),
        h("button", { class: "btn small ghost", onclick: async () => { const { error } = await sb.rpc("update_my_name", { p_name: name.value }); error ? toast(errMsg(error), "err") : (toast("تم الحفظ", "good"), loadProfile()); } }, "حفظ الاسم"),
        h("button", { class: "btn small ghost", onclick: () => openSetPassword(false) }, "تغيير كلمة السر")),
      h("div", { class: "glass" }, h("h2", {}, "محفظتي"), h("div", { class: "balance" }, money(p.balance) + "$"), h("p", { class: "muted small-text" }, "الرصيد بيتحدّث بعد ما المالك يؤكد استلام الدفع."))),
    h("div", { class: "glass stack" }, h("h2", {}, "شحن الرصيد"), h("p", { class: "muted" }, "كل شحنة بتعطيك أيام VIP تلقائياً حسب الباقة."), pkgBox,
      payInfo(), h("div", {}, h("label", {}, "طريقة الدفع"), methodSel), orderBtn, orderOut),
    h("div", { class: "glass" }, h("h2", {}, "طلبات الشحن"), h("div", { class: "scroll-x" }, h("table", {},
      h("thead", {}, h("tr", {}, ...["#", "المبلغ", "VIP", "الطريقة", "الحالة", "التاريخ"].map((x) => h("th", {}, x)))),
      h("tbody", {}, (reqs.data || []).map((r) => h("tr", {}, h("td", {}, r.id), h("td", {}, r.amount + "$"), h("td", {}, r.lifetime ? "مدى الحياة" : r.vip_days + " يوم"), h("td", {}, METHODS[r.method]),
        h("td", {}, h("span", { class: "badge " + st[r.status][1] }, st[r.status][0])), h("td", {}, fmtDate(r.created_at)))))))),
    h("div", { class: "glass" }, h("h2", {}, "سجل الحركات"), (txs.data || []).length ? h("div", { class: "scroll-x" }, h("table", {},
      h("tbody", {}, txs.data.map((t) => h("tr", {}, h("td", {}, t.note || t.kind), h("td", { dir: "ltr", style: "color:" + (t.amount < 0 ? "var(--danger)" : "var(--ok)") }, (t.amount > 0 ? "+" : "") + money(t.amount) + "$"), h("td", {}, fmtDate(t.created_at))))))) : h("p", { class: "muted" }, "لا توجد حركات بعد.")));
}

function guestCard(text) {
  return h("div", { class: "glass stack" }, h("h2", {}, "أهلاً"), h("p", { class: "muted" }, text),
    h("div", { class: "row" }, h("button", { class: "btn", onclick: () => openAuth("login") }, "دخول"), h("button", { class: "btn ghost", onclick: () => openAuth("signup") }, "حساب جديد")));
}

async function drawView() {
  const { data: d } = await sb.rpc("get_draw_public");
  if (!d || !d.visible) return h("div", { class: "glass" }, "لا يوجد سحب متاح حالياً.");
  const joinBtn = h("button", { class: "btn gold", disabled: d.joined || d.status !== "open" }, d.joined ? "أنت مشترك" : "الاشتراك بالسحب");
  joinBtn.addEventListener("click", async () => {
    if (!state.user) return openAuth("login");
    if (!(await confirmDlg("تأكيد الاشتراك", `رح يتم خصم ${money(d.fee)}$ من محفظتك مقابل دخول السحب. الخصم نهائي وغير قابل للاسترجاع.`, "اشترك وخصم الرسوم"))) return;
    joinBtn.disabled = true;
    const { error } = await sb.rpc("join_draw");
    if (error) { toast(errMsg(error), "err"); joinBtn.disabled = false; return; }
    toast("تم اشتراكك. بالتوفيق!", "good"); await loadProfile(); route();
  });
  return h("div", { class: "glass stack" + (d.is_winner ? " win" : "") },
    h("h1", {}, d.title), h("div", { class: "balance", style: "color:var(--gold)" }, money(d.prize) + "$"),
    h("p", { class: "muted" }, `رسوم الاشتراك ${money(d.fee)}$ — عدد المشتركين ${d.entries} — الجولة ${d.round}`),
    d.status === "closed" ? h("p", { class: "hint-box" }, d.is_winner ? "🎉 مبروك! أنت الفائز. تواصل مع المالك لاستلام الجائزة." : "انتهى السحب. الفائز: " + (d.winner || "—")) : null,
    state.user ? joinBtn : h("button", { class: "btn", onclick: () => openAuth("login") }, "سجّل دخولك للاشتراك"),
    h("p", { class: "muted small-text" }, "بالاشتراك أنت تؤكد أن عمرك 18 سنة أو أكثر وأن المشاركة قانونية في بلدك. راجع شروط الاستخدام."));
}

/* ---------------- الإدارة ---------------- */
const PERMS = { users: "إدارة المستخدمين", balance: "تعديل الأرصدة", vip: "إدارة VIP", content: "تعديل المحتوى", draw: "إدارة السحب", deposits: "طلبات الشحن" };
let adminTab = "deposits";

async function adminView() {
  if (!isStaff()) return h("div", { class: "glass" }, "غير مصرّح.");
  const body = h("div", { class: "stack" });
  const sections = [["stats", "الإحصائيات", adminStats], ["deposits", "طلبات الشحن", adminDeposits], ["users", "المستخدمون", adminUsers], ["content", "المحتوى", adminContent], ["draw", "السحب", adminDraw], ["admins", "الأدمنية", adminAdmins], ["audit", "السجل", adminAudit]]
    .filter(([k]) => (k === "admins" ? state.profile.role === "owner" : (k === "audit" || k === "stats") ? true : can(k === "draw" ? "draw" : k)));
  if (!sections.find(([k]) => k === adminTab)) adminTab = sections[0] ? sections[0][0] : "";
  const tabs = h("div", { class: "tabs" });
  const load = async (k, fn) => { adminTab = k; [...tabs.children].forEach((b) => b.classList.toggle("on", b.dataset.k === k)); body.replaceChildren(h("p", { class: "muted" }, "جاري التحميل…")); try { body.replaceChildren(await fn()); } catch (e) { body.replaceChildren(h("p", { style: "color:var(--danger)" }, errMsg(e))); } };
  sections.forEach(([k, label, fn]) => tabs.append(h("button", { class: "tab", "data-k": k, onclick: () => load(k, fn) }, label)));
  const cur = sections.find(([k]) => k === adminTab);
  if (cur) load(cur[0], cur[2]);
  return h("div", {}, h("h1", {}, "لوحة التحكم"), tabs, body);
}
const rerenderAdmin = () => { const k = adminTab; route(); adminTab = k; };

async function adminDeposits() {
  const { data, error } = await sb.from("deposit_requests").select("*").eq("status", "pending").order("created_at");
  if (error) throw error;
  const ids = [...new Set((data || []).map((r) => r.user_id))];
  const { data: ps } = ids.length ? await sb.from("profiles").select("id,email,display_name").in("id", ids) : { data: [] };
  const byId = Object.fromEntries((ps || []).map((p) => [p.id, p]));
  if (!data.length) return h("div", { class: "glass" }, "لا توجد طلبات معلّقة.");
  const act = (fn, id) => async () => { const { error: e } = await sb.rpc(fn, { p_id: id }); e ? toast(errMsg(e), "err") : (toast("تم", "good"), rerenderAdmin()); };
  return h("div", { class: "glass scroll-x" }, h("table", {},
    h("thead", {}, h("tr", {}, ...["#", "المستخدم", "المبلغ", "VIP", "الطريقة", "التاريخ", ""].map((x) => h("th", {}, x)))),
    h("tbody", {}, data.map((r) => h("tr", {}, h("td", {}, r.id), h("td", { dir: "ltr" }, (byId[r.user_id] || {}).email || "—"), h("td", {}, r.amount + "$"),
      h("td", {}, r.lifetime ? "مدى الحياة" : r.vip_days + " يوم"), h("td", {}, METHODS[r.method]), h("td", {}, fmtDate(r.created_at)),
      h("td", { class: "row" }, h("button", { class: "btn small", onclick: async () => { if (await confirmDlg("تأكيد الشحن", `استلمت ${r.amount}$ فعلاً؟ بيتضاف الرصيد وVIP.`, "نعم، فعّل")) act("admin_approve_deposit", r.id)(); } }, "تفعيل"),
        h("button", { class: "btn small danger", onclick: act("admin_reject_deposit", r.id) }, "رفض")))))));
}

async function adminUsers() {
  const { data, error } = await sb.from("profiles").select("*").order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  const q = h("input", { placeholder: "بحث بالإيميل أو الاسم…", dir: "ltr" });
  const tbody = h("tbody");
  const draw = () => {
    const s = q.value.trim().toLowerCase();
    tbody.replaceChildren(...data.filter((u) => !s || u.email.toLowerCase().includes(s) || (u.display_name || "").toLowerCase().includes(s)).map((u) =>
      h("tr", {}, h("td", { dir: "ltr" }, u.email), h("td", {}, u.display_name || "—"), h("td", {}, money(u.balance) + "$"),
        h("td", {}, u.vip_lifetime ? "مدى الحياة" : u.vip_until && new Date(u.vip_until) > new Date() ? "حتى " + fmtDate(u.vip_until) : "—"),
        h("td", {}, u.role + (u.banned ? " 🚫" : "")), h("td", {}, fmtDate(u.created_at)), h("td", {}, h("button", { class: "btn small ghost", onclick: () => manageUser(u) }, "إدارة")))));
  };
  q.addEventListener("input", draw); draw();
  return h("div", { class: "glass stack" }, h("p", { class: "muted" }, "عدد المسجّلين: " + data.length), q,
    h("div", { class: "scroll-x" }, h("table", {}, h("thead", {}, h("tr", {}, ...["الإيميل", "الاسم", "الرصيد", "VIP", "الدور", "الانضمام", ""].map((x) => h("th", {}, x)))), tbody)));
}

function genPassword() {
  const al = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const a = new Uint32Array(14); crypto.getRandomValues(a);
  return [...a].map((x) => al[x % al.length]).join("");
}
function manageUser(u) {
  const run = async (p, ok) => { const { error } = await p; error ? toast(errMsg(error), "err") : (toast(ok || "تم", "good"), closeDlg(), rerenderAdmin()); };
  const delta = h("input", { type: "number", step: "0.01", dir: "ltr", placeholder: "مثال: 5 أو -2" });
  const note = h("input", { maxlength: "120", placeholder: "ملاحظة (اختياري)" });
  const days = h("input", { type: "number", min: "1", max: "3650", value: "7", dir: "ltr" });
  const pw = h("input", { dir: "ltr", maxlength: "72", placeholder: "كلمة سر مؤقتة (10+ أحرف)" });
  const sec = (title, ...n) => h("div", { class: "stack", style: "padding-top:.8rem;border-top:1px solid var(--border)" }, h("h3", {}, title), ...n);
  openDlg(h("h2", {}, u.display_name || u.email), h("p", { class: "muted small-text", dir: "ltr", style: "text-align:start" }, u.email + " — " + money(u.balance) + "$"),
    can("balance") ? sec("تعديل الرصيد", delta, note, h("button", { class: "btn small", onclick: () => run(sb.rpc("admin_adjust_balance", { p_user: u.id, p_delta: Number(delta.value), p_note: note.value })) }, "تطبيق")) : null,
    can("vip") ? sec("عضوية VIP", h("div", { class: "row" }, days, h("button", { class: "btn small gold", onclick: () => run(sb.rpc("admin_set_vip", { p_user: u.id, p_days: Number(days.value), p_lifetime: false, p_revoke: false })) }, "إضافة أيام")),
      h("div", { class: "row" }, h("button", { class: "btn small gold", onclick: () => run(sb.rpc("admin_set_vip", { p_user: u.id, p_days: 0, p_lifetime: true, p_revoke: false })) }, "مدى الحياة"),
        h("button", { class: "btn small danger", onclick: () => run(sb.rpc("admin_set_vip", { p_user: u.id, p_days: 0, p_lifetime: false, p_revoke: true })) }, "سحب الشارة"))) : null,
    can("users") && u.role !== "owner" ? sec("كلمة السر", pw,
      h("div", { class: "row" }, h("button", { class: "btn small ghost", onclick: () => (pw.value = genPassword()) }, "توليد"),
        h("button", { class: "btn small", onclick: async () => {
          try {
            const r = await fetch(C.EDGE_FUNCTION_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + state.session.access_token, apikey: C.SUPABASE_ANON_KEY }, body: JSON.stringify({ user_id: u.id, password: pw.value }) });
            const j = await r.json(); if (!r.ok) throw j;
            toast("تم تعيين كلمة السر المؤقتة. أرسلها للمستخدم بقناة آمنة.", "good");
          } catch (e) { toast(errMsg(e), "err"); }
        } }, "تعيين مؤقتة"),
        h("button", { class: "btn small ghost", onclick: async () => { const { error } = await sb.auth.resetPasswordForEmail(u.email, { redirectTo: location.origin + location.pathname }); error ? toast(errMsg(error), "err") : toast("أُرسل رابط الاستعادة.", "good"); } }, "إرسال رابط استعادة"))) : null,
    can("users") && u.role !== "owner" ? sec("الحظر", h("button", { class: "btn small danger", onclick: () => run(sb.rpc("admin_set_ban", { p_user: u.id, p_ban: !u.banned }), u.banned ? "تم إلغاء الحظر" : "تم الحظر") }, u.banned ? "إلغاء الحظر" : "حظر المستخدم")) : null,
    h("button", { class: "btn ghost", onclick: closeDlg }, "إغلاق"));
}

async function adminContent() {
  const wrap = h("div", { class: "stack" });
  for (const k of Object.keys(CONTENT_LABELS)) {
    const long = ["hero_sub", "announcement", "vip_pitch", "pay_note", "pay_sham", "pay_syriatel", "pay_binance"].includes(k);
    const inp = h(long ? "textarea" : "input", { value: state.content[k] !== undefined ? state.content[k] : DEFAULTS[k], maxlength: "1000" });
    if (long) inp.value = state.content[k] !== undefined ? state.content[k] : DEFAULTS[k];
    wrap.append(h("div", { class: "glass stack" }, h("label", {}, CONTENT_LABELS[k]), inp,
      h("button", { class: "btn small", onclick: async () => { const { error } = await sb.rpc("admin_set_content", { p_key: k, p_value: inp.value }); if (error) return toast(errMsg(error), "err"); state.content[k] = inp.value; applyChrome(); toast("تم الحفظ", "good"); } }, "حفظ")));
  }
  const f = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp" });
  wrap.append(h("div", { class: "glass stack" }, h("h3", {}, "الشعار"), h("p", { class: "muted small-text" }, "PNG/JPG/WebP حتى 2MB."), f,
    h("button", { class: "btn small", onclick: async () => {
      const file = f.files[0]; if (!file) return toast("اختر صورة.", "err");
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2097152) return toast("صيغة أو حجم غير مسموح.", "err");
      const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type];
      const path = "logo-" + Date.now() + "." + ext;
      const up = await sb.storage.from("site-assets").upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) return toast("فشل الرفع.", "err");
      const url = sb.storage.from("site-assets").getPublicUrl(path).data.publicUrl;
      const { error } = await sb.rpc("admin_set_content", { p_key: "logo_url", p_value: url });
      if (error) return toast(errMsg(error), "err");
      state.content.logo_url = url; applyChrome(); toast("تم تحديث الشعار", "good");
    } }, "رفع وتعيين الشعار")));
  return wrap;
}

async function adminDraw() {
  const [{ data: cfg }, ent] = await Promise.all([sb.from("draw_config").select("*").eq("id", 1).single(), sb.rpc("admin_draw_entries")]);
  const vis = h("input", { type: "checkbox", checked: cfg.visible });
  const title = h("input", { value: cfg.title, maxlength: "120" });
  const prize = h("input", { type: "number", step: "0.01", value: cfg.prize, dir: "ltr" });
  const fee = h("input", { type: "number", step: "0.01", min: "0", value: cfg.fee, dir: "ltr" });
  const list = ent.data || [];
  return h("div", { class: "stack" },
    h("div", { class: "glass stack" }, h("h2", {}, "إعدادات السحب"),
      h("label", { class: "row" }, vis, " إظهار السحب للمستخدمين"), h("div", {}, h("label", {}, "العنوان"), title),
      h("div", { class: "grid cols-2" }, h("div", {}, h("label", {}, "قيمة الجائزة $"), prize), h("div", {}, h("label", {}, "رسوم الاشتراك $"), fee)),
      h("button", { class: "btn small", onclick: async () => { const { error } = await sb.rpc("admin_draw_config", { p_visible: vis.checked, p_title: title.value, p_prize: Number(prize.value), p_fee: Number(fee.value) }); error ? toast(errMsg(error), "err") : (toast("تم الحفظ", "good"), loadDrawFlag().then(applyChrome)); } }, "حفظ")),
    h("div", { class: "glass stack" }, h("h2", {}, `المشتركون (${list.length}) — الجولة ${cfg.round}`),
      cfg.status === "closed" ? h("p", { class: "hint-box" }, "السحب مغلق. تم اختيار الفائز.") : null,
      h("div", { class: "row" },
        h("button", { class: "btn gold", disabled: cfg.status !== "open", onclick: async () => { if (!(await confirmDlg("اختيار الفائز", "اختيار عشوائي من المشتركين الحاليين. لا رجعة فيه.", "اختر الفائز"))) return; const { data, error } = await sb.rpc("admin_pick_winner"); if (error) return toast(errMsg(error), "err"); const w = list.find((x) => x.user_id === data); toast("الفائز: " + (w ? w.email : data), "good"); rerenderAdmin(); } }, "اختيار الفائز"),
        h("button", { class: "btn ghost", onclick: async () => { if (!(await confirmDlg("جولة جديدة", "بتبدأ جولة جديدة وتتصفّر قائمة المشتركين الحالية للعرض.", "ابدأ"))) return; const { error } = await sb.rpc("admin_draw_reset"); error ? toast(errMsg(error), "err") : rerenderAdmin(); } }, "جولة جديدة")),
      h("div", { class: "scroll-x" }, h("table", {}, h("tbody", {}, list.map((x) => h("tr", { class: x.user_id === cfg.winner_id ? "win" : "" }, h("td", { dir: "ltr" }, x.email), h("td", {}, x.display_name || "—"), h("td", {}, fmtDate(x.joined_at)), h("td", {}, x.user_id === cfg.winner_id ? "🏆 الفائز" : ""))))))));
}

async function adminAdmins() {
  const { data } = await sb.from("profiles").select("*").in("role", ["admin", "owner"]).order("created_at");
  const email = h("input", { type: "email", dir: "ltr", placeholder: "إيميل مستخدم مسجّل" });
  const checks = Object.fromEntries(Object.keys(PERMS).map((k) => [k, h("input", { type: "checkbox" })]));
  const permsRow = h("div", { class: "stack" }, ...Object.entries(PERMS).map(([k, label]) => h("label", { class: "row" }, checks[k], " " + label)));
  const save = async (id, role, perms) => { const { error } = await sb.rpc("admin_set_role", { p_user: id, p_role: role, p_perms: perms }); error ? toast(errMsg(error), "err") : (toast("تم", "good"), rerenderAdmin()); };
  return h("div", { class: "stack" },
    h("div", { class: "glass stack" }, h("h2", {}, "إضافة أدمن"), h("div", {}, h("label", {}, "البريد الإلكتروني"), email), permsRow,
      h("button", { class: "btn small", onclick: async () => {
        const { data: u } = await sb.from("profiles").select("id,role").eq("email", email.value.trim().toLowerCase()).maybeSingle();
        if (!u) return toast("ما لقيت مستخدم بهالإيميل (لازم يكون مسجّل).", "err");
        save(u.id, "admin", Object.fromEntries(Object.keys(PERMS).map((k) => [k, checks[k].checked])));
      } }, "تعيين كأدمن")),
    h("div", { class: "glass" }, h("h2", {}, "الإدارة الحالية"), h("div", { class: "scroll-x" }, h("table", {}, h("tbody", {}, (data || []).map((u) => h("tr", {},
      h("td", { dir: "ltr" }, u.email), h("td", {}, u.role === "owner" ? "المالك" : "أدمن"),
      h("td", {}, u.role === "admin" ? Object.keys(PERMS).filter((k) => u.permissions && u.permissions[k]).map((k) => PERMS[k]).join("، ") || "بدون صلاحيات" : "كل الصلاحيات"),
      h("td", {}, u.role === "admin" ? h("button", { class: "btn small danger", onclick: () => save(u.id, "user", {}) }, "إزالة") : ""))))))));
}

async function adminAudit() {
  const { data } = await sb.from("audit_log").select("*").order("created_at", { ascending: false }).limit(60);
  return h("div", { class: "glass scroll-x" }, h("table", {}, h("tbody", {}, (data || []).map((r) => h("tr", {}, h("td", {}, fmtDate(r.created_at)), h("td", {}, r.action), h("td", { dir: "ltr" }, (r.target || "").slice(0, 36)), h("td", { dir: "ltr" }, r.details ? JSON.stringify(r.details) : ""))))));
}


/* ---------------- الموافقة على الكوكيز ---------------- */
function getConsent() { try { return localStorage.getItem("consent"); } catch (_) { return null; } }
function showConsent() {
  if (getConsent()) return;
  const box = $("#consent"); box.hidden = false;
  const set = (v) => { try { localStorage.setItem("consent", v); } catch (_) { /* ignore */ } box.hidden = true; box.replaceChildren(); setupAds(); };
  box.replaceChildren(
    h("p", {}, "نستخدم ملفات تعريف الارتباط لتشغيل الموقع وعرض الإعلانات. يمكنك قبولها أو رفض الإعلانية منها. ", h("a", { href: "privacy.html" }, "سياسة الخصوصية")),
    h("div", { class: "row" }, h("button", { class: "btn small", onclick: () => set("yes") }, "موافق"), h("button", { class: "btn small ghost", onclick: () => set("no") }, "رفض")));
}

/* ---------------- معلومات الدفع ---------------- */
function payInfo() {
  const rows = [["pay_sham", METHODS.sham_cash], ["pay_syriatel", METHODS.syriatel_cash], ["pay_binance", METHODS.binance_usdt]]
    .filter(([k]) => T(k)).map(([k, label]) => h("div", {}, h("b", {}, label + ": "), h("span", { dir: "ltr", style: "overflow-wrap:anywhere;white-space:pre-wrap" }, T(k))));
  if (!rows.length) return null;
  return h("div", { class: "hint-box stack" }, T("pay_note") ? h("div", {}, T("pay_note")) : null, ...rows);
}

/* ---------------- إحصائيات الإدارة ---------------- */
async function adminStats() {
  const { data: s, error } = await sb.rpc("admin_stats");
  if (error) throw error;
  const { data: recent } = await sb.from("profiles").select("email,display_name,created_at,vip_lifetime,vip_until").order("created_at", { ascending: false }).limit(10);
  const card = (label, val) => h("div", { class: "result", style: "flex-direction:column;align-items:flex-start;gap:.1rem" }, h("div", { class: "muted small-text" }, label), h("div", { style: "font-size:1.6rem;font-weight:700" }, String(val)));
  return h("div", { class: "stack" },
    h("div", { class: "grid cols-2" }, card("المسجّلون", s.users), card("جدد آخر 7 أيام", s.new_7d), card("VIP نشط", s.vip_active), card("VIP مدى الحياة", s.vip_lifetime),
      card("طلبات شحن معلّقة", s.pending), card("الإيرادات المؤكدة ($)", money(s.revenue)), card("إيرادات آخر 30 يوم ($)", money(s.revenue_30d)), card("مشتركو السحب (الجولة الحالية)", s.draw_entries), card("حسابات محظورة", s.banned)),
    h("div", { class: "glass" }, h("h2", {}, "آخر التسجيلات"), h("div", { class: "scroll-x" }, h("table", {}, h("tbody", {}, (recent || []).map((u) =>
      h("tr", {}, h("td", { dir: "ltr" }, u.email), h("td", {}, u.display_name || "—"), h("td", {}, u.vip_lifetime || (u.vip_until && new Date(u.vip_until) > new Date()) ? "VIP" : "—"), h("td", {}, fmtDate(u.created_at)))))))));
}

/* ---------------- نافذة الدعاء ---------------- */
function showPray() {
  try { if (sessionStorage.getItem("pray")) return; sessionStorage.setItem("pray", "1"); } catch (_) { /* ignore */ }
  if (dlg.open) return;
  const reply = (msg) => { closeDlg(); toast(msg, "good"); };
  openDlg(h("div", { class: "stack", style: "text-align:center" },
    h("div", { style: "font-size:2.4rem", "aria-hidden": "true" }, "🤲"),
    h("h2", { style: "margin:0" }, "ادعيلي اتزوجها"),
    h("p", { class: "muted", dir: "ltr", style: "margin:0 0 .4rem" }, "Pray that I marry her"),
    h("button", { class: "btn", onclick: () => reply("الله يجزيك الخير ويرزقك اللي بتتمناه 🤍") }, "دعيتلك 🫶🥹"),
    h("button", { class: "btn ghost", onclick: () => reply("ولا يهمك، الله يوفقك 🙂") }, "ما بدي ادعيلك 🙂")));
}

/* ---------------- الإنجليزية (ترجمة الواجهة العامة) ---------------- */
const EN = {
  "الأدوات": "Tools", "السحب": "Draw", "حسابي": "My account", "الإدارة": "Admin", "دخول": "Log in", "خروج": "Log out", "حساب جديد": "Sign up",
  "الصور": "Images", "الصوت": "Audio", "رمز QR": "QR code", "النصوص": "Text", "تثبيت": "Install",
  "أدوات سريعة تشتغل داخل متصفحك": "Fast tools that run inside your browser",
  "اضغط الصور، قصّ الصوتيات، وولّد رموز QR. ملفاتك ما بتطلع من جهازك أبداً.": "Compress images, trim audio and make QR codes. Your files never leave your device.",
  "ضغط وتحويل": "Compress & convert", "تغيير الحجم والقص": "Resize & crop", "صور إلى PDF": "Images to PDF", "قص": "Trim", "دمج": "Merge",
  "عدّاد الكلمات": "Word counter", "كلمات السر": "Passwords", "منسّق JSON": "JSON formatter",
  "اختر صورة أو أكثر (PNG, JPG, WebP, GIF, BMP)": "Choose one or more images (PNG, JPG, WebP, GIF, BMP)", "اختر صورة أو أكثر": "Choose one or more images",
  "الصيغة الناتجة": "Output format", "الصيغة": "Format", "الجودة ": "Quality ", "أقصى عرض (بكسل)": "Max width (px)", "ضغط الصور": "Compress images",
  "تنزيل": "Download", "تطبيق": "Apply", "WebP (الأصغر حجماً)": "WebP (smallest)", "PNG (بدون فقد)": "PNG (lossless)", "WAV (بدون فقد)": "WAV (lossless)", "صيغة الناتج": "Output format",
  "العرض": "Width", "الارتفاع": "Height", "الوضع": "Mode", "العرض (بكسل)": "Width (px)", "الارتفاع (بكسل)": "Height (px)",
  "الحفاظ على النسبة (داخل الأبعاد)": "Keep aspect ratio (fit inside)", "قص من المنتصف لأبعاد دقيقة": "Center-crop to exact size",
  "إنشاء PDF": "Create PDF", "اختر الصور بالترتيب اللي بدك ياه في الملف": "Choose images in the order you want", "مقاس الصفحة": "Page size", "صفحة A4": "A4 page", "نفس مقاس الصورة": "Same size as image",
  "اختر ملف صوتي (MP3, WAV, M4A, OGG…)": "Choose an audio file (MP3, WAV, M4A, OGG…)", "البداية (ثانية)": "Start (seconds)", "النهاية (ثانية)": "End (seconds)", "قص المقطع": "Trim clip",
  "دمج المقاطع": "Merge clips", "اختر الملفات بالترتيب اللي بدك ياه": "Choose files in the order you want",
  "النص أو الرابط": "Text or link", "رابط أو نص…": "Link or text…", "الحجم": "Size", "صغير": "Small", "متوسط": "Medium", "كبير": "Large", "تصحيح الأخطاء": "Error correction",
  "لون الرمز": "Code color", "لون الخلفية": "Background color", "تنزيل PNG": "Download PNG",
  "الصق نصك هنا…": "Paste your text here…", "كلمات": "Words", "أحرف": "Characters", "أحرف بدون مسافات": "Characters (no spaces)", "أسطر": "Lines", "جمل": "Sentences", "وقت القراءة (دقيقة)": "Reading time (min)",
  "توليد جديد": "Generate new", "نسخ": "Copy", "نسخ الناتج": "Copy output", "تنسيق": "Format", "ضغط": "Minify", "تحقق فقط": "Validate only", "الطول ": "Length ",
  "أحرف كبيرة A-Z": "Uppercase A-Z", "أحرف صغيرة a-z": "Lowercase a-z", "أرقام 0-9": "Digits 0-9", "رموز !@#$": "Symbols !@#$",
  "تُولَّد داخل متصفحك فقط ولا تُرسل لأي مكان.": "Generated in your browser only. Never sent anywhere.",
  "ترقية إلى VIP": "Upgrade to VIP", "شاهد الباقات": "See plans", "عضوية VIP بتفتح المعالجة غير المحدودة وبتخفي الإعلانات تلقائياً.": "VIP unlocks unlimited processing and hides ads automatically.",
  "سياسة الخصوصية": "Privacy Policy", "شروط الاستخدام": "Terms of Service", "من نحن": "About", "اتصل بنا": "Contact", "الأدلة": "Guides",
  "جميع الحقوق محفوظة لصالح ahmad bozan © 2026": "All rights reserved to ahmad bozan © 2026",
  "أهلاً": "Welcome", "سجّل دخولك لتشوف حسابك ومحفظتك.": "Log in to see your account and wallet.", "سجّل دخولك.": "Please log in.",
  "تسجيل الدخول": "Log in", "إنشاء حساب": "Create account", "استعادة كلمة السر": "Reset password", "البريد الإلكتروني": "Email", "كلمة السر": "Password",
  "كلمة السر (10 أحرف على الأقل)": "Password (at least 10 characters)", "أرسل رابط الاستعادة": "Send reset link", "المتابعة عبر Google": "Continue with Google",
  "عندي حساب": "I have an account", "نسيت كلمة السر؟": "Forgot password?", "كلمة سر جديدة": "New password", "حفظ كلمة السر": "Save password",
  "كلمة السر الجديدة (10 أحرف على الأقل)": "New password (at least 10 characters)",
  "ملفي الشخصي": "My profile", "حساب مجاني": "Free account", "الاسم": "Name", "حفظ الاسم": "Save name", "تغيير كلمة السر": "Change password", "محفظتي": "My wallet",
  "الرصيد بيتحدّث بعد ما المالك يؤكد استلام الدفع.": "Your balance updates after the owner confirms payment.",
  "شحن الرصيد": "Top up", "كل شحنة بتعطيك أيام VIP تلقائياً حسب الباقة.": "Every top-up gives you VIP days automatically, depending on the plan.",
  "طريقة الدفع": "Payment method", "تأكيد الشحن": "Confirm top-up", "طلبات الشحن": "Top-up requests", "سجل الحركات": "Transactions", "لا توجد حركات بعد.": "No transactions yet.",
  "المبلغ": "Amount", "الطريقة": "Method", "الحالة": "Status", "التاريخ": "Date", "بانتظار الدفع": "Awaiting payment", "تم": "Done", "مرفوض": "Rejected", "مدى الحياة": "Lifetime",
  "فتح تلغرام وإرسال الطلب": "Open Telegram and send request", "باقات الشحن": "Top-up plans",
  "الاشتراك بالسحب": "Join the draw", "أنت مشترك": "You're in", "سجّل دخولك للاشتراك": "Log in to join", "لا يوجد سحب متاح حالياً.": "No draw available right now.",
  "تأكيد الاشتراك": "Confirm entry", "إلغاء": "Cancel", "تأكيد": "Confirm", "إغلاق": "Close",
  "نستخدم ملفات تعريف الارتباط لتشغيل الموقع وعرض الإعلانات. يمكنك قبولها أو رفض الإعلانية منها. ": "We use cookies to run the site and show ads. You can accept or decline advertising cookies. ",
  "موافق": "Accept", "رفض": "Decline", "جاري التحميل…": "Loading…", "جاري المعالجة…": "Processing…", "جاري الدمج…": "Merging…", "جاري إنشاء الملف…": "Creating file…", "جاري قراءة الملف…": "Reading file…",
  "ادعيلي اتزوجها": "Pray that I marry her",
  "اختر صورة أولاً.": "Choose an image first.", "أهلاً فيك!": "Welcome!", "تم الحفظ": "Saved", "تم النسخ": "Copied",
  "تم إنشاء حسابك وسجّلنا دخولك. أهلاً فيك!": "Your account is ready and you're logged in. Welcome!",
  "الإيميل أو كلمة السر غير صحيحة.": "Incorrect email or password.", "هالإيميل مسجّل من قبل.": "This email is already registered.",
  "هالإيميل غير مسموح. استخدم إيميل حقيقي.": "This email isn't allowed. Please use a real email address.",
  "رصيدك ما بيكفي. اشحن محفظتك أولاً.": "Insufficient balance. Top up your wallet first.", "أنت مشترك بهالسحب من قبل.": "You've already joined this draw.",
  "صار خطأ. جرّب مرة ثانية.": "Something went wrong. Please try again.", "سجّل دخولك أولاً.": "Please log in first.", "حسابك معلّق. تواصل مع الإدارة.": "Your account is suspended. Contact support.",
};
const EN_PAT = [
  [/^المدة الكلية: ([\d.]+) ثانية$/, (m) => `Total duration: ${m[1]} seconds`],
  [/^وفّرت (\d+)%$/, (m) => `Saved ${m[1]}%`],
  [/^(\d+) يوم VIP$/, (m) => `${m[1]} VIP days`],
  [/^★ VIP مدى الحياة$/, () => "★ Lifetime VIP"],
  [/^VIP مدى الحياة$/, () => "Lifetime VIP"],
  [/^(\d+) صورة$/, (m) => `${m[1]} images`],
  [/^تنزيل \((.+)\)$/, (m) => `Download (${m[1]})`],
  [/^(\d+) يوم (\d\d:\d\d:\d\d)$/, (m) => `${m[1]}d ${m[2]}`],
];
let LANG = "ar";
try { LANG = localStorage.getItem("lang") === "en" ? "en" : "ar"; } catch (_) { /* ignore */ }
function trStr(str) {
  const t = str.trim(); if (!t) return str;
  let out = EN[t];
  if (out === undefined) for (const [re, fn] of EN_PAT) { const m = t.match(re); if (m) { out = fn(m); break; } }
  if (out === undefined && EN[str] !== undefined) out = EN[str];
  return out === undefined ? str : str.replace(t, out);
}
function trTree(root) {
  if (root.nodeType === 3) { const v = trStr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
  if (root.nodeType !== 1) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = w.currentNode;
  while (n) {
    if (n.nodeType === 3) { const v = trStr(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; }
    else for (const a of ["placeholder", "title", "aria-label", "alt"]) { const x = n.getAttribute && n.getAttribute(a); if (x) { const v = trStr(x); if (v !== x) n.setAttribute(a, v); } }
    n = w.nextNode();
  }
}
function initI18n() {
  const btn = $("#langBtn");
  btn.textContent = LANG === "en" ? "عربي" : "EN";
  btn.addEventListener("click", () => { try { localStorage.setItem("lang", LANG === "en" ? "ar" : "en"); } catch (_) { /* ignore */ } location.reload(); });
  if (LANG !== "en") return;
  document.documentElement.lang = "en"; document.documentElement.dir = "ltr";
  document.title = "Adawati — image compressor, audio trimmer & QR generator";
  trTree(document.body);
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(trTree))).observe(document.body, { childList: true, subtree: true });
}

/* ---------------- تثبيت التطبيق (PWA) ---------------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; $("#installBtn").hidden = false; });
$("#installBtn").addEventListener("click", async () => { if (!deferredInstall) return; deferredInstall.prompt(); deferredInstall = null; $("#installBtn").hidden = true; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => { /* ignore */ }));

/* ---------------- الموجّه ---------------- */
const currentRoute = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];
let renderToken = 0;
async function route() {
  const tok = ++renderToken;
  const r = currentRoute();
  applyChrome();
  const view = $("#view");
  view.replaceChildren(h("p", { class: "muted" }, "جاري التحميل…"));
  let node;
  try {
    if (r === "/account") node = await accountView();
    else if (r === "/draw") node = await drawView();
    else if (r === "/admin") node = state.user ? await adminView() : guestCard("سجّل دخولك.");
    else node = homeView();
  } catch (e) { node = h("div", { class: "glass" }, errMsg(e)); }
  if (tok !== renderToken) return;
  view.replaceChildren(node);
  tickCountdowns();
}
window.addEventListener("hashchange", route);

/* ---------------- الإقلاع ---------------- */
$("#authBtn").addEventListener("click", async () => {
  if (state.user) { await sb.auth.signOut(); location.hash = "#/"; } else openAuth("login");
});
$("#themeBtn").addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem("theme", t); } catch (_) { /* ignore */ }
});
try { const t = localStorage.getItem("theme"); if (t === "light" || t === "dark") document.documentElement.dataset.theme = t; } catch (_) { /* ignore */ }

let lastUid;
sb.auth.onAuthStateChange((event, session) => {
  state.session = session; state.user = session ? session.user : null;
  const uid = state.user ? state.user.id : null;
  const changed = uid !== lastUid;
  lastUid = uid;
  setTimeout(async () => {
    if (event === "PASSWORD_RECOVERY") { await loadProfile(); openSetPassword(false); route(); return; }
    // تجديد التوكن أو العودة للتبويب بعد اختيار ملف: لا نعيد رسم الصفحة (حتى ما يضيع الملف المختار)
    if (!changed) { if (event === "USER_UPDATED") await loadProfile(); return; }
    await loadProfile(); await loadDrawFlag();
    if (state.user && state.user.user_metadata && state.user.user_metadata.must_change_password === true) openSetPassword(true);
    route();
  }, 0);
});

initI18n();
(async () => {
  await Promise.all([loadContent(), loadPackages()]);
  const { data } = await sb.auth.getSession();
  state.session = data.session; state.user = data.session ? data.session.user : null;
  lastUid = state.user ? state.user.id : null;
  await loadProfile(); await loadDrawFlag();
  route();
  showConsent(); showPray();
})();
})();
