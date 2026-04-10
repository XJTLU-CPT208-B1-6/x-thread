import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from 'lucide-react';
import { socketService } from '../services/socket-service';
import { useLanguageStore } from '../stores/useLanguageStore';

type PeerMeta = {
  socketId: string;
  userId: string;
  nickname: string;
};

type VoiceSignalPayload = {
  roomId: string;
  fromSocketId: string;
  userId: string;
  nickname: string;
  signal: Record<string, unknown>;
};

type VoiceMode = 'OPEN' | 'QUEUE';

type VoiceCallStatePayload = {
  roomId: string;
  mode: VoiceMode;
  currentSpeakerSocketId: string | null;
  turnEndsAt: number | null;
  participants: PeerMeta[];
};

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function RemoteVoiceCallPanel({
  roomId,
  enabled,
  isOwner = false,
}: {
  roomId?: string;
  enabled: boolean;
  isOwner?: boolean;
}) {
  const { language } = useLanguageStore();
  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            title: 'Live Voice Call',
            desc: 'Remote rooms can start a real-time audio call. On-site rooms keep the existing local discussion flow.',
            join: 'Join Voice Call',
            leave: 'Leave Voice Call',
            joining: 'Joining...',
            connected: 'Connected',
            microphoneOn: 'Mic On',
            microphoneOff: 'Mic Off',
            participants: 'Participants',
            idle: 'No one else is in the call yet.',
            modeOpen: 'Open Discussion',
            modeQueue: 'Sequential Turns',
            ownerControls: 'Host Controls',
            queueDesc: 'In sequential mode, only one participant can speak at a time. The turn passes automatically after 5 minutes or when the current speaker mutes manually.',
            yourTurn: 'It is your turn to speak',
            waitingTurn: 'Waiting for your turn',
            currentSpeaker: 'Current speaker',
            passTurn: 'Pass to Next Speaker',
            turnEnds: 'Turn ends in',
            unsupported: 'This browser does not support real-time voice calling.',
            denied: 'Unable to access microphone.',
            disabled: 'Voice call is available only in remote mode.',
          }
        : {
            title: '实时语音通话',
            desc: '远程模式下可直接开启实时语音通话，现场模式保持现有本地讨论流程。',
            join: '加入语音通话',
            leave: '退出语音通话',
            joining: '加入中...',
            connected: '已连接',
            microphoneOn: '麦克风开启',
            microphoneOff: '麦克风关闭',
            participants: '通话成员',
            idle: '当前还没有其他成员加入语音通话。',
            modeOpen: '自由讨论',
            modeQueue: '按序发言',
            ownerControls: '房主控制',
            queueDesc: '按序发言模式下，同一时间只有一个成员可以开麦。五分钟后会自动传给下一位，当前发言人也可以手动闭麦后传递。',
            yourTurn: '现在轮到你发言',
            waitingTurn: '等待轮到你发言',
            currentSpeaker: '当前发言人',
            passTurn: '传给下一位',
            turnEnds: '剩余时间',
            unsupported: '当前浏览器不支持实时语音通话。',
            denied: '无法访问麦克风。',
            disabled: '语音通话只在远程模式下可用。',
          },
    [language],
  );

  const localStreamRef = useRef<MediaStream | null>(null);
  const joinedRef = useRef(false);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [participants, setParticipants] = useState<PeerMeta[]>([]);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('OPEN');
  const [currentSpeakerSocketId, setCurrentSpeakerSocketId] = useState<string | null>(null);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    joinedRef.current = joined;
  }, [joined]);

  useEffect(() => {
    if (!enabled && joined) {
      void leaveCall();
    }
  }, [enabled, joined]);

  useEffect(() => {
    if (!turnEndsAt) {
      setRemainingSeconds(null);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000));
      setRemainingSeconds(diff);
    };

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [turnEndsAt]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const handlePeers = async ({ roomId: nextRoomId, peers }: { roomId: string; peers: PeerMeta[] }) => {
      if (nextRoomId !== roomId) return;
      setParticipants(peers);
      for (const peer of peers) {
        await createOfferForPeer(peer);
      }
    };

    const handleUserJoined = ({ roomId: nextRoomId, ...peer }: { roomId: string } & PeerMeta) => {
      if (nextRoomId !== roomId) return;
      setParticipants((current) => current.some((item) => item.socketId === peer.socketId) ? current : [...current, peer]);
    };

    const handleUserLeft = ({ roomId: nextRoomId, socketId }: { roomId: string; socketId: string }) => {
      if (nextRoomId !== roomId) return;
      teardownPeer(socketId);
      setParticipants((current) => current.filter((item) => item.socketId !== socketId));
    };

    const handleSignal = async (payload: VoiceSignalPayload) => {
      if (payload.roomId !== roomId) return;
      await handleIncomingSignal(payload);
    };

    const handleVoiceCallState = (payload: VoiceCallStatePayload) => {
      if (payload.roomId !== roomId) return;
      setVoiceMode(payload.mode);
      setCurrentSpeakerSocketId(payload.currentSpeakerSocketId);
      setTurnEndsAt(payload.turnEndsAt);
      setParticipants(payload.participants);
    };

    socketService.on('voice-call-peers', handlePeers);
    socketService.on('voice-call-user-joined', handleUserJoined);
    socketService.on('voice-call-user-left', handleUserLeft);
    socketService.on('voice-signal', handleSignal);
    socketService.on('voice-call-state', handleVoiceCallState);

    return () => {
      socketService.off('voice-call-peers', handlePeers);
      socketService.off('voice-call-user-joined', handleUserJoined);
      socketService.off('voice-call-user-left', handleUserLeft);
      socketService.off('voice-signal', handleSignal);
      socketService.off('voice-call-state', handleVoiceCallState);
    };
  }, [roomId, joined]);

  useEffect(() => {
    return () => {
      void leaveCall();
    };
  }, []);

  const syncMicState = (stream: MediaStream, nextEnabled: boolean) => {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
  };

  const ensureLocalStream = async () => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error(copy.unsupported);
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    syncMicState(stream, micEnabled);
    localStreamRef.current = stream;
    return stream;
  };

  const ensureRemoteAudio = (socketId: string) => {
    const current = remoteAudioRefs.current.get(socketId);
    if (current) return current;
    const audio = new Audio();
    audio.autoplay = true;
    remoteAudioRefs.current.set(socketId, audio);
    return audio;
  };

  const teardownPeer = (socketId: string) => {
    const connection = peerConnectionsRef.current.get(socketId);
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.close();
      peerConnectionsRef.current.delete(socketId);
    }
    const audio = remoteAudioRefs.current.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioRefs.current.delete(socketId);
    }
  };

  const buildPeerConnection = async (peer: PeerMeta) => {
    const existing = peerConnectionsRef.current.get(peer.socketId);
    if (existing) return existing;

    const stream = await ensureLocalStream();
    const connection = new RTCPeerConnection(RTC_CONFIG);

    stream.getTracks().forEach((track) => connection.addTrack(track, stream));

    connection.onicecandidate = (event) => {
      if (!event.candidate || !roomId) return;
      socketService.sendVoiceSignal(roomId, peer.socketId, {
        type: 'ice-candidate',
        candidate: event.candidate.toJSON(),
      });
    };

    connection.ontrack = (event) => {
      const audio = ensureRemoteAudio(peer.socketId);
      const [remoteStream] = event.streams;
      if (remoteStream) {
        audio.srcObject = remoteStream;
        void audio.play().catch(() => undefined);
      }
    };

    peerConnectionsRef.current.set(peer.socketId, connection);
    return connection;
  };

  const createOfferForPeer = async (peer: PeerMeta) => {
    if (!joinedRef.current || !roomId || peer.socketId === socketService.getSocketId()) return;
    const connection = await buildPeerConnection(peer);
    if (connection.signalingState !== 'stable') return;
    const offer = await connection.createOffer({ offerToReceiveAudio: true });
    await connection.setLocalDescription(offer);
    socketService.sendVoiceSignal(roomId, peer.socketId, { type: 'offer', sdp: offer.sdp });
  };

  const handleIncomingSignal = async (payload: VoiceSignalPayload) => {
    if (!joinedRef.current || !roomId) return;

    const peer: PeerMeta = {
      socketId: payload.fromSocketId,
      userId: payload.userId,
      nickname: payload.nickname,
    };
    setParticipants((current) => current.some((item) => item.socketId === peer.socketId) ? current : [...current, peer]);

    const signalType = payload.signal.type;
    const connection = await buildPeerConnection(peer);

    if (signalType === 'offer') {
      const sdp = payload.signal.sdp;
      if (typeof sdp !== 'string') return;
      await connection.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      socketService.sendVoiceSignal(roomId, peer.socketId, { type: 'answer', sdp: answer.sdp });
      return;
    }

    if (signalType === 'answer') {
      const sdp = payload.signal.sdp;
      if (typeof sdp !== 'string') return;
      if (!connection.currentRemoteDescription) {
        await connection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
      }
      return;
    }

    if (signalType === 'ice-candidate' && payload.signal.candidate) {
      await connection.addIceCandidate(new RTCIceCandidate(payload.signal.candidate as RTCIceCandidateInit));
    }
  };

  const joinCall = async () => {
    if (!roomId || !enabled || joining) return;
    setJoining(true);
    setError('');
    try {
      await ensureLocalStream();
      setJoined(true);
      socketService.joinVoiceCall(roomId);
    } catch (err: any) {
      setError(err?.message ?? copy.denied);
    } finally {
      setJoining(false);
    }
  };

  const leaveCall = async () => {
    if (roomId && joinedRef.current) {
      socketService.leaveVoiceCall(roomId);
    }
    setJoined(false);
    setParticipants([]);
    setVoiceMode('OPEN');
    setCurrentSpeakerSocketId(null);
    setTurnEndsAt(null);
    setRemainingSeconds(null);
    peerConnectionsRef.current.forEach((_connection, socketId) => teardownPeer(socketId));
    peerConnectionsRef.current.clear();
    remoteAudioRefs.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
    });
    remoteAudioRefs.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
  };

  const mySocketId = socketService.getSocketId();
  const isCurrentSpeaker = joined && currentSpeakerSocketId === mySocketId;
  const activeSpeaker = participants.find((participant) => participant.socketId === currentSpeakerSocketId) ?? null;
  const micLockedByQueue = joined && voiceMode === 'QUEUE' && !isCurrentSpeaker;

  useEffect(() => {
    if (micLockedByQueue && micEnabled) {
      setMicEnabled(false);
      if (localStreamRef.current) syncMicState(localStreamRef.current, false);
    }
    if (voiceMode === 'QUEUE' && isCurrentSpeaker && !micEnabled) {
      setMicEnabled(true);
      if (localStreamRef.current) syncMicState(localStreamRef.current, true);
    }
  }, [isCurrentSpeaker, micEnabled, micLockedByQueue, voiceMode]);

  const toggleMic = () => {
    if (micLockedByQueue) return;
    const nextEnabled = !micEnabled;
    setMicEnabled(nextEnabled);
    if (localStreamRef.current) syncMicState(localStreamRef.current, nextEnabled);
    if (voiceMode === 'QUEUE' && !nextEnabled && isCurrentSpeaker && roomId) {
      socketService.passVoiceCallTurn(roomId);
    }
  };

  if (!enabled) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">{copy.disabled}</div>;
  }

  return (
    <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{copy.title}</div>
          <p className="mt-1 text-sm text-slate-500">{copy.desc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!joined ? (
            <button type="button" onClick={() => void joinCall()} disabled={joining} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"><Phone className="h-4 w-4" />{joining ? copy.joining : copy.join}</button>
          ) : (
            <>
              <button type="button" onClick={toggleMic} disabled={micLockedByQueue} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${micEnabled ? 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' : 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'} disabled:cursor-not-allowed disabled:opacity-50`}>
                {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                {micEnabled ? copy.microphoneOn : copy.microphoneOff}
              </button>
              <button type="button" onClick={() => void leaveCall()} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"><PhoneOff className="h-4 w-4" />{copy.leave}</button>
            </>
          )}
        </div>
      </div>

      {joined && isOwner ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-slate-700">{copy.ownerControls}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => roomId && socketService.setVoiceCallMode(roomId, 'OPEN')} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${voiceMode === 'OPEN' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>{copy.modeOpen}</button>
            <button type="button" onClick={() => roomId && socketService.setVoiceCallMode(roomId, 'QUEUE')} className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${voiceMode === 'QUEUE' ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'}`}>{copy.modeQueue}</button>
          </div>
          {voiceMode === 'QUEUE' ? <div className="mt-2 text-xs text-slate-500">{copy.queueDesc}</div> : null}
        </div>
      ) : null}

      {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div> : null}

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><Volume2 className="h-4 w-4" />{copy.participants}</div>
        {participants.length === 0 ? <div className="text-sm text-slate-500">{copy.idle}</div> : <div className="flex flex-wrap gap-2">{participants.map((participant) => <div key={participant.socketId} className={`rounded-full px-3 py-1.5 text-sm shadow-sm ${participant.socketId === currentSpeakerSocketId ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}>{participant.nickname}</div>)}</div>}
        {joined ? <div className="mt-3 text-xs font-medium text-emerald-700">{copy.connected}</div> : null}
        {joined && voiceMode === 'QUEUE' ? (
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <div>{copy.currentSpeaker}: {activeSpeaker?.nickname ?? '--'}</div>
            <div>{isCurrentSpeaker ? copy.yourTurn : copy.waitingTurn}</div>
            {remainingSeconds !== null ? <div>{copy.turnEnds}: {Math.floor(remainingSeconds / 60)}:{`${remainingSeconds % 60}`.padStart(2, '0')}</div> : null}
            {isCurrentSpeaker ? <button type="button" onClick={() => roomId && socketService.passVoiceCallTurn(roomId)} className="mt-2 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50">{copy.passTurn}</button> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
