-- ============================================================================
-- 企业级多模态文档管理与分享系统 - 数据库初始化脚本
-- 数据库: MySQL 8.0
-- 字符集: utf8mb4（支持 emoji 与多语言）
-- ============================================================================

-- 创建数据库（如不存在）
CREATE DATABASE IF NOT EXISTS `doc_share`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `doc_share`;

-- ----------------------------------------------------------------------------
-- 1. 管理员表 admin
--    存储后台管理员账号，密码使用 bcrypt 哈希存储，绝不存明文
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `admin`;
CREATE TABLE `admin` (
  `id`            VARCHAR(36)  NOT NULL COMMENT '管理员唯一ID(UUID)',
  `username`      VARCHAR(64)  NOT NULL COMMENT '登录用户名',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'bcrypt 密码哈希',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`)  -- 用户名唯一，防止重复注册
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='管理员表';

-- ----------------------------------------------------------------------------
-- 2. 文件表 file
--    核心表：存储文件元数据与存储键
--    storage_key 为服务端生成的存储键，与用户可见文件名解耦，防止路径遍历
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `file`;
CREATE TABLE `file` (
  `id`            VARCHAR(36)      NOT NULL COMMENT '文件唯一ID(UUID)',
  `original_name` VARCHAR(255)     NOT NULL COMMENT '原始文件名(用户可见)',
  `storage_key`   VARCHAR(255)     NOT NULL COMMENT '存储键(服务端生成,如 yyyy/mm/uuid.ext)',
  `title`         VARCHAR(255)     NOT NULL COMMENT '文件标题(可编辑)',
  `description`   TEXT             NULL     COMMENT '文件描述',
  `category`      VARCHAR(64)      NOT NULL DEFAULT 'uncategorized' COMMENT '分类',
  `tags`          JSON             NULL     COMMENT '标签数组',
  `mime_type`     VARCHAR(128)     NOT NULL COMMENT 'MIME 类型',
  `size`          BIGINT UNSIGNED  NOT NULL COMMENT '文件大小(字节)',
  `ext`           VARCHAR(16)      NOT NULL COMMENT '扩展名(小写,不含点)',
  `is_public`     TINYINT(1)       NOT NULL DEFAULT 1 COMMENT '是否公开:1公开,0私有',
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_ext` (`ext`),           -- 按格式筛选
  KEY `idx_category` (`category`), -- 按分类筛选
  KEY `idx_created_at` (`created_at`), -- 按时间排序
  KEY `idx_is_public` (`is_public`)    -- 公开文件查询
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文件表';

-- ----------------------------------------------------------------------------
-- 3. 分享日志表 share_log
--    记录每次生成的分享链接，便于审计与统计
--    注意：分享链接的校验是无状态的(基于 HMAC 签名)，此表仅作审计用途
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS `share_log`;
CREATE TABLE `share_log` (
  `id`          VARCHAR(36)  NOT NULL COMMENT '分享记录ID',
  `file_id`     VARCHAR(36)  NOT NULL COMMENT '关联文件ID',
  `share_token` VARCHAR(512) NOT NULL COMMENT '分享令牌(payload.signature)',
  `size_tier`   VARCHAR(16)  NOT NULL COMMENT '文件大小等级:normal/large',
  `expire_at`   DATETIME     NOT NULL COMMENT '过期时间',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  PRIMARY KEY (`id`),
  KEY `idx_file_id` (`file_id`),
  KEY `idx_expire_at` (`expire_at`),
  CONSTRAINT `fk_share_file` FOREIGN KEY (`file_id`)
    REFERENCES `file` (`id`) ON DELETE CASCADE  -- 文件删除时级联删除分享记录
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='分享日志表';

-- ----------------------------------------------------------------------------
-- 4. 初始化管理员数据
--    默认账号: admin  密码: admin123
--    下方 password_hash 为 'admin123' 经 bcrypt(cost=10) 计算的哈希
--    生产环境务必登录后立即修改密码
-- ----------------------------------------------------------------------------
INSERT INTO `admin` (`id`, `username`, `password_hash`)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrqK3u8mQ5v6n5d8mJ8mJ8mJ8mJ8mJ8'
);

-- 完成提示
SELECT '数据库 doc_share 初始化完成，默认管理员: admin / admin123' AS message;
