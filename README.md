# 企业级多模态文档管理与分享系统

一套面向企业的多模态文档管理与安全分享平台，提供**管理后台**与**公开网页**两套视图。核心亮点是基于 HMAC-SHA256 签名的**动态安全下载策略**：普通文件链接 15 分钟有效、大文件 30 分钟有效，过期立即失效返回 403。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Node.js + Express + TypeScript |
| 数据库 | MySQL 8.0 + Sequelize ORM |
| 前端 | Vue3 + Vite + Tailwind CSS + Pinia |
| 文件存储 | 本地存储（抽象 `IStorageProvider` 接口，预留对象存储扩展） |

## 核心架构：安全下载链接生成与校验

### 生成阶段（`ShareTokenService.generate`）

1. 根据文件大小判定 `sizeTier`：`< 100MB` → `normal`（15 分钟）；`≥ 100MB` → `large`（30 分钟）
2. 构造 `payload = { fileId, expireAt, sizeTier, nonce }`
3. 使用服务器密钥以 **HMAC-SHA256** 对 payload 签名
4. 返回 `shareToken = base64url(payload) + '.' + base64url(signature)`

### 校验阶段（`ShareTokenService.verify`）

1. 拆分令牌为 payload 与 signature
2. 重新计算签名，使用**恒定时间比较**（`crypto.timingSafeEqual`）防时序攻击
3. 校验签名 → 校验过期 → 返回 payload
4. 任何校验失败抛出 `ShareTokenError`（HTTP 403）

### 安全要点

- 签名密钥仅存后端环境变量 `SHARE_SECRET`，前端无法伪造令牌
- **无状态校验**：不依赖数据库，过期判定完全基于 payload 中的 `expireAt`
- 下载时文件路径由数据库 `storageKey` 决定，**绝不使用客户端传入路径**，杜绝路径遍历
- 上传时执行扩展名白名单 + MIME 校验 + **文件魔数（Magic Number）校验**，防止伪装后缀

## 目录结构

```
/workspace
├── .trae/documents/              # PRD 与技术架构文档
├── database/
│   └── schema.sql               # 数据库初始化脚本
├── server/                       # 后端
│   ├── src/
│   │   ├── config/              # 配置加载
│   │   ├── models/              # Sequelize 模型（Admin/File/ShareLog）
│   │   ├── repositories/        # 数据访问层
│   │   ├── storage/             # 存储抽象（IStorageProvider + Local 实现）
│   │   ├── services/            # 业务层（ShareTokenService 核心 / FileService / AuthService）
│   │   ├── controllers/         # 控制器
│   │   ├── middlewares/         # 中间件（auth/error/upload/security）
│   │   ├── routes/              # 路由
│   │   ├── utils/               # 工具（response/fileType/pathSecurity）
│   │   ├── types/               # 类型定义
│   │   └── app.ts               # 应用入口
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── web/                          # 前端
│   ├── src/
│   │   ├── admin/               # 管理后台页面
│   │   ├── public/              # 公开网页页面
│   │   ├── components/          # 共享组件
│   │   ├── composables/         # 组合式函数
│   │   ├── api/                 # axios 封装
│   │   ├── stores/              # Pinia
│   │   ├── router/              # 路由
│   │   ├── utils/               # 工具
│   │   └── main.ts
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## 快速开始

### 1. 初始化数据库

```bash
mysql -u root -p < database/schema.sql
```

默认管理员账号：`admin` / `admin123`（生产环境务必修改）

### 2. 启动后端

```bash
cd server
cp .env.example .env        # 编辑 .env 填写数据库与密钥
npm install
npm run dev                 # 开发模式（监听 3000 端口）
```

### 3. 启动前端

```bash
cd web
npm install
npm run dev                 # 开发模式（监听 5173 端口，代理 /api 到后端）
```

### 4. 访问

- 公开网页：http://localhost:5173/
- 管理后台：http://localhost:5173/admin/login

## API 接口

| 方法 | 路由 | 用途 | 鉴权 |
|------|------|------|------|
| POST | `/api/auth/login` | 管理员登录 | 否 |
| GET | `/api/files` | 公开文件列表 | 否 |
| GET | `/api/files/:id` | 文件详情 | 否 |
| GET | `/api/files/:id/preview` | 在线预览 | 否 |
| POST | `/api/admin/files` | 上传文件 | 管理员 |
| GET | `/api/admin/files` | 管理端文件列表 | 管理员 |
| GET | `/api/admin/files/:id` | 管理端文件详情 | 管理员 |
| PUT | `/api/admin/files/:id` | 编辑元数据 | 管理员 |
| POST | `/api/admin/files/:id/rename` | 重命名 | 管理员 |
| DELETE | `/api/admin/files/:id` | 删除文件 | 管理员 |
| POST | `/api/admin/files/:id/share` | 生成分享链接 | 管理员 |
| GET | `/api/share/:token/download` | 安全下载 | 签名校验 |

统一响应格式：`{ code: number, message: string, data: T | null }`

## 安全特性

1. **防路径遍历**：所有文件路径经 `resolveSafePath` 校验，`storageKey` 由服务端生成
2. **防恶意上传**：扩展名白名单 + MIME 校验 + 魔数校验三重防护
3. **分享链接防篡改**：HMAC-SHA256 签名 + 恒定时间比较
4. **限时下载**：普通文件 15 分钟、大文件 30 分钟，过期返回 403
5. **密码安全**：bcrypt 哈希存储，登录防时序攻击
6. **安全响应头**：nosniff / DENY / no-store 等

## 扩展性

- **存储层**：实现 `IStorageProvider` 接口即可接入 S3/OSS，业务层无需改动
- **分享策略**：`ShareTokenService.decideTtl` 可调整大小阈值与有效期
- **防重放**：当前为无状态校验，如需防重放可加 Redis 记录已用 nonce
