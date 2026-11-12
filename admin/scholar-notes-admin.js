/**
 * 汉学家评注 · 管理端（依赖同源 server 与 ADMIN_SECRET）
 */
(function () {
    'use strict';

    var SESSION_KEY = 'hanqiao-admin-bearer-v1';
    var LANG_SHOW = { zh: '中文', es: 'Español', pt: 'Português', it: 'Italiano' };

    var literatureSite = null;
    var notesCache = [];
    var editingId = null;

    function $(id) {
        return document.getElementById(id);
    }

    function trim(s) {
        return s == null ? '' : String(s).trim();
    }

    function getSecret() {
        return sessionStorage.getItem(SESSION_KEY) || '';
    }

    function setBar(msg) {
        $('snConn').textContent = msg || '';
    }

    function setStatus(msg) {
        $('snStatus').textContent = msg || '';
    }

    function api(method, url, body) {
        return fetch(url, {
            method: method,
            headers: {
                Authorization: 'Bearer ' + getSecret(),
                'Content-Type': 'application/json'
            },
            body: body != null ? JSON.stringify(body) : undefined
        }).then(function (r) {
            return r.text().then(function (txt) {
                var j = {};
                try {
                    j = txt ? JSON.parse(txt) : {};
                } catch (e) {}
                if (!r.ok) throw new Error(j.error || txt || 'HTTP ' + r.status);
                return j;
            });
        });
    }

    function apiPublic(url) {
        return fetch(url, { credentials: 'omit' }).then(function (r) {
            return r.json().then(function (j) {
                if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
                return j;
            });
        });
    }

    function syncWorkChapterSelectors() {
        var wSel = $('snWork');
        var cSel = $('snChapter');
        wSel.innerHTML = '';
        if (!literatureSite || !literatureSite.works) return;
        literatureSite.works.forEach(function (w, i) {
            var o = document.createElement('option');
            o.value = String(i);
            o.textContent = (w.title && w.title.zh) || w.folder || w.id;
            o.setAttribute('data-folder', w.folder || '');
            wSel.appendChild(o);
        });
        refreshChapterSelect();
    }

    function refreshChapterSelect() {
        var wSel = $('snWork');
        var cSel = $('snChapter');
        var wi = parseInt(wSel.value, 10) || 0;
        var work = literatureSite && literatureSite.works && literatureSite.works[wi];
        cSel.innerHTML = '';
        if (!work || !work.chapters) return;
        work.chapters.forEach(function (ch, j) {
            var o = document.createElement('option');
            o.value = String(j);
            o.textContent = (ch.title && ch.title.zh) || ch.segment;
            o.setAttribute('data-segment', ch.segment || '');
            cSel.appendChild(o);
        });
    }

    function scopeParams() {
        var wSel = $('snWork');
        var cSel = $('snChapter');
        var wi = parseInt(wSel.value, 10) || 0;
        var ci = parseInt(cSel.value, 10) || 0;
        var work = literatureSite && literatureSite.works && literatureSite.works[wi];
        var ch = work && work.chapters && work.chapters[ci];
        return {
            work: work && work.folder,
            chapter: ch && ch.segment
        };
    }

    function renderList() {
        var box = $('snList');
        if (!notesCache.length) {
            box.innerHTML = '<p class="sn-steps">本章还没有评注，请在下方新增。</p>';
            return;
        }
        box.innerHTML = notesCache
            .map(function (n, idx) {
                var pin = n.pinned ? '<span class="sn-pin">置顶</span>' : '';
                return (
                    '<div class="sn-note-item" data-note-id="' +
                    n.id +
                    '">' +
                    '<div class="sn-note-head">' +
                    pin +
                    '<strong>' +
                    esc(n.scholarName) +
                    '</strong>' +
                    '<span class="sn-lang">' +
                    esc(LANG_SHOW[n.lang] || n.lang) +
                    '</span>' +
                    '<span style="margin-left:auto;font-size:12px;color:#64748b;">#' +
                    (idx + 1) +
                    '</span>' +
                    '</div>' +
                    '<div class="sn-note-body">' +
                    esc(n.body) +
                    '</div>' +
                    '<div class="sn-row-actions">' +
                    '<button type="button" data-act="up" data-id="' +
                    n.id +
                    '">上移</button>' +
                    '<button type="button" data-act="down" data-id="' +
                    n.id +
                    '">下移</button>' +
                    '<button type="button" data-act="pin" data-id="' +
                    n.id +
                    '">' +
                    (n.pinned ? '取消置顶' : '置顶') +
                    '</button>' +
                    '<button type="button" data-act="edit" data-id="' +
                    n.id +
                    '">编辑</button>' +
                    '<button type="button" data-act="del" data-id="' +
                    n.id +
                    '" class="btn-dan">删除</button>' +
                    '</div></div>'
                );
            })
            .join('');
    }

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function selectedLang() {
        var r = document.querySelector('input[name="snLang"]:checked');
        return r ? r.value : '';
    }

    function setLangRadio(lang) {
        var rr = document.querySelector('input[name="snLang"][value="' + lang + '"]');
        if (rr) rr.checked = true;
    }

    function clearForm() {
        editingId = null;
        $('snScholar').value = '';
        $('snBody').value = '';
        $('snPin').checked = false;
        document.querySelectorAll('input[name="snLang"]').forEach(function (x) {
            x.checked = false;
        });
        $('snFormTitle').textContent = '③ 新增一条评注';
    }

    function applyLoadedLiterature(site, barMsg) {
        literatureSite = site;
        $('snMain').hidden = false;
        $('snListCard').hidden = false;
        $('snFormCard').hidden = false;
        syncWorkChapterSelectors();
        setBar(barMsg);
        return refreshNotes().catch(function () {
            setStatus('本章评注列表暂时无法从服务器读取（请确认已在 server 目录运行 npm start）。');
        });
    }

    function stripHtmlRough(s) {
        return String(s || '').replace(/<[^>]+>/g, ' ');
    }

    function loadLiterature() {
        if (!getSecret()) {
            setBar('请先填写并保存密钥。');
            return;
        }
        setBar('正在载入书目…');

        var embedded =
            typeof window.LITERATURE_SITE !== 'undefined' &&
            window.LITERATURE_SITE &&
            Array.isArray(window.LITERATURE_SITE.works);

        return api('GET', '/api/admin/literature', null)
            .then(function (data) {
                return applyLoadedLiterature(data.literatureSite, '书目已从服务器载入。请选择章节后刷新列表。');
            })
            .catch(function (e) {
                var raw = stripHtmlRough(e.message || e || '');
                if (embedded) {
                    applyLoadedLiterature(
                        window.LITERATURE_SITE,
                        '提示：无法访问 GET /api/admin/literature（请先在 server 目录执行 npm start，并确保不是旧版进程）。已暂时用页面自带的 literature-site.js 填好书目下拉框；保存评注仍需同一端口上的服务。技术信息：' +
                            raw.trim().slice(0, 220)
                    );
                    return;
                }
                setBar('载入失败：' + raw.trim().slice(0, 400));
            });
    }

    function refreshNotes() {
        var sc = scopeParams();
        if (!sc.work || !sc.chapter) return Promise.resolve();
        return apiPublic(
            '/api/scholar-notes?work=' + encodeURIComponent(sc.work) + '&chapter=' + encodeURIComponent(sc.chapter)
        ).then(function (data) {
            notesCache = data.notes || [];
            renderList();
            setStatus('已加载 ' + notesCache.length + ' 条评注。');
        });
    }

    function reorder(delta, id) {
        var ix = notesCache.findIndex(function (n) {
            return n.id === id;
        });
        var j = ix + delta;
        if (ix < 0 || j < 0 || j >= notesCache.length) return;
        var arr = notesCache.slice();
        var t = arr[ix];
        arr[ix] = arr[j];
        arr[j] = t;
        var sc = scopeParams();
        return api('POST', '/api/admin/scholar-notes/reorder', {
            work: sc.work,
            chapter: sc.chapter,
            orderedIds: arr.map(function (n) {
                return n.id;
            })
        }).then(function () {
            return refreshNotes();
        });
    }

    function togglePin(id) {
        var n = notesCache.find(function (x) {
            return x.id === id;
        });
        if (!n) return Promise.resolve();
        return api('PATCH', '/api/admin/scholar-notes/' + id, { pinned: !n.pinned }).then(function () {
            return refreshNotes();
        });
    }

    function deleteNote(id) {
        if (!confirm('确定删除本条汉学家评注？此操作不可撤销。')) return Promise.resolve();
        return api('DELETE', '/api/admin/scholar-notes/' + id, null).then(function () {
            clearForm();
            return refreshNotes();
        });
    }

    function startEdit(id) {
        var n = notesCache.find(function (x) {
            return x.id === id;
        });
        if (!n) return;
        editingId = id;
        $('snScholar').value = n.scholarName;
        setLangRadio(n.lang);
        $('snBody').value = n.body;
        $('snPin').checked = !!n.pinned;
        $('snFormTitle').textContent = '③ 正在修改评注（编号 ' + id + '）';
        $('snFormCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function submitForm() {
        var sc = scopeParams();
        var scholar = trim($('snScholar').value);
        var lang = selectedLang();
        var body = $('snBody').value;
        var pinned = $('snPin').checked;

        if (!sc.work || !sc.chapter) {
            setStatus('请先选择文献与章节。');
            return;
        }
        if (!scholar) {
            setStatus('请填写汉学家姓名。');
            return;
        }
        if (!lang) {
            setStatus('请选择本条评注的原始语种（四选一）。');
            return;
        }
        if (!trim(body)) {
            setStatus('请填写评注正文。');
            return;
        }

        var payload = {
            scholarName: scholar,
            lang: lang,
            body: body,
            pinned: pinned
        };

        var p;
        if (editingId) {
            p = api('PATCH', '/api/admin/scholar-notes/' + editingId, payload);
        } else {
            p = api('POST', '/api/admin/scholar-notes', {
                work: sc.work,
                chapter: sc.chapter,
                scholarName: scholar,
                lang: lang,
                body: body,
                pinned: pinned
            });
        }

        p.then(function () {
            setStatus(editingId ? '已保存修改。' : '已新增评注。');
            clearForm();
            return refreshNotes();
        }).catch(function (e) {
            setStatus('保存失败：' + e.message);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        $('snSaveSecret').addEventListener('click', function () {
            var v = trim($('snSecret').value);
            if (!v) {
                setBar('密钥不能为空。');
                return;
            }
            sessionStorage.setItem(SESSION_KEY, v);
            setBar('密钥已保存到本浏览器。');
        });

        $('snLoadLit').addEventListener('click', loadLiterature);

        $('snWork').addEventListener('change', function () {
            refreshChapterSelect();
            refreshNotes();
        });

        $('snChapter').addEventListener('change', function () {
            refreshNotes();
        });

        $('snRefreshList').addEventListener('click', function () {
            refreshNotes().catch(function (e) {
                setStatus('刷新失败：' + e.message);
            });
        });

        $('snList').addEventListener('click', function (ev) {
            var btn = ev.target.closest('button[data-act]');
            if (!btn) return;
            var id = parseInt(btn.getAttribute('data-id'), 10);
            var act = btn.getAttribute('data-act');
            if (!Number.isFinite(id)) return;
            if (act === 'up') reorder(-1, id).catch(function (e) {
                setStatus(e.message);
            });
            else if (act === 'down')
                reorder(1, id).catch(function (e) {
                    setStatus(e.message);
                });
            else if (act === 'pin')
                togglePin(id).catch(function (e) {
                    setStatus(e.message);
                });
            else if (act === 'edit') startEdit(id);
            else if (act === 'del')
                deleteNote(id).catch(function (e) {
                    setStatus(e.message);
                });
        });

        $('snSubmit').addEventListener('click', submitForm);

        $('snCancelEdit').addEventListener('click', clearForm);

        if ($('snSecret') && getSecret()) $('snSecret').value = getSecret();
    });
})();
