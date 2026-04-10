const cronParser = require('cron-parser');

/**
 * 验证 Cron 表达式
 * @param {string} expression - Cron 表达式
 * @returns {{valid: boolean, error?: string}}
 */
function validateCronExpression(expression) {
  try {
    cronParser.parseExpression(expression);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

/**
 * 获取未来执行时间
 * @param {string} expression - Cron 表达式
 * @param {number} count - 获取次数，默认 10
 * @returns {string[]}
 */
function getNextExecutionTimes(expression, count = 10) {
  try {
    const interval = cronParser.parseExpression(expression);
    const times = [];
    
    for (let i = 0; i < count; i++) {
      const next = interval.next();
      times.push(next.toISOString());
    }
    
    return times;
  } catch (error) {
    return [];
  }
}

/**
 * 解析 Cron 表达式为可读格式
 * @param {string} expression - Cron 表达式
 * @returns {string}
 */
function parseCronToReadable(expression) {
  try {
    const parts = expression.split(' ');
    if (parts.length !== 5) {
      return '无效的 Cron 表达式';
    }
    
    const [minute, hour, day, month, week] = parts;
    
    const minuteDesc = minute === '*' ? '每分钟' : 
                       minute.startsWith('*/') ? `每${minute.slice(2)}分钟` : 
                       `第${minute}分钟`;
    
    const hourDesc = hour === '*' ? '每小时' :
                     hour.startsWith('*/') ? `每${hour.slice(2)}小时` :
                     `第${hour}小时`;
    
    const dayDesc = day === '*' ? '每天' : `每月${day}号`;
    const monthDesc = month === '*' ? '每月' : `第${month}月`;
    const weekDesc = week === '*' ? '每天' : `星期${week}`;
    
    return `${minuteDesc}, ${hourDesc}, ${dayDesc}, ${monthDesc}, ${weekDesc}`;
  } catch (error) {
    return '无法解析';
  }
}

module.exports = {
  validateCronExpression,
  getNextExecutionTimes,
  parseCronToReadable
};
