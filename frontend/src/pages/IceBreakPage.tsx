import { useNavigate, useParams } from 'react-router-dom';
import { useLanguageStore } from '../stores/useLanguageStore';

export default function IceBreakPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const copy = language === 'en'
    ? {
        title: 'Icebreak Stage',
        subtitle: 'Preparing opening prompts...',
        desc: 'Let everyone get familiar first so the discussion starts more smoothly.',
        skip: 'Skip Icebreak and Enter Discussion',
        roomCode: 'Room Code',
      }
    : {
        title: '破冰阶段',
        subtitle: '正在准备破冰话题...',
        desc: '让大家先互相熟悉一下，有助于后续讨论更顺畅。',
        skip: '跳过破冰，直接进入讨论',
        roomCode: '房间号',
      };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-4 text-5xl">🧊</div>
        <h2 className="mb-2 text-3xl font-bold text-gray-800">{copy.title}</h2>
        <p className="mb-8 text-gray-500">{copy.roomCode} <span className="rounded bg-gray-100 px-2 py-1 font-mono">{code}</span></p>
        <div className="mb-8 rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p className="mb-2 font-medium">{copy.subtitle}</p>
          <p className="text-sm opacity-80">{copy.desc}</p>
        </div>
        <button onClick={() => navigate(`/room/${code}/discuss`)} className="text-sm text-gray-500 underline hover:text-gray-700">{copy.skip}</button>
      </div>
    </div>
  );
}
