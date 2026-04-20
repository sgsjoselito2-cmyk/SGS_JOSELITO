import React from 'react';
import { JOSELITO_LOGO } from '../constants';

interface RootMenuProps {
  onSelectOption: (option: 'top5' | 'top15' | 'top60') => void;
  onOpenConfig: () => void;
}

const RootMenu: React.FC<RootMenuProps> = ({ onSelectOption, onOpenConfig }) => {
  const options = [
    { 
      id: 'top5' as const, 
      name: 'TOP 5', 
      sub: 'GESTIÓN OPERATIVA DIARIA', 
      desc: 'Seguimiento de producción, OEE y terminales de taller.',
      color: 'blue',
      status: 'active',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" />
        </svg>
      )
    },
    { 
      id: 'top15' as const, 
      name: 'TOP 15', 
      sub: 'MANDOS INTERMEDIOS', 
      desc: 'Análisis táctico, planificación semanal y coordinación de recursos.',
      color: 'emerald',
      status: 'active',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      id: 'top60' as const, 
      name: 'TOP 60', 
      sub: 'DIRECCIÓN ESTRATÉGICA', 
      desc: 'Visión global de planta, KPIs estratégicos y reporte ejecutivo.',
      color: 'indigo',
      status: 'active',
      icon: (
        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-[60vh] py-2 sm:py-4 flex flex-col items-center animate-in fade-in zoom-in duration-700">
      <div className="text-center mb-4 sm:mb-6 flex flex-col items-center px-4">
        <div className="flex flex-col items-center mb-2 overflow-visible">
          {JOSELITO_LOGO ? (
            <img 
              src={JOSELITO_LOGO} 
              alt="JOSELITO" 
              className="h-16 sm:h-24 w-auto object-contain drop-shadow-sm my-2"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                if (fallback) (fallback as HTMLElement).style.display = 'block';
              }}
            />
          ) : (
            <h1 className="text-4xl sm:text-6xl font-serif font-black text-slate-900 tracking-tight leading-none">JOSELITO</h1>
          )}
          <h1 className="logo-fallback text-4xl sm:text-6xl font-serif font-black text-slate-900 tracking-tight leading-none hidden">JOSELITO</h1>
        </div>
        <p className="text-slate-400 font-black text-[12px] sm:text-[16px] tracking-[0.3em] uppercase">SISTEMA CENTRAL DE PRODUCCIÓN</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 max-w-5xl w-full px-4 sm:px-6">
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => opt.status !== 'soon' && onSelectOption(opt.id)}
            className={`group relative p-4 sm:p-6 rounded-2xl border-2 border-slate-100 bg-white text-left transition-all duration-500 flex flex-col justify-between overflow-hidden min-h-[280px] sm:min-h-[380px] ${
              opt.status === 'soon' ? 'opacity-60 grayscale cursor-not-allowed' : 'hover:border-blue-600 hover:shadow-xl hover:-translate-y-1'
            }`}
          >
            <div className="absolute -right-6 -bottom-6 sm:-right-8 sm:-bottom-8 opacity-[0.03] group-hover:scale-125 transition-transform duration-700 text-slate-900">
              {opt.icon}
            </div>

            <div className="relative z-10">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 bg-slate-50 text-slate-400 transition-all duration-500 ${opt.status !== 'soon' ? 'group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-blue-200' : ''}`}>
                {React.cloneElement(opt.icon as React.ReactElement<any>, { className: "w-5 h-5 sm:w-7 sm:h-7" })}
              </div>
              <h3 className="text-xl sm:text-2xl font-serif font-black text-slate-900 tracking-tight mb-0.5 sm:mb-1 leading-none">{opt.name}</h3>
              <p className={`text-[16px] sm:text-[15px] font-black uppercase tracking-[0.1em] mb-1.5 sm:mb-3 ${opt.id === 'top5' ? 'text-blue-600' : opt.id === 'top15' ? 'text-emerald-600' : 'text-indigo-600'}`}>{opt.sub}</p>
              <p className="text-slate-500 font-medium leading-relaxed text-[15px] sm:text-[16px] max-w-[160px]">
                {opt.desc}
              </p>
            </div>

            <div className="relative z-10 flex items-center justify-between mt-auto">
              <span className={`text-[16px] sm:text-[15px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest ${
                opt.status === 'soon' ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'
              }`}>
                {opt.status === 'soon' ? 'PRÓXIMAMENTE' : 'ACCEDER'}
              </span>
              {opt.status !== 'soon' && (
                <div className="w-8 h-8 rounded-full border-2 border-slate-100 flex items-center justify-center text-slate-300 group-hover:border-blue-600 group-hover:text-blue-600 transition-all group-hover:translate-x-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 sm:mt-12 flex flex-col items-center opacity-80 transition-all hover:opacity-100">
        <p className="text-[12px] sm:text-[15px] font-black text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-2 sm:mb-4">Partner Tecnológico</p>
        <a 
          href="https://leansisproductividad.com/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center justify-center w-full px-4 overflow-visible hover:scale-105 transition-transform duration-300"
        >
           <svg width="1500" height="300" viewBox="-150 -50 1400 350" xmlns="http://www.w3.org/2000/svg" className="h-10 sm:h-16 w-auto drop-shadow-md overflow-visible" preserveAspectRatio="xMidYMid meet">
             <text x="20" y="130" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="130" fill="#71717a" letterSpacing="-6">SGS</text>
             <text x="320" y="130" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="130" fill="#f47920" letterSpacing="-4">PRODUCTIVITY</text>
             <text x="800" y="210" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="42" fill="#71717a" opacity="0.8">by Leansis</text>
           </svg>
        </a>
      </div>
    </div>
  );
};

export default RootMenu;