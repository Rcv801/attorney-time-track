import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, List, FileText, BarChart3, Settings, Briefcase } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "Matters", url: "/app/matters", icon: Briefcase },
  { title: "Clients", url: "/app/clients", icon: Users },
  { title: "Entries", url: "/app/entries", icon: List },
  { title: "Invoices", url: "/app/invoices", icon: FileText },
  { title: "Reports", url: "/app/reports", icon: BarChart3 },
  { title: "Settings", url: "/app/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive ? "bg-muted text-primary font-medium" : "hover:bg-muted/50";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Time App</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
