#!/usr/bin/env bash
# Monitor mukti ES restore until expected indices are green with matching docs.
set -uo pipefail

MUKTI_KEY="${MUKTI_KEY:-$HOME/.ssh/arxmukti-key.pem}"
MUKTI_HOST="${MUKTI_HOST:-44.210.207.156}"
AUTH_USER="elastic"
AUTH_PASS="${ES_PASS:-Page321123a}"
LOG="${LOG:-/tmp/es-restore-monitor.log}"

mukti() {
  ssh -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new -i "$MUKTI_KEY" "ubuntu@${MUKTI_HOST}" "$@"
}

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Watching restore on ${MUKTI_HOST}..." | tee -a "$LOG"

while true; do
  mukti "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cat/indices?v&s=index'" > /tmp/es_restore_indices.txt 2>/dev/null || true
  mukti "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cat/recovery?active_only=true&h=index,stage,bytes_percent,files_percent,time'" > /tmp/es_restore_recovery.txt 2>/dev/null || true
  DISK=$(mukti 'df -h / | tail -1' 2>/dev/null || true)

  {
    echo "----- $(date -u +%Y-%m-%dT%H:%M:%SZ) -----"
    echo "disk: $DISK"
    echo "recovery:"
    cat /tmp/es_restore_recovery.txt 2>/dev/null || true
    echo "indices:"
    cat /tmp/es_restore_indices.txt 2>/dev/null || true
  } | tee -a "$LOG"

  python3 <<'PY' > /tmp/es_restore_ready
text = open("/tmp/es_restore_indices.txt").read() if True else ""
expected = {
  "org-charts-all": 23498559,
  "people_all": 157434826,
  "std_company_data_scores": 12039281,
  "companies_index_text": 10662541,
}
ok = True
for name, docs in expected.items():
    row = None
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 3 and parts[2] == name:
            row = parts
            break
    if not row:
        print(f"missing {name}")
        ok = False
        continue
    health, status = row[0], row[1]
    if len(row) < 7:
        print(f"{name}: health={health} status={status} docs=pending expected={docs}")
        ok = False
        continue
    try:
        count = int(row[6])
    except ValueError:
        print(f"{name}: health={health} status={status} docs=pending expected={docs}")
        ok = False
        continue
    print(f"{name}: health={health} status={status} docs={count} expected={docs}")
    if status != "open" or health not in ("green", "yellow"):
        ok = False
    if count < int(docs * 0.99):
        ok = False
print("READY" if ok else "NOT_READY")
PY
  cat /tmp/es_restore_ready | tee -a "$LOG"
  if grep -q '^READY$' /tmp/es_restore_ready; then
    break
  fi
  sleep 120
done

{
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restore verified."
  mukti "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cat/indices?v&s=store.size:desc'"
  echo
  mukti "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cluster/health?pretty'"
  echo DONE
} | tee -a "$LOG" | tee /tmp/es_restore_done
