import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  const { signOut } = useAuth();
  return (
    <SidebarProvider>
      <header className="h-12 flex items-center border-b px-2 w-full">
        <SidebarTrigger className="mr-2" />
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
