import {
  Archive,
  File,
  Home,
  Users,
  LogOut,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface SidebarProps {
  isCollapsed: boolean;
}

const navItems = [
  { to: '/', icon: Home, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/matters', icon: Archive, label: 'Matters' },
  { to: '/entries', icon: File, label: 'Entries' },
];

export function Sidebar({ isCollapsed }: SidebarProps) {
  return (
    <div className="flex h-full flex-col p-4">
      {/* Brand */}
      <div className={cn("mb-6 flex items-center gap-2 px-3", isCollapsed && "justify-center")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          AT
        </div>
        {!isCollapsed && (
          <span className="text-lg font-semibold tracking-tight">TimeTrack</span>
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
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                      isActive && 'bg-accent text-accent-foreground',
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

      {/* Keyboard shortcut hint */}
      {!isCollapsed && (
        <div className="mt-auto pt-4 text-xs text-muted-foreground/60 px-3">
          <kbd className="rounded border border-muted-foreground/20 px-1.5 py-0.5 text-[10px] font-mono">
            Ctrl+K
          </kbd>{" "}
          Quick switch matter
        </div>
      )}
    </div>
  );
}
