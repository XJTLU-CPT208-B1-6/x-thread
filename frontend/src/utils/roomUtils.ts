export const formatTime = (value?: string | null): string =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '暂无';

export const resolveRoomPathFromPhase = (code: string, phase: string): string => {
  switch (phase) {
    case 'ICEBREAK':
      return `/room/${code}/icebreak`;
    case 'DISCUSS':
      return `/room/${code}/discuss`;
    case 'REVIEW':
      return `/room/${code}/review`;
    default:
      return `/room/${code}/lobby`;
  }
};
