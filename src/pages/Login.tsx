import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { WayamMark } from "@/components/brand/WayamMark";
import { VoiceFlowBackdrop } from "@/components/brand/VoiceFlowBackdrop";

/** Drop a Google Flow export at public/auth-flow.mp4 to use it under the glow. */
const FLOW_VIDEO = "/auth-flow.mp4";

const fieldClass =
  "border-white/20 bg-transparent text-white placeholder:text-white/40 focus-visible:ring-[#ff7b1c]/60";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [videoOk, setVideoOk] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message,
      });
      setIsLoading(false);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <VoiceFlowBackdrop videoSrc={videoOk ? FLOW_VIDEO : undefined} />
      <video
        className="hidden"
        src={FLOW_VIDEO}
        muted
        playsInline
        onLoadedData={() => setVideoOk(true)}
        onError={() => setVideoOk(false)}
      />
      <p className="absolute right-5 top-5 z-10 text-xs font-medium tracking-wide text-white/75 sm:right-8 sm:top-7">
        Voice Agents by Wayam
      </p>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <WayamMark size={72} className="mb-4 shadow-[0_12px_40px_rgba(255,161,43,0.35)]" />
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white">Vakyam</h1>
          <p className="mt-1 text-sm text-white/70">Voice Agents by Wayam</p>
        </div>

        <Card className="border-white/10 bg-black/30 shadow-none backdrop-blur-xl">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/80">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={fieldClass}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
              <p className="text-center text-sm text-white/60">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="text-white underline-offset-4 hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Login;
