
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, UserPlus, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { JOSELITO_LOGO } from '../constants';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onLoginSuccess();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMessage('¡Registro exitoso! Revisa tu correo electrónico para confirmar la cuenta (si está habilitado el correo en Supabase).');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ha ocurrido un error inesperado');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="p-8">
          <div className="flex flex-col items-center mb-6">
            {JOSELITO_LOGO ? (
              <img 
                src={JOSELITO_LOGO} 
                alt="JOSELITO" 
                className="h-12 sm:h-16 w-auto object-contain mb-4"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 bg-joselito-red rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
            )}
            <h2 className="text-3xl font-serif font-black text-center text-slate-900 tracking-tight mb-2">
              {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
            </h2>
          </div>
          
          <p className="text-slate-400 text-center font-black uppercase text-[10px] tracking-[0.2em] mb-8">
            {isLogin ? 'Bienvenido de nuevo a Joselito' : 'Únete a Joselito Cloud Hub'}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-red-700 leading-tight">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
              <p className="text-sm font-bold text-emerald-700 leading-tight">{message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-50 transition-all"
                  placeholder="tu@email.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-joselito-red text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isLogin ? (
                <>
                  <LogIn className="w-5 h-5" />
                  Entrar
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Registrarse
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-slate-500 font-bold uppercase text-xs tracking-widest hover:text-slate-900 transition-colors"
            >
              {isLogin ? '¿No tienes una cuenta? Regístrate' : '¿Ya tienes una cuenta? Entra ahora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
