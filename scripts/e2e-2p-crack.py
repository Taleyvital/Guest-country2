"""Partie à 2 : trouver le pays de l'autre termine la manche (migration 0012).
B devine le pays d'A -> la manche se conclut aussitôt, A n'a pas de tour retour."""
import json, urllib.request, os, sys

URL = os.environ["URL"]; KEY = os.environ["KEY"]
ok = True

def req(path, tok=None, method="GET", body=None):
    r = urllib.request.Request(URL + path, method=method)
    r.add_header("apikey", KEY); r.add_header("Content-Type", "application/json")
    if tok: r.add_header("Authorization", "Bearer " + tok)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data) as x:
            raw = x.read().decode(); return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        return {"__error": json.loads(e.read().decode() or "{}")}

def rpc(fn, tok, a): return req(f"/rest/v1/rpc/{fn}", tok, "POST", a)
def sel(q, tok): return req(f"/rest/v1/{q}", tok)
def check(label, cond, detail=""):
    global ok
    print(("  OK   " if cond else "  FAIL ") + label + ("" if cond else f"  -> {detail}"))
    if not cond: ok = False

tok = [req("/auth/v1/signup", method="POST", body={})["access_token"] for _ in range(2)]
g = rpc("create_game", tok[0], {"p_nickname": "Alice", "p_total_rounds": 2})
code, gid = g["code"], g["id"]
rpc("join_game", tok[1], {"p_code": code, "p_nickname": "Bob"})
rpc("pick_country", tok[0], {"p_game_id": gid, "p_country": "FRANCE"})
rpc("pick_country", tok[1], {"p_game_id": gid, "p_country": "JAPON"})
rpc("start_game", tok[0], {"p_game_id": gid})
pl = sel(f"players?game_id=eq.{gid}&select=id,nickname&order=seat", tok[0])
pid = {p["nickname"]: p["id"] for p in pl}
print(f"#{code} — 2 joueurs, 2 manches. Manche 1, tour à Alice.")

# Alice demande une lettre -> passe la main à Bob.
rpc("ask_letter", tok[0], {"p_target_player_id": pid["Bob"], "p_letter": "J"})
# Bob DEVINE le pays d'Alice = FRANCE (bon).
r = rpc("submit_guess", tok[1], {"p_target_player_id": pid["Alice"], "p_guess": "FRANCE"})
print("Bob devine FRANCE :", {k: r.get(k) for k in ("correct", "points")})

g2 = sel(f"games?id=eq.{gid}&select=status,round,intermission,current_player_id", tok[0])[0]
pls = sel(f"players?game_id=eq.{gid}&select=nickname,score&order=score.desc", tok[0])
print("\n--- Après le crack de Bob ---")
print(g2)
check("la manche NE continue PAS (Alice n'a pas de tour retour)", g2["status"] != "playing", g2)
check("on passe à la manche suivante (intermission)",
      g2.get("intermission") is True and g2["round"] == 2, g2)
check("Bob mène", pls[0]["nickname"] == "Bob", pls)

print("\nScores :", [(p["nickname"], p["score"]) for p in pls])
print(("TOUT PASSE" if ok else "DES TESTS ÉCHOUENT"))
sys.exit(0 if ok else 1)
