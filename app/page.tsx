import SceneLoader from "@/components/scene/SceneLoader";
import SmoothScroll from "@/components/SmoothScroll";
import ScrollEffects from "@/components/ScrollEffects";
import Loader from "@/components/ui/Loader";
import Chrome from "@/components/ui/Chrome";
import Hero from "@/components/sections/Hero";
import About from "@/components/sections/About";
import Experience from "@/components/sections/Experience";
import Projects from "@/components/sections/Projects";
import Research from "@/components/sections/Research";
import Skills from "@/components/sections/Skills";
import Contact from "@/components/sections/Contact";

export default function Home() {
  return (
    <SmoothScroll>
      <Loader />
      <SceneLoader />
      <div className="scene-veil" aria-hidden />
      <Chrome />
      <main className="relative z-10">
        <Hero />
        <About />
        <Experience />
        <Projects />
        <Research />
        <Skills />
        <Contact />
      </main>
      {/* Must render after the sections so pinned triggers exist first */}
      <ScrollEffects />
    </SmoothScroll>
  );
}
