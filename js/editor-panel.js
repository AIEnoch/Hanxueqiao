/**
 * 汉学桥 · 古籍与模块资料录入面板（仅前端：草稿 localStorage + 导出 JSON）
 * 依赖：window.ARTICLES、可选 window.WORK_COPY（works-all.js）
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'hanqiao-editor-draft-v3';
    const STORAGE_PANEL = 'hanqiao-editor-panel-ui-v1';

    function qs(id) {
        return document.getElementById(id);
    }

    function escapeHtml(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function getArticles() {
        return Array.isArray(window.ARTICLES) ? window.ARTICLES : [];
    }

    function getManualWorkIdRaw() {
        const el = qs('editorWorkIdManual');
        return el ? el.value.trim() : '';
    }

    function manualWorkIdInvalid() {
        const raw = getManualWorkIdRaw();
        return raw.length > 0 && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(raw);
    }

    function getEffectiveWorkId() {
        const raw = getManualWorkIdRaw();
        if (raw && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(raw)) return raw;
        return (qs('editorWorkSelect') && qs('editorWorkSelect').value) || '';
    }

    function validateWorkIdForExport() {
        if (manualWorkIdInvalid()) {
            alert('「新篇目 ID」须以英文字母开头，仅含字母、数字、下划线、连字符。');
            return false;
        }
        if (!getEffectiveWorkId()) {
            alert('请选择已有篇目，或在「新篇目 ID」中填写 id（与脚手架目录名一致，如 ddj-1）。');
            return false;
        }
        return true;
    }

    function defaultFormState(workId) {
        return {
            workId: workId || '',
            classicText: '',
            vernacularText: '',
            transEs: '',
            transPt: '',
            transIt: '',
            termNotes: [{ title: '', body: '' }],
            custom1: '',
            custom2: '',
            custom1Key: 'customField1',
            custom2Key: 'customField2'
        };
    }

    function getFormState() {
        const workId = getEffectiveWorkId();
        const notes = [];
        document.querySelectorAll('#editorTermNotes .editor-note-row').forEach((row) => {
            const t = row.querySelector('.editor-note-title');
            const b = row.querySelector('.editor-note-body');
            notes.push({ title: (t && t.value) || '', body: (b && b.value) || '' });
        });
        return {
            workId,
            classicText: (qs('editorClassic') && qs('editorClassic').value) || '',
            vernacularText: (qs('editorVernacular') && qs('editorVernacular').value) || '',
            transEs: (qs('editorTransEs') && qs('editorTransEs').value) || '',
            transPt: (qs('editorTransPt') && qs('editorTransPt').value) || '',
            transIt: (qs('editorTransIt') && qs('editorTransIt').value) || '',
            termNotes: notes.length ? notes : [{ title: '', body: '' }],
            custom1: (qs('editorCustom1') && qs('editorCustom1').value) || '',
            custom2: (qs('editorCustom2') && qs('editorCustom2').value) || '',
            custom1Key: (qs('editorCustom1Key') && qs('editorCustom1Key').value) || 'customField1',
            custom2Key: (qs('editorCustom2Key') && qs('editorCustom2Key').value) || 'customField2'
        };
    }

    function setFormState(data) {
        if (!data) return;
        const d168 = defaultFormState();
        const merged = { ...d168, ...data, termNotes: data.termNotes && data.termNotes.length ? data.termNotes : d168.termNotes };
        if (qs('editorWorkSelect')) {
            const sel = qs('editorWorkSelect');
            const wid = merged.workId || '';
            const ids = new Set(getArticles().map((a) => a.id));
            const manualEl = qs('editorWorkIdManual');
            if (wid && ids.has(wid)) {
                sel.value = wid;
                if (manualEl) manualEl.value = '';
            } else if (wid && manualEl) {
                manualEl.value = wid;
            } else {
                if (manualEl) manualEl.value = '';
                if (sel.options.length) sel.value = sel.options[0].value;
            }
        }
        if (qs('editorClassic')) qs('editorClassic').value = merged.classicText || '';
        if (qs('editorVernacular')) qs('editorVernacular').value = merged.vernacularText || '';
        if (qs('editorTransEs')) qs('editorTransEs').value = merged.transEs || '';
        if (qs('editorTransPt')) qs('editorTransPt').value = merged.transPt || '';
        if (qs('editorTransIt')) qs('editorTransIt').value = merged.transIt || '';
        if (qs('editorCustom1')) qs('editorCustom1').value = merged.custom1 || '';
        if (qs('editorCustom2')) qs('editorCustom2').value = merged.custom2 || '';
        if (qs('editorCustom1Key')) qs('editorCustom1Key').value = merged.custom1Key || 'customField1';
        if (qs('editorCustom2Key')) qs('editorCustom2Key').value = merged.custom2Key || 'customField2';

        const wrap = qs('editorTermNotes');
        if (wrap) {
            wrap.innerHTML = '';
            merged.termNotes.forEach((n) => addNoteRow(n.title, n.body, false));
        }
        resizeAllTextareas();
        refreshAllPreviews();
    }

    function serializeTermNotes(notes) {
        return notes
            .filter((n) => (n.title && n.title.trim()) || (n.body && n.body.trim()))
            .map((n) => (n.title ? '【' + n.title + '】\n' : '') + (n.body || ''))
            .join('\n\n');
    }

    /** 生成可合并进 content/works/<id>/strings.json 的片段 */
    function buildExportObject(state) {
        const zh = {
            classicText: state.classicText.trim(),
            vernacularText: state.vernacularText.trim(),
            termNotesBlock: serializeTermNotes(state.termNotes)
        };
        const k1 = (state.custom1Key || 'customField1').replace(/[^\w]/g, '') || 'customField1';
        const k2 = (state.custom2Key || 'customField2').replace(/[^\w]/g, '') || 'customField2';
        if (state.custom1.trim()) zh[k1] = state.custom1.trim();
        if (state.custom2.trim()) zh[k2] = state.custom2.trim();

        const es = {};
        const pt = {};
        const it = {};
        if (state.transEs.trim()) es.translationText = state.transEs.trim();
        if (state.transPt.trim()) pt.translationText = state.transPt.trim();
        if (state.transIt.trim()) it.translationText = state.transIt.trim();

        return {
            _exportNote:
                '由汉学桥录入面板导出。请将字段合并到 content/works/' +
                (state.workId || '篇目id') +
                '/strings.json（与现有键人工对齐后运行 npm run build:content）。classicText / vernacularText / translationText 等可改名为页面 data-i18n 对应键。',
            zh: zh,
            es: es,
            pt: pt,
            it: it
        };
    }

    function loadDraftFromStorage(workId) {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const all = JSON.parse(raw);
            if (!all || typeof all !== 'object') return null;
            const key = workId || 'default';
            return all[key] || null;
        } catch (e) {
            return null;
        }
    }

    function saveDraftToStorage(state) {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const all = raw ? JSON.parse(raw) : {};
            const key = state.workId || 'default';
            all[key] = { ...state, savedAt: new Date().toISOString() };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch (e) {
            /* ignore */
        }
    }

    function loadPanelUi() {
        try {
            const raw = localStorage.getItem(STORAGE_PANEL);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function savePanelUi(ui) {
        try {
            const prev = loadPanelUi();
            localStorage.setItem(STORAGE_PANEL, JSON.stringify({ ...prev, ...ui }));
        } catch (e) {
            /* ignore */
        }
    }

    let historyPast = [];
    let historyFuture = [];
    const HISTORY_MAX = 45;

    function snapshotForHistory() {
        return JSON.stringify(getFormState());
    }

    function pushHistory() {
        const s = snapshotForHistory();
        if (historyPast.length && historyPast[historyPast.length - 1] === s) return;
        historyPast.push(s);
        if (historyPast.length > HISTORY_MAX) historyPast.shift();
        historyFuture = [];
    }

    function undo() {
        if (historyPast.length < 2) return;
        const cur = historyPast.pop();
        historyFuture.push(cur);
        const prev = historyPast[historyPast.length - 1];
        setFormState(JSON.parse(prev));
    }

    function redo() {
        if (!historyFuture.length) return;
        const n = historyFuture.pop();
        historyPast.push(n);
        setFormState(JSON.parse(n));
    }

    function resizeTextarea(el) {
        if (!el || el.tagName !== 'TEXTAREA') return;
        el.style.height = 'auto';
        el.style.height = Math.min(520, el.scrollHeight) + 'px';
    }

    function resizeAllTextareas() {
        document.querySelectorAll('#editorPanel textarea').forEach(resizeTextarea);
    }

    const debouncedHistory = (function () {
        let t;
        return function () {
            clearTimeout(t);
            t = setTimeout(pushHistory, 420);
        };
    })();

    function syncPreview(previewId, text) {
        const p = qs(previewId);
        if (!p) return;
        const escaped = escapeHtml(text || '');
        p.innerHTML = escaped.replace(/\n/g, '<br>');
    }

    function refreshAllPreviews() {
        const st = getFormState();
        syncPreview('editorPreviewClassic', st.classicText);
        syncPreview('editorPreviewVernacular', st.vernacularText);
        syncPreview('editorPreviewEs', st.transEs);
        syncPreview('editorPreviewPt', st.transPt);
        syncPreview('editorPreviewIt', st.transIt);
        const mergedNotes = serializeTermNotes(st.termNotes);
        syncPreview('editorPreviewTerms', mergedNotes);
        syncPreview('editorPreviewCustom1', st.custom1);
        syncPreview('editorPreviewCustom2', st.custom2);
    }

    function addNoteRow(title, body, pushHist) {
        const wrap = qs('editorTermNotes');
        if (!wrap) return;
        const row = document.createElement('div');
        row.className = 'editor-note-row';
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'editor-input editor-note-title';
        inp.placeholder = '要点标题';
        inp.value = title || '';
        const ta = document.createElement('textarea');
        ta.className = 'editor-textarea editor-note-body';
        ta.rows = 2;
        ta.placeholder = '要点内容…';
        ta.value = body || '';
        const rm = document.createElement('button');
        rm.type = 'button';
        rm.className = 'editor-note-remove';
        rm.title = '删除本条';
        rm.textContent = '×';
        row.appendChild(inp);
        row.appendChild(ta);
        row.appendChild(rm);
        wrap.appendChild(row);
        ta.addEventListener('input', function () {
            resizeTextarea(ta);
            debouncedHistory();
            refreshAllPreviews();
        });
        inp.addEventListener('input', function () {
            debouncedHistory();
            refreshAllPreviews();
        });
        rm.addEventListener('click', function () {
            if (wrap.children.length <= 1) {
                inp.value = '';
                ta.value = '';
                resizeTextarea(ta);
                refreshAllPreviews();
                return;
            }
            row.remove();
            debouncedHistory();
            refreshAllPreviews();
        });
        resizeTextarea(ta);
        if (pushHist) debouncedHistory();
    }

    function fillFromWorkCopy(workId) {
        if (!workId || !window.WORK_COPY || !window.WORK_COPY[workId]) return false;
        const w = window.WORK_COPY[workId];
        const zh = w.zh && typeof w.zh === 'object' ? w.zh : {};
        const es = w.es && typeof w.es === 'object' ? w.es : {};
        const pt = w.pt && typeof w.pt === 'object' ? w.pt : {};
        const it = w.it && typeof w.it === 'object' ? w.it : {};
        const notesFromZh = [];
        for (let i = 1; i <= 12; i++) {
            const ta = zh['termRow' + i + 'a'];
            const tb = zh['termRow' + i + 'b'];
            if ((ta && String(ta).trim()) || (tb && String(tb).trim())) notesFromZh.push({ title: ta || '', body: tb || '' });
        }
        setFormState({
            workId: workId,
            classicText: [zh.module1Subtitle, zh.hubIntro].filter(Boolean).join('\n\n'),
            vernacularText: zh.m2p4 || zh.m2p5 || '',
            transEs: es.translationText || '',
            transPt: pt.translationText || '',
            transIt: it.translationText || '',
            termNotes: notesFromZh.length ? notesFromZh : [{ title: '', body: '' }],
            custom1: zh.customField1 || '',
            custom2: zh.customField2 || '',
            custom1Key: 'customField1',
            custom2Key: 'customField2'
        });
        return true;
    }

    function tryFetchStringsJson(workId, cb) {
        if (!workId) return;
        const url = 'content/works/' + workId + '/strings.json';
        fetch(url)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (!j) {
                    if (cb) cb(false);
                    return;
                }
                const zh = j.zh || {};
                const es = j.es || {};
                const pt = j.pt || {};
                const it = j.it || {};
                const notes = [];
                for (let i = 1; i <= 12; i++) {
                    const ta = zh['termRow' + i + 'a'];
                    const tb = zh['termRow' + i + 'b'];
                    if ((ta && String(ta).trim()) || (tb && String(tb).trim())) notes.push({ title: ta || '', body: tb || '' });
                }
                const classic =
                    zh.classicText ||
                    [zh.module1Subtitle, zh.hubIntro].filter(Boolean).join('\n\n');
                setFormState({
                    workId: workId,
                    classicText: classic || '',
                    vernacularText: zh.vernacularText || zh.m2p4 || '',
                    transEs: es.translationText || '',
                    transPt: pt.translationText || '',
                    transIt: it.translationText || '',
                    termNotes: notes.length ? notes : [{ title: '', body: '' }],
                    custom1: zh.customField1 || '',
                    custom2: zh.customField2 || ''
                });
                if (cb) cb(true);
            })
            .catch(function () {
                if (cb) cb(false);
            });
    }

    function downloadJson(obj, filename) {
        const blob = new Blob([JSON.stringify(obj, null, 4) + '\n'], { type: 'application/json;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function injectPanel() {
        if (qs('editorPanel')) return;
        const html =
            '<div id="editorPanelBackdrop" class="editor-backdrop" aria-hidden="true"></div>' +
            '<div id="editorPanel" class="editor-panel" role="dialog" aria-modal="true" aria-labelledby="editorPanelTitle" tabindex="-1">' +
            '  <div class="editor-panel-resize" id="editorPanelResize" title="拖拽调整宽度" aria-hidden="true"></div>' +
            '  <header class="editor-panel-head" id="editorPanelDrag">' +
            '    <h2 id="editorPanelTitle" class="editor-panel-title">资料录入</h2>' +
            '    <div class="editor-panel-head-actions">' +
            '      <button type="button" class="editor-icon-btn" id="editorMinimize" title="最小化">━</button>' +
            '      <button type="button" class="editor-icon-btn" id="editorClose" title="关闭">×</button>' +
            '    </div>' +
            '  </header>' +
            '  <div class="editor-panel-toolbar">' +
            '    <label class="editor-label-inline">篇目 ' +
            '      <select id="editorWorkSelect" class="editor-select"></select>' +
            '    </label>' +
            '    <label class="editor-label-inline">新篇目 ID ' +
            '      <input type="text" id="editorWorkIdManual" class="editor-input editor-workid-manual" maxlength="64" autocomplete="off" placeholder="如 my-book-1（字母开头）" title="与仓库 content/works 及 articles 目录 id 一致；填写后优先于上方下拉框" />' +
            '    </label>' +
            '    <button type="button" class="editor-btn editor-btn-ghost" id="editorLoadTemplate">载入线上文案</button>' +
            '    <button type="button" class="editor-btn editor-btn-ghost" id="editorImportFile">导入 JSON</button>' +
            '    <input type="file" id="editorImportInput" accept=".json,application/json" class="visually-hidden">' +
            '  </div>' +
            '  <p class="editor-hint">草稿保存在本机浏览器。新建篇目请先在仓库执行 <code>npm run scaffold:article -- &lt;id&gt;</code>，再于「新篇目 ID」填写同一 id。导出片段请合并到 <code>content/works/&lt;篇目&gt;/strings.json</code> 后运行构建。</p>' +
            '  <div class="editor-panel-body">' +
            '    <div class="editor-tabs">' +
            '      <button type="button" class="editor-tab is-active" data-tab="m1">古籍原文</button>' +
            '      <button type="button" class="editor-tab" data-tab="m2">白话释义</button>' +
            '      <button type="button" class="editor-tab" data-tab="m3">多语译文</button>' +
            '      <button type="button" class="editor-tab" data-tab="m4">术语要点</button>' +
            '      <button type="button" class="editor-tab" data-tab="m5">扩展字段</button>' +
            '    </div>' +
            '    <div class="editor-tab-panels">' +
            '      <section class="editor-section is-active" data-panel="m1">' +
            '        <div class="editor-section-tools">' +
            '          <button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="m1">编辑 / 预览</button>' +
            '          <button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" data-clear="editorClassic">清空</button>' +
            '        </div>' +
            '        <div class="editor-split">' +
            '          <div class="editor-split-pane is-write" data-write="m1">' +
            '            <textarea id="editorClassic" class="editor-textarea editor-textarea-lg" rows="12" placeholder="古籍原文，支持分段、换行、粘贴…"></textarea>' +
            '          </div>' +
            '          <div class="editor-split-pane is-preview" data-preview="m1" hidden>' +
            '            <div id="editorPreviewClassic" class="editor-preview"></div>' +
            '          </div>' +
            '        </div>' +
            '        <button type="button" class="editor-btn editor-btn-secondary" data-save-draft>保存草稿</button>' +
            '      </section>' +
            '      <section class="editor-section" data-panel="m2">' +
            '        <div class="editor-section-tools">' +
            '          <button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="m2">编辑 / 预览</button>' +
            '          <button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" data-clear="editorVernacular">清空</button>' +
            '        </div>' +
            '        <div class="editor-split">' +
            '          <div class="editor-split-pane is-write" data-write="m2">' +
            '            <textarea id="editorVernacular" class="editor-textarea editor-textarea-lg" rows="10" placeholder="白话释义、分层解读等"></textarea>' +
            '          </div>' +
            '          <div class="editor-split-pane is-preview" data-preview="m2" hidden>' +
            '            <div id="editorPreviewVernacular" class="editor-preview"></div>' +
            '          </div>' +
            '        </div>' +
            '        <button type="button" class="editor-btn editor-btn-secondary" data-save-draft>保存草稿</button>' +
            '      </section>' +
            '      <section class="editor-section" data-panel="m3">' +
            '        <div class="editor-lang-grid">' +
            '          <div class="editor-lang-block">' +
            '            <label>西班牙语</label>' +
            '            <div class="editor-section-tools"><button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="m3es">预览</button><button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" data-clear="editorTransEs">清空</button></div>' +
            '            <textarea id="editorTransEs" class="editor-textarea" rows="6" placeholder="Traducción al español…"></textarea>' +
            '            <div id="editorPreviewEs" class="editor-preview editor-preview-inline" hidden></div>' +
            '          </div>' +
            '          <div class="editor-lang-block">' +
            '            <label>葡萄牙语</label>' +
            '            <div class="editor-section-tools"><button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="m3pt">预览</button><button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" data-clear="editorTransPt">清空</button></div>' +
            '            <textarea id="editorTransPt" class="editor-textarea" rows="6" placeholder="Tradução em português…"></textarea>' +
            '            <div id="editorPreviewPt" class="editor-preview editor-preview-inline" hidden></div>' +
            '          </div>' +
            '          <div class="editor-lang-block">' +
            '            <label>意大利语</label>' +
            '            <div class="editor-section-tools"><button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="m3it">预览</button><button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" data-clear="editorTransIt">清空</button></div>' +
            '            <textarea id="editorTransIt" class="editor-textarea" rows="6" placeholder="Traduzione in italiano…"></textarea>' +
            '            <div id="editorPreviewIt" class="editor-preview editor-preview-inline" hidden></div>' +
            '          </div>' +
            '        </div>' +
            '        <button type="button" class="editor-btn editor-btn-secondary" data-save-draft>保存草稿</button>' +
            '      </section>' +
            '      <section class="editor-section" data-panel="m4">' +
            '        <div class="editor-section-tools">' +
            '          <button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="m4">编辑 / 预览</button>' +
            '          <button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" id="editorAddNote">＋ 添加一条</button>' +
            '        </div>' +
            '        <div class="editor-split">' +
            '          <div class="editor-split-pane is-write" data-write="m4">' +
            '            <div id="editorTermNotes" class="editor-notes"></div>' +
            '          </div>' +
            '          <div class="editor-split-pane is-preview" data-preview="m4" hidden>' +
            '            <div id="editorPreviewTerms" class="editor-preview"></div>' +
            '          </div>' +
            '        </div>' +
            '        <button type="button" class="editor-btn editor-btn-secondary" data-save-draft>保存草稿</button>' +
            '      </section>' +
            '      <section class="editor-section" data-panel="m5">' +
            '        <div class="editor-custom-row"><label>字段键名 <input type="text" id="editorCustom1Key" class="editor-input" value="customField1" placeholder="英文字段名"></label></div>' +
            '        <textarea id="editorCustom1" class="editor-textarea" rows="4" placeholder="扩展说明、补注等"></textarea>' +
            '        <div class="editor-section-tools"><button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="c1">预览</button><button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" data-clear="editorCustom1">清空</button></div>' +
            '        <div id="editorPreviewCustom1" class="editor-preview" data-c1prev hidden></div>' +
            '        <div class="editor-custom-row"><label>字段键名 <input type="text" id="editorCustom2Key" class="editor-input" value="customField2" placeholder="英文字段名"></label></div>' +
            '        <textarea id="editorCustom2" class="editor-textarea" rows="4" placeholder="第二扩展字段"></textarea>' +
            '        <div class="editor-section-tools"><button type="button" class="editor-btn editor-btn-sm" data-preview-toggle="c2">预览</button><button type="button" class="editor-btn editor-btn-sm editor-btn-ghost" data-clear="editorCustom2">清空</button></div>' +
            '        <div id="editorPreviewCustom2" class="editor-preview" data-c2prev hidden></div>' +
            '        <button type="button" class="editor-btn editor-btn-secondary" data-save-draft>保存草稿</button>' +
            '      </section>' +
            '    </div>' +
            '  </div>' +
            '  <footer class="editor-panel-foot">' +
            '    <button type="button" class="editor-btn editor-btn-ghost" id="editorUndo" title="撤销 (Ctrl+Z)">撤销</button>' +
            '    <button type="button" class="editor-btn editor-btn-ghost" id="editorRedo" title="重做 (Ctrl+Y)">重做</button>' +
            '    <button type="button" class="editor-btn editor-btn-secondary" id="editorSaveDraftAll">保存全部草稿</button>' +
            '    <button type="button" class="editor-btn" id="editorExport">导出 JSON</button>' +
            '    <button type="button" class="editor-btn editor-btn-ghost" id="editorCopyJson">复制 JSON</button>' +
            '  </footer>' +
            '</div>' +
            '<button type="button" id="editorPill" class="editor-pill" hidden title="恢复录入面板">录入</button>';

        const wrap = document.createElement('div');
        wrap.innerHTML = html;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    }

    function populateWorkSelect() {
        const sel = qs('editorWorkSelect');
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '';
        getArticles().forEach((a) => {
            const o = document.createElement('option');
            o.value = a.id;
            const t = (a.title && a.title.zh) || a.id;
            o.textContent = t + ' (' + a.id + ')';
            sel.appendChild(o);
        });
        if (cur && [...sel.options].some((x) => x.value === cur)) sel.value = cur;
        else if (sel.options.length) sel.value = sel.options[0].value;
    }

    function openPanel() {
        injectPanel();
        populateWorkSelect();
        const panel = qs('editorPanel');
        const back = qs('editorPanelBackdrop');
        const pill = qs('editorPill');
        const ui = loadPanelUi();
        if (ui.width) panel.style.width = ui.width + 'px';
        panel.style.top = '0';
        if (pill) pill.hidden = true;
        panel.classList.remove('is-minimized');
        panel.classList.add('is-open');
        if (back) {
            back.classList.add('is-open');
            back.setAttribute('aria-hidden', 'false');
        }
        document.body.classList.add('editor-panel-open');

        const wid = qs('editorWorkSelect').value;
        const draft = loadDraftFromStorage(wid);
        if (draft && (draft.savedAt || draft.classicText !== undefined)) {
            setFormState(draft);
        } else {
            setFormState(defaultFormState(wid));
            tryFetchStringsJson(wid, function (ok) {
                if (!ok) fillFromWorkCopy(wid);
            });
        }
        historyPast = [snapshotForHistory()];
        historyFuture = [];
        resizeAllTextareas();
        refreshAllPreviews();
        panel.focus();
    }

    function closePanel(keepDraft) {
        const panel = qs('editorPanel');
        const back = qs('editorPanelBackdrop');
        if (keepDraft !== false) saveDraftToStorage(getFormState());
        if (panel) {
            panel.classList.remove('is-open');
            savePanelUi({ width: parseInt(panel.style.width, 10) || panel.offsetWidth });
        }
        if (back) {
            back.classList.remove('is-open');
            back.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('editor-panel-open');
    }

    function minimizePanel() {
        const panel = qs('editorPanel');
        const pill = qs('editorPill');
        saveDraftToStorage(getFormState());
        panel.classList.add('is-minimized');
        panel.classList.remove('is-open');
        const back = qs('editorPanelBackdrop');
        if (back) {
            back.classList.remove('is-open');
            back.setAttribute('aria-hidden', 'true');
        }
        document.body.classList.remove('editor-panel-open');
        if (pill) {
            pill.hidden = false;
        }
    }

    function bindEvents() {
        document.addEventListener('click', function (e) {
            const openBtn = e.target.closest('#editorPanelOpen');
            if (openBtn) {
                e.preventDefault();
                openPanel();
            }
        });

        document.addEventListener('keydown', function (e) {
            const panel = qs('editorPanel');
            if (!panel || !panel.classList.contains('is-open')) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                closePanel();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                redo();
            }
        });

        document.body.addEventListener('click', function (e) {
            const t = e.target;
            if (t.id === 'editorClose') {
                closePanel();
                return;
            }
            if (t.id === 'editorMinimize') {
                minimizePanel();
                return;
            }
            if (t.id === 'editorPanelBackdrop') {
                closePanel();
                return;
            }
            if (t.id === 'editorPill') {
                openPanel();
                return;
            }
            if (t.id === 'editorSaveDraftAll' || t.closest('[data-save-draft]')) {
                saveDraftToStorage(getFormState());
                return;
            }
            if (t.id === 'editorUndo') {
                undo();
                return;
            }
            if (t.id === 'editorRedo') {
                redo();
                return;
            }
            if (t.id === 'editorLoadTemplate') {
                if (manualWorkIdInvalid()) {
                    alert('「新篇目 ID」格式不正确，请先修正。');
                    return;
                }
                const wid = getEffectiveWorkId();
                if (!wid) {
                    alert('请选择篇目或填写新篇目 ID。');
                    return;
                }
                if (fillFromWorkCopy(wid)) return;
                tryFetchStringsJson(wid, function (ok) {
                    if (!ok) alert('未能加载（仅本地通过 http 服务打开站点时可读取 content/works）。可先导出或在篇目页用构建后的数据。');
                });
                return;
            }
            if (t.id === 'editorImportFile') {
                qs('editorImportInput').click();
                return;
            }
            if (t.id === 'editorAddNote') {
                addNoteRow('', '', true);
                return;
            }
            if (t.id === 'editorExport') {
                if (!validateWorkIdForExport()) return;
                const st = getFormState();
                const exp = buildExportObject(st);
                const out = { _exportNote: exp._exportNote, zh: exp.zh, es: exp.es, pt: exp.pt, it: exp.it };
                downloadJson(out, 'strings-fragment-' + st.workId + '.json');
                return;
            }
            if (t.id === 'editorCopyJson') {
                if (!validateWorkIdForExport()) return;
                const st = getFormState();
                const exp = buildExportObject(st);
                const out = { _exportNote: exp._exportNote, zh: exp.zh, es: exp.es, pt: exp.pt, it: exp.it };
                navigator.clipboard.writeText(JSON.stringify(out, null, 4)).then(function () {
                    alert('JSON 已复制到剪贴板。');
                }).catch(function () {
                    alert('复制失败，请使用「导出 JSON」下载文件。');
                });
                return;
            }
            const tab = t.closest('.editor-tab');
            if (tab && tab.dataset.tab) {
                document.querySelectorAll('.editor-tab').forEach((x) => x.classList.toggle('is-active', x === tab));
                document.querySelectorAll('.editor-section').forEach((x) => {
                    x.classList.toggle('is-active', x.getAttribute('data-panel') === tab.dataset.tab);
                });
                return;
            }
            const ptog = t.closest('[data-preview-toggle]');
            if (ptog) {
                const k = ptog.getAttribute('data-preview-toggle');
                if (k === 'm3es' || k === 'm3pt' || k === 'm3it') {
                    const idMap = { m3es: ['editorTransEs', 'editorPreviewEs'], m3pt: ['editorTransPt', 'editorPreviewPt'], m3it: ['editorTransIt', 'editorPreviewIt'] };
                    const pr = qs(idMap[k][1]);
                    const ta = qs(idMap[k][0]);
                    const on = pr.hasAttribute('hidden');
                    if (on) {
                        pr.removeAttribute('hidden');
                        syncPreview(idMap[k][1], ta.value);
                    } else pr.setAttribute('hidden', '');
                    return;
                }
                if (k === 'c1') {
                    const pr = qs('editorPreviewCustom1');
                    const on = pr.hasAttribute('hidden');
                    if (on) {
                        pr.removeAttribute('hidden');
                        syncPreview('editorPreviewCustom1', qs('editorCustom1').value);
                    } else pr.setAttribute('hidden', '');
                    return;
                }
                if (k === 'c2') {
                    const pr = qs('editorPreviewCustom2');
                    const on = pr.hasAttribute('hidden');
                    if (on) {
                        pr.removeAttribute('hidden');
                        syncPreview('editorPreviewCustom2', qs('editorCustom2').value);
                    } else pr.setAttribute('hidden', '');
                    return;
                }
                const sec = document.querySelector('.editor-section[data-panel="' + k + '"]');
                if (!sec) return;
                const w = sec.querySelector('[data-write="' + k + '"]');
                const p = sec.querySelector('[data-preview="' + k + '"]');
                if (!w || !p) return;
                const showPrev = w.hasAttribute('hidden');
                if (showPrev) {
                    w.removeAttribute('hidden');
                    p.setAttribute('hidden', '');
                } else {
                    w.setAttribute('hidden', '');
                    p.removeAttribute('hidden');
                    refreshAllPreviews();
                }
                return;
            }
            const clr = t.closest('[data-clear]');
            if (clr) {
                const id = clr.getAttribute('data-clear');
                const el = qs(id);
                if (el) {
                    el.value = '';
                    resizeTextarea(el);
                    debouncedHistory();
                    refreshAllPreviews();
                }
            }
        });

        document.body.addEventListener('change', function (e) {
            if (e.target.id === 'editorWorkSelect') {
                if (qs('editorWorkIdManual')) qs('editorWorkIdManual').value = '';
                const wid = e.target.value;
                const draft = loadDraftFromStorage(wid);
                if (draft && (draft.savedAt || draft.classicText !== undefined)) setFormState(draft);
                else {
                    setFormState(defaultFormState(wid));
                    tryFetchStringsJson(wid, function (ok) {
                        if (!ok) fillFromWorkCopy(wid);
                    });
                }
                historyPast = [snapshotForHistory()];
                historyFuture = [];
            }
            if (e.target.id === 'editorWorkIdManual') {
                if (manualWorkIdInvalid()) return;
                const raw = getManualWorkIdRaw();
                const wid = raw && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(raw) ? raw : qs('editorWorkSelect').value;
                const draft = loadDraftFromStorage(wid);
                if (draft && (draft.savedAt || draft.classicText !== undefined)) setFormState(draft);
                else {
                    setFormState(defaultFormState(wid));
                    tryFetchStringsJson(wid, function (ok) {
                        if (!ok) fillFromWorkCopy(wid);
                    });
                }
                historyPast = [snapshotForHistory()];
                historyFuture = [];
            }
            if (e.target.id === 'editorImportInput' && e.target.files && e.target.files[0]) {
                const f = e.target.files[0];
                const r = new FileReader();
                r.onload = function () {
                    try {
                        const j = JSON.parse(r.result);
                        const zh = j.zh || {};
                        const notes = [];
                        if (zh.termNotesBlock && String(zh.termNotesBlock).trim()) {
                            notes.push({ title: '', body: String(zh.termNotesBlock).trim() });
                        } else {
                            for (let i = 1; i <= 24; i++) {
                                const ta = zh['termRow' + i + 'a'];
                                const tb = zh['termRow' + i + 'b'];
                                if ((ta && String(ta).trim()) || (tb && String(tb).trim())) {
                                    notes.push({ title: (ta && String(ta)) || '', body: (tb && String(tb)) || '' });
                                }
                            }
                        }
                        setFormState({
                            workId: qs('editorWorkSelect').value,
                            classicText: zh.classicText || '',
                            vernacularText: zh.vernacularText || '',
                            transEs: (j.es && j.es.translationText) || '',
                            transPt: (j.pt && j.pt.translationText) || '',
                            transIt: (j.it && j.it.translationText) || '',
                            termNotes: notes.length ? notes : [{ title: '', body: '' }],
                            custom1: zh.customField1 || '',
                            custom2: zh.customField2 || ''
                        });
                        historyPast = [snapshotForHistory()];
                        historyFuture = [];
                        refreshAllPreviews();
                    } catch (err) {
                        alert('JSON 解析失败');
                    }
                };
                r.readAsText(f, 'UTF-8');
                e.target.value = '';
            }
        });

        document.body.addEventListener(
            'input',
            function (e) {
                if (!e.target.closest('#editorPanel')) return;
                if (e.target.tagName === 'TEXTAREA') resizeTextarea(e.target);
                debouncedHistory();
                refreshAllPreviews();
            },
            true
        );

        const startResize = function (e) {
            const panel = qs('editorPanel');
            if (!panel || !panel.classList.contains('is-open')) return;
            e.preventDefault();
            const startX = e.clientX;
            const startW = panel.offsetWidth;
            function move(ev) {
                const dx = startX - ev.clientX;
                const w = Math.min(Math.max(startW + dx, 320), Math.min(window.innerWidth - 24, 920));
                panel.style.width = w + 'px';
            }
            function up() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
                savePanelUi({ width: panel.offsetWidth });
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        };

        document.body.addEventListener('mousedown', function (e) {
            if (e.target && e.target.id === 'editorPanelResize') startResize(e);
        });

        let dragStartY = 0;
        let dragStartTop = 0;
        document.body.addEventListener('mousedown', function (e) {
            const h = e.target.closest('#editorPanelDrag');
            const panel = qs('editorPanel');
            if (!h || !panel || e.target.closest('.editor-panel-head-actions')) return;
            e.preventDefault();
            dragStartY = e.clientY;
            dragStartTop = parseInt(panel.style.top, 10) || 0;
            function move(ev) {
                const dy = ev.clientY - dragStartY;
                let t = dragStartTop + dy;
                t = Math.max(-40, Math.min(t, window.innerHeight - 120));
                panel.style.top = t + 'px';
            }
            function up() {
                document.removeEventListener('mousemove', move);
                document.removeEventListener('mouseup', up);
            }
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        });
    }

    function init() {
        injectPanel();
        if (qs('editorTermNotes') && qs('editorTermNotes').children.length === 0) {
            addNoteRow('', '', false);
        }
        bindEvents();
        populateWorkSelect();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
