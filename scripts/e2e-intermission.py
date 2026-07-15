"""Vérifie l'enchaînement des manches SANS retour au salon (migration 0011).
Fin de manche -> intermission ; quand tous ont rechoisi -> démarrage auto."""
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
pl = sel(f"players?game_id=eq.{gid}&select=id,nickname,seat&order=seat", tok[0])
pid = {p["nickname"]: p["id"] for p in pl}
print(f"#{code} — 2 joueurs, 2 manches. Manche 1 lancée.")

# Manche 1 : Alice demande une lettre -> Bob ; Bob se trompe -> éliminé -> Alice
# dernière debout -> fin de manche 1.
rpc("ask_letter", tok[0], {"p_target_player_id": pid["Bob"], "p_letter": "J"})
rpc("submit_guess", tok[1], {"p_target_player_id": pid["Alice"], "p_guess": "CHINE"})  # Bob rate

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
