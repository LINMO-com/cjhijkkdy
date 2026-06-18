/**
 * 管理员数据访问层 AdminRepository
 * ----------------------------------------------------------------------------
 * 封装对 admin 表的查询操作
 */
import { Admin } from '../models/Admin.js';

export class AdminRepository {
  /**
   * 根据用户名查询管理员
   */
  async findByUsername(username: string): Promise<Admin | null> {
    return Admin.findOne({ where: { username } });
  }

  /**
   * 根据 ID 查询管理员
   */
  async findById(id: string): Promise<Admin | null> {
    return Admin.findByPk(id);
  }
}

export const adminRepository = new AdminRepository();
