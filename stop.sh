#!/usr/bin/env bash
# ============================================================================
# 停止脚本 - 停止由 start.sh 启动的所有服务
# ============================================================================
# 强制使用 bash 运行
if [ -z "$BASH_VERSION" ]; then
  if command -v bash >/dev/null 2>&1; then
    exec bash "$0" "$@"
  else
    echo "错误：此脚本需要 bash" >&2
    exit 1
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.run/pids"

if [ -t 1 ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

log()  { printf "${GREEN}[✓]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[!]${NC} %s\n" "$1"; }

printf "\n"
printf "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "${YELLOW}▶ 停止所有服务${NC}\n"
printf "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
printf "\n"

STOPPED=0

# 方式1：通过 PID 文件停止
if [ -f "$PID_FILE" ]; then
  while read -r pid name; do
    [ -n "$pid" ] || continue
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      log "已停止 $name (PID: $pid)"
      STOPPED=$((STOPPED + 1))
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

# 方式2：兜底 - 按端口查找并停止
for port in 3000 5173; do
  if command -v lsof >/dev/null 2>&1; then
    PID="$(lsof -ti :$port 2>/dev/null || true)"
    if [ -n "$PID" ]; then
      kill $PID 2>/dev/null || true
      log "已停止占用端口 $port 的进程 (PID: $PID)"
      STOPPED=$((STOPPED + 1))
    fi
  elif command -v fuser >/dev/null 2>&1; then
    PID="$(fuser ${port}/tcp 2>/dev/null | awk '{print $1}' || true)"
    if [ -n "$PID" ]; then
      kill "$PID" 2>/dev/null || true
      log "已停止占用端口 $port 的进程 (PID: $PID)"
      STOPPED=$((STOPPED + 1))
    fi
  fi
done

if [ "$STOPPED" -eq 0 ]; then
  warn "没有发现正在运行的服务"
else
  log "共停止 $STOPPED 个服务"
fi
printf "\n"
