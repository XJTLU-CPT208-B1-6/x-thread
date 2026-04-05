import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { roomService } from '../services/api-client';
import { useRoomStore } from '../stores/useRoomStore';
import { useUserStore } from '../stores/useUserStore';
import { RoomMember } from '../types/room';

const getMemberBadge = (member: RoomMember, currentUserId?: string) => {
  if (member.role === 'OWNER') {
    return '\u623f\u4e3b';
  }

  if (member.userId === currentUserId) {
    return '\u4f60';
  }

  return '\u6210\u5458';
};

const getMemberInitial = (member: RoomMember) =>
  (member.nickname || '?').trim().charAt(0).toUpperCase();

export default function LobbyPage() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const { currentRoom, members, setRoom } = useRoomStore();
  const { user } = useUserStore();

  useEffect(() => {
    if (!code) {
      navigate('/');
      return;
    }

    let cancelled = false;

    const loadRoom = async () => {
      try {
        const room = await roomService.getRoomByCode(code);
        if (!cancelled) {
          setRoom(room);
        }
      } catch (error) {
        console.error('Failed to load lobby room:', error);
        if (!cancelled) {
          navigate('/');
        }
      }
    };

    loadRoom();

    return () => {
      cancelled = true;
    };
  }, [code, navigate, setRoom]);

  const visibleMembers = (currentRoom?.members?.length ? currentRoom.members : members)
    .slice()
    .sort((a, b) => {
      if (a.role === b.role) {
        return a.nickname.localeCompare(b.nickname);
      }

      return a.role === 'OWNER' ? -1 : 1;
    });

  const host = visibleMembers.find((member) => member.role === 'OWNER');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex w-full max-w-md flex-col items-center rounded-2xl bg-white p-8 shadow-xl"
      >
        <h2 className="mb-2 text-3xl font-bold text-gray-800">{'\u7b49\u5f85\u5ba4'}</h2>
        <div className="mb-6 text-sm text-gray-500">
          {'\u623f\u95f4\u53f7'}
          <span className="ml-2 rounded bg-gray-100 px-2 py-1 font-mono">{code}</span>
        </div>

        <div className="mb-6 w-full rounded-xl border border-blue-100 bg-blue-50 p-4 text-left">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">{'\u623f\u4e3b'}</div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {host ? getMemberInitial(host) : '?'}
            </div>
            <div>
              <div className="font-semibold text-gray-800">{host?.nickname ?? '\u6682\u672a\u83b7\u53d6'}</div>
              <div className="text-xs text-gray-500">{'\u521b\u5efa\u5e76\u7ba1\u7406\u5f53\u524d\u8ba8\u8bba\u623f\u95f4'}</div>
            </div>
          </div>
        </div>

        <div className="mb-8 w-full">
          <div className="mb-3 flex items-center justify-between border-b pb-2">
            <h3 className="text-sm font-semibold text-gray-600">{'\u5f53\u524d\u6210\u5458'}</h3>
            <span className="text-xs text-gray-400">
              {visibleMembers.length}/{currentRoom?.maxMembers ?? '--'}
            </span>
          </div>

          <ul className="space-y-2">
            {visibleMembers.map((member) => (
              <li key={member.userId} className="flex items-center space-x-3 rounded-lg bg-gray-50 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                  {getMemberInitial(member)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-gray-700">{member.nickname}</div>
                  <div className="text-xs text-gray-400">
                    {member.status === 'ACTIVE' ? '\u5728\u7ebf' : member.status}
                  </div>
                </div>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-xs ${
                    member.role === 'OWNER'
                      ? 'bg-blue-100 text-blue-700'
                      : member.userId === user?.id
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {getMemberBadge(member, user?.id)}
                </span>
              </li>
            ))}
          </ul>

          {visibleMembers.length === 0 && (
            <div className="rounded-lg bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
              {'\u6682\u65e0\u6210\u5458\u4fe1\u606f'}
            </div>
          )}
        </div>

        <button
          onClick={() => navigate(`/room/${code}/discuss`)}
          className="w-full rounded-xl bg-blue-600 py-3 font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          {'\u5f00\u59cb\u8ba8\u8bba'}
        </button>
      </motion.div>
    </div>
  );
}
