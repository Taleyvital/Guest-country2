"""Vérifie le mécanisme du dé (migration 0014) qui désigne le premier joueur.

Le résultat du dé est aléatoire par nature : ce script ne teste donc pas UNE valeur
précise, mais les garanties structurelles — un dé par joueur, pas de double lancer,
start_game bloqué tant que tout le monde n'a pas lancé, et le gagnant devient bien
current_player_id ET starter_player_id."""
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
g = rpc("create_game", tok[0], {"p_nickname": "Alice", "p_total_rounds": 1})
code, gid = g["code"], g["id"]
rpc("join_game", tok[1], {"p_code": code, "p_nickname": "Bob"})
rpc("pick_country", tok[0], {"p_game_id": gid, "p_country": "FRANCE"})
rpc("pick_country", tok[1], {"p_game_id": gid, "p_country": "JAPON"})
print(f"#{code} — 2 joueurs, prêts à lancer le dé.")

# start_game refuse tant que personne n'a lancé le dé.
r = rpc("start_game", tok[0], {"p_game_id": gid})
check("start_game refuse sans dé lancé", "roll the dice" in str(r), r)

# Alice lance : valeur dans [1,6].
r = rpc("roll_dice", tok[0], {"p_game_id": gid})
check("le dé rend une valeur entre 1 et 6", isinstance(r, int) and 1 <= r <= 6, r)

# Alice ne peut pas relancer.
r2 = rpc("roll_dice", tok[0], {"p_game_id": gid})
check("un second lancer est refusé", "already rolled" in str(r2), r2)

# start_game refuse encore : Bob n'a pas lancé.
r = rpc("start_game", tok[0], {"p_game_id": gid})
check("start_game refuse tant que Bob n'a pas lancé", "roll the dice" in str(r), r)

rpc("roll_dice", tok[1], {"p_game_id": gid})

# Les deux ont lancé : start_game doit réussir.
r = rpc("start_game", tok[0], {"p_game_id": gid})
check("start_game réussit une fois tout le monde lancé", r and "__error" not in r, r)

players = sel(f"players?game_id=eq.{gid}&select=id,nickname,dice_roll", tok[0])
game = sel(f"games?id=eq.{gid}&select=current_player_id,starter_player_id", tok[0])[0]
by_id = {p["id"]: p for p in players}
print("Résultats :", [(p["nickname"], p["dice_roll"]) for p in players])

check("chacun a un résultat de dé visible", all(p["dice_roll"] is not None for p in players), players)
check("current_player_id pointe vers un joueur de la partie",
      game["current_player_id"] in by_id, game)
check("starter_player_id = current_player_id (premier lancement)",
      game["starter_player_id"] == game["current_player_id"], game)

winner = by_id[game["current_player_id"]]
loser = next(p for p in players if p["id"] != winner["id"])
check("le gagnant n'a pas un dé strictement inférieur au perdant",
      winner["dice_roll"] >= loser["dice_roll"], (winner, loser))

# Lancer le dé une fois la partie démarrée doit échouer.
r = rpc("roll_dice", tok[0], {"p_game_id": gid})
check("lancer le dé après le lancement est refusé", "already started" in str(r), r)

print("\n" + ("TOUT PASSE" if ok else "DES TESTS ÉCHOUENT"))
sys.exit(0 if ok else 1)
