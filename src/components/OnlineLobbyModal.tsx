/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CharacterId, MapId } from '../game/types';
import { CHARACTERS } from '../game/characters';
import { MAPS } from '../game/maps';
import { NetworkManager, RoomParticipant } from '../game/network';
import { Copy, Check, Users, Globe, ArrowLeft, Swords, Shield, Sparkles } from 'lucide-react';
import { sound } from '../game/sound';

interface OnlineLobbyModalProps {
  initialRoomCode?: string;
  onStartOnlineMatch: (
    p1Char: CharacterId,
    p2Char: CharacterId,
    mapId: MapId,
    roomCode: string,
    isHost: boolean,
    netManager: NetworkManager
  ) => void;
  onBack: () => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  initialRoomCode,
  onStartOnlineMatch,
  onBack,
}) => {
  const [netManager] = useState<NetworkManager>(() => new NetworkManager());
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || '');
  const [inputCode, setInputCode] = useState<string>('');
  const [inLobby, setInLobby] = useState<boolean>(false);
  const [isHost, setIsHost] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Selection
  const [myChar, setMyChar] = useState<CharacterId>('hoang_saigon');
  const [selectedMap, setSelectedMap] = useState<MapId>('nguyen_hue');
  const [isReady, setIsReady] = useState<boolean>(false);

  // Room Participants
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Sẵn sàng');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const charList = Object.values(CHARACTERS);
  const mapList = Object.values(MAPS);

  const characterOf = (id?: string | null) => CHARACTERS[id as CharacterId] || CHARACTERS.hoang_saigon;

  // Setup Network Listeners
  useEffect(() => {
    netManager.onRoomUpdate = (updatedParticipants, mapId) => {
      setParticipants(updatedParticipants);
      if (mapId) setSelectedMap(mapId);
      setIsHost(netManager.isHost);
      setErrorMsg(null);
    };

    netManager.onError = (message) => {
      setConnectionStatus(message);
      setErrorMsg(message);
    };

    // ĐỒNG BỘ CHUẨN: Khi nhận lệnh bắt đầu từ Server, quy chuẩn P1 là Host và P2 là Guest cho CẢ 2 MÁY
    netManager.onMatchStart = (finalMapId) => {
      sound.playHit('crit');

      const hostP = netManager.currentParticipants.find((p) => p.isHost);
      const guestP = netManager.currentParticipants.find((p) => !p.isHost);

      const hostChar = hostP?.characterId || (netManager.isHost ? myChar : netManager.opponentCharacter);
      const guestChar = guestP?.characterId || (!netManager.isHost ? myChar : netManager.opponentCharacter);

      onStartOnlineMatch(
        hostChar,
        guestChar,
        finalMapId || selectedMap,
        netManager.roomId,
        netManager.isHost,
        netManager
      );
    };

    netManager.onConnectionChange = (connected) => {
      setConnectionStatus(connected ? 'Đã kết nối máy chủ Realtime' : 'Mất kết nối máy chủ');
    };

    if (initialRoomCode) {
      handleJoin(initialRoomCode);
    }
  }, [netManager, myChar, selectedMap, onStartOnlineMatch, initialRoomCode]);

  const handleCreate = async () => {
    sound.playDash();
    setErrorMsg(null);
    try {
      const code = await netManager.createRoom(myChar, selectedMap);
      setRoomCode(code);
      setIsHost(true);
      setInLobby(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không tạo được phòng đấu.');
      setIsHost(false);
    }
  };

  const handleJoin = async (targetCode: string) => {
    if (!targetCode || targetCode.length < 4) return;
    sound.playDash();
    setErrorMsg(null);
    const code = targetCode.toUpperCase().trim();
    try {
      await netManager.joinRoom(code, myChar);
      setRoomCode(code);
      setIsHost(netManager.isHost);
      setInLobby(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Không vào được phòng này.');
      setIsHost(false);
    }
  };

  const handleCharSelect = (charId: CharacterId) => {
    setMyChar(charId);
    sound.playHit('light');
    if (inLobby) {
      netManager.selectCharacter(charId);
    }
  };

  const handleMapSelect = (mapId: MapId) => {
    if (!isHost) return;
    setSelectedMap(mapId);
    sound.playHit('light');
    if (inLobby) {
      netManager.selectMap(mapId);
    }
  };

  const handleToggleReady = () => {
    const nextReady = !isReady;
    setIsReady(nextReady);
    sound.playHit(nextReady ? 'heavy' : 'light');
    netManager.setReady(nextReady);
  };

  const handleHostStart = () => {
    sound.playHit('crit');
    // Gửi tín hiệu lên Server để Server Broadcast lệnh match_started cho cả 2 máy cùng lúc
    netManager.requestStartMatch();
  };

  const copyRoomCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    if (!roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const myParticipant = participants.find((p) => p.id === netManager.peerId);
  const oppParticipant = participants.find((p) => p.id !== netManager.peerId);
  const p1CharData = characterOf(isHost ? myChar : oppParticipant?.characterId || 'hoang_saigon');
  const p2CharData = characterOf(!isHost ? myChar : oppParticipant?.characterId || 'kendu');

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-gradient-to-b from-[#060810] via-[#0c1020] to-[#150d26] text-white p-4 sm:p-8 overflow-y-auto select-none">
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-center justify-between z-10 pb-4 border-b border-zinc-800">
        <button
          onClick={() => {
            netManager.leave();
            onBack();
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 text-sm font-medium transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Quay Lại Menu
        </button>

        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-amber-400 animate-pulse" />
          <span className="font-serif font-black text-lg sm:text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-rose-400">
            SẢNH ĐẤU ONLINE REAL-TIME
          </span>
        </div>

        <div className="text-xs font-mono text-zinc-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="hidden sm:inline">{connectionStatus}</span>
        </div>
      </div>

      {!inLobby ? (
        /* STEP 1: JOIN OR CREATE */
        <div className="flex-1 flex flex-col items-center justify-center my-auto z-10 max-w-xl mx-auto w-full py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-black font-serif text-white mb-2">
              KẾT NỐI VÕ ĐÀI TRỰC TUYẾN
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Tạo phòng mới để lấy <strong className="text-amber-400">Mã 4 Ký Tự</strong> chia sẻ cho bạn bè, hoặc nhập mã phòng của người khác để giao đấu ngay lập tức!
            </p>
          </div>

          {errorMsg && (
            <div className="w-full mb-4 px-4 py-2.5 rounded-xl bg-rose-950/80 border border-rose-500/70 text-rose-200 text-xs font-semibold text-center">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-6">
            <button
              onClick={handleCreate}
              className="group flex flex-col items-center justify-center p-6 rounded-2xl bg-gradient-to-b from-amber-500 to-amber-700 text-zinc-950 font-bold border-2 border-amber-300 shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-9 h-9 mb-2 group-hover:rotate-12 transition" />
              <span className="text-lg font-black tracking-wide uppercase font-serif">
                Tạo Phòng Mới
              </span>
              <span className="text-xs font-medium opacity-85 mt-1">
                Tự sinh mã 4 chữ cái (VD: BUEA)
              </span>
            </button>

            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-zinc-900/90 border border-zinc-700 shadow-xl">
              <Users className="w-8 h-8 mb-2 text-cyan-400" />
              <span className="text-base font-bold text-white mb-3">Nhập Mã Phòng</span>
              <div className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  placeholder="MÃ 4 CHỮ"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-amber-300 font-mono font-bold text-center uppercase tracking-widest text-base focus:outline-none focus:border-amber-400"
                />
                <button
                  disabled={inputCode.length < 4}
                  onClick={() => handleJoin(inputCode)}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-bold text-sm tracking-wide transition cursor-pointer"
                >
                  Vào
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: LOBBY ACTIVE */
        <div className="flex-1 flex flex-col z-10 py-4 max-w-5xl mx-auto w-full gap-5">
          {errorMsg && (
            <div className="w-full px-4 py-2.5 rounded-xl bg-rose-950/80 border border-rose-500/70 text-rose-200 text-xs font-semibold text-center">
              {errorMsg}
            </div>
          )}

          {/* ROOM CODE DISPLAY */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-zinc-900 to-purple-950/60 border-2 border-amber-500/50 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs uppercase">
                {isHost ? 'Chủ Phòng (Host)' : 'Khách Đấu (Guest)'}
              </div>
              <div>
                <span className="text-zinc-400 text-xs block uppercase font-mono tracking-wider">
                  Mã Phòng Của Bạn:
                </span>
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">
                  {roomCode}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={copyRoomCode}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold text-zinc-200 hover:text-white transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                {copied ? 'Đã Sao Chép Mã' : 'Sao Chép Mã'}
              </button>

              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs transition cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-zinc-950" /> : <Globe className="w-4 h-4 text-zinc-950" />}
                {copiedLink ? 'Đã Sao Chép Link' : 'Sao Chép Link Mời'}
              </button>
            </div>
          </div>

          {/* TWO PLAYERS SLOTS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Player 1 Slot */}
            <div className="p-4 rounded-xl bg-zinc-900/90 border border-amber-500/40 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-bold text-amber-400 font-mono uppercase">
                  {isHost ? 'Người Chơi 1 (Bạn - Chủ Phòng)' : 'Người Chơi 1 (Chủ Phòng)'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  {isHost ? (isReady ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG') : (oppParticipant?.ready ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG')}
                </span>
              </div>
              <div className="my-3 flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center font-serif font-black text-2xl border-2"
                  style={{
                    backgroundColor: p1CharData.colorTheme.primary + '33',
                    borderColor: p1CharData.colorTheme.primary,
                  }}
                >
                  {p1CharData.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">
                    {p1CharData.name}
                  </h4>
                  <p className="text-xs text-zinc-400">
                    {p1CharData.title}
                  </p>
                </div>
              </div>
            </div>

            {/* Player 2 Slot */}
            <div className="p-4 rounded-xl bg-zinc-900/90 border border-cyan-500/40 flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-bold text-cyan-400 font-mono uppercase">
                  {!isHost ? 'Người Chơi 2 (Bạn - Khách)' : 'Người Chơi 2 (Đối Thủ)'}
                </span>
                {oppParticipant || !isHost ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                    {!isHost ? (isReady ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG') : (oppParticipant?.ready ? 'SẴN SÀNG' : 'CHƯA SẴN SÀNG')}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-amber-300 font-bold animate-pulse">
                    ĐANG ĐỢI VÀO PHÒNG...
                  </span>
                )}
              </div>
              <div className="my-3 flex items-center gap-3">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center font-serif font-black text-2xl border-2"
                  style={{
                    backgroundColor: p2CharData.colorTheme.primary + '33',
                    borderColor: p2CharData.colorTheme.primary,
                  }}
                >
                  {p2CharData.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-base text-white">
                    {p2CharData.name}
                  </h4>
                  <p className="text-xs text-zinc-400">
                    {p2CharData.title}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* CHARACTER SELECTION GRID */}
          <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              Chọn Cao Thủ Của Bạn (8 Cao Thủ Độc Bản):
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2.5">
              {charList.map((c) => {
                const isSelected = myChar === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => handleCharSelect(c.id)}
                    className={`flex flex-col items-center p-2.5 rounded-xl border-2 transition cursor-pointer text-left ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-105'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-600'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-serif font-black text-lg mb-1"
                      style={{
                        backgroundColor: c.colorTheme.primary + '33',
                        color: c.colorTheme.primary,
                      }}
                    >
                      {c.name.charAt(0)}
                    </div>
                    <span className="text-[12px] font-bold text-white text-center leading-tight truncate w-full">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-zinc-400 text-center truncate w-full">
                      {c.archetype.split('&')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* MAP SELECTION (HOST ONLY) */}
          <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
            <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider mb-3">
              Võ Đài Thi Đấu: {isHost ? '(Chủ Phòng Chọn)' : '(Theo Chủ Phòng)'}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {mapList.map((m) => {
                const isSelected = selectedMap === m.id;
                return (
                  <button
                    key={m.id}
                    disabled={!isHost}
                    onClick={() => handleMapSelect(m.id)}
                    className={`p-3 rounded-xl border-2 text-left transition ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20'
                        : 'border-zinc-800 bg-zinc-950/60'
                    } ${isHost ? 'cursor-pointer hover:border-zinc-500' : 'cursor-default opacity-85'}`}
                  >
                    <div className="text-xs font-bold text-white">{m.name}</div>
                    <div className="text-[10px] text-zinc-400 truncate">{m.themeDesc || m.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* BOTTOM ACTION BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <button
              onClick={handleToggleReady}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm tracking-wide transition cursor-pointer flex items-center justify-center gap-2 ${
                isReady
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              <Shield className="w-4 h-4" />
              {isReady ? '✓ BẠN ĐÃ SẴN SÀNG' : 'BẤM ĐỂ SẴN SÀNG'}
            </button>

            {isHost && (
              <button
                onClick={handleHostStart}
                className="w-full sm:w-auto px-8 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-black font-serif text-base tracking-wider uppercase shadow-[0_0_25px_rgba(245,158,11,0.4)] transition cursor-pointer flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
              >
                <Swords className="w-5 h-5 text-zinc-950" />
                VÀO TRẬN ĐẤU (BẮT ĐẦU)
              </button>
            )}

            {!isHost && (
              <span className="text-xs font-mono text-amber-400 animate-pulse">
                Đang chờ Chủ Phòng bấm Bắt Đầu trận đấu...
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};