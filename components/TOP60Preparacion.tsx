import React from 'react';
import { Calendar, Users, ClipboardCheck, ArrowRight } from 'lucide-react';
import { User } from '../types';

interface TOP60PreparacionProps {
  operarios?: User[];
  passwords?: Record<string, string>;
}

const TOP60Preparacion: React.FC<TOP60PreparacionProps> = ({ operarios, passwords }) => {
  const sections = [
    { title: 'Seguridad', icon: ClipboardCheck, status: 'Completado', color: 'text-green-600' },
    { title: 'Personal', icon: Users, status: 'Pendiente', color: 'text-amber-600' },
    { title: 'Producción', icon: Calendar, status: 'Completado', color: 'text-green-600' },
  ];

  return (
    <div className="p-6 bg-white min-h-full">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-serif font-black text-slate-900 mb-8 uppercase tracking-tight">Preparación TOP 60</h1>
        
        <div className="grid gap-6">
          {sections.map((s, i) => (
            <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <div className="flex items-center gap-6">
                <div className="bg-white p-4 rounded-2xl shadow-sm">
                  <s.icon className={`w-8 h-8 ${s.color}`} />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-black text-slate-900 uppercase">{s.title}</h3>
                  <p className="text-sm text-slate-500">Última actualización: Hoy, 08:30</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${s.status === 'Completado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {s.status}
                </span>
                <button className="p-3 bg-white hover:bg-slate-900 hover:text-white rounded-2xl shadow-sm transition-all">
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TOP60Preparacion;
