/**
 * 汉学桥 · 评论 API + 文献录入接口 + 静态站点同源托管
 *
 * 启动：cd server && npm install && copy .env.example .env 后编辑 ADMIN_SECRET，再 npm start
 */
'use strict';

const path = require('path');
const fs = require('fs');
const vm = require('vm');
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const PROJECT_ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(__dirname, '.env');
const LITERATURE_JS_PATH = path.join(PROJECT_ROOT, 'data', 'literature-site.js');
/** 新增章节时复制页面结构的范本目录（道德经第一章） */
const CHAPTER_SHELL_PROTOTYPE_DIR = path.join(PROJECT_ROOT, 'articles', 'ddj', 'chapter-1');
const WORK_OVERVIEW_PROTOTYPE_HTML = path.join(PROJECT_ROOT, 'articles', 'ddj', 'index.html');

function loadEnvFile() {
    if (!fs.existsSync(ENV_PATH)) return;
    const raw = fs.readFileSync(ENV_PATH, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) return;
        const k = m[1].trim();
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        if (process.env[k] == null || process.env[k] === '') process.env[k] = v;
    });
}

loadEnvFile();

const PORT = parseInt(process.env.PORT || '8787', 10);
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
const ALLOWED = (process.env.COMMENTS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const DB_PATH = path.join(__dirname, 'comments.sqlite');
const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_folder TEXT NOT NULL,
  chapter_segment TEXT NOT NULL,
  parent_id INTEGER,
  nickname TEXT NOT NULL,
  body TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  pinned INTEGER NOT NULL DEFAULT 0,
  admin_reply TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);
CREATE INDEX IF NOT EXISTS idx_comments_scope ON comments(work_folder, chapter_segment);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS scholar_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_folder TEXT NOT NULL,
  chapter_segment TEXT NOT NULL,
  scholar_name TEXT NOT NULL,
  lang TEXT NOT NULL,
  body TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scholar_notes_scope ON scholar_notes(work_folder, chapter_segment);
`);

const app = express();

app.use(
    cors({
        origin(origin, cb) {
            if (!origin) return cb(null, true);
            if (!ALLOWED.length) return cb(null, true);
            if (ALLOWED.includes(origin)) return cb(null, true);
            cb(new Error('Not allowed by CORS'));
        },
        credentials: false
    })
);

app.post('/api/admin/literature', express.json({ limit: '25mb' }), literatureAdminPost);

app.use(express.json({ limit: '64kb' }));

function safeStr(s, max) {
    if (s == null) return '';
    const t = String(s).trim();
    return t.length > max ? t.slice(0, max) : t;
}

/** 保留正文换行，仅截断长度（汉学家评注等） */
function safeStrKeepLen(s, max) {
    if (s == null) return '';
    const t = String(s);
    return t.length > max ? t.slice(0, max) : t;
}

const SCHOLAR_BODY_MAX = 120000;
const SCHOLAR_NAME_MAX = 160;

function scholarLangOk(lang) {
    const l = safeStr(lang, 8).toLowerCase();
    return l === 'zh' || l === 'es' || l === 'pt' || l === 'it' ? l : null;
}

/** 评论正文：库内为 JSON 字符串 { zh, es, pt, it }；兼容旧版纯文本仅中文 */
function parseBodiesStored(raw) {
    if (raw == null || raw === '') return { zh: '', es: '', pt: '', it: '' };
    try {
        const o = JSON.parse(raw);
        if (o && typeof o === 'object' && !Array.isArray(o)) {
            return {
                zh: safeStr(o.zh, 8000),
                es: safeStr(o.es, 8000),
                pt: safeStr(o.pt, 8000),
                it: safeStr(o.it, 8000)
            };
        }
    } catch (e) {
        /* legacy plain text */
    }
    return { zh: safeStr(raw, 8000), es: '', pt: '', it: '' };
}

function bodiesFromRequest(reqBody) {
    if (reqBody.bodies && typeof reqBody.bodies === 'object') {
        return {
            zh: safeStr(reqBody.bodies.zh, 2000),
            es: safeStr(reqBody.bodies.es, 2000),
            pt: safeStr(reqBody.bodies.pt, 2000),
            it: safeStr(reqBody.bodies.it, 2000)
        };
    }
    const legacy = safeStr(reqBody.body, 2000);
    return { zh: legacy, es: '', pt: '', it: '' };
}

function bodiesHasAny(b) {
    return !!(b.zh || b.es || b.pt || b.it);
}

function bodiesToStore(b) {
    return JSON.stringify(b);
}

function adminReplyFromRequest(reqBody) {
    if (reqBody.adminReplies && typeof reqBody.adminReplies === 'object') {
        const o = {
            zh: safeStr(reqBody.adminReplies.zh, 2000),
            es: safeStr(reqBody.adminReplies.es, 2000),
            pt: safeStr(reqBody.adminReplies.pt, 2000),
            it: safeStr(reqBody.adminReplies.it, 2000)
        };
        return bodiesHasAny(o) ? bodiesToStore(o) : null;
    }
    const t = safeStr(reqBody.adminReply, 4000);
    return t ? bodiesToStore({ zh: t, es: '', pt: '', it: '' }) : null;
}

function requireAdmin(req, res) {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
    if (!ADMIN_SECRET || token !== ADMIN_SECRET) {
        res.status(401).json({ error: '需要管理员密钥' });
        return false;
    }
    return true;
}

function loadLiteratureFromDisk() {
    const code = fs.readFileSync(LITERATURE_JS_PATH, 'utf8');
    const ctx = { window: {} };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    const literatureSite = ctx.window.LITERATURE_SITE;
    const workCopy = ctx.window.WORK_COPY || {};
    if (!literatureSite || typeof literatureSite !== 'object') {
        throw new Error('找不到 LITERATURE_SITE');
    }
    return { literatureSite, workCopy };
}

function writeLiteratureToDisk(literatureSite, workCopy) {
    const banner =
        '/**\n * 文献站点总数据（录入后台一键发布写入）\n * 说明见 docs/动态站点技术说明.md\n */\n';
    const text =
        banner +
        `window.LITERATURE_SITE = ${JSON.stringify(literatureSite, null, 2)};\n\nwindow.WORK_COPY = ${JSON.stringify(workCopy, null, 2)};\n`;
    fs.writeFileSync(LITERATURE_JS_PATH, text, 'utf8');
}

function patchChapterShellHtml(html, folder, segment, chapterId) {
    return html
        .replace(/data-literature-work-folder="[^"]*"/g, `data-literature-work-folder="${folder}"`)
        .replace(/data-literature-chapter-segment="[^"]*"/g, `data-literature-chapter-segment="${segment}"`)
        .replace(/data-work-id="[^"]*"/g, `data-work-id="${chapterId}"`);
}

function patchWorkOverviewHtml(html, folder, firstSegment) {
    let out = html
        .replace(/data-literature-work-folder="[^"]*"/g, `data-literature-work-folder="${folder}"`)
        .replace(/href="chapter-1\/m1\.html"/g, `href="${firstSegment}/m1.html"`);
    out = out.replace(/<title>[^<]*<\/title>/, '<title>文献总览 - 汉学桥</title>');
    return out;
}

function syncLiteratureHtmlShells(literatureSite) {
    if (!fs.existsSync(CHAPTER_SHELL_PROTOTYPE_DIR)) {
        console.warn('[literature] 缺少章节范本目录:', CHAPTER_SHELL_PROTOTYPE_DIR);
        return;
    }
    if (!fs.existsSync(WORK_OVERVIEW_PROTOTYPE_HTML)) {
        console.warn('[literature] 缺少文献总览范本:', WORK_OVERVIEW_PROTOTYPE_HTML);
        return;
    }
    const overviewProto = fs.readFileSync(WORK_OVERVIEW_PROTOTYPE_HTML, 'utf8');
    const chapterFiles = ['index.html', 'm1.html', 'm2.html', 'm3.html', 'm4.html', 'm5.html'];
    const works = Array.isArray(literatureSite.works) ? literatureSite.works : [];

    for (const work of works) {
        if (!work || !work.folder || !Array.isArray(work.chapters) || !work.chapters.length) continue;
        const wf = path.join(PROJECT_ROOT, 'articles', work.folder);
        const firstSeg = work.chapters[0].segment || 'chapter-1';
        const overviewPath = path.join(wf, 'index.html');
        if (!fs.existsSync(overviewPath)) {
            fs.mkdirSync(wf, { recursive: true });
            fs.writeFileSync(
                overviewPath,
                patchWorkOverviewHtml(overviewProto, work.folder, firstSeg),
                'utf8'
            );
            console.log('[literature] 已生成文献总览页:', overviewPath);
        }

        for (const ch of work.chapters) {
            if (!ch.segment || !ch.id) continue;
            const dir = path.join(wf, ch.segment);
            for (const fname of chapterFiles) {
                const target = path.join(dir, fname);
                if (fs.existsSync(target)) continue;
                const protoPath = path.join(CHAPTER_SHELL_PROTOTYPE_DIR, fname);
                if (!fs.existsSync(protoPath)) continue;
                const raw = fs.readFileSync(protoPath, 'utf8');
                const patched = patchChapterShellHtml(raw, work.folder, ch.segment, ch.id);
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(target, patched, 'utf8');
                console.log('[literature] 已生成页面:', target);
            }
        }
    }
}

function literatureAdminGet(req, res) {
    if (!requireAdmin(req, res)) return;
    try {
        const { literatureSite, workCopy } = loadLiteratureFromDisk();
        res.json({ literatureSite, workCopy });
    } catch (e) {
        res.status(500).json({ error: e.message || String(e) });
    }
}

function literatureAdminPost(req, res) {
    if (!requireAdmin(req, res)) return;
    const body = req.body || {};
    const literatureSite = body.literatureSite;
    const workCopy = body.workCopy || {};
    if (!literatureSite || literatureSite.version == null) {
        res.status(400).json({ error: '发布失败：数据结构不完整。' });
        return;
    }
    try {
        writeLiteratureToDisk(literatureSite, workCopy);
        syncLiteratureHtmlShells(literatureSite);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message || String(e) });
    }
}

/** 前台：当前章节评论树 */
app.get('/api/comments', (req, res) => {
    const work = safeStr(req.query.work, 64);
    const chapter = safeStr(req.query.chapter, 64);
    if (!work || !chapter) {
        res.status(400).json({ error: '缺少 work 或 chapter' });
        return;
    }

    const rows = db
        .prepare(
            `SELECT id, parent_id, nickname, body, likes, pinned, admin_reply, created_at
       FROM comments WHERE work_folder = ? AND chapter_segment = ?
       ORDER BY pinned DESC, created_at ASC`
        )
        .all(work, chapter);

    const byId = new Map();
    rows.forEach((r) => {
        const bodies = parseBodiesStored(r.body);
        const adminReplies = parseBodiesStored(r.admin_reply);
        byId.set(r.id, {
            id: r.id,
            parentId: r.parent_id,
            nickname: r.nickname,
            bodies,
            likes: r.likes,
            pinned: !!r.pinned,
            adminReplies,
            createdAt: r.created_at,
            replies: []
        });
    });

    const roots = [];
    byId.forEach((node) => {
        if (node.parentId == null) {
            roots.push(node);
        } else {
            const p = byId.get(node.parentId);
            if (p && p.replies) {
                p.replies.push({
                    id: node.id,
                    parentId: node.parentId,
                    nickname: node.nickname,
                    bodies: node.bodies,
                    likes: node.likes,
                    adminReplies: { zh: '', es: '', pt: '', it: '' },
                    createdAt: node.createdAt,
                    pinned: false,
                    replies: []
                });
            }
        }
    });

    roots.sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return String(a.createdAt).localeCompare(String(b.createdAt));
    });

    res.json({ work, chapter, comments: roots });
});

/** 发表评论或回复（一层楼中楼） */
app.post('/api/comments', (req, res) => {
    const work = safeStr(req.body.work, 64);
    const chapter = safeStr(req.body.chapter, 64);
    const nickname = safeStr(req.body.nickname, 32);
    const bodies = bodiesFromRequest(req.body);
    const parentId =
        req.body.parentId == null || req.body.parentId === ''
            ? null
            : parseInt(req.body.parentId, 10);

    if (!work || !chapter || !nickname || !bodiesHasAny(bodies)) {
        res.status(400).json({ error: '请填写昵称，并在至少一种语言下填写评论内容' });
        return;
    }

    if (parentId != null && (!Number.isFinite(parentId) || parentId <= 0)) {
        res.status(400).json({ error: '回复目标无效' });
        return;
    }

    if (parentId != null) {
        const parent = db
            .prepare(
                `SELECT id, parent_id FROM comments WHERE id = ? AND work_folder = ? AND chapter_segment = ?`
            )
            .get(parentId, work, chapter);
        if (!parent || parent.parent_id != null) {
            res.status(400).json({ error: '仅支持回复主楼评论' });
            return;
        }
    }

    const createdAt = new Date().toISOString();
    const stored = bodiesToStore(bodies);
    const info = db
        .prepare(
            `INSERT INTO comments (work_folder, chapter_segment, parent_id, nickname, body, likes, pinned, admin_reply, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, NULL, ?)`
        )
        .run(work, chapter, parentId, nickname, stored, createdAt);

    res.status(201).json({
        id: info.lastInsertRowid,
        parentId,
        nickname,
        bodies,
        likes: 0,
        pinned: false,
        adminReplies: { zh: '', es: '', pt: '', it: '' },
        createdAt
    });
});

/** 点赞 */
app.post('/api/comments/:id/like', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const work = safeStr(req.body.work, 64);
    const chapter = safeStr(req.body.chapter, 64);
    if (!Number.isFinite(id) || !work || !chapter) {
        res.status(400).json({ error: '参数错误' });
        return;
    }

    const r = db
        .prepare(`UPDATE comments SET likes = likes + 1 WHERE id = ? AND work_folder = ? AND chapter_segment = ?`)
        .run(id, work, chapter);

    if (r.changes === 0) {
        res.status(404).json({ error: '评论不存在' });
        return;
    }

    const row = db
        .prepare(`SELECT likes FROM comments WHERE id = ?`)
        .get(id);
    res.json({ id, likes: row.likes });
});

/** 管理员：列表（按章节筛选） */
app.get('/api/admin/comments', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const work = safeStr(req.query.work, 64);
    const chapter = safeStr(req.query.chapter, 64);
    if (!work || !chapter) {
        res.status(400).json({ error: '缺少 work 或 chapter' });
        return;
    }

    const rows = db
        .prepare(
            `SELECT id, parent_id, nickname, body, likes, pinned, admin_reply, created_at
       FROM comments WHERE work_folder = ? AND chapter_segment = ?
       ORDER BY pinned DESC, created_at DESC`
        )
        .all(work, chapter);

    const items = rows.map((r) => ({
        id: r.id,
        parent_id: r.parent_id,
        nickname: r.nickname,
        bodies: parseBodiesStored(r.body),
        likes: r.likes,
        pinned: !!r.pinned,
        adminReplies: parseBodiesStored(r.admin_reply),
        created_at: r.created_at
    }));

    res.json({ work, chapter, items });
});

/** 管理员：删除（主楼及其回复一并删除） */
app.delete('/api/admin/comments/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'id 无效' });
        return;
    }

    const row = db.prepare(`SELECT id FROM comments WHERE id = ?`).get(id);
    if (!row) {
        res.status(404).json({ error: '不存在' });
        return;
    }

    db.prepare(`DELETE FROM comments WHERE parent_id = ?`).run(id);
    db.prepare(`DELETE FROM comments WHERE id = ?`).run(id);
    res.json({ ok: true });
});

/** 管理员：置顶（仅主楼） */
app.patch('/api/admin/comments/:id/pin', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    const pinned = !!req.body.pinned;
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'id 无效' });
        return;
    }

    const info = db
        .prepare(
            `UPDATE comments SET pinned = ? WHERE id = ? AND parent_id IS NULL`
        )
        .run(pinned ? 1 : 0, id);

    if (info.changes === 0) {
        res.status(400).json({ error: '只能置顶主楼，或评论不存在' });
        return;
    }
    res.json({ ok: true, id, pinned });
});

/** 管理员：官方回复（显示在该评论下方） */
app.patch('/api/admin/comments/:id/admin-reply', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    const stored = adminReplyFromRequest(req.body);
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'id 无效' });
        return;
    }

    const info = db
        .prepare(`UPDATE comments SET admin_reply = ? WHERE id = ? AND parent_id IS NULL`)
        .run(stored, id);

    if (info.changes === 0) {
        res.status(400).json({ error: '只能对主楼添加官方回复，或评论不存在' });
        return;
    }
    res.json({ ok: true, id });
});

/** 前台：本章汉学家评注（只读） */
app.get('/api/scholar-notes', (req, res) => {
    const work = safeStr(req.query.work, 64);
    const chapter = safeStr(req.query.chapter, 64);
    if (!work || !chapter) {
        res.status(400).json({ error: '缺少 work 或 chapter' });
        return;
    }

    const rows = db
        .prepare(
            `SELECT id, scholar_name AS scholarName, lang, body, pinned, sort_order AS sortOrder, created_at AS createdAt
       FROM scholar_notes WHERE work_folder = ? AND chapter_segment = ?
       ORDER BY pinned DESC, sort_order ASC, id ASC`
        )
        .all(work, chapter);

    res.json({
        work,
        chapter,
        notes: rows.map((r) => ({
            id: r.id,
            scholarName: r.scholarName,
            lang: r.lang,
            body: r.body,
            pinned: !!r.pinned,
            sortOrder: r.sortOrder,
            createdAt: r.createdAt
        }))
    });
});

/** 管理员：新增汉学家评注 */
app.post('/api/admin/scholar-notes', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const work = safeStr(req.body.work, 64);
    const chapter = safeStr(req.body.chapter, 64);
    const scholarName = safeStr(req.body.scholarName, SCHOLAR_NAME_MAX);
    const lang = scholarLangOk(req.body.lang);
    const body = safeStrKeepLen(req.body.body, SCHOLAR_BODY_MAX);
    const pinned = !!req.body.pinned;

    if (!work || !chapter || !scholarName || !lang || !body.trim()) {
        res.status(400).json({ error: '请填写文献、章节、姓名、语种与评注正文（均为必填）' });
        return;
    }

    const now = new Date().toISOString();
    const mx = db
        .prepare(
            `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM scholar_notes WHERE work_folder = ? AND chapter_segment = ?`
        )
        .get(work, chapter);
    const sortOrder = mx && mx.n != null ? mx.n : 0;

    const info = db
        .prepare(
            `INSERT INTO scholar_notes (work_folder, chapter_segment, scholar_name, lang, body, pinned, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(work, chapter, scholarName, lang, body, pinned ? 1 : 0, sortOrder, now, now);

    res.status(201).json({
        id: info.lastInsertRowid,
        work,
        chapter,
        scholarName,
        lang,
        body,
        pinned,
        sortOrder,
        createdAt: now,
        updatedAt: now
    });
});

/** 管理员：修改评注 */
app.patch('/api/admin/scholar-notes/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'id 无效' });
        return;
    }

    const row = db.prepare(`SELECT * FROM scholar_notes WHERE id = ?`).get(id);
    if (!row) {
        res.status(404).json({ error: '不存在' });
        return;
    }

    let scholarName = row.scholar_name;
    if (req.body.scholarName !== undefined) {
        scholarName = safeStr(req.body.scholarName, SCHOLAR_NAME_MAX);
    }
    let lang = row.lang;
    if (req.body.lang !== undefined) {
        const nl = scholarLangOk(req.body.lang);
        if (!nl) {
            res.status(400).json({ error: '语种必须是 zh / es / pt / it 之一' });
            return;
        }
        lang = nl;
    }
    let body = row.body;
    if (req.body.body !== undefined) {
        body = safeStrKeepLen(req.body.body, SCHOLAR_BODY_MAX);
        if (!body.trim()) {
            res.status(400).json({ error: '评注正文不能为空' });
            return;
        }
    }
    let pinned = row.pinned;
    if (req.body.pinned !== undefined) {
        pinned = req.body.pinned ? 1 : 0;
    }

    if (!scholarName.trim()) {
        res.status(400).json({ error: '姓名不能为空' });
        return;
    }

    const now = new Date().toISOString();
    db.prepare(
        `UPDATE scholar_notes SET scholar_name = ?, lang = ?, body = ?, pinned = ?, updated_at = ? WHERE id = ?`
    ).run(scholarName, lang, body, pinned, now, id);

    res.json({
        ok: true,
        id,
        scholarName,
        lang,
        body,
        pinned: !!pinned,
        updatedAt: now
    });
});

/** 管理员：删除评注 */
app.delete('/api/admin/scholar-notes/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'id 无效' });
        return;
    }

    const info = db.prepare(`DELETE FROM scholar_notes WHERE id = ?`).run(id);
    if (info.changes === 0) {
        res.status(404).json({ error: '不存在' });
        return;
    }
    res.json({ ok: true });
});

/** 管理员：按数组顺序重写 sort_order */
app.post('/api/admin/scholar-notes/reorder', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const work = safeStr(req.body.work, 64);
    const chapter = safeStr(req.body.chapter, 64);
    const orderedIds = req.body.orderedIds;
    if (!work || !chapter || !Array.isArray(orderedIds)) {
        res.status(400).json({ error: '缺少 work、chapter 或 orderedIds' });
        return;
    }

    const existing = db
        .prepare(`SELECT id FROM scholar_notes WHERE work_folder = ? AND chapter_segment = ? ORDER BY sort_order ASC, id ASC`)
        .all(work, chapter)
        .map((r) => r.id);

    const uniq = orderedIds.map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x));
    if (uniq.length !== existing.length || uniq.length !== new Set(uniq).size) {
        res.status(400).json({ error: '排序列表与本章评注条目不匹配' });
        return;
    }
    for (let i = 0; i < existing.length; i++) {
        if (!uniq.includes(existing[i])) {
            res.status(400).json({ error: '排序列表与本章评注条目不匹配' });
            return;
        }
    }

    const now = new Date().toISOString();
    const tx = db.transaction(() => {
        uniq.forEach((noteId, idx) => {
            db.prepare(
                `UPDATE scholar_notes SET sort_order = ?, updated_at = ? WHERE id = ? AND work_folder = ? AND chapter_segment = ?`
            ).run(idx, now, noteId, work, chapter);
        });
    });
    tx();

    res.json({ ok: true });
});

/** 文献站点 JSON：读写 data/literature-site.js（须在 static 之前注册，避免被静态托管吞掉） */
app.post('/api/admin/literature', express.json({ limit: '25mb' }), literatureAdminPost);
app.get('/api/admin/literature', literatureAdminGet);

/** 可选：托管整个静态站点（与 API 同源，前台可用相对路径 /api/...） */
app.use(express.static(PROJECT_ROOT));

app.listen(PORT, () => {
    console.log(`汉学桥服务 http://localhost:${PORT}（评论 / 汉学家评注 / 文献录入 API）`);
    console.log(`静态根目录: ${PROJECT_ROOT}`);
    if (!ADMIN_SECRET) {
        console.warn('[warn] 未配置 ADMIN_SECRET，管理接口将拒绝访问。请复制 server/.env.example 为 .env 并填写。');
    }
});
