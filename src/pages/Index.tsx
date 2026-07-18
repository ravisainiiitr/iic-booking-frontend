import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EquipmentGrid from "@/components/EquipmentGrid";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import NoticeBoard from "@/components/NoticeBoard";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Hero />

      <section className="container mx-auto px-4 py-14 sm:py-16 max-w-7xl">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-1">
              Facilities
            </p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Explore instruments</h2>
            <p className="text-muted-foreground mt-1 max-w-xl text-sm sm:text-base">
              Browse published equipment, review charges and accessories, then book live slots.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          <div className="lg:col-span-3">
            <EquipmentGrid />
          </div>
          <aside className="lg:col-span-1 lg:sticky lg:top-24">
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
