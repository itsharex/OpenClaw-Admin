# OpenClaw Admin Backend

Cron 可视化编辑器后端 API 服务

## 技术栈

- **框架**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **任务调度**: node-cron
- **Cron 解析**: cron-parser
- **时间处理**: dayjs

## 项目结构

```
backend/
├── database/
│   └── index.js          # 数据库初始化和管理
├── routes/
│   ├── cron.routes.js    # 任务管理 API
│   └── cron.history.routes.js  # 执行历史 API
├── services/
│   └── CronService.js    # 业务逻辑层
├── utils/
│   └── CronValidator.js  # Cron 表达式验证工具
├── server.js             # 入口文件
└── package.json
```

## 安装依赖

```bash
cd /www/wwwroot/ai-work/src/backend
npm install
```

## 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## API 接口

### 任务管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/cron/tasks` | 获取所有任务列表 |
| POST | `/api/cron/tasks` | 创建新任务 |
| GET | `/api/cron/tasks/:id` | 获取任务详情 |
| PUT | `/api/cron/tasks/:id` | 更新任务 |
| DELETE | `/api/cron/tasks/:id` | 删除任务 |
| PATCH | `/api/cron/tasks/:id/toggle` | 启用/禁用任务 |
| POST | `/api/cron/execute/:id` | 立即执行任务 |

### 模板管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/cron/templates` | 获取所有模板 |
| POST | `/api/cron/templates` | 创建自定义模板 |
| GET | `/api/cron/templates/:id` | 获取模板详情 |
| PUT | `/api/cron/templates/:id` | 更新模板 |
| DELETE | `/api/cron/templates/:id` | 删除模板 |

### 执行历史

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/cron/tasks/:id/history` | 获取任务执行历史 |
| DELETE | `/api/cron/history` | 清理执行历史 |

### 其他

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/cron/statistics` | 获取统计信息 |
| POST | `/api/cron/validate` | 验证 Cron 表达式 |
| GET | `/health` | 健康检查 |

## 数据库表结构

### cron_tasks (任务表)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| name | VARCHAR(100) | 任务名称 |
| description | TEXT | 任务描述 |
| cron_expression | VARCHAR(50) | Cron 表达式 |
| command | VARCHAR(500) | 执行命令 |
| template_id | INTEGER | 模板 ID |
| status | VARCHAR(20) | 状态 (enabled/disabled) |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |
| last_executed_at | DATETIME | 最后执行时间 |
| next_executed_at | DATETIME | 下次执行时间 |

### cron_execution_history (执行历史表)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| task_id | INTEGER | 任务 ID |
| executed_at | DATETIME | 执行时间 |
| status | VARCHAR(20) | 状态 (success/failed) |
| output | TEXT | 执行输出 |
| error_message | TEXT | 错误信息 |
| duration_ms | INTEGER | 执行时长 |

### cron_templates (模板表)

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER | 主键 |
| name | VARCHAR(100) | 模板名称 |
| description | TEXT | 模板描述 |
| cron_expression | VARCHAR(50) | Cron 表达式 |
| command_template | TEXT | 命令模板 |
| is_builtin | BOOLEAN | 是否内置模板 |
| created_at | DATETIME | 创建时间 |

## 内置模板

系统预置 6 个常用模板：

1. **每分钟**: `* * * * *` - 每分钟执行一次
2. **每小时**: `0 * * * *` - 每小时执行一次
3. **每天凌晨**: `0 0 * * *` - 每天凌晨 0 点执行
4. **每天 8 点**: `0 8 * * *` - 每天早上 8 点执行
5. **每周日 3 点**: `0 3 * * 0` - 每周日凌晨 3 点执行
6. **每月 1 号 9 点**: `0 9 1 * *` - 每月 1 号上午 9 点执行

## 示例请求

### 创建任务

```bash
curl -X POST http://localhost:3000/api/cron/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "每日健康检查",
    "description": "每天检查系统健康状态",
    "cron_expression": "0 8 * * *",
    "command": "./health-check.sh"
  }'
```

### 获取任务列表

```bash
curl http://localhost:3000/api/cron/tasks
```

### 启用任务

```bash
curl -X PATCH http://localhost:3000/api/cron/tasks/1/toggle
```

### 立即执行任务

```bash
curl -X POST http://localhost:3000/api/cron/execute/1
```

### 获取执行历史

```bash
curl "http://localhost:3000/api/cron/tasks/1/history?limit=10"
```

## 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| PORT | 3000 | 服务端口 |

## 开发说明

1. 数据库文件自动在首次启动时创建
2. 内置模板自动初始化
3. 支持热重载（开发模式）
4. 所有 API 返回统一 JSON 格式

## 版本

v0.3.0
