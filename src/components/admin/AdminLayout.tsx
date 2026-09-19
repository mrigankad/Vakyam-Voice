import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto p-6 md:p-8">
          <div className="w-full max-w-none">
            <div className="mb-6 md:mb-8">
              <p className="text-[11px] uppercase tracking-[0.22em] ink-quaternary">Vakyam Voice Agents by Wayam</p>
              <h1 className="font-display text-display-page text-foreground">{title}</h1>
              {description && (
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
