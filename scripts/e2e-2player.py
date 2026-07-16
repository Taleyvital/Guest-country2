"""Sonde le cas "partie à 2, un joueur éliminé".
Avant 0009 : la manche continue (bug). Après 0009 : le survivant gagne, manche finie.

Depuis 0014, le premier joueur est désigné par un lancer de dé (aléatoire) : on résout
DYNAMIQUEMENT qui a la main après start_game plutôt que de supposer que c'est Alice."""
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
for t in tok: rpc("roll_dice", t, {"p_game_id": gid})  # 0014 : le dé conditionne start_game
rpc("start_game", tok[0], {"p_game_id": gid})

players = sel(f"players?game_id=eq.{gid}&select=id,nickname,score,is_eliminated&order=seat", tok[0])
pid = {p["nickname"]: p["id"] for p in players}
tok_by_name = {"Alice": tok[0], "Bob": tok[1]}

# Qui a gagné le dé ? On ne le suppose plus (0014 : tirage aléatoire).
game0 = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
starter = next(p["nickname"] for p in players if p["id"] == game0["current_player_id"])
other = "Bob" if starter == "Alice" else "Alice"
print(f"Partie #{code} à 2 joueurs, lancée. Le dé désigne {starter} pour commencer.")

# Le joueur en tour propose un MAUVAIS pays pour l'autre -> il est éliminé.
r = rpc("submit_guess", tok_by_name[starter], {"p_target_player_id": pid[other], "p_guess": "ANTARCTIQUE"})
print(f"{starter} se trompe :", {k: r.get(k) for k in ("correct", "points")})

game = sel(f"games?id=eq.{gid}&select=status,current_player_id,round", tok[0])[0]
players = sel(f"players?game_id=eq.{gid}&select=nickname,score,is_eliminated&order=seat", tok[0])
print(f"\n--- État après l'élimination de {starter} ---")
print("statut partie :", game["status"], "| manche :", game["round"])
for p in players:
    print(f"  {p['nickname']:6} score={p['score']:5}  éliminé={p['is_eliminated']}")

survivor = next(p for p in players if p["nickname"] == other)
if game["status"] in ("lobby", "finished"):
    print(f"\n=> Manche TERMINÉE. {other} a le point (bonus survie).",
          "OK" if survivor["score"] > 0 else "mais sans bonus ?!")
else:
    print(f"\n=> Manche ENCORE EN COURS : {other} doit continuer à deviner le pays de {starter}.",
          "\n   (comportement d'avant 0009 — le correctif n'est pas appliqué)")
