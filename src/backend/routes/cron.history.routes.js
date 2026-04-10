const express = require('express');
const cronService = require('../services/CronService');

const router = express.Router();

/**
 * @route   POST /api/cron/execute/:id
 * @desc    立即执行一次任务
 * @access  Public
 */
router.post('/execute/:id', async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = cronService.getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    const startTime = Date.now();
    let output = '';
    let error_message = '';
    let status = 'success';
    
    try {
      // 执行命令（简化版，实际生产环境需要使用 child_process）
      const { exec } = require('child_process');
      
      await new Promise((resolve, reject) => {
        exec(task.command, { timeout: 60000 }, (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          output = stdout || stderr;
          resolve();
        });
      });
    } catch (error) {
      status = 'failed';
      error_message = error.message;
    }
    
    const duration_ms = Date.now() - startTime;
    
    // 记录执行历史
    cronService.recordExecution(taskId, {
      status,
      output,
      error_message,
      duration_ms
    });
    
    res.json({
      success: true,
      data: {
        task_id: taskId,
        status,
        output,
        error_message,
        duration_ms
      },
      message: status === 'success' ? '任务执行成功' : '任务执行失败'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
