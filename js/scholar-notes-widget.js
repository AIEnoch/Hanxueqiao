/**
 * 汉学家评注：只读列表，按章筛选；与游客评论模块独立。
 * 依赖：literature-core 的 HANQIAO.escapeHtml；同源时可不写 meta。
 */
(function () {
    'use strict';

    var LABELS = {
        zh: {
            title: '汉学家评注',
            empty: '本章暂无汉学家评注。',
            offline: '无法加载汉学家评注（请确认已在本机运行网站服务，且不要使用 file:// 打开页面）。',
            offlineFriendly: '请在本地运行服务后查看。',
            pinned: '置顶',
            loading: '加载中…'
        },
        es: {
            title: 'Notas de sinólogos',
            empty: 'No hay notas en este capítulo.',
            offline: 'No se pudo cargar las notas.',
            offlineFriendly: 'Ejecute el servicio en local y vuelva a abrir esta página.',
            pinned: 'Fijado',
            loading: 'Cargando…'
        },
        pt: {
            title: 'Notas de sinólogos',
            empty: 'Ainda não há notas neste capítulo.',
            offline: 'Não foi possível carregar as notas.',
            offlineFriendly: 'Inicie o servidor localmente para ver este módulo.',
            pinned: 'Fixado',
            loading: 'A carregar…'
        },
        it: {
            title: 'Note dei sinologi',
            empty: 'Nessuna nota in questo capitolo.',
            offline: 'Impossibile caricare le note.',
            offlineFriendly: 'Avvia il servizio in locale per consultare questo modulo.',
            pinned: 'In evidenza',
            loading: 'Caricamento…'
        }
    };

    var LANG_BADGE = { zh: '中文', es: 'Español', pt: 'Português', it: 'Italiano' };

    function esc(t) {
        return window.HANQIAO && window.HANQIAO.escapeHtml
            ? window.HANQIAO.escapeHtml(t)
            : String(t || '')
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;');
    }

    function uiLang() {
        var b = document.querySelector('.lang-btn.active');
        var l = b && b.getAttribute('data-lang');
        return l === 'es' || l === 'pt' || l === 'it' ? l : 'zh';
    }

    function L() {
        return LABELS[uiLang()] || LABELS.zh;
    }

    function apiOrigin() {
        var m = document.querySelector('meta[name="hanqiao-scholar-notes-api"]');
        var raw = m && m.getAttribute('content');
        return raw ? String(raw).trim().replace(/\/$/, '') : '';
    }

    function apiUrl(path) {
        return apiOrigin() + path;
    }

    function scopeFromBody() {
        var b = document.body;
        if (!b.classList.contains('page-literature-dynamic')) return null;
        var page = b.getAttribute('data-literature-page');
        if (page === 'work-overview') return null;
        var work = b.getAttribute('data-literature-work-folder');
        var chapter = b.getAttribute('data-literature-chapter-segment');
        if (!work || !chapter) return null;
        return { work: work, chapter: chapter };
    }

    function fmtTime(iso) {
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString(uiLang() === 'zh' ? 'zh-CN' : uiLang(), {
                dateStyle: 'medium'
            });
        } catch (e) {
            return '';
        }
    }

    function renderNote(n) {
        var badge = LANG_BADGE[n.lang] || n.lang;
        var pin = n.pinned ? '<span class="hq-scholar-pin">' + esc(L().pinned) + '</span>' : '';
        var bodyHtml = esc(n.body || '').replace(/\n/g, '<br>');
        return (
            '<article class="hq-scholar-card">' +
            '<header class="hq-scholar-card-head">' +
            pin +
            '<strong class="hq-scholar-name">' +
            esc(n.scholarName) +
            '</strong>' +
            '<span class="hq-scholar-langtag" lang="' +
            esc(n.lang) +
            '">' +
            esc(badge) +
            '</span>' +
            '<time class="hq-scholar-time" datetime="' +
            esc(n.createdAt || '') +
            '">' +
            esc(fmtTime(n.createdAt)) +
            '</time>' +
            '</header>' +
            '<div class="hq-scholar-body" lang="' +
            esc(n.lang) +
            '">' +
            bodyHtml +
            '</div>' +
            '</article>'
        );
    }

    function mount(root) {
        var sc = scopeFromBody();
        if (!sc || !root) return;

        function shell() {
            var l = L();
            var embedded = root.getAttribute('data-scholar-ui') === 'embedded';
            if (embedded) {
                root.innerHTML =
                    '<div class="hq-scholar-embedded">' +
                    '<div class="hq-scholar-list" id="hq-scholar-list"></div>' +
                    '</div>';
                return;
            }
            root.innerHTML =
                '<div class="hq-scholar-inner">' +
                '<h2 class="hq-scholar-title">' +
                esc(l.title) +
                '</h2>' +
                '<div class="hq-scholar-list" id="hq-scholar-list"></div>' +
                '</div>';
        }

        function load() {
            var listEl = document.getElementById('hq-scholar-list');
            if (!listEl) return;
            var detail = root.getAttribute('data-scholar-context') === 'chapter-detail';
            listEl.innerHTML = '<p class="hq-scholar-muted">' + esc(L().loading) + '</p>';

            fetch(
                apiUrl(
                    '/api/scholar-notes?work=' +
                        encodeURIComponent(sc.work) +
                        '&chapter=' +
                        encodeURIComponent(sc.chapter)
                ),
                { method: 'GET', credentials: 'omit' }
            )
                .then(function (r) {
                    if (!r.ok) throw new Error('x');
                    return r.json();
                })
                .then(function (data) {
                    var notes = data.notes || [];
                    if (!notes.length) {
                        listEl.innerHTML = '<p class="hq-scholar-muted">' + esc(L().empty) + '</p>';
                        return;
                    }
                    listEl.innerHTML = notes.map(renderNote).join('');
                })
                .catch(function () {
                    var msg = detail ? L().offlineFriendly : L().offline;
                    listEl.innerHTML =
                        '<p class="hq-scholar-muted' +
                        (detail ? ' hq-scholar-offline-friendly' : '') +
                        '">' +
                        esc(msg) +
                        '</p>';
                });
        }

        shell();
        load();

        window.addEventListener('hanqiao:ui-lang', function () {
            shell();
            load();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var root = document.getElementById('hanqiao-scholar-notes-root');
        if (!root) return;
        mount(root);
    });
})();
