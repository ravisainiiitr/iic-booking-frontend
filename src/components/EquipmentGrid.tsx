import EquipmentCard from "./EquipmentCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ApiEquipment {
  equipment_id: number;
  code: string;
  name: string;
  profile_type: string;
  profile_type_display: string;
  status: string;
  status_display: string;
  location: string;
  image_url: string;
  video_url?: string | null;
  category?: number | null;
  category_name?: string | null;
  category_code?: string | null;
}

const EquipmentGrid = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [equipment, setEquipment] = useState<ApiEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // Fetch equipment from API
  useEffect(() => {
    fetchEquipment();
  }, []);

  // Debounced search - fetch from API when search query changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim()) {
        fetchEquipment(searchQuery);
      } else {
        fetchEquipment();
      }
    }, 500); // Debounce for 500ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const fetchEquipment = async (search?: string) => {
    try {
      setLoading(true);
      // Fetch all equipment without status filter
      const response = await apiClient.getEquipments(search);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data?.equipments && Array.isArray(response.data.equipments)) {
        // Filter out disposed equipment
        const filteredEquipment = response.data.equipments.filter(
          (eq: ApiEquipment) => eq.status_display !== "Disposed"
        );
        setEquipment(filteredEquipment);
      } else {
        setEquipment([]);
      }
    } catch (error: any) {
      console.error("Error fetching equipment:", error);
      toast.error(error.message || "Failed to load equipment");
      setEquipment([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories (equipment groups) from equipment data with counts
  interface EquipmentGroup {
    name: string;
    count: number;
  }

  const equipmentGroups = useMemo<EquipmentGroup[]>(() => {
    const groupMap = new Map<string, number>();
    equipment.forEach((eq) => {
      // Use category_name, fallback to "Unassigned" if no category
      const categoryName = eq.category_name || "Unassigned";
      const count = groupMap.get(categoryName) || 0;
      groupMap.set(categoryName, count + 1);
    });
    // Convert to array and sort by name, but include count
    return Array.from(groupMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        // Put "Unassigned" at the end
        if (a.name === "Unassigned") return 1;
        if (b.name === "Unassigned") return -1;
        return a.name.localeCompare(b.name);
      });
  }, [equipment]);

  // Get total count for "All" tab
  const totalCount = useMemo(() => {
    return equipment.length;
  }, [equipment]);

  // Transform API equipment to EquipmentCard props
  const transformEquipment = (eqList: ApiEquipment[]) => {
    return eqList.map((eq) => ({
      id: eq.equipment_id,
      name: eq.name,
      category: eq.profile_type_display || eq.profile_type || "Uncategorized",
      description: `${eq.name}`,
      image: eq.image_url || "/placeholder.svg",
      video: eq.video_url || undefined, // Use video_url if available, otherwise undefined
      available: eq.status === "ACTIVE",
      status: eq.status,
      statusDisplay: eq.status_display,
      address: eq.location || "Institute Instrumentation Centre, IIT Roorkee",
      technicalPerson: "",
      contactNumber: "",
    }));
  };

  // Get filtered equipment for "all" tab
  const allEquipment = useMemo(() => {
    return transformEquipment(equipment);
  }, [equipment]);

  // Get filtered equipment for specific category
  const getGroupEquipment = (categoryName: string) => {
    const filtered = equipment.filter((eq) => {
      const eqCategoryName = eq.category_name || "Unassigned";
      return eqCategoryName === categoryName;
    });
    return transformEquipment(filtered);
  };

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
              placeholder="Search equipment by name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>
      </div>

      {loading && equipment.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <Tabs value={selectedGroup} onValueChange={setSelectedGroup} className="w-full">
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 text-center text-muted-foreground">
              Filter by Department
            </h3>
            <TabsList className="flex flex-wrap justify-center gap-2 w-full max-w-5xl mx-auto p-1 bg-muted/50 rounded-lg">
              <TabsTrigger 
                value="all" 
                className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                All
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-muted data-[state=active]:bg-primary-foreground/20">
                  {totalCount}
                </span>
              </TabsTrigger>
              {equipmentGroups.map((group) => (
                <TabsTrigger 
                  key={group.name} 
                  value={group.name}
                  className="px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {group.name}
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-muted data-[state=active]:bg-primary-foreground/20">
                    {group.count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="all">
            {allEquipment.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  {searchQuery ? "No equipment found matching your search." : "No equipment available."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {allEquipment.map((equipment) => (
                  <EquipmentCard key={equipment.id} {...equipment} />
                ))}
              </div>
            )}
          </TabsContent>

          {equipmentGroups.map((group) => {
            const groupEquipment = getGroupEquipment(group.name);
            return (
              <TabsContent key={group.name} value={group.name}>
                {groupEquipment.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground text-lg">
                      {searchQuery ? "No equipment found matching your search." : `No equipment available in ${group.name} category.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {groupEquipment.map((equipment) => (
                      <EquipmentCard key={equipment.id} {...equipment} />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
};

export default EquipmentGrid;
