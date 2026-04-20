import React from 'react';
import { AREA_NAMES, JOSELITO_LOGO } from '../constants';
import { 
  Home, 
  ChevronLeft, 
  HelpCircle, 
  Users, 
  Settings, 
  Cloud, 
  CloudOff,
  Activity as ActivityIcon,
  Database,
  Terminal,
  LayoutDashboard,
  LogOut,
  Shield
} from 'lucide-react';

interface HeaderProps {
  activeTab: 'work' | 'config' | 'database';
  setActiveTab: (tab: 'work' | 'config' | 'database') => void;
  currentAreaId?: string;
  onGoHome: () => void;
  onBack: () => void;
  onOpenGlobalConfig?: () => void;
  onOpenPasswordConfig?: () => void;
  onOpenHelp?: () => void;
  showGlobalNav: boolean;
  customTitle?: string;
  isConfigured?: boolean;
  onOpenConnectionHelp?: () => void;
  isBackendReady: boolean;
  backendError: string | null;
  syncQueueLength?: number;
  lastSyncError?: string | null;
  onLogout?: () => void;
  onOpenUserManager?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  currentAreaId, 
  onGoHome, 
  onBack, 
  onOpenGlobalConfig,
  onOpenPasswordConfig,
  onOpenHelp,
  showGlobalNav,
  customTitle,
  isConfigured,
  onOpenConnectionHelp,
  isBackendReady,
  backendError,
  syncQueueLength = 0,
  lastSyncError,
  onLogout,
  onOpenUserManager
}) => {
  const areaDisplayName = currentAreaId ? (AREA_NAMES[currentAreaId] || currentAreaId.replace('-', ' ').toUpperCase()) : '';
  const isMainScreen = !currentAreaId && !showGlobalNav;

  const renderConnectionIcon = () => {
    if (lastSyncError) {
      return (
        <div className="flex items-center gap-1 text-red-500">
          <CloudOff className="w-3 h-3 animate-pulse" />
        </div>
      );
    }
    if (syncQueueLength > 0) {
      return (
        <div className="flex items-center gap-1 text-amber-500">
          <svg className="w-3 h-3 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-black">{syncQueueLength}</span>
        </div>
      );
    }
    return isConfigured ? <Cloud className="w-3 h-3 animate-pulse" /> : <CloudOff className="w-3 h-3" />;
  };

  const renderMobileConnectionIcon = () => {
    if (lastSyncError) {
      return (
        <div className="flex items-center gap-0.5 text-red-500">
          <CloudOff className="w-2.5 h-2.5 animate-pulse" />
        </div>
      );
    }
    if (syncQueueLength > 0) {
      return (
        <div className="flex items-center gap-0.5 text-amber-500">
          <svg className="w-2.5 h-2.5 animate-bounce" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      );
    }
    return isConfigured ? <Cloud className="w-2.5 h-2.5 animate-pulse" /> : <CloudOff className="w-2.5 h-2.5" />;
  };

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-sm">
      {/* Banner Rojo Superior */}
      <div className="bg-joselito-red text-white py-1.5 px-4 text-center">
        <p className="text-[10px] sm:text-xs font-medium tracking-wide">
          SISTEMA DE GESTIÓN DE PRODUCCIÓN • JOSELITO • DECLARADO EL MEJOR JAMÓN DEL MUNDO
        </p>
      </div>

      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* IZQUIERDA: Botones de navegación */}
          <div className="flex items-center gap-2 w-1/3">
            <button 
              onClick={onBack}
              className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors"
              title="Atrás"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={onGoHome}
              className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors"
              title="Inicio"
            >
              <Home className="w-5 h-5" />
            </button>
          </div>

          {/* CENTRO: Logo Joselito */}
          <div className="flex justify-center w-1/3">
            <div className="cursor-pointer" onClick={onGoHome}>
              {JOSELITO_LOGO ? (
                <img 
                  src={JOSELITO_LOGO} 
                  alt="JOSELITO" 
                  className="h-10 sm:h-14 w-auto object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.parentElement?.querySelector('.logo-fallback');
                    if (fallback) (fallback as HTMLElement).style.display = 'block';
                  }}
                />
              ) : (
                <h1 className="text-2xl font-serif font-black tracking-tighter text-slate-900 uppercase">
                  JOSELITO
                </h1>
              )}
              <h1 className="logo-fallback text-2xl font-serif font-black tracking-tighter text-slate-900 uppercase hidden">
                JOSELITO
              </h1>
            </div>
          </div>

          {/* DERECHA: Acciones y Estado */}
          <div className="flex items-center justify-end gap-2 w-1/3">
            <button 
              onClick={onOpenConnectionHelp}
              className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-[12px] font-black uppercase tracking-widest transition-all cursor-pointer border-none outline-none ${isConfigured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}
            >
              {renderConnectionIcon()}
              {lastSyncError ? 'ERROR' : (syncQueueLength > 0 ? `COLA (${syncQueueLength})` : (isConfigured ? 'NUBE' : 'LOCAL'))}
            </button>

            {onOpenHelp && (
              <button onClick={onOpenHelp} className="p-2 rounded-full hover:bg-blue-50 text-blue-400 hover:text-blue-600 transition-colors" title="Ayuda">
                <HelpCircle className="w-5 h-5" />
              </button>
            )}

            {onOpenGlobalConfig && (
              <button onClick={onOpenGlobalConfig} className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors" title="Configuración de Opererarios">
                <Users className="w-5 h-5" />
              </button>
            )}

            {onOpenUserManager && (
              <button onClick={onOpenUserManager} className="p-2 rounded-full hover:bg-slate-50 text-slate-400 hover:text-slate-900 transition-colors" title="Gestión de Usuarios">
                <Shield className="w-5 h-5" />
              </button>
            )}
            
            {onLogout && (
              <button onClick={onLogout} className="p-2 rounded-full hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Sub-título / Área actual */}
        <div className="mt-2 flex justify-center">
          {customTitle ? (
            <h2 className="text-[14px] sm:text-base font-serif italic text-slate-500 tracking-wide">
              {customTitle}
            </h2>
          ) : currentAreaId ? (
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-joselito-red"></span>
              <h2 className="text-[13px] sm:text-sm font-black text-slate-900 uppercase tracking-[0.2em]">
                {areaDisplayName}
              </h2>
              <span className="w-1 h-1 rounded-full bg-joselito-red"></span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Navegación de Área (Terminal/Dashboard/etc) */}
      {!isMainScreen && currentAreaId && (
        <div className="bg-slate-50/50 border-t border-slate-100">
          <div className="container mx-auto px-4 flex justify-center gap-8">
            <button 
              onClick={() => setActiveTab('work')} 
              className={`py-2 text-[12px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === 'work' ? 'border-joselito-red text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Terminal
            </button>
            {currentAreaId !== 'TOP 60' && currentAreaId !== 'TOP 15' && (
              <>
                <button 
                  onClick={() => setActiveTab('database')} 
                  className={`py-2 text-[12px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === 'database' ? 'border-joselito-red text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  Histórico
                </button>
              </>
            )}
            <button 
              onClick={() => setActiveTab('config')} 
              className={`py-2 text-[12px] font-black uppercase tracking-[0.2em] border-b-2 transition-all ${activeTab === 'config' ? 'border-joselito-red text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              Config
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
