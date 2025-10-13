import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EquipmentGrid from "@/components/EquipmentGrid";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import NoticeBoard from "@/components/NoticeBoard";
import Analytics from "@/components/Analytics";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <EquipmentGrid />
          </div>
          <div className="space-y-8">
            <NoticeBoard />
            <Analytics />
          </div>
        </div>
      </div>
      
      <Features />
      <Footer />
    </div>
  );
};

export default Index;
