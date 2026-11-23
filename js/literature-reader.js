/**
 * 文献动态渲染：章节条、模块导航、正文主区域（保留原有 class 结构以便沿用 style.css）
 * 需在 script.js 之前加载；依赖 literature-core.js、literature-site.js、script.js；章节页在 script.js 之后还需 comments-widget.js（评论挂载于 body 级抽屉，不由本篇 main 承载）。
 */
(function () {
    'use strict';

    function esc(t) {
        return window.HANQIAO && window.HANQIAO.escapeHtml ? window.HANQIAO.escapeHtml(t) : String(t || '');
    }

    /** 模块详情页：标签栏下仅展示当前模块标题 */
    function chapterModuleTitleStrip(moduleTitleKey) {
        return (
            '<div class="chapter-module-context-strip">' +
            '<div class="container">' +
            '<p class="chapter-module-context-title">' +
            '<span data-i18n="' +
            moduleTitleKey +
            '"></span>' +
            '</p></div></div>'
        );
    }

    /** 章导读 hub：标签栏下语境标题（已移除居中标题条，保留面包屑即可） */

    function rootPrefix(depth) {
        const n = parseInt(depth, 10) || 0;
        return n > 0 ? new Array(n + 1).join('../') : '';
    }

    function findWork(site, folder) {
        const works = site && site.works ? site.works : [];
        return works.find(function (w) {
            return w.folder === folder;
        });
    }

    function findChapter(work, chapterId) {
        const list = work && work.chapters ? work.chapters : [];
        return list.find(function (c) {
            return c.id === chapterId;
        });
    }

    function modulesBag(site, chapterId) {
        const bag = site && site.modulesByChapterId ? site.modulesByChapterId : {};
        return bag[chapterId] || {};
    }

    function stripHref(fromSeg, toSeg, baseFile) {
        if (fromSeg === toSeg) return baseFile;
        return '../' + toSeg + '/' + baseFile;
    }

    /** 仅本章 WORK_COPY.zh：避免动态章节的模块二/四/五误用站点模板第一章条目 */
    function workZhFlat(chapterId) {
        try {
            const w = window.WORK_COPY && chapterId && window.WORK_COPY[chapterId];
            const zh = w && w.zh && typeof w.zh === 'object' ? w.zh : {};
            return zh;
        } catch (e) {
            return {};
        }
    }

    function collectM2dIndexes(zh) {
        const r = [];
        for (let i = 1; i <= 80; i++) {
            const t = zh['m2d' + i + 't'];
            const b = zh['m2d' + i + 'b'];
            if (
                (t != null && String(t).trim() !== '') ||
                (b != null && String(b).trim() !== '')
            ) {
                r.push(i);
            }
        }
        return r;
    }

    function collectM2lIndexes(zh) {
        const r = [];
        for (let i = 1; i <= 40; i++) {
            const t = zh['m2l' + i + 't'];
            const b = zh['m2l' + i + 'b'];
            if (
                (t != null && String(t).trim() !== '') ||
                (b != null && String(b).trim() !== '')
            ) {
                r.push(i);
            }
        }
        return r;
    }

    function m2TitleTokens(rawTitle) {
        const s = String(rawTitle || '')
            .replace(/[：:]/g, ' ')
            .replace(/[（(][^）)]*[）)]/g, ' ')
            .replace(/[，,。；;、]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!s) return [];
        const parts = s
            .split(/[\/|]/)
            .map(function (x) {
                return x.trim();
            })
            .filter(Boolean);
        return parts.length ? parts : [s];
    }

    function buildM2LinePairs(site, chapterId, zh, defIdx) {
        const lines = (((modulesBag(site, chapterId) || {}).m1 || {}).paragraphs || [])
            .map(function (x) {
                return String(x || '').trim();
            })
            .filter(Boolean);
        const assignments = {};
        const used = new Set();

        const pending = defIdx.map(function (i) {
            const anchor = zh['m2d' + i + 'k'];
            const tokens = anchor
                ? [String(anchor).trim()]
                : m2TitleTokens(zh['m2d' + i + 't']);
            let bestLine = -1;
            let bestLen = 0;
            lines.forEach(function (line, li) {
                tokens.forEach(function (tk) {
                    if (!tk || line.indexOf(tk) === -1) return;
                    if (tk.length > bestLen) {
                        bestLen = tk.length;
                        bestLine = li;
                    } else if (tk.length === bestLen && bestLine >= 0 && li > bestLine) {
                        bestLine = li;
                    }
                });
            });
            return { i: i, bestLine: bestLine, bestLen: bestLen };
        });

        pending.sort(function (a, b) {
            return b.bestLen - a.bestLen || a.i - b.i;
        });

        pending.forEach(function (p) {
            if (p.bestLine < 0 || used.has(p.i)) return;
            if (!assignments[p.bestLine]) assignments[p.bestLine] = [];
            assignments[p.bestLine].push(p.i);
            used.add(p.i);
        });

        const out = [];
        lines.forEach(function (line, li) {
            if (!assignments[li] || !assignments[li].length) return;
            out.push({ line: line, idxs: assignments[li] });
        });

        defIdx.forEach(function (i) {
            if (used.has(i)) return;
            const t = String(zh['m2d' + i + 't'] || '').trim();
            out.push({ line: t, idxs: [i] });
        });
        return out;
    }

    function renderParagraphsFromStrings(lines) {
        const arr = Array.isArray(lines) ? lines : [];
        return arr.map(function (line) {
            return '<p>' + esc(line) + '</p>';
        }).join('');
    }

    /** WORK_COPY：按行拆分译文，保留原文换行排版 */
    function paragraphsFromWorkCopyField(chapterId, lang, fieldName) {
        const fid = fieldName || 'translationText';
        try {
            const w = window.WORK_COPY && window.WORK_COPY[chapterId];
            const layer = w && w[lang];
            const raw = layer && layer[fid];
            if (raw == null || String(raw).trim() === '') return '';
            return String(raw)
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n')
                .map(function (line) {
                    const t = line.trim();
                    return t ? '<p>' + esc(t) + '</p>' : '';
                })
                .filter(Boolean)
                .join('');
        } catch (e) {
            return '';
        }
    }

    /** WORK_COPY 译文按行拆分（纯文本数组） */
    function translationLinesRaw(chapterId, lang, fieldName) {
        try {
            const w = window.WORK_COPY && window.WORK_COPY[chapterId];
            const layer = w && w[lang];
            const raw = layer && layer[fieldName || 'translationText'];
            if (raw == null || String(raw).trim() === '') return [];
            const lines = String(raw)
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n')
                .map(function (line) {
                    return line.trim();
                })
                .filter(Boolean);

            // 葡语/拉丁语模块三支持“段块”排版：
            // 以标题行作为段起点，避免按行合并时把语义层次切散。
            if (lang === 'pt' || lang === 'la') {
                const blocks = [];
                let current = [];
                let hasBlockStart = false;
                lines.forEach(function (line) {
                    const isBlockStart = /^(Texto original:|Textus originalis:|Traduzione:|Übersetzung:|Confronto interculturale|Interkultureller Vergleich|Capitolo\s+\d+|Kapitel\s+\d+|---)$/i.test(line);
                    if (isBlockStart) hasBlockStart = true;
                    if (isBlockStart && current.length) {
                        blocks.push(current.join('\n'));
                        current = [line];
                    } else {
                        current.push(line);
                    }
                });
                if (current.length) blocks.push(current.join('\n'));
                if (hasBlockStart && blocks.length) return blocks;
            }

            return lines;
        } catch (e) {
            return [];
        }
    }

    /** 中文拆句（优先换行，否则按句末标点） */
    function splitZhLines(zhFull) {
        const s = String(zhFull || '').trim();
        if (!s) return [];
        const byNl = s
            .split(/\n/)
            .map(function (x) {
                return x.trim();
            })
            .filter(Boolean);
        if (byNl.length > 1) return byNl;
        return s
            .split(/(?<=[。！？])/)
            .map(function (x) {
                return x.trim();
            })
            .filter(Boolean);
    }

    /** 将多行合并或填补为固定行数（用于与各语种译文对齐） */
    function mergeLinesToCount(lines, targetCount, joiner) {
        const arr = Array.isArray(lines) ? lines.slice() : [];
        const target = Math.max(1, parseInt(targetCount, 10) || 1);
        const glue = joiner == null ? ' ' : String(joiner);
        if (arr.length === 0) {
            const empty = [];
            for (let i = 0; i < target; i++) empty.push('');
            return empty;
        }
        if (arr.length === target) return arr;
        if (arr.length < target) {
            const out = arr.slice();
            while (out.length < target) out.push('');
            return out;
        }
        const out = [];
        const ratio = arr.length / target;
        for (let i = 0; i < target; i++) {
            const start = Math.round(i * ratio);
            const end = Math.round((i + 1) * ratio);
            const hi = Math.max(end, start + 1);
            out.push(arr.slice(start, hi).join(glue));
        }
        return out;
    }

    function m3InterTransParagraph(lineText) {
        if (lineText != null && String(lineText).trim() !== '') return '<p>' + esc(lineText) + '</p>';
        return '<p class="m3-trans-placeholder" data-i18n="m3TransPlaceholder"></p>';
    }

    /** 第一章逐字拼音（仅用于模块三中文原文展示） */
    const DDJ1_PINYIN_MAP = {
        道: 'dào',
        可: 'kě',
        非: 'fēi',
        恒: 'héng',
        常: 'cháng',
        名: 'míng',
        也: 'yě',
        无: 'wú',
        天: 'tiān',
        地: 'dì',
        之: 'zhī',
        始: 'shǐ',
        有: 'yǒu',
        万: 'wàn',
        物: 'wù',
        母: 'mǔ',
        故: 'gù',
        欲: 'yù',
        以: 'yǐ',
        观: 'guān',
        其: 'qí',
        妙: 'miào',
        徼: 'jiào',
        此: 'cǐ',
        两: 'liǎng',
        者: 'zhě',
        同: 'tóng',
        出: 'chū',
        而: 'ér',
        异: 'yì',
        谓: 'wèi',
        玄: 'xuán',
        又: 'yòu',
        众: 'zhòng',
        门: 'mén'
    };

    function m3ZhLineWithRuby(lineText, chapterId) {
        const s = String(lineText || '');
        if (chapterId !== 'ddj-1') return esc(s);
        let html = '';
        for (const ch of s) {
            const py = DDJ1_PINYIN_MAP[ch];
            if (py) {
                html += '<ruby>' + esc(ch) + '<rt>' + esc(py) + '</rt></ruby>';
            } else {
                html += esc(ch);
            }
        }
        return html;
    }

    /**
     * 模块三：行间对照（一行汉语 + 一行中/西/葡/意/拉/德），默认随界面语种；
     * 行数以中文拆句结果为基准，各译本按比例并入同一行数。
     */
    function resolveM3DefaultTransLang(langs) {
        const codes = langs.map(function (L) {
            return L.code;
        });
        const btn = document.querySelector('.lang-btn.active');
        const uiLang = btn ? btn.getAttribute('data-lang') : 'zh';
        if (codes.indexOf(uiLang) >= 0) return uiLang;
        return codes.indexOf('zh') >= 0 ? 'zh' : 'es';
    }

    function buildM3TranslationsBlock(site, chapterId) {
        const mod = modulesBag(site, chapterId).m3 || {};
        const zhFull = (mod.originalParagraphs || []).join('\n');
        let zhLines = splitZhLines(zhFull);
        if (zhLines.length === 0 && zhFull.trim()) zhLines = [zhFull.trim()];
        const n = Math.max(zhLines.length, 1);

        const zhTransLines = translationLinesRaw(chapterId, 'zh');
        const esLines = translationLinesRaw(chapterId, 'es');
        const ptLines = translationLinesRaw(chapterId, 'pt');
        const itLines = translationLinesRaw(chapterId, 'it');
        const laLines = translationLinesRaw(chapterId, 'la');
        const deLines = translationLinesRaw(chapterId, 'de');

        const merged = {
            zh: mergeLinesToCount(zhTransLines, n, '\n'),
            es: mergeLinesToCount(esLines, n, ' '),
            pt: mergeLinesToCount(ptLines, n, '\n'),
            it: mergeLinesToCount(itLines, n, '\n'),
            la: mergeLinesToCount(laLines, n, '\n'),
            de: mergeLinesToCount(deLines, n, '\n')
        };

        const langs = [
            { code: 'zh', label: '中文' },
            { code: 'es', label: 'Español' },
            { code: 'pt', label: 'Português' },
            { code: 'it', label: 'Italiano' },
            { code: 'de', label: 'Deutsch' },
            { code: 'la', label: 'Latina' }
        ];
        const defaultTrans = resolveM3DefaultTransLang(langs);
        const tabs = langs
            .map(function (L) {
                const active = L.code === defaultTrans ? ' active' : '';
                const sel = L.code === defaultTrans ? 'true' : 'false';
                return (
                    '<button type="button" role="tab" class="lang-btn m3-trans-tab' +
                    active +
                    '" data-m3-trans-lang="' +
                    L.code +
                    '" aria-selected="' +
                    sel +
                    '">' +
                    esc(L.label) +
                    '</button>'
                );
            })
            .join('');

        let pairsHtml = '';
        for (let i = 0; i < n; i++) {
            const z = zhLines[i] || '';
            pairsHtml += '<article class="m3-inter-pair">';
            pairsHtml += '<div class="m3-inter-zh' + (chapterId === 'ddj-1' ? ' han-ruby' : '') + '" lang="zh">' + m3ZhLineWithRuby(z, chapterId) + '</div>';
            pairsHtml += '<div class="m3-inter-trans-col">';
            langs.forEach(function (L) {
                const code = L.code;
                const hidden = code !== defaultTrans ? ' hidden' : '';
                pairsHtml +=
                    '<div class="m3-trans-pane m3-inter-trans-pane" role="tabpanel" data-m3-trans-pane="' +
                    code +
                    '"' +
                    hidden +
                    '>' +
                    m3InterTransParagraph(merged[code][i]) +
                    '</div>';
            });
            pairsHtml += '</div></article>';
        }

        return (
            '<div class="text-card m3-trans-panel m3-interlinear-card" id="hanqiao-m3-trans-root" data-active-trans-lang="' +
            esc(defaultTrans) +
            '">' +
            '<div class="m3-trans-toolbar" role="tablist" aria-label="译文语种">' +
            tabs +
            '</div>' +
            '<div class="m3-inter-stack">' +
            pairsHtml +
            '</div></div>'
        );
    }

    function m3ActivateTransLang(root, transLang) {
        root.setAttribute('data-active-trans-lang', transLang);
        root.querySelectorAll('.m3-trans-tab').forEach(function (btn) {
            const on = btn.getAttribute('data-m3-trans-lang') === transLang;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        root.querySelectorAll('[data-m3-trans-pane]').forEach(function (pane) {
            if (pane.getAttribute('data-m3-trans-pane') === transLang) pane.removeAttribute('hidden');
            else pane.setAttribute('hidden', '');
        });
    }

    function attachM3TranslationSwitcher(mainEl) {
        const root = mainEl.querySelector('#hanqiao-m3-trans-root');
        if (!root) return;
        const initial = root.getAttribute('data-active-trans-lang') || 'zh';
        m3ActivateTransLang(root, initial);
    }

    function buildArticleContextHtml(trail) {
        const segs = (trail || []).map(function (item) {
            if (item.href) {
                const cls = item.className ? ' class="' + esc(item.className) + '"' : '';
                return (
                    '<a href="' +
                    esc(item.href) +
                    '"' +
                    cls +
                    ' data-i18n="' +
                    esc(item.i18nKey) +
                    '"></a>'
                );
            }
            return '<span data-i18n="' + esc(item.i18nKey) + '"></span>';
        });
        return (
            '<div class="article-context">' +
            segs.join('<span class="article-context-sep">/</span>') +
            '</div>'
        );
    }

    function buildHubArticleContext(mainRp, folder) {
        return buildArticleContextHtml([
            { href: mainRp + 'index.html', i18nKey: 'navHome' },
            {
                href: mainRp + 'articles/' + folder + '/index.html',
                i18nKey: 'workShelfTitle',
                className: 'article-context-worklink'
            },
            { i18nKey: 'hubPageTitle' }
        ]);
    }

    function buildModuleArticleContext(mainRp, folder, moduleTitleKey) {
        return buildArticleContextHtml([
            { href: mainRp + 'index.html', i18nKey: 'navHome' },
            {
                href: mainRp + 'articles/' + folder + '/index.html',
                i18nKey: 'workShelfTitle',
                className: 'article-context-worklink'
            },
            { href: 'index.html', i18nKey: 'hubPageTitle' },
            { i18nKey: moduleTitleKey }
        ]);
    }

    function getStripUiLang() {
        const b = document.querySelector('.lang-btn.active');
        return (b && b.getAttribute('data-lang')) || 'zh';
    }

    function buildChapterStripOptions(chapters, fromSeg, baseFile) {
        const bySegment = {};
        (chapters || []).forEach(function (ch) {
            if (ch && ch.segment) bySegment[ch.segment] = ch;
        });
        let html = '';
        for (let n = 1; n <= 81; n++) {
            const segment = 'chapter-' + n;
            const label = String(n).padStart(2, '0');
            const ch = bySegment[segment];
            const selected = segment === fromSeg ? ' selected' : '';
            if (ch) {
                html +=
                    '<option value="' +
                    esc(stripHref(fromSeg, segment, baseFile)) +
                    '"' +
                    selected +
                    '>' +
                    label +
                    '</option>';
            } else {
                html +=
                    '<option disabled' +
                    selected +
                    '>' +
                    label +
                    '</option>';
            }
        }
        return html;
    }

    function wireChapterStripSelect(navHost) {
        const strip = navHost && navHost.querySelector('.chapter-strip');
        const select = strip && strip.querySelector('.chapter-strip-select');
        if (!select || select.getAttribute('data-hq-select-wired') === '1') return;
        select.setAttribute('data-hq-select-wired', '1');
        select.addEventListener('change', function () {
            if (select.value) window.location.href = select.value;
        });
    }

    function renderDynamicNav(opts) {
        const chapters = opts.chapters || [];
        const fromSeg = opts.fromSegment;
        const baseFile = opts.navBaseFile;
        const activeModule = opts.activeModule;
        const contextHtml = opts.contextHtml || '';
        const chapterOptions = buildChapterStripOptions(chapters, fromSeg, baseFile);

        const meta = {
            pathSegment: fromSeg,
            baseFile: baseFile,
            chapters: chapters.map(function (ch) {
                return { pathSegment: ch.segment, title: ch.title || {} };
            })
        };

        const mods = [
            { id: 'm1', href: 'm1.html', navKey: 'navM1' },
            { id: 'm2', href: 'm2.html', navKey: 'navM2' },
            { id: 'm3', href: 'm3.html', navKey: 'navM3' },
            { id: 'm4', href: 'm4.html', navKey: 'navM4' },
            { id: 'm5', href: 'm5.html', navKey: 'navM5' }
        ];

        const sub = mods
            .map(function (m) {
                let on = '';
                if (activeModule === 'hub') on = '';
                else if (m.id === activeModule) on = ' active';
                return (
                    '<a href="' +
                    esc(m.href) +
                    '" class="subnav-link' +
                    on +
                    '" data-i18n="' +
                    esc(m.navKey) +
                    '"></a>'
                );
            })
            .join('');

        const moduleNavHtml = activeModule === 'hub'
            ? ''
            : '<nav class="subnav-wrap" aria-label="本篇模块">' +
              '<div class="container subnav-inner">' +
              sub +
              '</div></nav>';

        const html =
            '<div class="chapter-context-row container">' +
            contextHtml +
            '<nav class="chapter-strip" aria-label="章节切换">' +
            '<div class="chapter-strip-inner">' +
            '<label class="chapter-picker">' +
            '<span data-i18n="chapterStripLabel"></span>' +
            '<select class="chapter-strip-select" aria-label="章节" data-i18n-aria-label="chapterStripLabel">' +
            chapterOptions +
            '</select></label></div></nav></div>' +
            moduleNavHtml;

        return { html: html, meta: meta };
    }

    function mountChapterNav(navHost, opts) {
        const built = renderDynamicNav(opts);
        navHost.innerHTML = built.html;
        wireChapterStripSelect(navHost);
        let metaEl = document.getElementById('hanqiao-work-nav-meta');
        if (!metaEl) {
            metaEl = document.createElement('script');
            metaEl.type = 'application/json';
            metaEl.id = 'hanqiao-work-nav-meta';
            navHost.appendChild(metaEl);
        }
        metaEl.textContent = JSON.stringify(built.meta);
    }

    function renderWorkOverview(body) {
        const site = window.LITERATURE_SITE;
        const folder = body.getAttribute('data-literature-work-folder');
        const work = findWork(site, folder);
        if (!work) return;

        const hubMeta = {
            title: work.title || {},
            summary: work.summary || {},
            chapters: (work.chapters || []).map(function (ch) {
                return {
                    href: ch.segment + '/index.html',
                    title: ch.title || {},
                    summary: ch.summary || {}
                };
            })
        };

        const holder = document.getElementById('hanqiao-work-hub-meta');
        if (holder) holder.textContent = JSON.stringify(hubMeta);

        const footModule = document.getElementById('hanqiao-footer-next-module');
        if (footModule && work.chapters && work.chapters.length) {
            const firstSeg = work.chapters[0].segment || 'chapter-1';
            footModule.href = firstSeg + '/m1.html';
            footModule.setAttribute('data-i18n', 'navM1');
        }
    }

    function wireCommentsDrawerInteractions(portal) {
        if (!portal || portal.getAttribute('data-hq-drawer-wired') === '1') return;
        portal.setAttribute('data-hq-drawer-wired', '1');
        var drawer = portal.querySelector('.hq-comments-drawer');
        var fab = portal.querySelector('#hq-comments-fab');
        var closeBtn = portal.querySelector('.hq-comments-drawer-close');
        var backdrop = portal.querySelector('.hq-comments-drawer-backdrop');
        if (!drawer || !fab || !closeBtn || !backdrop) return;

        function setOpen(open) {
            drawer.classList.toggle('is-open', open);
            fab.classList.toggle('is-active', open);
            fab.setAttribute('aria-expanded', open ? 'true' : 'false');
            drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
            document.body.classList.toggle('hq-comments-drawer-open', open);
        }

        fab.addEventListener('click', function () {
            setOpen(!drawer.classList.contains('is-open'));
        });
        closeBtn.addEventListener('click', function () {
            setOpen(false);
        });
        backdrop.addEventListener('click', function () {
            setOpen(false);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
                setOpen(false);
            }
        });
    }

    /** body 级固定抽屉：同一浏览器会话只创建一次，切换章节不换 DOM id */
    function ensureChapterCommentsDrawerPortal() {
        if (document.getElementById('hanqiao-comments-portal')) return;
        var portal = document.createElement('div');
        portal.id = 'hanqiao-comments-portal';
        portal.className = 'hq-comments-portal';
        portal.innerHTML =
            '<button type="button" class="hq-comments-fab" id="hq-comments-fab" aria-expanded="false" aria-controls="hq-comments-drawer-panel" data-i18n-aria-label="commentsFabAria">' +
            '<span class="hq-comments-fab-icon" aria-hidden="true">\u{1F4AC}</span>' +
            '<span class="hq-comments-fab-text" data-i18n="commentsFabLabel"></span></button>' +
            '<div class="hq-comments-drawer" id="hq-comments-drawer" aria-hidden="true">' +
            '<div class="hq-comments-drawer-backdrop" tabindex="-1" aria-hidden="true"></div>' +
            '<aside class="hq-comments-drawer-panel" id="hq-comments-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="hq-comments-drawer-title">' +
            '<header class="hq-comments-drawer-head">' +
            '<h2 class="hq-comments-drawer-title" id="hq-comments-drawer-title" data-i18n="chapterCommentsPanelTitle"></h2>' +
            '<button type="button" class="hq-comments-drawer-close" data-i18n-aria-label="commentsCloseAria">\u00d7</button>' +
            '</header>' +
            '<div class="hq-comments-drawer-scroll">' +
            '<div id="hanqiao-comments-root" class="hq-comments-root" data-comments-drawer="1"></div>' +
            '</div></aside></div>';
        document.body.appendChild(portal);
        wireCommentsDrawerInteractions(portal);
    }

    function mountLiteratureChapterExtensions() {
        ensureChapterCommentsDrawerPortal();
    }

    function renderChapterHub(body) {
        const site = window.LITERATURE_SITE;
        const folder = body.getAttribute('data-literature-work-folder');
        const seg = body.getAttribute('data-literature-chapter-segment');
        const chapterId = body.getAttribute('data-work-id');
        const depth = parseInt(body.getAttribute('data-literature-root-depth') || '3', 10);
        const rp = rootPrefix(depth);

        const work = findWork(site, folder);
        const chapter = findChapter(work, chapterId);
        if (!work || !chapter) return;

        const navHost = document.getElementById('hanqiao-literature-dynamic-nav');
        const mainEl = document.getElementById('hanqiao-literature-main');
        if (!navHost || !mainEl) return;

        mountChapterNav(navHost, {
            chapters: work.chapters || [],
            fromSegment: seg,
            navBaseFile: 'index.html',
            activeModule: 'hub',
            contextHtml: buildHubArticleContext(rp, folder)
        });

        mainEl.innerHTML =
            '<section class="content-section module-section hub-section">' +
            '<div class="container">' +
            '<div class="hub-module-grid hub-module-grid--five">' +
            '<a href="m1.html" class="hub-card"><span class="hub-card-badge" data-i18n="module1Badge"></span>' +
            '<strong class="hub-card-title" data-i18n="hubCardTitle1"></strong></a>' +
            '<a href="m2.html" class="hub-card"><span class="hub-card-badge" data-i18n="module2Badge"></span>' +
            '<strong class="hub-card-title" data-i18n="hubCardTitle2"></strong></a>' +
            '<a href="m3.html" class="hub-card"><span class="hub-card-badge" data-i18n="module3Badge"></span>' +
            '<strong class="hub-card-title" data-i18n="hubCardTitle3"></strong></a>' +
            '<a href="m4.html" class="hub-card"><span class="hub-card-badge" data-i18n="module4Badge"></span>' +
            '<strong class="hub-card-title" data-i18n="hubCardTitle4"></strong></a>' +
            '<a href="m5.html" class="hub-card"><span class="hub-card-badge" data-i18n="module5Badge"></span>' +
            '<strong class="hub-card-title" data-i18n="hubCardTitle5"></strong></a>' +
            '</div></div></section>';
        mountLiteratureChapterExtensions();
    }

    function buildM1(mainRp, folder, seg, chapterId, site) {
        const mod = modulesBag(site, chapterId).m1 || {};
        const paras =
            mod.paragraphs && mod.paragraphs.length
                ? renderParagraphsFromStrings(mod.paragraphs)
                : '<p></p>';

        return (
            chapterModuleTitleStrip('module1Title') +
            '<section class="content-section module-section">' +
            '<div class="container">' +
            '<div class="text-card original">' +
            '<h3 class="card-title" data-i18n="originalTitle"></h3>' +
            '<div class="text-content">' +
            paras +
            '</div></div></div></section>'
        );
    }

    function buildM2(site, chapterId) {
        const zh = workZhFlat(chapterId);
        const defIdx = collectM2dIndexes(zh);
        const layIdx = collectM2lIndexes(zh);
        const linePairs = buildM2LinePairs(site, chapterId, zh, defIdx);
        const defs = linePairs
            .map(function (pair) {
                const notes = pair.idxs
                    .map(function (i) {
                        return (
                            '<p class="m2-line-note"><strong data-i18n="m2d' +
                            i +
                            't"></strong><span data-i18n="m2d' +
                            i +
                            'b"></span></p>'
                        );
                    })
                    .join('');
                return (
                    '<article class="m2-line-pair">' +
                    '<p class="m2-line-original">' +
                    esc(pair.line) +
                    '</p>' +
                    '<div class="m2-line-notes">' +
                    notes +
                    '</div>' +
                    '</article>'
                );
            })
            .join('');

        const layers = layIdx
            .map(function (i) {
                return (
                    '<li><strong data-i18n="m2l' +
                    i +
                    't"></strong> <span data-i18n="m2l' +
                    i +
                    'b"></span></li>'
                );
            })
            .join('');

        return (
            chapterModuleTitleStrip('module2Title') +
            '<section class="vernacular-section module-section">' +
            '<div class="container">' +
            '<div class="outline-card m2-core-panel">' +
            '<h3 class="outline-heading" data-i18n="m2h2"></h3>' +
            '<div class="m2-line-pairs">' +
            defs +
            '</div></div>' +
            '<div class="outline-card">' +
            '<h3 class="outline-heading" data-i18n="m2h3"></h3>' +
            '<ol class="layer-list">' +
            layers +
            '</ol></div>' +
            '<div class="outline-card">' +
            '<h3 class="outline-heading" data-i18n="m2h4"></h3>' +
            '<p class="outline-text" data-i18n="m2p4"></p></div>' +
            '<div class="outline-card">' +
            '<h3 class="outline-heading" data-i18n="m2h5"></h3>' +
            '<p class="outline-text" data-i18n="m2p5"></p></div>' +
            '</div></section>'
        );
    }

    function fixM2Context(mainRp, folder, seg, html) {
        return html
            .replace(
                'href="../../../index.html"',
                'href="' + esc(mainRp + 'index.html') + '"'
            )
            .replace(
                'href="../../../articles/ddj/index.html"',
                'href="' + esc(mainRp + 'articles/' + folder + '/index.html') + '"'
            );
    }

    function buildM3(site, chapterId) {
        return (
            chapterModuleTitleStrip('module3Title') +
            '<section class="content-section module-section">' +
            '<div class="container">' +
            buildM3TranslationsBlock(site, chapterId) +
            '<div class="outline-card m3-guide">' +
            '<h3 class="card-title m3-guide-title" data-i18n="m3block5"></h3>' +
            '<div class="guide-lead">' +
            '<p data-i18n="guideP1"></p>' +
            '<p data-i18n="guideP2"></p>' +
            '</div></div>' +
            '</div></section>'
        );
    }

    function fixM3Context(mainRp, folder, html) {
        return html
            .replace(
                'href="../../../index.html"',
                'href="' + esc(mainRp + 'index.html') + '"'
            )
            .replace(
                'href="../../../articles/ddj/index.html"',
                'href="' + esc(mainRp + 'articles/' + folder + '/index.html') + '"'
            );
    }

    function buildM4(chapterId) {
        const zh = workZhFlat(chapterId);
        let rows = '';
        for (let i = 1; i <= 24; i++) {
            const a = zh['termRow' + i + 'a'];
            const b = zh['termRow' + i + 'b'];
            if (
                (a == null || String(a).trim() === '') &&
                (b == null || String(b).trim() === '')
            )
                break;
            rows +=
                '<tr><td data-i18n="termRow' +
                i +
                'a"></td><td data-i18n="termRow' +
                i +
                'b"></td></tr>';
        }

        const notes = ['dao', 'ming', 'wu', 'you']
            .map(function (pre) {
                const icon =
                    pre === 'dao'
                        ? '道'
                        : pre === 'ming'
                          ? '名'
                          : pre === 'wu'
                            ? '无'
                            : '有';
                return (
                    '<div class="commentary-card">' +
                    '<div class="commentary-icon">' +
                    esc(icon) +
                    '</div>' +
                    '<h3 class="commentary-title" data-i18n="' +
                    pre +
                    'Title"></h3>' +
                    '<p class="commentary-text" data-i18n="' +
                    pre +
                    'Text"></p>' +
                    '</div>'
                );
            })
            .join('');

        const zhRubyLines =
            chapterId === 'ddj-1'
                ? [
                      '道可道也，非恒道也；名可名也，非恒名也。',
                      '无名，万物之始也；有名，万物之母也。',
                      '故恒无欲也，以观其妙；恒有欲也，以观其徼。',
                      '两者同出，异名同谓。玄之又玄，众妙之门。'
                  ]
                : [];
        const m4EsDaoCardBody =
            '<h4 class="commentary-title">Definición</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Dao:</strong> se refiere al origen último de todas las cosas y al funcionamiento mismo del mundo, algo que no puede ser descrito completamente con palabras.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Ejemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Es como si intentaras describir "el amor" o "el tiempo" solo con palabras: solo puedes experimentarlo. No es algo concreto ni puramente lógico; es algo omniabarcante, universal, que existe en la internalización del mundo entero y es la ley inherente al funcionamiento natural de las cosas.</li>' +
            '<li>Por ejemplo, cuando remas en un río turbulento, solo puedes avanzar con facilidad si sigues la dirección de la corriente. El río mismo es el "Dao". No ves todo el flujo, ni puedes explicar qué gota empuja el barco, pero percibes que está en todas partes y te impulsa.</li>' +
            '</ul>';
        const m4EsSinNombreCardBody =
            '<h3 class="block-heading">Sin nombre</h3>' +
            '<h4 class="commentary-title">Definición</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Sin nombre:</strong> se refiere al estado informe e indefinido de las cosas.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Ejemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Una semilla que aún no ha germinado, que aún no se ha convertido en "árbol", no podemos llamarla "árbol", pero ella es el inicio del árbol, su estado original.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Con nombre</h3>' +
            '<h4 class="commentary-title">Definición</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Con nombre:</strong> se refiere al estado en que las cosas son nombradas y reconocidas.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Ejemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Cuando la semilla brota y aparece una pequeña planta, la llamamos "plántula", le damos un nombre – esto es el "con nombre".</li>' +
            '</ul>';
        const m4EsSinDeseoCardBody =
            '<h3 class="block-heading">Sin deseo</h3>' +
            '<h4 class="commentary-title">Definición</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Sin deseo:</strong> significa una actitud sin intencionalidad, sin apego.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Ejemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Mirar por la ventana con un objetivo: buscar un restaurante, quejarse del ruido – ves tus propios deseos. Si dejas los objetivos y solo observas: la luz, las sombras, las hojas movidas por el viento – entonces realmente "ves" la sutileza de la calle.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Con deseo</h3>' +
            '<h4 class="commentary-title">Definición</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Con deseo:</strong> significa una actitud con propósito y exploración activa.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Ejemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Un científico estudia las leyes del cambio de las nubes para realizar una investigación concreta – eso es "observar sus límites" (propósito claro, fuerte intencionalidad).</li>' +
            '</ul>';
        const m4EsXuanCardBody =
            '<h3 class="block-heading">Xuan</h3>' +
            '<h4 class="commentary-title">Definición</h4>' +
            '<ul class="def-list">' +
            '<li><strong>"Xuan" (profundo/sutil)</strong> se refiere a un proceso de comprensión insondable y continuamente profundizado.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Ejemplo práctico</h4>' +
            '<ul class="def-list">' +
            '<li>El carácter "xuan" originalmente significa un nudo de seda suspendido que se balancea ligeramente – de ahí los significados de minúsculo, lejano, oscuro. "Tener nombre" y "no tener nombre" son como dos hilos de seda entrelazados. Los dos hilos se alternan, tal como los estados de "con nombre" y "sin nombre" se entrelazan. Así podemos observar las cosas desde las perspectivas de "con deseo" y "sin deseo" y penetrar en el misterio del origen.</li>' +
            '</ul>';

        const m4EsGroups = zhRubyLines
            .map(function (line, idx) {
                const cardBody =
                    idx === 1
                        ? m4EsSinNombreCardBody
                        : idx === 2
                          ? m4EsSinDeseoCardBody
                          : idx === 3
                            ? m4EsXuanCardBody
                            : m4EsDaoCardBody;
                const cardTitle = idx === 1 || idx === 2 || idx === 3 ? '' : '<h3 class="block-heading">Dao</h3>';
                return (
                    '<div class="m4-es-group">' +
                    '<p class="m4-zh-ruby han-ruby" lang="zh">' +
                    m3ZhLineWithRuby(line, 'ddj-1') +
                    '</p>' +
                    '<div class="text-card m4-es-note-card">' +
                    cardTitle +
                    cardBody +
                    '</div></div>'
                );
            })
            .join('');
        const m4EsSpecial =
            '<div data-m4-es-only hidden>' +
            '<div class="outline-card m4-es-dao-card">' +
            m4EsGroups +
            '</div></div>';
        const m4PtDaoCardBody =
            '<h3 class="block-heading">Dao</h3>' +
            '<h4 class="commentary-title">Definição</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Dao:</strong> refere-se à origem última de todas as coisas e ao modo de funcionamento do próprio mundo, algo que não pode ser totalmente descrito por palavras.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Assim como não se pode descrever completamente "amor" ou "tempo" com palavras, apenas experimentando-os. Não é algo concreto, nem puramente lógico; é algo abrangente, universal, que existe na internalização do mundo inteiro e é a lei inerente ao funcionamento natural das coisas.</li>' +
            '<li>Por exemplo, quando você rema num rio turbulento, só consegue avançar facilmente se seguir a direção da corrente. Aqui, o próprio rio é o "Dao". Você não vê todo o fluxo, nem consegue explicar qual gota de água empurra o barco, mas pode perceber que ele está em toda a parte e o impulsiona.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Nome constante</h3>' +
            '<h4 class="commentary-title">Definição</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Nome constante:</strong> refere-se a um conceito ou nome fixo e imutável que representa a própria coisa.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Água – podes chamá-la de "água", "H₂O" ou "water". Mas essas palavras não são o seu verdadeiro "nome constante" – porque gelo e vapor também são água, mas as palavras não molham a tua mão. A verdadeira "água" só pode ser sentida pelo paladar e pelo tato, não pode ser esgotada por nenhum nome.</li>' +
            '</ul>';
        const m4PtSemNomeCardBody =
            '<h3 class="block-heading">Sem nome</h3>' +
            '<h4 class="commentary-title">Definição</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Sem nome:</strong> refere-se ao estado informe e indefinido das coisas.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Uma semente ainda não germinou e não se tornou "árvore", mas já é o início da árvore.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Com nome</h3>' +
            '<h4 class="commentary-title">Definição</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Com nome:</strong> refere-se ao estado em que as coisas são nomeadas e reconhecidas.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Quando a semente brota e surge uma pequena planta, chamamo-la de "muda"; isso é o com nome.</li>' +
            '</ul>';
        const m4PtSemDesejoCardBody =
            '<h3 class="block-heading">Sem desejo</h3>' +
            '<h4 class="commentary-title">Definição</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Sem desejo:</strong> significa uma atitude sem intenção, sem apego.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Olhar pela janela com um objetivo: procurar um restaurante, irritar-se com o barulho – vês os teus próprios desejos. Largando os objetivos, apenas observas: a luz, as sombras, as folhas a mover-se ao vento – só então vês verdadeiramente a subtileza da rua.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Com desejo</h3>' +
            '<h4 class="commentary-title">Definição</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Com desejo:</strong> significa uma atitude com propósito e exploração activa.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplo</h4>' +
            '<ul class="def-list">' +
            '<li>Um cientista estuda as leis das mudanças das formas das nuvens para realizar uma determinada investigação – isto é "observar os seus limites" (propósito claro, forte objectividade).</li>' +
            '</ul>';
        const m4PtXuanCardBody =
            '<h3 class="block-heading">Xuan</h3>' +
            '<h4 class="commentary-title">Definição</h4>' +
            '<ul class="def-list">' +
            '<li><strong>"Xuan" (profundo/sutil):</strong> refere-se a um processo de compreensão insondável e continuamente aprofundado.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplo</h4>' +
            '<ul class="def-list">' +
            '<li>O carácter "xuan" originalmente significa um nó de seda suspenso, que balança ligeiramente – daí os significados de minúsculo, distante, obscuro. "Ter nome" e "não ter nome" são como dois fios de seda entrelaçados. Os dois fios alternam entre si, tal como o estado de "com nome" e "sem nome" se entrelaçam. Assim podemos observar as coisas sob as perspectivas de "com desejo" e "sem desejo" e penetrar no mistério da origem.</li>' +
            '</ul>';
        const m4PtGroups = zhRubyLines
            .map(function (line, idx) {
                const cardBody =
                    idx === 1
                        ? m4PtSemNomeCardBody
                        : idx === 2
                          ? m4PtSemDesejoCardBody
                          : idx === 3
                            ? m4PtXuanCardBody
                            : m4PtDaoCardBody;
                return (
                    '<div class="m4-es-group">' +
                    '<p class="m4-zh-ruby han-ruby" lang="zh">' +
                    m3ZhLineWithRuby(line, 'ddj-1') +
                    '</p>' +
                    '<div class="text-card m4-es-note-card">' +
                    cardBody +
                    '</div></div>'
                );
            })
            .join('');
        const m4PtSpecial =
            '<div data-m4-pt-only hidden>' +
            '<div class="outline-card m4-es-dao-card">' +
            m4PtGroups +
            '</div></div>';
        const m4ItDaoCardBody =
            '<h3 class="block-heading">Dao</h3>' +
            '<h4 class="commentary-title">Definizione</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Dao:</strong> indica l\'origine ultima delle cose e il modo in cui il mondo stesso opera, che non può essere completamente descritta a parole.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Esempio</h4>' +
            '<ul class="def-list">' +
            '<li>Come non si può descrivere del tutto "l\'amore" o "il tempo" con le parole, ma solo sentirli attraverso l\'esperienza. Non è concreto, non è logico-razionale, è onnicomprensivo e onnipresente. Si differenzia dalla separazione occidentale tra mondo dell\'esperienza e mondo delle idee; non usa l\'esperienza come semplice pretesto per una teoria che tende al bene sommo, ma è già interiorizzato nell\'intero mondo e non tocca mai la dualità di causa ed effetto. È la legge immanente del corso naturale delle cose.</li>' +
            '<li>Per esempio, quando remi in un fiume impetuoso, puoi avanzare facilmente solo se segui la corrente. Il fiume stesso è il "Dao". Non vedi l\'intera corrente e non puoi spiegare quale singola goccia spinga la barca, ma ne percepisci l\'onnipresenza che ti spinge avanti.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Nome Eterno</h3>' +
            '<h4 class="commentary-title">Definizione</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Nome Eterno:</strong> indica un concetto fisso che rappresenta le cose stesse.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Esempio</h4>' +
            '<ul class="def-list">' +
            '<li>Prendiamo l\'acqua. Puoi chiamarla "acqua", "H₂O" o "water". Ma nessuno di questi è il suo Nome Eterno. Perché anche il ghiaccio e il vapore sono acqua, e la parola non ti bagnerà la mano. La vera acqua può solo essere gustata e toccata -- nessun nome può esaurirla.</li>' +
            '</ul>';
        const m4ItSenzaNomeCardBody =
            '<h3 class="block-heading">Senza-nome</h3>' +
            '<h4 class="commentary-title">Definizione</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Senza-nome:</strong> indica lo stato in cui le cose non sono ancora formate né definite.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Esempio</h4>' +
            '<ul class="def-list">' +
            '<li>Un seme non è ancora germogliato, non è ancora diventato un "albero" -- non possiamo chiamarlo "albero", ma è l\'inizio dell\'albero, il suo stato originario.</li>' +
            '</ul>' +
            '<h3 class="block-heading">ha-nome</h3>' +
            '<h4 class="commentary-title">Definizione</h4>' +
            '<ul class="def-list">' +
            '<li><strong>ha-nome:</strong> indica lo stato in cui le cose vengono nominate e riconosciute.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Esempio</h4>' +
            '<ul class="def-list">' +
            '<li>Dopo che il seme è germogliato e ha prodotto un piccolo germoglio, lo chiamiamo "piantina" -- gli diamo un nome, questo è "ha-nome".</li>' +
            '</ul>';
        const m4ItDesioCardBody =
            '<h3 class="block-heading">Cessazione di desio</h3>' +
            '<h4 class="commentary-title">Definizione</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Cessazione di desio:</strong> indica un atteggiamento privo di scopi e attaccamenti.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Esempio</h4>' +
            '<ul class="def-list">' +
            '<li>Guardi fuori dalla finestra con uno scopo: cerchi un ristorante, ti dà fastidio il rumore -- vedi i tuoi desideri. Lascia perdere lo scopo, guarda e basta: la luce, le ombre, le foglie al vento -- solo allora vedrai davvero la sottile meraviglia della strada.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Desio</h3>' +
            '<h4 class="commentary-title">Definizione</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Desio:</strong> indica un atteggiamento con uno scopo osservativo e un\'esplorazione attiva.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Esempio</h4>' +
            '<ul class="def-list">' +
            '<li>Uno scienziato studia le leggi della formazione delle nuvole per completare una determinata ricerca -- questo significa "contempla il tratto manifesto". (Scopo chiaro, fortemente finalizzato.)</li>' +
            '</ul>';
        const m4ItArcanoCardBody =
            '<h3 class="block-heading">Arcano</h3>' +
            '<h4 class="commentary-title">Definizione</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Arcano:</strong> indica un processo di conoscenza insondabile che si approfondisce continuamente.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Esempio</h4>' +
            '<ul class="def-list">' +
            '<li>Il significato originario del carattere xuan (玄) è "fili di seta appesi", quei fili sottili che oscillano incerti -- da qui i significati di "minuscolo", "tenebroso". Lo stato "ha-nome" e lo stato "senza-nome" sono come due fili di seta intrecciati, che può continuare ad attorcigliarsi all\'infinito. L\'oscillazione alternata dei due fili -- ecco lo stato in cui possiamo osservare i diecimila esseri attraverso le due prospettive "nel desio" e "nella cessazione di desio", e così cogliere la radice del mistero.</li>' +
            '</ul>';
        const m4ItGroups = zhRubyLines
            .map(function (line, idx) {
                const cardBody =
                    idx === 1
                        ? m4ItSenzaNomeCardBody
                        : idx === 2
                          ? m4ItDesioCardBody
                          : idx === 3
                            ? m4ItArcanoCardBody
                            : m4ItDaoCardBody;
                return (
                    '<div class="m4-es-group">' +
                    '<p class="m4-zh-ruby han-ruby" lang="zh">' +
                    m3ZhLineWithRuby(line, 'ddj-1') +
                    '</p>' +
                    '<div class="text-card m4-es-note-card">' +
                    cardBody +
                    '</div></div>'
                );
            })
            .join('');
        const m4ItSpecial =
            '<div data-m4-it-only hidden>' +
            '<div class="outline-card m4-es-dao-card">' +
            m4ItGroups +
            '</div></div>';
        const m4DeWegCardBody =
            '<h3 class="block-heading">Weg</h3>' +
            '<h4 class="commentary-title">Definition</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Weg:</strong> bezeichnet die ultimative Quelle der Dinge und die Art und Weise, wie die Welt selbst funktioniert, die nicht vollständig mit Worten beschrieben werden kann.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Beispiel</h4>' +
            '<ul class="def-list">' +
            '<li>So wie man "Liebe" oder "Zeit" nicht vollständig mit Worten beschreiben kann, sondern nur durch Erfahrung fühlen kann. Es ist nicht konkret, nicht logisch-rational, es ist allumfassend und allgegenwärtig. Es unterscheidet sich von der westlichen Trennung zwischen Erfahrungswelt und Ideenwelt; es benutzt die Erfahrung nicht als bloßen Vorwand für eine Theorie, die auf das höchste Gut zielt, sondern es ist bereits in die gesamte Welt verinnerlicht und berührt nie die Dualität von Ursache und Wirkung. Es ist das immanente Gesetz des natürlichen Laufs der Dinge.</li>' +
            '<li>Zum Beispiel: Wenn du in einem reißenden Fluss ruderst, kannst du nur leicht vorankommen, wenn du der Strömung folgst. Der Fluss selbst ist das "Weg". Du siehst nicht die gesamte Strömung und kannst nicht erklären, welcher einzelne Tropfen das Boot schiebt, aber du spürst seine Allgegenwart, die dich vorantreibt.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Ewiger Name</h3>' +
            '<h4 class="commentary-title">Definition</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Ewiger Name:</strong> bezeichnet einen festen Begriff der die Dinge selbst repräsentiert.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Beispiel</h4>' +
            '<ul class="def-list">' +
            '<li>Nehmen wir das Wasser. Du kannst es "Wasser" oder "H₂O" oder "water" nennen. Aber keiner davon ist sein ewiger Name. Denn auch Eis und Dampf sind Wasser, und das Wort wird deine Hand nicht benetzen. Das wahre Wasser kann nur geschmeckt und berührt werden -- kein Name kann es ausschöpfen.</li>' +
            '</ul>';
        const m4DeOhneNameCardBody =
            '<h3 class="block-heading">Ohne Name</h3>' +
            '<h4 class="commentary-title">Definition</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Ohne Name:</strong> bezeichnet den Zustand, in dem die Dinge noch nicht geformt noch nicht definiert sind.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Beispiel</h4>' +
            '<ul class="def-list">' +
            '<li>Zum Beispiel: Ein Samen ist noch nicht gekeimt, noch nicht zu einem "Baum" geworden -- wir können ihn nicht "Baum" nennen, aber er ist der Beginn des Baumes, sein ursprünglicher Zustand.</li>' +
            '</ul>' +
            '<h3 class="block-heading">habe-Name</h3>' +
            '<h4 class="commentary-title">Definition</h4>' +
            '<ul class="def-list">' +
            '<li><strong>habe-Name:</strong> bezeichnet den Zustand, in dem die Dinge benannt und erkannt werden.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Beispiel</h4>' +
            '<ul class="def-list">' +
            '<li>Zum Beispiel: Nachdem der Samen gekeimt ist und einen kleinen Keimling hervorgebracht hat, nennen wir ihn "Pflänzchen" --- wir geben ihm einen Namen, das ist "habe-Name".</li>' +
            '</ul>';
        const m4DeBegehrenCardBody =
            '<h3 class="block-heading">ohne Begehren</h3>' +
            '<h4 class="commentary-title">Definition</h4>' +
            '<ul class="def-list">' +
            '<li><strong>ohne Begehren:</strong> bezeichnet eine Haltung ohne Ziele und ohne Anhaftungen.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Beispiel</h4>' +
            '<ul class="def-list">' +
            '<li>Zum Beispiel: Du schaust mit einem Ziel aus dem Fenster: Du suchst ein Restaurant, der Lärm stört dich -- du siehst deine Begierden. Lass das Ziel fallen, schau einfach: das Licht, die Schatten, die Blätter im Wind -- erst dann wirst du wirklich das feine Wunder der Straße sehen.</li>' +
            '</ul>' +
            '<h3 class="block-heading">hat Begehren</h3>' +
            '<h4 class="commentary-title">Definition</h4>' +
            '<ul class="def-list">' +
            '<li><strong>hat Begehren:</strong> bezeichnet eine Haltung mit einem Beobachtungsziel und einer aktiven Erforschung.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Beispiel</h4>' +
            '<ul class="def-list">' +
            '<li>Zum Beispiel: Ein Wissenschaftler erforscht die Gesetze der Wolkenbildung, um eine bestimmte Studie abzuschließen --- das bedeutet "schaut seine offenbarte Spur". (Klares Ziel, stark zielgerichtet.)</li>' +
            '</ul>';
        const m4DeMystischCardBody =
            '<h3 class="block-heading">Mystisch</h3>' +
            '<h4 class="commentary-title">Definition</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Geheimnis (Mystisch):</strong> bezeichnet einen unergründlichen Erkenntnisprozess, der sich ständig vertieft.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Beispiel</h4>' +
            '<ul class="def-list">' +
            '<li>Zum Beispiel: Die ursprüngliche Bedeutung des Schriftzeichens xuan 玄 ist "hängende Seidenfäden" die feinen unsicher flatternden Fäden daher die Bedeutungen "winzig düster". Der Zustand "habe-Name" und der Zustand "ohne-Name" sind wie zwei miteinander verflochtene Seidenfäden, die sich endlos weiterdrehen können. Das wechselseitige Schwingen der beiden Fäden --- das ist der Zustand, in dem wir die zehntausend Wesen durch die beiden Perspektiven "ohne Begehren" und "hat Begehren" betrachten und so die Wurzel des Geheimnisses erfassen können.</li>' +
            '</ul>';
        const m4DeGroups = zhRubyLines
            .map(function (line, idx) {
                const cardBody =
                    idx === 1
                        ? m4DeOhneNameCardBody
                        : idx === 2
                          ? m4DeBegehrenCardBody
                          : idx === 3
                            ? m4DeMystischCardBody
                            : m4DeWegCardBody;
                return (
                    '<div class="m4-es-group">' +
                    '<p class="m4-zh-ruby han-ruby" lang="zh">' +
                    m3ZhLineWithRuby(line, 'ddj-1') +
                    '</p>' +
                    '<div class="text-card m4-es-note-card">' +
                    cardBody +
                    '</div></div>'
                );
            })
            .join('');
        const m4DeSpecial =
            '<div data-m4-de-only hidden>' +
            '<div class="outline-card m4-es-dao-card">' +
            m4DeGroups +
            '</div></div>';
        const m4ZhDaoCardBody =
            '<h3 class="block-heading">道</h3>' +
            '<h4 class="commentary-title">释义</h4>' +
            '<ul class="def-list">' +
            '<li><strong>道：</strong>指的是事物的终极来源和世界本身的运作方式，是无法用语言完全描述的。</li>' +
            '</ul>' +
            '<h4 class="commentary-title">举例和阐释</h4>' +
            '<ul class="def-list">' +
            '<li>就像你无法用语言完全描述「爱情」或「时间」，只能通过体验感受它。它不是具象的，有理性逻辑的，它是包罗万象的，普遍存在的，它本身就存在于整个世界的内化之中，是事物自然运行的内在规律。</li>' +
            '<li>比如，你在一条湍急的河流中划船，只有顺着水流的方向才能轻松前进。此时，河流本身就是「道」，你看不到水流的全部，也无法解释究竟是哪一滴水推动了船，却能感知到它无处不在，推动你前行。</li>' +
            '</ul>' +
            '<h3 class="block-heading">恒名</h3>' +
            '<h4 class="commentary-title">释义</h4>' +
            '<ul class="def-list">' +
            '<li><strong>恒名：</strong>指的是固定不变的概念名称，代表事物本身。</li>' +
            '</ul>' +
            '<h4 class="commentary-title">举例</h4>' +
            '<ul class="def-list">' +
            '<li>水，你可以叫它「水」、「H₂O」或「water」。但这些词都不是它真正的「恒名」——因为冰和蒸汽也是水，词语却打不湿你的手。真正的「水」只能被尝到、摸到，无法被任何名字说尽。</li>' +
            '</ul>';
        const m4ZhWuMingCardBody =
            '<h3 class="block-heading">无名</h3>' +
            '<h4 class="commentary-title">释义</h4>' +
            '<ul class="def-list">' +
            '<li><strong>无名：</strong>指事物未成形、未被定义的状态。</li>' +
            '</ul>' +
            '<h4 class="commentary-title">举例</h4>' +
            '<ul class="def-list">' +
            '<li>一棵种子还未发芽，还没有长成「树」，所以我们不能叫它「树」，但它是树的开始，是树的原始状态。</li>' +
            '</ul>' +
            '<h3 class="block-heading">有名</h3>' +
            '<h4 class="commentary-title">释义</h4>' +
            '<ul class="def-list">' +
            '<li><strong>有名：</strong>指事物被命名、被认识的状态。</li>' +
            '</ul>' +
            '<h4 class="commentary-title">举例</h4>' +
            '<ul class="def-list">' +
            '<li>种子在初期长出新芽之后，我们叫它「幼苗」，赋予它名字，这就是「有名」。</li>' +
            '</ul>';
        const m4ZhYuCardBody =
            '<h3 class="block-heading">无欲</h3>' +
            '<h4 class="commentary-title">释义</h4>' +
            '<ul class="def-list">' +
            '<li><strong>无欲：</strong>指不带目的、不执着的心态。</li>' +
            '</ul>' +
            '<h4 class="commentary-title">举例</h4>' +
            '<ul class="def-list">' +
            '<li>带着目的看窗外：想找餐厅、嫌太吵——你看到的是自己的欲望。放下目的，只是单纯地看：光线、影子、风吹树叶——你才真正「看到」了这条街道的微妙。</li>' +
            '</ul>' +
            '<h3 class="block-heading">有欲</h3>' +
            '<h4 class="commentary-title">释义</h4>' +
            '<ul class="def-list">' +
            '<li><strong>有欲：</strong>指带着观察目的、主动探索。</li>' +
            '</ul>' +
            '<h4 class="commentary-title">举例</h4>' +
            '<ul class="def-list">' +
            '<li>科学家研究云的形态变化规律，是为了完成某项科学研究，就是「观其所徼」。（目的明确，有很强的目标性）</li>' +
            '</ul>';
        const m4ZhXuanCardBody =
            '<h3 class="block-heading">玄</h3>' +
            '<h4 class="commentary-title">释义</h4>' +
            '<ul class="def-list">' +
            '<li><strong>玄：</strong>指深不可测、不断深化的理解过程。</li>' +
            '</ul>' +
            '<h4 class="commentary-title">举例</h4>' +
            '<ul class="def-list">' +
            '<li>「玄」字本义指悬挂的丝结，细细的丝结晃动不定，因此申引出了微小、幽远的意思。「有名」和「无名」就像两股缠绕在一起的丝线。两股线来回交替切换，正如「有名」和「无名」相互缠绕的状态，我们就可以用「有欲」和「无欲」两种视角去观察万物，领悟到根源的奥秘。</li>' +
            '</ul>';
        const m4ZhGroups = zhRubyLines
            .map(function (line, idx) {
                const cardBody =
                    idx === 1
                        ? m4ZhWuMingCardBody
                        : idx === 2
                          ? m4ZhYuCardBody
                          : idx === 3
                            ? m4ZhXuanCardBody
                            : m4ZhDaoCardBody;
                return (
                    '<div class="m4-es-group">' +
                    '<p class="m4-zh-ruby han-ruby" lang="zh">' +
                    m3ZhLineWithRuby(line, 'ddj-1') +
                    '</p>' +
                    '<div class="text-card m4-es-note-card">' +
                    cardBody +
                    '</div></div>'
                );
            })
            .join('');
        const m4ZhSpecial =
            '<div data-m4-zh-only hidden>' +
            '<div class="outline-card m4-es-dao-card">' +
            m4ZhGroups +
            '</div></div>';
        const m4LaViaCardBody =
            '<h3 class="block-heading">Via</h3>' +
            '<h4 class="commentary-title">Definitio</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Dao:</strong> ad originem universi et veritatem ultimam refertur, quae verbis plene describi non potest.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplum</h4>' +
            '<ul class="def-list">' +
            '<li>Sicut "amor" aut "tempus" verbis plene describi non potest, sed solum experiri et sentire. Non est concretum nec rationi subiectum; omnia complectitur et ubique praesens est. A divisione Occidentali inter mundum empiricum et mundum formarum differt; experientia non ut praetextu ad theoriam utitur, quae ad summam virtutem ducit, sed potius in ipsa essentia totius mundi exsistit, numquam implicans necessitudines causarum et effectuum mundi dualistici.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Nomen aeternum</h3>' +
            '<h4 class="commentary-title">Definitio</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Nomen aeternum:</strong> ad designationes conceptuales fixas et immutabiles refertur.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplum</h4>' +
            '<ul class="def-list">' +
            '<li>Nomen "aqua" ad H₂O referri potest, tamen in diversis temperaturis glacies, aqua liquida, aut vapor esse potest; nomen fixum manet dum forma mutatur. Tamen reapse adhuc "aqua" est, et hae formae omnes ex aqua derivantur.</li>' +
            '</ul>';
        const m4LaSineNomineCardBody =
            '<h3 class="block-heading">Sine nomine</h3>' +
            '<h4 class="commentary-title">Definitio</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Anonymitas:</strong> ad statum rei pertinet antequam formam acceperit aut definita sit.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplum</h4>' +
            '<ul class="def-list">' +
            '<li>Semen nondum germinavit et nondum in "arborem" crevit, itaque id "arborem" appellare non possumus, sed est initium arboris, status primordialis arboris.</li>' +
            '</ul>' +
            '<h3 class="block-heading">Cum nomine</h3>' +
            '<h4 class="commentary-title">Definitio</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Nominata:</strong> ad statum rei pertinet quae nominata et agnita est.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplum</h4>' +
            '<ul class="def-list">' +
            '<li>Semen semel in primis gradibus germinaverit, id "germen" appellamus et nomen ei damus; hoc est "nomen habere".</li>' +
            '</ul>';
        const m4LaCupiditateCardBody =
            '<h3 class="block-heading">Sine cupiditate</h3>' +
            '<h4 class="commentary-title">Definitio</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Sine cupiditate:</strong> ad animum sine proposito aut studio refert.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplum</h4>' +
            '<ul class="def-list">' +
            '<li>Cum quiete sedens nubes spectas, sine ullo certo proposito, potes potius mirabilia naturae admirari. (Nullum est certum propositum; agitur simpliciter de experiendo.)</li>' +
            '</ul>' +
            '<h3 class="block-heading">Cum cupiditate</h3>' +
            '<h4 class="commentary-title">Definitio</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Cupidus:</strong> ad observandum cum proposito et explorandum actuose refert.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplum</h4>' +
            '<ul class="def-list">' +
            '<li>Scientista qui formas nubium formationis studet, id facit ad perficiendum inceptum investigationis scientificae; hoc est "limites eius observare". (Propositum clarum est, cum forti sensu directionis.)</li>' +
            '</ul>';
        const m4LaProfundumCardBody =
            '<h3 class="block-heading">Profundum</h3>' +
            '<h4 class="commentary-title">Definitio</h4>' +
            '<ul class="def-list">' +
            '<li><strong>Profundum:</strong> ad processum intellegendi pertinet qui est incomprehensibilis et semper profundior.</li>' +
            '</ul>' +
            '<h4 class="commentary-title">Exemplum</h4>' +
            '<ul class="def-list">' +
            '<li>In physica, a mechanica Newtoniana ad relativitatem et deinde ad mechanica quantica, unumquodque gradus profundior "intellegentiae" significat aliud "mysterium in mysterio". Tamen, "mysterium" hic tractatum non exsistit intra scientias naturales, neque ad profunditatem logicae et rationis, sicut in philosophia Occidentali invenitur, pertinet; immo, ad statum refert in quo "nihilitas" et "esse" simul exsistunt — status qui est flexibilis, fluens, fallax, sed tamen ubique praesens.</li>' +
            '</ul>';
        const m4LaGroups = zhRubyLines
            .map(function (line, idx) {
                const cardBody =
                    idx === 1
                        ? m4LaSineNomineCardBody
                        : idx === 2
                          ? m4LaCupiditateCardBody
                          : idx === 3
                            ? m4LaProfundumCardBody
                            : m4LaViaCardBody;
                return (
                    '<div class="m4-es-group">' +
                    '<p class="m4-zh-ruby han-ruby" lang="zh">' +
                    m3ZhLineWithRuby(line, 'ddj-1') +
                    '</p>' +
                    '<div class="text-card m4-es-note-card">' +
                    cardBody +
                    '</div></div>'
                );
            })
            .join('');
        const m4LaSpecial =
            '<div data-m4-la-only hidden>' +
            '<div class="outline-card m4-es-dao-card">' +
            m4LaGroups +
            '</div></div>';
        const m4Default =
            '<div data-m4-default>' +
            '<h3 class="block-heading" data-i18n="m4tableTitle"></h3>' +
            '<div class="text-card term-table-wrap">' +
            '<table class="term-table"><thead><tr>' +
            '<th data-i18n="termTh1"></th><th data-i18n="termTh2"></th>' +
            '</tr></thead><tbody>' +
            rows +
            '</tbody></table></div>' +
            '<h3 class="block-heading" data-i18n="m4notesTitle"></h3>' +
            '<div class="commentary-grid">' +
            notes +
            '</div></div>';

        return (
            chapterModuleTitleStrip('module4Title') +
            '<section class="culture-section module-section">' +
            '<div class="container">' +
            m4Default +
            m4ZhSpecial +
            m4EsSpecial +
            m4PtSpecial +
            m4ItSpecial +
            m4DeSpecial +
            m4LaSpecial +
            '</div></section>'
        );
    }

    function attachM4SpanishLayout(mainEl, chapterId) {
        if (!mainEl || chapterId !== 'ddj-1') return;
        const apply = function (lang) {
            const current =
                lang ||
                (function () {
                    const btn = document.querySelector('.lang-btn.active');
                    return btn ? btn.getAttribute('data-lang') : 'zh';
                })();
            const showZh = current === 'zh';
            const showEs = current === 'es';
            const showPt = current === 'pt';
            const showIt = current === 'it';
            const showDe = current === 'de';
            const showLa = current === 'la';
            const showSpecial = showZh || showEs || showPt || showIt || showDe || showLa;
            mainEl.querySelectorAll('[data-m4-default]').forEach(function (el) {
                if (showSpecial) el.setAttribute('hidden', '');
                else el.removeAttribute('hidden');
            });
            mainEl.querySelectorAll('[data-m4-zh-only]').forEach(function (el) {
                if (showZh) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m4-es-only]').forEach(function (el) {
                if (showEs) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m4-pt-only]').forEach(function (el) {
                if (showPt) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m4-it-only]').forEach(function (el) {
                if (showIt) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m4-de-only]').forEach(function (el) {
                if (showDe) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m4-la-only]').forEach(function (el) {
                if (showLa) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
        };
        apply();
        if (mainEl.dataset.m4EsBound === '1') return;
        mainEl.dataset.m4EsBound = '1';
        window.addEventListener('hanqiao:ui-lang', function (ev) {
            const lang = ev && ev.detail ? ev.detail.lang : '';
            apply(lang);
        });
    }

    function fixCtx(html, mainRp, folder) {
        return html
            .replace(
                'href="../../../index.html"',
                'href="' + esc(mainRp + 'index.html') + '"'
            )
            .replace(
                'href="../../../articles/ddj/index.html"',
                'href="' + esc(mainRp + 'articles/' + folder + '/index.html') + '"'
            );
    }

    function buildM5(chapterId) {
        const zh = workZhFlat(chapterId);
        let latinRows = '';
        for (let i = 1; i <= 12; i++) {
            const c1 = zh['latinR' + i + 'c1'];
            if (c1 == null || String(c1).trim() === '') break;
            latinRows +=
                '<tr>' +
                '<td data-i18n="latinR' +
                i +
                'c1"></td>' +
                '<td data-i18n="latinR' +
                i +
                'c2"></td>' +
                '<td data-i18n-html="latinR' +
                i +
                'c3"></td>' +
                '<td data-i18n="latinR' +
                i +
                'c4"></td>' +
                '</tr>';
        }

        let diffBlocks = '';
        for (let j = 1; j <= 12; j++) {
            const h = zh['diff' + j + 'h'];
            if (h == null || String(h).trim() === '') break;
            diffBlocks +=
                '<div class="diff-item">' +
                '<h4 data-i18n="diff' +
                j +
                'h"></h4>' +
                '<p data-i18n-html="diff' +
                j +
                'p1"></p>' +
                '<p data-i18n-html="diff' +
                j +
                'p2"></p>' +
                '</div>';
        }

        const m5EsQuestionsCard =
            '<div class="latin-card" data-m5-es-only hidden>' +
            '<h3 class="card-title">Preguntas reflexivas interculturales</h3>' +
            '<p class="commentary-text">1. ¿Qué puede explicarlo todo, el origen último del mundo? Muchos filósofos han dado respuestas: agua, éter, logos, ser, idea – generalmente son realidades últimas inmutables, estáticas, que pueden ser definidas, explicadas y analizadas por el lenguaje. Laozi, sin embargo, afirma desde el principio que el Dao no puede ser fijado por palabras o conceptos. ¿Es acaso de la misma naturaleza que lo que entendemos por "principio originario"? ¿Puedes imaginar un principio dinámico, no sustancial, que sea más como el proceso de funcionamiento de todas las cosas?</p>' +
            '<p class="commentary-text">2. En la tradición bíblica, Dios nombra todas las cosas, y el lenguaje tiene una certeza sagrada y definitiva. La filosofía griega antigua también creía que, una vez dada la definición correcta (logos), podríamos aprehender la esencia de las cosas. Laozi, sin embargo, dice: "el nombre que puede ser nombrado no es el nombre constante" – cualquier nombre es temporal y relativo. En tu opinión: ¿el lenguaje es insuficiente para capturar la verdad, o la verdad misma contiene una dimensión inefable?</p>' +
            '<p class="commentary-text">3. La filosofía occidental valora especialmente el razonamiento lógico y el análisis racional ("pienso, luego existo"), mientras que el primer capítulo propone: "constantemente sin deseo para observar la sutileza; constantemente con deseo para observar los límites". El "observar" (guan) se acerca más a una percepción directa y experiencial, no a una deducción conceptual. ¿Crees que "estar sin presuposiciones (sin deseo)" es un requisito para conocer el origen? Si el propio análisis racional es ya un estado de "con deseo", ¿puede la filosofía acoger ambos caminos?</p>' +
            '</div>';
        const m5PtQuestionsCard =
            '<div class="latin-card" data-m5-pt-only hidden>' +
            '<h3 class="card-title">Perguntas reflexivas interculturais</h3>' +
            '<p class="commentary-text">1. O que pode explicar tudo, a origem última do mundo? Muitos filósofos deram respostas: água, éter, logos, ser, ideia – geralmente são realidades últimas imutáveis, estáticas, que podem ser definidas, explicadas e analisadas pela linguagem. Laozi logo no início afirma que o Dao não pode ser fixado por palavras ou conceitos. Será que ele é ainda da mesma natureza que aquilo que entendemos por "princípio originário"? Consegues imaginar um princípio dinâmico, não substancial, que seja mais como o processo de funcionamento de todas as coisas?</p>' +
            '<p class="commentary-text">2. Na tradição bíblica, Deus nomeia todas as coisas, e a linguagem tem uma certeza sagrada e definitiva. A filosofia grega antiga também acreditava que, uma vez dada a definição correcta (logos), poderíamos apreender a essência das coisas. Laozi, porém, diz: "o nome que pode ser dado não é o nome constante" – qualquer nome é temporário e relativo. Na tua opinião: a linguagem é insuficiente para capturar a verdade, ou a própria verdade contém uma dimensão inefável?</p>' +
            '<p class="commentary-text">3. A filosofia ocidental valoriza especialmente o raciocínio lógico e a análise racional ("penso, logo existo"), enquanto o primeiro capítulo propõe: "constantemente sem desejo para observar a subtileza; constantemente com desejo para observar os limites". O "observar" (guan) está mais próximo de uma percepção directa e experiencial, não de uma dedução conceptual. Achas que "estar sem pressupostos (sem desejo)" é um pré-requisito para conhecer a origem? Se a própria análise racional já é um estado de "com desejo", será que a filosofia pode acolher ambos os caminhos?</p>' +
            '</div>';
        const m5ItQuestionsCard =
            '<div class="latin-card" data-m5-it-only hidden>' +
            '<h3 class="card-title">Domande riflessive interculturali</h3>' +
            '<p class="commentary-text">1. Qual è la radice ultima e onnisplicativa del mondo? Molti filosofi hanno dato le loro risposte: acqua, etere, logos, essere, idea -- si tratta spesso di realtà ultime immutabili, definite, spiegabili e analizzabili tramite il linguaggio. Eppure Laozi apre il suo testo dicendo che il Dao non può essere fissato da parole e concetti. Esso appartiene allora alla stessa categoria di ciò che intendiamo per "arché"? Riesci a immaginare un\'arché dinamica, non sostanziale, più simile a un processo che regola il divenire di tutte le cose?</p>' +
            '<p class="commentary-text">2. Nella tradizione biblica, Dio dà nome a tutte le cose, e il linguaggio possiede una certezza divina; anche la filosofia greca antica crede che, una volta fornita la definizione corretta (il logos), si possa afferrare l\'essenza delle cose. Laozi, invece, afferma: "nome che può essere nominato, Nome Eterno non è" -- ogni denominazione è provvisoria e relativa. Secondo te, è il linguaggio a non essere in grado di catturare la verità, o è la verità stessa a contenere una dimensione di indicibilità?</p>' +
            '<p class="commentary-text">3. La filosofia occidentale attribuisce grande importanza al ragionamento logico e all\'analisi razionale (il "cogito"), mentre il primo capitolo del Daodejing propone: "Sicché, nella costante cessazione di desio, se Ne contempla il prodigio, e nel costante desio se Ne contempla il tratto manifesto". "Contemplare" (guan) è più vicino a un\'intuizione diretta e sapienziale che a un\'elaborazione concettuale. Pensi che "non avere presupposti" (nella cessazione di desio) sia la precondizione per conoscere l\'arché? Se l\'analisi razionale è già di per sé uno stato di "avere desideri", è possibile per la filosofia accogliere entrambe le vie?</p>' +
            '</div>';
        const m5DeQuestionsCard =
            '<div class="latin-card" data-m5-de-only hidden>' +
            '<h3 class="card-title">Interkulturelle Reflexionsfragen</h3>' +
            '<p class="commentary-text">1. Was ist der letzte und allein erklärende Grund der Welt? Viele Philosophen haben ihre Antworten gegeben: Wasser, Äther, Logos, Sein, Idee -- es handelt sich oft um unveränderliche, definierte, erklärbare und durch Sprache analysierbare letzte Wirklichkeiten. Doch Laozi eröffnet seinen Text mit der Aussage, dass das Weg nicht durch Worte und Begriffe fixiert werden kann. Gehört es dann derselben Kategorie an wie das, was wir unter "Arché" verstehen? Kannst du dir eine dynamische, nicht substantielle Arché vorstellen, die eher einem Prozess gleicht, der das Werden aller Dinge regelt?</p>' +
            '<p class="commentary-text">2. In der biblischen Tradition gibt Gott allen Dingen Namen, und die Sprache besitzt eine göttliche Gewissheit; auch die antike griechische Philosophie glaubt, dass man, sobald die richtige Definition (der Logos) gegeben ist, das Wesen der Dinge erfassen könne. Laozi dagegen sagt: "Könnten wir nennen den Namen, Es wäre kein ewiger Name" -- jede Benennung ist vorläufig und relativ. Meinst du, dass die Sprache nicht in der Lage ist, die Wahrheit einzufangen, oder dass die Wahrheit selbst eine Dimension der Unaussprechlichkeit enthält?</p>' +
            '<p class="commentary-text">3. Die westliche Philosophie misst dem logischen Denken und der rationalen Analyse (dem "Cogito") große Bedeutung bei, während das erste Kapitel des Daodejing vorschlägt: "Wer ewig ohne Begehren, Wird das Geheimste schaun; Wer ewig hat Begehren, Erblickt nur seinen Saum". "Schaun" (guan) ist eher einer direkten, weisheitlichen Intuition verwandt als einer begrifflichen Ausarbeitung. Glaubst du, dass "keine Voraussetzungen haben" (ohne Begehren) die Vorbedingung ist, um die Arché zu erkennen? Wenn die rationale Analyse an sich schon ein Zustand des "hat Begehrens" ist, kann die Philosophie dann beide Wege aufnehmen?</p>' +
            '</div>';
        const m5ZhQuestionsCard =
            '<div class="latin-card" data-m5-zh-only hidden>' +
            '<h3 class="card-title">跨文化反思问题</h3>' +
            '<p class="commentary-text">1. 能解释一切的、世界的最终极的根源是什么？许多哲学家都进行过回答。比如水、以太、逻各斯、存在、理念，它们往往是不变不动，可以被语言定义、解释和分析的终极实在。而老子开篇便说，道是不能用语言和概念固定下来的，那么它和我们所理解的「本原」还是同一类东西吗？你能否想象一种动态的、非实体性的、更像是一切事物运行的过程的本原呢？</p>' +
            '<p class="commentary-text">2. 《圣经》传统中，上帝命名万物，语言具有神圣的确定性；古希腊哲学也相信，一旦我们给出正确的定义（逻各斯），就能把握事物的本质。老子却说「名可名，非常名」——任何命名都是暂时的、相对的。你认为：是语言不足以捕捉真理，还是真理本身就包含不可言说的维度？</p>' +
            '<p class="commentary-text">3. 西方哲学尤其重视逻辑推理和理性分析（「我思」），而第一章提出「恒无欲也，以观其妙；恒有欲也，以观其徼」。「观」更接近一种直接的、体悟式的觉察，而非概念推演。你是否认为「不带着预设（无欲）」才是认识本原的前提？如果理性分析本身已经是一种「有欲」的状态，哲学是否可能同时接纳两种道路？</p>' +
            '</div>';
        const m5LaQuestionsCard =
            '<div class="latin-card" data-m5-la-only hidden>' +
            '<h3 class="card-title">Quaestiones reflexivae interculturales</h3>' +
            '<p class="commentary-text">1. Quid est ultima radix et explicatio omnium rerum? Multi philosophi responsa dederunt: aqua, aether, logos, esse, idea — saepe realitates ultimae immutabiles, definitae, per linguam explicabiles. Laozi autem statim affirmat Dao verbis et notionibus fixari non posse. An eandem naturam habet ac id quod "arché" nominamus? Num dynamicam, non substantialem arché imaginari potes, magis similem processui quo omnia fiunt?</p>' +
            '<p class="commentary-text">2. In traditione biblica Deus omnibus rebus nomina imponit, et lingua certitudinem divinam habet; philosophia Graeca antiqua etiam credit, definitione recta (logos) data, essentiam rerum comprehendi posse. Laozi contra dicit: "nomen quod nominari potest, non est nomen aeternum" — omnis denominatio temporalis et relativa est. Utrum lingua incapax est veritatem capiendi, an ipsa veritas dimensionem ineffabilitatis continet?</p>' +
            '<p class="commentary-text">3. Philosophia Occidentalis magni ponderis rationem logicam et analysin rationalem ("cogito") habet, cum primum capitulum proponat: constanter sine cupiditate mysterium contemplari, constanter cum cupiditate fines observare. "Contemplari" (guan) magis ad intuitionem directam quam ad deductionem conceptualem accedit. An "sine praesuppositionibus esse" (sine cupiditate) praerequisitum est ad arché cognoscendam? Si ipsa analysis rationalis iam status "cum cupiditate" est, num philosophia utramque viam accipere potest?</p>' +
            '</div>';

        return (
            chapterModuleTitleStrip('module5Title') +
            '<section class="latin-section module-section">' +
            '<div class="container">' +
            '<div class="latin-card summary-card">' +
            '<h3 class="card-title" data-i18n="m6title"></h3>' +
            '<ul class="summary-list" data-i18n-html="m6list"></ul>' +
            '</div>' +
            m5ZhQuestionsCard +
            m5EsQuestionsCard +
            m5PtQuestionsCard +
            m5ItQuestionsCard +
            m5DeQuestionsCard +
            m5LaQuestionsCard +
            '<div class="latin-card lex-cultural-panel">' +
            '<h3 class="card-title" data-i18n="lexPanelTitle"></h3>' +
            '<p class="lex-panel-meta"><span class="lex-chip" data-i18n="lexExampleBadge"></span></p>' +
            '<article class="lex-pair-card" aria-labelledby="lex-pair-h1">' +
            '<header class="lex-pair-head" id="lex-pair-h1">' +
            '<span class="lex-pair-num" data-i18n="lexPair1Badge"></span>' +
            '<div class="lex-pair-row">' +
            '<span class="lex-han" data-i18n="lexPair1Han"></span>' +
            '<span class="lex-pair-connector" aria-hidden="true">↔</span>' +
            '<div class="lex-romance-block" data-i18n-html="lexPair1Words"></div>' +
            '</div></header>' +
            '<dl class="lex-dim-list">' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimShape"></dt><dd data-i18n-html="lexPair1Shape"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimSound"></dt><dd data-i18n-html="lexPair1Sound"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimSense"></dt><dd data-i18n-html="lexPair1Sense"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimEmotion"></dt><dd data-i18n-html="lexPair1Emotion"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimCulture"></dt><dd data-i18n-html="lexPair1Culture"></dd></div>' +
            '</dl></article>' +
            '<article class="lex-pair-card" aria-labelledby="lex-pair-h2">' +
            '<header class="lex-pair-head" id="lex-pair-h2">' +
            '<span class="lex-pair-num" data-i18n="lexPair2Badge"></span>' +
            '<div class="lex-pair-row">' +
            '<span class="lex-han" data-i18n="lexPair2Han"></span>' +
            '<span class="lex-pair-connector" aria-hidden="true">↔</span>' +
            '<div class="lex-romance-block" data-i18n-html="lexPair2Words"></div>' +
            '</div></header>' +
            '<dl class="lex-dim-list">' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimShape"></dt><dd data-i18n-html="lexPair2Shape"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimSound"></dt><dd data-i18n-html="lexPair2Sound"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimSense"></dt><dd data-i18n-html="lexPair2Sense"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimEmotion"></dt><dd data-i18n-html="lexPair2Emotion"></dd></div>' +
            '<div class="lex-dim-row"><dt data-i18n="lexDimCulture"></dt><dd data-i18n-html="lexPair2Culture"></dd></div>' +
            '</dl></article>' +
            '</div>' +
            '<div class="latin-content">' +
            '<div class="latin-card">' +
            '<h3 class="card-title" data-i18n="latinCompareTitle"></h3>' +
            '<table class="latin-table"><thead><tr>' +
            '<th data-i18n="latinTh1"></th>' +
            '<th data-i18n="latinTh2"></th>' +
            '<th data-i18n="latinTh3"></th>' +
            '<th data-i18n="latinTh4"></th>' +
            '</tr></thead><tbody>' +
            latinRows +
            '</tbody></table></div>' +
            '<div class="latin-card">' +
            '<h3 class="card-title" data-i18n="latinDiffTitle"></h3>' +
            '<div class="diff-analysis">' +
            diffBlocks +
            '</div></div></div></div></section>'
        );
    }

    function attachM5SpanishQuestions(mainEl, chapterId) {
        if (!mainEl || chapterId !== 'ddj-1') return;
        const apply = function (lang) {
            const current =
                lang ||
                (function () {
                    const btn = document.querySelector('.lang-btn.active');
                    return btn ? btn.getAttribute('data-lang') : 'zh';
                })();
            const showZh = current === 'zh';
            const showEs = current === 'es';
            const showPt = current === 'pt';
            const showIt = current === 'it';
            const showDe = current === 'de';
            const showLa = current === 'la';
            mainEl.querySelectorAll('[data-m5-zh-only]').forEach(function (el) {
                if (showZh) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m5-es-only]').forEach(function (el) {
                if (showEs) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m5-pt-only]').forEach(function (el) {
                if (showPt) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m5-it-only]').forEach(function (el) {
                if (showIt) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m5-de-only]').forEach(function (el) {
                if (showDe) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
            mainEl.querySelectorAll('[data-m5-la-only]').forEach(function (el) {
                if (showLa) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
        };
        apply();
        if (mainEl.dataset.m5EsBound === '1') return;
        mainEl.dataset.m5EsBound = '1';
        window.addEventListener('hanqiao:ui-lang', function (ev) {
            const lang = ev && ev.detail ? ev.detail.lang : '';
            apply(lang);
        });
    }

    function renderModule(body) {
        const site = window.LITERATURE_SITE;
        const folder = body.getAttribute('data-literature-work-folder');
        const seg = body.getAttribute('data-literature-chapter-segment');
        const chapterId = body.getAttribute('data-work-id');
        const mod = body.getAttribute('data-literature-module') || 'm1';
        const depth = parseInt(body.getAttribute('data-literature-root-depth') || '3', 10);
        const mainRp = rootPrefix(depth);

        const work = findWork(site, folder);
        const chapter = findChapter(work, chapterId);
        const navHost = document.getElementById('hanqiao-literature-dynamic-nav');
        const mainEl = document.getElementById('hanqiao-literature-main');
        if (!work || !chapter || !navHost || !mainEl) return;

        const moduleTitleKeys = {
            m1: 'module1Title',
            m2: 'module2Title',
            m3: 'module3Title',
            m4: 'module4Title',
            m5: 'module5Title'
        };

        mountChapterNav(navHost, {
            chapters: work.chapters || [],
            fromSegment: seg,
            navBaseFile: mod + '.html',
            activeModule: mod,
            contextHtml: buildModuleArticleContext(
                mainRp,
                folder,
                moduleTitleKeys[mod] || 'module1Title'
            )
        });

        let inner = '';
        if (mod === 'm1')
            inner = buildM1(mainRp, folder, seg, chapterId, site);
        else if (mod === 'm2')
            inner = fixM2Context(mainRp, folder, seg, buildM2(site, chapterId));
        else if (mod === 'm3')
            inner = fixM3Context(mainRp, folder, buildM3(site, chapterId));
        else if (mod === 'm4') inner = fixCtx(buildM4(chapterId), mainRp, folder);
        else if (mod === 'm5') inner = fixCtx(buildM5(chapterId), mainRp, folder);
        else inner = fixCtx(buildM5(chapterId), mainRp, folder);

        mainEl.innerHTML = inner;
        mountLiteratureChapterExtensions();
        if (mod === 'm3') attachM3TranslationSwitcher(mainEl);
        if (mod === 'm4') attachM4SpanishLayout(mainEl, chapterId);
        if (mod === 'm5') attachM5SpanishQuestions(mainEl, chapterId);

        const foot = document.getElementById('hanqiao-footer-context-link');
        if (foot) {
            let nextMod = 'm2';
            let nextKey = 'navM2';
            if (mod === 'm1') {
                nextMod = 'm2';
                nextKey = 'navM2';
            } else if (mod === 'm2') {
                nextMod = 'm3';
                nextKey = 'navM3';
            } else if (mod === 'm3') {
                nextMod = 'm4';
                nextKey = 'navM4';
            } else if (mod === 'm4') {
                nextMod = 'm5';
                nextKey = 'navM5';
            } else if (mod === 'm5') {
                nextMod = 'index';
                nextKey = 'hubPageTitle';
            } else {
                nextMod = 'm1';
                nextKey = 'navM1';
            }
            foot.href = nextMod === 'index' ? 'index.html' : nextMod + '.html';
            foot.setAttribute('data-i18n', nextKey);
        }
    }

    function run() {
        const body = document.body;
        if (!body || !body.classList.contains('page-literature-dynamic')) return;
        const page = body.getAttribute('data-literature-page');
        if (page === 'work-overview') renderWorkOverview(body);
        else if (page === 'chapter-hub') renderChapterHub(body);
        else if (page === 'module') renderModule(body);
    }

    document.addEventListener('DOMContentLoaded', run);

    document.addEventListener('click', function (e) {
        const btn = e.target.closest('.m3-trans-tab');
        if (!btn) return;
        const root = btn.closest('#hanqiao-m3-trans-root');
        if (!root) return;
        const lang = btn.getAttribute('data-m3-trans-lang');
        if (!lang) return;
        e.preventDefault();
        m3ActivateTransLang(root, lang);
    });
})();
