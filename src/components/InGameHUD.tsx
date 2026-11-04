/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FighterEntity, GameMode } from '../game/types';
import {
  Volume2,
  VolumeX,
  Pause,
  Settings,
  HelpCircle,
  Swords,
  Heart,
  Zap,
  Wifi,
  Timer,
} from 'lucide-react';
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

interface StatusLine {
  text: string;
  tone: string;
}

const toneClasses: Record<string, string> = {
  amber: 'border-amber-400/40 bg-amber-500/10 text-amber-200',
  cyan: 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200',
  violet: 'border-violet-400/40 bg-violet-500/10 text-violet-200',
  rose: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
  emerald: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
};

const FighterCard: React.FC<{ f: FighterEntity; side: 'left' | 'right' }> = ({ f, side }) => {
  const hpPercent = Math.max(0, Math.min(100, (f.hp / f.character.maxHp) * 100));
  const staPercent = Math.max(0, Math.min(100, (f.stamina / f.character.maxStamina) * 100));
  const lowHp = hpPercent <= 25;
  const isRight = side === 'right';

  const statuses: StatusLine[] = [];
  if (f.character.id === 'hoang_saigon' && f.hoangScaleBonus > 1.0) {
    statuses.push({
      text: `NÉN MỠ +${Math.round((f.hoangScaleBonus - 1) * 100)}% · GIÁP +${Math.round(f.hoangArmorBonus * 100)}%`,
      tone: 'amber',
    });
  }
  if (f.character.id === 'le_dao') {
    statuses.push({ text: `CỐT KHẢI ${f.ribBonesAvailable}/12`, tone: 'amber' });
  }
  if (f.character.id === 'hung_chimbay' && f.airDriftCharge > 0) {
    statuses.push({ text: `CÁNH ĐẠI BÀNG ${Math.round(f.airDriftCharge)}%`, tone: 'emerald' });
  }
  if (f.character.id === 'hoang_xitrum') {
    statuses.push({ text: 'MÈO TRỢ CHIẾN', tone: 'emerald' });
  }
  if (f.poisonClawStacks > 0) {
    statuses.push({ text: `VUỐT ĐỘC ${f.poisonClawStacks}/5`, tone: 'violet' });
  }
  if (f.wibuStacks > 0) {
    statuses.push({ text: `MÊ MUỘI ${f.wibuStacks}/5`, tone: 'rose' });
  }
  if (f.beatboxFlowActive) {
    statuses.push({ text: 'BEATBOX FLOW', tone: 'cyan' });
  }
  if (f.shadowClonesCount > 0) {
    statuses.push({ text: `PHÂN THÂN ×${f.shadowClonesCount}`, tone: 'violet' });
  }

  return (
    <div className={`flex-1 max-w-[30rem] pointer-events-auto ${isRight ? 'text-right' : ''}`}>
      <div className={`flex items-center gap-2.5 mb-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
        <div
          className="relative w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl text-white border-2 shadow-[0_0_22px_rgba(0,0,0,0.65)]"
          style={{
            backgroundColor: f.character.colorTheme.primary,
            borderColor: f.character.colorTheme.spark,
            boxShadow: `0 0 26px ${f.character.colorTheme.spark}55`,
          }}
        >
          <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]">{f.character.name.charAt(0)}</span>
          <span
            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-zinc-950 flex items-center justify-center"
            style={{ backgroundColor: f.character.colorTheme.secondary }}
          >
            <Swords className="w-2 h-2 text-zinc-950" />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className={`flex items-baseline gap-2 ${isRight ? 'justify-end' : ''}`}>
            <span className="text-white font-black text-sm sm:text-lg tracking-wide truncate drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
              {f.character.name}
            </span>
            <span className="hidden sm:inline text-[9px] uppercase tracking-[0.18em] text-zinc-400 font-bold truncate">
              {f.character.archetype}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 mt-0.5 ${isRight ? 'justify-end' : ''}`}>
            <Heart className={`w-3 h-3 ${lowHp ? 'text-rose-400 animate-pulse' : 'text-rose-300/70'}`} />
            <span className="text-[10px] sm:text-[11px] font-mono font-bold text-zinc-200 tabular-nums">
              {Math.round(f.hp)}
              <span className="text-zinc-500"> / {f.character.maxHp}</span>
            </span>
          </div>
        </div>
      </div>

      {/* HP BAR: slow "ghost" trail + fast main bar */}
      <div
        className={`relative h-5 sm:h-6 w-full rounded-lg overflow-hidden border shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)] ${
          lowHp ? 'border-rose-400/70 animate-lowhp' : 'border-zinc-700/80'
        }`}
        style={{ backgroundColor: 'rgba(9, 9, 18, 0.92)' }}
      >
        <div
          className="absolute inset-y-0 bg-gradient-to-r from-rose-500/70 to-amber-300/60 transition-[width] duration-700 ease-out"
          style={{ width: `${hpPercent}%`, [isRight ? 'right' : 'left']: 0 } as React.CSSProperties}
        />
        <div
          className={`absolute inset-y-0 transition-[width] duration-100 ease-linear ${
            hpPercent > 50
              ? 'bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300'
              : hpPercent > 20
                ? 'bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300'
                : 'bg-gradient-to-r from-rose-700 via-rose-500 to-rose-400'
          }`}
          style={{
            width: `${hpPercent}%`,
            [isRight ? 'right' : 'left']: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -6px 10px rgba(0,0,0,0.35)',
          } as React.CSSProperties}
        />
        {/* Segment ticks */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.55) 0 1px, rgba(0,0,0,0) 1px 12.5%)',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
      </div>

      {/* STAMINA */}
      <div className="relative h-2 sm:h-2.5 w-full rounded-full mt-1 overflow-hidden border border-cyan-500/25 bg-zinc-950/85">
        <div
          className={`absolute inset-y-0 transition-[width] duration-150 ease-out ${
            f.stamina < 15
              ? 'bg-gradient-to-r from-rose-600 to-rose-400'
              : 'bg-gradient-to-r from-sky-500 via-cyan-400 to-teal-300'
          }`}
          style={{ width: `${staPercent}%`, [isRight ? 'right' : 'left']: 0 } as React.CSSProperties}
        />
        <div className="absolute inset-0 flex items-center px-1.5">
          <span className={`flex items-center gap-1 text-[8px] font-mono font-bold text-cyan-100/90 ${isRight ? 'ml-auto' : ''}`}>
            <Zap className="w-2.5 h-2.5" />
            {Math.round(f.stamina)}
          </span>
        </div>
      </div>

      {statuses.length > 0 && (
        <div className={`mt-1.5 flex flex-wrap gap-1 ${isRight ? 'justify-end' : ''}`}>
          {statuses.slice(0, 3).map((s) => (
            <span
              key={s.text}
              className={`px-1.5 py-[2px] rounded-md border text-[8px] sm:text-[9px] font-mono font-bold tracking-wide ${
                toneClasses[s.tone] || toneClasses.amber
              }`}
            >
              {s.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

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

  const timeLeft = Math.ceil(roundTime);
  const urgent = mode !== 'training' && timeLeft <= 10;

  const pingTone = !netInfo
    ? 'text-zinc-400'
    : netInfo.ping > 140
      ? 'text-rose-400'
      : netInfo.ping > 80
        ? 'text-amber-300'
        : 'text-emerald-400';

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-20 flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* TOP: fighters + timer */}
      <div className="w-full flex items-start justify-between gap-2 sm:gap-5">
        <FighterCard f={p1} side="left" />

        <div className="flex flex-col items-center gap-1 shrink-0">
          <div
            className={`relative px-3.5 sm:px-5 py-1 rounded-2xl border backdrop-blur-md ${
              urgent
                ? 'border-rose-400/80 bg-rose-950/70 shadow-[0_0_30px_rgba(244,63,94,0.5)]'
                : 'border-amber-400/50 bg-zinc-950/80 shadow-[0_0_24px_rgba(0,0,0,0.7)]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Timer className={`w-3.5 h-3.5 ${urgent ? 'text-rose-300' : 'text-amber-400/80'}`} />
              <span
                className={`text-2xl sm:text-4xl font-black font-mono tabular-nums leading-none ${
                  urgent
                    ? 'text-rose-300 animate-pulse drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                    : 'text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                }`}
              >
                {mode === 'training' ? '∞' : timeLeft}
              </span>
            </div>
            <div className="absolute inset-x-2 -bottom-[3px] h-[3px] rounded-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-950/85 border border-zinc-700/70 backdrop-blur-sm font-mono text-[8px] sm:text-[9px] text-zinc-300">
            {roomCode ? (
              <span className="text-amber-300 font-bold tracking-wider">PHÒNG {roomCode}</span>
            ) : (
              <span className="uppercase text-amber-200/90 tracking-wider">{mode}</span>
            )}
            {netInfo && (
              <>
                <span className="text-zinc-600">|</span>
                <span className={`flex items-center gap-0.5 font-bold ${pingTone}`}>
                  <Wifi className="w-2.5 h-2.5" />
                  {netInfo.ping}ms
                </span>
                <span className="text-cyan-300/90">RB{netInfo.rollback}</span>
              </>
            )}
          </div>
        </div>

        <FighterCard f={p2} side="right" />
      </div>

      {/* COMBO COUNTERS */}
      <div className="w-full flex items-center justify-between px-3 sm:px-10">
        {p1.comboHits >= 2 && p1.comboTimer > 0 ? (
          <div className="animate-combo-pop">
            <div className="text-2xl sm:text-4xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-amber-400 to-orange-600 drop-shadow-[0_0_18px_rgba(245,158,11,0.7)]">
              {p1.comboHits} <span className="text-lg sm:text-2xl">HITS</span>
            </div>
            <div className="text-[10px] sm:text-xs font-mono font-bold text-rose-300/90 tracking-widest">
              {p1.comboDamage} DMG
            </div>
          </div>
        ) : (
          <div />
        )}

        {p2.comboHits >= 2 && p2.comboTimer > 0 ? (
          <div className="animate-combo-pop text-right">
            <div className="text-2xl sm:text-4xl font-black italic tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-cyan-200 via-sky-400 to-blue-600 drop-shadow-[0_0_18px_rgba(56,189,248,0.7)]">
              {p2.comboHits} <span className="text-lg sm:text-2xl">HITS</span>
            </div>
            <div className="text-[10px] sm:text-xs font-mono font-bold text-rose-300/90 tracking-widest">
              {p2.comboDamage} DMG
            </div>
          </div>
        ) : (
          <div />
        )}
      </div>

      {/* BOTTOM BAR */}
      <div className="w-full flex items-end justify-between gap-2 pointer-events-auto">
        <div className="flex flex-col items-start">
          {showCheatSheet && (
            <div className="animate-fade-up p-3 mb-2 rounded-2xl glass-panel text-xs font-mono shadow-2xl w-72 sm:w-80">
              <div className="font-bold text-amber-300 uppercase text-[10px] tracking-[0.18em] mb-2">
                Bộ chiêu · {p1.character.name}
              </div>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-zinc-300">
                <div><span className="text-amber-300 font-bold">J</span> Đánh thường</div>
                <div><span className="text-amber-300 font-bold">U</span> Chiêu 1</div>
                <div><span className="text-amber-300 font-bold">I</span> Chiêu 2</div>
                <div><span className="text-amber-300 font-bold">S+U</span> Thủ / Phản</div>
                <div><span className="text-amber-300 font-bold">S+I</span> Quét sàn</div>
                <div><span className="text-amber-300 font-bold">W+U</span> Buff khí</div>
                <div><span className="text-amber-300 font-bold">W+I</span> Bẫy / Kéo</div>
                <div><span className="text-amber-300 font-bold">S+J</span> Lao / Vật</div>
              </div>
              <div className="pt-1.5 mt-1.5 border-t border-white/10 text-rose-300 font-bold text-[10px] tracking-wide">
                W + J · TUYỆT CHIÊU TỐI THƯỢNG
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCheatSheet(!showCheatSheet)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 text-zinc-300 hover:text-white border border-white/10 text-[11px] font-semibold backdrop-blur-md transition-all hover:border-amber-400/40 hover:shadow-[0_0_18px_rgba(245,158,11,0.25)] cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              {showCheatSheet ? 'Đóng' : '8 Chiêu'}
            </button>
            <span className="hidden lg:inline text-zinc-400/80 text-[10px] font-mono px-2 py-1 rounded-lg bg-zinc-950/50 border border-white/5">
              K nhảy · S+K tụt bục · L lướt · W giữ hồi sức · W+J ulti
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {[
            {
              onClick: toggleSound,
              label: 'Âm thanh',
              icon: isMuted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ),
            },
            { onClick: onPause, label: 'Tạm dừng', icon: <Pause className="w-4 h-4 text-amber-400" /> },
            { onClick: onOpenSettings, label: 'Cài đặt', icon: <Settings className="w-4 h-4 text-sky-400" /> },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.onClick}
              aria-label={btn.label}
              className="p-2 rounded-xl bg-zinc-950/80 hover:bg-zinc-900 border border-white/10 hover:border-white/25 text-zinc-300 hover:text-white backdrop-blur-md transition-all hover:shadow-[0_0_16px_rgba(255,255,255,0.15)] cursor-pointer"
            >
              {btn.icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
