/**
 * 汉学桥文献录入后台 · 可视化四语种必填 + 一键发布（依赖同源 server/index.js 文献接口）
 */
(function () {
    'use strict';

    var LANGS = ['zh', 'es', 'pt', 'it'];
    var LANG_LABEL = { zh: '中文', es: 'Español', pt: 'Português', it: 'Italiano' };
    var LANG_CN = { zh: '中文', es: '西班牙语', pt: '葡萄牙语', it: '意大利语' };

    var SESSION_SECRET_KEY = 'hanqiao-admin-bearer-v1';
    var DRAFT_KEY = 'hanqiao-lit-admin-draft-v5';

    var state = { literatureSite: null, workCopy: null };
    var tabsInited = false;
    var draftTimer = null;

    function $(id) {
        return document.getElementById(id);
    }

    function trim(s) {
        return s == null ? '' : String(s).trim();
    }

    function deepClone(o) {
        return JSON.parse(JSON.stringify(o));
    }

    function escAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    function escHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/"/g, '&quot;');
    }

    function getSecret() {
        return sessionStorage.getItem(SESSION_SECRET_KEY) || '';
    }

    function setStatus(msg) {
        var el = $('adminStatus');
        if (el) el.textContent = msg || '';
    }

    function setConn(msg) {
        var el = $('adminConnStatus');
        if (el) el.textContent = msg || '';
    }

    function showErrors(list) {
        var ul = $('adminErrors');
        if (!ul) return;
        if (!list || !list.length) {
            ul.hidden = true;
            ul.innerHTML = '';
            return;
        }
        ul.hidden = false;
        ul.innerHTML = list.map(function (t) {
            return '<li>' + escHtml(t) + '</li>';
        }).join('');
    }

    function apiFetch(method, url, bodyObj) {
        return fetch(url, {
            method: method,
            headers: {
                Authorization: 'Bearer ' + getSecret(),
                'Content-Type': 'application/json'
            },
            body: bodyObj ? JSON.stringify(bodyObj) : undefined
        }).then(function (r) {
            return r.text().then(function (txt) {
                var j = {};
                try {
                    j = txt ? JSON.parse(txt) : {};
                } catch (e) {
                    j = {};
                }
                if (!r.ok) throw new Error(j.error || txt || 'HTTP ' + r.status);
                return j;
            });
        });
    }

    function getWiCi() {
        var wi = parseInt($('workSelect') && $('workSelect').value, 10) || 0;
        var ci = parseInt($('chapterSelect') && $('chapterSelect').value, 10) || 0;
        return { wi: wi, ci: ci };
    }

    function currentWorkChapter() {
        var site = state.literatureSite;
        var x = getWiCi();
        var work = site && site.works && site.works[x.wi];
        var ch = work && work.chapters && work.chapters[x.ci];
        return { work: work, ch: ch, wi: x.wi, ci: x.ci };
    }

    function ensureChapterBag(chId) {
        state.workCopy = state.workCopy || {};
        if (!state.workCopy[chId]) {
            state.workCopy[chId] = { zh: {}, es: {}, pt: {}, it: {} };
        }
        var bag = state.workCopy[chId];
        LANGS.forEach(function (L) {
            bag[L] = bag[L] || {};
        });
        return bag;
    }

    function alignChapterLangKeys(chId) {
        var bag = ensureChapterBag(chId);
        var keys = Object.keys(bag.zh || {}).slice().sort();
        LANGS.forEach(function (L) {
            keys.forEach(function (k) {
                if (bag[L][k] === undefined) bag[L][k] = '';
            });
            Object.keys(bag[L]).forEach(function (k) {
                if (keys.indexOf(k) === -1) delete bag[L][k];
            });
        });
    }

    function globalTemplateZhKeys() {
        var w0 = state.literatureSite && state.literatureSite.works && state.literatureSite.works[0];
        var ch0 = w0 && w0.chapters && w0.chapters[0];
        if (ch0 && state.workCopy && state.workCopy[ch0.id] && state.workCopy[ch0.id].zh) {
            return Object.keys(state.workCopy[ch0.id].zh).slice();
        }
        return [
            'workShelfTitle',
            'hubPageTitle',
            'hubPageSub',
            'hubIntro',
            'module1Subtitle',
            'module2Subtitle',
            'module3Subtitle',
            'module4Subtitle',
            'module5Subtitle'
        ];
    }

    function blankLayersFromKeys(keys) {
        var zh = {};
        keys.forEach(function (k) {
            zh[k] = '';
        });
        function layer() {
            var o = {};
            keys.forEach(function (k) {
                o[k] = '';
            });
            return o;
        }
        return { zh: zh, es: layer(), pt: layer(), it: layer() };
    }

    function FIELD_TITLE(k) {
        var m;
        var map = {
            workShelfTitle: '书架显示书名（短）',
            hubPageTitle: '本章导读页 · 大标题',
            hubPageSub: '本章导读页 · 副标题',
            hubIntro: '本章导读页 · 导语',
            hubCardTitle1: '导读卡片 · 模块一标题',
            hubCardDesc1: '导读卡片 · 模块一说明',
            hubCardTitle2: '导读卡片 · 模块二标题',
            hubCardDesc2: '导读卡片 · 模块二说明',
            hubCardTitle3: '导读卡片 · 模块三标题',
            hubCardDesc3: '导读卡片 · 模块三说明',
            hubCardTitle4: '导读卡片 · 模块四标题',
            hubCardDesc4: '导读卡片 · 模块四说明',
            hubCardTitle5: '导读卡片 · 模块五标题',
            hubCardDesc5: '导读卡片 · 模块五说明',
            module1Subtitle: '模块一 · 小标题',
            module2Subtitle: '模块二 · 小标题',
            module3Subtitle: '模块三 · 小标题',
            module4Subtitle: '模块四 · 小标题',
            module5Subtitle: '模块五 · 小标题',
            m2h2: '模块二 · 板块标题（字词释义）',
            m2h3: '模块二 · 板块标题（分层解读）',
            m2h4: '模块二 · 板块标题（哲学内涵）',
            m2h5: '模块二 · 板块标题（文化背景）',
            m3block1: '模块三 · 原文区块标题',
            m3block5: '模块三 · 导读区块标题',
            guideP1: '模块三 · 导读段落一',
            guideP2: '模块三 · 导读段落二',
            m4tableTitle: '模块四 · 术语表标题',
            m4notesTitle: '模块四 · 文化注释总标题',
            termTh1: '术语表 · 列标题（术语）',
            termTh2: '术语表 · 列标题（释义）',
            m6title: '模块五 · 要点列表标题',
            m6list: '模块五 · 要点列表（可用 HTML 列表）',
            latinCompareTitle: '拉丁语族对照 · 表标题',
            latinDiffTitle: '文化思维差异 · 标题',
            lexPanelTitle: '词汇专项对照 · 标题',
            lexPanelLead: '词汇专项对照 · 导语（可用简单 HTML）',
            lexExampleBadge: '词汇示例 · 角标',
            lexPair1Badge: '对照示例一 · 角标',
            lexPair2Badge: '对照示例二 · 角标',
            lexDimShape: '对照维度 · 字形',
            lexDimSound: '对照维度 · 字音',
            lexDimSense: '对照维度 · 词义',
            lexDimEmotion: '对照维度 · 情感',
            lexDimCulture: '对照维度 · 文化',
            latinTh1: '拉丁对照表 · 列1',
            latinTh2: '拉丁对照表 · 列2',
            latinTh3: '拉丁对照表 · 列3',
            latinTh4: '拉丁对照表 · 列4',
            daoTitle: '文化注释 · 「道」标题',
            daoText: '文化注释 · 「道」正文',
            mingTitle: '文化注释 · 「名」标题',
            mingText: '文化注释 · 「名」正文',
            wuTitle: '文化注释 · 「无」标题',
            wuText: '文化注释 · 「无」正文',
            youTitle: '文化注释 · 「有」标题',
            youText: '文化注释 · 「有」正文'
        };
        if (map[k]) return map[k];
        if ((m = /^m2d(\d+)t$/.exec(k))) return '白话词条 ' + m[1] + ' · 词条标题';
        if ((m = /^m2d(\d+)b$/.exec(k))) return '白话词条 ' + m[1] + ' · 释义正文';
        if ((m = /^m2l(\d+)t$/.exec(k))) return '分层解读 ' + m[1] + ' · 小标题';
        if ((m = /^m2l(\d+)b$/.exec(k))) return '分层解读 ' + m[1] + ' · 正文';
        if ((m = /^m2p(\d+)$/.exec(k))) return '模块二 · 长文段落 ' + m[1];
        if ((m = /^termRow(\d+)a$/.exec(k))) return '术语表 · 第 ' + m[1] + ' 行 · 术语';
        if ((m = /^termRow(\d+)b$/.exec(k))) return '术语表 · 第 ' + m[1] + ' 行 · 释义';
        if ((m = /^latinR(\d+)c(\d)$/.exec(k))) return '拉丁对照 · 第 ' + m[1] + ' 行 · 列 ' + m[2];
        if ((m = /^diff(\d+)h$/.exec(k))) return '思维差异 · 第 ' + m[1] + ' 条 · 标题';
        if ((m = /^diff(\d+)p(\d)$/.exec(k))) return '思维差异 · 第 ' + m[1] + ' 条 · 段落 ' + m[2];
        if ((m = /^lexPair(\d+)Han$/.exec(k))) return '词汇对照 · 示例 ' + m[1] + ' · 汉字词';
        if ((m = /^lexPair(\d+)Words$/.exec(k))) return '词汇对照 · 示例 ' + m[1] + ' · 西葡意词（可用 HTML）';
        if ((m = /^lexPair(\d+)(Shape|Sound|Sense|Emotion|Culture)$/.exec(k))) {
            var dim = { Shape: '字形', Sound: '字音', Sense: '词义', Emotion: '情感', Culture: '文化' };
            return '词汇对照 · 示例 ' + m[1] + ' · ' + (dim[m[2]] || m[2]);
        }
        return '正文条目「' + k + '」';
    }

    function syncSelectors() {
        var workSel = $('workSelect');
        var chSel = $('chapterSelect');
        if (!workSel || !chSel) return;
        workSel.innerHTML = '';
        (state.literatureSite.works || []).forEach(function (w, i) {
            var opt = document.createElement('option');
            opt.value = String(i);
            opt.textContent = (w.title && w.title.zh) || w.id || '文献 ' + (i + 1);
            workSel.appendChild(opt);
        });
        var wi = parseInt(workSel.value, 10) || 0;
        var work = state.literatureSite.works && state.literatureSite.works[wi];
        chSel.innerHTML = '';
        if (work && work.chapters) {
            work.chapters.forEach(function (ch, j) {
                var opt = document.createElement('option');
                opt.value = String(j);
                opt.textContent = (ch.title && ch.title.zh) || ch.segment || ch.id;
                chSel.appendChild(opt);
            });
        }
    }

    function updateReadonlyDisp() {
        var ctx = currentWorkChapter();
        $('dispWorkId').textContent = (ctx.work && ctx.work.id) || '—';
        $('dispWorkFolder').textContent = (ctx.work && ctx.work.folder) || '—';
        $('dispChId').textContent = (ctx.ch && ctx.ch.id) || '—';
        $('dispChSegment').textContent = (ctx.ch && ctx.ch.segment) || '—';
        if ($('fieldKeywords') && ctx.work) $('fieldKeywords').value = ctx.work.keywords || '';
    }

    function syncCurrentChapterFromDOM() {
        var ctx = currentWorkChapter();
        if (!ctx.work || !ctx.ch) return;
        var work = ctx.work;
        var ch = ctx.ch;
        work.keywords = $('fieldKeywords') ? trim($('fieldKeywords').value) : '';

        LANGS.forEach(function (L) {
            work.title = work.title || {};
            work.summary = work.summary || {};
            ch.title = ch.title || {};
            ch.summary = ch.summary || {};

            var ti = document.querySelector('[data-struct="workTitle"][data-lang="' + L + '"]');
            var su = document.querySelector('[data-struct="workSummary"][data-lang="' + L + '"]');
            var ct = document.querySelector('[data-struct="chapterTitle"][data-lang="' + L + '"]');
            var cs = document.querySelector('[data-struct="chapterSummary"][data-lang="' + L + '"]');
            if (ti) work.title[L] = trim(ti.value);
            if (su) work.summary[L] = trim(su.value);
            if (ct) ch.title[L] = trim(ct.value);
            if (cs) ch.summary[L] = trim(cs.value);
        });

        var bag = ensureChapterBag(ch.id);
        LANGS.forEach(function (L) {
            document.querySelectorAll('[data-copy-key][data-lang="' + L + '"]').forEach(function (el) {
                var k = el.getAttribute('data-copy-key');
                bag[L][k] = trim(el.value);
            });
        });

        state.literatureSite.modulesByChapterId = state.literatureSite.modulesByChapterId || {};
        var mods = state.literatureSite.modulesByChapterId[ch.id] || {};
        var m1ta = document.querySelector('[data-struct="m1Lines"]');
        var m3ta = document.querySelector('[data-struct="m3Original"]');
        if (m1ta) {
            var lines = m1ta.value.split(/\r?\n/).map(trim).filter(Boolean);
            mods.m1 = { paragraphs: lines };
        }
        if (m3ta) {
            var t = trim(m3ta.value);
            mods.m3 = { originalParagraphs: t ? [t] : [] };
        }
        state.literatureSite.modulesByChapterId[ch.id] = mods;
    }

    function scheduleDraft() {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(function () {
            try {
                syncCurrentChapterFromDOM();
                localStorage.setItem(
                    DRAFT_KEY,
                    JSON.stringify({ literatureSite: state.literatureSite, workCopy: state.workCopy })
                );
                setStatus('已自动保存草稿到本浏览器。');
            } catch (e) {
                setStatus('草稿保存失败（浏览器可能禁止本地存储）。');
            }
        }, 700);
    }

    function bindDraftOn(container) {
        if (!container) return;
        container.addEventListener('input', scheduleDraft);
        container.addEventListener('change', scheduleDraft);
    }

    function ensureLangTabs() {
        if (tabsInited) return;
        tabsInited = true;
        var tabs = $('langTabs');
        var panels = $('langPanels');
        tabs.innerHTML = '';
        panels.innerHTML = '';
        LANGS.forEach(function (L, idx) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'admin-tab' + (idx === 0 ? ' is-active' : '');
            b.textContent = LANG_LABEL[L];
            b.setAttribute('data-lang-tab', L);
            tabs.appendChild(b);

            var p = document.createElement('div');
            p.className = 'admin-tab-panel' + (idx === 0 ? ' is-active' : '');
            p.setAttribute('data-lang-panel', L);
            panels.appendChild(p);
            bindDraftOn(p);
        });
        tabs.addEventListener('click', function (ev) {
            var t = ev.target.closest('[data-lang-tab]');
            if (!t) return;
            var lang = t.getAttribute('data-lang-tab');
            tabs.querySelectorAll('.admin-tab').forEach(function (el) {
                el.classList.toggle('is-active', el === t);
            });
            panels.querySelectorAll('.admin-tab-panel').forEach(function (el) {
                el.classList.toggle('is-active', el.getAttribute('data-lang-panel') === lang);
            });
        });
        bindDraftOn($('editorCard'));
    }

    function renderLangPanel(L) {
        var panel = document.querySelector('[data-lang-panel="' + L + '"]');
        if (!panel) return;
        var ctx = currentWorkChapter();
        if (!ctx.work || !ctx.ch) {
            panel.innerHTML = '<p class="admin-steps">请先选择文献与章节。</p>';
            return;
        }
        alignChapterLangKeys(ctx.ch.id);
        var work = ctx.work;
        var ch = ctx.ch;
        var bag = state.workCopy[ch.id];
        var mods = state.literatureSite.modulesByChapterId[ch.id] || {};

        var html = '';

        html +=
            '<div class="admin-copy-block"><h3>书名 · ' +
            escHtml(LANG_LABEL[L]) +
            '<span class="admin-badge-req">必填</span></h3>' +
            '<div class="admin-field"><label>书名<span class="admin-badge-req">必填</span></label>' +
            '<input type="text" data-struct="workTitle" data-lang="' +
            L +
            '" value="' +
            escAttr((work.title && work.title[L]) || '') +
            '"></div></div>';

        html +=
            '<div class="admin-copy-block"><h3>本书简介 · ' +
            escHtml(LANG_LABEL[L]) +
            '<span class="admin-badge-req">必填</span></h3>' +
            '<textarea class="admin-area-lg" data-struct="workSummary" data-lang="' +
            L +
            '">' +
            escHtml((work.summary && work.summary[L]) || '') +
            '</textarea></div>';

        html +=
            '<div class="admin-copy-block"><h3>本章标题 · ' +
            escHtml(LANG_LABEL[L]) +
            '<span class="admin-badge-req">必填</span></h3>' +
            '<div class="admin-field"><label>本章标题<span class="admin-badge-req">必填</span></label>' +
            '<input type="text" data-struct="chapterTitle" data-lang="' +
            L +
            '" value="' +
            escAttr((ch.title && ch.title[L]) || '') +
            '"></div>' +
            '<div class="admin-field"><label>本章简介<span class="admin-badge-req">必填</span></label>' +
            '<textarea class="admin-area-lg" data-struct="chapterSummary" data-lang="' +
            L +
            '">' +
            escHtml((ch.summary && ch.summary[L]) || '') +
            '</textarea></div></div>';

        if (L === 'zh') {
            var m1 = mods.m1 && mods.m1.paragraphs ? mods.m1.paragraphs.join('\n') : '';
            var m3t =
                mods.m3 && mods.m3.originalParagraphs && mods.m3.originalParagraphs.length
                    ? mods.m3.originalParagraphs.join('\n')
                    : '';
            html +=
                '<div class="admin-copy-block"><h3>模块一 · 古文原文（仅中文录入）<span class="admin-badge-req">必填</span></h3>' +
                '<p class="admin-field-hint">每一句<strong>单独一行</strong>；保存后会按行分段显示在网页上。</p>' +
                '<textarea class="admin-area-lg" data-struct="m1Lines" rows="10">' +
                escHtml(m1) +
                '</textarea></div>';
            html +=
                '<div class="admin-copy-block"><h3>模块三 · 中文原文参照（仅中文录入）<span class="admin-badge-req">必填</span></h3>' +
                '<p class="admin-field-hint">一整段即可；用作模块三左侧对照。</p>' +
                '<textarea class="admin-area-lg" data-struct="m3Original" rows="8">' +
                escHtml(m3t) +
                '</textarea></div>';
        } else {
            html +=
                '<div class="admin-copy-block"><p class="admin-field-hint"><strong>古文原文</strong>与<strong>模块三中文参照</strong>只在「中文」页填写；此处请专注填写本语种正文条目。</p></div>';
        }

        var keys = sortedKeys(bag.zh);
        keys.forEach(function (key) {
            var val = (bag[L] && bag[L][key]) || '';
            html +=
                '<div class="admin-copy-block"><h3>' +
                escHtml(FIELD_TITLE(key)) +
                '<span class="admin-badge-req">必填</span></h3>' +
                '<p class="admin-field-hint">内部键名：<code>' +
                escHtml(key) +
                '</code> · 允许简单 HTML 的字段请沿用本站示例格式。</p>' +
                '<textarea rows="4" data-copy-key="' +
                escAttr(key) +
                '" data-lang="' +
                L +
                '" class="admin-area-lg">' +
                escHtml(val) +
                '</textarea></div>';
        });

        panel.innerHTML = html;
    }

    function sortedKeys(obj) {
        function rank(k) {
            if (/^hub/i.test(k)) return 10;
            if (/^module/i.test(k)) return 20;
            if (/^m2/i.test(k)) return 30;
            if (/^m3|^guide/i.test(k)) return 40;
            if (/^term|^dao|^ming|^wu|^you|^m4/i.test(k)) return 45;
            if (/^latin|^diff|^lex|^m6/i.test(k)) return 50;
            return 70;
        }
        return Object.keys(obj || {})
            .slice()
            .sort(function (a, b) {
                var g = rank(a) - rank(b);
                if (g !== 0) return g;
                return a.localeCompare(b);
            });
    }

    function refreshLangPanels() {
        LANGS.forEach(function (L) {
            renderLangPanel(L);
        });
        updatePreviewControls();
    }

    function updatePreviewControls() {
        var sel = $('previewModule');
        if (!sel) return;
        sel.innerHTML =
            '<option value="index.html">导读 hub（index）</option>' +
            '<option value="m1.html">模块一 · 古文</option>' +
            '<option value="m2.html">模块二 · 白话</option>' +
            '<option value="m3.html">模块三 · 原文与导读</option>' +
            '<option value="m4.html">模块四 · 术语</option>' +
            '<option value="m5.html">模块五 · 跨文化</option>';
    }

    function previewUrl() {
        var ctx = currentWorkChapter();
        if (!ctx.work || !ctx.ch) return '';
        var mod = ($('previewModule') && $('previewModule').value) || 'm1.html';
        var origin = window.location.origin;
        return (
            origin +
            '/articles/' +
            encodeURIComponent(ctx.work.folder) +
            '/' +
            encodeURIComponent(ctx.ch.segment) +
            '/' +
            mod.split('/').map(encodeURIComponent).join('/')
        );
    }

    function reloadPreview() {
        var fr = $('previewFrame');
        if (!fr) return;
        var u = previewUrl();
        if (!u) return;
        fr.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
    }

    function validateAll() {
        var errs = [];
        var site = state.literatureSite;
        if (!site || !Array.isArray(site.works)) {
            errs.push('内部错误：没有文献数据。');
            return errs;
        }
        site.works.forEach(function (work) {
            if (!trim(work.keywords)) {
                errs.push('文献「' + (work.folder || work.id) + '」缺少检索关键词。');
            }
            LANGS.forEach(function (L) {
                if (!trim(work.title && work.title[L])) {
                    errs.push(
                        '文献「' +
                            (work.folder || work.id) +
                            '」缺少 ' +
                            LANG_CN[L] +
                            ' 书名。'
                    );
                }
                if (!trim(work.summary && work.summary[L])) {
                    errs.push(
                        '文献「' +
                            (work.folder || work.id) +
                            '」缺少 ' +
                            LANG_CN[L] +
                            ' 本书简介。'
                    );
                }
            });

            (work.chapters || []).forEach(function (ch) {
                LANGS.forEach(function (L) {
                    if (!trim(ch.title && ch.title[L])) {
                        errs.push(
                            '章节「' +
                                ch.segment +
                                '」缺少 ' +
                                LANG_CN[L] +
                                ' 本章标题。'
                        );
                    }
                    if (!trim(ch.summary && ch.summary[L])) {
                        errs.push(
                            '章节「' +
                                ch.segment +
                                '」缺少 ' +
                                LANG_CN[L] +
                                ' 本章简介。'
                        );
                    }
                });

                alignChapterLangKeys(ch.id);
                var bag = state.workCopy[ch.id];
                if (!bag || !bag.zh) {
                    errs.push('章节「' + ch.segment + '」缺少文案数据。');
                    return;
                }
                sortedKeys(bag.zh).forEach(function (key) {
                    LANGS.forEach(function (L) {
                        var v = bag[L] && bag[L][key];
                        if (!trim(v)) {
                            errs.push(
                                '章节「' +
                                    ch.segment +
                                    '」：请填写 ' +
                                    LANG_CN[L] +
                                    ' 的「' +
                                    FIELD_TITLE(key) +
                                    '」（键 ' +
                                    key +
                                    '）。'
                            );
                        }
                    });
                });

                var mods = site.modulesByChapterId && site.modulesByChapterId[ch.id];
                var m1 = mods && mods.m1 && mods.m1.paragraphs;
                if (!m1 || !m1.length || !trim(m1[0])) {
                    errs.push('章节「' + ch.segment + '」：模块一古文请至少录入一行（中文页）。');
                }
                var m3 = mods && mods.m3 && mods.m3.originalParagraphs;
                if (!m3 || !m3.length || !trim(m3[0])) {
                    errs.push('章节「' + ch.segment + '」：模块三中文参照不能为空（中文页）。');
                }
            });
        });
        return errs;
    }

    function nextWorkIndex() {
        var works = state.literatureSite.works || [];
        var max = 0;
        works.forEach(function (w) {
            var m = /^work-(\d+)$/.exec(w.id || '');
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
        return max + 1;
    }

    function addChapter() {
        syncCurrentChapterFromDOM();
        var ctx = currentWorkChapter();
        var work = ctx.work;
        if (!work) return;
        work.chapters = work.chapters || [];
        var n = work.chapters.length + 1;
        var cid = work.id + '-' + n;
        var seg = 'chapter-' + n;
        work.chapters.push({
            id: cid,
            segment: seg,
            title: { zh: '', es: '', pt: '', it: '' },
            summary: { zh: '', es: '', pt: '', it: '' }
        });
        var keys = templateZhKeysFromWork(work);
        state.workCopy[cid] = blankLayersFromKeys(keys);
        state.literatureSite.modulesByChapterId = state.literatureSite.modulesByChapterId || {};
        state.literatureSite.modulesByChapterId[cid] = {
            m1: { paragraphs: [] },
            m3: { originalParagraphs: [] }
        };
        syncSelectors();
        $('chapterSelect').value = String(work.chapters.length - 1);
        updateReadonlyDisp();
        refreshLangPanels();
        setStatus('已新增一章：四个语种都要填写完整后再发布。');
    }

    function templateZhKeysFromWork(work) {
        var first = work.chapters && work.chapters[0];
        if (first && state.workCopy[first.id] && state.workCopy[first.id].zh) {
            return Object.keys(state.workCopy[first.id].zh).slice();
        }
        return globalTemplateZhKeys();
    }

    function addWork() {
        syncCurrentChapterFromDOM();
        var n = nextWorkIndex();
        var wid = 'work-' + n;
        var folder = 'work-' + n;
        var keys = globalTemplateZhKeys();
        var cid = wid + '-1';
        state.literatureSite.works = state.literatureSite.works || [];
        state.literatureSite.works.push({
            id: wid,
            folder: folder,
            title: { zh: '', es: '', pt: '', it: '' },
            summary: { zh: '', es: '', pt: '', it: '' },
            keywords: '',
            chapters: [
                {
                    id: cid,
                    segment: 'chapter-1',
                    title: { zh: '', es: '', pt: '', it: '' },
                    summary: { zh: '', es: '', pt: '', it: '' }
                }
            ]
        });
        state.workCopy[cid] = blankLayersFromKeys(keys);
        state.literatureSite.modulesByChapterId = state.literatureSite.modulesByChapterId || {};
        state.literatureSite.modulesByChapterId[cid] = {
            m1: { paragraphs: [] },
            m3: { originalParagraphs: [] }
        };
        syncSelectors();
        $('workSelect').value = String(state.literatureSite.works.length - 1);
        $('chapterSelect').value = '0';
        updateReadonlyDisp();
        refreshLangPanels();
        setStatus('已新增文献：请在四个语种下填写书名与第一章全部条目，然后可继续「新增章节」。');
    }

    function showEditorShell(show) {
        $('editorCard').hidden = !show;
        $('langCard').hidden = !show;
        $('previewCard').hidden = !show;
        $('draftCard').hidden = !show;
        $('stickyBar').hidden = !show;
    }

    function loadFromServer() {
        var sec = trim($('adminSecretInput') && $('adminSecretInput').value);
        if (sec) {
            sessionStorage.setItem(SESSION_SECRET_KEY, sec);
        }
        if (!getSecret()) {
            setConn('请先填写管理员密钥。');
            return;
        }
        setConn('正在从服务器读取…');
        return apiFetch('GET', '/api/admin/literature', null)
            .then(function (data) {
                state.literatureSite = data.literatureSite;
                state.workCopy = data.workCopy || {};
                state.literatureSite.version = state.literatureSite.version != null ? state.literatureSite.version : 1;
                ensureLangTabs();
                syncSelectors();
                updateReadonlyDisp();
                refreshLangPanels();
                showEditorShell(true);
                setConn('已连接服务器，内容已载入。');
                showErrors([]);
            })
            .catch(function (e) {
                setConn('读取失败：' + e.message + '（请确认已在 server 目录运行 npm start，且密钥正确）。');
                showEditorShell(false);
            });
    }

    function publish() {
        syncCurrentChapterFromDOM();
        showErrors([]);
        var errs = validateAll();
        if (errs.length) {
            showErrors(errs);
            setStatus('发布已阻止：请先修正以上 ' + errs.length + ' 项。');
            return;
        }
        setStatus('正在保存到网站…');
        apiFetch('POST', '/api/admin/literature', {
            literatureSite: state.literatureSite,
            workCopy: state.workCopy
        })
            .then(function () {
                setStatus('发布成功：前台刷新页面即可看到最新内容。');
                showErrors([]);
                reloadPreview();
            })
            .catch(function (e) {
                setStatus('发布失败：' + e.message);
            });
    }

    document.addEventListener('DOMContentLoaded', function () {
        $('btnSaveSecret').addEventListener('click', function () {
            var sec = trim($('adminSecretInput').value);
            if (!sec) {
                setConn('密钥不能为空。');
                return;
            }
            sessionStorage.setItem(SESSION_SECRET_KEY, sec);
            setConn('密钥已保存在本浏览器，请点击「从网站读取最新内容」。');
        });

        $('btnLoadServer').addEventListener('click', loadFromServer);

        $('btnDraftSave').addEventListener('click', function () {
            syncCurrentChapterFromDOM();
            try {
                localStorage.setItem(
                    DRAFT_KEY,
                    JSON.stringify({ literatureSite: state.literatureSite, workCopy: state.workCopy })
                );
                setStatus('草稿已手动保存。');
            } catch (e) {
                setStatus('草稿保存失败。');
            }
        });

        $('btnDraftRestore').addEventListener('click', function () {
            try {
                var raw = localStorage.getItem(DRAFT_KEY);
                if (!raw) {
                    setStatus('没有找到草稿。');
                    return;
                }
                var d = JSON.parse(raw);
                state.literatureSite = d.literatureSite;
                state.workCopy = d.workCopy;
                ensureLangTabs();
                syncSelectors();
                updateReadonlyDisp();
                refreshLangPanels();
                showEditorShell(true);
                setStatus('已从本机恢复草稿（尚未代替服务器上的正式稿）。');
            } catch (e) {
                setStatus('草稿损坏，无法恢复。');
            }
        });

        $('btnDiscardLocal').addEventListener('click', function () {
            loadFromServer();
        });

        $('btnPublish').addEventListener('click', publish);

        $('workSelect').addEventListener('change', function () {
            syncCurrentChapterFromDOM();
            syncSelectors();
            $('chapterSelect').value = '0';
            updateReadonlyDisp();
            refreshLangPanels();
        });

        $('chapterSelect').addEventListener('change', function () {
            syncCurrentChapterFromDOM();
            updateReadonlyDisp();
            refreshLangPanels();
        });

        $('btnAddChapter').addEventListener('click', addChapter);
        $('btnAddWork').addEventListener('click', addWork);

        $('btnPreviewRefresh').addEventListener('click', reloadPreview);
        $('previewModule').addEventListener('change', reloadPreview);
        $('btnPreviewOpen').addEventListener('click', function () {
            var u = previewUrl();
            if (u) window.open(u + '?t=' + Date.now(), '_blank');
        });

        if ($('adminSecretInput') && getSecret()) {
            $('adminSecretInput').value = getSecret();
        }

        if (getSecret()) {
            loadFromServer();
        } else {
            setConn('请输入密钥后保存，再读取网站内容。');
        }
    });
})();
