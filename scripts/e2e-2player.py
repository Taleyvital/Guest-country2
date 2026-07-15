"""Sonde le cas "partie à 2, un joueur éliminé".
Avant 0009 : la manche continue (bug). Après 0009 : le survivant gagne, manche finie."""
import json, urllib.request, os, sys

URL = os.environ["URL"]; KEY = os.environ["KEY"]

def req(path, token=None, method="GET", body=None):
    r = urllib.request.Request(URL + path, method=method)
    r.add_header("apikey", KEY); r.add_header("Content-Type", "application/json")
    if token: r.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data) as resp:
            raw = resp.read().decode(); return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        return {"__error": json.loads(e.read().decode() or "{}")}

def rpc(fn, tok, args): return req(f"/rest/v1/rpc/{fn}", tok, "POST", args)
def sel(q, tok): return req(f"/rest/v1/{q}", tok)

tok = []
for _ in range(2):
    tok.append(req("/auth/v1/signup", method="POST", body={})["access_token"])

g = rpc("create_game", tok[0], {"p_nickname": "Alice", "p_total_rounds": 3})
code, gid = g["code"], g["id"]
rpc("join_game", tok[1], {"p_code": code, "p_nickname": "Bob"})
rpc("pick_country", tok[0], {"p_game_id": gid, "p_country": "FRANCE"})
rpc("pick_country", tok[1], {"p_game_id": gid, "p_country": "JAPON"})
rpc("start_game", tok[0], {"p_game_id": gid})

players = sel(f"players?game_id=eq.{gid}&select=id,nickname,score,is_eliminated&order=seat", tok[0])
pid = {p["nickname"]: p["id"] for p in players}
print(f"Partie #{code} à 2 joueurs, lancée. Tour à Alice (seat 0).")

# Alice (tour) propose un MAUVAIS pays pour Bob -> Alice éliminée.
r = rpc("submit_guess", tok[0], {"p_target_player_id": pid["Bob"], "p_guess": "CHINE"})
print("Alice se trompe :", {k: r.get(k) for k in ("correct", "points")})

game = sel(f"games?id=eq.{gid}&select=status,current_player_id,round", tok[0])[0]
players = sel(f"players?game_id=eq.{gid}&select=nickname,score,is_eliminated&order=seat", tok[0])
print("\n--- État après l'élimination d'Alice ---")
print("statut partie :", game["status"], "| manche :", game["round"])
for p in players:
    print(f"  {p['nickname']:6} score={p['score']:5}  éliminé={p['is_eliminated']}")

bob = next(p for p in players if p["nickname"] == "Bob")
if game["status"] in ("lobby", "finished"):
    print("\n=> Manche TERMINÉE. Bob a le point (bonus survie).",
          "OK" if bob["score"] > 0 else "mais sans bonus ?!")
else:
    print("\n=> Manche ENCORE EN COURS : Bob doit continuer à deviner le pays d'Alice.",
          "\n   (comportement d'avant 0009 — le correctif n'est pas appliqué)")
