# 服务器部署指南

## 快速部署（一键脚本）

把代码上传到服务器后，运行：

```bash
# 方式1：用域名 + 80 端口
bash deploy.sh --domain example.com --port 80

# 方式2：用域名 + HTTPS
bash deploy.sh --domain example.com --port 443 --ssl

# 方式3：仅用 IP 访问（默认 80 端口）
bash deploy.sh

# 方式4：指定端口
bash deploy.sh --port 8080
```

脚本会自动完成：安装 Node.js/MySQL/Nginx/PM2 → 初始化数据库 → 构建前后端 → PM2 守护后端 → 配置 Nginx 反向代理。

## 部署架构

```
用户浏览器
    │
    ▼
Nginx (80/443)  ←── 静态文件 (web/dist/) + API 反向代理
    │
    ▼ (proxy_pass 127.0.0.1:3000)
PM2 守护的 Node.js 进程 (dist/app.js)
    │
    ▼
MySQL/MariaDB (3306)
```

## 手动部署步骤

### 1. 上传代码到服务器

```bash
# 在服务器上
git clone https://github.com/LINMO-com/cjhijkkdy.git
cd cjhijkkdy
```

### 2. 安装系统依赖

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs mariadb-server nginx
sudo npm install -g pm2

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs mariadb-server nginx
sudo npm install -g pm2
```

### 3. 配置数据库

```bash
sudo systemctl start mariadb
sudo systemctl enable mariadb

# 设置 root 密码
sudo mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED BY '你的密码';
FLUSH PRIVILEGES;
EOF

# 初始化库表
mysql -u root -p < database/schema.sql
```

### 4. 构建后端

```bash
cd server
cp .env.example .env
# 编辑 .env，填写数据库密码、生成随机 JWT_SECRET 和 SHARE_SECRET
npm install
npm run build
```

`.env` 关键配置：
```env
NODE_ENV=production
DB_PASSWORD=你的数据库密码
JWT_SECRET=随机32位以上字符串
SHARE_SECRET=随机64位以上字符串
STORAGE_ROOT=/绝对路径/storage
```

### 5. 构建前端

```bash
cd ../web
npm install
npm run build
# 产物在 web/dist/
```

### 6. 用 PM2 启动后端

```bash
cd ../server
pm2 start dist/app.js --name doc-share-server
pm2 save
pm2 startup  # 配置开机自启
```

### 7. 配置 Nginx

```bash
sudo tee /etc/nginx/conf.d/doc-share.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name example.com;  # 改成你的域名或 IP

    root /path/to/web/dist;   # 改成实际路径
    index index.html;

    client_max_body_size 500M;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo nginx -t && sudo systemctl reload nginx
```

## 常用运维命令

```bash
# PM2 管理
pm2 status                    # 查看进程状态
pm2 logs doc-share-server     # 实时日志
pm2 restart doc-share-server  # 重启后端
pm2 stop doc-share-server     # 停止后端

# Nginx
sudo nginx -t                 # 测试配置
sudo nginx -s reload          # 重载配置
sudo systemctl status nginx   # 状态

# 数据库
mysql -u root -p              # 连接数据库
sudo systemctl restart mariadb # 重启数据库

# 更新部署
git pull
cd server && npm run build && pm2 restart doc-share-server
cd ../web && npm run build
```

## 配置 HTTPS

```bash
# 安装 certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 自动配置 HTTPS
sudo certbot --nginx -d example.com

# 自动续期（certbot 会自动配置定时任务）
sudo certbot renew --dry-run
```

## 注意事项

1. **防火墙**：开放 80（HTTP）和 443（HTTPS）端口
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

2. **文件权限**：确保 `storage/` 目录可写
   ```bash
   chmod -R 755 storage/
   chown -R www-data:www-data storage/  # Nginx 用户
   ```

3. **数据库备份**：定期备份
   ```bash
   mysqldump -u root -p doc_share > backup_$(date +%Y%m%d).sql
   ```

4. **日志位置**：
   - 后端日志：`pm2 logs`
   - Nginx 日志：`/var/log/nginx/`
   - 数据库日志：`/var/log/mysql/`
