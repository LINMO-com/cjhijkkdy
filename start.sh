#!/usr/bin/env bash
# ============================================================================
# 企业级多模态文档管理与分享系统 - 一键启动脚本（全自动零交互版）
# ----------------------------------------------------------------------------
# 兼容环境：Linux / macOS / Termux(Android)
#
# 用法：
#   bash start.sh        # 全自动，无需输入任何用户名密码
#
# 停止服务：
#   bash stop.sh
# ============================================================================

# 强制使用 bash 运行（防止被 dash/sh 解释）
if [ -z "$BASH_VERSION" ]; then
  if command -v bash >/dev/null 2>&1; then
    exec bash "$0" "$@"
  else
    echo "错误：此脚本需要 bash，请先安装 bash" >&2
    exit 1
  fi
fi

set -e

# ----------------------------------------------------------------------------
# 颜色与日志工具
# ----------------------------------------------------------------------------
if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; NC=''
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/.run/pids"
LOG_DIR="$SCRIPT_DIR/.run/logs"
mkdir -p "$LOG_DIR" "$SCRIPT_DIR/.run"

log()  { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${NC} %s\n" "$1"; }
info() { printf "${BLUE}[i]${NC} %s\n" "$1"; }
err()  { printf "${RED}[✗]${NC} %s\n" "$1" >&2; }
step() {
  printf "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  printf "${CYAN}▶ %s${NC}\n" "$1"
  printf "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

cleanup() {
  printf "\n"
  warn "收到中断信号，正在清理已启动的服务..."
  if [ -f "$PID_FILE" ]; then
    while read -r pid name; do
      [ -n "$pid" ] || continue
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

has_cmd() { command -v "$1" >/dev/null 2>&1; }

# ============================================================================
# 步骤 1：环境检测与自动安装
# ============================================================================
step "步骤 1/7 · 环境检测与自动安装"

OS_TYPE="unknown"
PKG_MANAGER=""
HAS_SUDO=false
IS_TERMUX=false

if [ -n "$PREFIX" ] && case "$PREFIX" in *com.termux*) true;; *) false;; esac; then
  IS_TERMUX=true
  OS_TYPE="termux"
  PKG_MANAGER="pkg"
  HAS_SUDO=false
  info "检测到环境: Termux (Android)"
elif [ -n "$OSTYPE" ]; then
  case "$OSTYPE" in
    darwin*) OS_TYPE="macos"; PKG_MANAGER="brew"; HAS_SUDO=false ;;
    linux-gnu*)
      if [ -f /etc/debian_version ]; then OS_TYPE="debian"; PKG_MANAGER="apt"
      elif [ -f /etc/redhat-release ] || [ -f /etc/centos-release ] || [ -f /etc/fedora-release ]; then OS_TYPE="rhel"; PKG_MANAGER="yum"
      elif [ -f /etc/alpine-release ]; then OS_TYPE="alpine"; PKG_MANAGER="apk"
      else OS_TYPE="linux"; PKG_MANAGER=""; fi
      if [ "$(id -u)" -eq 0 ]; then HAS_SUDO=true
      elif sudo -n true 2>/dev/null; then HAS_SUDO=true; fi
      ;;
  esac
fi

if [ "$OS_TYPE" = "unknown" ]; then
  UNAME_S="$(uname -s 2>/dev/null || echo unknown)"
  case "$UNAME_S" in
    Linux*) OS_TYPE="linux" ;;
    Darwin*) OS_TYPE="macos"; PKG_MANAGER="brew" ;;
  esac
fi
info "操作系统: $OS_TYPE  包管理器: ${PKG_MANAGER:-无}  sudo: $HAS_SUDO"

pkg_install() {
  if [ "$IS_TERMUX" = true ]; then
    pkg install -y "$@" 2>&1 | tail -3
  elif [ "$OS_TYPE" = "macos" ]; then
    brew install "$@" 2>&1 | tail -3
  elif [ "$HAS_SUDO" = true ]; then
    case "$PKG_MANAGER" in
      apt) sudo -E apt-get install -y "$@" 2>&1 | tail -3 ;;
      yum) sudo -E yum install -y "$@" 2>&1 | tail -3 ;;
      apk) sudo apk add --no-cache "$@" 2>&1 | tail -3 ;;
      dnf) sudo -E dnf install -y "$@" 2>&1 | tail -3 ;;
    esac
  else
    err "无 sudo 权限，无法自动安装: $*"
    return 1
  fi
}

# ----------------------------------------------------------------------------
# 安装 Node.js
# ----------------------------------------------------------------------------
install_nodejs() {
  info "开始自动安装 Node.js ..."
  case "$OS_TYPE" in
    termux) pkg_install nodejs ;;
    debian)
      if [ "$HAS_SUDO" = true ]; then
        info "使用 NodeSource 仓库安装 Node.js 20 ..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3
        sudo -E apt-get install -y nodejs 2>&1 | tail -3
      fi ;;
    rhel)
      if [ "$HAS_SUDO" = true ]; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash - 2>&1 | tail -3
        sudo -E yum install -y nodejs 2>&1 | tail -3
      fi ;;
    alpine) pkg_install nodejs npm ;;
    macos)
      if ! has_cmd brew; then
        info "安装 Homebrew ..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>&1 | tail -3
        if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
      fi
      brew install node@20 2>&1 | tail -3
      brew link node@20 --force --overwrite 2>&1 | tail -2 || true ;;
    *) err "不支持的操作系统，请手动安装 Node.js 18+: https://nodejs.org/"; exit 1 ;;
  esac
  hash -r 2>/dev/null || true
  export PATH="/usr/local/bin:/usr/bin:/opt/homebrew/bin:$PREFIX/bin:$PATH"
}

NEED_INSTALL_NODE=false
if ! has_cmd node; then
  warn "未检测到 Node.js"
  NEED_INSTALL_NODE=true
else
  NODE_VERSION="$(node -v 2>/dev/null | sed 's/v//')"
  NODE_MAJOR="$(printf '%s' "$NODE_VERSION" | cut -d. -f1)"
  if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ] 2>/dev/null; then
    warn "Node.js 版本过低（当前 ${NODE_VERSION:-未知}，需要 18+）"
    NEED_INSTALL_NODE=true
  fi
fi

if [ "$NEED_INSTALL_NODE" = true ]; then
  install_nodejs
  if has_cmd node; then log "Node.js 安装成功: $(node -v)"
  else err "Node.js 安装失败，请手动安装: https://nodejs.org/"; exit 1; fi
else
  log "Node.js: $(node -v)"
fi

if ! has_cmd npm; then err "Node.js 已安装但未找到 npm"; exit 1; fi
log "npm: $(npm -v)"

# ----------------------------------------------------------------------------
# 安装 MariaDB/MySQL（Termux 用 mariadb，其他按需）
# ----------------------------------------------------------------------------
install_db() {
  info "开始自动安装数据库 ..."
  case "$OS_TYPE" in
    termux)  pkg_install mariadb ;;
    debian)  pkg_install mariadb-server ;;
    rhel)    pkg_install mariadb-server ;;
    alpine)  pkg_install mariadb mariadb-client ;;
    macos)   brew install mariadb 2>&1 | tail -3 ;;
  esac
  hash -r 2>/dev/null || true
}

if has_cmd mysql; then
  log "mysql 客户端: $(mysql --version 2>&1 | head -1)"
else
  warn "未检测到 mysql 客户端，自动安装..."
  install_db
  if has_cmd mysql; then log "数据库安装成功"
  else warn "数据库安装失败，后续会尝试继续"; fi
fi

# 安装 curl
if ! has_cmd curl; then
  info "安装 curl ..."
  case "$OS_TYPE" in
    termux)  pkg_install curl ;;
    debian)  pkg_install curl ;;
    rhel)    pkg_install curl ;;
    alpine)  pkg_install curl ;;
    macos)   has_cmd brew && brew install curl 2>&1 | tail -2 ;;
  esac
  hash -r 2>/dev/null || true
fi

# ============================================================================
# 步骤 2：启动数据库服务（全自动，无需输入密码）
# ============================================================================
step "步骤 2/7 · 启动数据库服务"

DB_USER="root"
DB_PASS=""
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME="doc_share"

# Termux 环境下 MariaDB 需要先初始化数据目录再启动
if [ "$IS_TERMUX" = true ]; then
  info "Termux 环境：配置 MariaDB ..."
  # Termux MariaDB 数据目录
  DB_DATA_DIR="$HOME/.mysql_data"
  mkdir -p "$DB_DATA_DIR"

  # 如果数据目录未初始化，执行 mysql_install_db
  if [ ! -d "$DB_DATA_DIR/mysql" ]; then
    info "首次使用，初始化 MariaDB 数据目录..."
    if has_cmd mysql_install_db; then
      mysql_install_db --datadir="$DB_DATA_DIR" --basedir="$PREFIX" 2>&1 | tail -5
      log "数据目录初始化完成"
    elif has_cmd mariadb-install-db; then
      mariadb-install-db --datadir="$DB_DATA_DIR" --basedir="$PREFIX" 2>&1 | tail -5
      log "数据目录初始化完成"
    else
      err "未找到 mysql_install_db，请手动运行: mysql_install_db"
      exit 1
    fi
  else
    log "数据目录已存在，跳过初始化"
  fi

  # 启动 MariaDB 服务（如果未运行）
  if ! pgrep -x "mysqld\|mariadbd" >/dev/null 2>&1; then
    info "启动 MariaDB 服务..."
    if has_cmd mysqld; then
      nohup mysqld --datadir="$DB_DATA_DIR" --socket="$PREFIX/var/run/mysqld.sock" --pid-file="$PREFIX/var/run/mysqld.pid" >"$LOG_DIR/mysqld.log" 2>&1 &
    elif has_cmd mariadbd; then
      nohup mariadbd --datadir="$DB_DATA_DIR" >"$LOG_DIR/mysqld.log" 2>&1 &
    fi
    # 等待服务就绪（最多 20 秒）
    info "等待 MariaDB 服务就绪..."
    for i in $(seq 1 20); do
      if mysqladmin ping -u"$DB_USER" --silent 2>/dev/null; then
        log "MariaDB 服务已就绪"
        break
      fi
      sleep 1
      printf "."
    done
    printf "\n"
  else
    log "MariaDB 服务已在运行"
  fi

  # Termux MariaDB 默认 root 无密码，直接使用空密码
  DB_PASS=""
  log "使用 root 空密码连接（Termux MariaDB 默认配置）"

elif [ "$OS_TYPE" = "macos" ]; then
  # macOS Homebrew MariaDB
  if has_cmd brew; then
    if ! pgrep -x "mysqld\|mariadbd" >/dev/null 2>&1; then
      info "启动 MariaDB 服务..."
      brew services start mariadb 2>&1 | tail -2
      sleep 3
    fi
    log "MariaDB 服务已启动"
    DB_PASS=""
  fi
else
  # Linux 服务器环境
  if ! pgrep -x "mysqld\|mariadbd" >/dev/null 2>&1; then
    info "尝试启动数据库服务..."
    if [ "$HAS_SUDO" = true ]; then
      sudo systemctl start mariadb 2>/dev/null || sudo systemctl start mysql 2>/dev/null || sudo service mysql start 2>/dev/null || true
      sleep 3
    fi
  fi
  if pgrep -x "mysqld\|mariadbd" >/dev/null 2>&1; then
    log "数据库服务已运行"
  else
    warn "数据库服务未运行，可能需要手动启动"
  fi
  # Linux 下尝试常见密码（空密码、root、password）
  DB_PASS=""
fi

# ============================================================================
# 步骤 3：测试数据库连接并自动初始化（全自动）
# ============================================================================
step "步骤 3/7 · 测试数据库连接并初始化"

# 尝试用空密码连接，失败则尝试常见密码
DB_CONNECT_OK=false
for try_pass in "" "root" "password" "123456" "mysql"; do
  if mysql -u"$DB_USER" -p"$try_pass" -h"$DB_HOST" -P"$DB_PORT" -e "SELECT 1" >/dev/null 2>&1; then
    DB_PASS="$try_pass"
    DB_CONNECT_OK=true
    log "数据库连接成功（用户: $DB_USER, 密码: ${try_pass:-空}）"
    break
  fi
done

if [ "$DB_CONNECT_OK" = false ]; then
  warn "无法用常见密码连接数据库，尝试无密码 socket 连接..."
  if mysql -u"$DB_USER" -e "SELECT 1" >/dev/null 2>&1; then
    DB_PASS=""
    DB_CONNECT_OK=true
    log "通过 socket 连接成功"
  fi
fi

if [ "$DB_CONNECT_OK" = false ]; then
  err "无法连接数据库。请检查数据库服务是否运行，或手动配置 server/.env"
  err "可手动执行: mysql -u root -e 'SELECT 1' 排查"
  exit 1
fi

# 初始化数据库（如果 doc_share 不存在或表不完整）
info "检查并初始化数据库 schema..."
if mysql -u"$DB_USER" -p"$DB_PASS" -h"$DB_HOST" -P"$DB_PORT" < "$SCRIPT_DIR/database/schema.sql" 2>&1 | grep -v "Using a password" | tail -5; then
  log "数据库 schema 初始化完成（数据库: $DB_NAME，默认管理员: admin / admin123）"
else
  warn "schema.sql 执行有警告，通常是因为库表已存在，可忽略"
fi

# ============================================================================
# 步骤 4：后端依赖安装与配置
# ============================================================================
step "步骤 4/7 · 后端依赖与配置"

cd "$SCRIPT_DIR/server"

# 生成或更新 .env
info "配置后端 .env ..."
if [ ! -f ".env" ]; then
  cp .env.example .env
fi

# 生成随机密钥
JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
SHARE_SECRET="$(openssl rand -hex 64 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"

# 用 awk 写入所有配置（数据库连接信息 + 随机密钥）
awk -v jwt="$JWT_SECRET" -v share="$SHARE_SECRET" \
    -v dbuser="$DB_USER" -v dbpass="$DB_PASS" \
    -v dbhost="$DB_HOST" -v dbport="$DB_PORT" -v dbname="$DB_NAME" '
  /^PORT=/          { print "PORT=3000"; next }
  /^DB_HOST=/       { print "DB_HOST=" dbhost; next }
  /^DB_PORT=/       { print "DB_PORT=" dbport; next }
  /^DB_USER=/       { print "DB_USER=" dbuser; next }
  /^DB_PASSWORD=/   { print "DB_PASSWORD=" dbpass; next }
  /^DB_NAME=/       { print "DB_NAME=" dbname; next }
  /^JWT_SECRET=/    { print "JWT_SECRET=" jwt; next }
  /^SHARE_SECRET=/  { print "SHARE_SECRET=" share; next }
  { print }
' .env > .env.tmp && mv .env.tmp .env
log ".env 已配置（数据库: $DB_USER@${DB_HOST}:${DB_PORT}/${DB_NAME}）"

# 安装依赖
if [ ! -d "node_modules" ]; then
  info "安装后端依赖（首次可能较慢）..."
  npm install --no-audit --no-fund 2>&1 | tail -3
  log "后端依赖安装完成"
else
  log "后端依赖已存在，跳过安装"
fi

# ============================================================================
# 步骤 5：前端依赖安装
# ============================================================================
step "步骤 5/7 · 前端依赖与配置"

cd "$SCRIPT_DIR/web"

if [ ! -d "node_modules" ]; then
  info "安装前端依赖（首次可能较慢）..."
  npm install --no-audit --no-fund 2>&1 | tail -3
  log "前端依赖安装完成"
else
  log "前端依赖已存在，跳过安装"
fi

# ============================================================================
# 步骤 6：启动服务
# ============================================================================
step "步骤 6/7 · 启动服务"

: > "$PID_FILE"

info "启动后端服务（端口 3000）..."
cd "$SCRIPT_DIR/server"
npm run dev > "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID server" >> "$PID_FILE"
log "后端已启动 (PID: $SERVER_PID)"

info "启动前端服务（端口 5173）..."
cd "$SCRIPT_DIR/web"
npm run dev > "$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!
echo "$WEB_PID web" >> "$PID_FILE"
log "前端已启动 (PID: $WEB_PID)"

# ============================================================================
# 步骤 7：健康检查与打开浏览器
# ============================================================================
step "步骤 7/7 · 健康检查与打开浏览器"

info "等待后端服务就绪..."
BACKEND_READY=false
for i in $(seq 1 40); do
  if curl -s http://localhost:3000/api/health >/dev/null 2>&1; then
    BACKEND_READY=true
    break
  fi
  sleep 1
  printf "."
done
printf "\n"

if [ "$BACKEND_READY" = true ]; then
  log "后端服务就绪 (http://localhost:3000/api/health)"
else
  warn "后端服务未在 40 秒内就绪，自动打印日志最后 40 行以便排查："
  printf "${YELLOW}━━━━━━ server.log ━━━━━━${NC}\n"
  tail -40 "$LOG_DIR/server.log" 2>/dev/null || echo "(无日志)"
  printf "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
fi

info "等待前端服务就绪..."
FRONTEND_READY=false
for i in $(seq 1 30); do
  if curl -s http://localhost:5173 >/dev/null 2>&1; then
    FRONTEND_READY=true
    break
  fi
  sleep 1
  printf "."
done
printf "\n"

if [ "$FRONTEND_READY" = true ]; then
  log "前端服务就绪 (http://localhost:5173)"
else
  warn "前端服务未在 30 秒内就绪，请查看 .run/logs/web.log"
fi

# 打开浏览器
info "打开浏览器..."
ENTRY_URL="file://$SCRIPT_DIR/index.html"
if [ "$IS_TERMUX" = true ]; then
  if has_cmd termux-open; then
    termux-open "$SCRIPT_DIR/index.html" 2>/dev/null || true
  else
    warn "请安装 termux-tools 后打开: pkg install termux-tools"
    warn "或手动打开: $ENTRY_URL"
  fi
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$ENTRY_URL" 2>/dev/null || true
elif command -v open >/dev/null 2>&1; then
  open "$ENTRY_URL" 2>/dev/null || true
else
  warn "请手动打开: $ENTRY_URL"
fi

# ============================================================================
# 完成提示
# ============================================================================
printf "\n"
printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "${GREEN}✓ 系统已启动！${NC}\n"
printf "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "\n"
printf "  ${CYAN}网页前端${NC}:  http://localhost:5173/\n"
printf "  ${CYAN}管理后台${NC}:  http://localhost:5173/admin/login\n"
printf "  ${CYAN}后端 API${NC}:  http://localhost:3000/api/health\n"
printf "  ${CYAN}默认账号${NC}:  admin / admin123\n"
printf "\n"
printf "  ${YELLOW}日志位置${NC}:  .run/logs/server.log  和  .run/logs/web.log\n"
printf "  ${YELLOW}停止服务${NC}:  运行 bash stop.sh  或按 Ctrl+C\n"
printf "\n"

info "按 Ctrl+C 停止所有服务，或直接关闭终端（服务继续后台运行）"
while true; do
  sleep 5
  if ! kill -0 "$SERVER_PID" 2>/dev/null && ! kill -0 "$WEB_PID" 2>/dev/null; then
    warn "检测到服务已停止，请查看日志排查原因"
    exit 1
  fi
done
