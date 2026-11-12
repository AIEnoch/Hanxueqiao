/**
 * 本章评论：单一输入框（任意语种），服务端以 body 存储；旧数据若含多语种 JSON，列表仍按界面语言择优显示。
 */
(function () {
    'use strict';

    var LABELS = {
        zh: {
            title: '本章评论',
            hint: '写下您的看法即可（任意语种）。',
            nickname: '昵称',
            commentBody: '评论内容',
            submit: '发表',
            reply: '回复',
            like: '赞',
            pinned: '置顶',
            admin: '官方',
            empty: '还没有评论，欢迎留下第一条。',
            loading: '加载中…',
            offline:
                '无法连接评论服务。若用本地双击打开的网页（地址栏是 file://），请先在本机运行评论服务，再用浏览器访问 http://localhost:8787 下的章节页面；静态托管则需配置 meta「hanqiao-comments-api」指向线上 API。',
            offlineFile:
                '您正以「本地文件」方式打开页面，无法发表评论。请在项目文件夹打开终端，执行：cd server → npm install → npm start，然后在浏览器地址栏输入：http://localhost:8787/articles/……（勿再双击磁盘里的 html）。',
            replyPlaceholder: '回复 #%id%',
            sending: '提交中…',
            error: '发送失败，请稍后再试。',
            fillNick: '请填写昵称。',
            fillBody: '请填写评论内容。'
        },
        es: {
            title: 'Comentarios del capítulo',
            hint: 'Escriba su mensaje (cualquier idioma).',
            nickname: 'Nombre',
            commentBody: 'Comentario',
            submit: 'Publicar',
            reply: 'Responder',
            like: 'Me gusta',
            pinned: 'Fijado',
            admin: 'Equipo',
            empty: 'Sin comentarios todavía.',
            loading: 'Cargando…',
            offline: 'Sin conexión al servidor de comentarios. Si abrió el archivo con file://, use http://localhost:8787 tras ejecutar el servidor.',
            offlineFile:
                'Archivo local (file://): ejecute el servidor en server/ y abra la URL http://localhost:8787/...',
            replyPlaceholder: 'Responder a #%id%',
            sending: 'Enviando…',
            error: 'Error al enviar.',
            fillNick: 'Indique un nombre.',
            fillBody: 'Escriba el comentario.'
        },
        pt: {
            title: 'Comentários do capítulo',
            hint: 'Escreva o seu comentário (qualquer língua).',
            nickname: 'Nome',
            commentBody: 'Comentário',
            submit: 'Publicar',
            reply: 'Responder',
            like: 'Gosto',
            pinned: 'Fixado',
            admin: 'Equipe',
            empty: 'Ainda não há comentários.',
            loading: 'A carregar…',
            offline: 'Serviço de comentários indisponível. Com file://, inicie o servidor e use http://localhost:8787.',
            offlineFile:
                'Ficheiro local: cd server → npm start → abra http://localhost:8787/...',
            replyPlaceholder: 'Responder a #%id%',
            sending: 'A enviar…',
            error: 'Falha ao enviar.',
            fillNick: 'Indique um nome.',
            fillBody: 'Escreva o comentário.'
        },
        it: {
            title: 'Commenti del capitolo',
            hint: 'Scrivi il tuo commento (qualsiasi lingua).',
            nickname: 'Nome',
            commentBody: 'Commento',
            submit: 'Pubblica',
            reply: 'Rispondi',
            like: 'Mi piace',
            pinned: 'In evidenza',
            admin: 'Staff',
            empty: 'Nessun commento.',
            loading: 'Caricamento…',
            offline: 'Servizio commenti non disponibile. Con file:// avvia il server e usa http://localhost:8787.',
            offlineFile:
                'File locale: avvia il server in server/ e apri http://localhost:8787/...',
            replyPlaceholder: 'Risposta a #%id%',
            sending: 'Invio…',
            error: 'Invio non riuscito.',
            fillNick: 'Inserisci un nome.',
            fillBody: 'Scrivi il commento.'
        }
    };

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

    function connectionOfflineMessage() {
        var pack = LABELS[uiLang()] || LABELS.zh;
        if (typeof location !== 'undefined' && location.protocol === 'file:') {
            return pack.offlineFile || pack.offline;
        }
        return pack.offline;
    }

    function apiOrigin() {
        var m = document.querySelector('meta[name="hanqiao-comments-api"]');
        var raw = m && m.getAttribute('content');
        return raw ? String(raw).trim().replace(/\/$/, '') : '';
    }

    function apiUrl(path) {
        return apiOrigin() + path;
    }

    function pickBody(bodies, lang) {
        if (!bodies || typeof bodies !== 'object') return '';
        var order = [lang, 'zh', 'es', 'pt', 'it'];
        for (var i = 0; i < order.length; i++) {
            var k = order[i];
            var v = bodies[k];
            if (v != null && String(v).trim()) return String(v).trim();
        }
        return '';
    }

    function fmtTime(iso) {
        try {
            var d = new Date(iso);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleString(uiLang() === 'zh' ? 'zh-CN' : uiLang(), {
                dateStyle: 'short',
                timeStyle: 'short'
            });
        } catch (e) {
            return '';
        }
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

    function renderCard(node, depth, state) {
        var lg = uiLang();
        var text = esc(pickBody(node.bodies, lg)).replace(/\n/g, '<br>');
        var nick = esc(node.nickname);
        var pinned = node.pinned ? '<span class="hq-comments-badge">' + esc(L().pinned) + '</span>' : '';
        var adminBox = '';
        var ar = node.adminReplies || {};
        var apt = pickBody(ar, lg);
        if (apt) {
            adminBox =
                '<div class="hq-comments-admin"><span class="hq-comments-admin-tag">' +
                esc(L().admin) +
                '</span><div class="hq-comments-admin-body">' +
                esc(apt).replace(/\n/g, '<br>') +
                '</div></div>';
        }

        var likeBtn =
            '<button type="button" class="hq-comments-like" data-like-id="' +
            node.id +
            '">' +
            esc(L().like) +
            ' · ' +
            (node.likes | 0) +
            '</button>';

        var replyBtn =
            depth === 0
                ? '<button type="button" class="hq-comments-reply" data-reply-id="' +
                  node.id +
                  '">' +
                  esc(L().reply) +
                  '</button>'
                : '';

        var repliesHtml = '';
        if (node.replies && node.replies.length) {
            repliesHtml =
                '<div class="hq-comments-replies">' +
                node.replies.map(function (r) {
                    return renderCard(r, 1, state);
                }).join('') +
                '</div>';
        }

        return (
            '<article class="hq-comments-card' +
            (depth ? ' hq-comments-card-nested' : '') +
            '" data-id="' +
            node.id +
            '">' +
            '<header class="hq-comments-card-head">' +
            pinned +
            '<strong class="hq-comments-nick">' +
            nick +
            '</strong>' +
            '<time class="hq-comments-time">' +
            esc(fmtTime(node.createdAt)) +
            '</time></header>' +
            '<div class="hq-comments-body">' +
            text +
            '</div>' +
            adminBox +
            '<div class="hq-comments-actions">' +
            likeBtn +
            replyBtn +
            '</div>' +
            repliesHtml +
            '</article>'
        );
    }

    function mount(root) {
        var sc = scopeFromBody();
        if (!sc || !root) return;

        var state = { parentId: null, loading: false };

        function composerHtml() {
            var l = L();
            return (
                '<div class="hq-comments-compose">' +
                '<label class="hq-comments-label">' +
                esc(l.nickname) +
                '</label>' +
                '<input type="text" class="hq-comments-input" maxlength="32" id="hq-comments-nick" autocomplete="nickname">' +
                '<label class="hq-comments-label">' +
                esc(l.commentBody) +
                '</label>' +
                '<textarea class="hq-comments-input hq-comments-body-main" id="hq-comments-body-main" rows="5" maxlength="2000"></textarea>' +
                '<div class="hq-comments-compose-actions">' +
                '<button type="button" class="hq-comments-submit" id="hq-comments-send">' +
                esc(l.submit) +
                '</button>' +
                '<span class="hq-comments-compose-meta" id="hq-comments-reply-meta"></span>' +
                '</div></div>'
            );
        }

        function shell() {
            var l = L();
            var drawerMode = root.getAttribute('data-comments-drawer') === '1';
            var titleBlock = drawerMode
                ? ''
                : '<h2 class="hq-comments-title">' + esc(l.title) + '</h2>';
            root.innerHTML =
                '<div class="hq-comments-inner' +
                (drawerMode ? ' hq-comments-inner--drawer' : '') +
                '">' +
                titleBlock +
                '<p class="hq-comments-hint">' +
                esc(l.hint) +
                '</p>' +
                composerHtml() +
                '<div class="hq-comments-list" id="hq-comments-list"></div>' +
                '</div>';
        }

        function commentText() {
            var el = document.getElementById('hq-comments-body-main');
            return el ? el.value.trim() : '';
        }

        function refreshReplyMeta() {
            var el = document.getElementById('hq-comments-reply-meta');
            if (!el) return;
            if (state.parentId == null) {
                el.textContent = '';
                return;
            }
            el.textContent = L().replyPlaceholder.replace('%id%', String(state.parentId));
        }

        function loadList() {
            var listEl = document.getElementById('hq-comments-list');
            if (!listEl) return;
            listEl.innerHTML = '<p class="hq-comments-muted">' + esc(L().loading) + '</p>';

            fetch(
                apiUrl('/api/comments?work=' + encodeURIComponent(sc.work) + '&chapter=' + encodeURIComponent(sc.chapter)),
                { method: 'GET', credentials: 'omit' }
            )
                .then(function (r) {
                    if (!r.ok) throw new Error('bad');
                    return r.json();
                })
                .then(function (data) {
                    var items = data.comments || [];
                    if (!items.length) {
                        listEl.innerHTML = '<p class="hq-comments-muted">' + esc(L().empty) + '</p>';
                        return;
                    }
                    listEl.innerHTML = items.map(function (c) {
                        return renderCard(c, 0, state);
                    }).join('');
                    bindListActions();
                })
                .catch(function () {
                    listEl.innerHTML = '<p class="hq-comments-muted">' + esc(connectionOfflineMessage()) + '</p>';
                });
        }

        function bindListActions() {
            root.querySelectorAll('[data-like-id]').forEach(function (btn) {
                btn.onclick = function () {
                    var id = parseInt(btn.getAttribute('data-like-id'), 10);
                    fetch(apiUrl('/api/comments/' + id + '/like'), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ work: sc.work, chapter: sc.chapter })
                    })
                        .then(function (r) {
                            return r.ok ? r.json() : null;
                        })
                        .then(function (j) {
                            if (j && j.likes != null) btn.textContent = L().like + ' · ' + j.likes;
                        });
                };
            });
            root.querySelectorAll('[data-reply-id]').forEach(function (btn) {
                btn.onclick = function () {
                    state.parentId = parseInt(btn.getAttribute('data-reply-id'), 10);
                    document.getElementById('hq-comments-nick').focus();
                    refreshReplyMeta();
                };
            });
        }

        shell();
        refreshReplyMeta();

        function bindSend() {
            var btn = document.getElementById('hq-comments-send');
            if (!btn) return;
            btn.onclick = function () {
                var nickEl = document.getElementById('hq-comments-nick');
                var nick = nickEl ? nickEl.value.trim() : '';
                var text = commentText();
                if (!nick) {
                    alert(L().fillNick);
                    return;
                }
                if (!text) {
                    alert(L().fillBody);
                    return;
                }
                btn.disabled = true;
                btn.textContent = L().sending;

                fetch(apiUrl('/api/comments'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        work: sc.work,
                        chapter: sc.chapter,
                        nickname: nick,
                        body: text,
                        parentId: state.parentId
                    })
                })
                    .then(function (r) {
                        if (!r.ok) throw new Error('x');
                        state.parentId = null;
                        refreshReplyMeta();
                        var ta = document.getElementById('hq-comments-body-main');
                        if (ta) ta.value = '';
                        loadList();
                    })
                    .catch(function () {
                        alert(L().error);
                    })
                    .finally(function () {
                        btn.disabled = false;
                        btn.textContent = L().submit;
                    });
            };
        }

        bindSend();

        loadList();

        window.addEventListener('hanqiao:ui-lang', function () {
            shell();
            bindSend();
            refreshReplyMeta();
            loadList();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var root = document.getElementById('hanqiao-comments-root');
        if (!root) return;
        mount(root);
    });
})();
