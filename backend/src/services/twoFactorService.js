/**
 * 双因素认证 (2FA) 服务
 * 基于 TOTP (Time-based One-Time Password) 实现
 */

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// 注意：2FA 服务使用内存数据库存储（生产环境应使用持久化数据库）
const twoFactorStore = new Map();

class TwoFactorAuthService {
  /**
   * 为启用户生成 2FA 密钥
   * @param {string} userId - 用户 ID
   * @returns {object} - 包含 secret 和 QR 码 URL 的对象
   */
  generateSecret(userId) {
    // 检查是否已存在 2FA 配置
    const existing = twoFactorStore.get(userId);
    
    let secret;
    if (existing && existing.secret) {
      secret = existing.secret;
    } else {
      secret = speakeasy.generateSecret({
        length: 20,
        name: `OpenClaw-Admin:${userId}`,
        issuer: 'OpenClaw-Admin'
      }).base32;

      // 保存密钥
      twoFactorStore.set(userId, {
        secret,
        enabled: false,
        createdAt: Date.now(),
        backupCodes: []
      });
    }

    // 生成 QR 码 URL
    const otpauthUrl = speakeasy.otpauthURL({
      secret: secret,
      label: `OpenClaw-Admin:${userId}`,
      issuer: 'OpenClaw-Admin'
    });

    return {
      secret,
      otpauthUrl,
      qrCode: qrcode.toDataURL(otpauthUrl)
    };
  }

  /**
   * 验证 TOTP 令牌
   * @param {string} userId - 用户 ID
   * @param {string} token - TOTP 令牌
   * @returns {boolean} - 验证结果
   */
  verifyToken(userId, token) {
    const config = twoFactorStore.get(userId);
    
    if (!config || !config.secret || !config.enabled) {
      return false;
    }

    const verified = speakeasy.totp.verify({
      secret: config.secret,
      encoding: 'base32',
      token: token,
      window: 1 // 允许前后 1 个时间窗口的容差
    });

    return verified;
  }

  /**
   * 启用 2FA
   * @param {string} userId - 用户 ID
   * @param {string} token - 验证令牌
   * @returns {boolean} - 是否成功
   */
  enable(userId, token) {
    const config = twoFactorStore.get(userId);
    
    if (!config || !config.secret) {
      return false;
    }

    // 验证令牌
    const verified = speakeasy.totp.verify({
      secret: config.secret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (!verified) {
      return false;
    }

    // 生成备份码
    const backupCodes = this.generateBackupCodes();

    // 启用 2FA
    config.enabled = true;
    config.backupCodes = backupCodes;
    config.updatedAt = Date.now();
    twoFactorStore.set(userId, config);

    return {
      success: true,
      backupCodes
    };
  }

  /**
   * 禁用 2FA
   * @param {string} userId - 用户 ID
   * @param {string} token - 验证令牌
   * @returns {boolean} - 是否成功
   */
  disable(userId, token) {
    // 先验证令牌
    if (!this.verifyToken(userId, token)) {
      return false;
    }

    // 禁用 2FA
    const config = twoFactorStore.get(userId);
    if (config) {
      config.enabled = false;
      config.secret = null;
      config.backupCodes = [];
      config.updatedAt = Date.now();
      twoFactorStore.set(userId, config);
    }

    return true;
  }

  /**
   * 验证 2FA 是否已启用
   * @param {string} userId - 用户 ID
   * @returns {boolean} - 是否启用
   */
  isEnabled(userId) {
    const config = twoFactorStore.get(userId);
    return config && config.enabled === true;
  }

  /**
   * 验证备份码
   * @param {string} userId - 用户 ID
   * @param {string} backupCode - 备份码
   * @returns {object|null} - 验证结果
   */
  verifyBackupCode(userId, backupCode) {
    const config = twoFactorStore.get(userId);
    
    if (!config || !config.enabled) {
      return null;
    }

    const backupCodes = config.backupCodes || [];
    const index = backupCodes.indexOf(backupCode);

    if (index === -1) {
      return null;
    }

    // 使用过的备份码需要标记为已使用（这里简化处理，实际应该删除）
    backupCodes.splice(index, 1);
    config.backupCodes = backupCodes;
    config.updatedAt = Date.now();
    twoFactorStore.set(userId, config);

    return {
      valid: true,
      remaining: backupCodes.length
    };
  }

  /**
   * 生成备份码
   * @returns {Array} - 备份码列表
   */
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(8).toString('hex').substring(0, 8);
      codes.push(code);
    }
    return codes;
  }

  /**
   * 获取 2FA 配置信息
   * @param {string} userId - 用户 ID
   * @returns {object|null} - 配置信息
   */
  getConfig(userId) {
    const config = twoFactorStore.get(userId);
    if (!config) return null;
    
    return {
      enabled: config.enabled === true,
      backupCodesCount: (config.backupCodes || []).length
    };
  }
}

module.exports = new TwoFactorAuthService();
