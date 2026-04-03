import {
  File,
  Home,
  Users,
  Receipt,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
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
    <div className="flex h-full flex-col sidebar-gradient">
      {/* Brand */}
      <div className={cn('px-4 pt-6 pb-5', isCollapsed && 'px-2 pt-5')}>
        <div className={cn('flex items-center gap-3', isCollapsed && 'justify-center')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-slate-900 shadow-lg"
               style={{ background: 'linear-gradient(135deg, hsl(42 95% 65%) 0%, hsl(38 90% 50%) 100%)' }}>
            6M
          </div>
          {!isCollapsed && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[10px] uppercase tracking-[0.14em] font-bold" style={{ color: 'hsl(38 50% 55%)' }}>
                SixMin Legal
              </p>
              <p className="truncate text-[15px] font-bold tracking-tight text-white">TimeTrack</p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(215 30% 22%), transparent)' }} />

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-4" role="navigation" aria-label="Main navigation">
        {!isCollapsed && (
          <p className="px-3 pb-2.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: 'hsl(215 15% 70%)' }}>
            Navigation
          </p>
        )}

        <TooltipProvider delayDuration={0}>
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'sidebar-nav-item',
                        isActive && 'sidebar-nav-active',
                        isCollapsed && 'justify-center px-2'
                      )
                    }
                    aria-label={isCollapsed ? item.label : undefined}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
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

      {/* Divider */}
      <div className="mx-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(215 30% 22%), transparent)' }} />

      {/* Footer */}
      <div className="px-2.5 py-3">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'sidebar-nav-item w-full hover:!text-red-300',
                  isCollapsed && 'justify-center px-2'
                )}
                style={{ color: 'hsl(215 15% 85%)' }}
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" />
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
          <div className="mt-3 px-3 text-[10px]" style={{ color: 'hsl(215 15% 70%)' }}>
            <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px]"
                 style={{ borderColor: 'hsl(215 25% 30%)', background: 'hsl(215 30% 20%)', color: 'hsl(215 15% 80%)' }}>
              Ctrl+K
            </kbd>{' '}
            quick switch
          </div>
        )}
      </div>
    </div>
  );
}
