import SEOHead from '../components/ui/SEOHead';
import HeroSection from '../components/landing/HeroSection';
import SocialProofStrip from '../components/landing/SocialProofStrip';
import CampaignTypesSection from '../components/landing/CampaignTypesSection';
import FeaturesSection from '../components/landing/FeaturesSection';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import TestimonialsSection from '../components/landing/TestimonialsSection';
import PricingSection from '../components/landing/PricingSection';
import FaqSection from '../components/landing/FaqSection';
import FinalCtaSection from '../components/landing/FinalCtaSection';

const LandingPage = () => (
  <div className="overflow-hidden">
    <SEOHead
      title="AR Business Card Platform"
      description="QR codes that update, AR holograms, digital business cards — with real-time scan analytics. No app required. Start free."
    />
    <HeroSection />
    <SocialProofStrip />
    <CampaignTypesSection />
    <FeaturesSection />
    <HowItWorksSection />
    <TestimonialsSection />
    <PricingSection />
    <FaqSection />
    <FinalCtaSection />
  </div>
);

export default LandingPage;
