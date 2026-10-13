import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { VoiceChatCard } from "@/components/VoiceChatCard";
import { Footer } from "@/components/Footer";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        <HeroSection />

        <section className="px-6 py-10">
          <div className="mx-auto max-w-md">
            <VoiceChatCard />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Index;
