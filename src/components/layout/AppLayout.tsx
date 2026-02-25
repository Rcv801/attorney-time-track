import { Outlet } from 'react-router-dom';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import QuickSwitchDialog from '../timer/QuickSwitchDialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

const AppLayout = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* Mobile / tablet layout */}
      <div className="flex h-screen w-full flex-col lg:hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-xs font-semibold">
              6M
            </div>
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">SixMin Legal</p>
              <p className="text-sm font-semibold">TimeTrack</p>
            </div>
          </div>

          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[86vw] max-w-[320px] p-0">
              <Sidebar isCollapsed={false} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="min-h-0 flex-1 overflow-auto bg-background">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Desktop layout */}
      <div className="hidden h-screen w-full lg:block">
        <ResizablePanelGroup
          direction="horizontal"
          className="h-screen w-full items-stretch"
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
              'min-w-[50px] border-r border-border bg-card transition-all duration-300 ease-in-out',
              isCollapsed && 'min-w-[70px]'
            )}
          >
            <Sidebar isCollapsed={isCollapsed} />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={80} minSize={60}>
            <main className="h-full overflow-auto bg-background">
              <div className="mx-auto max-w-7xl p-6 lg:p-8">
                <Outlet />
              </div>
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <QuickSwitchDialog />
    </>
  );
};

export default AppLayout;
