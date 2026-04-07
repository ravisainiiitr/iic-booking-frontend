import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EquipmentGrid from "@/components/EquipmentGrid";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import NoticeBoard from "@/components/NoticeBoard";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <EquipmentGrid />
          </div>
          <div className="flex lg:col-span-1">
            <NoticeBoard />
          </div>
        </div>
      </div>
      
      <Features />
      <Footer />
    </div>
  );
};

export default Index;
