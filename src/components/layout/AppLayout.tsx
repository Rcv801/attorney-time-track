import { Outlet } from 'react-router-dom';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import React, { useEffect } from 'react';
import QuickSwitchDialog from '../timer/QuickSwitchDialog';

const AppLayout = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K → focus quick switch (handled by QuickSwitchDialog internally if needed)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Could dispatch a custom event for quick switch
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <ResizablePanelGroup
        direction="horizontal"
        className="h-screen w-full items-stretch p-3 lg:p-4"
      >
        <ResizablePanel
          defaultSize={20}
          minSize={15}
          maxSize={25}
          collapsible
          collapsedSize={4}
          onCollapse={() => setIsCollapsed(true)}
          onExpand={() => setIsCollapsed(false)}
          className={cn(
            'app-shell min-w-[50px] transition-all duration-300 ease-in-out',
            isCollapsed && 'min-w-[70px]'
          )}
        >
          <Sidebar isCollapsed={isCollapsed} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={80} minSize={60} className="app-shell">
          <main className="h-full overflow-auto">
            <div className="mx-auto max-w-7xl p-5 lg:p-8">
              <Outlet />
            </div>
          </main>
        </ResizablePanel>
      </ResizablePanelGroup>
      <QuickSwitchDialog />
    </>
  );
};

export default AppLayout;
