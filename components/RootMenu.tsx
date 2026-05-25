import React from 'react';
import { LayoutDashboard, BarChart3, Activity, Settings, Warehouse } from 'lucide-react';

interface RootMenuProps {
  onSelectOption: (opt: 'top5' | 'top15' | 'top60' | 'bodegas') => void;
  onOpenConfig?: () => void;
}

const RootMenu: React.FC<RootMenuProps> = ({ onSelectOption, onOpenConfig }) => {
  const options = [
    { id: 'top5' as const, name: 'TOP 5', icon: Activity, description: 'Indicadores por Turno', color: 'bg-blue-600' },
    { id: 'top15' as const, name: 'TOP 15', icon: BarChart3, description: 'Evolución Diaria/Semanal', color: 'bg-indigo-600' },
    { id: 'top60' as const, name: 'TOP 60', icon: LayoutDashboard, description: 'Cuadro de Mando Mensual', color: 'bg-slate-900' },
    { id: 'bodegas' as const, name: 'BODEGAS', icon: Warehouse, description: 'Movimientos de Bodega', color: 'bg-amber-600' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 min-h-full">
      <div className="max-w-6xl w-full">
        <h2 className="text-3xl font-serif font-black text-slate-900 mb-0 uppercase tracking-tight text-center">JOSELITO</h2>
        <h2 className="text-xl font-serif font-black text-slate-600 mb-2 uppercase tracking-wide text-center">SISTEMA CENTRAL DE PRODUCCIÓN</h2>
        <p className="text-slate-500 text-center mb-10 font-medium">Seleccione el nivel de información que desea visualizar</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onSelectOption(opt.id)}
              className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-300 group text-left flex flex-col h-full"
            >
              <div className={`${opt.color} w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                <opt.icon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-serif font-black text-slate-900 mb-2">{opt.name}</h3>
              <p className="text-slate-500 flex-1">{opt.description}</p>
              <div className="mt-8 flex items-center text-[11px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-colors">
                Entrar Dashboard
                <div className="ml-2 w-4 h-px bg-slate-200 group-hover:w-8 group-hover:bg-slate-900 transition-all" />
              </div>
            </button>
          ))}
        </div>
        
        {onOpenConfig && (
          <div className="mt-12 flex justify-center">
            <button 
              onClick={onOpenConfig}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors text-sm font-bold uppercase tracking-widest"
            >
              <Settings className="w-4 h-4" />
              Configuración Maestra
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RootMenu;
