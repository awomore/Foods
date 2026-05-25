import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import FeaturedCooks from '@/components/FeaturedCooks';
import HowItWorks from '@/components/HowItWorks';
import WhyExists from '@/components/WhyExists';
import ProductShowcase from '@/components/ProductShowcase';
import TrustSafety from '@/components/TrustSafety';
import Testimonials from '@/components/Testimonials';
import FAQ from '@/components/FAQ';
import CTA from '@/components/CTA';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <FeaturedCooks />
        <HowItWorks />
        <WhyExists />
        <ProductShowcase />
        <TrustSafety />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
