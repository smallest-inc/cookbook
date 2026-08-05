#!/usr/bin/env bash
# Deploy the crew, make it live, place a test call, and monitor it.
# One place to build + run + test the transfer flow.
#
# Usage:
#   cp .env.example .env    # fill it in
#   ./run.sh deploy         # build + make live
#   ./run.sh call +917066487364   # place a call to this number, then answer + ask for a transfer
#   ./run.sh watch CALL-...       # (re)watch a call's transcript + transfer leg
#
# Env (from .env, plus):
#   AGENT_ID           the agent-crew id to deploy/call (required for call/deploy-live)
#   FROM_PRODUCT_ID    telephony product id to place the outbound call from
#   PY                 python with the smallestai SDK (default: python3)
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] && set -a && . ./.env && set +a || { echo "make a .env (see .env.example)"; exit 1; }
: "${SMALLEST_API_KEY:?set SMALLEST_API_KEY in .env}"
PY="${PY:-python3}"
BASE="https://api.smallest.ai/atoms/v1"
AGENT_ID="${AGENT_ID:-}"
FROM_PRODUCT_ID="${FROM_PRODUCT_ID:-6969109c84c74bed175f02a7}"
AUTH="Authorization: Bearer ${SMALLEST_API_KEY}"

cmd="${1:-}"; shift || true

deploy() {
  echo "Deploying crew (entry-point server.py)..."
  out=$("$PY" -m smallestai.cli.main agent-crew deploy --entry-point server.py 2>&1); echo "$out" | tail -8
  bid=$(echo "$out" | grep -oiE "Build ID: [a-f0-9]+" | awk '{print $3}')
  [ -z "$bid" ] && { echo "no build id parsed"; exit 1; }
  : "${AGENT_ID:?set AGENT_ID in .env to make the build live}"
  echo "Making build $bid live on agent $AGENT_ID..."
  "$PY" - "$AGENT_ID" "$bid" <<'PYEOF'
import os,sys,httpx
aid,bid=sys.argv[1],sys.argv[2]
r=httpx.patch(f"https://api.smallest.ai/atoms/v1/sdk/agents/{aid}/builds/{bid}",
  headers={"Authorization":"Bearer "+os.environ["SMALLEST_API_KEY"],"Content-Type":"application/json"},
  json={"isLive":True},timeout=20)
print("live:",r.json().get("data",{}).get("message"))
PYEOF
}

place_call() {
  local to="$1"; : "${AGENT_ID:?set AGENT_ID in .env}"
  cid=$("$PY" - "$AGENT_ID" "$to" "$FROM_PRODUCT_ID" <<'PYEOF'
import os,sys,warnings; warnings.filterwarnings("ignore")
from smallestai import SmallestAI
aid,to,fp=sys.argv[1],sys.argv[2],sys.argv[3]
r=SmallestAI(api_key=os.environ["SMALLEST_API_KEY"]).atoms.calls.start_outbound_call(agent_id=aid,phone_number=to,from_product_id=fp).data
print(getattr(r,"conversation_id",r))
PYEOF
)
  echo "CALL: $cid   (answer $to, chat, then ask to transfer to a specialist)"
  watch_call "$cid"
}

watch_call() {
  local cid="$1"
  for i in $(seq 1 30); do
    st=$("$PY" - "$cid" <<'PYEOF'
import os,sys,warnings; warnings.filterwarnings("ignore")
from smallestai import SmallestAI
r=SmallestAI(api_key=os.environ["SMALLEST_API_KEY"]).atoms.calls.get(id=sys.argv[1]).data.dict()
ts=r.get("transcript") or []
print(r.get("status"),"| turns",len(ts),"| agent_replies",sum(1 for t in ts if t.get("role")=="agent"))
PYEOF
)
    echo "[$i] $st"; echo "$st" | grep -qiE "completed|ended|failed|no_answer" && break; sleep 12
  done
  echo "--- transcript ---"
  "$PY" - "$cid" <<'PYEOF'
import os,sys,warnings; warnings.filterwarnings("ignore")
from smallestai import SmallestAI
r=SmallestAI(api_key=os.environ["SMALLEST_API_KEY"]).atoms.calls.get(id=sys.argv[1]).data.dict()
for t in (r.get("transcript") or []): print(f"  {t.get('role'):5}: {t.get('content')}")
print("  recording:", r.get("recording_url"))
PYEOF
}

case "$cmd" in
  deploy) deploy ;;
  call)   place_call "${1:?usage: ./run.sh call +1...}" ;;
  watch)  watch_call "${1:?usage: ./run.sh watch CALL-...}" ;;
  *) echo "usage: ./run.sh {deploy | call +1NUMBER | watch CALL-ID}"; exit 1 ;;
esac
