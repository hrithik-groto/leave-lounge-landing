
import { HeroSection } from "@/components/ui/hero-section-dark"

function HeroSectionDemo() {
  return (
    <HeroSection
      title="Transform Your Leave Management"
      subtitle={{
        regular: "Streamline employee leave with ",
        gradient: "intelligent automation",
      }}
      description="Transform your HR processes with our comprehensive leave management platform. Save time, reduce paperwork, and keep your team happy with intelligent automation."
      ctaText="Start Free Trial"
      ctaHref="#"
      bottomImage={{
        light: "/lovable-uploads/f7c389df-ce85-4fa5-95d8-46c1221d2ff5.png",
        dark: "/lovable-uploads/f7c389df-ce85-4fa5-95d8-46c1221d2ff5.png",
      }}
      gridOptions={{
        angle: 65,
        opacity: 0.4,
        cellSize: 50,
        lightLineColor: "#4a4a4a",
        darkLineColor: "#2a2a2a",
      }}
    />
  )
}
export { HeroSectionDemo }
