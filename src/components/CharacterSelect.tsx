/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CharacterId, GameMode, MapId, SkillSlot } from '../game/types';
import { CHARACTERS } from '../game/characters';
import { MAPS } from '../game/maps';
import { ArrowLeft, BookOpen, MapPin, Sparkles, Zap } from 'lucide-react';

interface CharacterSelectProps {
  mode: GameMode;
  onBack: () => void;
  onStartFight: (p1Char: CharacterId, p2Char: CharacterId, mapId: MapId) => void;
}

const CHAR_IDS: CharacterId[] = [
  'hoang_saigon',
  'kendu',
  'le_dao',
  'khoa_pug',
  'nhat_ban',
  'hung_chimbay',
  'hoang_xitrum',
  'bao_ren',
];

const MAP_IDS: MapId[] = ['loi_dai', 'nguyen_hue', 'chau_phi', 'nhat_ban_sakura'];

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
  mode,
  onBack,
  onStartFight,
}) => {
  const [selectedP1, setSelectedP1] = useState<CharacterId>('hoang_saigon');
  const [selectedP2, setSelectedP2] = useState<CharacterId>('kendu');
  const [selectedMap, setSelectedMap] = useState<MapId>('nguyen_hue');
  const [activeTab, setActiveTab] = useState<'p1' | 'p2'>('p1');
  const [showSkillDetails, setShowSkillDetails] = useState(false);

  const activeCharId = activeTab === 'p1' ? selectedP1 : selectedP2;
  const activeChar = CHARACTERS[activeCharId];

  const handleSelect = (id: CharacterId) => {
    if (activeTab === 'p1') {
      setSelectedP1(id);
      if (mode === 'local2p') setActiveTab('p2');
    } else {
      setSelectedP2(id);
    }
  };

  const handleStart = () => {
    onStartFight(selectedP1, selectedP2, selectedMap);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-b from-[#090c16] via-[#101424] to-[#1a112c] text-white p-4 sm:p-6 overflow-y-auto select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Quay Lại
          </button>
          <h1 className="text-xl sm:text-2xl font-black font-serif text-amber-400 tracking-wide">
            CHỌN BÁT ĐẠI CAO THỦ & VÕ ĐÀI
          </h1>
        </div>

        {mode === 'local2p' ? (
          <div className="flex items-center rounded-lg bg-zinc-900 border border-zinc-700 p-1">
            <button
              onClick={() => setActiveTab('p1')}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeTab === 'p1' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Người Chơi 1 (P1)
            </button>
            <button
              onClick={() => setActiveTab('p2')}
              className={`px-3 py-1 rounded text-xs font-bold transition ${
                activeTab === 'p2' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Người Chơi 2 (P2)
            </button>
          </div>
        ) : (
          <div className="text-xs text-zinc-400 font-mono hidden sm:block">
            Chế độ: <span className="text-amber-400 uppercase font-bold">{mode}</span>
          </div>
        )}
      </div>

      {/* MAP SELECTION BAR */}
      <div className="mt-3 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-bold font-serif text-amber-300">
          <MapPin className="w-4 h-4 text-rose-400" />
          <span>CHỌN BẢN ĐỒ CHIẾN ĐẤU:</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
          {MAP_IDS.map((mId) => {
            const m = MAPS[mId];
            const isSelected = selectedMap === mId;
            return (
              <button
                key={mId}
                onClick={() => setSelectedMap(mId)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer text-left sm:text-center ${
                  isSelected
                    ? 'border-amber-400 bg-amber-500/20 text-amber-300 shadow-md'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div>{m.name}</div>
                <div className="text-[9px] text-zinc-500 truncate hidden md:block">{m.platforms.length} Bục Cao</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: 8 Characters (Left) & Detailed Info (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 my-3 items-start">
        {/* Left: 8 Character Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {CHAR_IDS.map((id) => {
            const c = CHARACTERS[id];
            const isP1 = selectedP1 === id;
            const isP2 = selectedP2 === id;
            const isInspected = activeCharId === id;

            return (
              <button
                key={id}
                onClick={() => handleSelect(id)}
                className={`relative flex flex-col p-2.5 rounded-xl border text-left transition hover:scale-[1.02] cursor-pointer ${
                  isInspected
                    ? 'border-amber-400 bg-zinc-800/90 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
                    : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                }`}
              >
                <div className="absolute top-2 right-2 flex gap-1">
                  {isP1 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500 text-zinc-950 font-black text-[10px]">
                      P1
                    </span>
                  )}
                  {isP2 && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-zinc-950 font-black text-[10px]">
                      {mode === 'ai' ? 'BOT' : 'P2'}
                    </span>
                  )}
                </div>

                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center mb-2 font-black text-sm font-serif"
                  style={{ backgroundColor: c.colorTheme.primary, color: '#fff' }}
                >
                  {c.name.charAt(0)}
                </div>

                <div className="font-bold text-sm text-white leading-tight font-serif truncate">
                  {c.name}
                </div>
                <div className="text-[10px] text-zinc-400 truncate mb-1">
                  {c.archetype}
                </div>
                <div className="text-[10px] font-mono text-amber-400/90">
                  {c.maxHp} HP · {c.jumpCount}x Nhảy (K)
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Character Gimmick & 8-Skill Combos */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl bg-zinc-900/95 border border-zinc-700/80 p-4 shadow-2xl">
          <div className="flex items-start justify-between border-b border-zinc-800 pb-2.5 mb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black font-serif text-white">{activeChar.name}</h2>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{ backgroundColor: activeChar.colorTheme.primary }}
                >
                  {activeChar.title}
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-0.5">{activeChar.archetype}</p>
            </div>
            <button
              onClick={() => setShowSkillDetails(!showSkillDetails)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold transition"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {showSkillDetails ? 'Thu Gọn' : 'Xem 8 Chiêu'}
            </button>
          </div>

          {/* Gimmick Card */}
          <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 mb-2.5">
            <div className="flex items-center gap-1.5 text-purple-300 text-xs font-bold font-serif mb-0.5">
              <Zap className="w-4 h-4 text-purple-400" />
              Cơ Chế Độc Quyền (Gimmick): {activeChar.gimmickName}
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed">{activeChar.gimmickDesc}</p>
          </div>

          {/* Passive & Quote */}
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-2.5 text-xs">
            <span className="text-amber-300 font-bold font-serif">Nội Tại ({activeChar.passiveName}): </span>
            <span className="text-zinc-300">{activeChar.passiveDesc}</span>
          </div>

          <div className="text-xs text-zinc-400 italic mb-3">
            <span className="text-zinc-500 not-italic font-semibold">Thoại thắng: </span>
            "{activeChar.winQuote}"
          </div>

          {/* 8-Skill Combos Table */}
          <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5 mb-3 text-xs">
            {(Object.keys(activeChar.skills) as SkillSlot[]).map((slot) => {
              const sk = activeChar.skills[slot];
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between p-2 rounded-lg bg-zinc-950/70 border border-zinc-800 hover:border-zinc-700 transition"
                >
                  <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono font-bold text-[11px]">
                      {slot === 'J' ? 'J (3 Hit)' : slot === 'SU' ? 'S+U' : slot === 'SI' ? 'S+I' : slot === 'WU' ? 'W+U' : slot === 'WI' ? 'W+I' : slot === 'SJ' ? 'S+J' : slot === 'WJ' ? 'W+J' : slot}
                    </kbd>
                    <div>
                      <span className="font-semibold text-zinc-200">{sk.name}</span>
                      <span className="text-[10px] text-zinc-500 block truncate max-w-[200px]">{sk.typeDesc}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-emerald-400 font-mono font-bold">{sk.damage} DMG</span>
                    <span className="text-amber-500 text-[10px] block font-mono">-{sk.staminaCost} STA</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Start Fight CTA */}
          <button
            data-start="true"
            onClick={handleStart}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-zinc-950 font-black text-sm sm:text-base uppercase tracking-wider font-serif shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:brightness-110 active:scale-95 transition cursor-pointer"
          >
            VÀO TRẬN ĐẤU VÕ ĐÀI
          </button>
        </div>
      </div>

      <div className="text-center text-zinc-500 text-xs font-mono pt-2 border-t border-zinc-800">
        P1: {CHARACTERS[selectedP1].name} VS {mode === 'ai' ? `MÁY (${CHARACTERS[selectedP2].name})` : `P2 (${CHARACTERS[selectedP2].name})`} · Map: {MAPS[selectedMap].name}
      </div>
    </div>
  );
};
