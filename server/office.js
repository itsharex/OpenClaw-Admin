/**
 * Office API - 智能体(Agent)管理与模板系统
 * Routes:
 *   GET    /api/office/agents         - 获取智能体列表
 *   POST   /api/office/agents         - 创建智能体
 *   GET    /api/office/agents/:id     - 获取单个智能体
 *   PUT    /api/office/agents/:id     - 更新智能体
 *   DELETE /api/office/agents/:id     - 删除智能体
 *   GET    /api/office/templates      - 获取智能体模板列表
 */

import { randomUUID } from 'crypto'
import db from './database.js'
import { requirePermission } from './auth.js'

export function registerOfficeRoutes(app) {
  // ============================================================
  // Middleware: RBAC 权限说明
  // office:agents:read  - 查看智能体列表和详情
  // office:agents:write - 创建/编辑/删除智能体
  // office:templates:read - 查看模板列表
  // office:templates:write - 管理模板
  // ============================================================

  /**
   * GET /api/office/agents
   * 获取智能体列表（支持分页、搜索、状态过滤）
   */
  app.get('/api/office/agents', requirePermission('office:agents:read'), (req, res) => {
    try {
      const { page = 1, pageSize = 20, search, status, category } = req.query
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(pageSize)))

      let where = 'WHERE 1=1'
      const params = []

      if (status) {
        where += ' AND status = ?'
        params.push(status)
      }
      if (category) {
        where += ' AND category = ?'
        params.push(category)
      }
      if (search) {
        where += ' AND (name LIKE ? OR description LIKE ?)'
        params.push(`%${search}%`, `%${search}%`)
      }

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM agents ${where}`).get(...params)
      const total = countRow?.total ?? 0

      const rows = db.prepare(`
        SELECT * FROM agents ${where}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, Math.min(100, parseInt(pageSize)), offset)

      const agents = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        avatar: row.avatar,
        category: row.category,
        status: row.status,
        config: JSON.parse(row.config || '{}'),
        stats: JSON.parse(row.stats || '{}'),
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      res.json({
        ok: true,
        data: agents,
        pagination: {
          page: parseInt(page),
          pageSize: Math.min(100, parseInt(pageSize)),
          total,
          totalPages: Math.ceil(total / Math.min(100, parseInt(pageSize))),
        },
      })
    } catch (err) {
      console.error('[Office] GET /api/office/agents error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * POST /api/office/agents
   * 创建智能体
   */
  app.post('/api/office/agents', requirePermission('office:agents:write'), (req, res) => {
    try {
      const { name, description, avatar, category, status, config } = req.body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ ok: false, error: { message: 'name is required' } })
      }
      if (name.trim().length > 100) {
        return res.status(400).json({ ok: false, error: { message: 'name too long (max 100 chars)' } })
      }

      const id = randomUUID()
      const now = Date.now()
      const userId = req.auth?.userId || null

      db.prepare(`
        INSERT INTO agents (id, name, description, avatar, category, status, config, stats, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        name.trim(),
        description || '',
        avatar || '',
        category || 'general',
        status || 'active',
        JSON.stringify(config || {}),
        JSON.stringify({ conversations: 0, messages: 0 }),
        userId,
        now,
        now
      )

      const agent = {
        id,
        name: name.trim(),
        description: description || '',
        avatar: avatar || '',
        category: category || 'general',
        status: status || 'active',
        config: config || {},
        stats: { conversations: 0, messages: 0 },
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }

      console.log(`[Office] Agent created: ${id} by user ${userId}`)
      res.json({ ok: true, data: agent })
    } catch (err) {
      console.error('[Office] POST /api/office/agents error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * GET /api/office/agents/:id
   * 获取单个智能体详情
   */
  app.get('/api/office/agents/:id', requirePermission('office:agents:read'), (req, res) => {
    try {
      const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id)
      if (!row) {
        return res.status(404).json({ ok: false, error: { message: 'Agent not found' } })
      }

      res.json({
        ok: true,
        data: {
          id: row.id,
          name: row.name,
          description: row.description,
          avatar: row.avatar,
          category: row.category,
          status: row.status,
          config: JSON.parse(row.config || '{}'),
          stats: JSON.parse(row.stats || '{}'),
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      })
    } catch (err) {
      console.error('[Office] GET /api/office/agents/:id error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * PUT /api/office/agents/:id
   * 更新智能体
   */
  app.put('/api/office/agents/:id', requirePermission('office:agents:write'), (req, res) => {
    try {
      const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(req.params.id)
      if (!existing) {
        return res.status(404).json({ ok: false, error: { message: 'Agent not found' } })
      }

      const { name, description, avatar, category, status, config } = req.body
      const now = Date.now()

      // Fetch current values for partial update
      const current = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id)
      const newName = name !== undefined ? name.trim() : current.name
      const newDescription = description !== undefined ? description : current.description
      const newAvatar = avatar !== undefined ? avatar : current.avatar
      const newCategory = category !== undefined ? category : current.category
      const newStatus = status !== undefined ? status : current.status
      const newConfig = config !== undefined ? JSON.stringify(config) : current.config

      if (newName.length === 0 || newName.length > 100) {
        return res.status(400).json({ ok: false, error: { message: 'name must be 1-100 chars' } })
      }

      db.prepare(`
        UPDATE agents
        SET name=?, description=?, avatar=?, category=?, status=?, config=?, updated_at=?
        WHERE id=?
      `).run(newName, newDescription, newAvatar, newCategory, newStatus, newConfig, now, req.params.id)

      console.log(`[Office] Agent updated: ${req.params.id}`)
      res.json({ ok: true, updatedAt: now })
    } catch (err) {
      console.error('[Office] PUT /api/office/agents/:id error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * DELETE /api/office/agents/:id
   * 删除智能体
   */
  app.delete('/api/office/agents/:id', requirePermission('office:agents:write'), (req, res) => {
    try {
      const existing = db.prepare('SELECT id FROM agents WHERE id = ?').get(req.params.id)
      if (!existing) {
        return res.status(404).json({ ok: false, error: { message: 'Agent not found' } })
      }

      db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id)
      console.log(`[Office] Agent deleted: ${req.params.id}`)
      res.json({ ok: true })
    } catch (err) {
      console.error('[Office] DELETE /api/office/agents/:id error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * GET /api/office/templates
   * 获取智能体模板列表
   */
  app.get('/api/office/templates', requirePermission('office:templates:read'), (req, res) => {
    try {
      const { category, page = 1, pageSize = 20 } = req.query
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(pageSize)))

      let where = 'WHERE 1=1'
      const params = []
      if (category) {
        where += ' AND category = ?'
        params.push(category)
      }

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM agent_templates ${where}`).get(...params)
      const total = countRow?.total ?? 0

      const rows = db.prepare(`
        SELECT * FROM agent_templates ${where}
        ORDER BY sort_order ASC, created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, Math.min(100, parseInt(pageSize)), offset)

      const templates = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        avatar: row.avatar,
        category: row.category,
        config: JSON.parse(row.config || '{}'),
        preview: JSON.parse(row.preview || '{}'),
        usageCount: row.usage_count || 0,
        isFeatured: !!row.is_featured,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      res.json({
        ok: true,
        data: templates,
        pagination: {
          page: parseInt(page),
          pageSize: Math.min(100, parseInt(pageSize)),
          total,
          totalPages: Math.ceil(total / Math.min(100, parseInt(pageSize))),
        },
      })
    } catch (err) {
      console.error('[Office] GET /api/office/templates error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * POST /api/office/templates
   * 创建智能体模板
   */
  app.post('/api/office/templates', requirePermission('office:templates:write'), (req, res) => {
    try {
      const { name, description, avatar, category, config, preview, isFeatured, sortOrder } = req.body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ ok: false, error: { message: 'name is required' } })
      }

      const id = randomUUID()
      const now = Date.now()

      db.prepare(`
        INSERT INTO agent_templates (id, name, description, avatar, category, config, preview, is_featured, sort_order, usage_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        id,
        name.trim(),
        description || '',
        avatar || '',
        category || 'general',
        JSON.stringify(config || {}),
        JSON.stringify(preview || {}),
        isFeatured ? 1 : 0,
        sortOrder || 0,
        now,
        now
      )

      const template = {
        id,
        name: name.trim(),
        description: description || '',
        avatar: avatar || '',
        category: category || 'general',
        config: config || {},
        preview: preview || {},
        isFeatured: !!isFeatured,
        sortOrder: sortOrder || 0,
        usageCount: 0,
        createdAt: now,
        updatedAt: now,
      }

      console.log(`[Office] Template created: ${id}`)
      res.json({ ok: true, data: template })
    } catch (err) {
      console.error('[Office] POST /api/office/templates error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * DELETE /api/office/templates/:id
   * 删除模板
   */
  app.delete('/api/office/templates/:id', requirePermission('office:templates:write'), (req, res) => {
    try {
      const existing = db.prepare('SELECT id FROM agent_templates WHERE id = ?').get(req.params.id)
      if (!existing) {
        return res.status(404).json({ ok: false, error: { message: 'Template not found' } })
      }

      db.prepare('DELETE FROM agent_templates WHERE id = ?').run(req.params.id)
      console.log(`[Office] Template deleted: ${req.params.id}`)
      res.json({ ok: true })
    } catch (err) {
      console.error('[Office] DELETE /api/office/templates/:id error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })
}

// ============================================================
// Database Migration: Create Office tables if not exist
// ============================================================
export function migrateOfficeTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      status TEXT DEFAULT 'active',
      config TEXT DEFAULT '{}',
      stats TEXT DEFAULT '{"conversations":0,"messages":0}',
      created_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS agent_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      config TEXT DEFAULT '{}',
      preview TEXT DEFAULT '{}',
      is_featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );
  `)

  // Seed default templates if none exist
  const count = db.prepare('SELECT COUNT(*) as c FROM agent_templates').get()
  if (count.c === 0) {
    const now = Date.now()
    const defaultTemplates = [
      { id: randomUUID(), name: '客服助手', description: '通用客户服务智能体，支持常见问题解答', category: 'customer-service', is_featured: 1, sort_order: 1 },
      { id: randomUUID(), name: '代码助手', description: '编程辅助智能体，支持多语言代码生成和审查', category: 'developer', is_featured: 1, sort_order: 2 },
      { id: randomUUID(), name: '数据分析', description: '数据分析和可视化助手，支持 SQL 和图表生成', category: 'data', is_featured: 1, sort_order: 3 },
      { id: randomUUID(), name: '文档写作', description: '专业文档撰写助手，支持多格式输出', category: 'writing', is_featured: 0, sort_order: 4 },
      { id: randomUUID(), name: '知识问答', description: '基于知识库的智能问答系统', category: 'knowledge', is_featured: 0, sort_order: 5 },
    ]

    const insert = db.prepare(`
      INSERT INTO agent_templates (id, name, description, category, config, preview, is_featured, sort_order, usage_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, '{}', '{}', ?, ?, 0, ?, ?)
    `)

    for (const t of defaultTemplates) {
      insert.run(t.id, t.name, t.description, t.category, t.is_featured, t.sort_order, now, now)
    }
    console.log('[Office] Seeded default agent templates')
  }

  // Create indexes
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)') } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category)') } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_templates_category ON agent_templates(category)') } catch (e) {}
}
