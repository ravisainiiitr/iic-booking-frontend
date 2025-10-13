import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

interface EquipmentCardProps {
  name: string;
  category: string;
  description: string;
  image: string;
  available: boolean;
  nextAvailable?: string;
}

const EquipmentCard = ({ name, category, description, image, available, nextAvailable }: EquipmentCardProps) => {
  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border hover:border-primary/30">
      <div className="aspect-square overflow-hidden bg-muted">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl line-clamp-1">{name}</CardTitle>
          <Badge variant={available ? "default" : "secondary"} className="shrink-0">
            {available ? "Available" : "Busy"}
          </Badge>
        </div>
        <CardDescription className="text-sm">{category}</CardDescription>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
        {!available && nextAvailable && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Next available: {nextAvailable}</span>
          </div>
        )}
      </CardContent>

      <CardFooter>
        <Button className="w-full gap-2" disabled={!available}>
          <Calendar className="h-4 w-4" />
          {available ? "Book Now" : "View Schedule"}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default EquipmentCard;
