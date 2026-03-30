import {
  File,
  Home,
  Users,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
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
  { to: '/invoices', icon: Receipt, label: 'Invoices' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/settings', icon: SettingsIcon, label: 'Settings' },
];

export function Sidebar({ isCollapsed }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-full flex-col sidebar-gradient text-slate-100">
      {/* Brand */}
      <div className={cn('px-4 pt-5 pb-4', isCollapsed && 'px-2')}>
        <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-xs font-bold text-slate-900 shadow-md">
            6M
          </div>
          {!isCollapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[10px] uppercase tracking-[0.14em] text-slate-300 font-semibold">SixMin Legal</p>
              <p className="truncate text-base font-bold tracking-tight text-white">TimeTrack</p>
            </div>
          )}
        </div>
      </div>

      <Separator className="bg-white/10" />

      {/* Nav */}
      <nav className="flex-1 px-2 py-3" role="navigation" aria-label="Main navigation">
        {!isCollapsed && (
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
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
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200',
                        'hover:bg-white/10 hover:text-white',
                        isActive && 'bg-amber-500/20 text-white border-l-2 border-amber-400 pl-2.5',
                        isCollapsed && 'justify-center px-2 border-l-0 pl-2'
                      )
                    }
                    aria-label={isCollapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className="h-4.5 w-4.5 shrink-0" />
                        {!isCollapsed && (
                          <>
                            <span className="truncate">{item.label}</span>
                            <ChevronRight
                              className={cn(
                                'ml-auto h-3.5 w-3.5 text-slate-400 transition-opacity',
                                isActive ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-100'
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

      <Separator className="bg-white/10" />

      {/* Footer */}
      <div className="px-2 py-3">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-red-500/20 hover:text-red-200',
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
          <div className="mt-3 px-3 text-[10px] text-slate-400">
            <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 font-mono text-slate-300">Ctrl+K</kbd>{' '}
            quick switch
          </div>
        )}
      </div>
    </div>
  );
}
