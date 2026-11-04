/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FighterEntity } from '../game/types';
import { Trophy, RotateCcw, Home, Sparkles } from 'lucide-react';

interface GameOverModalProps {
  winner: 'p1' | 'p2' | 'draw';
  winQuote: string;
  p1: FighterEntity;
  p2: FighterEntity;
  onRestart: () => void;
  onReturnTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  winner,
  winQuote,
  p1,
  p2,
  onRestart,
  onReturnTitle,
}) => {
  const winnerEntity = winner === 'p1' ? p1 : winner === 'p2' ? p2 : null;
  const isP1Winner = winner === 'p1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl glass-panel animate-pop-in border-amber-500/50 p-6 text-white text-center shadow-[0_0_60px_rgba(245,158,11,0.28)]">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-amber-500/20 blur-3xl" />
        {/* Crest Trophy Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-amber-500/15 border-2 border-amber-400 flex items-center justify-center mb-3 shadow-lg animate-pulse-ring">
          <Trophy className="w-9 h-9 text-amber-400" />
        </div>

        {/* Title */}
        <h2 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-b from-amber-100 via-amber-300 to-orange-500 bg-clip-text text-transparent mb-1">
          {winner === 'draw' ? 'BẤT PHÂN THẮNG BẠI' : `${winnerEntity?.character.name.toUpperCase()} THẮNG!`}
        </h2>
        <div className="text-xs text-zinc-400 font-semibold tracking-widest uppercase mb-4">
          KẾT QUẢ ĐẠI HỘI VÕ LÂM
        </div>

        {/* Victory Quote Card */}
        {winQuote && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 mb-5 text-amber-200 font-serif italic text-sm sm:text-base leading-relaxed">
            "{winQuote}"
          </div>
        )}

        {/* Match Statistics */}
        <div className="grid grid-cols-2 gap-2.5 mb-6 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-left">
            <span className="text-zinc-500 text-[10px] block">P1 ({p1.character.name})</span>
            <div className="text-emerald-400 font-bold text-sm">
              {Math.max(0, Math.round(p1.hp))} HP
            </div>
            <span className="text-zinc-400 text-[10px] block">
              Sát thương: {p1.totalDamageDealt} DMG
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-right">
            <span className="text-zinc-500 text-[10px] block">P2 ({p2.character.name})</span>
            <div className="text-cyan-400 font-bold text-sm">
              {Math.max(0, Math.round(p2.hp))} HP
            </div>
            <span className="text-zinc-400 text-[10px] block">
              Sát thương: {p2.totalDamageDealt} DMG
            </span>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            data-start="true"
            onClick={onRestart}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 font-black text-sm tracking-wide font-serif hover:brightness-110 active:scale-95 transition cursor-pointer shadow-lg"
          >
            <RotateCcw className="w-4 h-4" /> Đấu Lại
          </button>
          <button
            onClick={onReturnTitle}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold text-sm tracking-wide transition cursor-pointer border border-zinc-700"
          >
            <Home className="w-4 h-4" /> Về Menu
          </button>
        </div>
      </div>
    </div>
  );
};
