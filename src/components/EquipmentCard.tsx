import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar, Clock, MapPin, User, Phone, Play, Info } from "lucide-react";
import { useState, useRef } from "react";

interface EquipmentCardProps {
  name: string;
  category: string;
  description: string;
  image: string;
  video?: string;
  available: boolean;
  nextAvailable?: string;
  address: string;
  technicalPerson: string;
  contactNumber: string;
  internalRate?: number;
  externalRate?: number;
  make?: string;
  model?: string;
  yearOfInstallation?: string;
  specifications?: string;
  sampleRequirements?: string;
  detailsUrl?: string;
}

const EquipmentCard = ({ 
  name, 
  category, 
  description, 
  image, 
  video, 
  available, 
  nextAvailable, 
  address, 
  technicalPerson, 
  contactNumber,
  internalRate,
  externalRate,
  make,
  model,
  yearOfInstallation,
  specifications,
  sampleRequirements,
  detailsUrl
}: EquipmentCardProps) => {
  const [userType, setUserType] = useState<string>("internal");
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handlePauseVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-all duration-300 border-border hover:border-primary/30">
      <div className="aspect-square overflow-hidden bg-muted relative">
        {video ? (
          <>
            <video 
              ref={videoRef}
              src={video}
              className="w-full h-full object-cover"
              onEnded={() => setIsPlaying(false)}
              onClick={handlePauseVideo}
              poster={image}
            />
            {!isPlaying && (
              <button
                onClick={handlePlayVideo}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group/play"
                aria-label="Play video"
              >
                <div className="bg-primary/90 hover:bg-primary rounded-full p-4 transition-all group-hover/play:scale-110">
                  <Play className="h-8 w-8 text-primary-foreground fill-current" />
                </div>
              </button>
            )}
          </>
        ) : (
          <img 
            src={image} 
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
      </div>
      
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-xl line-clamp-1">{name}</CardTitle>
          <Badge variant={available ? "default" : "destructive"} className={available ? "shrink-0 bg-green-600 hover:bg-green-700" : "shrink-0"}>
            {available ? "Working" : "Not Working"}
          </Badge>
        </div>
        <CardDescription className="text-sm">{category}</CardDescription>
        
        <div className="flex items-center gap-3 pt-3">
          <ToggleGroup 
            type="single" 
            value={userType} 
            onValueChange={(value) => value && setUserType(value)}
            className="gap-0 bg-muted/50 rounded-lg p-1 w-full"
          >
            <ToggleGroupItem 
              value="internal" 
              aria-label="Internal user"
              className="flex-1 rounded-md data-[state=on]:bg-green-600 data-[state=on]:text-white data-[state=on]:shadow-sm transition-all text-xs font-medium h-8"
            >
              Internal
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="external" 
              aria-label="External user"
              className="flex-1 rounded-md data-[state=on]:bg-green-600 data-[state=on]:text-white data-[state=on]:shadow-sm transition-all text-xs font-medium h-8"
            >
              External
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
        
        {(internalRate || externalRate) && (
          <div className="pt-2 border-t">
            <p className="text-xs font-semibold text-foreground mb-2">Charges (per hour)</p>
            <div className="grid grid-cols-2 gap-2">
              {userType === "internal" && internalRate && (
                <div className="bg-muted/50 rounded-md p-2">
                  <p className="text-xs text-muted-foreground">Internal</p>
                  <p className="text-sm font-semibold text-foreground">₹{internalRate}</p>
                </div>
              )}
              {userType === "external" && externalRate && (
                <div className="bg-muted/50 rounded-md p-2">
                  <p className="text-xs text-muted-foreground">External</p>
                  <p className="text-sm font-semibold text-foreground">₹{externalRate}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button className="flex-1 gap-2" disabled={!available}>
          <Calendar className="h-4 w-4" />
          Book Now
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex-1">
              More Info
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl">{name}</DialogTitle>
              <DialogDescription>{category}</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {make && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Make</p>
                    <p className="text-sm text-muted-foreground">{make}</p>
                  </div>
                )}
                {model && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Model</p>
                    <p className="text-sm text-muted-foreground">{model}</p>
                  </div>
                )}
                {yearOfInstallation && (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Year of Installation</p>
                    <p className="text-sm text-muted-foreground">{yearOfInstallation}</p>
                  </div>
                )}
              </div>

              {specifications && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Specifications</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{specifications}</p>
                </div>
              )}

              {sampleRequirements && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Sample Requirements</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{sampleRequirements}</p>
                </div>
              )}

              <div className="border-t pt-4 space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Address</p>
                    <p className="text-sm text-muted-foreground">{address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Technical Person</p>
                    <p className="text-sm text-muted-foreground">{technicalPerson}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Contact Number</p>
                    <p className="text-sm text-muted-foreground">{contactNumber}</p>
                  </div>
                </div>
              </div>

              {detailsUrl && (
                <div className="pt-2">
                  <a 
                    href={detailsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-2"
                  >
                    View full technical details
                    <Info className="h-4 w-4" />
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
};

export default EquipmentCard;
