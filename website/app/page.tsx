import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Features from '@/components/Features';
import ForCooks from '@/components/ForCooks';
import Testimonials from '@/components/Testimonials';
import Waitlist from '@/components/Waitlist';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <ForCooks />
        <Testimonials />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
