"use client";

// Page de test locale (à supprimer) : monte le vrai composant Hand avec des
// cartes factices pour vérifier le glisser-déposer sans partie Supabase.
import { CardBack } from "@/games/8-americain/components/CardBack";
import { DiscardPile } from "@/games/8-americain/components/DiscardPile";
import { Hand } from "@/games/8-americain/components/Hand";

export default function DevHandPage() {
  return (
    <main className="flex min-h-dvh flex-col justify-end gap-8 bg-surface-container-low pb-4">
      <div className="flex items-center justify-center gap-6">
        <CardBack />
        <DiscardPile topCard="D:K" currentColor="D" />
      </div>
      <Hand
        cards={["S:J", "H:9", "C:5", "D:10", "S:A", "H:Q", "C:8", "D:2", "S:K"]}
        isMyTurn={true}
        currentColor="H"
        topCard="H:7"
        onPlay={() => {}}
      />
    </main>
  );
}