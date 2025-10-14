import EquipmentCard from "./EquipmentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import { equipmentData } from "@/data/equipmentData";

const EquipmentGrid = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEquipment = equipmentData.filter((equipment) => {
    const query = searchQuery.toLowerCase();
    return (
      equipment.name.toLowerCase().includes(query) ||
      equipment.category.toLowerCase().includes(query) ||
      equipment.description.toLowerCase().includes(query)
    );
  });

  return (
    <section id="equipment" className="py-12">
      <div className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Equipment Catalog
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse our extensive collection of advanced scientific instruments
          </p>
        </div>

        <div className="max-w-2xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search equipment by name, category, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
        </div>
      </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-6 mb-12">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="microscopy">Microscopy</TabsTrigger>
            <TabsTrigger value="spectroscopy">Spectroscopy</TabsTrigger>
            <TabsTrigger value="diffraction">Diffraction</TabsTrigger>
            <TabsTrigger value="magnetometry">Magnetometry</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEquipment.map((equipment) => (
                <EquipmentCard key={equipment.id} {...equipment} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="microscopy">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEquipment
                .filter((eq) => eq.category === "Microscopy")
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="spectroscopy">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEquipment
                .filter((eq) => eq.category === "Spectroscopy")
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="diffraction">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEquipment
                .filter((eq) => eq.category === "Diffraction")
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="magnetometry">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEquipment
                .filter((eq) => eq.category === "Magnetometry")
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="other">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredEquipment
                .filter((eq) => !["Microscopy", "Spectroscopy", "Diffraction", "Magnetometry"].includes(eq.category))
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>
        </Tabs>
    </section>
  );
};

export default EquipmentGrid;
