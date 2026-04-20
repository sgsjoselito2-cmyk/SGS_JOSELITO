import React, { useState } from 'react';
import { User } from '../types';
import { AREA_NAMES } from '../constants';

interface GlobalUserConfigProps {
  users: User[];
  onUpdateUsers: (users: User[]) => void;
  onClose: () => void;
}

const GlobalUserConfig: React.FC<GlobalUserConfigProps> = ({ users, onUpdateUsers, onClose }) => {
  // Helper to merge users with the same name
  const mergeUsers = (userList: User[]): User[] => {
    const mergedMap = new Map<string, User>();
    userList.forEach(u => {
      const nameKey = u.nombre.trim().toUpperCase();
      const existing = mergedMap.get(nameKey);
      if (existing) {
        mergedMap.set(nameKey, {
          ...existing,
          areas: Array.from(new Set([...(existing.areas || []), ...(u.areas || [])]))
        });
      } else {
        mergedMap.set(nameKey, { ...u, nombre: nameKey });
      }
    });
    return Array.from(mergedMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  };

  const [localUsers, setLocalUsers] = useState<User[]>(() => mergeUsers(users));
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [tempUserName, setTempUserName] = useState('');
  const [tempUserEmail, setTempUserEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const areaIds = Object.keys(AREA_NAMES);

  // Filter areas - allow all if unprotected
  const filteredAreaIds = areaIds;

  const handleToggleArea = (userId: string, areaId: string) => {
    const updated = localUsers.map(u => {
      if (u.id === userId) {
        const currentAreas = u.areas || [];
        const newAreas = currentAreas.includes(areaId)
          ? currentAreas.filter(a => a !== areaId)
          : [...currentAreas, areaId];
        return { ...u, areas: newAreas };
      }
      return u;
    });
    setLocalUsers(updated);
  };

  const handleAddUser = () => {
    const name = newUserName.trim().toUpperCase();
    if (!name) return;
    
    // Check if user already exists
    if (localUsers.some(u => u.nombre === name)) {
      setError(`EL OPERARIO "${name}" YA EXISTE EN EL SISTEMA`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    const newUser: User = {
      id: `user-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
      nombre: name,
      email: newUserEmail.trim().toLowerCase() || undefined,
      areas: []
    };
    setLocalUsers([...localUsers, newUser]);
    setNewUserName('');
    setNewUserEmail('');
    setError(null);
  };

  const handleStartEdit = (user: User) => {
    setEditingUserId(user.id);
    setTempUserName(user.nombre);
    setTempUserEmail(user.email || '');
  };

  const handleSaveEdit = (id: string) => {
    const name = tempUserName.trim().toUpperCase();
    if (!name) return;

    // Check if name already exists for another user
    if (localUsers.some(u => u.id !== id && u.nombre === name)) {
      setError(`YA EXISTE OTRO OPERARIO CON EL NOMBRE "${name}"`);
      setTimeout(() => setError(null), 3000);
      return;
    }

    setLocalUsers(localUsers.map(u => u.id === id ? { 
      ...u, 
      nombre: name, 
      email: tempUserEmail.trim().toLowerCase() || undefined 
    } : u));
    setEditingUserId(null);
    setError(null);
  };

  const handleRemoveUser = (id: string) => {
    // Eliminamos el confirm ya que puede fallar en entornos de iframe
    setLocalUsers(localUsers.filter(u => u.id !== id));
  };

  const handleSave = () => {
    onUpdateUsers(localUsers);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[9999] flex items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-6xl h-full sm:h-[90vh] rounded-none sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border-0 sm:border-4 border-indigo-50">
        <div className="bg-indigo-600 p-3 sm:p-4 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xs sm:text-base font-black uppercase tracking-widest leading-tight">GESTIÓN DE PERSONAL Y POLIVALENCIA</h2>
            <p className="text-indigo-100 text-[10px] sm:text-[13px] font-bold uppercase">Gestiona permisos por taller</p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-3 sm:p-4 flex-1 overflow-hidden flex flex-col gap-3">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 animate-in slide-in-from-top-2 duration-300">
              <p className="text-[14px] font-black text-red-700 uppercase tracking-widest">{error}</p>
            </div>
          )}
          <div className="flex gap-2 items-end bg-slate-50 p-3 rounded-xl border border-slate-100 shrink-0">
            <div className="flex-[2]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-0.5 block">Nuevo Operario</label>
              <input 
                type="text" 
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="NOMBRE COMPLETO..."
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-0.5 block">Correo (Opcional)</label>
              <input 
                type="email" 
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="CORREO..."
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[14px] font-black text-slate-700 outline-none focus:border-indigo-500 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
              />
            </div>
            <button 
              onClick={handleAddUser}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-black text-[13px] uppercase shadow-md hover:bg-indigo-700 transition-all h-[34px]"
            >
              Añadir
            </button>
          </div>

          <div className="flex-1 overflow-auto rounded-xl border border-slate-100 shadow-inner bg-slate-50">
            <table className="w-full text-left border-collapse table-fixed min-w-[700px]">
              <thead className="sticky top-0 bg-slate-900 text-white z-10">
                <tr>
                  <th className="p-1.5 text-[15px] font-black uppercase tracking-widest border-r border-slate-800 w-[150px]">Operario</th>
                  <th className="p-1.5 text-[15px] font-black uppercase tracking-widest border-r border-slate-800 w-[150px]">Correo</th>
                  {filteredAreaIds.map(areaId => (
                    <th key={areaId} className="p-1 text-[9px] font-black uppercase tracking-tighter text-center border-r border-slate-800 leading-[1.1]">
                      {AREA_NAMES[areaId]}
                    </th>
                  ))}
                  <th className="p-1.5 text-[15px] font-black uppercase tracking-widest text-center w-[80px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localUsers.map(user => (
                  <tr key={user.id} className="hover:bg-indigo-50/30 transition-colors bg-white">
                    <td className="p-1.5 font-black text-slate-700 uppercase text-[15px] border-r border-slate-100 sticky left-0 z-[5] truncate bg-inherit">
                      {editingUserId === user.id ? (
                        <div className="flex gap-1">
                          <input 
                            type="text"
                            value={tempUserName}
                            onChange={(e) => setTempUserName(e.target.value)}
                            className="w-full p-1 bg-white border border-indigo-300 rounded text-[15px] font-black outline-none"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(user.id)}
                          />
                        </div>
                      ) : (
                        user.nombre
                      )}
                    </td>
                    <td className="p-1.5 border-r border-slate-100 bg-inherit">
                      {editingUserId === user.id ? (
                        <input 
                          type="email"
                          value={tempUserEmail}
                          onChange={(e) => setTempUserEmail(e.target.value)}
                          className="w-full p-1 bg-white border border-indigo-300 rounded text-[13px] font-black outline-none"
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(user.id)}
                        />
                      ) : (
                        <span className="text-[11px] font-bold text-slate-400 lowercase truncate block max-w-[140px]">
                          {user.email || '—'}
                        </span>
                      )}
                    </td>
                    {filteredAreaIds.map(areaId => (
                      <td key={areaId} className="p-1 text-center border-r border-slate-100">
                        <input 
                          type="checkbox"
                          checked={user.areas?.includes(areaId) || false}
                          onChange={() => handleToggleArea(user.id, areaId)}
                          className="w-3.5 h-3.5 rounded border border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      <div className="flex justify-center gap-1">
                        {editingUserId === user.id ? (
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleSaveEdit(user.id)}
                              className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-all"
                              title="Validar"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => setEditingUserId(null)}
                              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-all"
                              title="Cancelar"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => handleStartEdit(user)}
                            className="p-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all"
                            title="Modificar"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                        <button 
                          onClick={() => handleRemoveUser(user.id)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Eliminar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-400 rounded-lg font-black text-[13px] uppercase hover:bg-slate-100 transition-all"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-black text-[13px] uppercase shadow-lg hover:bg-indigo-700 transition-all"
          >
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalUserConfig;
