#!/usr/bin/env python3
"""Seed, drive and purge a synthetic trackee in BarTalk's production Firestore.

The tracking feature can only be exercised when someone is actually sharing
their position with you, which normally requires a second person on a second
device. This stands in for that person so the map, the auto-fit revert, the
watch notice and the real push can all be tested solo.

Everything it writes is prefixed `demo-` and removable with `--remove`.

  ./scripts/demo-trackee.py --seed --near 39.0997,-94.5786
  ./scripts/demo-trackee.py --walk              # move the pin every 3s
  ./scripts/demo-trackee.py --ping              # real push to YOUR phone
  ./scripts/demo-trackee.py --expire            # let the 60s ceiling end it
  ./scripts/demo-trackee.py --message -n 3      # 3 unread messages, for the badge
  ./scripts/demo-trackee.py --remove

Auth comes from the Firebase CLI's stored refresh token, so it acts as project
owner and bypasses firestore.rules — which is the point: it has to write another
user's location document, and the rules correctly forbid that from any client.
"""

import argparse, json, math, os, random, sys, time
import urllib.request, urllib.parse, urllib.error

PROJECT   = "bartalk-75142"
BASE      = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
DEMO_UID  = "demo-trackee-01"
DEMO_NAME = "Test Trackee (demo)"

# ---------------------------------------------------------------- transport

_token = None

def token():
    global _token
    if _token:
        return _token
    path = os.path.expanduser("~/.config/configstore/firebase-tools.json")
    if not os.path.exists(path):
        sys.exit("No Firebase CLI credentials found. Run: firebase login")
    refresh = json.load(open(path))["tokens"]["refresh_token"]
    # The Firebase CLI's own OAuth client. These two values ship inside every
    # firebase-tools install and are public by design — an installed-app client
    # cannot keep a secret, which is why the refresh token above is the thing
    # that actually grants access. Nothing here is a credential of yours.
    body = urllib.parse.urlencode({
        "client_id": "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6"
                     ".apps.googleusercontent.com",
        "client_secret": "j9iVZfS8kkCEFUPaAeJV0sAi",
        "refresh_token": refresh,
        "grant_type": "refresh_token",
    }).encode()
    res = urllib.request.urlopen(urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=body))
    _token = json.load(res)["access_token"]
    return _token


def call(method, path, body=None, params="", quiet=False):
    req = urllib.request.Request(
        BASE + path + params, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token(),
                 "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:300]
        if quiet:
            return {"error": e.code, "detail": detail}
        sys.exit(f"{method} {path} failed: {e.code}\n{detail}")


# ------------------------------------------------------- value (de)coding

def enc(value):
    if value is None:                return {"nullValue": None}
    if isinstance(value, bool):      return {"booleanValue": value}
    if isinstance(value, int):       return {"integerValue": str(value)}
    if isinstance(value, float):     return {"doubleValue": value}
    if isinstance(value, str):       return {"stringValue": value}
    if isinstance(value, list):      return {"arrayValue": {"values": [enc(v) for v in value]}}
    if isinstance(value, dict):      return {"mapValue": {"fields": {k: enc(v) for k, v in value.items()}}}
    raise TypeError(type(value))


def dec(doc):
    def one(x):
        k = next(iter(x)); v = x[k]
        if k == "integerValue": return int(v)
        if k == "doubleValue":  return float(v)
        if k == "nullValue":    return None
        if k == "arrayValue":   return [one(i) for i in v.get("values", [])]
        if k == "mapValue":     return {a: one(b) for a, b in v.get("fields", {}).items()}
        return v
    return {a: one(b) for a, b in (doc.get("fields") or {}).items()}


def put(coll, doc_id, data):
    return call("PATCH", f"/{coll}/{doc_id}", {"fields": {k: enc(v) for k, v in data.items()}})


def now_ms():
    return int(time.time() * 1000)


# ------------------------------------------------------------------ lookup

def find_owner(email_hint=None):
    """The real human this demo trackee will share with."""
    docs = call("GET", "/Users", params="?pageSize=50").get("documents", [])
    people = []
    for d in docs:
        uid = d["name"].split("/")[-1]
        if uid.startswith("demo-"):
            continue
        p = dec(d)
        people.append((uid, p))
    if not people:
        sys.exit("No real users in the project.")
    if email_hint:
        for uid, p in people:
            if p.get("email", "").lower() == email_hint.lower():
                return uid, p
        sys.exit(f"No user with email {email_hint}. Found: " +
                 ", ".join(p.get("email", "?") for _, p in people))
    if len(people) == 1:
        return people[0]
    # Most recently active wins — that's whoever is holding the phone.
    people.sort(key=lambda t: t[1].get("lastSignIn", ""), reverse=True)
    return people[0]


def name_of(p):
    return f"{p.get('fname', '')} {p.get('lname', '')}".strip() or p.get("email", "someone")


# ------------------------------------------------------------------ actions

def seed(owner_uid, owner, lat, lng, watch_me):
    put("Users", DEMO_UID, {
        "fname": "Test", "lname": "Trackee (demo)",
        "email": "demo-trackee@example.invalid",
        "phone": "0000000000",
        "createdAt": "seeded-by-demo-trackee-script",
    })

    link_id = f"{owner_uid}__{DEMO_UID}"
    put("trackingLinks", link_id, {
        "trackerId": owner_uid, "trackeeId": DEMO_UID,
        "members": [owner_uid, DEMO_UID],
        "trackerName": name_of(owner), "trackeeName": DEMO_NAME,
        "status": "active", "pausedByTrackee": False,
    })

    put("locations", DEMO_UID, {
        "lat": lat, "lng": lng,
        "accuracy": 12.0, "heading": 91.0, "speed": 1.4,
        "batteryLevel": 0.72,
        "capturedAt": now_ms(),
        "mode": "idle",
        "sharedWith": [owner_uid],
        "permissionState": "always",
    })
    print(f"  seeded  {DEMO_NAME} at {lat:.5f}, {lng:.5f}")
    print(f"  link    {name_of(owner)} → {DEMO_NAME}  (active)")

    if watch_me:
        rev = f"{DEMO_UID}__{owner_uid}"
        put("trackingLinks", rev, {
            "trackerId": DEMO_UID, "trackeeId": owner_uid,
            "members": [DEMO_UID, owner_uid],
            "trackerName": DEMO_NAME, "trackeeName": name_of(owner),
            "status": "active", "pausedByTrackee": False,
        })
        print(f"  link    {DEMO_NAME} → {name_of(owner)}  (active, for --ping)")


def walk(owner_uid, lat, lng, seconds, step_m):
    """Nudge the demo position so live updates and re-framing are visible."""
    bearing = random.uniform(0, 2 * math.pi)
    deadline = time.time() + seconds
    n = 0
    print(f"  walking every 3s for {seconds}s — watch the pin move. Ctrl-C to stop.")
    while time.time() < deadline:
        bearing += random.uniform(-0.6, 0.6)
        lat += (step_m * math.cos(bearing)) / 111_320
        lng += (step_m * math.sin(bearing)) / (111_320 * math.cos(math.radians(lat)))
        put("locations", DEMO_UID, {
            "lat": lat, "lng": lng,
            "accuracy": round(random.uniform(5, 18), 1),
            "heading": round(math.degrees(bearing) % 360, 1),
            "speed": round(step_m / 3.0, 2),
            "batteryLevel": 0.72,
            "capturedAt": now_ms(),
            "mode": "live",
            "sharedWith": [owner_uid],
            "permissionState": "always",
        })
        n += 1
        print(f"    {n:>3}  {lat:.5f}, {lng:.5f}")
        time.sleep(3)


def ping(owner_uid, owner, hold):
    """Open a watch session against the real user, so their phone is pushed."""
    sid = f"{DEMO_UID}__{owner_uid}"
    started = now_ms()
    put("watchSessions", sid, {
        "trackerId": DEMO_UID, "trackeeId": owner_uid,
        "trackerName": DEMO_NAME, "active": True,
        "startedAt": started, "lastHeartbeatAt": started,
    })
    print(f"  watch session opened — {DEMO_NAME} is now 'looking at' {name_of(owner)}")
    print(f"  expect a push on the phone: “👀 {DEMO_NAME} is checking your location”")

    for _ in range(20):
        time.sleep(1)
        s = dec(call("GET", f"/watchSessions/{sid}", quiet=True) or {})
        if s.get("notifiedAt"):
            print(f"  cloud function stamped notifiedAt after "
                  f"{(s['notifiedAt'] - started) / 1000:.1f}s — push was sent")
            break
    else:
        print("  no notifiedAt after 20s — check: firebase functions:log")

    print(f"  holding the session open {hold}s, then closing it…")
    time.sleep(hold)
    ended = now_ms()
    put("watchSessions", sid, {
        "trackerId": DEMO_UID, "trackeeId": owner_uid,
        "trackerName": DEMO_NAME, "active": False,
        "startedAt": started, "lastHeartbeatAt": ended, "endedAt": ended,
    })
    print(f"  closed after {(ended - started) / 1000:.0f}s — "
          "the audit entry should now appear in 'Who checked on me'")


def find_conversation(owner_uid):
    """The demo trackee's conversation with the owner, created if absent."""
    res = call("POST", ":runQuery", {
        "structuredQuery": {
            "from": [{"collectionId": "conversations"}],
            "where": {"fieldFilter": {
                "field": {"fieldPath": "participants"},
                "op": "ARRAY_CONTAINS",
                "value": {"stringValue": DEMO_UID},
            }},
        },
    }, quiet=True)
    if isinstance(res, list):
        for row in res:
            doc = row.get("document")
            if not doc:
                continue
            if owner_uid in dec(doc).get("participants", []):
                return doc["name"].split("/")[-1]

    convo_id = f"demo-convo-{DEMO_UID}"
    put("conversations", convo_id, {"participants": [owner_uid, DEMO_UID]})
    return convo_id


def message(owner_uid, text, count):
    """Send messages from the demo trackee, so the unread badge has something
    to count. The count itself is written by the sendPushNotification trigger,
    exactly as it is for a real message — this only supplies the message."""
    convo_id = find_conversation(owner_uid)
    for n in range(count):
        sent_at = now_ms() + n
        body = text if count == 1 else f"{text} ({n + 1}/{count})"
        put(f"conversations/{convo_id}/messages", f"demo-msg-{sent_at}", {
            "text": body,
            "kind": "text",
            "sender": DEMO_UID,
            "receiverId": owner_uid,
            "timestamp": sent_at,
        })
        print(f"  sent: {body}")
        time.sleep(0.4)

    print(f"  conversation {convo_id}")
    # The count is written by the same trigger that sends the push, and a cold
    # start there takes a few seconds. Poll rather than guess.
    print("  waiting for the server to count them…")
    expected = count
    for _ in range(20):
        time.sleep(2)
        convo = dec(call("GET", f"/conversations/{convo_id}", quiet=True) or {})
        got = (convo.get("unreadCounts") or {}).get(owner_uid, 0)
        if got >= expected:
            break
    print(f"  unreadCounts[{owner_uid[:8]}…] = {got}")


def expire(owner_uid, owner):
    """Open a watch session on the owner and keep it alive, so the ceiling ends
    it rather than a polite close. This is the path a tracker takes when they
    simply leave the map open — and the only way to see the automatic ending
    notification arrive on a real device."""
    sid = f"{DEMO_UID}{'__'}{owner_uid}"

    # Close anything left open from a previous run. This script writes as
    # project owner and so bypasses the rule that stops a real client reusing a
    # live session — without this, a leftover session gets its start time
    # rewritten instead of a new one being opened, and no notification fires.
    existing = dec(call("GET", f"/watchSessions/{sid}", quiet=True) or {})
    if existing.get("active") is True:
        print("  closing a session left over from a previous run")
        put("watchSessions", sid, {
            "trackerId": DEMO_UID, "trackeeId": owner_uid,
            "trackerName": DEMO_NAME, "active": False,
            "startedAt": existing.get("startedAt", now_ms()),
            "lastHeartbeatAt": existing.get("lastHeartbeatAt", now_ms()),
            "endedAt": now_ms(),
        })
        time.sleep(3)

    started = now_ms()
    put("watchSessions", sid, {
        "trackerId": DEMO_UID, "trackeeId": owner_uid,
        "trackerName": DEMO_NAME, "active": True,
        "startedAt": started, "lastHeartbeatAt": started,
    })
    print(f"  opened — {DEMO_NAME} is looking at {name_of(owner)}")
    print("  NOT closing it. The ceiling has to do that.")
    print(f"  expect: “👀 {DEMO_NAME} is checking your location”")

    last_beat = started
    while True:
        time.sleep(5)
        now = now_ms()
        age = (now - started) / 1000
        session = dec(call("GET", f"/watchSessions/{sid}", quiet=True) or {})

        if session.get("active") is False:
            ended = session.get("endedAt", now)
            print(f"  t+{age:5.0f}s  ENDED by the server — "
                  f"credited {(ended - started) / 1000:.0f}s")
            print(f"  expect: “{DEMO_NAME} stopped checking your location”")
            break

        # Heartbeat like a real tracker sitting on the map, so nothing is
        # closed for looking dead. Every field goes back, because a partial
        # write here would replace the document rather than update it.
        if now - last_beat >= 20_000:
            put("watchSessions", sid, {
                "trackerId": DEMO_UID, "trackeeId": owner_uid,
                "trackerName": DEMO_NAME, "active": True,
                "startedAt": started, "lastHeartbeatAt": now,
            })
            last_beat = now
            print(f"  t+{age:5.0f}s  heartbeat")
        else:
            print(f"  t+{age:5.0f}s  still open")

        if age > 200:
            print("  !! never ended — something is wrong")
            break


def remove():
    gone = []
    convo_id = f"demo-convo-{DEMO_UID}"
    msgs = call("GET", f"/conversations/{convo_id}/messages",
                params="?pageSize=300", quiet=True)
    for d in (msgs or {}).get("documents", []) if isinstance(msgs, dict) else []:
        mid = d["name"].split("/")[-1]
        call("DELETE", f"/conversations/{convo_id}/messages/{mid}", quiet=True)
        gone.append(f"messages/{mid}")
    call("DELETE", f"/conversations/{convo_id}", quiet=True)

    for coll, where in (("Users", None), ("locations", None),
                        ("trackingLinks", "members"), ("watchSessions", None),
                        ("trackingEvents", None)):
        docs = call("GET", "/" + coll, params="?pageSize=300").get("documents", [])
        for d in docs:
            doc_id = d["name"].split("/")[-1]
            p = dec(d)
            touched = (
                DEMO_UID in doc_id
                or p.get("trackeeId") == DEMO_UID
                or p.get("trackerId") == DEMO_UID
                or (where and DEMO_UID in (p.get(where) or []))
            )
            if touched:
                call("DELETE", f"/{coll}/{doc_id}", quiet=True)
                gone.append(f"{coll}/{doc_id}")
    if gone:
        for g in gone:
            print("  removed", g)
    else:
        print("  nothing to remove — production is already clean")


# --------------------------------------------------------------------- cli

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seed", action="store_true", help="create the demo trackee and link")
    ap.add_argument("--walk", action="store_true", help="move the demo pin every 3s")
    ap.add_argument("--ping", action="store_true", help="watch YOU, sending a real push")
    ap.add_argument("--expire", action="store_true",
                    help="watch YOU and let the 60s ceiling end it")
    ap.add_argument("--message", nargs="?", const="Hey, where are you?",
                    metavar="TEXT", help="send messages, to test the unread badge")
    ap.add_argument("-n", "--count", type=int, default=1, metavar="N",
                    help="how many messages --message sends")
    ap.add_argument("--remove", action="store_true", help="delete everything this script wrote")
    ap.add_argument("--near", metavar="LAT,LNG", help="anchor the demo pin near here")
    ap.add_argument("--offset", type=int, default=700, metavar="M",
                    help="metres from the anchor to place the pin (default 700)")
    ap.add_argument("--as-user", metavar="EMAIL", help="which real account to share with")
    ap.add_argument("--duration", type=int, default=120, metavar="S", help="--walk duration")
    ap.add_argument("--step", type=int, default=25, metavar="M", help="--walk step size")
    ap.add_argument("--hold", type=int, default=15, metavar="S", help="--ping session length")
    a = ap.parse_args()

    if not any((a.seed, a.walk, a.ping, a.remove, a.message, a.expire)):
        ap.print_help()
        return

    if a.remove:
        print("Removing demo data…")
        remove()
        return

    owner_uid, owner = find_owner(a.as_user)
    print(f"Acting for {name_of(owner)} <{owner.get('email')}>")

    if a.near:
        lat, lng = (float(x) for x in a.near.split(","))
    else:
        lat, lng = 39.0997, -94.5786          # Kansas City, matching your area code
        print(f"  no --near given, using Kansas City ({lat}, {lng})")

    bearing = random.uniform(0, 2 * math.pi)
    plat = lat + (a.offset * math.cos(bearing)) / 111_320
    plng = lng + (a.offset * math.sin(bearing)) / (111_320 * math.cos(math.radians(lat)))

    if a.seed:
        seed(owner_uid, owner, plat, plng, watch_me=True)
    if a.walk:
        cur = dec(call("GET", f"/locations/{DEMO_UID}", quiet=True) or {})
        walk(owner_uid, cur.get("lat", plat), cur.get("lng", plng), a.duration, a.step)
    if a.message:
        message(owner_uid, a.message, max(1, a.count))
    if a.ping:
        ping(owner_uid, owner, a.hold)
    if a.expire:
        expire(owner_uid, owner)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n  stopped")
