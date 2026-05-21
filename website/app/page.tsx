import Nav from '@/components/Nav';
import Hero from '@/components/Hero';
import FoodGallery from '@/components/FoodGallery';
import Features from '@/components/Features';
import ForCooks from '@/components/ForCooks';
import Download from '@/components/Download';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <FoodGallery />
        <Features />
        <ForCooks />
        <Download />
      </main>
      <Footer />
    </>
  );
}
