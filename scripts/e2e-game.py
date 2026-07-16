"""Test end-to-end de la logique de jeu, contre la VRAIE base Supabase.

Joue une partie complète à 3 joueurs via les RPC (aucun mock) et vérifie :
validation de lettre (présente / absente / déjà demandée), coût et budget,
rotation du tour, élimination sur mauvaise réponse, score sur bonne réponse,
fin de partie, et étanchéité de player_secrets.

Depuis 0014, le premier joueur est désigné par un lancer de dé (aléatoire) : le
scénario est écrit en RÔLES (role1 = qui commence, role2 = suivant dans la rotation,
role3 = dernier), résolus dynamiquement après start_game plutôt que fixés sur
Alice/Bob/Chloe. Les pays restent attachés à l'IDENTITÉ (Alice=FRANCE, etc.), les
rôles décrivent seulement l'ORDRE DE JEU.

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
print("3 sessions anonymes créées\n")

# --- création + jointures. total_rounds=1 pour atteindre la victoire vite.
g = rpc("create_game", tok[0], {"p_nickname": "Alice", "p_total_rounds": 1})
code, gid = g["code"], g["id"]
print(f"Partie #{code}")
for i, name in [(1, "Bob"), (2, "Chloe")]:
    rpc("join_game", tok[i], {"p_code": code, "p_nickname": name})

NAME_BY_IDX = {0: "Alice", 1: "Bob", 2: "Chloe"}
TOK_BY_NAME = {"Alice": tok[0], "Bob": tok[1], "Chloe": tok[2]}
COUNTRY = {"Alice": "FRANCE", "Bob": "JAPON", "Chloe": "BRESIL"}

# --- chacun choisit son pays
for i in range(3):
    rpc("pick_country", tok[i], {"p_game_id": gid, "p_country": COUNTRY[NAME_BY_IDX[i]]})

players = sel(f"players?game_id=eq.{gid}&select=id,nickname,seat,masked,region,is_cracked,is_eliminated,score,letters_left,asked_letters&order=seat", tok[0])
pid = {p["nickname"]: p["id"] for p in players}
print("Masques initiaux :", {p["nickname"]: p["masked"] for p in players})
check("le pays est masqué au départ", all(set(p["masked"]) == {"_"} for p in players))
check("la région est publique", all(p["region"] for p in players))

# --- le pays des autres est-il vraiment inaccessible ?
leak = sel("player_secrets?select=*", tok[1])
# 401 ou 403 : dans les deux cas le client est bloqué (403 = interdit franc).
check("player_secrets est inaccessible au client", isinstance(leak, dict) and "__error" in leak, leak)

# --- lancement (hôte = Alice). Chacun lance le dé (0014) avant que start_game accepte.
for t in tok: rpc("roll_dice", t, {"p_game_id": gid})
r = rpc("start_game", tok[0], {"p_game_id": gid})
check("start_game réussit", r and "__error" not in r, r)
game = sel(f"games?id=eq.{gid}&select=status,round,current_player_id", tok[0])[0]
check("la partie est en cours", game["status"] == "playing", game)

# --- Rôles = ordre de jeu réel, déterminé par le dé + la rotation par seat. Le dé
# choisit QUI COMMENCE (rôle1) ; rôle2 et rôle3 suivent dans l'ordre des sièges.
seat_order = [p["nickname"] for p in players]  # déjà trié par seat
start_idx = next(i for i, n in enumerate(seat_order) if pid[n] == game["current_player_id"])
role1, role2, role3 = [seat_order[(start_idx + k) % 3] for k in range(3)]
print(f"Le dé désigne {role1} pour commencer. Ordre de jeu : {role1} -> {role2} -> {role3}")
check("le tour est attribué au gagnant du dé", game["current_player_id"] == pid[role1], game)

# --- un joueur hors tour est refusé
r = rpc("ask_letter", TOK_BY_NAME[role2], {"p_target_player_id": pid[role1], "p_letter": "A"})
check("hors tour -> refusé", r.get("__error", {}).get("message") == "not your turn", r)

print("\n--- VALIDATION DE LETTRE")
# role1 interroge role2. La 1ère lettre de son pays est forcément présente ;
# 'X' n'apparaît dans aucun des 3 pays de test, donc forcément absente.
letter_present = COUNTRY[role2][0]
r = rpc("ask_letter", TOK_BY_NAME[role1], {"p_target_player_id": pid[role2], "p_letter": letter_present})
check("lettre présente -> found=true", r is True, r)
p2 = sel(f"players?id=eq.{pid[role2]}&select=masked,asked_letters", TOK_BY_NAME[role1])[0]
check(f"le masque de {role2} révèle {letter_present}", letter_present in p2["masked"], p2)

game = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
check(f"le tour est passé à {role2}", game["current_player_id"] == pid[role2], game)

# role2 interroge role3 avec une lettre absente.
r = rpc("ask_letter", TOK_BY_NAME[role2], {"p_target_player_id": pid[role3], "p_letter": "X"})
check("lettre absente -> found=false", r is False, r)
p3 = sel(f"players?id=eq.{pid[role3]}&select=masked,asked_letters", TOK_BY_NAME[role2])[0]
check(f"le masque de {role3} ne bouge pas", set(p3["masked"].replace(" ", "")) <= {"_"}, p3)
check("la lettre absente est mémorisée", "X" in p3["asked_letters"], p3)

# role3 redemande la même lettre sur role2 (déjà demandée) -> refusé.
r = rpc("ask_letter", TOK_BY_NAME[role3], {"p_target_player_id": pid[role2], "p_letter": letter_present})
check("lettre déjà demandée -> refusée", "already asked" in str(r), r)
# role3 joue un coup valide pour rendre la main (2e lettre du pays de role2).
rpc("ask_letter", TOK_BY_NAME[role3], {"p_target_player_id": pid[role2], "p_letter": COUNTRY[role2][1]})

p1 = sel(f"players?id=eq.{pid[role1]}&select=score,letters_left", TOK_BY_NAME[role1])[0]
check("la question coûte 50 pts", p1["score"] == -50, p1)
check("le budget de lettres décroît", p1["letters_left"] == 5, p1)

print("\n--- ÉLIMINATION")
game = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
check(f"retour au tour de {role1}", game["current_player_id"] == pid[role1], game)
r = rpc("submit_guess", TOK_BY_NAME[role1], {"p_target_player_id": pid[role2], "p_guess": "ANTARCTIQUE"})
check("mauvaise réponse -> correct=false", r.get("correct") is False, r)
check("mauvaise réponse : -100 pts annoncés", r.get("points") == -100, r)
p1 = sel(f"players?id=eq.{pid[role1]}&select=is_eliminated,score", TOK_BY_NAME[role1])[0]
check("le joueur est éliminé", p1["is_eliminated"] is True, p1)
check("il perd 100 pts", p1["score"] == -150, p1)

game = sel(f"games?id=eq.{gid}&select=current_player_id", tok[0])[0]
check("le tour saute le joueur éliminé", game["current_player_id"] != pid[role1], game)
check(f"le tour va à {role2}", game["current_player_id"] == pid[role2], game)

r = rpc("ask_letter", TOK_BY_NAME[role1], {"p_target_player_id": pid[role2], "p_letter": "K"})
check("un éliminé ne peut plus jouer", "not your turn" in str(r), r)

print("\n--- BONNE RÉPONSE & VICTOIRE")
# role2 devine le pays de role3, puis role3 devine celui de role2 -> plus de cible active.
r = rpc("submit_guess", TOK_BY_NAME[role2], {"p_target_player_id": pid[role3], "p_guess": COUNTRY[role3]})
check("bonne réponse -> correct=true", r.get("correct") is True, r)
check("le pays est renvoyé pour la célébration", r.get("country") == COUNTRY[role3], r)
check("les points sont annoncés par le serveur", r.get("points") == 500 + 100 * 5, r)
p3 = sel(f"players?id=eq.{pid[role3]}&select=is_cracked,masked", TOK_BY_NAME[role2])[0]
check("le pays trouvé est révélé", p3["masked"] == COUNTRY[role3] and p3["is_cracked"], p3)
p2 = sel(f"players?id=eq.{pid[role2]}&select=score", TOK_BY_NAME[role2])[0]
check("bonne réponse : +500 +100/lettre restante", p2["score"] == -50 + 500 + 100 * 5, p2)

r = rpc("submit_guess", TOK_BY_NAME[role3], {"p_target_player_id": pid[role2], "p_guess": COUNTRY[role2]})
check(f"bonne réponse sur {role2} -> correct=true", r.get("correct") is True, r)

# Le pays de role1 (éliminé) reste à trouver : être éliminé ne met pas son pays à l'abri.
game = sel(f"games?id=eq.{gid}&select=status", tok[0])[0]
check("la partie continue tant qu'un pays est inconnu", game["status"] == "playing", game)

# role2 trouve le dernier pays (celui de role1, éliminé) -> plus rien à deviner.
r = rpc("submit_guess", TOK_BY_NAME[role2], {"p_target_player_id": pid[role1], "p_guess": COUNTRY[role1]})
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
if all(k in (byname.get(role2) or {}) for k in ("found_count", "guess_count", "letters_count")):
    b = byname[role2]
    check(f"{role2} a 2 pays trouvés (compteur partie)", b["found_count"] == 2, b)
    check(f"les questions de {role2} sont comptées", b["letters_count"] >= 1, b)
    a = byname[role1]
    check(f"la tentative ratée de {role1} est comptée", a["guess_count"] >= 1, a)
else:
    check("compteurs de partie présents (migration 0010)", False, "colonnes absentes — applique 0010")

print("\n--- PROFIL & DÉCOUVERTES")
st = sel("player_stats?select=*", TOK_BY_NAME[role2])
check(f"les stats de {role2} existent", isinstance(st, list) and len(st) == 1, st)
if isinstance(st, list) and st:
    b = st[0]
    check("2 bonnes réponses comptées", b["correct_guesses"] == 2, b)
    check("1 partie jouée", b["games_played"] == 1, b)
    check(f"{role2} a gagné", b["wins"] == 1, b)

disc = sel("discoveries?select=country,times&order=country", TOK_BY_NAME[role2])
check(f"{role2} a découvert {COUNTRY[role3]} et {COUNTRY[role1]}",
      sorted(d["country"] for d in disc) == sorted([COUNTRY[role3], COUNTRY[role1]]), disc)

# Étanchéité : role1 n'a fait aucune bonne réponse dans ce scénario -> aucune découverte.
role1_view = sel("discoveries?select=country", TOK_BY_NAME[role1])
check(f"{role1} n'a aucune découverte propre (et ne voit pas celles de {role2})",
      role1_view == [], role1_view)

print("\n" + ("TOUT PASSE" if ok else "DES TESTS ÉCHOUENT"))
sys.exit(0 if ok else 1)
