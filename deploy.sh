#!/usr/bin/env bash
# ============================================================================
# 企业级多模态文档管理与分享系统 - 生产环境部署脚本
# ----------------------------------------------------------------------------
# 适用：Linux 服务器（Ubuntu/Debian/CentOS/Alpine）
#
# 功能：
#   1. 安装 Node.js / MySQL / Nginx / PM2
#   2. 初始化数据库
#   3. 构建前后端生产产物
#   4. 用 PM2 守护后端进程
#   5. 配置 Nginx 反向代理（前端静态 + API 转发）
#   6. 可选配置 HTTPS（Let's Encrypt）
#
# 用法：
#   bash deploy.sh              # 交互式配置
#   bash deploy.sh --domain xxx.com --port 80
# ============================================================================
set -e

# 强制 bash
if [ -z "$BASH_VERSION" ]; then
  command -v bash >/dev/null 2>&1 && exec bash "$0" "$@" || { echo "需要 bash"; exit 1; }
fi

if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; NC=''
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

log()  { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
info() { printf "${BLUE}[i]${NC} %s\n" "$1"; }
err()  { printf "${RED}[✗]${NC} %s\n" "$1" >&2; }
step() {
  printf "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  printf "${CYAN}▶ %s${NC}\n" "$1"
  printf "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

has_cmd() { command -v "$1" >/dev/null 2>&1; }

# ============================================================================
# 解析命令行参数
# ============================================================================
DOMAIN=""
PORT=80
DB_PASS=""
INSTALL_SSL=false

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --db-pass) DB_PASS="$2"; shift 2 ;;
    --ssl) INSTALL_SSL=true; shift ;;
    *) err "未知参数: $1"; exit 1 ;;
  esac
done

# ============================================================================
# 检测系统
# ============================================================================
OS_TYPE="unknown"
PKG_MANAGER=""
if [ -f /etc/debian_version ]; then OS_TYPE="debian"; PKG_MANAGER="apt"
elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ]; then OS_TYPE="rhel"; PKG_MANAGER="yum"
elif [ -f /etc/alpine-release ]; then OS_TYPE="alpine"; PKG_MANAGER="apk"
elif [ "$(uname -s)" = "Darwin" ]; then OS_TYPE="macos"; PKG_MANAGER="brew"
fi

# 检查 root 权限（安装系统软件需要）
if [ "$(id -u)" -ne 0 ] && [ "$OS_TYPE" != "macos" ]; then
  warn "建议使用 root 用户运行，或使用 sudo。当前非 root，将尝试 sudo..."
  if ! sudo -n true 2>/dev/null; then
    err "需要 sudo 权限安装系统软件，请使用 root 或配置 sudo 免密"
    exit 1
  fi
fi

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

info "检测到系统: $OS_TYPE ($PKG_MANAGER)"

# ============================================================================
# 步骤 1：安装系统依赖
# ============================================================================
step "步骤 1/6 · 安装系统依赖"

# 安装 Node.js 20
if ! has_cmd node || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ] 2>/dev/null; then
  info "安装 Node.js 20 ..."
  case "$OS_TYPE" in
    debian)
      curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash - 2>&1 | tail -3
      $SUDO apt-get install -y nodejs 2>&1 | tail -3
      ;;
    rhel)
      curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash - 2>&1 | tail -3
      $SUDO yum install -y nodejs 2>&1 | tail -3
      ;;
    alpine) $SUDO apk add --no-cache nodejs npm 2>&1 | tail -3 ;;
    macos) brew install node@20 2>&1 | tail -3 ;;
  esac
fi
log "Node.js: $(node -v)"

# 安装 MySQL/MariaDB
if ! has_cmd mysql; then
  info "安装 MariaDB ..."
  case "$OS_TYPE" in
    debian) $SUDO apt-get install -y mariadb-server 2>&1 | tail -3 ;;
    rhel) $SUDO yum install -y mariadb-server 2>&1 | tail -3 ;;
    alpine) $SUDO apk add --no-cache mariadb mariadb-client 2>&1 | tail -3 ;;
    macos) brew install mariadb 2>&1 | tail -3 ;;
  esac
fi
log "MySQL: $(mysql --version 2>&1 | head -1)"

# 安装 Nginx
if ! has_cmd nginx; then
  info "安装 Nginx ..."
  case "$OS_TYPE" in
    debian) $SUDO apt-get install -y nginx 2>&1 | tail -3 ;;
    rhel) $SUDO yum install -y nginx 2>&1 | tail -3 ;;
    alpine) $SUDO apk add --no-cache nginx 2>&1 | tail -3 ;;
    macos) brew install nginx 2>&1 | tail -3 ;;
  esac
fi
log "Nginx: $(nginx -v 2>&1)"

# 安装 PM2（全局）
if ! has_cmd pm2; then
  info "安装 PM2 ..."
  $SUDO npm install -g pm2 2>&1 | tail -3
fi
log "PM2: $(pm2 -v 2>&1 | head -1)"

# ============================================================================
# 步骤 2：启动数据库并初始化
# ============================================================================
step "步骤 2/6 · 配置数据库"

# 启动数据库服务
if [ "$OS_TYPE" = "macos" ]; then
  brew services start mariadb 2>&1 | tail -2 || true
else
  $SUDO systemctl start mariadb 2>/dev/null || $SUDO systemctl start mysql 2>/dev/null || $SUDO service mysql start 2>/dev/null || true
  $SUDO systemctl enable mariadb 2>/dev/null || $SUDO systemctl enable mysql 2>/dev/null || true
fi
sleep 2
log "数据库服务已启动"

# 设置 root 密码（如果未设置）
if [ -z "$DB_PASS" ]; then
  DB_PASS="$(openssl rand -hex 12)"
  info "生成随机数据库密码: $DB_PASS"
fi

# 尝试连接（空密码或已有密码）
DB_USER="root"
DB_CONNECT_OK=false
for try_pass in "" "$DB_PASS"; do
  if mysql -u"$DB_USER" -p"$try_pass" -e "SELECT 1" >/dev/null 2>&1; then
    DB_PASS="$try_pass"
    DB_CONNECT_OK=true
    break
  fi
done

# 如果连不上，设置 root 密码
if [ "$DB_CONNECT_OK" = false ]; then
  info "设置 MariaDB root 密码..."
  $SUDO mysql -u root <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED BY '$DB_PASS';
FLUSH PRIVILEGES;
EOF
  sleep 1
  if mysql -u"$DB_USER" -p"$DB_PASS" -e "SELECT 1" >/dev/null 2>&1; then
    DB_CONNECT_OK=true
    log "root 密码设置成功"
  else
    err "root 密码设置失败，请手动配置数据库"
    exit 1
  fi
fi
log "数据库连接成功"

# 初始化 schema
info "初始化数据库 schema..."
mysql -u"$DB_USER" -p"$DB_PASS" < "$SCRIPT_DIR/database/schema.sql" 2>&1 | grep -v "Using a password" | tail -5 || true
log "数据库 schema 初始化完成"

# ============================================================================
# 步骤 3：构建后端
# ============================================================================
step "步骤 3/6 · 构建后端"

cd "$SCRIPT_DIR/server"

# 生成生产环境 .env
info "生成生产环境 .env ..."
JWT_SECRET="$(openssl rand -hex 32)"
SHARE_SECRET="$(openssl rand -hex 64)"
cat > .env <<EOF
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=doc_share
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=8h
SHARE_SECRET=$SHARE_SECRET
SHARE_TTL_NORMAL_MINUTES=15
SHARE_TTL_LARGE_MINUTES=30
LARGE_FILE_THRESHOLD_BYTES=104857600
STORAGE_ROOT=$SCRIPT_DIR/storage
ALLOWED_EXTENSIONS=pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md,json,csv,jpg,jpeg,png,gif,webp,svg,zip,rar
MAX_UPLOAD_SIZE=524288000
CORS_ORIGIN=http://localhost:$PORT,http://127.0.0.1:$PORT
NODE_ENV=production
EOF
log ".env 已生成"

# 安装依赖并构建
if [ ! -d "node_modules" ]; then
  info "安装后端依赖..."
  npm install --no-audit --no-fund 2>&1 | tail -3
fi
info "编译 TypeScript..."
npm run build 2>&1 | tail -5
log "后端构建完成: dist/"

# 创建存储目录
mkdir -p "$SCRIPT_DIR/storage"
log "存储目录已创建"

# ============================================================================
# 步骤 4：构建前端
# ============================================================================
step "步骤 4/6 · 构建前端"

cd "$SCRIPT_DIR/web"

if [ ! -d "node_modules" ]; then
  info "安装前端依赖..."
  npm install --no-audit --no-fund 2>&1 | tail -3
fi
info "构建前端生产包..."
npm run build 2>&1 | tail -5
log "前端构建完成: dist/"

# ============================================================================
# 步骤 5：配置 PM2 守护后端
# ============================================================================
step "步骤 5/6 · 配置 PM2"

cd "$SCRIPT_DIR/server"

# 生成 PM2 配置文件
cat > ecosystem.config.cjs <<EOF
module.exports = {
  apps: [{
    name: 'doc-share-server',
    script: 'dist/app.js',
    cwd: '$SCRIPT_DIR/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '$SCRIPT_DIR/.run/logs/pm2-error.log',
    out_file: '$SCRIPT_DIR/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
EOF

# 停止旧进程（如有）
pm2 delete doc-share-server 2>/dev/null || true
# 启动
pm2 start ecosystem.config.cjs 2>&1 | tail -5
pm2 save 2>&1 | tail -2
log "PM2 已启动后端进程"

# 配置开机自启
if [ "$OS_TYPE" != "macos" ]; then
  $SUDO env PATH=$PATH:/usr/bin pm2 startup systemd -u $(whoami) --hp $HOME 2>&1 | tail -3 || true
  log "PM2 开机自启已配置"
fi

# ============================================================================
# 步骤 6：配置 Nginx
# ============================================================================
step "步骤 6/6 · 配置 Nginx"

# 确定域名
if [ -z "$DOMAIN" ]; then
  DOMAIN="_"  # 匹配所有域名
  info "未指定域名，使用默认配置（IP 访问）"
else
  log "域名: $DOMAIN"
fi

# Nginx 配置文件
NGINX_CONF="doc-share"
if [ "$OS_TYPE" = "macos" ]; then
  NGINX_CONF_DIR="/usr/local/etc/nginx/servers"
  [ -d "/opt/homebrew/etc/nginx/servers" ] && NGINX_CONF_DIR="/opt/homebrew/etc/nginx/servers"
  NGINX_SITE="$NGINX_CONF_DIR/$NGINX_CONF.conf"
  $SUDO mkdir -p "$NGINX_CONF_DIR"
else
  NGINX_SITE="/etc/nginx/conf.d/$NGINX_CONF.conf"
fi

# 生成 Nginx 配置
info "生成 Nginx 配置: $NGINX_SITE"
$SUDO tee "$NGINX_SITE" > /dev/null <<EOF
# 企业级多模态文档管理与分享系统 - Nginx 配置
server {
    listen $PORT;
    server_name $DOMAIN;

    # 前端静态文件
    root $SCRIPT_DIR/web/dist;
    index index.html;

    # 上传文件大小限制（与后端 MAX_UPLOAD_SIZE 对齐）
    client_max_body_size 500M;

    # gzip 压缩
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1000;

    # API 请求转发到后端（PM2 守护的 Node.js 进程）
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # 上传大文件超时设置
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        proxy_request_buffering off;
    }

    # 文件存储目录（用于直接访问上传的文件，可选）
    # 如需直接访问存储文件，取消下面注释并配置
    # location /storage/ {
    #     alias $SCRIPT_DIR/storage/;
    #     internal;
    # }

    # Vue Router history 模式：所有路由回退到 index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF

# 测试 Nginx 配置
if $SUDO nginx -t 2>&1; then
  log "Nginx 配置语法正确"
else
  err "Nginx 配置语法错误，请检查 $NGINX_SITE"
  exit 1
fi

# 重载 Nginx
if [ "$OS_TYPE" = "macos" ]; then
  brew services restart nginx 2>&1 | tail -2 || $SUDO nginx -s reload
else
  $SUDO systemctl restart nginx 2>&1 || $SUDO nginx -s reload 2>&1
  $SUDO systemctl enable nginx 2>/dev/null || true
fi
log "Nginx 已启动"

# ============================================================================
# 可选：配置 HTTPS（Let's Encrypt）
# ============================================================================
if [ "$INSTALL_SSL" = true ] && [ "$DOMAIN" != "_" ]; then
  step "配置 HTTPS (Let's Encrypt)"
  if [ "$OS_TYPE" = "debian" ]; then
    $SUDO apt-get install -y certbot python3-certbot-nginx 2>&1 | tail -3
    $SUDO certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email 2>&1 | tail -5
    log "HTTPS 已配置"
  else
    warn "当前系统不支持自动配置 HTTPS，请手动安装 certbot"
  fi
fi

# ============================================================================
# 完成提示
# ============================================================================
printf "\n"
printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "${GREEN}✓ 部署完成！${NC}\n"
printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "\n"

# 获取服务器 IP
SERVER_IP="$(curl -s ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo '服务器IP')"
if [ "$DOMAIN" = "_" ]; then
  ACCESS_URL="http://$SERVER_IP"
  if [ "$PORT" != "80" ]; then ACCESS_URL="http://$SERVER_IP:$PORT"; fi
else
  ACCESS_URL="http://$DOMAIN"
  if [ "$PORT" != "80" ]; then ACCESS_URL="http://$DOMAIN:$PORT"; fi
fi

printf "  ${CYAN}访问地址${NC}:  $ACCESS_URL\n"
printf "  ${CYAN}管理后台${NC}:  $ACCESS_URL/admin/login\n"
printf "  ${CYAN}默认账号${NC}:  admin / admin123\n"
printf "\n"
printf "  ${YELLOW}数据库密码${NC}:  $DB_PASS （请妥善保存）\n"
printf "  ${YELLOW}配置文件${NC}:  server/.env\n"
printf "\n"
printf "  ${BLUE}常用命令${NC}:\n"
printf "    pm2 status              # 查看后端状态\n"
printf "    pm2 logs doc-share-server  # 查看后端日志\n"
printf "    pm2 restart doc-share-server # 重启后端\n"
printf "    sudo nginx -s reload    # 重载 Nginx\n"
printf "    sudo systemctl status nginx  # Nginx 状态\n"
printf "\n"
printf "  ${BLUE}更新代码后重新部署${NC}:\n"
printf "    git pull && bash deploy.sh --domain $DOMAIN --port $PORT --db-pass '$DB_PASS'\n"
printf "\n"
