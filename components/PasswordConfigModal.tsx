import React from 'react';
import { Lock, Shield, Eye, EyeOff } from 'lucide-react';

interface PasswordConfigModalProps {
  passwords: Record<string, string>;
  onUpdatePasswords: (newPasswords: any) => Promise<void>;
  onClose: () => void;
}

const PasswordConfigModal: React.FC<PasswordConfigModalProps> = ({ passwords, onUpdatePasswords, onClose }) => {
  const [localPasswords, setLocalPasswords] = React.useState(passwords);
  const [show, setShow] = React.useState<Record<string, boolean>>({});

  const handleUpdate = (field: string, val: string) => {
    setLocalPasswords(prev => ({ ...prev, [field]: val }));
  };

  const handleSave = () => {
    onUpdatePasswords(localPasswords);
    onClose();
  };

  const fields = [
    { key: 'jefeEquipo', label: 'Jefe de Equipo' },
    { key: 'jefeTaller', label: 'Jefe de Taller' },
    { key: 'directorOperaciones', label: 'Director de Operaciones' },
    { key: 'asistenciaTecnica', label: 'Asistencia Técnica (Admin)' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl flex flex-col overflow-y-auto max-h-[90vh]">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-4 rounded-2xl">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-serif font-black text-slate-900 uppercase">Seguridad</h2>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Configuración de Accesos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors">
            <span className="text-3xl">×</span>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">
                Pin {f.label}
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type={show[f.key] ? 'text' : 'password'}
                  value={localPasswords[f.key] || ''}
                  onChange={(e) => handleUpdate(f.key, e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-12 text-sm font-black tracking-widest text-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all uppercase placeholder:text-slate-200"
                  placeholder="0000"
                />
                <button 
                  onClick={() => setShow(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-900 transition-colors"
                >
                  {show[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-4">
          <p className="text-[10px] text-slate-400 text-center font-medium leading-relaxed italic">
            El cambio de claves afectará a todos los terminales vinculados a esta planta tras la sincronización.
          </p>
          <button 
            onClick={handleSave}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-100"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordConfigModal;
