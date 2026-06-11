import { getDdayLabel, getDdayStyle } from '@/lib/dday';

export default function DdayBadge({ dday, estimated = false }) {
  const { bg, color } = getDdayStyle(dday);
  const label = getDdayLabel(dday);

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <div
        className="px-2.5 py-1 rounded-xl"
        style={{ backgroundColor: bg }}
      >
        <span className="text-[13px] font-semibold" style={{ color }}>
          {label}
        </span>
      </div>
      {estimated && (
        <span className="text-[11px] text-subtext">추정</span>
      )}
    </div>
  );
}
