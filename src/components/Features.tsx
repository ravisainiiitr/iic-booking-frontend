import { Calendar, Clock, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: Calendar,
    title: "Easy Booking",
    description: "Schedule equipment usage with our intuitive calendar interface. Real-time availability updates."
  },
  {
    icon: Clock,
    title: "24/7 Access",
    description: "Book equipment anytime, anywhere. Automated approval process for verified users."
  },
  {
    icon: Shield,
    title: "Secure Platform",
    description: "Enterprise-grade security for your research data. GDPR compliant and ISO certified."
  },
  {
    icon: Zap,
    title: "Instant Confirmation",
    description: "Get immediate booking confirmations via email and SMS. Integration with calendar apps."
  }
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Why Choose IIC Booking
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Streamline your research workflow with our comprehensive booking platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index} 
                className="group p-6 rounded-lg bg-card border border-border hover:border-primary/30 transition-all duration-300 hover:shadow-lg"
              >
                <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
