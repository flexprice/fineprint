"""Slack notifications for the FinePrint watch loop — pure stdlib, no SDK.

Posts to a Slack Incoming Webhook (``SLACK_WEBHOOK_URL``) using Block Kit. A webhook payload is
just ``{"text": <fallback>, "blocks": [...]}`` POSTed as JSON; the top-level ``text`` is the
notification fallback and ``blocks`` render the rich card. See
https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/

Two message shapes:
  * ``build_launch_blocks`` — a new model was evaluated and published (the happy path).
  * ``build_warning_blocks`` — a new model was detected but the eval failed / timed out (soft alert).

Nothing here imports the harness, so it is trivially unit-testable and dependency-free.
"""
import json
import urllib.request
import urllib.error

SLACK_TIMEOUT = 15


def post_slack(webhook_url: str, text: str, blocks: list | None = None) -> bool:
    """POST a Block Kit message to a Slack incoming webhook. Returns True on HTTP 200 ('ok').

    Never raises — a Slack outage must not wedge the watch loop. Logs and returns False instead.
    """
    if not webhook_url:
        print("notify: SLACK_WEBHOOK_URL unset — skipping Slack post")
        return False
    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        webhook_url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=SLACK_TIMEOUT) as resp:
            ok = resp.status == 200
            if not ok:
                print(f"notify: Slack returned HTTP {resp.status}")
            return ok
    except urllib.error.HTTPError as e:
        print(f"notify: Slack HTTPError {e.code}: {e.read()[:200]!r}")
    except Exception as e:  # noqa: BLE001 — notification is best-effort
        print(f"notify: Slack post failed: {type(e).__name__}: {e}")
    return False


def _model_url(site_url: str, model_id: str) -> str:
    return f"{site_url.rstrip('/')}/models/{model_id}"


def build_launch_blocks(row: dict, site_url: str, n_models: int,
                        baseline_label: str | None = None,
                        baseline_acc: float | None = None) -> tuple[str, list]:
    """Rich 'new model benchmarked' card. ``row`` is a published row from web/lib/data.json.

    Returns (fallback_text, blocks).
    """
    label = row.get("label", row.get("id", "?"))
    family = row.get("family", "")
    rank = row.get("rank")
    accuracy = row.get("accuracy")
    cost_1k = row.get("cost_1k")
    value = row.get("value")
    p50 = row.get("p50")
    p90 = row.get("p90")
    halluc = row.get("halluc")
    url = _model_url(site_url, row.get("id", ""))

    rank_str = f"#{rank} of {n_models}" if rank else "—"
    delta = ""
    if baseline_acc is not None and accuracy is not None and baseline_label:
        d = round(accuracy - baseline_acc, 1)
        sign = "+" if d >= 0 else ""
        delta = f"  ({sign}{d} pts vs {baseline_label})"

    text = f"New model on FinePrint: {label} — rank {rank_str}, {accuracy}% accuracy"

    # Free / stealth models list no price on OpenRouter — show NA, never "$None" / "None".
    cost_str = f"${cost_1k}" if cost_1k is not None else "NA _(free / price unlisted)_"
    value_str = f"{value}  _(acc pts per $/1k)_" if value is not None else "NA _(no listed price)_"

    fields = [
        {"type": "mrkdwn", "text": f"*Rank*\n{rank_str}"},
        {"type": "mrkdwn", "text": f"*Accuracy*\n{accuracy}%{delta}"},
        {"type": "mrkdwn", "text": f"*Cost / 1k docs*\n{cost_str}"},
        {"type": "mrkdwn", "text": f"*Value*\n{value_str}"},
        {"type": "mrkdwn", "text": f"*Latency p50 / p90*\n{p50}s / {p90}s"},
        {"type": "mrkdwn", "text": f"*Hallucination*\n{halluc}%  _(confident & wrong)_"},
    ]

    blocks = [
        {"type": "header",
         "text": {"type": "plain_text", "text": f"\U0001F4C4 New model benchmarked: {label}", "emoji": True}},
        {"type": "section",
         "text": {"type": "mrkdwn", "text": f"*{label}*  ·  {family}\nAuto-evaluated on the FinePrint contract-extraction benchmark."}},
        {"type": "section", "fields": fields},
        {"type": "actions",
         "elements": [{
             "type": "button",
             "text": {"type": "plain_text", "text": "View on leaderboard", "emoji": True},
             "url": url,
             "style": "primary",
         }]},
        {"type": "context",
         "elements": [{"type": "mrkdwn",
                       "text": f"FinePrint · automated watch · {n_models} models tracked"}]},
    ]
    return text, blocks


def build_warning_blocks(model_label: str, openrouter_id: str, error: str) -> tuple[str, list]:
    """Soft alert: a new model was detected but its eval failed or was skipped (e.g. timeout)."""
    text = f"FinePrint watch: skipped {model_label} ({openrouter_id}) — {error}"
    blocks = [
        {"type": "section",
         "text": {"type": "mrkdwn",
                  "text": (f":warning: *Skipped a new model* — `{openrouter_id}`\n"
                           f"*{model_label}* was detected but not benchmarked.\n"
                           f"Reason: `{error}`")}},
        {"type": "context",
         "elements": [{"type": "mrkdwn",
                       "text": "It will be retried on the next poll unless marked seen."}]},
    ]
    return text, blocks
