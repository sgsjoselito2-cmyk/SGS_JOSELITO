import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  isOpen?: boolean;
  areaId?: string;
}

const HelpModal: React.FC<HelpModalProps> = ({ onClose, title, children, isOpen = true }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
      <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col overflow-y-auto max-h-[90vh] animate-in fade-in zoom-in duration-300">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-black text-slate-900 uppercase">{title || 'Ayuda'}</h2>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Guía de Uso e Información</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-8 max-h-[70vh] overflow-y-auto">
          {children || (
            <div className="prose prose-slate max-w-none">
              <h3 className="font-serif font-black uppercase text-slate-900">Instrucciones Generales</h3>
              <p className="text-slate-600">
                Bienvenido al sistema de Gestión Visual Joselito. Este dashboard permite monitorizar los indicadores clave de rendimiento (OEE) en tiempo real.
              </p>
              <ul className="space-y-4">
                <li className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-black text-xs">1</div>
                  <div className="text-slate-600"><span className="font-bold text-slate-900 uppercase">Navegación:</span> Utiliza el menú superior para cambiar entre áreas de trabajo y configuración.</div>
                </li>
                <li className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-black text-xs">2</div>
                  <div className="text-slate-600"><span className="font-bold text-slate-900 uppercase">Indicadores:</span> Los gráficos muestran la evolución diaria y acumulada. Pulsa sobre cualquier punto para ver detalles.</div>
                </li>
                <li className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-black text-xs">3</div>
                  <div className="text-slate-600"><span className="font-bold text-slate-900 uppercase">Sincronización:</span> El sistema detecta automáticamente si estás online u offline. Los cambios realizados sin conexión se guardarán en tu navegador hasta que se restablezca internet.</div>
                </li>
              </ul>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-center">
          <button 
            onClick={onClose}
            className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Cerrar Guía
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
