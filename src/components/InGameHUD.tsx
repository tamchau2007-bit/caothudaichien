/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FighterEntity, GameMode } from '../game/types';
import { Volume2, VolumeX, Pause, Settings, HelpCircle, Swords } from 'lucide-react';
import { sound } from '../game/sound';

interface InGameHUDProps {
  p1: FighterEntity;
  p2: FighterEntity;
  roundTime: number;
  mode: GameMode;
  roomCode?: string;
  netInfo?: { ping: number; rollback: number; predicted: number; delay: number } | null;
  onPause: () => void;
  onOpenSettings: () => void;
}

export const InGameHUD: React.FC<InGameHUDProps> = ({
  p1,
  p2,
  roundTime,
  mode,
  roomCode,
  netInfo,
  onPause,
  onOpenSettings,
}) => {
  const [isMuted, setIsMuted] = useState(sound.isMuted);
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const toggleSound = () => {
    sound.isMuted = !sound.isMuted;
    setIsMuted(sound.isMuted);
  };

  const p1HpPercent = Math.max(0, Math.min(100, (p1.hp / p1.character.maxHp) * 100));
  const p2HpPercent = Math.max(0, Math.min(100, (p2.hp / p2.character.maxHp) * 100));

  const p1StaPercent = Math.max(0, Math.min(100, (p1.stamina / p1.character.maxStamina) * 100));
  const p2StaPercent = Math.max(0, Math.min(100, (p2.stamina / p2.character.maxStamina) * 100));

  const getHpColor = (percent: number) => {
    if (percent > 50) return 'bg-emerald-500';
    if (percent > 20) return 'bg-amber-400';
    return 'bg-rose-500 animate-pulse';
  };

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-3 sm:p-6 overflow-hidden">
      {/* Top Header Cluster: Health, Stamina, Avatars, Timer, Ping */}
      <div className="w-full flex items-start justify-between gap-2 sm:gap-6">
        {/* PLAYER 1 STATUS (Left) */}
        <div className="flex-1 max-w-sm sm:max-w-md pointer-events-auto">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black font-serif text-white text-lg shadow-lg border-2 border-amber-400"
              style={{ backgroundColor: p1.character.colorTheme.primary }}
            >
              {p1.character.name.charAt(0)}
            </div>
            <div className="truncate">
              <div className="text-white font-black text-sm sm:text-base font-serif tracking-wide truncate">
                {p1.character.name}
              </div>
              <div className="text-[10px] text-amber-300 font-semibold tracking-wider uppercase">
                {p1.character.archetype}
              </div>
            </div>
          </div>

          {/* P1 HP Bar */}
          <div className="relative h-5 sm:h-6 w-full rounded-md bg-zinc-950/80 border border-zinc-700/80 overflow-hidden shadow-inner mb-1">
            <div
              className={`h-full transition-all duration-100 ${getHpColor(p1HpPercent)}`}
              style={{ width: `${p1HpPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] sm:text-xs font-mono font-bold text-white drop-shadow">
              <span>HP</span>
              <span className="tabular-nums">
                {Math.round(p1.hp)} / {p1.character.maxHp}
              </span>
            </div>
          </div>

          {/* P1 Stamina Bar */}
          <div className="relative h-2.5 sm:h-3 w-full rounded bg-zinc-950/80 border border-zinc-700/80 overflow-hidden mb-1">
            <div
              className={`h-full transition-all duration-75 ${
                p1.stamina < 15 ? 'bg-rose-500 animate-pulse' : 'bg-cyan-400'
              }`}
              style={{ width: `${p1StaPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-end px-1.5 text-[8px] font-mono text-zinc-300 font-bold">
              <span className="tabular-nums">{Math.round(p1.stamina)} STA</span>
            </div>
          </div>

          {/* P1 Gimmick Badge */}
          {p1.character.id === 'hoang_saigon' && p1.hoangScaleBonus > 1.0 && (
            <div className="text-[10px] font-mono text-amber-300 font-bold">
              NÉN MỠ: +{Math.round((p1.hoangScaleBonus - 1) * 100)}% KÍCH CỠ · +{Math.round(p1.hoangArmorBonus * 100)}% GIÁP
            </div>
          )}
          {p1.character.id === 'le_dao' && (
            <div className="text-[10px] font-mono text-amber-300 font-bold">
              CỐT KHẢI: {p1.ribBonesAvailable}/12 XƯƠNG SƯỜN
            </div>
          )}
          {p1.character.id === 'hoang_xitrum' && (
            <div className="text-[10px] font-mono text-emerald-300 font-bold">
              PET MÈO: TRỢ CHIẾN SÀN ĐẤU
            </div>
          )}
          {p1.poisonClawStacks > 0 && (
            <div className="text-[10px] font-mono text-purple-300 font-bold animate-pulse">
              DÍNH VẾT CÀO ĐỘC: {p1.poisonClawStacks}/5 爪 (5 ĐÒN = NỔ 100 DMG!)
            </div>
          )}
          {p1.wibuStacks > 0 && (
            <div className="text-[10px] font-mono text-pink-300 font-bold">
              DÍNH MÊ MUỘI WAIFU: {p1.wibuStacks}/5 ♥
            </div>
          )}
        </div>

        {/* CENTER CLUSTER: TIMER & MATCH METRICS */}
        <div className="flex flex-col items-center justify-center pointer-events-auto">
          {/* Round Timer */}
          <div className="px-3.5 sm:px-5 py-1 sm:py-1.5 rounded-xl bg-zinc-950/95 border border-amber-500/60 shadow-[0_0_20px_rgba(0,0,0,0.8)] text-center">
            <span className="text-2xl sm:text-4xl font-black font-mono text-amber-400 tabular-nums drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]">
              {mode === 'training' ? '∞' : Math.ceil(roundTime)}
            </span>
          </div>

          {/* Network / Mode info */}
          <div className="flex items-center gap-2 mt-1 px-2 py-0.5 rounded bg-zinc-950/80 border border-zinc-800 font-mono text-[9px] sm:text-[10px] text-zinc-300">
            <span>FPS: 60</span>
            <span>·</span>
            {roomCode ? (
              <span className="text-amber-400 font-bold">PHÒNG: {roomCode}</span>
            ) : (
              <span className="uppercase text-amber-300/90">{mode}</span>
            )}
            {netInfo && (
              <>
                <span>·</span>
                <span
                  className={
                    netInfo.ping > 140
                      ? 'text-rose-400 font-bold'
                      : netInfo.ping > 80
                        ? 'text-amber-300'
                        : 'text-emerald-400'
                  }
                >
                  {netInfo.ping}ms
                </span>
                <span>·</span>
                <span className="text-cyan-300">RB {netInfo.rollback}</span>
                <span>·</span>
                <span className="text-zinc-400">DL {netInfo.delay}f</span>
              </>
            )}
          </div>
        </div>

        {/* PLAYER 2 STATUS (Right) */}
        <div className="flex-1 max-w-sm sm:max-w-md pointer-events-auto text-right">
          <div className="flex items-center justify-end gap-2 mb-1.5">
            <div className="truncate">
              <div className="text-white font-black text-sm sm:text-base font-serif tracking-wide truncate">
                {p2.character.name}
              </div>
              <div className="text-[10px] text-cyan-300 font-semibold tracking-wider uppercase">
                {mode === 'ai' ? 'MÁY (BOT)' : p2.character.archetype}
              </div>
            </div>
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-black font-serif text-white text-lg shadow-lg border-2 border-cyan-400"
              style={{ backgroundColor: p2.character.colorTheme.primary }}
            >
              {p2.character.name.charAt(0)}
            </div>
          </div>

          {/* P2 HP Bar */}
          <div className="relative h-5 sm:h-6 w-full rounded-md bg-zinc-950/80 border border-zinc-700/80 overflow-hidden shadow-inner mb-1">
            <div
              className={`h-full float-right transition-all duration-100 ${getHpColor(p2HpPercent)}`}
              style={{ width: `${p2HpPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-between px-2 text-[10px] sm:text-xs font-mono font-bold text-white drop-shadow">
              <span className="tabular-nums">
                {Math.round(p2.hp)} / {p2.character.maxHp}
              </span>
              <span>HP</span>
            </div>
          </div>

          {/* P2 Stamina Bar */}
          <div className="relative h-2.5 sm:h-3 w-full rounded bg-zinc-950/80 border border-zinc-700/80 overflow-hidden mb-1">
            <div
              className={`h-full float-right transition-all duration-75 ${
                p2.stamina < 15 ? 'bg-rose-500 animate-pulse' : 'bg-cyan-400'
              }`}
              style={{ width: `${p2StaPercent}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-start px-1.5 text-[8px] font-mono text-zinc-300 font-bold">
              <span className="tabular-nums">{Math.round(p2.stamina)} STA</span>
            </div>
          </div>

          {/* P2 Gimmick Badge */}
          {p2.character.id === 'hoang_saigon' && p2.hoangScaleBonus > 1.0 && (
            <div className="text-[10px] font-mono text-amber-300 font-bold">
              NÉN MỠ: +{Math.round((p2.hoangScaleBonus - 1) * 100)}% SIZE · +{Math.round(p2.hoangArmorBonus * 100)}% GIÁP
            </div>
          )}
          {p2.character.id === 'le_dao' && (
            <div className="text-[10px] font-mono text-amber-300 font-bold">
              CỐT KHẢI: {p2.ribBonesAvailable}/12 XƯƠNG
            </div>
          )}
          {p2.poisonClawStacks > 0 && (
            <div className="text-[10px] font-mono text-purple-300 font-bold animate-pulse">
              DÍNH VẾT CÀO ĐỘC: {p2.poisonClawStacks}/5 爪 (5 ĐÒN = NỔ 100 DMG!)
            </div>
          )}
          {p2.wibuStacks > 0 && (
            <div className="text-[10px] font-mono text-pink-300 font-bold">
              DÍNH MÊ MUỘI WAIFU: {p2.wibuStacks}/5 ♥
            </div>
          )}
        </div>
      </div>

      {/* MID VIEWPORT: COMBO COUNTERS (Floating & Low-Occlusion) */}
      <div className="w-full flex items-center justify-between px-4 sm:px-12 my-auto">
        {/* P1 Combo Counter */}
        {p1.comboHits >= 2 && p1.comboTimer > 0 && (
          <div className="flex flex-col items-start animate-bounce">
            <div className="text-xl sm:text-3xl font-black font-mono text-amber-400 tracking-wider drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]">
              COMBO {p1.comboHits} HITS!
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-rose-400 drop-shadow">
              {p1.comboDamage} SÁT THƯƠNG
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* P2 Combo Counter */}
        {p2.comboHits >= 2 && p2.comboTimer > 0 && (
          <div className="flex flex-col items-end animate-bounce">
            <div className="text-xl sm:text-3xl font-black font-mono text-cyan-400 tracking-wider drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
              COMBO {p2.comboHits} HITS!
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-rose-400 drop-shadow">
              {p2.comboDamage} SÁT THƯƠNG
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM UTILITY & QUICK SKILL CHEAT SHEET */}
      <div className="w-full flex items-end justify-between gap-3 pointer-events-auto">
        {/* Left: Quick 8-Skill Combos Cheat Sheet Button / Box */}
        <div className="flex flex-col items-start">
          {showCheatSheet && (
            <div className="p-3 mb-2 rounded-xl bg-zinc-950/95 border border-amber-500/40 text-xs font-mono shadow-2xl space-y-1 w-72 sm:w-80 animate-in fade-in">
              <div className="font-bold text-amber-400 uppercase text-[11px] mb-1">
                Tổ Hợp 8 Kỹ Năng ({p1.character.name}):
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                <div><span className="text-amber-300 font-bold">J:</span> Đánh thường (0s)</div>
                <div><span className="text-amber-300 font-bold">U:</span> Chiêu 1 (10s)</div>
                <div><span className="text-amber-300 font-bold">I:</span> Chiêu 2 Nặng (15s)</div>
                <div><span className="text-amber-300 font-bold">S+U:</span> Chiêu 3 Thủ/Phản</div>
                <div><span className="text-amber-300 font-bold">S+I:</span> Chiêu 4 Quét Sàn</div>
                <div><span className="text-amber-300 font-bold">W+U:</span> Chiêu 5 Buff Khí</div>
                <div><span className="text-amber-300 font-bold">W+I:</span> Chiêu 6 Bẫy/Kéo</div>
                <div><span className="text-amber-300 font-bold">S+J:</span> Chiêu 7 Lao/Vật</div>
              </div>
              <div className="pt-1 border-t border-zinc-800 text-rose-400 font-bold text-[11px]">
                W + J: Tuyệt Chiêu Tối Thượng (Ulti - 60 Sta)
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCheatSheet(!showCheatSheet)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              {showCheatSheet ? 'Đóng Bảng Chiêu' : 'Xem 8 Chiêu [H]'}
            </button>
            <span className="text-zinc-400 text-[11px] font-mono hidden md:inline">
              K: Nhảy · S+K: Tụt Bục · L: Lướt (Lùi/Tiến) · J: Combo 3 Đòn · Giữ W: Hồi HP/Sta
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons (Mute, Pause, Settings) */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            aria-label="Mute Audio"
            className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>
          <button
            onClick={onPause}
            aria-label="Tạm Dừng"
            className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition cursor-pointer"
          >
            <Pause className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={onOpenSettings}
            aria-label="Cài Đặt"
            className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
