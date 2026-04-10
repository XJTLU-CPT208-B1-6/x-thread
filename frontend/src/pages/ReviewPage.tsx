import { useNavigate, useParams } from 'react-router-dom';
import { useLanguageStore } from '../stores/useLanguageStore';

export default function ReviewPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const copy = language === 'en'
    ? {
        title: 'Discussion Summary',
        roomDone: 'Discussion finished',
        output: 'Outputs',
        outputDesc: 'The session generated a mind map and discussion notes.',
        export: 'Export PDF Report',
        contribution: 'Contribution Overview',
        generating: 'AI is generating the radar chart...',
        back: 'Back to Workspace',
        roomCode: 'Room Code',
      }
    : {
        title: '讨论总结',
        roomDone: '讨论已结束',
        output: '本次产出',
        outputDesc: '生成了思维导图和讨论纪要。',
        export: '导出 PDF 战报',
        contribution: '贡献度概览',
        generating: 'AI 正在生成雷达图...',
        back: '返回工作台',
        roomCode: '房间号',
      };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-4 text-5xl">📝</div>
        <h2 className="mb-2 text-3xl font-bold text-gray-800">{copy.title}</h2>
        <p className="mb-8 text-gray-500">{copy.roomCode} <span className="rounded bg-gray-100 px-2 py-1 font-mono">{code}</span> {copy.roomDone}</p>
        <div className="mb-8 grid grid-cols-1 gap-6 text-left md:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
            <h3 className="mb-2 font-bold text-blue-800">{copy.output}</h3>
            <p className="mb-4 text-sm text-gray-600">{copy.outputDesc}</p>
            <button className="text-sm font-medium text-blue-600 underline hover:text-blue-800">{copy.export}</button>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl border border-green-100 bg-green-50 p-6">
            <h3 className="mb-2 w-full text-left font-bold text-green-800">{copy.contribution}</h3>
            <div className="mt-2 h-24 w-24 rounded-full border-4 border-green-400 border-t-green-200" />
            <p className="mt-4 text-center text-xs text-gray-500">{copy.generating}</p>
          </div>
        </div>
        <button onClick={() => navigate('/?section=recent-rooms')} className="w-full rounded-xl bg-gray-800 py-3 font-medium text-white shadow-md transition-colors hover:bg-gray-900">{copy.back}</button>
      </div>
    </div>
  );
}
