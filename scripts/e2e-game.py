"""Test end-to-end de la logique de jeu, contre la VRAIE base Supabase.

Joue une partie complète à 3 joueurs via les RPC (aucun mock) et vérifie :
validation de lettre (présente / absente / déjà demandée), coût et budget,
rotation du tour, élimination sur mauvaise réponse, score sur bonne réponse,
fin de partie, et étanchéité de player_secrets.

Usage :
    export URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL' .env.local | cut -d= -f2)
    export KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY' .env.local | cut -d= -f2)
    python3 scripts/e2e-game.py

Laisse une partie terminée en base : sans conséquence, mais on peut la purger.
"""
import json, urllib.request, os, sys

URL = os.environ["URL"]; KEY = os.environ["KEY"]
ok = True

def req(path, token=None, method="GET", body=None):
    r = urllib.request.Request(URL + path, method=method)
    r.add_header("apikey", KEY)
    r.add_header("Content-Type", "application/json")
    if token: r.add_header("Authorization", "Bearer " + token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(r, data) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        return {"__error": json.loads(e.read().decode() or "{}")}

def rpc(fn, token, args):  return req(f"/rest/v1/rpc/{fn}", token, "POST", args)
def sel(q, token):         return req(f"/rest/v1/{q}", token)

def check(label, cond, detail=""):
    global ok
    print(("  OK   " if cond else "  FAIL ") + label + ("" if cond else f"  -> {detail}"))
    if not cond: ok = False

# --- 3 sessions anonymes
tok = []
for i in range(3):
    r = req("/auth/v1/signup", method="POST", body={})
    if "access_token" not in r:
        print("Auth anonyme KO:", r); sys.exit(1)
    tok.append(r["access_token"])
print(f"3 sessions anonymes créées\n")

# --- création + jointures. total_rounds=1 pour atteindre la victoire vite.
g = rpc("create_game", tok[0], {"p_nickname": "Alice", "p_total_rounds": 1})
code, gid = g["code"], g["id"]
print(f"Partie #{code}")
for i, name in [(1, "Bob"), (2, "Chloe")]:
    rpc("join_game", tok[i], {"p_code": code, "p_nickname": name})

# --- chacun choisit son pays
SECRET = {0: "FRANCE", 1: "JAPON", 2: "BRESIL"}
for i in range(3):
    rpc("pick_country", tok[i], {"p_game_id": gid, "p_country": SECRET[i]})

players = sel(f"players?game_id=eq.{gid}&select=id,nickname,seat,masked,region,is_cracked,is_eliminated,score,letters_left,asked_letters&order=seat", tok[0])
pid = {p["nickname"]: p["id"] for p in players}
print("Masques initiaux :", {p["nickname"]: p["masked"] for p in players})
check("le pays est masqué au départ", all(set(p["masked"]) == {"_"} for p in players))
check("la région est publique", all(p["region"] for p in players))

# --- le pays des autres est-il vraiment inaccessible ?
leak = sel("player_secrets?select=*", tok[1])
# 401 ou 403 : dans les deux cas le client est bloqué (403 = interdit franc).
check("player_secrets est inaccessible au client", isinstance(leak, dict) and "__error" in leak, leak)

# --- lancement (hôte = Alice)
r = rpc("start_game", tok[0], {"p_game_id": gid})
check("start_game réussit", r and "__error" not in r, r)
game = sel(f"games?id=eq.{gid}&select=status,round,current_player_id", tok[0])[0]
check("la partie est en cours", game["status"] == "playing", game)
check("le tour est attribué (seat 0 = Alice)", game["current_player_id"] == pid["Alice"], game)

# --- un joueur hors tour est refusé
r = rpc("ask_letter", tok[1], {"p_target_player_id": pid["Alice"], "p_letter": "A"})
check("hors tour -> refusé", r.get("__error", {}).get("message") == "not your turn", r)

print("\n--- VALIDATION DE LETTRE")
# Alice interroge Bob (JAPON). 'J' présent, 'Z' absent.
r = rpc("ask_letter", tok[0], {"p_target_player_id": pid["Bob"], "p_letter": "J"})
check("lettre présente -> found=true", r is True, r)
bob = sel(f"players?id=eq.{pid['Bob']}&select=masked,asked_letters", tok[0])[0]
check("le masque de Bob révèle le J", bob["masked"] == "J____", bob)

game = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
check("le tour est passé à Bob", game["current_player_id"] == pid["Bob"], game)

# Bob interroge Chloe (BRESIL) avec une lettre absente
r = rpc("ask_letter", tok[1], {"p_target_player_id": pid["Chloe"], "p_letter": "Z"})
check("lettre absente -> found=false", r is False, r)
chloe = sel(f"players?id=eq.{pid['Chloe']}&select=masked,asked_letters", tok[1])[0]
check("le masque de Chloe ne bouge pas", chloe["masked"] == "______", chloe)
check("la lettre absente est mémorisée", "Z" in chloe["asked_letters"], chloe)

# Chloe redemande la même lettre sur Chloe? non: sur Bob, une lettre déjà demandée
r = rpc("ask_letter", tok[2], {"p_target_player_id": pid["Bob"], "p_letter": "J"})
check("lettre déjà demandée -> refusée", "already asked" in str(r), r)
# Chloe joue un coup valide pour rendre la main
rpc("ask_letter", tok[2], {"p_target_player_id": pid["Bob"], "p_letter": "A"})

alice = sel(f"players?id=eq.{pid['Alice']}&select=score,letters_left", tok[0])[0]
check("la question coûte 50 pts", alice["score"] == -50, alice)
check("le budget de lettres décroît", alice["letters_left"] == 5, alice)

print("\n--- ÉLIMINATION")
game = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
check("retour au tour d'Alice", game["current_player_id"] == pid["Alice"], game)
r = rpc("submit_guess", tok[0], {"p_target_player_id": pid["Bob"], "p_guess": "CHINE"})
check("mauvaise réponse -> correct=false", r.get("correct") is False, r)
check("mauvaise réponse : -100 pts annoncés", r.get("points") == -100, r)
alice = sel(f"players?id=eq.{pid['Alice']}&select=is_eliminated,score", tok[0])[0]
check("le joueur est éliminé", alice["is_eliminated"] is True, alice)
check("il perd 100 pts", alice["score"] == -150, alice)

game = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
check("le tour saute le joueur éliminé", game["current_player_id"] != pid["Alice"], game)

r = rpc("ask_letter", tok[0], {"p_target_player_id": pid["Bob"], "p_letter": "K"})
check("un éliminé ne peut plus jouer", "not your turn" in str(r), r)

print("\n--- BONNE RÉPONSE & VICTOIRE")
# Bob devine BRESIL (Chloe), puis Chloe devine JAPON (Bob) -> plus de cible -> fin
r = rpc("submit_guess", tok[1], {"p_target_player_id": pid["Chloe"], "p_guess": "BRESIL"})
check("bonne réponse -> correct=true", r.get("correct") is True, r)
check("le pays est renvoyé pour la célébration", r.get("country") == "BRESIL", r)
check("les points sont annoncés par le serveur", r.get("points") == 500 + 100 * 5, r)
chloe = sel(f"players?id=eq.{pid['Chloe']}&select=is_cracked,masked", tok[1])[0]
check("le pays trouvé est révélé", chloe["masked"] == "BRESIL" and chloe["is_cracked"], chloe)
bobp = sel(f"players?id=eq.{pid['Bob']}&select=score", tok[1])[0]
check("bonne réponse : +500 +100/lettre restante", bobp["score"] == -50 + 500 + 100 * 5, bobp)

r = rpc("submit_guess", tok[2], {"p_target_player_id": pid["Bob"], "p_guess": "JAPON"})
check("bonne réponse sur Bob -> correct=true", r.get("correct") is True, r)

# Le pays d'Alice reste à trouver : être éliminé n'met pas son pays à l'abri.
game = sel(f"games?id=eq.{gid}&select=status", tok[0])[0]
check("la partie continue tant qu'un pays est inconnu", game["status"] == "playing", game)

# Bob trouve le dernier pays (celui d'Alice, éliminée) -> plus rien à deviner.
r = rpc("submit_guess", tok[1], {"p_target_player_id": pid["Alice"], "p_guess": "FRANCE"})
check("le pays d'un éliminé reste devinable", r.get("correct") is True, r)

game = sel(f"games?id=eq.{gid}&select=status,ended_at,current_player_id", tok[0])[0]
check("plus rien à deviner -> partie terminée", game["status"] == "finished", game)
check("ended_at est posé", game["ended_at"] is not None, game)
check("plus de tour en cours", game["current_player_id"] is None, game)

final = sel(f"players?game_id=eq.{gid}&select=nickname,score&order=score.desc", tok[0])
print("\nClassement final :", [(p["nickname"], p["score"]) for p in final])
check("le vainqueur est celui qui a le plus de points", final[0]["score"] >= final[1]["score"])

print("\n--- COMPTEURS DE PARTIE (résumé)")
pl = sel(f"players?game_id=eq.{gid}&select=nickname,found_count,guess_count,letters_count&order=seat", tok[0])
byname = {p["nickname"]: p for p in pl}
if all(k in (byname.get("Bob") or {}) for k in ("found_count","guess_count","letters_count")):
    b = byname["Bob"]
    check("Bob a 2 pays trouvés (compteur partie)", b["found_count"] == 2, b)
    check("les questions de Bob sont comptées", b["letters_count"] >= 1, b)
    a = byname["Alice"]
    check("la tentative ratée d'Alice est comptée", a["guess_count"] >= 1, a)
else:
    check("compteurs de partie présents (migration 0010)", False, "colonnes absentes — applique 0010")

print("\n--- PROFIL & DÉCOUVERTES")
st = sel("player_stats?select=*", tok[1])
check("les stats de Bob existent", isinstance(st, list) and len(st) == 1, st)
if isinstance(st, list) and st:
    b = st[0]
    check("2 bonnes réponses comptées", b["correct_guesses"] == 2, b)
    check("1 partie jouée", b["games_played"] == 1, b)
    check("Bob a gagné", b["wins"] == 1, b)

disc = sel("discoveries?select=country,times&order=country", tok[1])
check("Bob a découvert BRESIL et FRANCE",
      sorted(d["country"] for d in disc) == ["BRESIL", "FRANCE"], disc)

# Étanchéité : les stats sont-elles bien privées ?
alice_view = sel("discoveries?select=country", tok[0])
check("Alice ne voit pas les découvertes de Bob",
      all(d["country"] not in ("BRESIL", "FRANCE") for d in alice_view), alice_view)

print("\n" + ("TOUT PASSE" if ok else "DES TESTS ÉCHOUENT"))
sys.exit(0 if ok else 1)
