/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameMode } from '../game/types';
import { Swords, Bot, Users, Dumbbell, Globe, Volume2, VolumeX } from 'lucide-react';
import { sound } from '../game/sound';

interface TitleScreenProps {
  onSelectMode: (mode: GameMode, roomCode?: string) => void;
  onOpenSettings: () => void;
  onOpenOnlineLobby: (code?: string) => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onSelectMode,
  onOpenSettings,
  onOpenOnlineLobby,
}) => {
  const [onlineInputCode, setOnlineInputCode] = useState('');
  const [showRoomInput, setShowRoomInput] = useState(false);
  const [isMuted, setIsMuted] = useState(sound.isMuted);

  const toggleSound = () => {
    sound.isMuted = !sound.isMuted;
    setIsMuted(sound.isMuted);
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-between bg-gradient-to-b from-[#080b14] via-[#0d1222] to-[#170e28] text-white p-6 md:p-12 overflow-hidden select-none">
      {/* Background Animated Subtle Glow & Chinese/Vietnamese Arena Vignette */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar with Mute & Settings */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-mono text-xs tracking-wider uppercase font-semibold">
            Võ Đài Trực Tuyến 60 FPS
          </span>
          <span className="text-zinc-400 text-xs hidden sm:inline">
            FSM Netcode · 8 Cao Thủ · 8 Combo Kỹ Năng
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            aria-label="Bật/Tắt Âm Thanh"
            className="p-2.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
          </button>
          <button
            onClick={onOpenSettings}
            className="px-3.5 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-sm font-medium transition"
          >
            Cài Đặt
          </button>
        </div>
      </div>

      {/* Hero Centerpiece: Bespoke SVG Title Lockup */}
      <div className="flex flex-col items-center justify-center my-auto z-10 text-center max-w-4xl mx-auto">
        <div className="relative mb-6">
          <svg className="w-72 sm:w-96 md:w-[500px] h-auto drop-shadow-[0_0_35px_rgba(245,158,11,0.45)]" viewBox="0 0 560 130">
            <defs>
              <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff9c4" />
                <stop offset="45%" stopColor="#ffd54f" />
                <stop offset="85%" stopColor="#ff8f00" />
                <stop offset="100%" stopColor="#e65100" />
              </linearGradient>
              <linearGradient id="fireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff1744" />
                <stop offset="50%" stopColor="#ff9100" />
                <stop offset="100%" stopColor="#ffea00" />
              </linearGradient>
            </defs>

            {/* Dragon Wing Crest Accents */}
            <path
              d="M 40 65 Q 130 20 250 35 Q 130 50 50 75 Z"
              fill="url(#fireGrad)"
              opacity="0.8"
            />
            <path
              d="M 520 65 Q 430 20 310 35 Q 430 50 510 75 Z"
              fill="url(#fireGrad)"
              opacity="0.8"
            />

            {/* Main Title Typography */}
            <text
              x="280"
              y="58"
              textAnchor="middle"
              fill="url(#goldGrad)"
              fontSize="40"
              fontWeight="900"
              fontFamily="Cinzel, serif"
              letterSpacing="3"
              stroke="#211003"
              strokeWidth="3"
              style={{ paintOrder: 'stroke fill' }}
            >
              ĐẠI CHIẾN CAO THỦ
            </text>

            {/* Subtitle Ribbon */}
            <text
              x="280"
              y="98"
              textAnchor="middle"
              fill="#ffffff"
              fontSize="17"
              fontWeight="700"
              fontFamily="Oswald, sans-serif"
              letterSpacing="6"
              opacity="0.95"
            >
              2D PLATFORM FIGHTING ONLINE
            </text>
          </svg>
        </div>

        <p className="text-zinc-300 text-sm sm:text-base max-w-xl mx-auto mb-8 font-medium leading-relaxed">
          Đại hội võ lâm đỉnh phong quy tụ 8 cao thủ võ lâm với bộ chiêu thức tổ hợp độc bản, cơ chế Siêu Giáp, Phản Đòn, Nảy Tường và Netcode mượt mà.
        </p>

        {/* Primary Game Mode Selection CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 w-full max-w-3xl">
          {/* 1. Đấu Với Máy (AI) - Primary Start CTA */}
          <button
            data-start="true"
            onClick={() => onSelectMode('ai')}
            className="group relative flex flex-col items-center justify-center p-4 rounded-xl bg-gradient-to-b from-amber-500 to-amber-700 text-zinc-950 font-bold border-2 border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.35)] hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Bot className="w-7 h-7 mb-1.5 group-hover:rotate-12 transition" />
            <span className="text-base font-black tracking-wide uppercase font-serif">Đấu Với Máy</span>
            <span className="text-[11px] font-medium opacity-85">Chiến AI thông minh</span>
          </button>

          {/* 2. Đấu Online (Room Code) */}
          <button
            onClick={() => onOpenOnlineLobby()}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-amber-400 font-bold border border-amber-500/40 hover:border-amber-400 shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Globe className="w-7 h-7 mb-1.5 text-amber-400" />
            <span className="text-base font-black tracking-wide uppercase">Phòng Online</span>
            <span className="text-[11px] font-medium text-zinc-400">Tạo hoặc Nhập Mã Phòng</span>
          </button>

          {/* 3. Phòng Luyện Tập (Training Mode) */}
          <button
            onClick={() => onSelectMode('training')}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-emerald-400 font-bold border border-emerald-500/40 hover:border-emerald-400 shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Dumbbell className="w-7 h-7 mb-1.5 text-emerald-400" />
            <span className="text-base font-black tracking-wide uppercase">Luyện Tập</span>
            <span className="text-[11px] font-medium text-zinc-400">Xem Hitbox & Combo</span>
          </button>

          {/* 4. Đối Kháng Cục Bộ (Local 2P) */}
          <button
            onClick={() => onSelectMode('local2p')}
            className="flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-cyan-400 font-bold border border-cyan-500/40 hover:border-cyan-400 shadow-md hover:scale-105 active:scale-95 transition cursor-pointer"
          >
            <Users className="w-7 h-7 mb-1.5 text-cyan-400" />
            <span className="text-base font-black tracking-wide uppercase">2 Người 1 Máy</span>
            <span className="text-[11px] font-medium text-zinc-400">P1 vs P2 bàn phím</span>
          </button>
        </div>
      </div>

      {/* Bottom Flat Control-Hint Line as required by Game Craft */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-zinc-400 text-xs z-10 pt-4 border-t border-zinc-800/80 font-mono">
        <div className="tracking-wide">
          A/D Di Chuyển · K Nhảy (S+K Tụt Sàn) · W Hồi Sức · S Đỡ Đòn · L Lướt (Lùi/Tiến) · J Đánh Thường (3-Hit Combo) · U/I Chiêu 1/2 · Esc Tạm Dừng
        </div>
        <div className="text-zinc-500 text-[11px] mt-1 sm:mt-0">
          Nhấn <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">K</kbd> hoặc <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold">Enter</kbd> để Bắt Đầu
        </div>
      </div>
    </div>
  );
};
