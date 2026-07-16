"""Vérifie l'enchaînement des manches SANS retour au salon (migration 0011).
Fin de manche -> intermission ; quand tous ont rechoisi -> démarrage auto.

Depuis 0014, le premier joueur est désigné par un lancer de dé (aléatoire) : on résout
DYNAMIQUEMENT qui commence après start_game plutôt que de supposer que c'est Alice."""
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

COUNTRY = {"Alice": "FRANCE", "Bob": "JAPON"}
rpc("pick_country", tok[0], {"p_game_id": gid, "p_country": COUNTRY["Alice"]})
rpc("pick_country", tok[1], {"p_game_id": gid, "p_country": COUNTRY["Bob"]})
for t in tok: rpc("roll_dice", t, {"p_game_id": gid})  # 0014 : le dé conditionne start_game
rpc("start_game", tok[0], {"p_game_id": gid})

pl = sel(f"players?game_id=eq.{gid}&select=id,nickname,seat&order=seat", tok[0])
pid = {p["nickname"]: p["id"] for p in pl}
tok_by_name = {"Alice": tok[0], "Bob": tok[1]}

game0 = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
starter = next(p["nickname"] for p in pl if p["id"] == game0["current_player_id"])
other = "Bob" if starter == "Alice" else "Alice"
print(f"#{code} — 2 joueurs, 2 manches. Le dé désigne {starter} pour commencer.")

# Manche 1 : le joueur en tour demande une lettre -> passe la main ; l'autre se
# trompe -> éliminé -> le premier joueur (dernier debout) gagne -> fin de manche 1.
rpc("ask_letter", tok_by_name[starter], {"p_target_player_id": pid[other], "p_letter": COUNTRY[other][0]})
rpc("submit_guess", tok_by_name[other], {"p_target_player_id": pid[starter], "p_guess": "ANTARCTIQUE"})

g2 = sel(f"games?id=eq.{gid}&select=status,round,intermission,current_player_id", tok[0])[0]
print("\n--- Après la fin de la manche 1 ---")
print(g2)
check("la partie passe en INTERMISSION", g2.get("intermission") is True, g2)
check("statut = lobby (pour rechoisir)", g2["status"] == "lobby", g2)
check("on est bien en manche 2", g2["round"] == 2, g2)
check("aucun tour en cours pendant l'intermission", g2["current_player_id"] is None, g2)

# Les joueurs rechoisissent. Après le PREMIER choix : toujours en intermission.
rpc("pick_country", tok[0], {"p_game_id": gid, "p_country": "BRESIL"})
g3 = sel(f"games?id=eq.{gid}&select=status,intermission", tok[0])[0]
check("un seul joueur a choisi -> encore en intermission", g3.get("intermission") is True, g3)

# Après le SECOND choix : démarrage automatique, sans 'prêt' ni hôte.
rpc("pick_country", tok[1], {"p_game_id": gid, "p_country": "ITALIE"})
g4 = sel(f"games?id=eq.{gid}&select=status,intermission,current_player_id", tok[0])[0]
print("\n--- Après que tout le monde a rechoisi ---")
print(g4)
check("la manche 2 démarre AUTOMATIQUEMENT", g4["status"] == "playing", g4)
check("l'intermission est levée", g4.get("intermission") is False, g4)
check("un tour est attribué", g4["current_player_id"] is not None, g4)

print("\n" + ("TOUT PASSE" if ok else "DES TESTS ÉCHOUENT"))
sys.exit(0 if ok else 1)
