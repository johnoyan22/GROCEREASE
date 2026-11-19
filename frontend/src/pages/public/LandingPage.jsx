import Navbar from "../../components/public/Navbar";
import HeroSection from "../../components/public/HeroSection";
import CategorySection from "../../components/public/CategorySection";

function LandingPage() {
    return (
        <div className="public-site min-h-dvh bg-white">
            <Navbar />
            <main className="px-4 pb-10 sm:px-6">
                <HeroSection />
                <CategorySection />
            </main>
        </div>
    );
}

export default LandingPage;
