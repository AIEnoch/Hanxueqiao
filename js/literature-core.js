/**
 * 文献动态站点 · 核心工具（检索索引生成、转义等）
 * 依赖：先加载 data/literature-site.js（提供 window.LITERATURE_SITE 与 window.WORK_COPY）
 */
(function () {
    'use strict';

    window.HANQIAO = window.HANQIAO || {};

    window.HANQIAO.escapeHtml = function (text) {
        const d = document.createElement('div');
        d.textContent = text == null ? '' : String(text);
        return d.innerHTML;
    };

    window.HANQIAO.pickLang = function (obj, lang) {
        if (!obj || typeof obj !== 'object') return '';
        const l = lang || 'zh';
        return obj[l] || obj.zh || '';
    };

    window.HANQIAO.getLiteratureSite = function () {
        return window.LITERATURE_SITE || null;
    };

    window.HANQIAO.toChineseChapterNumeral = function (n) {
        const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
        if (n <= 0 || n > 99) return String(n);
        if (n < 10) return digits[n];
        if (n === 10) return '十';
        if (n < 20) return '十' + digits[n - 10];
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        if (ones === 0) return digits[tens] + '十';
        return digits[tens] + '十' + digits[ones];
    };

    window.HANQIAO.formatWorkChapterTitle = function (num, lang) {
        switch (lang) {
            case 'es':
                return 'Capítulo ' + num;
            case 'pt':
                return 'Capítulo ' + num;
            case 'it':
                return 'Capitolo ' + num;
            case 'de':
                return 'Kapitel ' + num;
            case 'la':
                return 'Capitulum ' + num;
            default:
                return '第' + window.HANQIAO.toChineseChapterNumeral(num) + '章';
        }
    };

    window.HANQIAO.chapterNumFromSegment = function (segment) {
        const m = String(segment || '').match(/chapter-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
    };

    window.HANQIAO.chapterPageIndex = function (num) {
        const n = parseInt(num, 10) || 1;
        if (n <= 20) return 0;
        if (n <= 40) return 1;
        if (n <= 60) return 2;
        return 3;
    };

    function collectSearchText(value, key = '') {
        if (/^(workShelfTitle|hubPageTitle|module\d+Subtitle)$/i.test(key)) return '';
        if (typeof value === 'string') return value.replace(/<[^>]*>/g, ' ');
        if (Array.isArray(value)) return value.map((item) => collectSearchText(item)).join(' ');
        if (value && typeof value === 'object') {
            return Object.entries(value)
                .map(([childKey, childValue]) => collectSearchText(childValue, childKey))
                .join(' ');
        }
        return '';
    }

    /**
     * 由 LITERATURE_SITE 生成首页检索用的 window.ARTICLES 结构（与旧版一致）
     */
    window.HANQIAO.buildArticlesFromLiterature = function (site) {
        const out = [];
        if (!site || !Array.isArray(site.works)) return out;

        for (const work of site.works) {
            if (!work || !work.id || !work.folder) continue;
            const chapters = Array.isArray(work.chapters) ? work.chapters : [];
            const titleZh = window.HANQIAO.pickLang(work.title, 'zh') || '';
            const workLabel = titleZh.replace(/^《|》$/g, '').trim() || work.id;
            const chapterEntries = chapters.map(function (ch) {
                const chapterContent = site.modulesByChapterId?.[ch.id] || {};
                const chapterCopy = window.WORK_COPY?.[ch.id] || {};
                return {
                    kind: 'chapter',
                    id: ch.id,
                    chapterWorkId: ch.id,
                    pathSegment: ch.segment,
                    hub: 'articles/' + work.folder + '/' + ch.segment + '/index.html',
                    available: true,
                    chapter: ch.segment,
                    title: ch.title || {},
                    summary: ch.summary || {},
                    searchText: collectSearchText([chapterContent, chapterCopy])
                };
            });

            out.push({
                kind: 'work',
                id: work.id,
                title: work.title || {},
                summary: work.summary || {},
                keywords: work.keywords || '',
                hub: 'articles/' + work.folder + '/index.html',
                entry: 'articles/' + work.folder + '/index.html',
                available: true,
                chapters: chapterEntries,
                work: workLabel
            });
        }
        return out;
    };
})();
