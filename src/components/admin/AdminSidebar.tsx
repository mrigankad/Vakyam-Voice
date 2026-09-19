import { Settings, Database, History, BarChart3, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { WayamMark } from "@/components/brand/WayamMark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Analytics", url: "/admin/analytics", icon: BarChart3 },
  { title: "Call History", url: "/admin/history", icon: History },
  { title: "Knowledge Base", url: "/admin/knowledge", icon: Database },
  { title: "Configuration", url: "/admin/config", icon: Settings },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <Sidebar className="border-r border-border">
      <SidebarHeader className="border-b border-border p-4">
        <Link
          to="/"
          className="mb-4 flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Home</span>
        </Link>
        <div className="flex items-center gap-3">
          <WayamMark size={28} />
          <div>
            <h1 className="font-display text-[11px] tracking-[0.12em] text-foreground">VAKYAM</h1>
            <p className="text-xs text-muted-foreground">Voice Agents by Wayam</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Management</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
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
