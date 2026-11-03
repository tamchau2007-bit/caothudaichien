/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CharacterData,
  DamageText,
  FighterEntity,
  Hitbox,
  MapData,
  Particle,
  Projectile,
} from './types';
import { STAGE_CONFIG, getFighterHurtbox } from './physics';

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animTick: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2d context');
    this.ctx = ctx;
  }

  public render(
    p1: FighterEntity,
    p2: FighterEntity,
    hitboxes: Hitbox[],
    projectiles: Projectile[],
    particles: Particle[],
    damageTexts: DamageText[],
    screenShake: { x: number; y: number },
    showHitboxes: boolean,
    currentMap: MapData
  ) {
    this.animTick++;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply Screen Shake
    ctx.translate(screenShake.x, screenShake.y);

    // 1. Draw Map Background & Platforms
    this.drawMap(currentMap, width, height);

    // 1b. Draw Epic Ultimate Cinematic Background if WJ is being cast
    this.drawUltimateCinematicBackground(p1, p2, width, height);

    // 2. Draw Active Projectiles & Summons (Burgers, Loa Thùng, Figure, Bàn Thờ, Skibidi, v.v.)
    this.drawProjectiles(projectiles);

    // 3. Draw Pets (Hoàng Xì Trum's Cat)
    this.drawPets(p1, p2);

    // 4. Draw Fighters with Distinct Animations & Gimmick Visuals
    this.drawFighter(p1);
    this.drawFighter(p2);

    // 5. Draw Visual Stacks Above Fighters (Poison Claws, Wibu Hearts, Ribs, Mỡ Tạng, Equalizer)
    this.drawGimmickStacks(p1);
    this.drawGimmickStacks(p2);

    // 6. Draw Particles & Dust
    this.drawParticles(particles);

    // 7. Draw Floating Damage Numbers
    this.drawDamageTexts(damageTexts);

    // 8. Draw Hitboxes if in Training
    if (showHitboxes) {
      this.drawDebugBoxes(p1, p2, hitboxes, projectiles);
    }

    ctx.restore();
  }

  /**
   * Cinematic Stage Transformations during Character Ultimates (W+J)
   */
  private drawUltimateCinematicBackground(
    p1: FighterEntity,
    p2: FighterEntity,
    width: number,
    height: number
  ) {
    const ultFighter = p1.currentSkill?.id === 'WJ' ? p1 : (p2.currentSkill?.id === 'WJ' ? p2 : null);
    if (!ultFighter) return;

    const ctx = this.ctx;
    const charId = ultFighter.character.id;
    const tick = this.animTick;

    ctx.save();

    if (charId === 'hoang_saigon') {
      // Hoàng Sài Gòn: Đại Bác Mỡ Tạng - Volcanic heat haze & magma fissures
      ctx.fillStyle = 'rgba(234, 88, 12, 0.28)';
      ctx.fillRect(0, 0, width, height);

      // Crumbling building silhouettes and flame banners
      ctx.fillStyle = '#dc2626';
      ctx.font = '900 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.strokeText('🔥 ĐẠI BÁC MỠ TẠNG 🔥', width / 2, 90);
      ctx.fillText('🔥 ĐẠI BÁC MỠ TẠNG 🔥', width / 2, 90);

      // Shockwave rings vibrating on the floor
      const ringW = (tick * 15) % (width / 2);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ultFighter.x, ultFighter.y - 40, ringW, 0, Math.PI * 2);
      ctx.stroke();

    } else if (charId === 'kendu') {
      // KenDu: Đại Tiệc B-Boy Underground - Neon dancefloor & giant equalizer towers
      ctx.fillStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.fillRect(0, 0, width, height);

      // Floor Disco LED Tiles
      const tileCols = ['#38bdf8', '#ec4899', '#a855f7', '#00e5ff', '#facc15'];
      for (let x = 0; x < width; x += 60) {
        const colIdx = Math.floor((x / 60 + tick * 0.1) % tileCols.length);
        ctx.fillStyle = tileCols[colIdx] + '40';
        ctx.fillRect(x, STAGE_CONFIG.floorY, 56, 12);
      }

      // Twin Skyscraper Equalizer Towers on Left and Right
      for (let side = 0; side < 2; side++) {
        const startX = side === 0 ? 30 : width - 110;
        for (let b = 0; b < 8; b++) {
          const barH = 30 + Math.abs(Math.sin(tick * 0.25 + b + side)) * 140;
          ctx.fillStyle = b > 5 ? '#ef4444' : (b > 3 ? '#f59e0b' : '#38bdf8');
          ctx.fillRect(startX + b * 9, STAGE_CONFIG.floorY - barH, 7, barH);
        }
      }

      // Sweeping Laser Beams
      const laserAngle = Math.sin(tick * 0.08) * 0.6;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2 + Math.tan(laserAngle) * height, height);
      ctx.stroke();

      ctx.fillStyle = '#00e5ff';
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('🎧 ĐẠI TIỆC B-BOY UNDERGROUND 🎧', width / 2, 90);
      ctx.fillText('🎧 ĐẠI TIỆC B-BOY UNDERGROUND 🎧', width / 2, 90);

    } else if (charId === 'le_dao') {
      // Lê Đào: Chiến Thần Xương Hoàng Kim Susanoo
      ctx.fillStyle = 'rgba(180, 83, 9, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Golden cathedral ribcage arches in the sky
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
      ctx.lineWidth = 8;
      for (let r = 0; r < 5; r++) {
        ctx.beginPath();
        ctx.arc(width / 2, 0, 160 + r * 60, 0, Math.PI);
        ctx.stroke();
      }

      // Towering Golden Skeleton Avatar (Susanoo) Silhouette behind
      ctx.save();
      ctx.translate(ultFighter.x, ultFighter.y - 120);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.45)';
      // Giant Susanoo skull
      ctx.beginPath();
      ctx.arc(0, -90, 45, 0, Math.PI * 2);
      ctx.fill();
      // Glowing fiery eyes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-22, -100, 14, 8);
      ctx.fillRect(8, -100, 14, 8);
      // Susanoo Giant Ribcage
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 7;
      for (let rb = 0; rb < 4; rb++) {
        ctx.beginPath();
        ctx.arc(0, -50 + rb * 20, 65, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      ctx.restore();

      ctx.fillStyle = '#fef08a';
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('⚔️ CHIẾN THẦN XƯƠNG HOÀNG KIM ⚔️', width / 2, 90);
      ctx.fillText('⚔️ CHIẾN THẦN XƯƠNG HOÀNG KIM ⚔️', width / 2, 90);

    } else if (charId === 'khoa_pug') {
      // Khoa Pug: Manga Screentone Speedlines & Waifu Titan
      ctx.fillStyle = 'rgba(244, 114, 182, 0.22)';
      ctx.fillRect(0, 0, width, height);

      // Dynamic manga radial speedlines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
        ctx.beginPath();
        ctx.moveTo(width / 2 + Math.cos(a) * 120, height / 2 + Math.sin(a) * 120);
        ctx.lineTo(width / 2 + Math.cos(a) * 800, height / 2 + Math.sin(a) * 800);
        ctx.stroke();
      }

      // Cherry blossom storm
      ctx.fillStyle = '#ec4899';
      for (let p = 0; p < 18; p++) {
        const px = (p * 70 + tick * 8) % width;
        const py = (p * 45 + tick * 4) % height;
        ctx.beginPath();
        ctx.ellipse(px, py, 9, 5, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#f472b6';
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('🌸 BẢO VỆ NỤ CƯỜI WAIFU! 🌸', width / 2, 90);
      ctx.fillText('🌸 BẢO VỆ NỤ CƯỜI WAIFU! 🌸', width / 2, 90);

    } else if (charId === 'nhat_ban') {
      // Nhật Bản: Lãnh Địa Ma Trảo Vô Hạn - Blood Moon Eclipse & Dark Realm
      ctx.fillStyle = 'rgba(15, 2, 28, 0.7)';
      ctx.fillRect(0, 0, width, height);

      // Blood Red Moon in center
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(width / 2, 160, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.arc(width / 2 - 20, 150, 75, 0, Math.PI * 2);
      ctx.fill();

      // Flashes of purple lightning
      if (tick % 6 < 2) {
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width / 2, 160);
        ctx.lineTo(width / 2 - 100, 320);
        ctx.lineTo(width / 2 - 40, 370);
        ctx.lineTo(width / 2 - 180, 500);
        ctx.stroke();
      }

      ctx.fillStyle = '#c084fc';
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('🌑 LÃNH ĐỊA MA TRẢO VÔ HẠN 🌑', width / 2, 90);
      ctx.fillText('🌑 LÃNH ĐỊA MA TRẢO VÔ HẠN 🌑', width / 2, 90);

    } else if (charId === 'hung_chimbay') {
      // Hùng Chim Bay: Siêu Bão Đại Bàng Không Gian (Mach 5 Stratosphere)
      ctx.fillStyle = 'rgba(21, 128, 61, 0.28)';
      ctx.fillRect(0, 0, width, height);

      // Stratospheric rushing clouds streaks
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
      ctx.lineWidth = 3;
      for (let s = 0; s < 14; s++) {
        const sy = (s * 45 + tick * 18) % height;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy + 30);
        ctx.stroke();
      }

      // Giant Celestial Emerald Eagle Spirit spanning across top
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)';
      ctx.beginPath();
      ctx.moveTo(width / 2, 120);
      ctx.quadraticCurveTo(width * 0.2, 50, 40, 160);
      ctx.quadraticCurveTo(width * 0.3, 200, width / 2, 170);
      ctx.quadraticCurveTo(width * 0.7, 200, width - 40, 160);
      ctx.quadraticCurveTo(width * 0.8, 50, width / 2, 120);
      ctx.fill();

      ctx.fillStyle = '#4ade80';
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('🦅 SIÊU BÃO ĐẠI BÀNG (MACH 5) 🦅', width / 2, 90);
      ctx.fillText('🦅 SIÊU BÃO ĐẠI BÀNG (MACH 5) 🦅', width / 2, 90);

    } else if (charId === 'hoang_xitrum') {
      // Hoàng Xì Trum: Combo Võ Đài Đỉnh Cao & Mèo Điên
      ctx.fillStyle = 'rgba(13, 148, 136, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Arena Championship Spotlights
      const spotAngle = Math.sin(tick * 0.1) * 200;
      ctx.fillStyle = 'rgba(45, 212, 191, 0.18)';
      ctx.beginPath();
      ctx.moveTo(150, 0);
      ctx.lineTo(width / 2 + spotAngle - 100, STAGE_CONFIG.floorY);
      ctx.lineTo(width / 2 + spotAngle + 100, STAGE_CONFIG.floorY);
      ctx.closePath();
      ctx.fill();

      // Floating Cat Paw Prints
      ctx.fillStyle = '#ea580c';
      for (let cp = 0; cp < 6; cp++) {
        const cpx = (cp * 180 + tick * 3) % width;
        const cpy = 180 + Math.sin(tick * 0.1 + cp) * 40;
        ctx.beginPath();
        ctx.arc(cpx, cpy, 12, 0, Math.PI * 2);
        ctx.arc(cpx - 10, cpy - 12, 5, 0, Math.PI * 2);
        ctx.arc(cpx, cpy - 16, 5, 0, Math.PI * 2);
        ctx.arc(cpx + 10, cpy - 12, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#2dd4bf';
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('🥋 LIÊN HOÀN 1M8 & MÈO ĐIÊN! 🐱', width / 2, 90);
      ctx.fillText('🥋 LIÊN HOÀN 1M8 & MÈO ĐIÊN! 🐱', width / 2, 90);

    } else if (charId === 'bao_ren') {
      // Bảo Ren: Ngày Tận Thế Skibidi Creepypasta
      ctx.fillStyle = 'rgba(69, 10, 10, 0.45)';
      ctx.fillRect(0, 0, width, height);

      // Analog Horror VHS Scanlines
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 2);
      }

      // Glitch tracking bar jumping down
      const glitchY = (tick * 12) % height;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(0, glitchY, width, 18);

      ctx.fillStyle = '#ef4444';
      ctx.font = '900 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 5;
      ctx.strokeText('⚠️ TẬN THẾ SKIBIDI CREEPYPASTA ⚠️', width / 2, 90);
      ctx.fillText('⚠️ TẬN THẾ SKIBIDI CREEPYPASTA ⚠️', width / 2, 90);
    }

    ctx.restore();
  }

  /**
   * Draw the 4 Distinct Battle Stages
   */
  private drawMap(map: MapData, width: number, height: number) {
    const ctx = this.ctx;

    if (map.id === 'nguyen_hue') {
      // 1. Phố Đi Bộ Nguyễn Huệ (Sài Gòn Night)
      const sky = ctx.createLinearGradient(0, 0, 0, STAGE_CONFIG.floorY);
      sky.addColorStop(0, '#040714');
      sky.addColorStop(0.7, '#0f172a');
      sky.addColorStop(1, '#1e1b4b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Bitexco Skyscraper Silhouette in Center
      ctx.fillStyle = '#090d1f';
      ctx.beginPath();
      ctx.moveTo(560, 540);
      ctx.lineTo(580, 110);
      ctx.lineTo(600, 110);
      ctx.lineTo(620, 540);
      ctx.fill();
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(570, 240, 55, 12);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(597, 105, 6, 6);

      // Saigon Neon Billboards
      ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
      ctx.fillRect(200, 220, 120, 70);
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2;
      ctx.strokeRect(200, 220, 120, 70);
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SÀI GÒN ƠI', 260, 260);

      ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
      ctx.fillRect(860, 220, 140, 70);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(860, 220, 140, 70);
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('NGUYỄN HUỆ', 930, 260);

      // Granite floor
      ctx.fillStyle = '#1e2230';
      ctx.fillRect(0, STAGE_CONFIG.floorY, width, height - STAGE_CONFIG.floorY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, STAGE_CONFIG.floorY);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    } else if (map.id === 'chau_phi') {
      // 2. Châu Phi Safari
      const sky = ctx.createLinearGradient(0, 0, 0, STAGE_CONFIG.floorY);
      sky.addColorStop(0, '#450a0a');
      sky.addColorStop(0.4, '#7c2d12');
      sky.addColorStop(0.8, '#d97706');
      sky.addColorStop(1, '#f59e0b');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Giant Red Sun
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(600, 280, 95, 0, Math.PI * 2);
      ctx.fill();

      // Baobab Tree Silhouette
      ctx.fillStyle = '#1c0c05';
      ctx.beginPath();
      ctx.moveTo(180, 540);
      ctx.lineTo(210, 360);
      ctx.lineTo(270, 360);
      ctx.lineTo(300, 540);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(240, 340, 75, Math.PI, 0);
      ctx.fill();

      // Safari Earth Floor
      ctx.fillStyle = '#78350f';
      ctx.fillRect(0, STAGE_CONFIG.floorY, width, height - STAGE_CONFIG.floorY);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, STAGE_CONFIG.floorY, width, 8);
    } else if (map.id === 'nhat_ban_sakura') {
      // 3. Nhật Bản Sakura Shrine
      const sky = ctx.createLinearGradient(0, 0, 0, STAGE_CONFIG.floorY);
      sky.addColorStop(0, '#1e1b4b');
      sky.addColorStop(0.5, '#4c1d95');
      sky.addColorStop(0.9, '#831843');
      sky.addColorStop(1, '#f43f5e');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Full Moon
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(600, 180, 70, 0, Math.PI * 2);
      ctx.fill();

      // Red Torii Gate Silhouette
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(520, 220, 20, 320);
      ctx.fillRect(660, 220, 20, 320);
      ctx.fillRect(490, 240, 220, 24);
      ctx.fillRect(460, 200, 280, 28);

      // Tatami Wooden Dojo Floor
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, STAGE_CONFIG.floorY, width, height - STAGE_CONFIG.floorY);
      ctx.fillStyle = '#a16207';
      ctx.fillRect(0, STAGE_CONFIG.floorY, width, 10);
    } else {
      // 4. Đại Hội Võ Lâm (Lôi Đài Cổ Phong)
      const sky = ctx.createLinearGradient(0, 0, 0, STAGE_CONFIG.floorY);
      sky.addColorStop(0, '#0f172a');
      sky.addColorStop(0.5, '#1e293b');
      sky.addColorStop(1, '#334155');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Martial Arena Temple Roof
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(350, 280);
      ctx.lineTo(600, 150);
      ctx.lineTo(850, 280);
      ctx.lineTo(800, 290);
      ctx.lineTo(400, 290);
      ctx.closePath();
      ctx.fill();

      // Stone Arena Floor
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, STAGE_CONFIG.floorY, width, height - STAGE_CONFIG.floorY);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(0, STAGE_CONFIG.floorY, width, 6);
    }

    // Platforms
    map.platforms.forEach((plat) => {
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(plat.x, plat.y, plat.w, 4);

      if (plat.label) {
        ctx.font = 'bold 10px sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.textAlign = 'center';
        ctx.fillText(plat.label, plat.x + plat.w / 2, plat.y + 14);
      }
      ctx.restore();
    });
  }

  /**
   * Draw Fighter Entity with Distinct Visual Shapes & Animations
   */
  private drawFighter(f: FighterEntity) {
    const ctx = this.ctx;
    const char = f.character;
    const facing = f.facing;
    const id = char.id;

    ctx.save();
    ctx.translate(f.x, f.y);

    // Hoàng Sài Gòn: Dynamic Scale (phình to)
    if (id === 'hoang_saigon' && f.hoangScaleBonus > 1.0) {
      ctx.scale(f.hoangScaleBonus, f.hoangScaleBonus);
    }

    if (f.stealthTime > 0) ctx.globalAlpha = 0.25;
    if (facing === -1) ctx.scale(-1, 1);

    // Floor Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // W Charge Aura
    if (f.state === 'CHARGE_W') {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(0, -55, 55, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Super Armor Glow
    if (f.superArmorTime > 0 || (f.state === 'DASH' && char.dashHasSuperArmor)) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -50, 50, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Guard Shield
    if (f.state === 'GUARD') {
      ctx.strokeStyle = char.colorTheme.primary;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(30, -50, 38, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
    }

    // Hit Flash
    if (f.hitFlashTime > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, -50, 45, 0, Math.PI * 2);
      ctx.fill();
    }

    // DRAW UNIQUE FIGHTER SPRITE
    this.renderUniqueFighter(f);

    // DRAW 3-HIT COMBO STRIKE FEEDBACK (J1, J2, J3) OR DISTINCT SKILLS & ULTIMATE VFX
    if (f.state === 'ATTACK' && f.currentSkill?.id === 'J') {
      this.drawDistinctNormalCombo(f);
    } else if (f.state === 'ATTACK' && f.currentSkill) {
      this.drawDistinctSkillAnimation(f);
    }

    // DRAW SHADOW CLONES IF NHẬT BẢN ACTIVE
    if (id === 'nhat_ban' && f.shadowClonesCount > 0) {
      this.drawNinjaShadowClones(f);
    }

    ctx.restore();
  }

  /**
   * Draw distinctive visual sprites and signature silhouettes for each fighter
   */
  private renderUniqueFighter(f: FighterEntity) {
    const ctx = this.ctx;
    const char = f.character;
    const id = char.id;
    const state = f.state;
    const tick = this.animTick;

    let bob = state === 'WALK' ? Math.sin(tick * 0.35) * 6 : Math.sin(tick * 0.1) * 2;
    if (state === 'JUMP') bob = -14;
    if (state === 'FALL') bob = 8;
    if (f.trappedTime > 0) bob = 20; // Quỳ lạy figure

    // Legs
    ctx.fillStyle = '#111827';
    ctx.fillRect(-14, bob - 36, 12, 38);
    ctx.fillRect(4, bob - 38, 12, 40);

    if (id === 'hoang_saigon') {
      // 1. HOÀNG SÀI GÒN - Sumo khổng lồ & Mawashi đỏ
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.ellipse(0, bob - 60, 36, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      // Mawashi Sumo Belt
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-34, bob - 45, 68, 18);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-12, bob - 45, 24, 22);
      // Sumo Arms
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(15, bob - 70, 26, 16);
      // Topknot Chonmage Hair
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(0, bob - 105, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'kendu') {
      // 2. KENDU - Hip-hop hoodie, tai nghe, mũ snapback, găng boxing (Người da màu da nâu #795548)
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-16, bob - 74, 32, 40);
      // Brown skin neck
      ctx.fillStyle = '#795548';
      ctx.fillRect(-6, bob - 80, 12, 10);
      // Brown skin arm leading to gloves
      ctx.fillStyle = '#795548';
      ctx.fillRect(8, bob - 66, 12, 10);
      // Red gloves
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(22, bob - 60, 14, 0, Math.PI * 2);
      ctx.fill();
      // Snapback cap backwards
      ctx.fillStyle = '#0369a1';
      ctx.fillRect(-18, bob - 98, 36, 10);
      // Headphones
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, bob - 90, 16, Math.PI, 0);
      ctx.stroke();
    } else if (id === 'le_dao') {
      // 3. LÊ ĐÀO - Khung xương hoàng kim, kiếm xương
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-14, bob - 75, 28, 42);
      // Draw 12 Ribs along torso
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      const ribsCount = Math.min(6, Math.ceil(f.ribBonesAvailable / 2));
      for (let i = 0; i < ribsCount; i++) {
        ctx.beginPath();
        ctx.arc(0, bob - 72 + i * 7, 16, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      // Dual Bone Swords
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(10, bob - 60);
      ctx.lineTo(65, bob - 65);
      ctx.stroke();
    } else if (id === 'khoa_pug') {
      // 4. KHOA PUG - Áo hoodie hồng, ôm Gối Ôm Waifu
      ctx.fillStyle = '#db2777';
      ctx.fillRect(-15, bob - 74, 30, 40);
      // Body Pillow (Dakimakura)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(8, bob - 82, 26, 64);
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, bob - 82, 26, 64);
      // Waifu Face on Pillow
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(21, bob - 62, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (id === 'nhat_ban') {
      // 5. NHẬT BẢN - Ninja khăn đen tím, vuốt kim loại phát sáng
      ctx.fillStyle = '#581c87';
      ctx.fillRect(-14, bob - 74, 28, 40);
      // Ninja Claws
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(15, bob - 64);
      ctx.lineTo(46, bob - 64);
      ctx.moveTo(15, bob - 58);
      ctx.lineTo(48, bob - 58);
      ctx.stroke();
    } else if (id === 'hung_chimbay') {
      // 6. HÙNG CHIM BAY - Áo boxer xanh lá & Đôi Cánh Đại Bàng Khổng Lồ (Flapping + Aerodynamics)
      ctx.fillStyle = '#15803d';
      ctx.fillRect(-15, bob - 74, 30, 40);
      const isAir = !f.isGrounded;
      const wingSpread = isAir ? 95 : 75;
      const flapY = isAir ? Math.sin(tick * 0.45) * 16 : 0;
      // Giant Wings
      ctx.fillStyle = '#16a34a';
      ctx.beginPath();
      ctx.moveTo(0, bob - 75);
      ctx.quadraticCurveTo(wingSpread * 0.65, bob - 110 + flapY, wingSpread, bob - 50 + flapY);
      ctx.quadraticCurveTo(wingSpread * 0.4, bob - 30 + flapY, 0, bob - 55);
      ctx.fill();
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (isAir) {
        // Air Drift aerodynamic jet stream
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-15, bob - 40);
        ctx.lineTo(-45, bob - 35);
        ctx.moveTo(-10, bob - 65);
        ctx.lineTo(-40, bob - 60);
        ctx.stroke();
      }
    } else if (id === 'hoang_xitrum') {
      // 7. HOÀNG XÌ TRUM - Võ phục Taekwondo đai đen, chân dài 1m8
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-15, bob - 74, 30, 40);
      ctx.fillStyle = '#000000';
      ctx.fillRect(-16, bob - 46, 32, 6); // Black Belt
      // Taekwondo Extended Kicking Leg
      if (f.state === 'ATTACK') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(10, bob - 50, 45, 12);
      }
    } else if (id === 'bao_ren') {
      // 8. BẢO REN - Áo choàng Creepypasta huyền bí, mắt đỏ rực
      ctx.fillStyle = '#18181b';
      ctx.fillRect(-15, bob - 75, 30, 44);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(8, bob - 92, 5, 3);
    }

    // Head (KenDu is black / dark brown skinned: #795548)
    const skinTone = id === 'kendu' ? '#795548' : '#fed7aa';
    ctx.fillStyle = skinTone;
    ctx.beginPath();
    ctx.arc(0, bob - 90, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Signature 3-Hit Combo Normal Attack (J1 -> J2 -> J3) Visuals Distinct for All 8 Fighters!
   */
  private drawDistinctNormalCombo(f: FighterEntity) {
    const ctx = this.ctx;
    const step = f.normalComboStep;
    const id = f.character.id;

    ctx.save();

    if (id === 'hoang_saigon') {
      // Hoàng Sài Gòn: Sumo Palms & Slaps
      if (step === 0) {
        // J1: Giant Sumo Slap shockwave
        ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.beginPath();
        ctx.arc(45, -55, 30, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        ctx.stroke();
      } else if (step === 1) {
        // J2: Belly thrust shockwave
        ctx.fillStyle = 'rgba(234, 88, 12, 0.5)';
        ctx.fillRect(20, -70, 50, 35);
      } else {
        // J3: Double Palm Quake slamming down
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(30, -85);
        ctx.lineTo(75, -20);
        ctx.stroke();
      }
    } else if (id === 'kendu') {
      // KenDu: Beatbox Shockwaves & Notes
      if (step === 0) {
        // J1: Sound wave ring + "PSH!"
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(45, -58, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('PSH!', 55, -70);
      } else if (step === 1) {
        // J2: Cyan Hook Arc + "TSK!"
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(35, -50, 35, -Math.PI * 0.5, Math.PI * 0.3);
        ctx.stroke();
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText('TSK!', 60, -55);
      } else {
        // J3: 360 Spin Kick with Bass Drop Circle & Music Notes
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(40, -45, 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#ffea00';
        ctx.fillText('♪ BASS DROP! ♫', 30, -95);
      }
    } else if (id === 'le_dao') {
      // Lê Đào: Golden Bone Blades & Claymore
      if (step === 0) {
        // J1: Bone Dagger Slash
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(15, -60);
        ctx.lineTo(65, -50);
        ctx.stroke();
      } else if (step === 1) {
        // J2: Golden X-Cross Slashes
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(15, -75);
        ctx.lineTo(70, -35);
        ctx.moveTo(15, -35);
        ctx.lineTo(70, -75);
        ctx.stroke();
      } else {
        // J3: Giant Golden Claymore Vertical Split
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(40, -110);
        ctx.lineTo(75, 5);
        ctx.stroke();
      }
    } else if (id === 'khoa_pug') {
      // Khoa Pug: Waifu Pillow Slaps & Hearts
      if (step === 0) {
        // J1: Soft pillow slap + Heart
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(50, -60, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '14px sans-serif';
        ctx.fillText('♥', 65, -70);
      } else if (step === 1) {
        // J2: Dual pillow spin + Feathers
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(45, -55, 35, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
      } else {
        // J3: Mega Squishy Pillow Downward Bounce
        ctx.fillStyle = 'rgba(236, 72, 153, 0.6)';
        ctx.fillRect(30, -50, 50, 45);
        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('BÚN NẨY!', 40, -60);
      }
    } else if (id === 'nhat_ban') {
      // Nhật Bản: Purple Poison Claws
      if (step === 0) {
        // J1: Single purple claw swipe
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(10, -58);
        ctx.lineTo(65, -58);
        ctx.stroke();
      } else if (step === 1) {
        // J2: Double claw X-slash
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(15, -70);
        ctx.lineTo(65, -40);
        ctx.moveTo(15, -40);
        ctx.lineTo(65, -70);
        ctx.stroke();
      } else {
        // J3: 5 Poison Claw Mark Rake
        ctx.strokeStyle = '#7e22ce';
        ctx.lineWidth = 7;
        for (let c = -2; c <= 2; c++) {
          ctx.beginPath();
          ctx.moveTo(20, -55 + c * 8);
          ctx.lineTo(75, -50 + c * 10);
          ctx.stroke();
        }
      }
    } else if (id === 'hung_chimbay') {
      // Hùng Chim Bay: Eagle Wing Slashes
      if (step === 0) {
        // J1: Beak dive strike
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(15, -80);
        ctx.lineTo(65, -45);
        ctx.stroke();
      } else if (step === 1) {
        // J2: Wing Uppercut
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(35, -50, 40, 0, -Math.PI * 0.6, true);
        ctx.stroke();
      } else {
        // J3: Hurricane flap thrust
        ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.beginPath();
        ctx.arc(50, -55, 45, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.fill();
      }
    } else if (id === 'hoang_xitrum') {
      // Hoàng Xì Trum: Taekwondo 1m8 Kicks
      if (step === 0) {
        // J1: Extended low kick
        ctx.strokeStyle = '#00bfa5';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(10, -45);
        ctx.lineTo(80, -45);
        ctx.stroke();
      } else if (step === 1) {
        // J2: High 180 roundhouse kick
        ctx.strokeStyle = '#00897b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(35, -60, 48, -Math.PI * 0.6, Math.PI * 0.2);
        ctx.stroke();
      } else {
        // J3: 1m8 Axe Kick straight down
        ctx.strokeStyle = '#14b8a6';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(50, -115);
        ctx.lineTo(85, 0);
        ctx.stroke();
      }
    } else {
      // Bảo Ren: Dark Shadow Demon runes
      if (step === 0) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(15, -55);
        ctx.lineTo(70, -55);
        ctx.stroke();
      } else if (step === 1) {
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(45, -55, 25, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(185, 28, 28, 0.6)';
        ctx.beginPath();
        ctx.arc(55, -55, 40, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Signature Visual Animations & Effects for Skills (U, I, SU, SI, WU, WI, SJ, WJ)
   * Distinct for All 8 Cao Thủ!
   */
  private drawDistinctSkillAnimation(f: FighterEntity) {
    const ctx = this.ctx;
    const skill = f.currentSkill;
    if (!skill) return;

    const id = f.character.id;
    const sId = skill.id;
    const tick = this.animTick;
    const progress = f.attackDuration > 0 ? f.attackFrame / f.attackDuration : 0;

    ctx.save();

    // 1. HOÀNG SÀI GÒN
    if (id === 'hoang_saigon') {
      if (sId === 'U') {
        // U: Ủi Bụi Mỡ - Sumo Belly Ram with massive shockwaves & falling ceiling stone chunks
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.ellipse(30, -55, 45, 38, 0, 0, Math.PI * 2);
        ctx.fill();
        // Air pressure shockwave arcs
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(35 + i * 20, -55, 25 + i * 15, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.stroke();
        }
        // Falling rocks from ceiling
        ctx.fillStyle = '#78716c';
        for (let r = 0; r < 3; r++) {
          ctx.fillRect(50 + r * 30, -180 + progress * 160 + r * 15, 12, 10);
        }
      } else if (sId === 'I') {
        // I: Bánh Burger Hấp Lực - Golden Throwing Arc & Burger
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(40, -50, 45, -Math.PI * 0.5, 0);
        ctx.stroke();
        // Golden Burger in hand
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(50, -85, 14, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.fillRect(36, -85, 28, 4);
      } else if (sId === 'SU') {
        // SU: Đệm Mỡ Phản Xạ - Expanding rubber trampoline spring rings around belly
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        const springR = 40 + Math.sin(tick * 0.5) * 12;
        ctx.beginPath();
        ctx.arc(0, -55, springR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -55, springR + 10, 0, Math.PI * 2);
        ctx.stroke();
      } else if (sId === 'SI') {
        // SI: Địa Tấn Sumo - Ground fissure & 2 stone walls rising
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(40, 2);
        ctx.lineTo(70, -2);
        ctx.lineTo(120, 0);
        ctx.stroke();
        // Stone Walls erupting
        const wallH = Math.min(65, progress * 110);
        ctx.fillStyle = '#57534e';
        ctx.fillRect(45, -wallH, 22, wallH);
        ctx.fillRect(105, -wallH, 22, wallH);
        ctx.strokeStyle = '#78716c';
        ctx.strokeRect(45, -wallH, 22, wallH);
        ctx.strokeRect(105, -wallH, 22, wallH);
      } else if (sId === 'WU') {
        // WU: Tiêu Hóa Năng Lượng - Golden spiral suction vortex into mouth
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(10, -90);
        ctx.quadraticCurveTo(60, -110, 80, -90);
        ctx.quadraticCurveTo(60, -70, 10, -90);
        ctx.stroke();
        // Golden stomach aura
        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.beginPath();
        ctx.arc(0, -55, 38, 0, Math.PI * 2);
        ctx.fill();
      } else if (sId === 'WI') {
        // WI: Rốn Vũ Trụ - Cosmic Gravitational Black Hole Vortex
        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 4;
        for (let a = 0; a < 3; a++) {
          const r = 25 + a * 20;
          ctx.beginPath();
          ctx.arc(0, -55, r, tick * 0.15 + a, tick * 0.15 + a + Math.PI * 1.4);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(99, 102, 241, 0.35)';
        ctx.beginPath();
        ctx.arc(0, -55, 20, 0, Math.PI * 2);
        ctx.fill();
      } else if (sId === 'SJ') {
        // SJ: Cú Nhấn Đè Bẹp - Flying Horizontal Belly Dive Slam
        ctx.fillStyle = 'rgba(234, 88, 12, 0.45)';
        ctx.beginPath();
        ctx.ellipse(30, -35, 55, 30, 0, 0, Math.PI * 2);
        ctx.fill();
        // Fiery speed streak behind
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-20, -35);
        ctx.lineTo(-70, -35);
        ctx.stroke();
      } else if (sId === 'WJ') {
        // WJ: Đại Bác Mỡ Tạng - Colossal Flaming Sumo Boulder
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.arc(0, -60, 68, 0, Math.PI * 2);
        ctx.fill();
        // Mawashi Sumo belt wrapped around boulder
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-65, -68, 130, 16);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-20, -68, 40, 20);
        // Blazing flame corona
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, -60, 75, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 2. KENDU
    else if (id === 'kendu') {
      if (sId === 'U') {
        // U: Uppercut Kick-Bass - Rising 40Hz Neon Cyan Bass Pillar
        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.fillRect(15, -180, 45, 180);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 4;
        ctx.strokeRect(15, -180, 45, 180);
        // Equalizer frequency bars inside
        for (let b = 0; b < 6; b++) {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(20, -30 - b * 24, 35, 12);
        }
      } else if (sId === 'I') {
        // I: Đĩa Xoay Breakdance - Spinning Vinyl Disc on floor
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.ellipse(0, 0, 65, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 45, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
        // Music Notes
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('♫', -30, -35);
        ctx.fillText('♬', 30, -45);
      } else if (sId === 'SU') {
        // SU: Bàn Trộn DJ Phản Đòn - Twin Spinning Hologram Turntables
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(35, -45, 38, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(2, 132, 199, 0.4)';
        ctx.fill();
      } else if (sId === 'SI') {
        // SI: Quét Sàn Vòng Tròn - Windmill Sweep Arc
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, 65, -Math.PI, 0);
        ctx.stroke();
      } else if (sId === 'WU') {
        // WU: Bật Flow Beatbox - Neon Equalizer Halo & Microphone
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -95, 25, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#00e5ff';
        ctx.fillText('FLOW FREE', -32, -125);
      } else if (sId === 'WI') {
        // WI: Microphones Cable Trap - Cable whip
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(15, -60);
        ctx.lineTo(40, -75);
        ctx.lineTo(80, -45);
        ctx.lineTo(120, -60);
        ctx.stroke();
      } else if (sId === 'SJ') {
        // SJ: Lướt Ván Loa Sub - Riding Subwoofer
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-25, -20, 75, 20);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-25, -20, 75, 20);
      } else if (sId === 'WJ') {
        // WJ: Đại Tiệc B-Boy Underground - Twin Blasting Subwoofers
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-70, -110, 45, 110);
        ctx.fillRect(35, -110, 45, 110);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 4;
        ctx.strokeRect(-70, -110, 45, 110);
        ctx.strokeRect(35, -110, 45, 110);
        // Blasting Bass Cone Rings
        const coneR = (tick * 10) % 80;
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(55, -55, coneR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 3. LÊ ĐÀO
    else if (id === 'le_dao') {
      if (sId === 'U') {
        // U: Trảm Xương Trùng Điệp - Massive Golden Claymore Slash Arc
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.arc(25, -50, 75, -Math.PI * 0.6, Math.PI * 0.4);
        ctx.stroke();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else if (sId === 'I') {
        // I: Mũi Thương Xương Cốt - Piercing Bone Spear Thrust
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(15, -60);
        ctx.lineTo(130, -60);
        ctx.stroke();
        // Spearhead
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.moveTo(130, -70);
        ctx.lineTo(155, -60);
        ctx.lineTo(130, -50);
        ctx.fill();
      } else if (sId === 'SU') {
        // SU: Khung Xương Cốt Khải - 12 Golden Ribs Spherical Cage
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        for (let r = 0; r < 6; r++) {
          ctx.beginPath();
          ctx.arc(0, -50, 45, (r * Math.PI) / 3, (r * Math.PI) / 3 + 0.8);
          ctx.stroke();
        }
      } else if (sId === 'SI') {
        // SI: Rừng Gai Xương Địa Ngục - 6 Bone Spikes Shooting from Floor
        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 2;
        for (let sp = 1; sp <= 5; sp++) {
          const sx = sp * 28;
          ctx.beginPath();
          ctx.moveTo(sx - 10, 0);
          ctx.lineTo(sx, -45 - sp * 6);
          ctx.lineTo(sx + 10, 0);
          ctx.fill();
          ctx.stroke();
        }
      } else if (sId === 'WU') {
        // WU: Tái Tạo Tủy Cốt - Holy Golden Marrow Regeneration Light
        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.fillRect(-25, -120, 50, 120);
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('+HP', -12, -130);
      } else if (sId === 'WI') {
        // WI: Nỏ Xương Liên Hoàn - Bone Crossbow Burst
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(20, -75);
        ctx.lineTo(35, -60);
        ctx.lineTo(20, -45);
        ctx.stroke();
        // 3 Arrows flying
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3;
        for (let a = -1; a <= 1; a++) {
          ctx.beginPath();
          ctx.moveTo(35, -60);
          ctx.lineTo(110, -60 + a * 20);
          ctx.stroke();
        }
      } else if (sId === 'SJ') {
        // SJ: Vũ Điệu Lưỡi Hái Tử Thần - 8 Spinning Golden Scythe Blades
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 6;
        for (let s = 0; s < 4; s++) {
          const ang = tick * 0.3 + (s * Math.PI) / 2;
          ctx.beginPath();
          ctx.arc(0, -50, 60, ang, ang + 0.6);
          ctx.stroke();
        }
      } else if (sId === 'WJ') {
        // WJ: Chiến Thần Xương Hoàng Kim SUSANOO Avatar Greatsword
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(-30, -150);
        ctx.lineTo(160, -20);
        ctx.stroke();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 8;
        ctx.stroke();
      }
    }

    // 4. KHOA PUG
    else if (id === 'khoa_pug') {
      if (sId === 'U') {
        // U: Đập Gối Waifu - Massive Pillow Slam & Hearts
        ctx.fillStyle = '#f472b6';
        ctx.fillRect(20, -65, 45, 65);
        ctx.strokeStyle = '#db2777';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, -65, 45, 65);
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#ec4899';
        ctx.fillText('♥', 50, -75);
      } else if (sId === 'I') {
        // I: Tiếng Thét Tsundere - "BAKA! 💢" Manga Speech Bubble
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(25, -125, 110, 45, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e11d48';
        ctx.font = '900 18px sans-serif';
        ctx.fillText('BAKA! 💢', 38, -95);
      } else if (sId === 'SU') {
        // SU: Lá Chắn Bông Gòn - Fluffy Cotton Candy Cloud
        ctx.fillStyle = 'rgba(244, 114, 182, 0.5)';
        for (let c = 0; c < 4; c++) {
          ctx.beginPath();
          ctx.arc(25 + c * 14, -55 + Math.sin(c) * 10, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (sId === 'SI') {
        // SI: Vấp Cỏ Bất Ngờ - Faceplant Slide & Sweatdrops
        ctx.fillStyle = '#38bdf8';
        ctx.font = '24px sans-serif';
        ctx.fillText('💧', 20, -85);
        ctx.fillText('💧', 45, -70);
      } else if (sId === 'WU') {
        // WU: Treo Poster Waifu - Holy Wall Scroll
        ctx.fillStyle = '#fbcfe8';
        ctx.fillRect(15, -150, 60, 80);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 3;
        ctx.strokeRect(15, -150, 60, 80);
        ctx.fillStyle = '#f43f5e';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('WAIFU', 25, -110);
      } else if (sId === 'WI') {
        // WI: Bẫy Figure Đồ Chơi - Figure Box Hologram
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, -50, 32, 50);
      } else if (sId === 'SJ') {
        // SJ: Phóng Tên Lửa Gối Ôm - Rocket Thruster Flames
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.moveTo(-15, -45);
        ctx.lineTo(-55, -55);
        ctx.lineTo(-55, -35);
        ctx.fill();
      } else if (sId === 'WJ') {
        // WJ: WAIFU BÃO TÁP - Colossal 200px Waifu Dakimakura Crashing Down
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-30, -200, 75, 180);
        ctx.strokeStyle = '#f472b6';
        ctx.lineWidth = 6;
        ctx.strokeRect(-30, -200, 75, 180);
        ctx.fillStyle = '#ec4899';
        ctx.font = '900 24px sans-serif';
        ctx.fillText('♥ WAIFU ♥', -20, -110);
      }
    }

    // 5. NHẬT BẢN
    else if (id === 'nhat_ban') {
      if (sId === 'U') {
        // U: Tam Trảo Lướt Gió - 3 Zigzag Purple Shadow Claw Marks
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 5;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(20 + i * 20, -70 + i * 15);
          ctx.lineTo(60 + i * 20, -40 + i * 15);
          ctx.stroke();
        }
      } else if (sId === 'I') {
        // I: Vết Rách Không Gian - Spatial Dimensional Void Tear
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(40, -110);
        ctx.lineTo(60, -60);
        ctx.lineTo(35, -20);
        ctx.stroke();
        ctx.fillStyle = 'rgba(88, 28, 135, 0.6)';
        ctx.fill();
      } else if (sId === 'SU') {
        // SU: Thuật Thế Thân Gỗ Gòn - Wooden Log Decoy
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-15, -65, 30, 55);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 3;
        ctx.strokeRect(-15, -65, 30, 55);
      } else if (sId === 'SI') {
        // SI: Quét Độc Cận Địa - Venom Puddle on Floor
        ctx.fillStyle = 'rgba(126, 34, 206, 0.6)';
        ctx.fillRect(0, -8, 90, 8);
      } else if (sId === 'WU') {
        // WU: Phân Thân Ảo Ảnh - Shadow Clones Aura
        ctx.fillStyle = 'rgba(88, 28, 135, 0.45)';
        ctx.fillRect(-30, -80, 20, 45);
        ctx.fillRect(30, -80, 20, 45);
      } else if (sId === 'WI') {
        // WI: Mưa Phi Tiêu Shuriken - Fan of Shurikens
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 3;
        for (let sk = -2; sk <= 2; sk++) {
          ctx.beginPath();
          ctx.arc(60, -60 + sk * 16, 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (sId === 'SJ') {
        // SJ: Bóng Ma Đột Kích - Shadow Dash Beam
        ctx.strokeStyle = '#7e22ce';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(0, -50);
        ctx.lineTo(140, -50);
        ctx.stroke();
      } else if (sId === 'WJ') {
        // WJ: LÃNH ĐỊA MA TRẢO VÔ HẠN - Screen Slash Matrix
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 4;
        for (let sl = -3; sl <= 3; sl++) {
          ctx.beginPath();
          ctx.moveTo(-100 + sl * 40, -140);
          ctx.lineTo(140 + sl * 40, 20);
          ctx.stroke();
        }
      }
    }

    // 6. HÙNG CHIM BAY
    else if (id === 'hung_chimbay') {
      if (sId === 'U') {
        // U: Mỏ Đại Bàng Mổ Nát - Twin Emerald Talon Blades
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(20, -75);
        ctx.lineTo(75, -50);
        ctx.moveTo(20, -45);
        ctx.lineTo(75, -70);
        ctx.stroke();
      } else if (sId === 'I') {
        // I: Thiên Thạch Trút Xuống - Blazing Comet Dive
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(35, -45, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 4;
        ctx.stroke();
      } else if (sId === 'SU') {
        // SU: Đôi Cánh Thép - Steel Feather Barrier
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, -50, 48, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.stroke();
      } else if (sId === 'SI') {
        // SI: Gió Quét Sát Đất - Horizontal Gale Wave
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(10, -5);
        ctx.lineTo(100, -5);
        ctx.stroke();
      } else if (sId === 'WU') {
        // WU: Chao Lượn Bão Tố - Ascending Feather Spiral
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -60, 40, 0, Math.PI * 2);
        ctx.stroke();
      } else if (sId === 'WI') {
        // WI: Lốc Xoáy Bẫy Lông Vũ - Emerald Mini-Cyclone
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 4;
        for (let l = 1; l <= 3; l++) {
          ctx.beginPath();
          ctx.ellipse(55, -20 - l * 20, 15 + l * 8, 8, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else if (sId === 'SJ') {
        // SJ: Bổ Nhào Tốc Độ Âm Thanh - Supersonic Mach Cone Rings
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(60, -50, 30, -Math.PI * 0.4, Math.PI * 0.4);
        ctx.stroke();
      } else if (sId === 'WJ') {
        // WJ: SIÊU BÃO ĐẠI BÀNG KHÔNG GIAN - Giant Celestial Emerald Eagle Dive
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.moveTo(0, -130);
        ctx.lineTo(120, -50);
        ctx.lineTo(0, 30);
        ctx.fill();
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 8;
        ctx.stroke();
      }
    }

    // 7. HOÀNG XÌ TRUM
    else if (id === 'hoang_xitrum') {
      if (sId === 'U') {
        // U: Liên Hoàn Cước 1m8 - Multi-kick Afterimages
        ctx.strokeStyle = '#00bfa5';
        ctx.lineWidth = 6;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(15, -45 - k * 12);
          ctx.lineTo(75, -45 - k * 12);
          ctx.stroke();
        }
      } else if (sId === 'I') {
        // I: Song Phi Hất Văng - Double Flying Dropkick
        ctx.strokeStyle = '#14b8a6';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(10, -60);
        ctx.lineTo(95, -40);
        ctx.moveTo(10, -40);
        ctx.lineTo(95, -20);
        ctx.stroke();
      } else if (sId === 'SU') {
        // SU: Kẹp Cổ Bằng Chân - Scissor Leg Circle
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(45, -70, 32, 0, Math.PI * 2);
        ctx.stroke();
      } else if (sId === 'SI') {
        // SI: Gạt Chân Trượt Băng - Ice Slide Sparks
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(10, -2);
        ctx.lineTo(110, -2);
        ctx.stroke();
      } else if (sId === 'WU') {
        // WU: Hò Hét Tăng Chiều Dài Chân - Stretching Aura
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.strokeRect(-16, -38, 32, 42);
      } else if (sId === 'WI') {
        // WI: Mèo Ném Phân Tầm Xa - Stink Fumes
        ctx.strokeStyle = '#a3e635';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(40, -40);
        ctx.quadraticCurveTo(60, -60, 80, -40);
        ctx.stroke();
      } else if (sId === 'SJ') {
        // SJ: Cước Vươn Dài 4 Mét - Cartoonishly Extended 4-Meter Leg!
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(10, -50, 180, 16);
        ctx.fillStyle = '#111827';
        ctx.fillRect(185, -53, 24, 22); // Giant Sneaker
      } else if (sId === 'WJ') {
        // WJ: COMBO VÕ ĐÀI ĐỈNH CAO & MÈO ĐIÊN - Lightning Axe Kick & Paw Claws
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(40, -160);
        ctx.lineTo(85, 0);
        ctx.stroke();
        ctx.font = '24px sans-serif';
        ctx.fillText('🐾', 65, -80);
      }
    }

    // 8. BẢO REN
    else if (id === 'bao_ren') {
      if (sId === 'U') {
        // U: Bàn Tay Quỷ Đoạt Hồn - Giant Red Shadow Hand
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.moveTo(15, -60);
        ctx.lineTo(100, -85);
        ctx.lineTo(125, -60);
        ctx.lineTo(100, -35);
        ctx.fill();
      } else if (sId === 'I') {
        // I: Tiếng Hú Creepypasta - Distorted Red Scream Rings
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 5;
        for (let sc = 1; sc <= 3; sc++) {
          ctx.beginPath();
          ctx.arc(35, -85, sc * 22, -Math.PI * 0.4, Math.PI * 0.4);
          ctx.stroke();
        }
      } else if (sId === 'SU') {
        // SU: Trận Pháp Huyết Tế - Red Blood Pentagram
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.stroke();
      } else if (sId === 'SI') {
        // SI: Vũng Máu Ma Quái - Dark Crimson Floor Puddle
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(0, -6, 110, 6);
      } else if (sId === 'WU') {
        // WU: Lời Nguyền Hắc Ám - 3 Orbiting Cursed Red Eyes
        ctx.fillStyle = '#ef4444';
        for (let e = 0; e < 3; e++) {
          const eyA = tick * 0.15 + (e * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(Math.cos(eyA) * 35, -60 + Math.sin(eyA) * 20, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (sId === 'WI') {
        // WI: Bàn Thờ Cổ Tích Tụ - Ghostly Ancestral Shrine
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(35, -45, 30, 45);
      } else if (sId === 'SJ') {
        // SJ: Phóng Búp Bê Quỷ - Demonic Doll Flying
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(65, -55, 14, 0, Math.PI * 2);
        ctx.fill();
      } else if (sId === 'WJ') {
        // WJ: NGÀY TẬN THẾ SKIBIDI CREEPYPASTA - Giant Red Nuclear Laser Beams
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(20, -95, 220, 28);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(20, -81);
        ctx.lineTo(240, -81);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Draw Visual Stack Trackers Above Fighters
   */
  private drawGimmickStacks(f: FighterEntity) {
    const ctx = this.ctx;
    const char = f.character;
    const id = char.id;

    ctx.save();
    ctx.translate(f.x, f.y - 125);

    // 1. NHẬT BẢN: POISON CLAW STACKS (1/5 to 5/5)
    if (f.poisonClawStacks > 0) {
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      for (let i = 0; i < 5; i++) {
        const isFilled = i < f.poisonClawStacks;
        ctx.fillStyle = isFilled ? '#c084fc' : '#4b5563';
        ctx.fillText('爪', -24 + i * 12, -5);
      }
      ctx.fillStyle = '#e9d5ff';
      ctx.fillText(`${f.poisonClawStacks}/5`, 0, 10);
    }

    // 2. KHOA PUG: WIBU STACKS (1x ♥ to 5x ♥)
    if (f.wibuStacks > 0) {
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      let hearts = '';
      for (let i = 0; i < f.wibuStacks; i++) hearts += '♥';
      ctx.fillStyle = '#ec4899';
      ctx.fillText(hearts, 0, -8);
      ctx.fillStyle = '#fbcfe8';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`Wibu: ${f.wibuStacks}/5`, 0, 8);
    }

    // 3. LÊ ĐÀO: 12 XƯƠNG HOÀNG KIM
    if (id === 'le_dao') {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`Cốt Khải: ${f.ribBonesAvailable}/12 🦴`, 0, -8);
    }

    // 4. HOÀNG SÀI GÒN: CÂN NẶNG & GIÁP
    if (id === 'hoang_saigon' && f.hoangScaleBonus > 1.0) {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f59e0b';
      const pct = Math.round((f.hoangScaleBonus - 1) * 100);
      ctx.fillText(`MỠ TẠNG: +${pct}% SIZE · +${Math.round(f.hoangArmorBonus * 100)}% GIÁP`, 0, -10);
    }

    // 5. KENDU: BEATBOX EQUALIZER
    if (id === 'kendu') {
      for (let bar = -3; bar <= 3; bar++) {
        const barH = 5 + Math.abs(Math.sin((this.animTick * 0.2) + bar)) * 12;
        ctx.fillStyle = bar % 2 === 0 ? '#38bdf8' : '#00e5ff';
        ctx.fillRect(bar * 6 - 2, -15 - barH, 4, barH);
      }
    }

    // 6. HÙNG CHIM BAY: AIR DRIFT GAUGE & STATUS
    if (id === 'hung_chimbay') {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const pct = Math.round(f.airDriftCharge || 0);
      ctx.fillStyle = f.isGrounded ? '#86efac' : '#22c55e';
      ctx.fillText(`AIR DRIFT: ${pct}% ${f.isGrounded ? '(Sàn)' : '🦅 (BAY +35% DMG)'}`, 0, -12);
      // Gauge bar
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-25, -6, 50, 5);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-25, -6, (pct / 100) * 50, 5);
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 1;
      ctx.strokeRect(-25, -6, 50, 5);
    }

    ctx.restore();
  }

  private drawNinjaShadowClones(f: FighterEntity) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.45;
    [-35, 35].forEach((offset) => {
      ctx.save();
      ctx.translate(offset, 0);
      ctx.fillStyle = '#581c87';
      ctx.fillRect(-12, -70, 24, 38);
      ctx.restore();
    });
    ctx.restore();
  }

  /**
   * Draw Pet Mèo of Hoàng Xì Trum
   */
  private drawPets(p1: FighterEntity, p2: FighterEntity) {
    [p1, p2].forEach((f) => {
      if (f.character.id === 'hoang_xitrum' && f.petCat) {
        const cat = f.petCat;
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(cat.x, cat.y);
        if (cat.facing === -1) ctx.scale(-1, 1);

        // Cat body
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.ellipse(0, -10, 14, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(10, -16, 8, 0, Math.PI * 2);
        ctx.fill();
        // Ears
        ctx.fillStyle = '#ea580c';
        ctx.beginPath();
        ctx.moveTo(7, -22);
        ctx.lineTo(11, -28);
        ctx.lineTo(14, -22);
        ctx.fill();
        // Tail
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, -10);
        ctx.quadraticCurveTo(-18, -20, -14, -24);
        ctx.stroke();

        // Bowling slide motion blur
        if (cat.state === 'bowl_slide') {
          ctx.strokeStyle = 'rgba(234, 88, 12, 0.4)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(-25, -10);
          ctx.lineTo(-5, -10);
          ctx.stroke();
        }

        ctx.restore();
      }
    });
  }

  /**
   * Draw Projectiles, Summons & Gimmick Entities with Full Visual Fidelity:
   * Burger King, Loa Thùng, Figure Anime, Spring Pillow, Crossbow Arrows, Bone Spikes,
   * Shurikens, Green Tornado, Feather Traps, Cat Poop, Doraemon.exe, Sonic.exe, Bàn Thờ, Skibidi.
   */
  private drawProjectiles(projectiles: Projectile[]) {
    const ctx = this.ctx;
    const tick = this.animTick;

    projectiles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);

      if (p.isPickupBurger) {
        // BURGER KING PICKUP (Hoàng Sài Gòn Chiêu 2)
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(0, -12, 16, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#451a03';
        ctx.fillRect(-15, -12, 30, 5);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-15, -7, 30, 3);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-14, -4, 28, 5);
      } else if (p.isSpeakerPulse) {
        // LOA THÙNG (KenDu Chiêu 4)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-20, -48, 40, 48);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 2;
        ctx.strokeRect(-20, -48, 40, 48);
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, -24, 14, 0, Math.PI * 2);
        ctx.fill();
        const ringR = (tick * 2.5) % 55;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.beginPath();
        ctx.arc(0, -24, ringR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.isSpringBounce) {
        // GỐI ĐỆM NẨY TƯNG (Khoa Pug Chiêu 1)
        ctx.fillStyle = '#f472b6';
        ctx.beginPath();
        ctx.roundRect(-30, -18, 60, 18, 8);
        ctx.fill();
        ctx.strokeStyle = '#db2777';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText('NẨY TƯNG', 0, -6);
      } else if (p.isFigureTrap) {
        // FIGURE BẪY ĐỒ CHƠI (Khoa Pug Chiêu 4)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-16, -42, 32, 42);
        ctx.strokeStyle = '#ec4899';
        ctx.lineWidth = 2;
        ctx.strokeRect(-16, -42, 32, 42);
        // Chibi figure doll inside
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(0, -28, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(-6, -21, 12, 14);
      } else if (p.isPillowRocket) {
        // TÊN LỬA GỐI ÔM (Khoa Pug Chiêu 7)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-24, -14, 48, 28);
        ctx.strokeStyle = '#f472b6';
        ctx.strokeRect(-24, -14, 48, 28);
        // Rocket thruster exhaust
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(-24, -10);
        ctx.lineTo(-42, 0);
        ctx.lineTo(-24, 10);
        ctx.fill();
      } else if (p.isBoneSpikes) {
        // RỪNG GAI XƯƠNG (Lê Đào Chiêu 4)
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.moveTo(-18, 0);
        ctx.lineTo(-10, -45);
        ctx.lineTo(0, -15);
        ctx.lineTo(10, -48);
        ctx.lineTo(18, 0);
        ctx.fill();
      } else if (p.isCrossbowArrow) {
        // TÊN XƯƠNG NỎ (Lê Đào Chiêu 6)
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-18, -4, 36, 8);
        ctx.beginPath();
        ctx.moveTo(18, -8);
        ctx.lineTo(28, 0);
        ctx.lineTo(18, 8);
        ctx.fill();
      } else if (p.isShuriken) {
        // SHURIKEN NINJA (Nhật Bản Chiêu 6)
        ctx.save();
        ctx.rotate((tick * 0.4) % (Math.PI * 2));
        ctx.fillStyle = '#c084fc';
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-5, -14);
          ctx.lineTo(0, -18);
          ctx.lineTo(5, -14);
          ctx.fill();
        }
        ctx.restore();
      } else if (p.isTornado) {
        // CƠN LỐC CÁNH CHIM (Hùng Chim Bay Chiêu 4)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
        for (let l = 0; l < 4; l++) {
          const w = 25 + l * 10;
          ctx.beginPath();
          ctx.ellipse(0, -l * 22 - 10, w, 8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.isFeatherTrap) {
        // BẪY LÔNG VŨ (Hùng Chim Bay Chiêu 6)
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-8, -28);
        ctx.lineTo(0, -32);
        ctx.lineTo(8, -28);
        ctx.fill();
      } else if (p.isCatPoop) {
        // BẪY PHÂN MÈO (Hoàng Xì Trum Chiêu 6)
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.ellipse(0, -5, 12, 6, 0, 0, Math.PI * 2);
        ctx.ellipse(0, -10, 8, 5, 0, 0, Math.PI * 2);
        ctx.ellipse(0, -14, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#84cc16';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (p.isDoraemon) {
        // DORAEMON.EXE (Bảo Ren Chiêu 1)
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath();
        ctx.arc(0, -22, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-8, -28, 4, 4);
        ctx.fillRect(4, -28, 4, 4);
      } else if (p.isSonicExe) {
        // SONIC.EXE (Bảo Ren Chiêu 2)
        ctx.fillStyle = '#991b1b';
        ctx.beginPath();
        ctx.arc(0, -20, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f87171';
        ctx.fillRect(-6, -24, 4, 4);
        ctx.fillRect(4, -24, 4, 4);
      } else if (p.isMiniSkibidi) {
        // SKIBIDI MINI (Bảo Ren Chiêu 4)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-14, -24, 28, 24);
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(0, -32, 9, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.isBanTho) {
        // BÀN THỜ CỔ CÓ BÁNH XE (Bảo Ren Chiêu 7)
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(-30, -35, 60, 25);
        ctx.fillStyle = '#18181b';
        ctx.beginPath();
        ctx.arc(-22, 0, 7, 0, Math.PI * 2);
        ctx.arc(22, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-6, -42, 12, 7);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-20, -48, 5, 13);
        ctx.fillRect(15, -48, 5, 13);
      } else if (p.isGiantUlti) {
        // SKIBIDI TOILET BỰ (Bảo Ren Chiêu 8 Ulti)
        ctx.scale(2.2, 2.2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-35, -55, 70, 55);
        ctx.fillStyle = '#fed7aa';
        ctx.beginPath();
        ctx.arc(0, -75, 20, 0, Math.PI * 2);
        ctx.fill();
        // Red laser eyes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-8, -80, 5, 5);
        ctx.fillRect(4, -80, 5, 5);
      } else {
        // Generic Projectile
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    });
  }

  /**
   * Draw Particles
   */
  private drawParticles(particles: Particle[]) {
    const ctx = this.ctx;
    particles.forEach((pt) => {
      if (!pt.active) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /**
   * Draw Floating Damage Text
   */
  private drawDamageTexts(texts: DamageText[]) {
    const ctx = this.ctx;
    texts.forEach((dt) => {
      ctx.save();
      const alpha = dt.alpha !== undefined ? dt.alpha : (dt.maxLife > 0 ? dt.life / dt.maxLife : 1);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.font = dt.isCrit ? 'bold 20px sans-serif' : 'bold 16px sans-serif';
      ctx.fillStyle = dt.color;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(dt.text, dt.x, dt.y);
      ctx.fillText(dt.text, dt.x, dt.y);
      ctx.restore();
    });
  }

  /**
   * Debug Hitbox Visualizer in Training
   */
  private drawDebugBoxes(
    p1: FighterEntity,
    p2: FighterEntity,
    hitboxes: Hitbox[],
    projectiles: Projectile[]
  ) {
    const ctx = this.ctx;
    // Green hurtboxes
    [p1, p2].forEach((f) => {
      const hb = getFighterHurtbox(f);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.strokeRect(hb.x, hb.y, hb.w, hb.h);
    });

    // Red hitboxes
    hitboxes.forEach((h) => {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(h.x, h.y, h.w, h.h);
    });

    // Yellow projectile boxes
    projectiles.forEach((p) => {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
    });
  }
}
