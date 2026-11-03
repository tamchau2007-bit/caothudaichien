/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { KeyInputState, SkillSlot } from '../game/types';

interface MobileControlsProps {
  onInputEvent: (key: keyof KeyInputState, isPressed: boolean) => void;
  onQuickSkill: (slot: SkillSlot) => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  onInputEvent,
  onQuickSkill,
}) => {
  return (
    <div className="md:hidden absolute inset-x-0 bottom-0 pointer-events-none select-none z-20 p-3 flex justify-between items-end">
      {/* LEFT CLUSTER: D-Pad / Movement, Jump, Charge W, Guard S */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        {/* Top row: W (Hồi Sức) & Jump */}
        <div className="flex items-center gap-2">
          <button
            onTouchStart={() => onInputEvent('charge', true)}
            onTouchEnd={() => onInputEvent('charge', false)}
            onMouseDown={() => onInputEvent('charge', true)}
            onMouseUp={() => onInputEvent('charge', false)}
            className="w-13 h-13 rounded-xl bg-amber-600/80 active:bg-amber-500 border border-amber-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
          >
            <span>W</span>
            <span className="text-[9px] opacity-80">Hồi Sức</span>
          </button>

          <button
            onTouchStart={() => {
              onInputEvent('jump', true);
              onInputEvent('jumpPressed', true);
            }}
            onTouchEnd={() => onInputEvent('jump', false)}
            onMouseDown={() => {
              onInputEvent('jump', true);
              onInputEvent('jumpPressed', true);
            }}
            onMouseUp={() => onInputEvent('jump', false)}
            className="w-13 h-13 rounded-xl bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
          >
            <span>Nhảy</span>
            <span className="text-[9px] opacity-75">Phím K</span>
          </button>
        </div>

        {/* Bottom row: Left (A), Guard (S), Right (D) */}
        <div className="flex items-center gap-2">
          <button
            onTouchStart={() => onInputEvent('left', true)}
            onTouchEnd={() => onInputEvent('left', false)}
            onMouseDown={() => onInputEvent('left', true)}
            onMouseUp={() => onInputEvent('left', false)}
            className="w-13 h-13 rounded-xl bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-white font-bold text-base flex items-center justify-center shadow-lg"
          >
            ◀
          </button>

          <button
            onTouchStart={() => onInputEvent('guard', true)}
            onTouchEnd={() => onInputEvent('guard', false)}
            onMouseDown={() => onInputEvent('guard', true)}
            onMouseUp={() => onInputEvent('guard', false)}
            className="w-13 h-13 rounded-xl bg-indigo-600/80 active:bg-indigo-500 border border-indigo-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
          >
            <span>Đỡ S</span>
            <span className="text-[9px] opacity-80">-80%</span>
          </button>

          <button
            onTouchStart={() => onInputEvent('right', true)}
            onTouchEnd={() => onInputEvent('right', false)}
            onMouseDown={() => onInputEvent('right', true)}
            onMouseUp={() => onInputEvent('right', false)}
            className="w-13 h-13 rounded-xl bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-white font-bold text-base flex items-center justify-center shadow-lg"
          >
            ▶
          </button>
        </div>
      </div>

      {/* RIGHT CLUSTER: Actions (J, U, I, L) + Quick Combo Shortcuts */}
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        {/* Quick Skill Combo Row (One tap execution for mobile convenience) */}
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[240px] pb-1">
          <button
            onClick={() => onQuickSkill('SU')}
            className="px-2 py-1 rounded bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-[10px] font-bold text-amber-300"
          >
            S+U (Thủ)
          </button>
          <button
            onClick={() => onQuickSkill('SI')}
            className="px-2 py-1 rounded bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-[10px] font-bold text-amber-300"
          >
            S+I (Quét)
          </button>
          <button
            onClick={() => onQuickSkill('WU')}
            className="px-2 py-1 rounded bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-[10px] font-bold text-emerald-300"
          >
            W+U (Buff)
          </button>
          <button
            onClick={() => onQuickSkill('WI')}
            className="px-2 py-1 rounded bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-[10px] font-bold text-cyan-300"
          >
            W+I (Bẫy)
          </button>
          <button
            onClick={() => onQuickSkill('SJ')}
            className="px-2 py-1 rounded bg-zinc-800/90 active:bg-zinc-700 border border-zinc-600 text-[10px] font-bold text-purple-300"
          >
            S+J (Lao)
          </button>
          <button
            onClick={() => onQuickSkill('WJ')}
            className="px-2.5 py-1 rounded bg-rose-600 active:bg-rose-500 border border-rose-300 text-[10px] font-black text-white"
          >
            ULTI (W+J)
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-4 gap-2 items-center">
          {/* L: Dash */}
          <button
            onTouchStart={() => {
              onInputEvent('dash', true);
              onInputEvent('dashPressed', true);
            }}
            onTouchEnd={() => onInputEvent('dash', false)}
            onMouseDown={() => {
              onInputEvent('dash', true);
              onInputEvent('dashPressed', true);
            }}
            onMouseUp={() => onInputEvent('dash', false)}
            className="w-13 h-13 rounded-xl bg-cyan-700/80 active:bg-cyan-600 border border-cyan-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
          >
            <span>L</span>
            <span className="text-[9px] opacity-80">Lướt</span>
          </button>

          {/* U: Skill 1 */}
          <button
            onTouchStart={() => {
              onInputEvent('skillU', true);
              onInputEvent('skillUPressed', true);
            }}
            onTouchEnd={() => onInputEvent('skillU', false)}
            onMouseDown={() => {
              onInputEvent('skillU', true);
              onInputEvent('skillUPressed', true);
            }}
            onMouseUp={() => onInputEvent('skillU', false)}
            className="w-13 h-13 rounded-xl bg-purple-700/80 active:bg-purple-600 border border-purple-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
          >
            <span>U</span>
            <span className="text-[9px] opacity-80">Chiêu 1</span>
          </button>

          {/* I: Skill 2 Heavy */}
          <button
            onTouchStart={() => {
              onInputEvent('skillI', true);
              onInputEvent('skillIPressed', true);
            }}
            onTouchEnd={() => onInputEvent('skillI', false)}
            onMouseDown={() => {
              onInputEvent('skillI', true);
              onInputEvent('skillIPressed', true);
            }}
            onMouseUp={() => onInputEvent('skillI', false)}
            className="w-13 h-13 rounded-xl bg-orange-700/80 active:bg-orange-600 border border-orange-400 text-white font-bold text-xs flex flex-col items-center justify-center shadow-lg"
          >
            <span>I</span>
            <span className="text-[9px] opacity-80">Chiêu 2</span>
          </button>

          {/* J: Normal Attack (Large) */}
          <button
            onTouchStart={() => {
              onInputEvent('attackJ', true);
              onInputEvent('attackJPressed', true);
            }}
            onTouchEnd={() => onInputEvent('attackJ', false)}
            onMouseDown={() => {
              onInputEvent('attackJ', true);
              onInputEvent('attackJPressed', true);
            }}
            onMouseUp={() => onInputEvent('attackJ', false)}
            className="w-16 h-16 rounded-2xl bg-amber-500 active:bg-amber-400 border-2 border-amber-300 text-zinc-950 font-black text-lg flex flex-col items-center justify-center shadow-xl cursor-pointer"
          >
            <span>J</span>
            <span className="text-[10px] font-bold">Đánh</span>
          </button>
        </div>
      </div>
    </div>
  );
};
