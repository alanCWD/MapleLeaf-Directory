
import React from 'react';

const SERVICES = [
  {
    title: "Sovereign Visibility",
    description: "Get discovered by conscious consumers looking for heritage harvests and sovereign stashes.",
    icon: "🌾",
    category: "Exposure"
  },
  {
    title: "Community Trust",
    description: "Showcase your traditional roots and local impact. We prioritize community storytelling over corporate metrics.",
    icon: "🤝",
    category: "Story"
  },
  {
    title: "Direct Connect",
    description: "Build direct relationships with your customers. Our platform facilitates independent shop growth without corporate gatekeeping.",
    icon: "🔗",
    category: "Growth"
  },
  {
    title: "Legacy Optimization",
    description: "Modern tools for traditional stashes. Digital presence that respects your independent operations.",
    icon: "✨",
    category: "Digital"
  }
];

export const OwnerPortal: React.FC = () => {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section - Updated to avoid black bar */}
      <section className="bg-gradient-to-br from-emerald-900 via-[#0a2e1f] to-purple-900 text-white py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight tracking-tight">
              Empower Your <span className="text-emerald-400 underline decoration-purple-500/40 decoration-wavy">Sovereignty</span>
            </h1>
            <p className="text-xl text-stone-300 mb-10 leading-relaxed font-medium">
              Exclusively for Sovereign Indigenous shops and local gems. We are the anti-corporate directory, connecting connoisseurs with the real roots of Canadian cannabis.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-900/40">
                Claim Your Shop
              </button>
              <button className="bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-xl font-bold transition border border-white/20 backdrop-blur-md">
                View Our Mission
              </button>
            </div>
          </div>
          <div className="bg-white/5 p-8 rounded-[40px] border border-white/10 shadow-2xl backdrop-blur-xl">
            <h3 className="text-2xl font-black mb-6 text-white">List Your Independent Gem</h3>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="First Name" className="bg-white/10 border border-white/10 rounded-2xl p-4 w-full focus:border-emerald-400 outline-none text-white placeholder-stone-400" />
                <input type="text" placeholder="Last Name" className="bg-white/10 border border-white/10 rounded-2xl p-4 w-full focus:border-emerald-400 outline-none text-white placeholder-stone-400" />
              </div>
              <input type="email" placeholder="Contact Email" className="bg-white/10 border border-white/10 rounded-2xl p-4 w-full focus:border-emerald-400 outline-none text-white placeholder-stone-400" />
              <input type="text" placeholder="Shop Name" className="bg-white/10 border border-white/10 rounded-2xl p-4 w-full focus:border-emerald-400 outline-none text-white placeholder-stone-400" />
              <select className="bg-white/10 border border-white/10 rounded-2xl p-4 w-full focus:border-emerald-400 outline-none text-white">
                <option className="bg-emerald-900">Shop Type</option>
                <option className="bg-emerald-900">Sovereign (Indigenous Owned)</option>
                <option className="bg-emerald-900">Local Gem (Independent / Legacy)</option>
              </select>
              <button className="w-full bg-emerald-500 py-5 rounded-2xl font-black hover:bg-emerald-400 transition mt-4 text-white uppercase tracking-widest shadow-xl shadow-emerald-900/40">
                Join the Network
              </button>
              <p className="text-[10px] text-stone-400 text-center font-bold uppercase tracking-widest mt-4">
                We verify based on independent community status.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-stone-900 mb-4 tracking-tight">Elevating the Independent Spirit</h2>
          <p className="text-stone-500 max-w-2xl mx-auto font-medium">We focus exclusively on the shops that keep the culture alive, prioritizing heritage over corporate scaling.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {SERVICES.map((service, idx) => (
            <div key={idx} className="bg-white p-8 rounded-[32px] border border-stone-200 shadow-sm hover:border-emerald-500 hover:shadow-2xl transition-all duration-500 group">
              <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center text-4xl mb-6 group-hover:scale-110 transition duration-300 shadow-inner">{service.icon}</div>
              <h4 className="text-xl font-black text-stone-900 mb-3">{service.title}</h4>
              <p className="text-stone-500 text-sm leading-relaxed font-medium">{service.description}</p>
              <div className="mt-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100">
                  {service.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration Call to Action */}
      <section className="bg-emerald-50 py-24 mb-24 rounded-[64px] mx-4 border border-emerald-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -ml-32 -mt-32"></div>
        <div className="max-w-4xl mx-auto text-center px-4 relative z-10">
          <h2 className="text-3xl md:text-4xl font-black text-stone-900 mb-6 tracking-tight">Own a Sovereign Shop?</h2>
          <p className="text-lg text-stone-600 mb-8 font-medium">
            Highlight your traditional roots and community impact today. Our platform is designed to respect and elevate sovereign commerce without the interference of corporate standardizing.
          </p>
          <button className="bg-stone-900 text-white px-12 py-5 rounded-2xl font-black hover:bg-emerald-600 transition shadow-2xl shadow-stone-900/10">
            Start Your Claim
          </button>
        </div>
      </section>
    </div>
  );
};
