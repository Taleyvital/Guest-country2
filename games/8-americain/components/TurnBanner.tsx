"use client";

export function TurnBanner({ isMyTurn, currentName }: { isMyTurn: boolean; currentName: string }) {
  return (
    <div className="flex justify-center">
      <div className="flex items-center gap-3 rounded-full bg-accent px-6 py-3 text-label-lg text-white shadow-btn-3d">
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
        <span className="text-center uppercase tracking-wide">
          {isMyTurn ? "À ton tour" : `Tour de ${currentName}`}
        </span>
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </div>
    </div>
  );
}
