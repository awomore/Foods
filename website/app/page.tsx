import SiteNav from '@/components/site/SiteNav';
import SiteFooter from '@/components/site/SiteFooter';
import HomeHero from '@/components/home/HomeHero';
import TrustStrip from '@/components/home/TrustStrip';
import CreatorEconomy from '@/components/home/CreatorEconomy';
import StoryFlow from '@/components/home/StoryFlow';
import FeaturedCreators from '@/components/home/FeaturedCreators';
import Capabilities from '@/components/home/Capabilities';
import SuccessStories from '@/components/home/SuccessStories';
import FleetTeaser from '@/components/home/FleetTeaser';
import ThreeDoors from '@/components/home/ThreeDoors';

export default function Home() {
  return (
    <>
      <SiteNav overlay />
      <main>
        <HomeHero />
        <TrustStrip />
        <CreatorEconomy />
        <StoryFlow />
        <FeaturedCreators />
        <Capabilities />
        <SuccessStories />
        <FleetTeaser />
        <ThreeDoors />
      </main>
      <SiteFooter />
    </>
  );
}
