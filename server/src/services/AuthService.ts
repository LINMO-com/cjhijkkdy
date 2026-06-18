/**
 * 认证服务 AuthService
 * ----------------------------------------------------------------------------
 * 处理管理员登录、密码校验、JWT 令牌签发
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { adminRepository } from '../repositories/AdminRepository.js';

/** 登录结果 */
export interface LoginResult {
  token: string;
  admin: { id: string; username: string };
}

export class AuthService {
  /**
   * 管理员登录
   * @param username 用户名
   * @param password 明文密码
   * @returns JWT 令牌与管理员信息
   * @throws 用户名或密码错误时抛错
   */
  async login(username: string, password: string): Promise<LoginResult> {
    const admin = await adminRepository.findByUsername(username);
    // 即使管理员不存在也执行一次 bcrypt 比较，防止通过响应时间枚举用户名
    const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3u8mQ5v6n5d8mJ8mJ8mJ8mJ8mJ8';
    const hashToCompare = admin?.passwordHash || dummyHash;
    const ok = await bcrypt.compare(password, hashToCompare);

    if (!admin || !ok) {
      throw new Error('用户名或密码错误');
    }

    // 签发 JWT，payload 仅含必要信息
    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] },
    );

    return { token, admin: { id: admin.id, username: admin.username } };
  }

  /**
   * 验证 JWT 令牌
   * @param token JWT 令牌
   * @returns 解码后的 payload
   * @throws 令牌无效或过期时抛错
   */
  verifyToken(token: string): { id: string; username: string } {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { id: string; username: string };
      return decoded;
    } catch {
      throw new Error('无效或过期的登录令牌');
    }
  }
}

export const authService = new AuthService();
