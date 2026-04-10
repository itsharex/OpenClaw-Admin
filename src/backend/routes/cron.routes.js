const express = require('express');
const cronService = require('../services/CronService');

const router = express.Router();

/**
 * @route   GET /api/cron/tasks
 * @desc    获取所有任务列表
 * @access  Public
 */
router.get('/tasks', (req, res) => {
  try {
    const tasks = cronService.getAllTasks();
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/cron/tasks/:id
 * @desc    获取任务详情
 * @access  Public
 */
router.get('/tasks/:id', (req, res) => {
  try {
    const task = cronService.getTaskById(parseInt(req.params.id));
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/cron/tasks
 * @desc    创建新任务
 * @access  Public
 */
router.post('/tasks', (req, res) => {
  try {
    const { name, description, cron_expression, command, template_id } = req.body;
    
    if (!name || !cron_expression || !command) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：name, cron_expression, command'
      });
    }
    
    const task = cronService.createTask({
      name,
      description,
      cron_expression,
      command,
      template_id
    });
    
    res.status(201).json({
      success: true,
      data: task,
      message: '任务创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/cron/tasks/:id
 * @desc    更新任务
 * @access  Public
 */
router.put('/tasks/:id', (req, res) => {
  try {
    const task = cronService.updateTask(parseInt(req.params.id), req.body);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task,
      message: '任务更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/cron/tasks/:id
 * @desc    删除任务
 * @access  Public
 */
router.delete('/tasks/:id', (req, res) => {
  try {
    const result = cronService.deleteTask(parseInt(req.params.id));
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      message: '任务删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PATCH /api/cron/tasks/:id/toggle
 * @desc    启用/禁用任务
 * @access  Public
 */
router.patch('/tasks/:id/toggle', (req, res) => {
  try {
    const task = cronService.toggleTaskStatus(parseInt(req.params.id));
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    res.json({
      success: true,
      data: task,
      message: `任务已${task.status === 'enabled' ? '启用' : '禁用'}`
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/cron/tasks/:id/history
 * @desc    获取任务执行历史
 * @access  Public
 */
router.get('/tasks/:id/history', (req, res) => {
  try {
    const { limit, offset, status, startDate, endDate } = req.query;
    
    const history = cronService.getTaskHistory(parseInt(req.params.id), {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
      status,
      startDate,
      endDate
    });
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/cron/templates
 * @desc    获取所有模板
 * @access  Public
 */
router.get('/templates', (req, res) => {
  try {
    const templates = cronService.getAllTemplates();
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/cron/templates/:id
 * @desc    获取模板详情
 * @access  Public
 */
router.get('/templates/:id', (req, res) => {
  try {
    const template = cronService.getTemplateById(parseInt(req.params.id));
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: '模板不存在'
      });
    }
    
    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/cron/templates
 * @desc    创建自定义模板
 * @access  Public
 */
router.post('/templates', (req, res) => {
  try {
    const { name, description, cron_expression, command_template } = req.body;
    
    if (!name || !cron_expression || !command_template) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段：name, cron_expression, command_template'
      });
    }
    
    const template = cronService.createTemplate({
      name,
      description,
      cron_expression,
      command_template
    });
    
    res.status(201).json({
      success: true,
      data: template,
      message: '模板创建成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/cron/templates/:id
 * @desc    更新模板
 * @access  Public
 */
router.put('/templates/:id', (req, res) => {
  try {
    const template = cronService.updateTemplate(parseInt(req.params.id), req.body);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: '模板不存在'
      });
    }
    
    res.json({
      success: true,
      data: template,
      message: '模板更新成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/cron/templates/:id
 * @desc    删除模板
 * @access  Public
 */
router.delete('/templates/:id', (req, res) => {
  try {
    const result = cronService.deleteTemplate(parseInt(req.params.id));
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '模板不存在'
      });
    }
    
    res.json({
      success: true,
      message: '模板删除成功'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/cron/statistics
 * @desc    获取统计信息
 * @access  Public
 */
router.get('/statistics', (req, res) => {
  try {
    const stats = cronService.getStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/cron/history
 * @desc    清理执行历史
 * @access  Public
 */
router.delete('/history', (req, res) => {
  try {
    const { days = 30 } = req.query;
    const result = cronService.cleanupHistory(parseInt(days));
    
    res.json({
      success: true,
      message: `已清理${result.changes}条${days}天前的执行记录`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/cron/validate
 * @desc    验证 Cron 表达式
 * @access  Public
 */
router.post('/validate', (req, res) => {
  try {
    const { expression } = req.body;
    
    if (!expression) {
      return res.status(400).json({
        success: false,
        error: '缺少 expression 参数'
      });
    }
    
    const validation = cronService.validateCronExpression(expression);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
