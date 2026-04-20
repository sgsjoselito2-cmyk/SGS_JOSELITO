import React, { useState } from 'react';
import { User } from '../types';
import SeguridadActionPlan from './SeguridadActionPlan';
import RRHHPanel from './RRHHPanel';
import IdMActionPlan from './IdMActionPlan';
import CalidadPanel from './CalidadPanel';
import HelpModal from './HelpModal';

const AREAS = [
  { id: 'rrhh', name: 'RRHH', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'calidad', name: 'Calidad', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { id: 'seguridad', name: 'Seguridad', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'adherencia', name: 'Adherencia a la planificación', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { id: 'idm', name: 'IdM (Ideas de Mejora)', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' }
];

interface TOP60PreparacionProps {
  operarios: User[];
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
}

const TOP60Preparacion: React.FC<TOP60PreparacionProps> = ({ operarios, passwords }) => {
  const [activeArea, setActiveArea] = useState(AREAS[0].id);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 relative">
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
        areaId="TOP 60" 
      />
      
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-center justify-between gap-6 relative">
        <button 
          onClick={() => setIsHelpModalOpen(true)}
          className="absolute -top-2 -right-2 z-20 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all active:scale-90 border-4 border-white"
          title="Ayuda"
        >
          <span className="text-lg font-black">?</span>
        </button>
        
        <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 flex-1">
          {AREAS.map(area => (
            <button
              key={area.id}
              onClick={() => setActiveArea(area.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all ${
                activeArea === area.id 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 scale-105' 
                  : 'bg-transparent text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-sm'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={area.icon} />
              </svg>
              <span className="font-black text-[14px] uppercase tracking-widest">{area.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Content Area */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-8 md:p-12 min-h-[500px] flex flex-col items-center justify-start text-center">
          {activeArea === 'seguridad' ? (
            <SeguridadActionPlan operarios={operarios} passwords={passwords} />
          ) : activeArea === 'rrhh' ? (
            <RRHHPanel operarios={operarios} passwords={passwords} />
          ) : activeArea === 'idm' ? (
            <IdMActionPlan operarios={operarios} passwords={passwords} />
          ) : activeArea === 'calidad' ? (
            <CalidadPanel passwords={passwords} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full w-full mt-20">
              <div className="w-24 h-24 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-8">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={AREAS.find(a => a.id === activeArea)?.icon} />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-4">
                {AREAS.find(a => a.id === activeArea)?.name}
              </h3>
              <p className="text-slate-400 font-black text-[14px] uppercase tracking-[0.3em]">Módulo en Desarrollo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TOP60Preparacion;
