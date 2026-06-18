#!/usr/bin/env bash
# ============================================================================
# 企业级多模态文档管理与分享系统 - 一键启动脚本
# ----------------------------------------------------------------------------
# 功能：
#   1. 检查运行环境（Node.js / npm / mysql）
#   2. 初始化数据库（可选，交互式询问）
#   3. 安装后端与前端依赖
#   4. 自动生成后端 .env 配置文件
#   5. 后台启动后端（端口 3000）与前端（端口 5173）
#   6. 自动打开浏览器入口页
#
# 用法：
#   chmod +x start.sh
#   ./start.sh
#
# 停止服务：
#   ./stop.sh   或   bash stop.sh
# ============================================================================

set -e

# ----------------------------------------------------------------------------
# 颜色与日志工具
# ----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 脚本所在目录（即项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 运行时文件（记录 PID 以便停止）
PID_FILE="$SCRIPT_DIR/.run/pids"
LOG_DIR="$SCRIPT_DIR/.run/logs"
mkdir -p "$LOG_DIR"
mkdir -p "$SCRIPT_DIR/.run"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
step()  { echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${CYAN}▶ $1${NC}"; echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ----------------------------------------------------------------------------
# 捕获退出与中断：自动停止已启动的服务
# ----------------------------------------------------------------------------
cleanup() {
  echo ""
  warn "收到中断信号，正在清理已启动的服务..."
  if [ -f "$PID_FILE" ]; then
    while read -r pid name; do
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        log "已停止 $name (PID: $pid)"
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  exit 1
}
trap cleanup INT TERM

# ============================================================================
# 步骤 1：环境检查与自动安装
# ============================================================================
step "步骤 1/6 · 环境检查与自动安装"

# ----------------------------------------------------------------------------
# 操作系统检测
# ----------------------------------------------------------------------------
OS_TYPE="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS_TYPE="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if [ -f /etc/debian_version ]; then
    OS_TYPE="debian"
  elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ]; then
    OS_TYPE="rhel"
  elif [ -f /etc/alpine-release ]; then
    OS_TYPE="alpine"
  else
    OS_TYPE="linux"
  fi
fi
info "检测到操作系统: $OS_TYPE"

# ----------------------------------------------------------------------------
# 检测是否有 sudo 权限（用于安装系统级软件）
# ----------------------------------------------------------------------------
HAS_SUDO=false
if [ "$EUID" -eq 0 ]; then
  HAS_SUDO=true
elif sudo -n true 2>/dev/null; then
  HAS_SUDO=true
fi

# ----------------------------------------------------------------------------
# 工具函数：检测命令是否存在
# ----------------------------------------------------------------------------
has_cmd() { command -v "$1" &> /dev/null; }

# ----------------------------------------------------------------------------
# 安装 Node.js 18 LTS（如未安装或版本过低）
# ----------------------------------------------------------------------------
install_nodejs() {
  info "开始自动安装 Node.js 20 LTS ..."
  case "$OS_TYPE" in
    debian)
      if [ "$HAS_SUDO" = true ]; then
        info "使用 NodeSource 仓库安装 (Debian/Ubuntu)..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3
        sudo -E apt-get install -y nodejs 2>&1 | tail -3
      else
        err "需要 sudo 权限安装 Node.js，请手动运行: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
        exit 1
      fi
      ;;
    rhel)
      if [ "$HAS_SUDO" = true ]; then
        info "使用 NodeSource 仓库安装 (RHEL/CentOS)..."
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3
        sudo -E yum install -y nodejs 2>&1 | tail -3
      else
        err "需要 sudo 权限安装 Node.js，请手动运行: curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo yum install -y nodejs"
        exit 1
      fi
      ;;
    alpine)
      if [ "$HAS_SUDO" = true ]; then
        info "使用 apk 安装 (Alpine)..."
        sudo apk add --no-cache nodejs npm 2>&1 | tail -3
      else
        err "需要 root 权限，请手动运行: apk add --no-cache nodejs npm"
        exit 1
      fi
      ;;
    macos)
      if has_cmd brew; then
        info "使用 Homebrew 安装..."
        brew install node@20 2>&1 | tail -3
        brew link node@20 --force --overwrite 2>&1 | tail -2 || true
      else
        info "未检测到 Homebrew，先安装 Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>&1 | tail -3
        # 重新加载 PATH
        if [[ "$OSTYPE" == "darwin"* ]]; then
          eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv 2>/dev/null)"
        fi
        brew install node@20 2>&1 | tail -3
        brew link node@20 --force --overwrite 2>&1 | tail -2 || true
      fi
      ;;
    *)
      err "不支持的操作系统 $OS_TYPE，请手动安装 Node.js 18+: https://nodejs.org/"
      exit 1
      ;;
  esac

  # 刷新当前 shell 的 PATH（NodeSource 安装后可能需要）
  hash -r 2>/dev/null || true
  export PATH="/usr/local/bin:/usr/bin:/opt/homebrew/bin:/usr/local/opt/node@20/bin:$PATH"

  # 验证安装
  if ! has_cmd node; then
    err "Node.js 安装失败，请手动安装: https://nodejs.org/"
    exit 1
  fi
  log "Node.js 安装成功: $(node -v)"
}

# 检查 Node.js
NEED_INSTALL_NODE=false
if ! has_cmd node; then
  warn "未检测到 Node.js"
  NEED_INSTALL_NODE=true
else
  NODE_VERSION=$(node -v | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    warn "Node.js 版本过低（当前 $NODE_VERSION，需要 18+）"
    NEED_INSTALL_NODE=true
  fi
fi

if [ "$NEED_INSTALL_NODE" = true ]; then
  install_nodejs
else
  log "Node.js: $(node -v)"
fi

# 重新读取版本（安装后）
NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

# 检查 npm（通常随 Node.js 一起安装）
if ! has_cmd npm; then
  err "Node.js 已安装但未找到 npm，请重新安装 Node.js"
  exit 1
fi
log "npm: $(npm -v)"

# ----------------------------------------------------------------------------
# 安装 mysql 客户端（可选，仅用于自动初始化数据库）
# ----------------------------------------------------------------------------
install_mysql_client() {
  info "开始自动安装 MySQL 客户端 ..."
  case "$OS_TYPE" in
    debian)
      [ "$HAS_SUDO" = true ] && sudo -E apt-get install -y mysql-client 2>&1 | tail -3
      ;;
    rhel)
      [ "$HAS_SUDO" = true ] && sudo -E yum install -y mysql 2>&1 | tail -3
      ;;
    alpine)
      [ "$HAS_SUDO" = true ] && sudo apk add --no-cache mysql-client 2>&1 | tail -3
      ;;
    macos)
      if has_cmd brew; then
        brew install mysql-client 2>&1 | tail -3
        # 提示加入 PATH
        if [[ "$OSTYPE" == "darwin"* ]]; then
          export PATH="/opt/homebrew/opt/mysql-client/bin:/usr/local/opt/mysql-client/bin:$PATH"
        fi
      fi
      ;;
  esac
  hash -r 2>/dev/null || true
}

MYSQL_AVAILABLE=false
if has_cmd mysql; then
  MYSQL_AVAILABLE=true
  log "mysql 客户端: $(mysql --version)"
else
  warn "未检测到 mysql 客户端"
  if [ "$HAS_SUDO" = true ] || [ "$OS_TYPE" = "macos" ]; then
    read -rp "$(echo -e ${YELLOW}"是否自动安装 mysql 客户端？[Y/n]: "${NC})" INSTALL_MYSQL
    INSTALL_MYSQL=${INSTALL_MYSQL:-Y}
    if [[ "$INSTALL_MYSQL" =~ ^[Yy]$ ]]; then
      install_mysql_client
      if has_cmd mysql; then
        MYSQL_AVAILABLE=true
        log "mysql 客户端安装成功: $(mysql --version)"
      else
        warn "mysql 客户端安装失败，可稍后手动安装（不影响启动，仅无法自动初始化数据库）"
      fi
    fi
  else
    warn "无 sudo 权限，跳过 mysql 客户端安装（不影响启动，仅无法自动初始化数据库）"
  fi
fi

# ----------------------------------------------------------------------------
# 安装 curl（用于健康检查，大多数系统自带）
# ----------------------------------------------------------------------------
if ! has_cmd curl; then
  info "安装 curl ..."
  case "$OS_TYPE" in
    debian) [ "$HAS_SUDO" = true ] && sudo -E apt-get install -y curl 2>&1 | tail -2 ;;
    rhel)   [ "$HAS_SUDO" = true ] && sudo -E yum install -y curl 2>&1 | tail -2 ;;
    alpine) [ "$HAS_SUDO" = true ] && sudo apk add --no-cache curl 2>&1 | tail -2 ;;
    macos)  has_cmd brew && brew install curl 2>&1 | tail -2 ;;
  esac
  hash -r 2>/dev/null || true
fi

# ============================================================================
# 步骤 2：数据库初始化（可选）
# ============================================================================
step "步骤 2/6 · 数据库配置"

# 询问是否初始化数据库
read -rp "$(echo -e ${YELLOW}"是否初始化数据库？这将执行 database/schema.sql [y/N]: "${NC})" INIT_DB
INIT_DB=${INIT_DB:-N}

if [[ "$INIT_DB" =~ ^[Yy]$ ]]; then
  if [ "$MYSQL_AVAILABLE" = false ]; then
    err "未安装 mysql 客户端，无法自动初始化。请手动执行：mysql -u root -p < database/schema.sql"
    exit 1
  fi
  read -rp "MySQL 用户名 [root]: " MYSQL_USER
  MYSQL_USER=${MYSQL_USER:-root}
  read -s -p "MySQL 密码: " MYSQL_PASS
  echo ""
  info "正在执行 database/schema.sql ..."
  if mysql -u"$MYSQL_USER" -p"$MYSQL_PASS" < "$SCRIPT_DIR/database/schema.sql" 2>/dev/null; then
    log "数据库初始化成功（数据库: doc_share，默认管理员: admin / admin123）"
  else
    err "数据库初始化失败，请检查用户名密码或手动执行 schema.sql"
    exit 1
  fi
else
  warn "跳过数据库初始化。如需初始化请手动执行：mysql -u root -p < database/schema.sql"
fi

# ============================================================================
# 步骤 3：后端依赖安装与配置
# ============================================================================
step "步骤 3/6 · 后端依赖与配置"

cd "$SCRIPT_DIR/server"

# 生成 .env（如不存在）
if [ ! -f ".env" ]; then
  info "生成后端 .env 配置文件..."
  cp .env.example .env
  # 生成随机密钥并替换
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | base64)
  SHARE_SECRET=$(openssl rand -hex 64 2>/dev/null || head -c 64 /dev/urandom | base64)
  # 兼容 macOS sed 与 GNU sed
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
    sed -i '' "s|SHARE_SECRET=.*|SHARE_SECRET=$SHARE_SECRET|g" .env
  else
    sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
    sed -i "s|SHARE_SECRET=.*|SHARE_SECRET=$SHARE_SECRET|g" .env
  fi
  log ".env 已生成（含随机密钥）"
else
  log ".env 已存在，跳过生成"
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
  info "安装后端依赖（首次可能较慢）..."
  npm install --no-audit --no-fund 2>&1 | tail -3
  log "后端依赖安装完成"
else
  log "后端依赖已存在，跳过安装"
fi

# ============================================================================
# 步骤 4：前端依赖安装
# ============================================================================
step "步骤 4/6 · 前端依赖与配置"

cd "$SCRIPT_DIR/web"

if [ ! -d "node_modules" ]; then
  info "安装前端依赖（首次可能较慢）..."
  npm install --no-audit --no-fund 2>&1 | tail -3
  log "前端依赖安装完成"
else
  log "前端依赖已存在，跳过安装"
fi

# ============================================================================
# 步骤 5：启动服务
# ============================================================================
step "步骤 5/6 · 启动服务"

# 清空旧 PID 文件
: > "$PID_FILE"

# 启动后端（后台运行，日志写入文件）
info "启动后端服务（端口 3000）..."
cd "$SCRIPT_DIR/server"
npm run dev > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID server" >> "$PID_FILE"
log "后端已启动 (PID: $SERVER_PID)"

# 启动前端（后台运行）
info "启动前端服务（端口 5173）..."
cd "$SCRIPT_DIR/web"
npm run dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "$WEB_PID web" >> "$PID_FILE"
log "前端已启动 (PID: $WEB_PID)"

# ============================================================================
# 步骤 6：健康检查与打开浏览器
# ============================================================================
step "步骤 6/6 · 健康检查与打开浏览器"

# 等待后端就绪
info "等待后端服务就绪..."
BACKEND_READY=false
for i in {1..30}; do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    BACKEND_READY=true
    break
  fi
  sleep 1
  printf "."
done
echo ""

if [ "$BACKEND_READY" = true ]; then
  log "后端服务就绪 (http://localhost:3000/api/health)"
else
  warn "后端服务未在 30 秒内就绪，可能仍在启动中（请查看 .run/logs/server.log）"
fi

# 等待前端就绪
info "等待前端服务就绪..."
FRONTEND_READY=false
for i in {1..30}; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    FRONTEND_READY=true
    break
  fi
  sleep 1
  printf "."
done
echo ""

if [ "$FRONTEND_READY" = true ]; then
  log "前端服务就绪 (http://localhost:5173)"
else
  warn "前端服务未在 30 秒内就绪，可能仍在启动中（请查看 .run/logs/web.log）"
fi

# 打开浏览器入口页
info "打开浏览器..."
ENTRY_URL="file://$SCRIPT_DIR/index.html"
if command -v xdg-open &> /dev/null; then
  xdg-open "$ENTRY_URL" 2>/dev/null || true
elif command -v open &> /dev/null; then
  open "$ENTRY_URL" 2>/dev/null || true
else
  warn "无法自动打开浏览器，请手动打开: $ENTRY_URL"
fi

# ============================================================================
# 完成提示
# ============================================================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ 系统已启动！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${CYAN}网页前端${NC}:  http://localhost:5173/"
echo -e "  ${CYAN}管理后台${NC}:  http://localhost:5173/admin/login"
echo -e "  ${CYAN}后端 API${NC}:  http://localhost:3000/api/health"
echo -e "  ${CYAN}默认账号${NC}:  admin / admin123"
echo ""
echo -e "  ${YELLOW}日志位置${NC}:  .run/logs/server.log  和  .run/logs/web.log"
echo -e "  ${YELLOW}停止服务${NC}:  运行 ./stop.sh  或按 Ctrl+C"
echo ""
echo -e "  ${BLUE}提示${NC}: 服务在后台运行，关闭此终端不会停止服务。"
echo -e "        如需停止，请运行 ./stop.sh"
echo ""

# 保持脚本运行，Ctrl+C 触发 cleanup
info "按 Ctrl+C 停止所有服务，或直接关闭终端（服务继续后台运行）"
while true; do
  sleep 5
  # 检查服务是否仍在运行
  if ! kill -0 "$SERVER_PID" 2>/dev/null && ! kill -0 "$WEB_PID" 2>/dev/null; then
    warn "检测到服务已停止，请查看日志排查原因"
    exit 1
  fi
done
