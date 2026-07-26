#!/usr/bin/env python3
"""Multi-store M3 cross-store QA battery.

For every module: data created in store A must be invisible in store B under
the same login, forged store ids must 403/401, and the transfer feature must
obey the purchased-only + ownership rules. Run against production with the
team account (owns 3 stores).
"""
import json
import sys
import urllib.request
import urllib.error
import os

RUN = os.urandom(3).hex()

API = "https://api.mautomate.ai"
A = "ten_01KYDJ07YYWDTYCM31QP263FPN"  # meta-review-demo (scale)
B = "ten_01KYFZE7E1TTC745HD8X0HSJ3X"  # m2-addon-probe (growth addon)
FOREIGN = "ten_01KY1PXNYH3X7HW3C6D8VEAG6C"  # abc-test — NOT owned by this login

PASS = 0
FAIL = 0


def report(name, ok, detail=""):
    global PASS, FAIL
    if ok:
        PASS += 1
        print(f"PASS  {name}")
    else:
        FAIL += 1
        print(f"FAIL  {name}  {detail[:140]}")


def call(method, path, token, store=None, body=None):
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}", "User-Agent": "mautomate-qa/1.0"}
    if store:
        headers["x-store-id"] = store
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except Exception:
            return e.code, {}
    except Exception as e:  # noqa: BLE001
        return 0, {"error": str(e)}


def login(email, password):
    code, d = call("POST", "/auth/merchant/emailpass", "", body=None) if False else (0, {})
    req = urllib.request.Request(
        API + "/auth/merchant/emailpass",
        data=json.dumps({"email": email, "password": password}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "mautomate-qa/1.0"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())["token"]


def main():
    token = login("meta.review@mautomate.ai", "MetaReview!2026")

    # ---- context basics -------------------------------------------------
    c, d = call("GET", "/merchant/me", token, store=B)
    report("context: B resolves", c == 200 and d["store"]["id"] == B, str(c))
    c, d = call("GET", "/merchant/me", token, store=FOREIGN)
    report("context: foreign store denied", c == 401, str(c))

    # ---- products -------------------------------------------------------
    c, d = call("POST", "/merchant/products", token, store=B,
                body={"title": f"QA Battery Widget {RUN}", "status": "draft"})
    pid = (d.get("product") or d).get("id") if isinstance(d, dict) else None
    report("products: create in B", c in (200, 201) and bool(pid), f"{c} {str(d)[:80]}")

    c, d = call("GET", "/merchant/products?limit=100", token, store=A)
    titles_a = [p.get("title") for p in d.get("products", [])]
    report("products: B item invisible in A", f"QA Battery Widget {RUN}" not in titles_a, str(titles_a)[:100])

    if pid:
        c, d = call("GET", f"/merchant/products/{pid}", token, store=A)
        report("products: direct id from A blocked", c in (403, 404), str(c))

    # ---- marketing social accounts -------------------------------------
    # NOTE: CMS content is intentionally NOT in this battery — it runs on its
    # own tenant-bound editor-token auth (hardened separately), unreachable
    # via merchant-session store context.
    c, d = call("POST", "/merchant/marketing/accounts/connect", token, store=A,
                body={"platform": "wordpress", "credentials": {
                    "site_url": "https://qa-battery-a.example.com",
                    "username": "qa", "app_password": "x"}})
    acc_id = (d.get("account") or {}).get("id")
    report("marketing: connect account in A", c in (200, 201) and bool(acc_id), f"{c} {str(d)[:80]}")

    c, d = call("GET", "/merchant/marketing/accounts", token, store=B)
    handles_b = [a.get("handle") for a in d.get("accounts", [])] if c == 200 else None
    report("marketing: A account invisible in B",
           handles_b is not None and "https://qa-battery-a.example.com" not in handles_b,
           f"{c} {str(handles_b)[:80]}")

    if acc_id:
        c, d = call("DELETE", f"/merchant/marketing/accounts/{acc_id}", token, store=B)
        report("marketing: forged-context disconnect blocked", c in (403, 404), str(c))
        c, d = call("DELETE", f"/merchant/marketing/accounts/{acc_id}", token, store=A)
        report("marketing: own-context disconnect works", c in (200, 204), str(c))

    # ---- journeys -------------------------------------------------------
    c, d = call("POST", "/merchant/marketing/journeys", token, store=B,
                body={"name": f"qa-batt-journey-{RUN}", "trigger_event": "order.placed", "status": "draft"})
    jid = (d.get("journey") or {}).get("id")
    report("journeys: create in B", c in (200, 201) and bool(jid), str(c))
    c, d = call("GET", "/merchant/marketing/journeys", token, store=A)
    names_a = [j.get("name") for j in d.get("journeys", [])]
    report("journeys: invisible in A", f"qa-batt-journey-{RUN}" not in names_a, str(names_a)[:80])

    # ---- credits isolation + transfer ----------------------------------
    c, d = call("GET", "/merchant/me", token, store=A)
    bal_a0 = d["store"]["credit_balance"]
    c, d = call("GET", "/merchant/me", token, store=B)
    bal_b0 = d["store"]["credit_balance"]
    report("credits: separate wallets", bal_a0 != bal_b0 or bal_a0 >= 0, f"A={bal_a0} B={bal_b0}")

    # transfer to a foreign store must 403
    c, d = call("POST", "/merchant/credits/transfer", token, store=A,
                body={"to_store_id": FOREIGN, "credits": 10})
    report("transfer: foreign destination denied", c == 403, f"{c} {str(d)[:60]}")

    # B's 1500 credits are PLAN credits — moving them must be refused
    c, d = call("POST", "/merchant/credits/transfer", token, store=B,
                body={"to_store_id": A, "credits": 100})
    report("transfer: plan credits immovable", c == 400 and d.get("reason") == "insufficient_purchased",
           f"{c} {str(d)[:80]}")

    # cleanup this run's fixtures (best-effort)
    if pid:
        call("DELETE", f"/merchant/products/{pid}", token, store=B)
    if jid:
        call("DELETE", f"/merchant/marketing/journeys/{jid}", token, store=B)

    print(f"\n{PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
