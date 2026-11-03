/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GameMode, GameSettings } from '../game/types';
import { X, Sliders, Monitor, Volume2, Shield } from 'lucide-react';

interface SettingsModalProps {
  settings: GameSettings;
  mode: GameMode;
  onUpdateSettings: (newSettings: Partial<GameSettings>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  mode,
  onUpdateSettings,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div className="relative w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700/80 p-6 text-white shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-5">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-black font-serif text-amber-400 tracking-wide">
              CÀI ĐẶT TRẬN ĐẤU
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Đồ Họa & Hiệu Năng (Graphics & Performance) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            <Monitor className="w-4 h-4 text-cyan-400" />
            Đồ Họa & Hiệu Năng
          </div>

          <div className="space-y-3">
            {/* Screen Shake */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Rung Màn Hình (Screen Shake)</div>
                <div className="text-xs text-zinc-500">Rung chấn động theo lực đòn đánh (Tắt nếu bị chóng mặt)</div>
              </div>
              <input
                type="checkbox"
                checked={settings.screenShake}
                onChange={(e) => onUpdateSettings({ screenShake: e.target.checked })}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* VFX Particles */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Hiệu Ứng Hạt VFX</div>
                <div className="text-xs text-zinc-500">Tia lửa nổ, khói và mảnh vỡ (Tắt để tăng FPS cho máy yếu)</div>
              </div>
              <input
                type="checkbox"
                checked={settings.vfxParticles}
                onChange={(e) => onUpdateSettings({ vfxParticles: e.target.checked })}
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>

            {/* Show Hitboxes */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
              <div>
                <div className="text-sm font-semibold text-zinc-200">Khung Va Chạm (Hitbox / Hurtbox)</div>
                <div className="text-xs text-zinc-500">Khung đỏ gây sát thương, khung xanh nhận đòn</div>
              </div>
              <input
                type="checkbox"
                checked={settings.showHitboxes}
                onChange={(e) => onUpdateSettings({ showHitboxes: e.target.checked })}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 2. Âm Thanh (Audio Sliders) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            <Volume2 className="w-4 h-4 text-amber-400" />
            Âm Lượng Trận Đấu
          </div>

          <div className="space-y-3 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
            {/* Master Volume */}
            <div>
              <div className="flex justify-between text-xs text-zinc-300 font-semibold mb-1">
                <span>Âm Lượng Tổng (Master)</span>
                <span className="font-mono text-amber-400">{Math.round(settings.masterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.masterVolume}
                onChange={(e) => onUpdateSettings({ masterVolume: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* SFX Volume */}
            <div>
              <div className="flex justify-between text-xs text-zinc-300 font-semibold mb-1">
                <span>Hiệu Ứng Âm Đánh (SFX)</span>
                <span className="font-mono text-amber-400">{Math.round(settings.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.sfxVolume}
                onChange={(e) => onUpdateSettings({ sfxVolume: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* BGM Volume */}
            <div>
              <div className="flex justify-between text-xs text-zinc-300 font-semibold mb-1">
                <span>Nhạc Nền Trận Đấu (BGM)</span>
                <span className="font-mono text-amber-400">{Math.round(settings.bgmVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.bgmVolume}
                onChange={(e) => onUpdateSettings({ bgmVolume: parseFloat(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 3. Chế Độ Luyện Tập (Training Exclusive) */}
        {mode === 'training' && (
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              Tùy Chỉnh Phòng Tập Luyện (Dojo)
            </div>

            <div className="space-y-3">
              {/* Infinite Stamina */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div>
                  <div className="text-sm font-semibold text-zinc-200">Vô Hạn Thể Lực (Infinite Stamina)</div>
                  <div className="text-xs text-zinc-500">Thoải mái tung combo và chiêu thức không lo kiệt sức</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.infiniteStamina}
                  onChange={(e) => onUpdateSettings({ infiniteStamina: e.target.checked })}
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              {/* Dummy Behavior */}
              <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800">
                <div className="text-sm font-semibold text-zinc-200 mb-1">Hành Vi Hình Nhân Tập Đánh</div>
                <div className="grid grid-cols-4 gap-2 text-xs font-bold mt-2">
                  {(['stand', 'guard', 'jump', 'counter'] as const).map((bh) => (
                    <button
                      key={bh}
                      onClick={() => onUpdateSettings({ dummyBehavior: bh })}
                      className={`py-1.5 rounded-lg border text-center transition cursor-pointer ${
                        settings.dummyBehavior === bh
                          ? 'border-emerald-400 bg-emerald-600/30 text-emerald-300'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {bh === 'stand' ? 'Đứng Yên' : bh === 'guard' ? 'Thủ (S)' : bh === 'jump' ? 'Nhảy' : 'Phản Đòn'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm tracking-wide transition cursor-pointer"
        >
          Xác Nhận & Đóng
        </button>
      </div>
    </div>
  );
};
