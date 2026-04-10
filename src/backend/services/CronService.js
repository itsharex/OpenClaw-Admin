const { db } = require('../database');
const cronValidator = require('../utils/CronValidator');

class CronService {
  // 获取所有任务
  getAllTasks() {
    const stmt = db.prepare(`
      SELECT t.*, 
             (SELECT COUNT(*) FROM cron_execution_history h WHERE h.task_id = t.id) as execution_count
      FROM cron_tasks t
      ORDER BY t.created_at DESC
    `);
    return stmt.all();
  }

  // 获取任务详情
  getTaskById(id) {
    const stmt = db.prepare('SELECT * FROM cron_tasks WHERE id = ?');
    const task = stmt.get(id);
    
    if (task) {
      task.next_execution_times = cronValidator.getNextExecutionTimes(task.cron_expression, 5);
      task.readable_expression = cronValidator.parseCronToReadable(task.cron_expression);
    }
    
    return task;
  }

  // 创建任务
  createTask(taskData) {
    const { name, description, cron_expression, command, template_id } = taskData;
    
    // 验证 Cron 表达式
    const validation = cronValidator.validateCronExpression(cron_expression);
    if (!validation.valid) {
      throw new Error(`无效的 Cron 表达式：${validation.error}`);
    }

    const stmt = db.prepare(`
      INSERT INTO cron_tasks (name, description, cron_expression, command, template_id, status)
      VALUES (?, ?, ?, ?, ?, 'disabled')
    `);

    const result = stmt.run(name, description || '', cron_expression, command, template_id || null);
    
    // 获取新创建的任务
    return this.getTaskById(result.lastInsertRowid);
  }

  // 更新任务
  updateTask(id, taskData) {
    const { name, description, cron_expression, command, template_id, status } = taskData;
    
    // 如果更新 Cron 表达式，需要验证
    if (cron_expression) {
      const validation = cronValidator.validateCronExpression(cron_expression);
      if (!validation.valid) {
        throw new Error(`无效的 Cron 表达式：${validation.error}`);
      }
    }

    const stmt = db.prepare(`
      UPDATE cron_tasks 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          cron_expression = COALESCE(?, cron_expression),
          command = COALESCE(?, command),
          template_id = COALESCE(?, template_id),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(name, description, cron_expression, command, template_id, status, id);
    
    return this.getTaskById(id);
  }

  // 删除任务
  deleteTask(id) {
    const stmt = db.prepare('DELETE FROM cron_tasks WHERE id = ?');
    return stmt.run(id);
  }

  // 启用/禁用任务
  toggleTaskStatus(id) {
    const task = this.getTaskById(id);
    if (!task) {
      throw new Error('任务不存在');
    }

    const newStatus = task.status === 'enabled' ? 'disabled' : 'enabled';
    const stmt = db.prepare(`
      UPDATE cron_tasks 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(newStatus, id);
    return this.getTaskById(id);
  }

  // 获取任务执行历史
  getTaskHistory(taskId, options = {}) {
    const { limit = 20, offset = 0, status, startDate, endDate } = options;
    
    let query = 'SELECT * FROM cron_execution_history WHERE task_id = ?';
    const params = [taskId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (startDate) {
      query += ' AND executed_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND executed_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY executed_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = db.prepare(query);
    return stmt.all(...params);
  }

  // 记录执行历史
  recordExecution(taskId, executionData) {
    const { status, output, error_message, duration_ms } = executionData;

    const stmt = db.prepare(`
      INSERT INTO cron_execution_history (task_id, status, output, error_message, duration_ms)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(taskId, status, output || '', error_message || '', duration_ms || 0);

    // 更新任务的最后执行时间
    const updateStmt = db.prepare(`
      UPDATE cron_tasks 
      SET last_executed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    updateStmt.run(taskId);

    return result.lastInsertRowid;
  }

  // 获取所有模板
  getAllTemplates() {
    const stmt = db.prepare('SELECT * FROM cron_templates ORDER BY is_builtin DESC, name');
    return stmt.all();
  }

  // 获取模板详情
  getTemplateById(id) {
    const stmt = db.prepare('SELECT * FROM cron_templates WHERE id = ?');
    return stmt.get(id);
  }

  // 创建自定义模板
  createTemplate(templateData) {
    const { name, description, cron_expression, command_template } = templateData;
    
    // 验证 Cron 表达式
    const validation = cronValidator.validateCronExpression(cron_expression);
    if (!validation.valid) {
      throw new Error(`无效的 Cron 表达式：${validation.error}`);
    }

    const stmt = db.prepare(`
      INSERT INTO cron_templates (name, description, cron_expression, command_template, is_builtin)
      VALUES (?, ?, ?, ?, 0)
    `);

    const result = stmt.run(name, description || '', cron_expression, command_template);
    return this.getTemplateById(result.lastInsertRowid);
  }

  // 更新模板
  updateTemplate(id, templateData) {
    const { name, description, cron_expression, command_template } = templateData;
    
    if (cron_expression) {
      const validation = cronValidator.validateCronExpression(cron_expression);
      if (!validation.valid) {
        throw new Error(`无效的 Cron 表达式：${validation.error}`);
      }
    }

    const stmt = db.prepare(`
      UPDATE cron_templates 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          cron_expression = COALESCE(?, cron_expression),
          command_template = COALESCE(?, command_template)
      WHERE id = ? AND is_builtin = 0
    `);

    stmt.run(name, description, cron_expression, command_template, id);
    return this.getTemplateById(id);
  }

  // 删除模板
  deleteTemplate(id) {
    // 不允许删除内置模板
    const template = this.getTemplateById(id);
    if (template && template.is_builtin) {
      throw new Error('不允许删除内置模板');
    }

    const stmt = db.prepare('DELETE FROM cron_templates WHERE id = ?');
    return stmt.run(id);
  }

  // 清理执行历史
  cleanupHistory(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const stmt = db.prepare(`
      DELETE FROM cron_execution_history 
      WHERE executed_at < ?
    `);

    return stmt.run(cutoffDate.toISOString());
  }

  // 统计信息
  getStatistics() {
    const taskCount = db.prepare('SELECT COUNT(*) as count FROM cron_tasks').get();
    const enabledCount = db.prepare("SELECT COUNT(*) as count FROM cron_tasks WHERE status = 'enabled'").get();
    const historyCount = db.prepare('SELECT COUNT(*) as count FROM cron_execution_history').get();
    const successCount = db.prepare("SELECT COUNT(*) as count FROM cron_execution_history WHERE status = 'success'").get();
    const failedCount = db.prepare("SELECT COUNT(*) as count FROM cron_execution_history WHERE status = 'failed'").get();

    return {
      total_tasks: taskCount.count,
      enabled_tasks: enabledCount.count,
      disabled_tasks: taskCount.count - enabledCount.count,
      total_executions: historyCount.count,
      successful_executions: successCount.count,
      failed_executions: failedCount.count
    };
  }
}

module.exports = new CronService();
