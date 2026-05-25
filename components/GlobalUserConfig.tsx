import React, { useState } from 'react';
import { Users, Search, Plus, Trash2, Edit2, Shield } from 'lucide-react';
import { User } from '../types';
import { AREA_NAMES } from '../constants';

interface GlobalUserConfigProps {
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  onClose: () => void;
  passwords?: {
    jefeEquipo: string;
    jefeTaller: string;
    directorOperaciones: string;
    asistenciaTecnica: string;
  };
}

const GlobalUserConfig: React.FC<GlobalUserConfigProps> = ({ users, onUpdateUsers, onClose, passwords }) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [esJefeEquipo, setEsJefeEquipo] = useState(false);
  const [areaJefeEquipo, setAreaJefeEquipo] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [localPin, setLocalPin] = useState('');
  const [localPinError, setLocalPinError] = useState(false);

  const verifyPin = (inputPin: string) => {
    if (!passwords) {
      setPinVerified(true);
      setEsJefeEquipo(true);
      setShowPinModal(false);
      setLocalPin('');
      return;
    }
    if (
      inputPin === passwords.jefeEquipo ||
      inputPin === passwords.jefeTaller ||
      inputPin === passwords.directorOperaciones ||
      inputPin === passwords.asistenciaTecnica
    ) {
      setPinVerified(true);
      setEsJefeEquipo(true);
      setShowPinModal(false);
      setLocalPin('');
      setLocalPinError(false);
    } else {
      setLocalPinError(true);
      setTimeout(() => {
        setLocalPin('');
        setLocalPinError(false);
      }, 1000);
    }
  };

  const handleToggleJefe = (checked: boolean) => {
    if (checked) {
      if (pinVerified) {
        setEsJefeEquipo(true);
      } else {
        setShowPinModal(true);
      }
    } else {
      setEsJefeEquipo(false);
    }
  };

  const handleAddOrUpdateUser = () => {
    if (!nombre.trim()) return;

    if (editingUserId) {
      const next = users.map(u => 
        u.id === editingUserId 
          ? { 
              ...u, 
              nombre: nombre.trim().toUpperCase(), 
              email: email.trim().toLowerCase(),
              esJefeEquipo,
              areaJefeEquipo: esJefeEquipo ? areaJefeEquipo : undefined
            }
          : u
      );
      onUpdateUsers(next);
      setEditingUserId(null);
    } else {
      const newUser: User = {
        id: crypto.randomUUID(),
        nombre: nombre.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        areas: [],
        esJefeEquipo,
        areaJefeEquipo: esJefeEquipo ? areaJefeEquipo : undefined
      };
      onUpdateUsers([...users, newUser]);
    }
    
    setNombre('');
    setEmail('');
    setEsJefeEquipo(false);
    setAreaJefeEquipo('');
  };

  const startEdit = (user: User) => {
    setEditingUserId(user.id);
    setNombre(user.nombre);
    setEmail(user.email || '');
    setEsJefeEquipo(user.esJefeEquipo || false);
    setAreaJefeEquipo(user.areaJefeEquipo || '');
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setNombre('');
    setEmail('');
    setEsJefeEquipo(false);
    setAreaJefeEquipo('');
  };

  const toggleUserArea = (userId: string, areaId: string) => {
    const next = users.map(u => {
      if (u.id !== userId) return u;
      const areas = u.areas || [];
      return {
        ...u,
        areas: areas.includes(areaId) 
          ? areas.filter(a => a !== areaId)
          : [...areas, areaId]
      };
    });
    onUpdateUsers(next);
  };

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const removeUser = (id: string, name: string) => {
    // Si ya estamos confirmando, realizamos la eliminación
    onUpdateUsers(users.filter(u => String(u.id) !== String(id)));
    setConfirmingDeleteId(null);
  };

  const allPossibleAreas = [
    { id: 'TOP 5', label: 'GAPS TOP 5' },
    { id: 'TOP 15', label: 'GAPS TOP 15' },
    { id: 'TOP 60', label: 'TOP 60' },
    { id: 'sb-preparacion', label: 'PREPARACIÓN' },
    { id: 'sb-loncheado', label: 'LONCHEADO' },
    { id: 'sb-empaquetado-loncheado', label: 'EMPAQUETADO LONCHEADO' },
    { id: 'sb-empaquetado-deshuesado', label: 'EMPAQUETADO DESHUESADO' },
    { id: 'env-envasado', label: 'ENVASADO' },
    { id: 'env-empaquetado', label: 'EMPAQUETADO (ENVASADO)' },
    { id: 'expedicion', label: 'EXPEDICIONES' },
    { id: 'preparacion-exp', label: 'PREPARACIÓN EXPEDICIONES' },
    { id: 'movimiento-jamones', label: 'MOVIMIENTOS' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-[95vw] h-[90vh] rounded-3xl flex flex-col shadow-2xl border-4 border-indigo-600">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 sm:p-6 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg sm:text-3xl font-black text-white uppercase tracking-tight">GESTIÓN DE PERSONAL Y POLIVALENCIA</h2>
            <p className="text-white/70 text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-1">GESTIONA PERMISOS POR TALLER</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 hover:bg-white/30 text-white rounded-lg sm:rounded-xl flex items-center justify-center transition-all">
            <span className="text-xl sm:text-2xl font-bold">×</span>
          </button>
        </div>

        {/* New User Form */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="max-w-6xl space-y-3">
            {/* Row 1: Nombre and Correo */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">
                  {editingUserId ? 'EDITAR OPERARIO' : 'NUEVO OPERARIO'}
                </label>
                <input 
                  type="text" 
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="NOMBRE COMPLETO..."
                  className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl px-4 py-2 sm:py-3 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="w-full sm:w-80 space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">CORREO (OPCIONAL)</label>
                <input 
                  type="text" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="CORREO..."
                  className="w-full bg-white border border-slate-200 rounded-lg sm:rounded-xl px-4 py-2 sm:py-3 text-sm font-bold uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* Row 2: Checkbox, Leader Area Select and Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Es Jefe de Equipo Checkbox */}
                <div className="flex items-center gap-2 border border-dashed border-slate-200 px-3 py-1.5 rounded-lg shrink-0 bg-white/50">
                  <input 
                    type="checkbox" 
                    id="esJefeCheckbox"
                    checked={esJefeEquipo} 
                    onChange={e => handleToggleJefe(e.target.checked)}
                    className="w-4 h-4 accent-slate-900 rounded cursor-pointer"
                  />
                  <label htmlFor="esJefeCheckbox" className="text-[11px] font-black uppercase tracking-widest text-slate-700 cursor-pointer select-none">
                    Es Jefe de Equipo
                  </label>
                </div>

                {/* Compact Select when checked */}
                {esJefeEquipo && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ÁREA:</span>
                    <select
                      value={areaJefeEquipo}
                      onChange={e => setAreaJefeEquipo(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-black uppercase focus:ring-2 focus:ring-indigo-500 outline-none w-48"
                    >
                      <option value="">Selecciona Área...</option>
                      {Object.entries(AREA_NAMES).map(([id, label]) => (
                        <option key={id} value={id}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 self-start sm:self-auto">
                {editingUserId && (
                  <button 
                    onClick={cancelEdit}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-600 px-4 py-2 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all"
                  >
                    CANCELAR
                  </button>
                )}
                <button 
                  onClick={handleAddOrUpdateUser}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg"
                >
                  {editingUserId ? 'GUARDAR' : 'AÑADIR'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-y-auto overflow-x-auto bg-white max-h-[calc(90vh-320px)] sm:max-h-[calc(90vh-280px)] border-b border-slate-100 rounded-b-2xl">
          <table className="w-full border-collapse min-w-[2000px]">
            <thead className="sticky top-0 bg-slate-900 text-white z-10">
              <tr className="h-16">
                <th className="p-4 text-left font-black text-sm uppercase tracking-widest border-r border-slate-800 w-[250px] shadow-[inset_0_-2px_0_rgba(255,255,255,0.1)]">OPERARIO</th>
                <th className="p-4 text-left font-black text-sm uppercase tracking-widest border-r border-slate-800 w-[200px] shadow-[inset_0_-2px_0_rgba(255,255,255,0.1)]">CORREO</th>
                {allPossibleAreas.map(area => (
                  <th key={area.id} className="p-2 text-center font-black text-sm uppercase tracking-tighter border-r border-slate-800 min-w-[120px] shadow-[inset_0_-2px_0_rgba(255,255,255,0.1)]">
                    {area.label}
                  </th>
                ))}
                <th className="p-4 text-center font-black text-sm uppercase tracking-widest shadow-[inset_0_-2px_0_rgba(255,255,255,0.1)]">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 border-r border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-slate-900 uppercase">{user.nombre}</div>
                      {user.esJefeEquipo && (
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded uppercase tracking-widest shadow-sm">
                          JEFE ({AREA_NAMES[user.areaJefeEquipo || ''] || user.areaJefeEquipo})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 border-r border-slate-100 italic text-slate-400 text-sm">
                    {user.email || '—'}
                  </td>
                  {allPossibleAreas.map(area => (
                    <td key={area.id} className="p-2 text-center border-r border-slate-100">
                      <button 
                        onClick={() => toggleUserArea(user.id, area.id)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all mx-auto ${
                          user.areas?.includes(area.id)
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white border-2 border-slate-200 text-transparent'
                        }`}
                      >
                        <div className="w-3 h-3 border-2 border-current rounded-sm flex items-center justify-center">
                          {user.areas?.includes(area.id) && <div className="w-1 h-1 bg-white rounded-sm" />}
                        </div>
                      </button>
                    </td>
                  ))}
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      {confirmingDeleteId === user.id ? (
                        <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                          <button 
                            onClick={() => removeUser(user.id, user.nombre)}
                            className="bg-red-500 text-white px-3 py-1.5 rounded-lg font-black text-[10px] uppercase hover:bg-red-600 shadow-md"
                          >
                            CONFIRMAR
                          </button>
                          <button 
                            onClick={() => setConfirmingDeleteId(null)}
                            className="bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase hover:bg-slate-200"
                          >
                            NO
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            type="button"
                            onClick={() => startEdit(user)}
                            className="p-2.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-slate-100 rounded-xl cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => setConfirmingDeleteId(user.id)}
                            className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 transition-all border border-slate-100 rounded-xl cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{users.length} OPERARIOS REGISTRADOS</p>
          <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-4 sm:px-8 py-2 sm:py-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest text-slate-400 transition-all">
              CANCELAR
            </button>
            <button onClick={onClose} className="flex-1 sm:flex-none px-4 sm:px-8 py-2 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg">
              GUARDAR CAMBIOS
            </button>
          </div>
        </div>
      </div>

      {showPinModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-amber-500">
            <Shield className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-950 uppercase tracking-tight mb-1">Verificación de Jefe</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Introduce el PIN de Jefe de Equipo o superior</p>
            <input
              type="password"
              maxLength={4}
              value={localPin}
              onChange={e => {
                const val = e.target.value;
                setLocalPin(val);
                if (val.length === 4) {
                  verifyPin(val);
                }
              }}
              placeholder="••••"
              className="w-32 text-center p-4 rounded-xl border-2 border-slate-200 text-xl font-black focus:border-amber-500 outline-none uppercase tracking-widest mb-4"
            />
            {localPinError && (
              <p className="text-xs font-black text-red-500 uppercase tracking-wider animate-bounce">❌ PIN INCORRECTO</p>
            )}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setShowPinModal(false);
                  setLocalPin('');
                  setLocalPinError(false);
                }}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl font-black text-xs uppercase animate-pulse"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalUserConfig;
