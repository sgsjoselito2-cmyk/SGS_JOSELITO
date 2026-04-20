import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Shield, User as UserIcon, Trash2, X } from 'lucide-react';

interface UserPermission {
  id: string;
  user_id: string;
  email: string;
  level: number;
}

interface UserManagerProps {
  onClose: () => void;
  currentUserLevel: number;
}

const UserManager: React.FC<UserManagerProps> = ({ onClose, currentUserLevel }) => {
  const [users, setUsers] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newLevel, setNewLevel] = useState(1);
  const [msg, setMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .order('level', { ascending: false });
    
    if (error) {
      setMsg({ text: 'Error al cargar usuarios', type: 'error' });
    } else {
      setUsers(data || []);
    }
    setIsLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ text: 'Creando usuario...', type: 'info' });
    
    // IMPORTANTE: En el cliente anon, auth.signUp crea el usuario y lo loguea
    // o envía correo de confirmación. Para crear sin loguear se requiere Edge Function o Service Key.
    // Aquí implementamos el registro y advertimos del flujo.
    const { data, error } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
    });

    if (error) {
      setMsg({ text: `Error: ${error.message}`, type: 'error' });
      return;
    }

    if (data?.user) {
      // IMPORTANTE: El trigger handle_new_user() de Supabase crea automáticamente 
      // la fila con Nivel 1. Intentamos actualizarlo al nivel deseado.
      
      // Esperar un momento para que el trigger termine de ejecutarse en el servidor
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { error: permError } = await supabase
        .from('user_permissions')
        .update({ level: newLevel })
        .eq('user_id', data.user.id);

      if (permError) {
        console.error("Error al asignar nivel:", permError);
        // Si el usuario es sgsjoselito2@gmail.com, el código lo marca como N3 siempre.
        // El error aquí suele ser RLS si el usuario logueado actualmente ha cambiado.
        setMsg({ text: 'Usuario creado en Auth, pero error al asignar nivel en tabla (RLS). El usuario será Nivel 1 por defecto.', type: 'info' });
      } else {
        setMsg({ text: 'Usuario creado y nivel asignado con éxito.', type: 'success' });
        setNewEmail('');
        setNewPassword('');
        fetchUsers();
      }
    }
  };

  const handleUpdateLevel = async (userId: string, level: number) => {
    const { error } = await supabase
      .from('user_permissions')
      .update({ level })
      .eq('user_id', userId);
    
    if (error) {
      setMsg({ text: 'Error al actualizar nivel', type: 'error' });
    } else {
      setMsg({ text: 'Nivel actualizado', type: 'success' });
      fetchUsers();
    }
  };

  const handleDeleteUser = async (user: UserPermission) => {
    if (!window.confirm(`¿Seguro que quieres eliminar a ${user.email}?`)) return;
    
    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', user.user_id);
    
    if (error) {
      setMsg({ text: 'Error al eliminar permisos', type: 'error' });
    } else {
      setMsg({ text: 'Permisos eliminados. Nota: El usuario sigue en Auth (requiere Admin API para borrar de ahí)', type: 'info' });
      fetchUsers();
    }
  };

  if (currentUserLevel < 3) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase">Acceso Denegado</h2>
          <p className="text-slate-500 font-medium mb-6">Solo los usuarios de Nivel 3 (TOP 60) pueden gestionar usuarios.</p>
          <button onClick={onClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in duration-300 my-8">
        <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-3">
            <UserIcon className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-black uppercase tracking-widest">Gestión de Usuarios y Accesos</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Crear usuario */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-black text-slate-900 uppercase">Añadir Nuevo Usuario</h3>
            </div>
            
            <form onSubmit={handleCreateUser} className="space-y-4 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email</label>
                <input 
                  type="email" 
                  value={newEmail} 
                  onChange={e => setNewEmail(e.target.value)} 
                  required 
                  className="w-full p-4 rounded-xl bg-white border-2 border-slate-100 outline-none focus:border-blue-500 font-bold"
                  placeholder="ejemplo@zitron.com"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  required 
                  className="w-full p-4 rounded-xl bg-white border-2 border-slate-100 outline-none focus:border-blue-500 font-bold"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nivel de Acceso</label>
                <select 
                  value={newLevel} 
                  onChange={e => setNewLevel(parseInt(e.target.value))} 
                  className="w-full p-4 rounded-xl bg-white border-2 border-slate-100 outline-none focus:border-blue-500 font-bold uppercase"
                >
                  <option value={1}>Nivel 1: TOP 5</option>
                  <option value={2}>Nivel 2: TOP 15 (y TOP 5)</option>
                  <option value={3}>Nivel 3: TOP 60 (y anteriores)</option>
                </select>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">
                Registrar Usuario
              </button>
            </form>
            
            {msg.text && (
              <div className={`p-4 rounded-2xl text-center text-sm font-black uppercase ${msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {msg.text}
              </div>
            )}
          </div>

          {/* Listado de usuarios */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-black text-slate-900 uppercase">Usuarios Registrados</h3>
            </div>
            
            <div className="bg-slate-50 p-4 rounded-3xl border-2 border-slate-100 max-h-[450px] overflow-y-auto space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-slate-400 font-bold uppercase">Cargando...</div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-slate-400 font-bold uppercase">No hay usuarios</div>
              ) : (
                users.map(u => (
                  <div key={u.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-black text-slate-900">{u.email}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">UID: {u.user_id.substring(0, 8)}...</span>
                      </div>
                      <button onClick={() => handleDeleteUser(u)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map(lvl => (
                        <button 
                          key={lvl}
                          onClick={() => handleUpdateLevel(u.user_id, lvl)}
                          className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all border-2 ${
                            u.level === lvl 
                              ? 'bg-emerald-500 text-white border-emerald-500' 
                              : 'bg-white text-slate-400 border-slate-100 hover:border-emerald-200'
                          }`}
                        >
                          N{lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Botón de cierre inferior para mayor claridad */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white rounded-xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
          >
            Finalizar Gestión
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManager;
