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
# 步骤 1：环境检查
# ============================================================================
step "步骤 1/6 · 环境检查"

# 检查 Node.js
if ! command -v node &> /dev/null; then
  err "未检测到 Node.js，请先安装 Node.js 18+ (https://nodejs.org/)"
  exit 1
fi
NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js 版本过低（当前 $NODE_VERSION），需要 18+"
  exit 1
fi
log "Node.js: $NODE_VERSION"

# 检查 npm
if ! command -v npm &> /dev/null; then
  err "未检测到 npm，请随 Node.js 一并安装"
  exit 1
fi
log "npm: $(npm -v)"

# 检查 mysql 客户端（可选，仅用于初始化数据库）
MYSQL_AVAILABLE=false
if command -v mysql &> /dev/null; then
  MYSQL_AVAILABLE=true
  log "mysql 客户端: $(mysql --version)"
else
  warn "未检测到 mysql 客户端（跳过数据库自动初始化，请手动执行 schema.sql）"
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
