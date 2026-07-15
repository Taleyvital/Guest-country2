// Edge Function : envoie un push "C'est ton tour" au joueur qui vient d'obtenir le tour.
//
// Déclenchée par le trigger `on_turn_change` (voir 0008_push_subscriptions.sql), qui
// poste { game_id, current_player_id }. On résout le user_id du joueur, on récupère
// ses abonnements push et on envoie à chacun.
//
// Déploiement :
//   supabase functions deploy notify-turn-change --no-verify-jwt
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:toi@exemple.com
//
// (--no-verify-jwt : c'est le trigger DB, avec la clé de service, qui appelle — pas un
//  utilisateur porteur d'un JWT.)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  try {
    const { current_player_id } = await req.json();
    if (!current_player_id) {
      return new Response("no player", { status: 200 });
    }

    // Qui a le tour ?
    const { data: player } = await supabase
      .from("players")
      .select("user_id, nickname")
      .eq("id", current_player_id)
      .single();

    if (!player) return new Response("player not found", { status: 200 });

    // Ses abonnements (un par appareil).
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, subscription")
      .eq("user_id", player.user_id);

    if (!subs || subs.length === 0) {
      return new Response("no subscription", { status: 200 });
    }

    const payload = JSON.stringify({
      title: "Country Guess",
      body: "C'est ton tour de jouer !",
      tag: "your-turn",
      url: "/",
    });

    await Promise.all(
      subs.map(async (row) => {
        try {
          await webpush.sendNotification(row.subscription, payload);
        } catch (err) {
          // 404/410 = abonnement expiré ou révoqué : on le purge pour ne pas
          // réessayer indéfiniment.
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint);
          }
        }
      }),
    );

    return new Response("ok", { status: 200 });
  } catch (e) {
    // Un push est un bonus : on répond 200 même en cas d'erreur, pour ne pas faire
    // ré-essayer pg_net en boucle.
    console.error("notify-turn-change:", e);
    return new Response("error", { status: 200 });
  }
});
