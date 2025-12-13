import { Hero } from "../components/modules/Landing/Hero";
import { Features } from "../components/modules/Landing/Features";
import "./globals.css"


 const LandingPage = () =>{
  return (
    <div className="min-h-[100dvh] h-full bg-gray-900 text-white w-full">
      <Hero />
      <Features />
    </div>
  );
}

export default LandingPage