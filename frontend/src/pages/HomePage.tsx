// @ts-nocheck
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { roomService } from '../services/api-client';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';

export default function HomePage() {
  const navigate = useNavigate();
  const { setRoom } = useRoomStore();
  const { setUser } = useUserStore();
  const [nickname, setNickname] = useState('');
  const [topic, setTopic] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!nickname.trim() || !topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await roomService.createRoom({ topic, hostNickname: nickname });
      localStorage.setItem('x-thread-token', res.accessToken);
      setRoom(res.room);
      setUser({ id: res.userId, name: res.nickname });
      navigate(`/room/${res.room.code}/lobby`);
    } catch (e: any) {
      setError(e.response?.data?.message ?? '创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim() || !joinCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await roomService.joinRoom(joinCode.toUpperCase(), nickname);
      localStorage.setItem('x-thread-token', res.accessToken);
      setRoom(res.room);
      setUser({ id: res.userId, name: res.nickname });
      navigate(`/room/${res.room.code}/lobby`);
    } catch (e: any) {
      setError(e.response?.data?.message ?? '加入失败，请检查房间码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-blue-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8"
      >
        <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-blue-600 mb-2 tracking-tight">X-Thread <span className="text-xl text-gray-500">2.0</span></h1>
            <p className="text-gray-500 text-sm">西浦学术语丝 - 用空间视觉增强语音讨论</p>
        </div>

        <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tab === t 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'create' ? '创建房间' : '加入讨论'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">你的昵称</label>
              <input
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-black"
                placeholder="例如: Alex"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
          </div>

          {tab === 'create' ? (
             <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">讨论议题</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-black"
                  placeholder="如: AI对未来教育的影响"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                />
            </div>
          ) : (
            <div>
               <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">房间码</label>
                <input
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all uppercase tracking-widest font-mono text-lg text-black"
                  placeholder="X-7A3F"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start">
                <span>⚠️ {error}</span>
            </div>
          )}

          <button
            onClick={tab === 'create' ? handleCreate : handleJoin}
            disabled={loading || !nickname || (tab === 'create' ? !topic : !joinCode)}
            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md transition-all duration-200 mt-4 
                ${loading || !nickname || (tab === 'create' ? !topic : !joinCode)
                    ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg transform hover:-translate-y-0.5'
                }`}
          >
            {loading ? '处理中...' : tab === 'create' ? '立即创建' : '进入房间'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
