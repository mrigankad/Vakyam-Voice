import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { VoiceChatCard } from "@/components/VoiceChatCard";
import { CallRequestCard } from "@/components/CallRequestCard";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      
      <main className="flex-1">
        <HeroSection />
        
        <section className="px-6 py-10">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            <VoiceChatCard />
            <CallRequestCard />
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Index;
