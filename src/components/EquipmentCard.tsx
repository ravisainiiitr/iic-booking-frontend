import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar, Clock, Info, MapPin, User, Phone } from "lucide-react";
import { useState } from "react";

interface Pricing {
  educational: string;
  government: string;
  industry: string;
}

interface EquipmentCardProps {
  name: string;
  category: string;
  description: string;
  image: string;
  available: boolean;
  nextAvailable?: string;
  address: string;
  technicalPerson: string;
  contactNumber: string;
  pricing?: Pricing;
}

const EquipmentCard = ({ name, category, description, image, available, nextAvailable, address, technicalPerson, contactNumber, pricing }: EquipmentCardProps) => {
  const [userType, setUserType] = useState<string>("educational");

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
        
        {pricing && (
          <div className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              <ToggleGroup 
                type="single" 
                value={userType} 
                onValueChange={(value) => value && setUserType(value)}
                className="gap-0 bg-muted/50 rounded-lg p-1 w-full"
              >
                <ToggleGroupItem 
                  value="educational" 
                  aria-label="Educational user"
                  className="flex-1 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all text-xs font-medium h-8"
                >
                  Educational
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="government" 
                  aria-label="Government user"
                  className="flex-1 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all text-xs font-medium h-8"
                >
                  Govt R&D
                </ToggleGroupItem>
                <ToggleGroupItem 
                  value="industry" 
                  aria-label="Industry user"
                  className="flex-1 rounded-md data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm transition-all text-xs font-medium h-8"
                >
                  Industry
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Charges per sample</p>
              <p className="text-lg font-semibold text-primary">
                {userType === "educational" && pricing.educational}
                {userType === "government" && pricing.government}
                {userType === "industry" && pricing.industry}
              </p>
            </div>
          </div>
        )}
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

      <CardFooter className="flex gap-2">
        <Button className="flex-1 gap-2" disabled={!available}>
          <Calendar className="h-4 w-4" />
          {available ? "Book Now" : "View Schedule"}
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Info className="h-4 w-4" />
              More Info
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription>{category}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">{description}</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">{address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Technical Person</p>
                    <p className="text-sm text-muted-foreground">{technicalPerson}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Contact Number</p>
                    <p className="text-sm text-muted-foreground">{contactNumber}</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
};

export default EquipmentCard;
