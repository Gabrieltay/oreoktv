#!/usr/bin/env bash
#
# sysmon.sh — show CPU, RAM, disk, and network bandwidth utilisation.
# Works on both macOS and Raspberry Pi (Linux).
#
# Usage:
#   ./sysmon.sh            # refresh every 2s until Ctrl-C
#   ./sysmon.sh -n         # print once and exit
#   ./sysmon.sh -i 5       # refresh every 5s
#

set -u

INTERVAL=2
ONCE=0

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--once)     ONCE=1 ;;
    -i|--interval) shift; INTERVAL="${1:-2}" ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '2,12p'
      exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

OS="$(uname -s)"

# ---- helpers ---------------------------------------------------------------

# Pretty-print a 0-100 percentage as a 20-char bar plus the number.
bar() {
  local pct=${1%.*}              # integer part
  [ -z "$pct" ] && pct=0
  local filled=$(( pct / 5 ))
  [ "$filled" -gt 20 ] && filled=20
  [ "$filled" -lt 0 ] && filled=0
  local empty=$(( 20 - filled ))
  printf '['
  [ "$filled" -gt 0 ] && printf '%0.s#' $(seq 1 "$filled")
  [ "$empty"  -gt 0 ] && printf '%0.s-' $(seq 1 "$empty")
  printf '] %5.1f%%' "$1"
}

human() {
  # bytes -> human readable
  awk -v b="$1" 'BEGIN{
    split("B KB MB GB TB PB",u," ");
    i=1; while(b>=1024 && i<6){b/=1024;i++}
    printf("%.1f%s", b, u[i])
  }'
}

# ---- per-OS collectors -----------------------------------------------------

# CPU usage % (0-100). Uses two samples on Linux for an instantaneous reading.
cpu_usage_linux() {
  read -r _ a b c idle1 rest < /proc/stat
  local total1=$((a+b+c+idle1)); for v in $rest; do total1=$((total1+v)); done
  sleep 0.3
  read -r _ a b c idle2 rest < /proc/stat
  local total2=$((a+b+c+idle2)); for v in $rest; do total2=$((total2+v)); done
  local dt=$((total2-total1)) di=$((idle2-idle1))
  [ "$dt" -le 0 ] && { echo 0; return; }
  awk -v dt="$dt" -v di="$di" 'BEGIN{printf "%.1f", (1-di/dt)*100}'
}

cpu_usage_mac() {
  # top's CPU line: "CPU usage: 5.0% user, 10.0% sys, 85.0% idle"
  top -l 1 -n 0 | awk -F'[:,]' '/CPU usage/{
    for(i=1;i<=NF;i++){ if($i ~ /idle/){ gsub(/[^0-9.]/,"",$i); print 100-$i } }
  }'
}

# Memory: prints "used_bytes total_bytes"
mem_linux() {
  awk '/MemTotal/{t=$2} /MemAvailable/{a=$2} END{printf "%d %d", (t-a)*1024, t*1024}' /proc/meminfo
}

mem_mac() {
  local total page
  total=$(sysctl -n hw.memsize)
  page=$(sysctl -n hw.pagesize)
  # active + wired + compressed = "used"
  vm_stat | awk -v page="$page" -v total="$total" '
    /Pages active/{a=$3} /Pages wired/{w=$4} /Pages occupied by compressor/{c=$5}
    END{ gsub(/\./,"",a); gsub(/\./,"",w); gsub(/\./,"",c);
         printf "%d %d", (a+w+c)*page, total }'
}

# Disk for the root filesystem: "used_bytes total_bytes"
disk_usage() {
  df -k / | awk 'NR==2{printf "%d %d", $3*1024, ($3+$4)*1024}'
}

# Default network interface name
net_iface() {
  if [ "$OS" = "Darwin" ]; then
    route -n get default 2>/dev/null | awk '/interface:/{print $2; exit}'
  else
    ip route 2>/dev/null | awk '/^default/{print $5; exit}'
  fi
}

# Cumulative rx/tx bytes for an interface: "rx tx"
net_bytes() {
  local iface="$1"
  if [ "$OS" = "Darwin" ]; then
    netstat -ibn | awk -v i="$iface" '$1==i && $7 ~ /^[0-9]+$/ {print $7, $10; exit}'
  else
    local base="/sys/class/net/$iface/statistics"
    if [ -r "$base/rx_bytes" ]; then
      echo "$(cat "$base/rx_bytes") $(cat "$base/tx_bytes")"
    else
      echo "0 0"
    fi
  fi
}

# ---- render ----------------------------------------------------------------

IFACE="$(net_iface)"
[ -z "$IFACE" ] && IFACE="(none)"

prev_rx=0; prev_tx=0; have_prev=0; prev_t=0

render() {
  local now cpu used total dpct rx tx drx dtx dt
  now=$(date '+%Y-%m-%d %H:%M:%S')

  if [ "$OS" = "Darwin" ]; then
    cpu=$(cpu_usage_mac)
    read -r used total < <(mem_mac)
  else
    cpu=$(cpu_usage_linux)
    read -r used total < <(mem_linux)
  fi
  [ -z "$cpu" ] && cpu=0

  local mpct=0
  [ "$total" -gt 0 ] && mpct=$(awk -v u="$used" -v t="$total" 'BEGIN{printf "%.1f", u/t*100}')

  read -r dused dtotal < <(disk_usage)
  dpct=0
  [ "$dtotal" -gt 0 ] && dpct=$(awk -v u="$dused" -v t="$dtotal" 'BEGIN{printf "%.1f", u/t*100}')

  # network rate
  read -r rx tx < <(net_bytes "$IFACE")
  rx=${rx:-0}; tx=${tx:-0}
  local secs=$INTERVAL
  [ "$ONCE" -eq 1 ] && secs=1
  local down="--" up="--"
  if [ "$have_prev" -eq 1 ]; then
    drx=$(( rx - prev_rx )); dtx=$(( tx - prev_tx ))
    [ "$drx" -lt 0 ] && drx=0; [ "$dtx" -lt 0 ] && dtx=0
    down="$(human $(( drx / secs )))/s"
    up="$(human $(( dtx / secs )))/s"
  fi
  prev_rx=$rx; prev_tx=$tx; have_prev=1

  [ "$ONCE" -eq 0 ] && printf '\033[H\033[2J'   # clear screen
  printf '%s   (%s)\n' "$now" "$OS"
  printf '────────────────────────────────────────────────\n'
  printf 'CPU   %s\n' "$(bar "$cpu")"
  printf 'RAM   %s   %s / %s\n' "$(bar "$mpct")" "$(human "$used")" "$(human "$total")"
  printf 'DISK  %s   %s / %s\n' "$(bar "$dpct")" "$(human "$dused")" "$(human "$dtotal")"
  printf 'NET   %-8s   ↓ %-12s ↑ %-12s\n' "$IFACE" "$down" "$up"
}

if [ "$ONCE" -eq 1 ]; then
  # take a first net sample so we can show a rate
  read -r prev_rx prev_tx < <(net_bytes "$IFACE"); have_prev=1
  sleep 1
  render
else
  trap 'echo; exit 0' INT
  while true; do
    render
    sleep "$INTERVAL"
  done
fi
