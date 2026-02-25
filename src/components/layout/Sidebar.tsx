import {
  File,
  Home,
  Users,
  LogOut,
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
    <div className="flex h-full flex-col p-4">
      {/* Brand */}
      <div className={cn("mb-6 flex items-center gap-2 px-3", isCollapsed && "justify-center")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-400 text-primary-foreground font-bold text-sm shadow-md shadow-primary/30">
          6M
        </div>
        {!isCollapsed && (
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">SixMin Legal</p>
            <span className="text-base font-semibold tracking-tight">TimeTrack</span>
          </div>
        )}
      </div>

      <Separator className="mb-4" />

      {/* Nav */}
      <nav className="flex-1 space-y-1" role="navigation" aria-label="Main navigation">
        <TooltipProvider delayDuration={0}>
          {navItems.map((item) => (
            <Tooltip key={item.to}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground hover:bg-muted/40',
                      isActive && 'bg-primary/15 text-foreground border border-primary/30 shadow-sm',
                      isCollapsed && 'justify-center px-2',
                    )
                  }
                  aria-label={isCollapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </TooltipProvider>
      </nav>

      {/* Logout + shortcut hint */}
      <div className="mt-auto pt-4 space-y-2">
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50',
                  isCollapsed && 'justify-center px-2',
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
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
          <div className="text-xs text-muted-foreground/60 px-3">
            <kbd className="rounded border border-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
              Ctrl+K
            </kbd>{" "}
            Quick switch matter
          </div>
        )}
      </div>
    </div>
  );
}
