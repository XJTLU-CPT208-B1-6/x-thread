import { useLanguageStore } from '../stores/useLanguageStore';
import { getPersonalityTypeLabel, type PersonalityType } from '../lib/personality';

type PersonalityBadgeProps = {
  value?: PersonalityType | null;
  className?: string;
};

export function PersonalityBadge({ value, className = '' }: PersonalityBadgeProps) {
  const { language } = useLanguageStore();

  if (!value) {
    return null;
  }

  const palette =
    value === 'I'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${palette} ${className}`.trim()}
    >
      {getPersonalityTypeLabel(value, language)}
    </span>
  );
}
