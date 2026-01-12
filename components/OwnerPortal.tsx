
import React from 'react';

const SERVICES = [
  {
    title: "SEO & Local Search",
    description: "Be the first result when locals search for 'dispensary near me'. We optimize your maps and local directory ranking.",
    icon: "🔍",
    category: "Digital"
  },
  {
    title: "Reputation Management",
    description: "Automate review collection across Google, Leafly, and MapleLeaf. Handle negative feedback before it goes public.",
    icon: "⭐",
    category: "Digital"
  },
  {
    title: "Same-Day Delivery Hub",
    description: "Integrate our logistical API to offer 1-hour delivery to your customers using our dedicated courier network.",
    icon: "⚡",
    category: "Logistics"
  },
  {
    title: "Social Media Growth",
    description: "Cannabis-compliant marketing strategies for Instagram and TikTok. Content creation and influencer outreach.",
    icon: "📸",
    category: "Digital"
  }
];

export const OwnerPortal: React.FC = () => {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Hero Section */}
      <section className="bg-stone-900 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-black mb-6 leading-tight">
              Empower Your <span className="text-emerald-400">Cannabis Retail</span> Business
            </h1>
            <p className="text-xl text-stone-400 mb-10 leading-relaxed">
              Join Canada's fastest growing directory. Claim your listing, manage your digital reputation, and unlock logistical services to outscale the competition.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold transition shadow-lg shadow-emerald-600/20">
                Claim Your Listing
              </button>
              <button className="bg-stone-800 hover:bg-stone-700 text-white px-8 py-4 rounded-xl font-bold transition border border-stone-700">
                View Services
              </button>
            </div>
          </div>
          <div className="bg-stone-800 p-8 rounded-3xl border border-stone-700 shadow-2xl">
            <h3 className="text-2xl font-bold mb-6">List Your Shop</h3>
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input type="text" placeholder="First Name" className="bg-stone-900 border border-stone-700 rounded-lg p-3 w-full focus:border-emerald-500 outline-none" />
                <input type="text" placeholder="Last Name" className="bg-stone-900 border border-stone-700 rounded-lg p-3 w-full focus:border-emerald-500 outline-none" />
              </div>
              <input type="email" placeholder="Business Email" className="bg-stone-900 border border-stone-700 rounded-lg p-3 w-full focus:border-emerald-500 outline-none" />
              <input type="text" placeholder="Store Name" className="bg-stone-900 border border-stone-700 rounded-lg p-3 w-full focus:border-emerald-500 outline-none" />
              <select className="bg-stone-900 border border-stone-700 rounded-lg p-3 w-full focus:border-emerald-500 outline-none">
                <option>Shop Type</option>
                <option>Licensed (Provincially Regulated)</option>
                <option>Aboriginal / Sovereign Shop</option>
              </select>
              <button className="w-full bg-emerald-600 py-4 rounded-lg font-bold hover:bg-emerald-500 transition mt-4">
                Submit Request
              </button>
              <p className="text-xs text-stone-500 text-center">
                Regulated stores will be verified via Google Business Profile sync.
              </p>
            </form>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-24 max-w-7xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-4">Comprehensive Growth Services</h2>
          <p className="text-stone-500 max-w-2xl mx-auto">We don't just list your business. We provide the tools you need to dominate your local market.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {SERVICES.map((service, idx) => (
            <div key={idx} className="bg-white p-8 rounded-2xl border border-stone-200 shadow-sm hover:border-emerald-500 transition group">
              <div className="text-4xl mb-4 group-hover:scale-110 transition duration-300 inline-block">{service.icon}</div>
              <h4 className="text-xl font-bold text-stone-900 mb-3">{service.title}</h4>
              <p className="text-stone-500 text-sm leading-relaxed">{service.description}</p>
              <div className="mt-6">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  {service.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Integration Call to Action */}
      <section className="bg-emerald-50 py-24 mb-24 rounded-[40px] mx-4 border border-emerald-100">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-3xl font-black text-stone-900 mb-6">Own a Sovereign Aboriginal Shop?</h2>
          <p className="text-lg text-stone-600 mb-8">
            We understand the unique regulatory landscape. Aboriginal shop owners can claim their listings directly on our platform without Google verification. Highlight your traditional roots and community impact today.
          </p>
          <button className="bg-stone-900 text-white px-10 py-4 rounded-xl font-bold hover:bg-stone-800 transition">
            Start Your Claim
          </button>
        </div>
      </section>
    </div>
  );
};
