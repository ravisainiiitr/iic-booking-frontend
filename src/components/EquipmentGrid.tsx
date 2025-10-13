import EquipmentCard from "./EquipmentCard";
import microscope from "@/assets/microscope.jpg";
import spectrometer from "@/assets/spectrometer.jpg";
import chromatograph from "@/assets/chromatograph.jpg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

const equipmentData = [
  {
    id: 1,
    name: "Powder X-Ray Diffractometer (XRD)",
    category: "Diffraction",
    description: "Powder X-ray diffraction for crystal structure analysis and phase identification",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹500/- per sample",
      government: "₹1000/- per sample",
      industry: "₹2000/- per sample"
    }
  },
  {
    id: 2,
    name: "GI-XRD (Thin Film)",
    category: "Diffraction",
    description: "Grazing Incidence X-Ray Diffraction for thin film characterization",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹1000/- per sample",
      government: "₹2000/- per sample",
      industry: "₹4000/- per sample"
    }
  },
  {
    id: 3,
    name: "FE-SEM Gemini 560",
    category: "Microscopy",
    description: "Field Emission Scanning Electron Microscope for high-resolution imaging",
    image: microscope,
    available: false,
    nextAvailable: "Tomorrow 10:00 AM",
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹3000/- per sample",
      government: "₹4500/- per sample",
      industry: "₹6000/- per sample"
    }
  },
  {
    id: 4,
    name: "FE-SEM Apero",
    category: "Microscopy",
    description: "Field Emission Scanning Electron Microscope for advanced material analysis",
    image: microscope,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹3000/- per sample",
      government: "₹4500/- per sample",
      industry: "₹6000/- per sample"
    }
  },
  {
    id: 5,
    name: "TEM",
    category: "Microscopy",
    description: "Transmission Electron Microscope for nanoscale imaging and analysis",
    image: microscope,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹4922/- per sample",
      government: "₹4922/- per sample",
      industry: "₹6000/- per sample"
    }
  },
  {
    id: 6,
    name: "EPMA",
    category: "Analysis",
    description: "Electron Probe Micro-Analysis for elemental composition studies",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹6272/- per sample",
      government: "₹6272/- per sample",
      industry: "₹9000/- per sample"
    }
  },
  {
    id: 7,
    name: "VSM (Lake Shore)",
    category: "Magnetometry",
    description: "Vibrating Sample Magnetometer for magnetic properties measurement",
    image: spectrometer,
    available: false,
    nextAvailable: "Dec 22, 2:00 PM",
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹1000/- per sample",
      government: "₹1500/- per sample",
      industry: "₹3000/- per sample"
    }
  },
  {
    id: 8,
    name: "PPMS",
    category: "Magnetometry",
    description: "Physical Property Measurement System for comprehensive material characterization",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹4560/- per sample",
      government: "₹4560/- per sample",
      industry: "₹6000/- per sample"
    }
  },
  {
    id: 9,
    name: "SPM",
    category: "Microscopy",
    description: "Scanning Probe Microscope for surface topography and property mapping",
    image: microscope,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹2000/- per sample",
      government: "₹3000/- per sample",
      industry: "₹5000/- per sample"
    }
  },
  {
    id: 10,
    name: "SQUID",
    category: "Magnetometry",
    description: "Superconducting Quantum Interference Device for ultra-sensitive magnetic measurements",
    image: spectrometer,
    available: false,
    nextAvailable: "Dec 23, 11:00 AM",
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹4000/- per sample",
      government: "₹6000/- per sample",
      industry: "₹10000/- per sample"
    }
  },
  {
    id: 11,
    name: "TIMS",
    category: "Spectroscopy",
    description: "Thermal Ionization Mass Spectrometer for isotope ratio analysis",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹1000/- per sample",
      government: "₹1500/- per sample",
      industry: "₹3000/- per sample"
    }
  },
  {
    id: 12,
    name: "ICP-MS",
    category: "Spectroscopy",
    description: "Inductively Coupled Plasma Mass Spectrometry for trace element analysis",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹1500/- per sample",
      government: "₹2500/- per sample",
      industry: "₹4000/- per sample"
    }
  },
  {
    id: 13,
    name: "MPAES",
    category: "Spectroscopy",
    description: "Microwave Plasma Atomic Emission Spectroscopy for elemental analysis",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹500/- per sample",
      government: "₹1500/- per sample",
      industry: "₹3000/- per sample"
    }
  },
  {
    id: 14,
    name: "FLS (TCSPC)",
    category: "Spectroscopy",
    description: "Fluorescence Lifetime System for time-resolved spectroscopy",
    image: spectrometer,
    available: false,
    nextAvailable: "Tomorrow 3:00 PM",
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹1000/- per sample",
      government: "₹1500/- per sample",
      industry: "₹3000/- per sample"
    }
  },
  {
    id: 15,
    name: "DTA/TGA/DSC",
    category: "Thermal Analysis",
    description: "Differential Thermal Analysis and Thermogravimetric Analysis system",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹800/- per sample",
      government: "₹1000/- per sample",
      industry: "₹2000/- per sample"
    }
  },
  {
    id: 16,
    name: "XPS",
    category: "Spectroscopy",
    description: "X-ray Photoelectron Spectroscopy for surface chemical analysis",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹3000/- for every additional element",
      government: "₹3000/- for every additional element",
      industry: "₹5000/- for every additional element"
    }
  },
  {
    id: 17,
    name: "XRF",
    category: "Spectroscopy",
    description: "X-Ray Fluorescence for elemental composition analysis",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹500/- per sample",
      government: "₹1500/- per sample",
      industry: "₹1500/- per sample"
    }
  },
  {
    id: 18,
    name: "NMR",
    category: "Spectroscopy",
    description: "Nuclear Magnetic Resonance for molecular structure determination",
    image: spectrometer,
    available: false,
    nextAvailable: "Dec 24, 9:00 AM",
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹700/- per hour per sample",
      government: "₹1000/- per hour per sample",
      industry: "₹2000/- per hour per sample"
    }
  },
  {
    id: 19,
    name: "EPR/ESR",
    category: "Spectroscopy",
    description: "Electron Paramagnetic Resonance Spectroscopy for radical and paramagnetic species",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹1500/- per sample",
      government: "₹2000/- per sample",
      industry: "₹4000/- per sample"
    }
  },
  {
    id: 20,
    name: "MCU",
    category: "Crystallography",
    description: "Macromolecular Crystallographic Unit for protein structure determination",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹2000/- per sample",
      government: "₹2500/- per sample",
      industry: "₹4000/- per sample"
    }
  },
  {
    id: 21,
    name: "UV-Vis-NIR Spectrophotometer",
    category: "Spectroscopy",
    description: "UV-Visible-Near Infrared Spectrophotometer for absorption measurements",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹1000/- per slot (1 hr)",
      government: "₹1500/- per slot (1 hr)",
      industry: "₹2000/- per slot (1 hr)"
    }
  },
  {
    id: 22,
    name: "MALDI-TOF/TOF MS",
    category: "Spectroscopy",
    description: "Matrix-Assisted Laser Desorption/Ionization Time-of-Flight Mass Spectrometry",
    image: spectrometer,
    available: true,
    address: "Institute Instrumentation Centre, IIT Roorkee",
    technicalPerson: "Dr. Technical Expert",
    contactNumber: "+91-1332-285797",
    pricing: {
      educational: "₹2000/- per slot (1 hr)",
      government: "₹2500/- per slot (1 hr)",
      industry: "₹5000/- per slot (1 hr)"
    }
  },
];

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
