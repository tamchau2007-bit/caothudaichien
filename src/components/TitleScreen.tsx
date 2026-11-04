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
      {/* Background: arena grid, drifting glow orbs, embers */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.22]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(circle at 50% 45%, black, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 45%, black, transparent 78%)',
        }}
      />
      <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-amber-500/12 rounded-full blur-3xl pointer-events-none animate-floaty" />
      <div className="absolute -bottom-40 -right-32 w-[30rem] h-[30rem] bg-rose-500/12 rounded-full blur-3xl pointer-events-none animate-floaty" style={{ animationDelay: '1.6s' }} />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none animate-floaty" style={{ animationDelay: '3s' }} />
      {[...Array(14)].map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-amber-300/40 pointer-events-none animate-floaty"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 53) % 100}%`,
            width: 2 + (i % 3),
            height: 2 + (i % 3),
            animationDelay: `${i * 0.45}s`,
            animationDuration: `${5 + (i % 4)}s`,
            boxShadow: '0 0 10px rgba(251,191,36,0.6)',
          }}
        />
      ))}

      {/* Top Bar with Mute & Settings */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/40 text-amber-300 font-mono text-[11px] tracking-[0.18em] uppercase font-bold shadow-[0_0_18px_rgba(245,158,11,0.18)]">
            Rollback Netcode · 60 FPS
          </span>
          <span className="text-zinc-400 text-xs hidden sm:inline tracking-wide">
            8 Cao Thủ · 8 Combo Kỹ Năng · Đồng Bộ 1 Khung Hình
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
        <div className="relative mb-6 animate-fade-up">
          <div className="absolute inset-0 -m-10 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
          <svg className="relative w-72 sm:w-96 md:w-[500px] h-auto drop-shadow-[0_0_35px_rgba(245,158,11,0.45)]" viewBox="0 0 560 130">
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

        <p className="text-zinc-300 text-sm sm:text-base max-w-xl mx-auto mb-8 font-medium leading-relaxed animate-fade-up" style={{ animationDelay: '0.08s' }}>
          Đại hội võ lâm đỉnh phong quy tụ 8 cao thủ võ lâm với bộ chiêu thức tổ hợp độc bản, cơ chế Siêu Giáp, Phản Đòn, Nảy Tường và Netcode mượt mà.
        </p>

        {/* Primary Game Mode Selection CTAs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 w-full max-w-3xl">
          {/* 1. Đấu Với Máy (AI) - Primary Start CTA */}
          <button
            data-start="true"
            onClick={() => onSelectMode('ai')}
            className="group relative flex flex-col items-center justify-center p-4 rounded-xl btn-primary border-2 border-amber-200/70 hover:scale-[1.04] active:scale-95 cursor-pointer"
          >
            <Bot className="w-7 h-7 mb-1.5 group-hover:rotate-12 transition" />
            <span className="text-base font-black tracking-wide uppercase font-serif">Đấu Với Máy</span>
            <span className="text-[11px] font-medium opacity-85">Chiến AI thông minh</span>
          </button>

          {/* 2. Đấu Online (Room Code) */}
          <button
            onClick={() => onOpenOnlineLobby()}
            className="group flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-900/70 backdrop-blur-md text-amber-300 font-bold border border-amber-500/40 hover:border-amber-300 hover:bg-zinc-900/90 shadow-[0_8px_28px_rgba(0,0,0,0.45)] hover:shadow-[0_0_26px_rgba(245,158,11,0.28)] hover:scale-[1.04] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <Globe className="w-7 h-7 mb-1.5 text-amber-400" />
            <span className="text-base font-black tracking-wide uppercase">Phòng Online</span>
            <span className="text-[11px] font-medium text-zinc-400">Tạo hoặc Nhập Mã Phòng</span>
          </button>

          {/* 3. Phòng Luyện Tập (Training Mode) */}
          <button
            onClick={() => onSelectMode('training')}
            className="group flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-900/70 backdrop-blur-md text-emerald-300 font-bold border border-emerald-500/40 hover:border-emerald-300 hover:bg-zinc-900/90 shadow-[0_8px_28px_rgba(0,0,0,0.45)] hover:shadow-[0_0_26px_rgba(16,185,129,0.28)] hover:scale-[1.04] active:scale-95 transition-all duration-200 cursor-pointer"
          >
            <Dumbbell className="w-7 h-7 mb-1.5 text-emerald-400" />
            <span className="text-base font-black tracking-wide uppercase">Luyện Tập</span>
            <span className="text-[11px] font-medium text-zinc-400">Xem Hitbox & Combo</span>
          </button>

          {/* 4. Đối Kháng Cục Bộ (Local 2P) */}
          <button
            onClick={() => onSelectMode('local2p')}
            className="group flex flex-col items-center justify-center p-4 rounded-xl bg-zinc-900/70 backdrop-blur-md text-cyan-300 font-bold border border-cyan-500/40 hover:border-cyan-300 hover:bg-zinc-900/90 shadow-[0_8px_28px_rgba(0,0,0,0.45)] hover:shadow-[0_0_26px_rgba(6,182,212,0.28)] hover:scale-[1.04] active:scale-95 transition-all duration-200 cursor-pointer"
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
