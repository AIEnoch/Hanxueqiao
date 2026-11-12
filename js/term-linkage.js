/**
 * 汉学桥 · 字词关联浮层
 * 基于 getI18nDict（zh + 当前 UI 语）中的术语表、白话条目、文化注释等做匹配，
 * 不增加独立词表字段；篇目页需加载 script.js（暴露 HANQIAO.getI18nDict）与 data-work-id。
 */
(function () {
    'use strict';

    const MAX_TERM = 24;
    const MAX_M2 = 24;
    const CULTURE_KEYS = ['dao', 'ming', 'wu', 'you'];
    /** 点击须在字形盒范围内，避免点在空白/边距却落到段首而误匹配 */
    const CHAR_HIT_EPSILON = 6;

    let lexicon = null;
    let lastOpenKey = '';
    let dragState = null;

    /** 点击按钮内文字时 target 常为文本节点，无 closest；统一归一到父元素 */
    function eventTargetEl(e) {
        const t = e && e.target;
        if (!t) return null;
        return t.nodeType === Node.TEXT_NODE ? t.parentElement : t;
    }

    function getWorkId() {
        return document.body && document.body.dataset && document.body.dataset.workId ? document.body.dataset.workId : '';
    }

    function getDict(lang) {
        return window.HANQIAO && typeof window.HANQIAO.getI18nDict === 'function' ? window.HANQIAO.getI18nDict(lang) : {};
    }

    function getUiLang() {
        const b = document.querySelector('.lang-btn.active');
        return b ? b.getAttribute('data-lang') || 'zh' : 'zh';
    }

    function extractZhRuns(s) {
        const str = String(s || '');
        return str.match(/[\u4e00-\u9fff]+/g) || [];
    }

    function extractZhFirst(s) {
        const runs = extractZhRuns(s);
        return runs.length ? runs[0][0] : '';
    }

    function stripTitle(s) {
        return String(s || '')
            .replace(/[：:，,、]\s*$/u, '')
            .replace(/\s+/g, '')
            .trim();
    }

    function tokenizeLatin(s) {
        const m = String(s || '').match(/[A-Za-zÀ-ÿĀ-žŌŪāēīōūǎǐǒǔàèìòùáéíóúäöüÄÖÜßñÑ]+/g);
        return m || [];
    }

    function normLatin(w) {
        return String(w || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    function rebuildLexicon() {
        const zh = getDict('zh');
        const ui = getDict(getUiLang());
        const items = [];

        for (let i = 1; i <= MAX_TERM; i++) {
            const ka = 'termRow' + i + 'a';
            const kb = 'termRow' + i + 'b';
            const zha = zh[ka];
            const zhb = zh[kb];
            if (!zha || !String(zha).trim() || !zhb || !String(zhb).trim()) continue;
            const latin = new Set();
            tokenizeLatin(zha).forEach((t) => latin.add(normLatin(t)));
            tokenizeLatin(ui[ka]).forEach((t) => latin.add(normLatin(t)));
            const zhStrs = new Set();
            zhStrs.add(String(zha).trim());
            extractZhRuns(zha).forEach((r) => {
                for (let L = Math.min(6, r.length); L >= 1; L--) zhStrs.add(r.slice(0, L));
            });
            items.push({ kind: 'term', i, pri: 4, latin, zhStrs });
        }

        function addM2Blocks(pre, jMax, pri) {
            for (let j = 1; j <= jMax; j++) {
                const kt = pre + j + 't';
                const kb = pre + j + 'b';
                const zt = zh[kt];
                const zb = zh[kb];
                if ((!zt || !String(zt).trim()) && (!zb || !String(zb).trim())) continue;
                const titleZh = stripTitle(zt);
                const latin = new Set();
                tokenizeLatin(zt).forEach((t) => latin.add(normLatin(t)));
                tokenizeLatin(ui[kt]).forEach((t) => latin.add(normLatin(t)));
                const zhStrs = new Set();
                if (titleZh) {
                    zhStrs.add(titleZh);
                    extractZhRuns(titleZh).forEach((r) => {
                        for (let L = Math.min(8, r.length); L >= 1; L--) zhStrs.add(r.slice(0, L));
                    });
                }
                if (zb) {
                    extractZhRuns(zb).forEach((r) => {
                        if (r.length <= 4) zhStrs.add(r);
                    });
                }
                if (!zhStrs.size) continue;
                const kind = pre === 'm2d' ? 'm2d' : 'm2l';
                items.push({ kind: kind, j: j, pri: pri, latin, zhStrs });
            }
        }

        addM2Blocks('m2d', MAX_M2, 3);
        addM2Blocks('m2l', 12, 2);

        const chineseList = [];
        for (const it of items) {
            for (const s of it.zhStrs) {
                if (s && s.length) chineseList.push({ s: s, it: it, len: s.length, pri: it.pri });
            }
        }
        chineseList.sort(function (a, b) {
            if (b.len !== a.len) return b.len - a.len;
            return b.pri - a.pri;
        });

        const latinMap = new Map();
        for (const it of items) {
            for (const w of it.latin) {
                if (w.length < 2) continue;
                if (!latinMap.has(w)) latinMap.set(w, it);
            }
        }
        /* 常见音写差异（无额外数据字段） */
        function alias(a, b) {
            if (latinMap.has(a) && !latinMap.has(b)) latinMap.set(b, latinMap.get(a));
            if (latinMap.has(b) && !latinMap.has(a)) latinMap.set(a, latinMap.get(b));
        }
        alias('dao', 'tao');
        alias('de', 'te');

        lexicon = { chineseList: chineseList, latinMap: latinMap };
    }

    function truncatePreview(str, maxLen) {
        const t = String(str || '')
            .replace(/\s+/g, ' ')
            .trim();
        const m = maxLen == null ? 96 : maxLen;
        if (t.length <= m) return t;
        return t.slice(0, Math.max(1, m - 1)) + '\u2026';
    }

    function buildWrapTitle(it) {
        const zh = getDict('zh');
        const ui = getDict(getUiLang());
        let line = '';
        if (it.kind === 'term') {
            const ta = ui['termRow' + it.i + 'a'] || zh['termRow' + it.i + 'a'];
            const tb = ui['termRow' + it.i + 'b'] || zh['termRow' + it.i + 'b'];
            const head = stripTitle(ta);
            line = head ? head + '\uFF1A' + truncatePreview(tb, 88) : truncatePreview(tb, 96);
        } else if (it.kind === 'm2d' || it.kind === 'm2l') {
            const pre = it.kind === 'm2d' ? 'm2d' : 'm2l';
            const zt = ui[pre + it.j + 't'] || zh[pre + it.j + 't'];
            const zb = ui[pre + it.j + 'b'] || zh[pre + it.j + 'b'];
            const head = stripTitle(zt);
            line = head ? head + '\uFF1A' + truncatePreview(zb, 88) : truncatePreview(zb, 96);
        }
        const lang = getUiLang();
        const hint =
            lang === 'zh'
                ? '\u70b9\u51fb\u67e5\u770b\u5168\u6587\u6ce8\u91ca'
                : lang === 'es'
                  ? 'Pulse para ver las notas completas'
                  : lang === 'pt'
                    ? 'Clique para ver as notas completas'
                    : lang === 'it'
                      ? 'Clicca per le note complete'
                      : 'Tap / click for full notes';
        return line ? line + '\n\u2014 ' + hint : hint;
    }

    function applyTermWrapAttrs(span, it) {
        span.setAttribute('data-hlq-kind', it.kind);
        if (it.kind === 'term') span.setAttribute('data-hlq-i', String(it.i));
        else span.setAttribute('data-hlq-j', String(it.j));
        span.title = buildWrapTitle(it);
    }

    function refreshClassicWrapTitles() {
        document.querySelectorAll('.hanqiao-term-wrap[data-hlq-kind]').forEach(function (span) {
            const kind = span.getAttribute('data-hlq-kind');
            const it =
                kind === 'term'
                    ? { kind: 'term', i: parseInt(span.getAttribute('data-hlq-i'), 10) }
                    : { kind: kind, j: parseInt(span.getAttribute('data-hlq-j'), 10) };
            if (!it.i && it.kind === 'term') return;
            if (!it.j && it.kind !== 'term') return;
            span.title = buildWrapTitle(it);
        });
    }

    /** 古文原文：自动标出词表中可点读的字词（悬停预览 + 点击仍打开浮层） */
    function decorateClassicOriginal() {
        const root = document.querySelector('main .text-card.original .text-content');
        if (!root || root.getAttribute('data-hanqiao-original-decorated') === '1') return;
        if (!getWorkId()) return;
        rebuildLexicon();
        if (!lexicon || !lexicon.chineseList.length) return;

        const twOpts = {
            acceptNode: function (node) {
                if (!node.nodeValue || !String(node.nodeValue).trim()) return NodeFilter.FILTER_REJECT;
                const p = node.parentElement;
                if (p && p.closest('.hanqiao-term-wrap')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        };
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, twOpts);
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);

        const list = lexicon.chineseList;
        function splitOne(textNode) {
            const text = textNode.nodeValue;
            if (!text) return false;
            const frag = document.createDocumentFragment();
            let i = 0;
            let anyTerm = false;
            while (i < text.length) {
                const ch = text.charAt(i);
                if (!/[\u4e00-\u9fff]/.test(ch)) {
                    frag.appendChild(document.createTextNode(ch));
                    i++;
                    continue;
                }
                let best = null;
                for (let k = 0; k < list.length; k++) {
                    const row = list[k];
                    const s = row.s;
                    if (!s.length || text.indexOf(s, i) !== i) continue;
                    if (
                        !best ||
                        s.length > best.len ||
                        (s.length === best.len && row.pri > best.pri)
                    ) {
                        best = { len: s.length, it: row.it, s: s };
                    }
                }
                if (best) {
                    anyTerm = true;
                    const span = document.createElement('span');
                    span.className = 'hanqiao-term-wrap';
                    span.textContent = best.s;
                    applyTermWrapAttrs(span, best.it);
                    frag.appendChild(span);
                    i += best.len;
                } else {
                    frag.appendChild(document.createTextNode(ch));
                    i++;
                }
            }
            if (!anyTerm) return false;
            textNode.parentNode.replaceChild(frag, textNode);
            return true;
        }

        for (let j = 0; j < nodes.length; j++) splitOne(nodes[j]);
        root.setAttribute('data-hanqiao-original-decorated', '1');
    }

    function charBoxContainsPoint(textNode, charIndex, x, y, epsilon) {
        const val = textNode.nodeValue;
        if (!val || charIndex < 0 || charIndex >= val.length) return false;
        const r = document.createRange();
        try {
            r.setStart(textNode, charIndex);
            r.setEnd(textNode, charIndex + 1);
        } catch (err) {
            return false;
        }
        const rects = r.getClientRects();
        const eps = epsilon == null ? CHAR_HIT_EPSILON : epsilon;
        for (let i = 0; i < rects.length; i++) {
            const rect = rects[i];
            if (rect.width === 0 && rect.height === 0) continue;
            if (x >= rect.left - eps && x <= rect.right + eps && y >= rect.top - eps && y <= rect.bottom + eps) return true;
        }
        return false;
    }

    function resolveClickOffsetInTextNode(textNode, text, prefOff, clientX, clientY) {
        const len = text.length;
        const candidates = [];
        if (prefOff >= 0 && prefOff < len) {
            candidates.push(prefOff);
            if (prefOff > 0) candidates.push(prefOff - 1);
            if (prefOff < len - 1) candidates.push(prefOff + 1);
        } else if (prefOff === len && len > 0) {
            candidates.push(len - 1);
        }
        const seen = new Set();
        for (let c = 0; c < candidates.length; c++) {
            const o = candidates[c];
            if (seen.has(o) || o < 0 || o >= len) continue;
            seen.add(o);
            if (charBoxContainsPoint(textNode, o, clientX, clientY, CHAR_HIT_EPSILON)) return o;
        }
        return null;
    }

    function isGlyphEligibleForLookup(ch, lang) {
        if (!ch || /\s/.test(ch)) return false;
        if (/[\u4e00-\u9fff]/.test(ch)) return true;
        if (lang !== 'zh' && /[A-Za-zÀ-ÿĀ-ž]/.test(ch)) return true;
        return false;
    }

    function getTextPoint(e) {
        if (document.caretRangeFromPoint) {
            const r = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (r && r.startContainer.nodeType === Node.TEXT_NODE) {
                return { node: r.startContainer, offset: r.startOffset };
            }
        }
        if (document.caretPositionFromPoint) {
            const p = document.caretPositionFromPoint(e.clientX, e.clientY);
            if (p && p.offsetNode && p.offsetNode.nodeType === Node.TEXT_NODE) {
                return { node: p.offsetNode, offset: p.offset };
            }
        }
        return null;
    }

    function isLinkageTarget(el) {
        if (!getWorkId()) return false;
        if (!el || !el.closest) return false;
        if (el.closest('a, button, input, textarea, select, .term-link-popover')) return false;
        const main = el.closest('main');
        if (!main) return false;
        return !!(
            el.closest('.text-content') ||
            el.closest('.term-table td') ||
            el.closest('.guide-lead') ||
            el.closest('.hub-lead') ||
            el.closest('.outline-text') ||
            el.closest('.def-list li') ||
            el.closest('.layer-list li') ||
            el.closest('.commentary-card') ||
            el.closest('.latin-table td') ||
            el.closest('.summary-list li')
        );
    }

    function matchChinese(text, offset) {
        if (!lexicon || !text) return null;
        const sliceEnd = text.slice(offset);
        let best = null;
        for (let k = 0; k < lexicon.chineseList.length; k++) {
            const row = lexicon.chineseList[k];
            const s = row.s;
            const it = row.it;
            const len = row.len;
            const pri = row.pri;
            if (sliceEnd.indexOf(s) === 0) {
                if (!best || len > best.len || (len === best.len && pri > best.pri)) {
                    best = { it: it, needle: s, len: len, pri: pri };
                }
            }
        }
        if (!best && offset < text.length && /[\u4e00-\u9fff]/.test(text.charAt(offset))) {
            const ch = text.charAt(offset);
            for (let k = 0; k < lexicon.chineseList.length; k++) {
                const row = lexicon.chineseList[k];
                if (row.s === ch && (!best || row.pri > best.pri)) {
                    best = { it: row.it, needle: ch, len: 1, pri: row.pri };
                }
            }
        }
        return best;
    }

    function getWordLatin(text, offset) {
        let i = Math.max(0, Math.min(offset, text.length - 1));
        while (i < text.length && !/[A-Za-zÀ-ÿ]/.test(text.charAt(i)) && i > 0) i--;
        if (!/[A-Za-zÀ-ÿ]/.test(text.charAt(i))) return { word: '', norm: '' };
        let start = i;
        while (start > 0 && /[A-Za-zÀ-ÿ]/.test(text.charAt(start - 1))) start--;
        let end = i;
        while (end < text.length && /[A-Za-zÀ-ÿ]/.test(text.charAt(end))) end++;
        let word = text.slice(start, end);
        word = word.replace(/^[.,;:!?¿¡「」"'“”]+|[.,;:!?¿¡」"'“”]+$/g, '');
        return { word: word, norm: normLatin(word) };
    }

    function matchLatin(text, offset) {
        if (!lexicon) return null;
        const o = getWordLatin(text, offset);
        if (o.norm.length < 2) return null;
        let it = lexicon.latinMap.get(o.norm);
        if (!it) {
            for (let k = o.norm.length; k >= 3; k--) {
                it = lexicon.latinMap.get(o.norm.slice(0, k));
                if (it) break;
            }
        }
        return it ? { it: it, needleLatin: o.word } : null;
    }

    function resolveHit(e) {
        const x = e.clientX;
        const y = e.clientY;
        if (typeof x !== 'number' || typeof y !== 'number') return null;
        const pt = getTextPoint(e);
        if (!pt) return null;
        const text = pt.node.nodeValue || '';
        if (!text.length) return null;
        const lang = getUiLang();
        const off = resolveClickOffsetInTextNode(pt.node, text, pt.offset, x, y);
        if (off == null) return null;
        const ch = text.charAt(off);
        if (!isGlyphEligibleForLookup(ch, lang)) return null;

        if (lang === 'zh') {
            const hit = matchChinese(text, off);
            return hit ? { it: hit.it, mode: 'zh', needleZh: hit.needle, needleLatin: '', offset: off } : null;
        }

        const hitL = matchLatin(text, off);
        if (hitL) {
            return { it: hitL.it, mode: 'romance', needleZh: '', needleLatin: hitL.needleLatin, offset: off };
        }
        const hitC = matchChinese(text, off);
        if (hitC) {
            return { it: hitC.it, mode: 'romance', needleZh: hitC.needle, needleLatin: '', offset: off };
        }
        return null;
    }

    function stripTags(html) {
        const d = document.createElement('div');
        d.innerHTML = html;
        return (d.textContent || '').trim();
    }

    function anchorZhFromItem(it) {
        const zh = getDict('zh');
        if (it.kind === 'term') return String(zh['termRow' + it.i + 'a'] || '').trim();
        if (it.kind === 'm2d') return stripTitle(zh['m2d' + it.j + 't'] || '') || extractZhFirst(zh['m2d' + it.j + 't'] || '');
        if (it.kind === 'm2l') return stripTitle(zh['m2l' + it.j + 't'] || '') || extractZhFirst(zh['m2l' + it.j + 't'] || '');
        return '';
    }

    function findM2Blocks(zhNeedle) {
        const zh = getDict('zh');
        const ui = getDict(getUiLang());
        const out = [];
        if (!zhNeedle) return out;
        function push(labelKey, bodyKey) {
            const zt = zh[labelKey];
            const zb = zh[bodyKey];
            if ((!zt || !String(zt).trim()) && (!zb || !String(zb).trim())) return;
            const bundle = String(zt || '') + String(zb || '');
            if (bundle.indexOf(zhNeedle) === -1) return;
            out.push({
                lh: ui[labelKey] || zt,
                body: ui[bodyKey] || zb
            });
        }

        for (let j = 1; j <= MAX_M2; j++) {
            push('m2d' + j + 't', 'm2d' + j + 'b');
            push('m2l' + j + 't', 'm2l' + j + 'b');
        }
        return out.slice(0, 4);
    }

    function findCulture(zhNeedle) {
        const zh = getDict('zh');
        const ui = getDict(getUiLang());
        if (!zhNeedle) return null;
        for (let c = 0; c < CULTURE_KEYS.length; c++) {
            const key = CULTURE_KEYS[c];
            const title = zh[key + 'Title'] || '';
            const body = ui[key + 'Text'] || zh[key + 'Text'] || '';
            if (!body || !String(body).trim()) continue;
            if (title.indexOf(zhNeedle) !== -1 || stripTags(title).indexOf(zhNeedle) !== -1) {
                return { title: ui[key + 'Title'] || title, body: body, isHtml: false };
            }
        }
        const rawList = zh.m6list;
        if (rawList && stripTags(rawList).indexOf(zhNeedle) !== -1) {
            return { title: ui.m6title || zh.m6title || '', body: rawList, isHtml: true };
        }
        return null;
    }

    function getClassicExcerpt() {
        const original = document.querySelector('main .text-card.original .text-content');
        if (original) return original.innerText.replace(/\s+/g, ' ').trim().slice(0, 280);
        const interNodes = document.querySelectorAll('main .m3-inter-zh');
        if (interNodes && interNodes.length) {
            const combined = Array.from(interNodes)
                .map(function (n) {
                    return n.innerText.trim();
                })
                .filter(Boolean)
                .join(' ');
            return combined.replace(/\s+/g, ' ').trim().slice(0, 280);
        }
        const legacy = document.querySelector('main .m3-ref .text-content');
        if (legacy) return legacy.innerText.replace(/\s+/g, ' ').trim().slice(0, 280);
        return '';
    }

    function getTransSnippet(lang, needleLatin, zhNeedle) {
        if (lang === 'zh') return '';
        const root = document.querySelector('#hanqiao-m3-trans-root');
        let paras = [];
        if (root) {
            const panes = root.querySelectorAll('[data-m3-trans-pane="' + lang + '"]:not([hidden])');
            for (let pi = 0; pi < panes.length; pi++) {
                const nodes = panes[pi].querySelectorAll('p');
                for (let i = 0; i < nodes.length; i++) {
                    const t = nodes[i].textContent.trim();
                    if (t) paras.push(t);
                }
            }
        }
        if (!paras.length) {
            const card = document.querySelector('#translation-' + lang);
            if (!card) return '';
            const nodes = card.querySelectorAll('p');
            for (let i = 0; i < nodes.length; i++) {
                const t = nodes[i].textContent.trim();
                if (t) paras.push(t);
            }
        }
        if (!paras.length) return '';
        const lowLat = normLatin(needleLatin || '');
        if (lowLat.length >= 2) {
            for (let i = 0; i < paras.length; i++) {
                if (normLatin(paras[i]).indexOf(lowLat) !== -1) return paras[i];
            }
        }
        const runs = extractZhRuns(zhNeedle || '');
        if (runs.length) {
            const first = runs[0];
            for (let i = 0; i < paras.length; i++) {
                if (paras[i].indexOf(first) !== -1) return paras[i];
            }
        }
        return paras.slice(0, 2).join(' ');
    }

    function openKey(hit) {
        return [hit.it.kind, hit.it.i || hit.it.j || 0, hit.needleZh, hit.needleLatin, anchorZhFromItem(hit.it)].join('|');
    }

    function renderSections(hit) {
        const ui = getDict(getUiLang());
        const zh = getDict('zh');
        const lang = getUiLang();
        const it = hit.it;
        const zhAnchor = anchorZhFromItem(it) || hit.needleZh || '';

        const sections = [];
        const add = function (title, body, isHtml) {
            if (!body || !String(body).trim()) return;
            sections.push({ title: title, body: String(body).trim(), isHtml: !!isHtml });
        };

        if (it.kind === 'term') {
            const ta = ui['termRow' + it.i + 'a'] || zh['termRow' + it.i + 'a'];
            const tb = ui['termRow' + it.i + 'b'] || zh['termRow' + it.i + 'b'];
            const block = ta + '\n\n' + tb;
            add(ui.termLinkSectionTerm || '术语注释', block, false);
        } else if (it.kind === 'm2d' || it.kind === 'm2l') {
            const pre = it.kind === 'm2d' ? 'm2d' : 'm2l';
            const tKey = pre + it.j + 't';
            const bKey = pre + it.j + 'b';
            const lh = ui[tKey] || zh[tKey];
            const body = ui[bKey] || zh[bKey];
            add(ui.termLinkSectionVernacular || '白话释义', (lh ? lh + '\n\n' : '') + body, false);
        }

        if (it.kind === 'term') {
            const m2extra = findM2Blocks(zhAnchor);
            for (let i = 0; i < Math.min(3, m2extra.length); i++) {
                const row = m2extra[i];
                add(ui.termLinkSectionVernacular || '白话释义', (row.lh ? row.lh + '\n\n' : '') + row.body, false);
            }
        }

        if (hit.mode === 'romance' || lang !== 'zh') {
            const classic = getClassicExcerpt();
            if (classic) add(ui.termLinkSectionClassic || '中文原文', classic, false);
            const trans = getTransSnippet(lang, hit.needleLatin, zhAnchor);
            if (trans) add(ui.termLinkSectionTrans || '相关译文', trans, false);
        }

        const cul = findCulture(zhAnchor);
        if (cul) add(ui.termLinkSectionCulture || '文化要点', cul.body, cul.isHtml);

        if (!sections.length) add('', ui.termLinkEmpty || '未找到对应条目。', false);

        return sections;
    }

    function mountSections(container, sections) {
        container.innerHTML = '';
        for (let i = 0; i < sections.length; i++) {
            const sec = sections[i];
            if (i > 0) {
                const hr = document.createElement('hr');
                hr.className = 'term-link-section-divider';
                container.appendChild(hr);
            }
            const wrap = document.createElement('section');
            wrap.className = 'term-link-section';
            if (sec.title) {
                const h = document.createElement('h4');
                h.className = 'term-link-section-title';
                h.textContent = sec.title;
                wrap.appendChild(h);
            }
            const content = document.createElement('div');
            content.className = 'term-link-section-body';
            if (sec.isHtml) content.innerHTML = sec.body;
            else {
                const parts = sec.body.split(/\n\n+/);
                for (let p = 0; p < parts.length; p++) {
                    const para = document.createElement('p');
                    para.textContent = parts[p];
                    content.appendChild(para);
                }
            }
            wrap.appendChild(content);
            container.appendChild(wrap);
        }
    }

    function positionPopover(pop, clientX, clientY) {
        const pad = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isMobile = vw <= 768;
        pop.classList.toggle('is-bottom-sheet', isMobile);
        pop.style.right = 'auto';

        if (isMobile) {
            pop.style.left = '0';
            pop.style.width = '100%';
            pop.style.bottom = '0';
            pop.style.top = 'auto';
            pop.style.maxHeight = 'min(72vh, 520px)';
            return;
        }

        pop.style.width = Math.min(400, vw - 2 * pad) + 'px';
        pop.style.bottom = 'auto';
        pop.style.maxHeight = 'none';

        const prevVis = pop.style.visibility;
        pop.style.visibility = 'hidden';
        pop.style.left = '0';
        pop.style.top = '0';
        pop.removeAttribute('hidden');
        const rect = pop.getBoundingClientRect();

        let left = clientX + pad;
        let top = clientY + pad;
        if (left + rect.width > vw - pad) left = clientX - rect.width - pad;
        if (left < pad) left = pad;
        if (top + rect.height > vh - pad) top = clientY - rect.height - pad;
        if (top < pad) top = pad;

        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
        pop.style.visibility = prevVis || '';
    }

    function ensureShell() {
        let pop = document.getElementById('termLinkagePopover');
        if (pop) return pop;
        const back = document.createElement('div');
        back.id = 'termLinkageBackdrop';
        back.className = 'term-link-backdrop';
        back.hidden = true;
        pop = document.createElement('aside');
        pop.id = 'termLinkagePopover';
        pop.className = 'term-link-popover';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-modal', 'true');
        pop.setAttribute('aria-labelledby', 'termLinkagePopoverTitle');
        pop.setAttribute('dir', 'auto');
        pop.hidden = true;
        const head = document.createElement('header');
        head.className = 'term-link-popover-head';
        const title = document.createElement('span');
        title.id = 'termLinkagePopoverTitle';
        title.className = 'term-link-popover-title';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'term-link-popover-close';
        closeBtn.setAttribute('aria-label', '关闭');
        closeBtn.textContent = '\u00D7';
        head.appendChild(title);
        head.appendChild(closeBtn);
        const body = document.createElement('div');
        body.className = 'term-link-popover-body';
        pop.appendChild(head);
        pop.appendChild(body);
        document.body.appendChild(back);
        document.body.appendChild(pop);

        closeBtn.addEventListener(
            'click',
            function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                close();
            },
            true
        );
        closeBtn.addEventListener(
            'touchend',
            function (ev) {
                ev.preventDefault();
                close();
            },
            { passive: false, capture: true }
        );
        back.addEventListener('click', close);
        return pop;
    }

    function close() {
        const pop = document.getElementById('termLinkagePopover');
        const back = document.getElementById('termLinkageBackdrop');
        if (pop) {
            pop.hidden = true;
            pop.setAttribute('aria-hidden', 'true');
            pop.classList.remove('is-open');
            pop.style.visibility = '';
        }
        if (back) {
            back.hidden = true;
            back.setAttribute('aria-hidden', 'true');
        }
        lastOpenKey = '';
        dragState = null;
        try {
            document.body.style.userSelect = '';
        } catch (e) {}
    }

    /** 捕获阶段优先处理关闭与遮罩，避免与其它 document 监听器顺序冲突 */
    function onDocClickCapture(e) {
        if (!getWorkId()) return;
        const pop = document.getElementById('termLinkagePopover');
        if (!pop || !pop.classList.contains('is-open')) return;
        const el = eventTargetEl(e);
        if (!el) return;
        if (el.id === 'termLinkageBackdrop') {
            e.preventDefault();
            e.stopPropagation();
            close();
            return;
        }
        if (el.closest && el.closest('.term-link-popover-close')) {
            e.preventDefault();
            e.stopPropagation();
            close();
        }
    }

    function dragEnd() {
        dragState = null;
        try {
            document.body.style.userSelect = '';
        } catch (e) {}
    }

    function getEventClientXY(e) {
        if (e.touches && e.touches.length) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
            return { x: e.clientX, y: e.clientY };
        }
        return { x: null, y: null };
    }

    function onDragMove(e) {
        if (!dragState) return;
        const pop = dragState.pop;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const xy = getEventClientXY(e);
        if (xy.x == null || xy.y == null) return;
        if (e.cancelable && (e.type === 'touchmove' || (e.pointerType && e.pointerType === 'touch'))) e.preventDefault();
        let left = xy.x - dragState.dx;
        let top = xy.y - dragState.dy;
        const rect = pop.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        left = Math.max(6, Math.min(left, vw - w - 6));
        top = Math.max(6, Math.min(top, vh - h - 6));
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
        pop.style.right = 'auto';
        pop.style.bottom = 'auto';
    }

    function tryGlobalDragOrCloseFromPoint(e) {
        if (!getWorkId()) return;
        const pop = document.getElementById('termLinkagePopover');
        if (!pop || !pop.classList.contains('is-open')) return;

        const xy = getEventClientXY(e);
        const x = xy.x;
        const y = xy.y;
        if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) return;

        const hit = document.elementFromPoint(x, y);
        if (!hit) return;

        if (hit.id === 'termLinkageBackdrop' || (hit.closest && hit.closest('#termLinkageBackdrop'))) {
            e.preventDefault();
            e.stopPropagation();
            close();
            return;
        }

        if (!pop.contains(hit)) return;

        if (hit.closest && hit.closest('.term-link-popover-close')) {
            e.preventDefault();
            e.stopPropagation();
            close();
            return;
        }

        if (typeof e.button === 'number' && e.button !== 0) return;

        if (window.innerWidth <= 768) return;
        if (pop.classList.contains('is-bottom-sheet')) return;

        const headEl = hit.closest && hit.closest('.term-link-popover-head');
        if (!headEl || !pop.contains(headEl)) return;

        e.preventDefault();
        const rect = pop.getBoundingClientRect();
        dragState = { pop: pop, dx: x - rect.left, dy: y - rect.top };
        document.body.style.userSelect = 'none';
        try {
            if (window.PointerEvent && e.pointerId != null && typeof pop.setPointerCapture === 'function') {
                pop.setPointerCapture(e.pointerId);
            }
        } catch (err) {}
    }

    function open(e, hit) {
        const ui = getDict(getUiLang());
        const pop = ensureShell();
        const titleEl = pop.querySelector('.term-link-popover-title');
        const bodyEl = pop.querySelector('.term-link-popover-body');
        const closeBtn = pop.querySelector('.term-link-popover-close');
        if (closeBtn) {
            closeBtn.textContent = '\u00D7';
            closeBtn.setAttribute('aria-label', ui.termLinkClose || 'Close');
        }
        const zhA = anchorZhFromItem(hit.it);
        const label =
            hit.mode === 'romance' && hit.needleLatin
                ? hit.needleLatin
                : zhA || hit.needleZh || ui.termLinkPanelTitle || '关联导读';
        titleEl.textContent = label;
        mountSections(bodyEl, renderSections(hit));

        const back = document.getElementById('termLinkageBackdrop');
        if (back) {
            back.hidden = false;
            back.setAttribute('aria-hidden', 'false');
        }
        pop.hidden = false;
        pop.removeAttribute('aria-hidden');
        pop.classList.add('is-open');
        positionPopover(pop, e.clientX, e.clientY);
    }

    function onDocClick(e) {
        if (!getWorkId()) return;
        const tEl = eventTargetEl(e);
        const pop = document.getElementById('termLinkagePopover');
        if (pop && tEl && tEl.closest && tEl.closest('#termLinkagePopover')) return;

        if (!isLinkageTarget(tEl)) {
            if (pop && pop.classList.contains('is-open') && (!tEl || !tEl.closest || !tEl.closest('#termLinkagePopover'))) close();
            return;
        }

        if (tEl && tEl.closest && tEl.closest('a')) return;

        rebuildLexicon();
        if (!lexicon || !lexicon.chineseList.length) return;

        const hit = resolveHit(e);
        if (!hit) {
            close();
            return;
        }

        const k = openKey(hit);
        if (pop && pop.classList.contains('is-open') && k === lastOpenKey) {
            close();
            return;
        }

        lastOpenKey = k;
        e.preventDefault();
        e.stopPropagation();
        open(e, hit);
    }

    function onKey(e) {
        if (e.key === 'Escape') close();
    }

    function onResize() {
        const pop = document.getElementById('termLinkagePopover');
        if (!pop || pop.hidden || !pop.classList.contains('is-open')) return;
        positionPopover(pop, window.innerWidth / 2, window.innerHeight / 2);
    }

    function init() {
        if (!getWorkId()) return;
        rebuildLexicon();
        decorateClassicOriginal();
        document.addEventListener('click', onDocClickCapture, true);
        document.body.addEventListener('click', onDocClick, false);
        if (window.PointerEvent) {
            window.addEventListener('pointerdown', tryGlobalDragOrCloseFromPoint, true);
        } else {
            document.addEventListener('mousedown', tryGlobalDragOrCloseFromPoint, true);
            document.addEventListener('touchstart', tryGlobalDragOrCloseFromPoint, { capture: true, passive: false });
        }
        window.addEventListener('pointermove', onDragMove, true);
        window.addEventListener('pointerup', dragEnd, true);
        window.addEventListener('pointercancel', dragEnd, true);
        window.addEventListener('mousemove', onDragMove, true);
        window.addEventListener('mouseup', dragEnd, true);
        window.addEventListener('touchmove', onDragMove, { capture: true, passive: false });
        window.addEventListener('touchend', dragEnd, true);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onResize);
        window.addEventListener(
            'hanqiao:ui-lang',
            function () {
                rebuildLexicon();
                refreshClassicWrapTitles();
            },
            false
        );
        document.documentElement.classList.add('term-linkage-enabled');
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
