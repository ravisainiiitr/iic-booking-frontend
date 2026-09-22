import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EquipmentGrid from "@/components/EquipmentGrid";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import NoticeBoard from "@/components/NoticeBoard";
import { useEffect } from "react";

const Index = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />

      <section id="equipment" className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-sky-300 mb-0.5">
              Facilities
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Explore instruments</h2>
            <p className="text-muted-foreground mt-0.5 max-w-2xl text-sm">
              Browse published equipment, review charges and accessories, then book live slots.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-9 min-w-0">
            <EquipmentGrid />
          </div>
          <aside className="lg:col-span-3 lg:sticky lg:top-20 w-full min-w-0">
            <NoticeBoard />
          </aside>
        </div>
      </section>

      <Features />
      <Footer />
    </div>
  );
};

export default Index;
