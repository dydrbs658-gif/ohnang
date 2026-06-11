export default function OnboardingProgress({ current, total = 3 }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const done    = i < current;
        const active  = i === current;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width:           active ? '24px' : '8px',
              height:          '8px',
              backgroundColor: done || active ? '#1D6AE5' : '#E8ECF2',
            }}
          />
        );
      })}
    </div>
  );
}
