import React, { useState } from 'react';
import { Check, X, ChevronRight, ChevronLeft } from 'lucide-react';

interface PasswordConfigModalProps {
  passwords: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
  onUpdatePasswords: (newPasswords: any) => void;
  onClose: () => void;
}

const PasswordConfigModal: React.FC<PasswordConfigModalProps> = ({ passwords, onUpdatePasswords, onClose }) => {
  const [step, setStep] = useState<'selection' | 'change'>('selection');
  const [selectedKey, setSelectedKey] = useState<keyof typeof passwords | null>(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const passwordLabels: Record<keyof typeof passwords, string> = {
    jefeEquipo: 'Jefe de Equipo (TOP 5)',
    jefeTaller: 'Jefe de Taller (TOP 15 + TOP 5)',
    directorOperaciones: 'Director Op. (TOP 60 + 15 + 5)',
    asistenciaTecnica: 'Asistencia Técnica (TODO)'
  };

  const handleSelect = (key: keyof typeof passwords) => {
    setSelectedKey(key);
    setStep('change');
    setError('');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSave = () => {
    if (!selectedKey) return;
    
    // Validar contraseña anterior
    // Permiso especial: El nivel 4 (asistenciaTecnica) puede cambiar cualquier contraseña sin conocer la anterior
    const isLevel4 = passwords.asistenciaTecnica === oldPassword;
    const isChangingOwnLevel4 = selectedKey === 'asistenciaTecnica';

    if (!isLevel4 && oldPassword !== passwords[selectedKey]) {
      setError('LA CONTRASEÑA ANTERIOR ES INCORRECTA');
      return;
    }

    // Validar que las nuevas coincidan
    if (newPassword !== confirmPassword) {
      setError('LAS NUEVAS CONTRASEÑAS NO COINCIDEN');
      return;
    }

    if (newPassword.length < 4) {
      setError('LA CONTRASEÑA DEBE TENER 4 DÍGITOS');
      return;
    }

    const updatedPasswords = { ...passwords, [selectedKey]: newPassword };
    onUpdatePasswords(updatedPasswords);
    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-12 text-center border-8 border-emerald-50 animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">¡ÉXITO!</h2>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Contraseña cambiada con éxito</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border-4 border-indigo-50 animate-in fade-in zoom-in duration-300">
        <div className="bg-indigo-600 p-8 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter leading-none">Configuración</h2>
            <p className="text-indigo-100 text-[14px] font-bold uppercase tracking-widest mt-1">Gestión de Acceso Maestro</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-indigo-500 hover:bg-indigo-400 rounded-xl flex items-center justify-center transition-all">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8">
          {step === 'selection' ? (
            <div className="space-y-3">
              <p className="text-[14px] font-black text-slate-400 uppercase tracking-widest mb-4 text-center">Selecciona el nivel a modificar</p>
              {(Object.keys(passwordLabels) as Array<keyof typeof passwords>).map((key) => (
                <button
                  key={key}
                  onClick={() => handleSelect(key)}
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-left hover:border-indigo-600 hover:bg-indigo-50 transition-all group flex items-center justify-between"
                >
                  <span className="font-black text-slate-700 uppercase tracking-tight text-sm">{passwordLabels[key]}</span>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setStep('selection')} className="text-indigo-600 hover:text-indigo-800">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">{passwordLabels[selectedKey!]}</h3>
              </div>

              {error && (
                <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl text-red-600 text-[14px] font-black uppercase tracking-widest text-center animate-bounce">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[14px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Contraseña Anterior</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-700 outline-none focus:border-indigo-500 transition-all text-center tracking-[1em]"
                  />
                </div>
                <div>
                  <label className="text-[14px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nueva Contraseña</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-700 outline-none focus:border-indigo-500 transition-all text-center tracking-[1em]"
                  />
                </div>
                <div>
                  <label className="text-[14px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Repetir Nueva Contraseña</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xl font-black text-slate-700 outline-none focus:border-indigo-500 transition-all text-center tracking-[1em]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setStep('selection')}
                  className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all"
                >
                  Volver
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Cambiar Contraseña
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PasswordConfigModal;
