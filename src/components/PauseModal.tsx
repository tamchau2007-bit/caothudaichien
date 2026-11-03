/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Play, RotateCcw, Sliders, Home } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onReturnTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onOpenSettings,
  onReturnTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 select-none animate-in fade-in duration-150">
      <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700/80 p-6 text-white text-center shadow-2xl">
        <h2 className="text-2xl font-black font-serif text-amber-400 tracking-wider mb-1">
          TẠM DỪNG TRẬN ĐẤU
        </h2>
        <p className="text-xs text-zinc-400 font-mono mb-6">Nhấn Esc hoặc P để tiếp tục</p>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm tracking-wide transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" /> Tiếp Tục Trận Đấu
          </button>

          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm tracking-wide transition cursor-pointer border border-zinc-700"
          >
            <RotateCcw className="w-4 h-4" /> Bắt Đầu Lại (Restart)
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm tracking-wide transition cursor-pointer border border-zinc-700"
          >
            <Sliders className="w-4 h-4" /> Cài Đặt Trận Đấu
          </button>

          <button
            onClick={onReturnTitle}
            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-semibold text-sm tracking-wide transition cursor-pointer border border-rose-800/40"
          >
            <Home className="w-4 h-4" /> Về Menu Chính
          </button>
        </div>
      </div>
    </div>
  );
};
