import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Heart, 
  Globe, 
  Smartphone, 
  Monitor, 
  CheckCircle, 
  ArrowRight,
  Plus,
  Users,
  MessageSquare,
  Layout,
  Star,
  Zap,
  Shield
} from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#2D2424] selection:bg-[#C5A059] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-[#C5A059]/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#C5A059] rounded-xl flex items-center justify-center shadow-lg shadow-[#C5A059]/20">
              <Heart className="w-6 h-6 text-white fill-current" />
            </div>
            <span className="text-2xl font-serif font-black tracking-tighter">
              eventframe<span className="text-[#C5A059]">.io</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-[10px] uppercase font-black tracking-widest text-gray-400">
            <a href="#agencies" className="hover:text-[#C5A059] transition-colors">Agencies</a>
            <a href="#couples" className="hover:text-[#C5A059] transition-colors">Couples</a>
            <a href="#features" className="hover:text-[#C5A059] transition-colors">Features</a>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-[#C5A059] transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="hidden sm:flex px-6 py-2.5 bg-[#C5A059] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#B38D45] transition-all shadow-lg shadow-[#C5A059]/20 active:scale-95"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/20 text-[#C5A059] text-[10px] font-black uppercase tracking-widest mb-6">
                <Zap className="w-3 h-3" />
                White-label Wedding Platform
              </div>
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-serif leading-[1.1] mb-8 tracking-tight">
                The New Standard <br />
                <span className="text-[#C5A059]">for Modern</span> <br />
                Weddings
              </h1>
              <p className="text-xl text-gray-500 font-medium leading-relaxed max-w-xl mb-10">
                A custom-branded experience for agencies to provide luxury digital wedding suites to their clients. Real-time moderation, RSVP management, and immersive guest interactions.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-10 py-5 bg-[#C5A059] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#B38D45] transition-all shadow-2xl shadow-[#C5A059]/30 active:scale-95 flex items-center justify-center gap-3"
                >
                  Start Your Agency
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button 
                onClick={() => navigate('/couple/login')}
                className="w-full sm:w-auto px-10 py-5 bg-white text-[#2D2424] border border-gray-100 rounded-2xl font-black uppercase tracking-widest hover:border-[#C5A059]/30 transition-all shadow-xl active:scale-95"
                >
                  Couple Login
                </button>
              </div>

              <div className="mt-12 flex items-center gap-6">
                <div className="flex -space-x-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="w-12 h-12 rounded-full ring-4 ring-[#FDFBF7] bg-gray-200 overflow-hidden">
                      <img src={`https://i.pravatar.cc/150?u=wedding_${i}`} alt="User" />
                    </div>
                  ))}
                </div>
                <div className="text-xs font-bold text-gray-400">
                  <span className="text-[#2D2424]">500+</span> Agencies trust eventframe.io
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="relative"
            >
              {/* Mockup Display */}
              <div className="relative bg-white rounded-[3rem] shadow-2xl border border-gray-100 p-4 transform rotate-1 lg:rotate-3">
                <div className="aspect-[4/5] bg-[#F9F6F0] rounded-[2.5rem] overflow-hidden relative group">
                  <img src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80" alt="Wedding App" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all" />
                  
                  <div className="absolute bottom-8 left-8 right-8 bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center">
                        <Heart className="w-6 h-6 text-[#C5A059] fill-current" />
                      </div>
                      <div>
                        <h4 className="text-white font-serif text-xl">Lucas & Sofia</h4>
                        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest">Villa Erba, Lake Como</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating UI Elements */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-10 -left-10 bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 hidden md:block"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-[#2D2424]">New RSVP</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold mb-1">MARIA DELGADO</p>
                  <p className="text-sm font-medium">Attending + 2 Guests</p>
                </motion.div>

                <motion.div 
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute -bottom-10 -right-10 bg-[#C5A059] p-6 rounded-3xl shadow-2xl text-white hidden md:block"
                >
                  <MessageSquare className="w-6 h-6 mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-2">GUEST MESSAGE</p>
                  <p className="font-serif italic text-lg leading-snug">"So happy for you both! <br />Can't wait to dance."</p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Agency Benefits */}
      <section id="agencies" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-4xl md:text-5xl font-serif mb-6 tracking-tight">For Event Agencies</h2>
            <p className="text-gray-500 font-medium leading-relaxed">
              Elevate your service offering with professional digital tools. Manage all your clients under one roof with full white-label capabilities.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Globe,
                title: "Custom Domain Slugs",
                desc: "Every wedding gets its own personalized URL under your organization's umbrella."
              },
              {
                icon: Layout,
                title: "Template Ecosystem",
                desc: "Choose from our curated luxury aesthetics. Minimal, Floral, Dark, or Garden themes."
              },
              {
                icon: Shield,
                title: "Full Control",
                desc: "Moderate guest messages, manage RSVPs, and oversee your agency's entire event portfolio."
              }
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-[2.5rem] bg-gray-50 hover:bg-[#FDFCF0] transition-all border border-transparent hover:border-[#C5A059]/10 group">
                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-8 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-7 h-7 text-[#C5A059]" />
                </div>
                <h3 className="text-xl font-serif text-[#2D2424] mb-4">{feature.title}</h3>
                <p className="text-gray-500 text-sm font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Couple Features */}
      <section id="couples" className="py-32 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[#C5A059]/5 -skew-y-3 origin-top-left" />
        <div className="max-w-7xl mx-auto px-6 relative">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="lg:w-1/2 order-2 lg:order-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4 pt-12">
                  <div className="aspect-square bg-white rounded-3xl p-6 shadow-xl border border-gray-100 flex flex-col justify-between">
                    <Users className="w-8 h-8 text-[#C5A059]" />
                    <div>
                      <p className="text-2xl font-serif">RSVP</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Real-time Tracking</p>
                    </div>
                  </div>
                  <div className="aspect-[4/5] bg-gray-200 rounded-3xl overflow-hidden ring-1 ring-gray-100">
                    <img src="https://images.unsplash.com/photo-1510076857177-7470076d4098?auto=format&fit=crop&q=80" alt="Couple" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="aspect-[3/4] bg-gray-200 rounded-3xl overflow-hidden ring-1 ring-gray-100">
                    <img src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&q=80" alt="Wedding Table" className="w-full h-full object-cover" />
                  </div>
                  <div className="aspect-square bg-[#C5A059] rounded-3xl p-6 shadow-xl text-white flex flex-col justify-between">
                    <Monitor className="w-8 h-8" />
                    <div>
                      <p className="text-2xl font-serif">Display</p>
                      <p className="text-[10px] font-black opacity-60 uppercase tracking-widest">Live Guest Board</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:w-1/2 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A059]/10 border border-[#C5A059]/20 text-[#C5A059] text-[10px] font-black uppercase tracking-widest mb-6">
                Loved by Couples
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif leading-tight mb-8">
                Manage your day <br />
                <span className="text-[#C5A059]">without the stress.</span>
              </h2>
              <ul className="space-y-6 mb-10">
                {[
                  "Personalized Couple Dashboard",
                  "Instant Guest Message Moderation",
                  "Digital Guest RSVP & Dietary Tracking",
                  "Elegant Live Display for the Wedding Day"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-lg font-medium text-gray-600">
                    <div className="w-6 h-6 rounded-full bg-[#C5A059]/10 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-[#C5A059]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => navigate('/couple/login')}
                className="group flex items-center gap-4 text-[#C5A059] text-sm font-black uppercase tracking-widest hover:gap-6 transition-all"
              >
                Explore Couple Tools
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="bg-[#2D2424] rounded-[4rem] p-12 md:p-24 text-white relative overflow-hidden">
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative z-10"
            >
              <h2 className="text-4xl md:text-6xl font-serif mb-8 max-w-2xl mx-auto leading-tight">
                Ready to transform <br />
                your wedding agency?
              </h2>
              <p className="text-white/60 text-lg font-medium max-w-xl mx-auto mb-12">
                Join the exclusive network of wedding professionals providing elite digital experiences.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full sm:w-auto px-12 py-6 bg-[#C5A059] text-white rounded-3xl font-black uppercase tracking-widest hover:bg-[#B38D45] transition-all shadow-2xl active:scale-95"
                >
                  Create Your Account
                </button>
                <div className="flex items-center gap-2 text-white/40 text-[10px] font-black uppercase tracking-widest">
                  <Star className="w-3 h-3 fill-current text-[#C5A059]" />
                  No credit card required
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-[#C5A059] rounded-lg flex items-center justify-center">
                  <Heart className="w-5 h-5 text-white fill-current" />
                </div>
                <span className="text-xl font-serif font-black tracking-tighter text-[#2D2424]">
                  eventframe<span className="text-[#C5A059]">.io</span>
                </span>
              </div>
              <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-xs">
                Luxury white-label platforms for modern event professionals and high-end wedding planning.
              </p>
            </div>
            
            <div>
              <h5 className="text-[10px] uppercase font-black tracking-widest text-[#2D2424] mb-6">Platform</h5>
              <ul className="space-y-4 text-sm font-bold text-gray-400">
                <li><a href="#" className="hover:text-[#C5A059] transition-colors">Templates</a></li>
                <li><a href="#" className="hover:text-[#C5A059] transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-[#C5A059] transition-colors">Onboarding</a></li>
              </ul>
            </div>

            <div>
              <h5 className="text-[10px] uppercase font-black tracking-widest text-[#2D2424] mb-6">Support</h5>
              <ul className="space-y-4 text-sm font-bold text-gray-400">
                <li><a href="#" className="hover:text-[#C5A059] transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-[#C5A059] transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-[#C5A059] transition-colors">Contact</a></li>
              </ul>
            </div>

            <div className="col-span-2 lg:col-span-2">
              <h5 className="text-[10px] uppercase font-black tracking-widest text-[#2D2424] mb-6">Subscribe</h5>
              <div className="flex gap-2">
                <input 
                  type="email" 
                  placeholder="Email address"
                  className="flex-1 px-5 py-4 rounded-2xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all text-sm font-medium"
                />
                <button className="p-4 bg-[#C5A059] text-white rounded-2xl hover:bg-[#B38D45] transition-all">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-gray-50 flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-gray-300 text-xs font-bold font-mono">
              © 2024 EVENTFRAME.IO ALL RIGHTS RESERVED
            </p>
            <div className="flex items-center gap-8 text-[10px] uppercase font-black tracking-widest text-gray-300">
              <a href="#" className="hover:text-[#C5A059] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#C5A059] transition-colors">Terms</a>
              <a href="#" className="hover:text-[#C5A059] transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
