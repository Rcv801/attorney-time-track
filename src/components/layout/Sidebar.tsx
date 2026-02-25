import {
  File,
  Home,
  Users,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

interface SidebarProps {
  isCollapsed: boolean;
}

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/clients-matters', icon: Users, label: 'Clients & Matters' },
  { to: '/entries', icon: File, label: 'Entries' },
];

export function Sidebar({ isCollapsed }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Brand */}
      <div className={cn('px-4 pt-5 pb-4', isCollapsed && 'px-2')}>
        <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background text-xs font-semibold text-foreground">
            6M
          </div>
          {!isCollapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[11px] uppercase tracking-[0.14em] text-muted-foreground">SixMin Legal</p>
              <p className="truncate text-base font-semibold tracking-tight text-foreground">TimeTrack</p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3" role="navigation" aria-label="Main navigation">
        {!isCollapsed && (
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Navigation
          </p>
        )}

        <TooltipProvider delayDuration={0}>
          <div className="space-y-1">
            {navItems.map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors',
                        'hover:bg-muted hover:text-foreground',
                        isActive && 'bg-muted text-foreground',
                        isCollapsed && 'justify-center px-2'
                      )
                    }
                    aria-label={isCollapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        {!isCollapsed && (
                          <span
                            className={cn(
                              'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity',
                              isActive && 'opacity-100'
                            )}
                          />
                        )}
                        <item.icon className="h-4.5 w-4.5 shrink-0" />
                        {!isCollapsed && (
                          <>
                            <span className="truncate">{item.label}</span>
                            <ChevronRight
                              className={cn(
                                'ml-auto h-3.5 w-3.5 text-muted-foreground/70 transition-opacity',
                                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                              )}
                            />
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                </TooltipTrigger>
                {isCollapsed && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </nav>

      <Separator />

      {/* Footer */}
      <div className="px-2 py-3">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isCollapsed && 'justify-center px-2'
                )}
              >
                <LogOut className="h-4.5 w-4.5 shrink-0" />
                {!isCollapsed && <span>Sign Out</span>}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">
                <p>Sign Out</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>

        {!isCollapsed && (
          <div className="mt-3 px-3 text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border px-1.5 py-0.5 font-mono">Ctrl+K</kbd>{' '}
            quick switch matter
          </div>
        )}
      </div>
    </div>
  );
}
