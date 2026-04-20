import React from 'react';
import { JOSELITO_LOGO } from '../constants';

interface AreaCard {
  id: string;
  name: string;
  sub: string;
  icon: React.ReactNode;
  status: 'active' | 'soon' | 'maintenance';
  taller: number;
}

interface MainMenuProps {
  onSelectArea: (areaId: string) => void;
  selectedWorkshop: number | null;
  setSelectedWorkshop: (workshop: number | null) => void;
  operarios: any[];
  onUpdateOperario: (op: any) => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ 
  onSelectArea, 
  selectedWorkshop, 
  setSelectedWorkshop,
  operarios = [],
  onUpdateOperario
}) => {
  const areas: AreaCard[] = [
    { id: 'sb-preparacion', name: 'PREPARACIÓN', sub: 'Sala Blanca', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2"/></svg>, status: 'active', taller: 1 },
    { id: 'sb-loncheado', name: 'LONCHEADO', sub: 'Sala Blanca', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.282a2 2 0 01-1.806 0l-.628-.282a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547l-1.16 1.16a2 2 0 000 2.828l1.16 1.16a2 2 0 001.022.547l2.387.477a6 6 0 003.86-.517l.628-.282a2 2 0 011.806 0l.628.282a6 6 0 003.86-.517l2.387-.477a2 2 0 001.022-.547l1.16-1.16a2 2 0 000-2.828l-1.16-1.16z"/></svg>, status: 'active', taller: 1 },
    { id: 'sb-empaquetado-loncheado', name: 'EMP. LONCHEADO', sub: 'Sala Blanca', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>, status: 'active', taller: 1 },
    { id: 'sb-empaquetado-deshuesado', name: 'EMP. DESHUESADO', sub: 'Sala Blanca', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>, status: 'active', taller: 1 },
    { id: 'env-envasado', name: 'ENVASADO', sub: 'Envasado', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>, status: 'active', taller: 2 },
    { id: 'env-empaquetado', name: 'EMPAQUETADO', sub: 'Envasado', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>, status: 'active', taller: 2 },
    { id: 'expedicion', name: 'EXPEDICIONES', sub: 'Salida de Mercancía', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>, status: 'active', taller: 3 },
    { id: 'preparacion-exp', name: 'PREPARACIÓN EXP.', sub: 'Expediciones', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2"/></svg>, status: 'active', taller: 3 },
    { id: 'movimiento-jamones', name: 'MOVIMIENTOS', sub: 'Logística Interna', icon: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>, status: 'active', taller: 4 }
  ];

  const toggleArea = (op: any, areaId: string) => {
    const currentAreas = op.areas || [];
    const newAreas = currentAreas.includes(areaId)
      ? currentAreas.filter((a: string) => a !== areaId)
      : [...currentAreas, areaId];
    onUpdateOperario({ ...op, areas: newAreas });
  };

  const workshops = [
    { id: 1, name: 'SALA BLANCA', sub: 'Preparación, Loncheado y Empaquetado', icon: <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.282a2 2 0 01-1.806 0l-.628-.282a6 6 0 00-3.86-.517l-2.387.477a2 2 0 00-1.022.547l-1.16 1.16a2 2 0 000 2.828l1.16 1.16a2 2 0 001.022.547l2.387.477a6 6 0 003.86-.517l.628-.282a2 2 0 011.806 0l.628.282a6 6 0 003.86-.517l2.387-.477a2 2 0 001.022-.547l1.16-1.16a2 2 0 000-2.828l-1.16-1.16z"/></svg> },
    { id: 2, name: 'ENVASADO', sub: 'Envasado y Empaquetado', icon: <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> },
    { id: 3, name: 'EXPEDICIONES', sub: 'Expediciones y Preparación', icon: <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg> },
    { id: 4, name: 'MOVIMIENTOS', sub: 'Logística Interna', icon: <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg> }
  ];

  const filteredAreas = areas.filter(a => a.taller === selectedWorkshop);

  return (
    <div className="min-h-[60vh] py-2 sm:py-4 flex flex-col items-center animate-in fade-in zoom-in duration-500">
      <div className="text-center mb-4 sm:mb-6 flex flex-col items-center px-4">
        <div className="flex flex-col items-center mb-2 overflow-visible">
          {/* Logo Joselito mejorado */}
          {JOSELITO_LOGO ? (
            <img 
              src={JOSELITO_LOGO} 
              alt="Joselito" 
              className="h-10 sm:h-16 w-auto object-contain drop-shadow-sm my-2"
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                if (fallback) (fallback as HTMLElement).style.display = 'block';
              }}
            />
          ) : (
            <h1 className="text-3xl sm:text-5xl font-serif font-black text-slate-900 tracking-tight leading-none">JOSELITO</h1>
          )}
          <h1 className="logo-fallback text-3xl sm:text-5xl font-serif font-black text-slate-900 tracking-tight leading-none hidden">JOSELITO</h1>
        </div>
        <p className="text-slate-400 font-black text-[12px] sm:text-[16px] tracking-[0.3em] uppercase text-center">
          {selectedWorkshop ? `NAVEGANDO: ${workshops.find(w => w.id === selectedWorkshop)?.name}` : 'SISTEMA CENTRAL DE PRODUCCIÓN'}
        </p>
      </div>

      {!selectedWorkshop ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl w-full px-4 sm:px-6">
          {workshops.map((w) => (
            <button
              key={w.id}
              onClick={() => setSelectedWorkshop(w.id)}
              className="group relative p-4 sm:p-5 rounded-2xl border-2 border-slate-100 bg-white text-left transition-all duration-700 hover:border-blue-500 hover:-translate-y-1 h-[240px] sm:h-[340px] flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-xl hover:shadow-blue-50"
            >
              <div className="absolute -right-8 -bottom-8 sm:-right-10 sm:-bottom-10 opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-125 group-hover:rotate-12 transition-all duration-1000 text-slate-900 pointer-events-none">
                 {React.isValidElement(w.icon) && React.cloneElement(w.icon as React.ReactElement<any>, { className: "w-24 h-24 sm:w-36 h-36" })}
              </div>

              <div className="relative z-10">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-3 sm:mb-4 bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white group-hover:rotate-6 transition-all duration-500 shadow-inner`}>
                  {React.cloneElement(w.icon as React.ReactElement<any>, { className: "w-5 h-5 sm:w-7 sm:h-7" })}
                </div>
                <h3 className="text-xl sm:text-2xl font-serif font-black text-slate-900 tracking-tight mb-0.5 sm:mb-1 leading-none transition-all">
                  {w.name}
                </h3>
                <p className="text-[16px] sm:text-[14px] font-bold text-slate-400 uppercase tracking-widest max-w-[80%]">{w.sub}</p>
              </div>

              <div className="relative z-10 flex items-center justify-between">
                <span className="text-[16px] font-black text-blue-600 bg-blue-50/50 px-3 py-1.5 rounded-full uppercase tracking-widest border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  {areas.filter(a => a.taller === w.id).length} ÁREAS
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M9 5l7 7-7 7"/></svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full max-w-[95%]">
          <div className="flex flex-wrap justify-center gap-4 animate-in slide-in-from-bottom-6 duration-700">
            {(() => {
              const workshop = workshops.find(w => w.id === selectedWorkshop);
              const workshopName = workshop?.name || '';
              const dashboardId = selectedWorkshop === 1 ? 'sala-blanca-dashboard' : 
                                  selectedWorkshop === 2 ? 'envasado-dashboard' : 
                                  selectedWorkshop === 3 ? 'expediciones-dashboard' : null;
              
              if (!dashboardId) return null;

              return (
                <button
                  key={dashboardId}
                  onClick={() => onSelectArea(dashboardId)}
                  className="group relative p-4 rounded-2xl border-2 border-slate-800 bg-slate-900 text-left transition-all duration-700 overflow-hidden h-[240px] w-full sm:w-[300px] flex flex-col justify-between hover:border-blue-600 hover:-translate-y-1 shadow-xl hover:shadow-black/10"
                >
                  <div className="absolute -right-4 -bottom-4 opacity-[0.1] group-hover:opacity-[0.2] transition-all duration-1000 group-hover:scale-150 group-hover:rotate-[20deg] text-white pointer-events-none">
                    <svg className="w-24 h-24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                  </div>

                  <div className="relative z-10">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-white/10 text-white group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                    </div>
                    <h3 className="text-xl font-serif font-black text-white tracking-tight leading-tight mb-1 transition-all">
                      DASHBOARD {workshopName}
                    </h3>
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-[90%]">
                      KPIs y Análisis Operativo
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center justify-between mt-auto">
                    <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/10 text-white border border-white/20 transition-all group-hover:bg-blue-600 group-hover:border-blue-500">
                      SISTEMA
                    </span>
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-blue-600 transition-all shadow-sm">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                    </div>
                  </div>
                </button>
              );
            })()}
            {filteredAreas.map((area) => (
              <button
                key={area.id}
                onClick={() => onSelectArea(area.id)}
                className="group relative p-4 rounded-2xl border-2 border-slate-100 bg-white text-left transition-all duration-700 overflow-hidden h-[240px] w-full sm:w-[300px] flex flex-col justify-between hover:border-blue-600 hover:-translate-y-1 shadow-sm hover:shadow-xl hover:shadow-blue-50"
              >
                <div className="absolute -right-4 -bottom-4 opacity-[0.04] group-hover:opacity-[0.1] transition-all duration-1000 group-hover:scale-150 group-hover:rotate-[20deg] text-blue-900 pointer-events-none">
                   {React.isValidElement(area.icon) && React.cloneElement(area.icon as React.ReactElement<any>, { className: "w-24 h-24" })}
                </div>

                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:-rotate-6 transition-all duration-500 shadow-inner">
                    {area.icon}
                  </div>
                  <h3 className={`${area.name.length > 20 ? 'text-[13px]' : area.name.length > 12 ? 'text-base' : 'text-xl'} font-serif font-black text-slate-900 tracking-tight leading-tight mb-1 transition-all`}>
                    {area.name}
                  </h3>
                  <p className="text-[16px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-[90%]">
                    {area.sub}
                  </p>
                </div>

                <div className="relative z-10 flex items-center justify-between mt-auto">
                  <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    ACTIVA
                  </span>
                  <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center opacity-80 transition-all hover:opacity-100">
        <p className="text-[16px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">Partner Tecnológico</p>
        <a 
          href="https://leansisproductividad.com/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center justify-center w-full px-4 overflow-visible hover:scale-105 transition-transform duration-300"
        >
           <svg width="1500" height="300" viewBox="-150 -50 1400 350" xmlns="http://www.w3.org/2000/svg" className="h-12 w-auto drop-shadow-md overflow-visible" preserveAspectRatio="xMidYMid meet">
             <text x="20" y="130" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="130" fill="#71717a" letterSpacing="-6">SGS</text>
             <text x="320" y="130" fontFamily="Inter, sans-serif" fontWeight="900" fontSize="130" fill="#f47920" letterSpacing="-4">PRODUCTIVITY</text>
             <text x="800" y="210" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="42" fill="#71717a" opacity="0.8">by Leansis</text>
           </svg>
        </a>
      </div>
    </div>
  );
};

export default MainMenu;