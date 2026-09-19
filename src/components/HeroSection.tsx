import { CalendarDays, CircleHelp, MapPinned } from "lucide-react";

const categories = [
  { icon: CalendarDays, title: "Holiday Planning", subtitle: "Destinations and travel guidance" },
  { icon: CircleHelp, title: "Member Support", subtitle: "Bookings, concerns and next steps" },
  { icon: MapPinned, title: "Membership Guidance", subtitle: "Plans, benefits and resort access" },
];

export const HeroSection = () => (
  <section className="hero-gradient px-6 py-12 md:py-16">
    <div className="mx-auto max-w-5xl text-center">
      <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-wayam">
        Vakyam Voice Agents by Wayam
      </p>
      <h2 className="font-display text-display-page text-white">Club Mahindra Member Concierge</h2>
      <p className="mx-auto mb-7 mt-3 max-w-2xl text-sm text-white/65">
        Meet Meera, your bilingual Hindi and English voice concierge for thoughtful member support.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {categories.map((category) => (
          <div
            key={category.title}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white"
          >
            <category.icon className="h-4 w-4" />
            <span className="font-medium">{category.title}</span>
            <span className="hidden text-white/60 sm:inline">· {category.subtitle}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

