import { Settings, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { WayamMark } from "@/components/brand/WayamMark";

export const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-card/80 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <WayamMark size={36} />
          <div>
            <h1 className="font-display text-sm tracking-[0.12em] text-foreground">VAKYAM</h1>
            <p className="text-[11px] text-muted-foreground">Voice Agents by Wayam</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/analytics"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Settings className="w-5 h-5" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
