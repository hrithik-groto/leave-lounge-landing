
import React from 'react';
import Header from '@/components/Header';
import { HeroSectionDemo } from '@/components/HeroSectionDemo';
import Features from '@/components/Features';
import Testimonials from '@/components/Testimonials';
import Footer from '@/components/Footer';

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSectionDemo />
      <Features />
      <Testimonials />
      <Footer />
    </div>
  );
};

export default Index;
