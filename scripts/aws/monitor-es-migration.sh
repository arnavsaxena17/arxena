#!/usr/bin/env bash
# Monitor analytics ES snapshot, then restore on arxmukti ES and verify counts.
set -euo pipefail

ANALYTICS_KEY="${ANALYTICS_KEY:-$HOME/.ssh/arx-analytics-key.pem}"
MUKTI_KEY="${MUKTI_KEY:-$HOME/.ssh/arxmukti-key.pem}"
ANALYTICS_HOST="${ANALYTICS_HOST:-54.159.41.63}"
MUKTI_HOST="${MUKTI_HOST:-44.210.207.156}"
REPO="arx_migration_20260724"
SNAP="full_all"
AUTH_USER="elastic"
AUTH_PASS="${ES_PASS:-Page321123a}"

analytics_curl() {
  local path="$1"
  ssh -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new -i "$ANALYTICS_KEY" "ubuntu@${ANALYTICS_HOST}" \
    "curl -sS -m 120 -u ${AUTH_USER}:${AUTH_PASS} \"http://10.0.0.51:9200${path}\""
}

mukti_ssh() {
  ssh -o ConnectTimeout=20 -o StrictHostKeyChecking=accept-new -i "$MUKTI_KEY" "ubuntu@${MUKTI_HOST}" "$@"
}

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Watching snapshot ${REPO}/${SNAP}..."

while true; do
  analytics_curl "/_snapshot/${REPO}/${SNAP}/_status" > /tmp/es_mig_status.json || true
  analytics_curl "/_snapshot/${REPO}/${SNAP}" > /tmp/es_mig_snap.json || true

  python3 <<'PY'
import json
state = "UNKNOWN"
try:
    s = json.load(open("/tmp/es_mig_status.json"))["snapshots"][0]
    state = s.get("state", state)
    st = s.get("stats", {})
    inc = st.get("incremental", {})
    proc = st.get("processed", {})
    total = inc.get("size_in_bytes") or 0
    done = proc.get("size_in_bytes") or 0
    pct = (100.0 * done / total) if total else 0.0
    print(f"[progress] status_state={state} shards={s.get('shards_stats')} {done/1e9:.2f}/{total/1e9:.2f} GB ({pct:.1f}%)")
except Exception as e:
    print(f"[progress] status_parse_error={e}")
try:
    s2 = json.load(open("/tmp/es_mig_snap.json"))["snapshots"][0]
    print(f"[progress] snap_state={s2.get('state')} shards={s2.get('shards')} failures={s2.get('failures')}")
    open("/tmp/es_mig_snap_state","w").write(s2.get("state",""))
except Exception as e:
    print(f"[progress] snap_parse_error={e}")
    open("/tmp/es_mig_snap_state","w").write("UNKNOWN")
PY

  snap_state="$(cat /tmp/es_mig_snap_state 2>/dev/null || echo UNKNOWN)"
  if [[ "$snap_state" == "SUCCESS" ]]; then
    echo "Snapshot SUCCESS"
    break
  fi
  if [[ "$snap_state" == "FAILED" || "$snap_state" == "PARTIAL" ]]; then
    echo "Snapshot ended in state=$snap_state"
    cat /tmp/es_mig_snap.json
    exit 1
  fi
  sleep 120
done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting restore on mukti..."

mukti_ssh bash -s <<REMOTE
set -euo pipefail
AUTH="${AUTH_USER}:${AUTH_PASS}"
REPO="${REPO}"
SNAP="${SNAP}"

curl -sS -m 60 -u "\$AUTH" -X PUT "http://127.0.0.1:9200/_snapshot/\$REPO" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "s3",
    "settings": {
      "bucket": "es-snapshots-new",
      "region": "us-east-1",
      "base_path": "migration/20260724",
      "readonly": true
    }
  }' || true
echo

curl -sS -m 60 -u "\$AUTH" -X POST "http://127.0.0.1:9200/_snapshot/\$REPO/\$SNAP/_restore?wait_for_completion=false" \
  -H "Content-Type: application/json" \
  -d '{
    "indices": "org-charts-all,people_all,std_company_data_scores,companies_index_text",
    "ignore_unavailable": false,
    "include_global_state": false,
    "include_aliases": false,
    "index_settings": {
      "index.number_of_replicas": 0
    }
  }'
echo
REMOTE

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Waiting for restore / index counts..."

while true; do
  mukti_ssh "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cat/indices?v&s=index'" > /tmp/es_mig_indices.txt
  mukti_ssh "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cat/recovery?active_only=true&v'" > /tmp/es_mig_recovery.txt || true
  echo "----- $(date -u +%H:%M:%S) recovery -----"
  head -20 /tmp/es_mig_recovery.txt
  echo "----- indices -----"
  cat /tmp/es_mig_indices.txt

  python3 <<'PY' > /tmp/es_mig_ready
text = open("/tmp/es_mig_indices.txt").read()
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
        if len(parts) >= 7 and parts[2] == name:
            row = parts
            break
    if not row:
        print(f"missing {name}")
        ok = False
        continue
    health, status = row[0], row[1]
    count = int(row[6])
    print(f"{name}: health={health} status={status} docs={count} expected={docs}")
    if status != "open" or health not in ("green", "yellow"):
        ok = False
    if count < int(docs * 0.99):
        ok = False
print("READY" if ok else "NOT_READY")
PY
  cat /tmp/es_mig_ready
  if grep -q '^READY$' /tmp/es_mig_ready; then
    break
  fi
  sleep 120
done

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Restore verified."
mukti_ssh "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cat/indices?v&s=store.size:desc'"
echo
mukti_ssh "curl -sS -m 60 -u ${AUTH_USER}:${AUTH_PASS} 'http://127.0.0.1:9200/_cluster/health?pretty'"
echo "DONE" | tee /tmp/es_mig_done
