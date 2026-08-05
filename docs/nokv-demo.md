# NoKV × EchoJournal — Voice Session Workspace demo

Every voice-agent session becomes a **NoKV workbench**: immutable session
metadata, an ordered tool-call trace (`workbench_append` with generation CAS),
and a deterministic commit whose replay is idempotent. This is the concrete
showcase of NoKV's "durable agent workspaces" for a consumer AI app.

Design rationale and the full architecture live in
[`docs/nokv-integration-design.md`](nokv-integration-design.md).

## What gets written

```
vs-{clerkUserId}-{uuid}/
  metadata/session.json      # schema echojournal.voice_session.v1 (create-only)
  logs/tool_calls.jsonl      # ordered trace, one line per agent tool call
  outputs/final_message.md   # client-reported last reply (create-only)
  (commit)                   # deterministic manifest -> idempotent_replay on retry
```

- Session refs are HMAC-signed per user (`NOKV_SESSION_SECRET`); a ref cannot
  be replayed across users. The server re-derives the signature from the Clerk
  session on every request.
- All NoKV calls run inside `after()` — the voice hot path never waits on NoKV.
- Fully fail-closed: with `NOKV_ENABLED` unset the app behaves byte-for-byte
  like before; if the NoKV server dies mid-session the only symptom is one
  `console.error` and a 30s client backoff.

## Local runbook

```bash
# 1) Build the binary from main (stale target/ builds will not match the contract)
cd /Users/wangchanghao/NoKV && cargo build --release -p nokv --bin nokv

# 2) RustFS object store (docker) + bucket
bash scripts/lingtai-workbench/start_rustfs.sh
AWS_ACCESS_KEY_ID=rustfsadmin AWS_SECRET_ACCESS_KEY=rustfsadmin \
  aws --endpoint-url http://127.0.0.1:9000 s3 mb s3://echojournal-nokv

# 3) etcd (routing control plane)
docker run -d --name nokv-etcd -p 2379:2379 quay.io/coreos/etcd:v3.5.17 \
  etcd --advertise-client-urls http://0.0.0.0:2379 --listen-client-urls http://0.0.0.0:2379

# 4) Provision ids
ROOT=$(openssl rand -hex 16); SHARD=$(openssl rand -hex 16)
./target/release/nokv --root-id $ROOT --etcd-endpoint http://127.0.0.1:2379 \
  --etcd-key-prefix /nokv/control provision $SHARD

# 5) Serve (process must stay up: --metadata-reopen is fail-closed on current main)
./target/release/nokv --root-id $ROOT --etcd-endpoint http://127.0.0.1:2379 \
  --etcd-key-prefix /nokv/control \
  --object-bucket echojournal-nokv --object-endpoint http://127.0.0.1:9000 \
  --object-root echojournal --object-region us-east-1 \
  --object-access-key-id rustfsadmin --object-secret-access-key rustfsadmin \
  --bind 127.0.0.1:7750 --advertise-endpoint 127.0.0.1:7750 \
  --node-id echo-demo --metadata-create /tmp/nokv-echo-meta-$(date +%s) serve

# 6) EchoJournal: fill the NOKV_* block in .env.local (NOKV_ROOT_ID=$ROOT,
#    NOKV_BIN=/Users/wangchanghao/NoKV/target/release/nokv, NOKV_ENABLED=true,
#    NOKV_SESSION_SECRET=$(openssl rand -hex 32)), then:
cd /Users/wangchanghao/journal-app-mvp && pnpm dev
```

Inspect from the NoKV side (proves the data is real, not app-rendered):

```bash
alias nokvw='/Users/wangchanghao/NoKV/target/release/nokv --root-id $ROOT \
  --etcd-endpoint http://127.0.0.1:2379 --etcd-key-prefix /nokv/control \
  --object-bucket echojournal-nokv --object-endpoint http://127.0.0.1:9000 \
  --object-root echojournal --object-region us-east-1 \
  --object-access-key-id rustfsadmin --object-secret-access-key rustfsadmin \
  --workbench-root /agents/echojournal/wb workbench'

nokvw workbench_catalog '{}'
nokvw workbench_read '{"id":"<wb>","section":"logs","path":"tool_calls.jsonl","format":"text"}'
nokvw workbench_read '{"id":"<wb>","section":"metadata","path":"run_manifest.json","format":"json"}'
```

Replay highlight: re-POST `/api/agent/session/end` with the same body — the
server reports `idempotent_replay=true` (deterministic commit identity).

## Honest boundaries

1. NoKV main has **no caller auth** (bare TCP + S3 credentials); it must stay a
   server-private dependency bound to 127.0.0.1. Per-user isolation is enforced
   in EchoJournal via HMAC session refs + Clerk sessions. Never expose the NoKV
   port or credentials to the browser.
2. `--metadata-reopen` is fail-closed on current main: if `serve` exits, the
   metadata dir is spent; re-provision with a fresh dir. Pitch this as
   "crash-consistent within a run", not cross-restart persistence.
3. Client routing must go through etcd (as configured above). Static routing
   flags break after any server restart (`owner_epoch` increments).
4. `lastMessage` is client-reported (marked as such in the manifest) and capped
   at 8KB. If the keepalive beacon is lost, the workbench keeps its
   create/append trace and simply has no commit — as designed.
5. Object-store credentials appear in the MCP subprocess argv (visible in
   `ps`). Acceptable for a local demo only.
6. `next dev` may hold one MCP subprocess per worker; the contract layer is
   concurrency-safe (create-only writes + CAS appends), and AlreadyExists is
   always treated as success.
