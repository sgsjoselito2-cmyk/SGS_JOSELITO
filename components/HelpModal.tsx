import React from 'react';
import { WORKSHOP_HELP_CONTENT } from '../constants';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  areaId: string;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, areaId }) => {
  if (!isOpen) return null;

  const content = WORKSHOP_HELP_CONTENT[areaId] || WORKSHOP_HELP_CONTENT['default'];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Ayuda y Estándar</h3>
              <p className="text-[14px] font-bold text-blue-600 uppercase tracking-widest">{areaId.replace('-', ' ')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
          <section>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
              Cómo usar la App
            </h4>
            <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100/50">
              <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                {content.usage}
              </p>
            </div>
          </section>

          <section>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
              Cálculo de Indicadores
            </h4>
            <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100/50">
              <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                {content.indicators}
              </p>
            </div>
          </section>

          {(areaId === 'TOP 15' || areaId === 'TOP 60') && (
            <section className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Información Adicional</h4>
              </div>
              <p className="text-amber-800 text-sm font-medium leading-relaxed">
                Este foro es fundamental para la mejora continua. Asegúrate de que todos los datos introducidos son veraces y están actualizados antes de la reunión.
              </p>
            </section>
          )}
        </div>

        <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
