import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import FeaturedCooks from '@/components/FeaturedCooks';
import WhyExists from '@/components/WhyExists';
import ProductShowcase from '@/components/ProductShowcase';
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
        <WhyExists />
        <ProductShowcase />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
