import React from 'react';
import { ClipboardList, Plus, Trash2, CheckCircle2, Clock } from 'lucide-react';
import { ActionPlanItem } from '../types';

interface ActionPlanPanelProps {
  storageKey: string;
  title: string;
  initialData?: ActionPlanItem[];
  responsibles: string[];
  dbTable: string;
  passwords: Record<string, string>;
  requiredLevel: number;
}

const ActionPlanPanel: React.FC<ActionPlanPanelProps> = ({ title }) => {
  // Simplified version since it's a placeholder
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 p-3 rounded-2xl">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-black text-slate-900 uppercase">{title}</h2>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Seguimiento de Desviaciones</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
         <p className="text-slate-500 font-medium text-sm">Contenido del Plan de Acción</p>
      </div>
    </div>
  );
};

export default ActionPlanPanel;
