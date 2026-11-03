/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapData, MapId } from './types';

export const MAPS: Record<MapId, MapData> = {
  loi_dai: {
    id: 'loi_dai',
    name: 'Đại Hội Võ Lâm',
    vietnameseName: 'Lôi Đài Bát Đại Cao Thủ',
    themeDesc: 'Võ đài cổ truyền uy nghiêm với rồng vàng, lồng đèn đỏ và các mái lầu cao hai bên.',
    bgColor: '#0a0d18',
    floorY: 540,
    platforms: [
      { x: 150, y: 410, w: 220, h: 18, label: 'Mái Lầu Tây' },
      { x: 830, y: 410, w: 220, h: 18, label: 'Mái Lầu Đông' },
      { x: 480, y: 300, w: 240, h: 18, label: 'Đài Đỉnh Phong' },
    ],
  },
  nguyen_hue: {
    id: 'nguyen_hue',
    name: 'Phố Đi Bộ Nguyễn Huệ',
    vietnameseName: 'Phố Đi Bộ Nguyễn Huệ (Sài Gòn)',
    themeDesc: 'Trực diện Bitexco hoa lệ, ánh đèn neon lung linh, bồn hoa nghệ thuật và đài phun nước biểu diễn.',
    bgColor: '#0b1022',
    floorY: 540,
    platforms: [
      { x: 170, y: 430, w: 210, h: 18, label: 'Bồn Hoa Cảnh' },
      { x: 820, y: 430, w: 210, h: 18, label: 'Bục Đèn LED' },
      { x: 460, y: 320, w: 280, h: 20, label: 'Đài Phun Nước Nhạc Nước' },
    ],
  },
  chau_phi: {
    id: 'chau_phi',
    name: 'Châu Phi Safari',
    vietnameseName: 'Xavan Hoang Dã Châu Phi',
    themeDesc: 'Đất đỏ châu Phi dưới ánh hoàng hôn sa mạc, nhánh cây Bao Báp đại ngàn và mỏm đá chúa sơn lâm.',
    bgColor: '#260e05',
    floorY: 540,
    platforms: [
      { x: 130, y: 390, w: 260, h: 18, label: 'Cành Cây Bao Báp' },
      { x: 810, y: 420, w: 230, h: 22, label: 'Mỏm Đá Sư Tử' },
      { x: 490, y: 280, w: 220, h: 18, label: 'Tổ Chim Đại Bàng' },
    ],
  },
  nhat_ban_sakura: {
    id: 'nhat_ban_sakura',
    name: 'Nhật Bản Sakura',
    vietnameseName: 'Đền Thần Đạo Tokyo Hoa Anh Đào',
    themeDesc: 'Cổng Torii đỏ rực giữa rừng hoa anh đào rơi lãng mạn, mái ngói chùa cổ kính và lầu chuông thanh tịnh.',
    bgColor: '#16091d',
    floorY: 540,
    platforms: [
      { x: 150, y: 400, w: 220, h: 18, label: 'Xà Ngang Cổng Torii' },
      { x: 820, y: 390, w: 220, h: 18, label: 'Mái Đền Thần Đạo' },
      { x: 480, y: 290, w: 240, h: 18, label: 'Lầu Chuông Thanh Tịnh' },
    ],
  },
};
