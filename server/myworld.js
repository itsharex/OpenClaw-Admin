/**
 * MyWorld API - 企业与成员管理系统
 * Routes:
 *   GET    /api/myworld/companies      - 获取企业列表
 *   POST   /api/myworld/companies      - 创建企业
 *   GET    /api/myworld/companies/:id  - 获取企业详情
 *   PUT    /api/myworld/companies/:id  - 更新企业
 *   DELETE /api/myworld/companies/:id  - 删除企业
 *   GET    /api/myworld/companies/:id/members - 获取企业成员列表
 *   POST   /api/myworld/companies/:id/members - 添加企业成员
 *   DELETE /api/myworld/companies/:id/members/:memberId - 移除成员
 *   GET    /api/myworld/members        - 获取当前用户的成员资格列表
 */

import { randomUUID } from 'crypto'
import db from './database.js'
import { requirePermission } from './auth.js'

export function registerMyWorldRoutes(app) {
  // ============================================================
  // RBAC 权限说明
  // myworld:companies:read  - 查看企业列表和详情
  // myworld:companies:write - 创建/编辑/删除企业
  // myworld:members:read   - 查看成员列表
  // myworld:members:write  - 管理成员（添加/移除）
  // ============================================================

  /**
   * GET /api/myworld/companies
   * 获取企业列表（按权限过滤：管理员看全部，成员只看自己加入的）
   */
  app.get('/api/myworld/companies', requirePermission('myworld:companies:read'), (req, res) => {
    try {
      const { page = 1, pageSize = 20, search, industry } = req.query
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(pageSize)))
      const userId = req.auth?.userId || null

      let where = 'WHERE 1=1'
      const params = []

      if (industry) {
        where += ' AND industry = ?'
        params.push(industry)
      }
      if (search) {
        where += ' AND (name LIKE ? OR description LIKE ?)'
        params.push(`%${search}%`, `%${search}%`)
      }

      // 非管理员只能看自己加入的企业
      const isAdmin = userId && hasDirectPermission(userId, 'myworld:companies:write')
      if (!isAdmin && userId) {
        const userMemberCompanies = db.prepare(
          'SELECT company_id FROM company_members WHERE user_id = ?'
        ).all(userId)
        const companyIds = userMemberCompanies.map(r => r.company_id)
        if (companyIds.length === 0) {
          return res.json({ ok: true, data: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } })
        }
        const placeholders = companyIds.map(() => '?').join(',')
        where += ` AND id IN (${placeholders})`
        params.push(...companyIds)
      }

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM companies ${where}`).get(...params)
      const total = countRow?.total ?? 0

      const rows = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM company_members WHERE company_id = c.id) as member_count
        FROM companies c ${where}
        ORDER BY c.updated_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, Math.min(100, parseInt(pageSize)), offset)

      const companies = rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        logo: row.logo,
        industry: row.industry,
        scale: row.scale,
        website: row.website,
        status: row.status,
        settings: JSON.parse(row.settings || '{}'),
        memberCount: row.member_count || 0,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }))

      res.json({
        ok: true,
        data: companies,
        pagination: {
          page: parseInt(page),
          pageSize: Math.min(100, parseInt(pageSize)),
          total,
          totalPages: Math.ceil(total / Math.min(100, parseInt(pageSize))),
        },
      })
    } catch (err) {
      console.error('[MyWorld] GET /api/myworld/companies error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * POST /api/myworld/companies
   * 创建企业
   */
  app.post('/api/myworld/companies', requirePermission('myworld:companies:write'), (req, res) => {
    try {
      const { name, description, logo, industry, scale, website, settings } = req.body

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ ok: false, error: { message: 'name is required' } })
      }
      if (name.trim().length > 200) {
        return res.status(400).json({ ok: false, error: { message: 'name too long (max 200 chars)' } })
      }

      const id = randomUUID()
      const now = Date.now()
      const userId = req.auth?.userId || null

      db.prepare(`
        INSERT INTO companies (id, name, description, logo, industry, scale, website, status, settings, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)
      `).run(
        id,
        name.trim(),
        description || '',
        logo || '',
        industry || '',
        scale || '',
        website || '',
        JSON.stringify(settings || {}),
        userId,
        now,
        now
      )

      // Auto-add creator as owner member
      if (userId) {
        const memberId = randomUUID()
        db.prepare(`
          INSERT INTO company_members (id, company_id, user_id, role, status, joined_at)
          VALUES (?, ?, ?, 'owner', 'active', ?)
        `).run(memberId, id, userId, now)
      }

      const company = {
        id,
        name: name.trim(),
        description: description || '',
        logo: logo || '',
        industry: industry || '',
        scale: scale || '',
        website: website || '',
        status: 'active',
        settings: settings || {},
        memberCount: 1,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      }

      console.log(`[MyWorld] Company created: ${id} by user ${userId}`)
      res.json({ ok: true, data: company })
    } catch (err) {
      console.error('[MyWorld] POST /api/myworld/companies error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * GET /api/myworld/companies/:id
   * 获取企业详情
   */
  app.get('/api/myworld/companies/:id', requirePermission('myworld:companies:read'), (req, res) => {
    try {
      const row = db.prepare(`
        SELECT c.*,
          (SELECT COUNT(*) FROM company_members WHERE company_id = c.id AND status='active') as member_count
        FROM companies c WHERE c.id = ?
      `).get(req.params.id)

      if (!row) {
        return res.status(404).json({ ok: false, error: { message: 'Company not found' } })
      }

      // Check membership for non-admin users
      const userId = req.auth?.userId || null
      if (userId) {
        const isAdmin = hasDirectPermission(userId, 'myworld:companies:write')
        if (!isAdmin) {
          const membership = db.prepare(
            'SELECT id FROM company_members WHERE company_id = ? AND user_id = ? AND status = "active"'
          ).get(req.params.id, userId)
          if (!membership) {
            return res.status(403).json({ ok: false, error: { message: 'Not a member of this company' } })
          }
        }
      }

      res.json({
        ok: true,
        data: {
          id: row.id,
          name: row.name,
          description: row.description,
          logo: row.logo,
          industry: row.industry,
          scale: row.scale,
          website: row.website,
          status: row.status,
          settings: JSON.parse(row.settings || '{}'),
          memberCount: row.member_count || 0,
          createdBy: row.created_by,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
      })
    } catch (err) {
      console.error('[MyWorld] GET /api/myworld/companies/:id error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * PUT /api/myworld/companies/:id
   * 更新企业
   */
  app.put('/api/myworld/companies/:id', requirePermission('myworld:companies:write'), (req, res) => {
    try {
      const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id)
      if (!existing) {
        return res.status(404).json({ ok: false, error: { message: 'Company not found' } })
      }

      const { name, description, logo, industry, scale, website, status, settings } = req.body
      const now = Date.now()

      const current = db.prepare('SELECT * FROM companies WHERE id = ?').get(req.params.id)
      const newName = name !== undefined ? name.trim() : current.name
      const newDescription = description !== undefined ? description : current.description
      const newLogo = logo !== undefined ? logo : current.logo
      const newIndustry = industry !== undefined ? industry : current.industry
      const newScale = scale !== undefined ? scale : current.scale
      const newWebsite = website !== undefined ? website : current.website
      const newStatus = status !== undefined ? status : current.status
      const newSettings = settings !== undefined ? JSON.stringify(settings) : current.settings

      if (newName.length === 0 || newName.length > 200) {
        return res.status(400).json({ ok: false, error: { message: 'name must be 1-200 chars' } })
      }

      db.prepare(`
        UPDATE companies
        SET name=?, description=?, logo=?, industry=?, scale=?, website=?, status=?, settings=?, updated_at=?
        WHERE id=?
      `).run(newName, newDescription, newLogo, newIndustry, newScale, newWebsite, newStatus, newSettings, now, req.params.id)

      console.log(`[MyWorld] Company updated: ${req.params.id}`)
      res.json({ ok: true, updatedAt: now })
    } catch (err) {
      console.error('[MyWorld] PUT /api/myworld/companies/:id error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * DELETE /api/myworld/companies/:id
   * 删除企业（软删除，设置 status=deleted）
   */
  app.delete('/api/myworld/companies/:id', requirePermission('myworld:companies:write'), (req, res) => {
    try {
      const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(req.params.id)
      if (!existing) {
        return res.status(404).json({ ok: false, error: { message: 'Company not found' } })
      }

      const now = Date.now()
      db.prepare('UPDATE companies SET status = ?, updated_at = ? WHERE id = ?').run('deleted', now, req.params.id)
      console.log(`[MyWorld] Company deleted: ${req.params.id}`)
      res.json({ ok: true })
    } catch (err) {
      console.error('[MyWorld] DELETE /api/myworld/companies/:id error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * GET /api/myworld/companies/:id/members
   * 获取企业成员列表
   */
  app.get('/api/myworld/companies/:id/members', requirePermission('myworld:members:read'), (req, res) => {
    try {
      const { page = 1, pageSize = 50, role, status } = req.query
      const offset = (Math.max(1, parseInt(page)) - 1) * Math.min(100, Math.max(1, parseInt(pageSize)))

      const company = db.prepare('SELECT id FROM companies WHERE id = ? AND status != "deleted"').get(req.params.id)
      if (!company) {
        return res.status(404).json({ ok: false, error: { message: 'Company not found' } })
      }

      let where = 'WHERE cm.company_id = ?'
      const params = [req.params.id]

      if (role) {
        where += ' AND cm.role = ?'
        params.push(role)
      }
      if (status) {
        where += ' AND cm.status = ?'
        params.push(status)
      }

      const countRow = db.prepare(`SELECT COUNT(*) as total FROM company_members cm ${where}`).get(...params)
      const total = countRow?.total ?? 0

      const rows = db.prepare(`
        SELECT cm.*, u.username, u.display_name, u.email, u.avatar
        FROM company_members cm
        LEFT JOIN users u ON cm.user_id = u.id
        ${where}
        ORDER BY cm.joined_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, Math.min(100, parseInt(pageSize)), offset)

      const members = rows.map(row => formatMember(row))

      res.json({
        ok: true,
        data: members,
        pagination: {
          page: parseInt(page),
          pageSize: Math.min(100, parseInt(pageSize)),
          total,
          totalPages: Math.ceil(total / Math.min(100, parseInt(pageSize))),
        },
      })
    } catch (err) {
      console.error('[MyWorld] GET /api/myworld/companies/:id/members error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * POST /api/myworld/companies/:id/members
   * 添加企业成员
   */
  app.post('/api/myworld/companies/:id/members', requirePermission('myworld:members:write'), (req, res) => {
    try {
      const company = db.prepare('SELECT id FROM companies WHERE id = ? AND status != "deleted"').get(req.params.id)
      if (!company) {
        return res.status(404).json({ ok: false, error: { message: 'Company not found' } })
      }

      const { userId, role } = req.body
      if (!userId) {
        return res.status(400).json({ ok: false, error: { message: 'userId is required' } })
      }

      const validRoles = ['owner', 'admin', 'member', 'viewer']
      const memberRole = validRoles.includes(role) ? role : 'member'

      // Check if already a member
      const existing = db.prepare(
        'SELECT id FROM company_members WHERE company_id = ? AND user_id = ?'
      ).get(req.params.id, userId)

      if (existing) {
        const now = Date.now()
        db.prepare('UPDATE company_members SET status = ?, role = ?, joined_at = ? WHERE id = ?')
          .run('active', memberRole, now, existing.id)
        const updated = db.prepare('SELECT * FROM company_members WHERE id = ?').get(existing.id)
        return res.json({ ok: true, data: formatMember(updated) })
      }

      const id = randomUUID()
      const now = Date.now()

      db.prepare(`
        INSERT INTO company_members (id, company_id, user_id, role, status, joined_at)
        VALUES (?, ?, ?, ?, 'active', ?)
      `).run(id, req.params.id, userId, memberRole, now)

      console.log(`[MyWorld] Member added: ${id} to company ${req.params.id}`)
      res.json({
        ok: true,
        data: { id, userId, companyId: req.params.id, role: memberRole, status: 'active', joinedAt: now },
      })
    } catch (err) {
      console.error('[MyWorld] POST /api/myworld/companies/:id/members error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * DELETE /api/myworld/companies/:id/members/:memberId
   * 移除企业成员
   */
  app.delete('/api/myworld/companies/:id/members/:memberId', requirePermission('myworld:members:write'), (req, res) => {
    try {
      const member = db.prepare(
        'SELECT * FROM company_members WHERE id = ? AND company_id = ?'
      ).get(req.params.memberId, req.params.id)

      if (!member) {
        return res.status(404).json({ ok: false, error: { message: 'Member not found' } })
      }

      if (member.role === 'owner') {
        return res.status(400).json({ ok: false, error: { message: 'Cannot remove company owner' } })
      }

      db.prepare('DELETE FROM company_members WHERE id = ?').run(req.params.memberId)
      console.log(`[MyWorld] Member removed: ${req.params.memberId}`)
      res.json({ ok: true })
    } catch (err) {
      console.error('[MyWorld] DELETE /api/myworld/companies/:id/members/:memberId error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })

  /**
   * GET /api/myworld/members
   * 获取当前用户的所有成员资格（跨企业）
   */
  app.get('/api/myworld/members', requirePermission('myworld:members:read'), (req, res) => {
    try {
      const userId = req.auth?.userId
      if (!userId) {
        return res.status(401).json({ ok: false, error: { message: 'Unauthorized' } })
      }

      const rows = db.prepare(`
        SELECT cm.*, c.name as company_name, c.logo as company_logo
        FROM company_members cm
        JOIN companies c ON cm.company_id = c.id
        WHERE cm.user_id = ? AND c.status != 'deleted'
        ORDER BY cm.joined_at DESC
      `).all(userId)

      const memberships = rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        companyId: row.company_id,
        companyName: row.company_name,
        companyLogo: row.company_logo,
        role: row.role,
        status: row.status,
        joinedAt: row.joined_at,
      }))

      res.json({ ok: true, data: memberships })
    } catch (err) {
      console.error('[MyWorld] GET /api/myworld/members error:', err)
      res.status(500).json({ ok: false, error: { message: err.message } })
    }
  })
}

// ============================================================
// Helpers
// ============================================================

function hasDirectPermission(userId, permissionName) {
  if (!userId) return false
  try {
    // Use getUserPermissions from auth if available
    if (typeof getUserPermissions === 'function') {
      const perms = getUserPermissions(userId)
      return perms.includes(permissionName)
    }
    return false
  } catch {
    return false
  }
}

function formatMember(row) {
  return {
    id: row.id,
    userId: row.user_id,
    companyId: row.company_id,
    role: row.role,
    status: row.status,
    displayName: row.display_name || row.username || 'Unknown',
    email: row.email || '',
    avatar: row.avatar || '',
    joinedAt: row.joined_at,
  }
}

// ============================================================
// Database Migration: Create MyWorld tables if not exist
// ============================================================
export function migrateMyWorldTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      logo TEXT DEFAULT '',
      industry TEXT DEFAULT '',
      scale TEXT DEFAULT '',
      website TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      settings TEXT DEFAULT '{}',
      created_by TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS company_members (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      status TEXT DEFAULT 'active',
      joined_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  // Create indexes
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status)') } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry)') } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_members_company ON company_members(company_id)') } catch (e) {}
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_members_user ON company_members(user_id)') } catch (e) {}
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_members_company_user ON company_members(company_id, user_id)') } catch (e) {}
}
