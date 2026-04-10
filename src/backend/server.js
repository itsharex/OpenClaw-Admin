const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase } = require('./database');
const cronRoutes = require('./routes/cron.routes');
const cronHistoryRoutes = require('./routes/cron.history.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 初始化数据库
initDatabase();

// 路由
app.use('/api/cron', cronRoutes);
app.use('/api/cron', cronHistoryRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.3.0'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'OpenClaw Admin Backend',
    version: '0.3.0',
    description: 'Cron Task Management API',
    endpoints: {
      tasks: '/api/cron/tasks',
      templates: '/api/cron/templates',
      history: '/api/cron/tasks/:id/history',
      statistics: '/api/cron/statistics',
      health: '/health'
    }
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || '服务器内部错误'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 OpenClaw Admin Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
});

module.exports = app;
