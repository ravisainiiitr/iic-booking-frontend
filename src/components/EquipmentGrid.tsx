import EquipmentCard from "./EquipmentCard";
import microscope from "@/assets/microscope.jpg";
import spectrometer from "@/assets/spectrometer.jpg";
import chromatograph from "@/assets/chromatograph.jpg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const equipmentData = [
  {
    id: 1,
    name: "Scanning Electron Microscope",
    category: "Microscopy",
    description: "High-resolution imaging for nanoscale analysis with EDX capabilities",
    image: microscope,
    available: true,
    address: "Building A, Room 201, Research Complex",
    technicalPerson: "Dr. Sarah Johnson",
    contactNumber: "+1 (555) 123-4567",
  },
  {
    id: 2,
    name: "Mass Spectrometer",
    category: "Spectroscopy",
    description: "Advanced mass spectrometry for molecular analysis and identification",
    image: spectrometer,
    available: false,
    nextAvailable: "Tomorrow 2:00 PM",
    address: "Building B, Room 105, Science Wing",
    technicalPerson: "Dr. Michael Chen",
    contactNumber: "+1 (555) 234-5678",
  },
  {
    id: 3,
    name: "HPLC System",
    category: "Chromatography",
    description: "High-performance liquid chromatography for separation and analysis",
    image: chromatograph,
    available: true,
    address: "Building C, Room 302, Chemistry Lab",
    technicalPerson: "Dr. Emily Rodriguez",
    contactNumber: "+1 (555) 345-6789",
  },
  {
    id: 4,
    name: "Confocal Microscope",
    category: "Microscopy",
    description: "3D imaging and optical sectioning for biological samples",
    image: microscope,
    available: true,
    address: "Building A, Room 215, Imaging Center",
    technicalPerson: "Dr. James Wilson",
    contactNumber: "+1 (555) 456-7890",
  },
  {
    id: 5,
    name: "NMR Spectrometer",
    category: "Spectroscopy",
    description: "Nuclear magnetic resonance for molecular structure determination",
    image: spectrometer,
    available: false,
    nextAvailable: "Dec 22, 10:00 AM",
    address: "Building D, Room 101, Spectroscopy Lab",
    technicalPerson: "Dr. Rachel Thompson",
    contactNumber: "+1 (555) 567-8901",
  },
  {
    id: 6,
    name: "Gas Chromatograph",
    category: "Chromatography",
    description: "GC-MS system for volatile compound analysis",
    image: chromatograph,
    available: true,
    address: "Building C, Room 308, Analytical Lab",
    technicalPerson: "Dr. David Martinez",
    contactNumber: "+1 (555) 678-9012",
  },
];

const EquipmentGrid = () => {
  return (
    <section id="equipment" className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Equipment Catalog
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse our extensive collection of advanced scientific instruments
          </p>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-4 mb-12">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="microscopy">Microscopy</TabsTrigger>
            <TabsTrigger value="spectroscopy">Spectroscopy</TabsTrigger>
            <TabsTrigger value="chromatography">Chromatography</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {equipmentData.map((equipment) => (
                <EquipmentCard key={equipment.id} {...equipment} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="microscopy">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {equipmentData
                .filter((eq) => eq.category === "Microscopy")
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="spectroscopy">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {equipmentData
                .filter((eq) => eq.category === "Spectroscopy")
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>

          <TabsContent value="chromatography">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {equipmentData
                .filter((eq) => eq.category === "Chromatography")
                .map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

export default EquipmentGrid;
