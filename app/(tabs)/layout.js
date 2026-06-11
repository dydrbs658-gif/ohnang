import BottomTabBar from '@/components/BottomTabBar';

export default function TabsLayout({ children }) {
  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
      <BottomTabBar />
    </div>
  );
}
