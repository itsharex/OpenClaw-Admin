const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../database/cron.db');
const db = new Database(dbPath);

// 启用外键约束
db.pragma('foreign_keys = ON');

// 初始化数据库
function initDatabase() {
  // 任务表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      cron_expression VARCHAR(50) NOT NULL,
      command VARCHAR(500) NOT NULL,
      template_id INTEGER,
      status VARCHAR(20) DEFAULT 'disabled',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_executed_at DATETIME,
      next_executed_at DATETIME,
      FOREIGN KEY (template_id) REFERENCES cron_templates(id)
    )
  `);

  // 执行历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_execution_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status VARCHAR(20) NOT NULL,
      output TEXT,
      error_message TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (task_id) REFERENCES cron_tasks(id) ON DELETE CASCADE
    )
  `);

  // 模板表
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      cron_expression VARCHAR(50) NOT NULL,
      command_template TEXT NOT NULL,
      is_builtin BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON cron_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_history_task_id ON cron_execution_history(task_id);
    CREATE INDEX IF NOT EXISTS idx_history_executed_at ON cron_execution_history(executed_at);
  `);

  // 插入内置模板
  const builtinTemplates = [
    { name: '每分钟', description: '每分钟执行一次', cron_expression: '* * * * *', command_template: 'echo "Heartbeat"' },
    { name: '每小时', description: '每小时执行一次', cron_expression: '0 * * * *', command_template: './health-check.sh' },
    { name: '每天凌晨', description: '每天凌晨 0 点执行', cron_expression: '0 0 * * *', command_template: './daily-backup.sh' },
    { name: '每天 8 点', description: '每天早上 8 点执行', cron_expression: '0 8 * * *', command_template: './send-morning-report.sh' },
    { name: '每周日 3 点', description: '每周日凌晨 3 点执行', cron_expression: '0 3 * * 0', command_template: './weekly-log-clean.sh' },
    { name: '每月 1 号 9 点', description: '每月 1 号上午 9 点执行', cron_expression: '0 9 1 * *', command_template: './monthly-report.sh' }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cron_templates (name, description, cron_expression, command_template, is_builtin)
    VALUES (?, ?, ?, ?, 1)
  `);

  db.transaction(() => {
    for (const template of builtinTemplates) {
      stmt.run(template.name, template.description, template.cron_expression, template.command_template);
    }
  })();

  console.log('Database initialized successfully');
}

module.exports = { db, initDatabase };
