export default function SkeletonItem() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F0F2F5]">
      <div className="w-10 h-10 bg-[#F4F6FA] rounded-xl animate-pulse flex-shrink-0" />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 w-32 bg-[#F4F6FA] rounded-lg animate-pulse" />
        <div className="h-3 w-20 bg-[#F4F6FA] rounded-lg animate-pulse" />
      </div>
      <div className="w-14 h-7 bg-[#F4F6FA] rounded-xl animate-pulse flex-shrink-0" />
    </div>
  );
}
