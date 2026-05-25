import React, { useState } from 'react';
import { ChevronLeft, Home, Calendar, Plus, Save, History, ClipboardList, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { JOSELITO_LOGO } from '../constants';
import { Bodega, TipoProducto, MovimientoBodega } from '../types';

interface BodegasModuleProps {
  bodegas: Bodega[];
  tiposProducto: TipoProducto[];
  movimientos: MovimientoBodega[];
  operarios: any[];
  onBack: () => void;
  onSaveMovimiento: (mov: Omit<MovimientoBodega, 'id'>) => Promise<boolean>;
  onUpdateBodegas: (bodegas: Bodega[]) => void;
  onUpdateTiposProducto: (tipos: TipoProducto[]) => void;
}

const BodegasModule: React.FC<BodegasModuleProps> = ({
  bodegas = [],
  tiposProducto = [],
  movimientos = [],
  operarios = [],
  onBack,
  onSaveMovimiento,
  onUpdateBodegas,
  onUpdateTiposProducto
}) => {
  const [activeTab, setActiveTab ] = useState<'registrar' | 'historico' | 'configuracion'>('registrar');
  
  // Configuration tab States
  const [newBodegaName, setNewBodegaName] = useState<string>('');
  const [newTipoProductoName, setNewTipoProductoName] = useState<string>('');
  
  // Registrar States
  const [jefeId, setJefeId] = useState<string>('');
  const [origenId, setOrigenId] = useState<string>('');
  const [destinoId, setDestinoId] = useState<string>('');
  const [tipoProductoId, setTipoProductoId] = useState<string>('');
  const CURRENT_YEAR = new Date().getFullYear();
  const YEARS = Array.from({ length: 11 }, (_, i) => (CURRENT_YEAR - i).toString());
  const [anio, setAnio] = useState<string>(CURRENT_YEAR.toString());
  const [cantidad, setCantidad] = useState<number | ''>('');
  const [comentarios, setComentarios] = useState<string>('');
  
  // Validation errors
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Historico Filters
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Filter operarios for jefes de equipo
  const jefes = operarios.filter(op => op.esJefeEquipo === true);

  const handleAddBodegaLocal = () => {
    const val = newBodegaName.trim().toUpperCase();
    if (val) {
      const exists = bodegas.some(b => b.nombre === val);
      if (!exists) {
        const newB: Bodega = {
          id: Math.random().toString(36).substr(2, 9),
          nombre: val
        };
        onUpdateBodegas([...bodegas, newB]);
        setNewBodegaName('');
        setSuccessToast('Bodega añadida con éxito');
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        setValidationError('Esta bodega ya existe.');
        setTimeout(() => setValidationError(null), 4000);
      }
    }
  };

  const handleDeleteBodegaLocal = (id: string) => {
    onUpdateBodegas(bodegas.filter(b => b.id !== id));
    setSuccessToast('Bodega eliminada con éxito');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleAddTipoProductoLocal = () => {
    const val = newTipoProductoName.trim().toUpperCase();
    if (val) {
      const exists = tiposProducto.some(tp => tp.nombre === val);
      if (!exists) {
        const newTP: TipoProducto = {
          id: Math.random().toString(36).substr(2, 9),
          nombre: val
        };
        onUpdateTiposProducto([...tiposProducto, newTP]);
        setNewTipoProductoName('');
        setSuccessToast('Producto añadido con éxito');
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        setValidationError('Este tipo de producto ya existe.');
        setTimeout(() => setValidationError(null), 4000);
      }
    }
  };

  const handleDeleteTipoProductoLocal = (id: string) => {
    onUpdateTiposProducto(tiposProducto.filter(tp => tp.id !== id));
    setSuccessToast('Producto eliminado con éxito');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate
    if (!jefeId) {
      setValidationError('Debe seleccionar un Jefe de Equipo.');
      return;
    }
    if (!origenId) {
      setValidationError('Debe seleccionar la Bodega Origen.');
      return;
    }
    if (!destinoId) {
      setValidationError('Debe seleccionar la Bodega Destino.');
      return;
    }
    if (origenId === destinoId) {
      setValidationError('La Bodega Origen y la Bodega Destino no pueden ser iguales.');
      return;
    }
    if (!tipoProductoId) {
      setValidationError('Debe seleccionar el Tipo de Producto.');
      return;
    }
    if (!anio) {
      setValidationError('Debe seleccionar el Año del producto.');
      return;
    }
    if (!cantidad || Number(cantidad) <= 0) {
      setValidationError('Debe introducir una cantidad de piezas válida mayor que cero.');
      return;
    }

    const selectedJefe = jefes.find(j => j.id === jefeId);
    const selectedOrigen = bodegas.find(b => b.id === origenId);
    const selectedDestino = bodegas.find(b => b.id === destinoId);
    const selectedTipo = tiposProducto.find(t => t.id === tipoProductoId);

    if (!selectedJefe || !selectedOrigen || !selectedDestino || !selectedTipo) {
      setValidationError('Se ha producido un error seleccionando los datos básicos.');
      return;
    }

    setSaving(true);
    try {
      const payload: Omit<MovimientoBodega, 'id'> = {
        fecha: new Date().toISOString().split('T')[0],
        hora: new Date().toTimeString().split(' ')[0],
        jefeEquipo: selectedJefe.nombre || jefeId,
        bodegaOrigen: selectedOrigen.nombre || origenId,
        bodegaDestino: selectedDestino.nombre || destinoId,
        tipoProducto: selectedTipo.nombre || tipoProductoId,
        anioJamon: anio,
        cantidad: parseInt(String(cantidad), 10),
        comentarios: comentarios.trim()
      };

      const ok = await onSaveMovimiento(payload);
      if (ok) {
        // Clear variables EXCEPT jefe and origen as requested to speed up consecutive entries
        setDestinoId('');
        setTipoProductoId('');
        setCantidad('');
        setComentarios('');
        
        // Show success toast
        setSuccessToast('¡Movimiento registrado con éxito!');
        setTimeout(() => setSuccessToast(null), 4000);
      } else {
        setValidationError('Error de red o supuesta desconexión al intentar guardar.');
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Error guardando en base de datos.');
    } finally {
      setSaving(false);
    }
  };

  // Filter movements for the historic tab matching selected local date
  const filteredMovimientos = movimientos.filter(mov => {
    const movDate = mov.fecha || '';
    return movDate === filterDate;
  });

  // Calculate totals grouped by tipo de producto for the bottom banner
  const productTotals = filteredMovimientos.reduce((acc, mov) => {
    const pName = mov.tipoProducto || 'S/N';
    acc[pName] = (acc[pName] || 0) + (mov.cantidad || 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-slate-55 flex flex-col font-sans text-slate-900 selection:bg-red-500 selection:text-white animate-in fade-in duration-500">
      
      {/* HEADER BANNER STYLE */}
      <div className="bg-slate-900 text-white py-1.5 px-4 text-center">
        <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest">
          SISTEMA CENTRAL J.A. JOSELITO • REGISTRO DE MOVIMIENTOS • BODEGAS COMPLETO
        </p>
      </div>

      {/* HEADER COMPONENT CONSISTENT */}
      <header className="bg-white border-b border-slate-100 py-3 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded-full font-black text-xs uppercase tracking-wider transition-all shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Vuelve al Menú
          </button>

          <div className="flex flex-col items-center">
            {JOSELITO_LOGO ? (
              <img 
                src={JOSELITO_LOGO} 
                alt="Joselito Logo" 
                className="h-10 sm:h-14 w-auto object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.parentElement?.querySelector('.fallback-branding');
                  if (fb) (fb as HTMLElement).style.display = 'block';
                }}
              />
            ) : (
              <h1 className="text-2xl font-serif font-black tracking-tighter uppercase">JOSELITO</h1>
            )}
            <h1 className="fallback-branding text-2xl font-serif font-black tracking-tighter uppercase hidden">JOSELITO</h1>
            <p className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase mt-0.5">BODEGAS INDEPENDIENTES</p>
          </div>

          <div className="w-32 sm:block text-right text-xs font-black uppercase text-slate-400 tracking-wider">
            MÓDULO BODEGAS
          </div>
        </div>
      </header>

      {/* VIEW SELECTOR TABS */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 mt-6 flex justify-center">
        <div className="bg-slate-100/85 p-1.5 rounded-[2.5rem] border border-slate-200/50 flex gap-1 w-full max-w-xl shadow-inner">
          <button
            onClick={() => setActiveTab('registrar')}
            className={`flex-1 py-3 px-4 sm:px-6 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'registrar' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:text-slate-900 hover:bg-white'}`}
          >
            <ClipboardList className="w-4 h-4" />
            REGISTRAR
          </button>
          <button
            onClick={() => setActiveTab('historico')}
            className={`flex-1 py-3 px-4 sm:px-6 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'historico' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:text-slate-900 hover:bg-white'}`}
          >
            <History className="w-4 h-4" />
            HISTÓRICO
          </button>
          <button
            onClick={() => setActiveTab('configuracion')}
            className={`flex-1 py-3 px-4 sm:px-6 rounded-[2rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 ${activeTab === 'configuracion' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:text-slate-900 hover:bg-white'}`}
          >
            <Settings className="w-4 h-4" />
            CONFIGURACIÓN
          </button>
        </div>
      </div>

      {/* TOASTS NOTIFICATION */}
      {successToast && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 border-2 border-emerald-500 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-3 z-50 animate-bounce">
          <CheckCircle className="w-6 h-6 animate-pulse" />
          <span className="font-extrabold uppercase tracking-wide text-sm">{successToast}</span>
        </div>
      )}

      {/* CONTENT SHELL */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-24">
        
        {/* CHECK LIST AND DATA INTEGRITY WARNING */}
        {(bodegas.length === 0 || tiposProducto.length === 0) && (
          <div className="mb-6 p-6 rounded-[2.5rem] bg-amber-50 border-4 border-amber-200 text-amber-900 flex flex-col md:flex-row items-center gap-4 shadow-xl">
            <AlertTriangle className="w-12 h-12 text-amber-600 shrink-0 animate-pulse" />
            <div className="text-center md:text-left">
              <h4 className="text-lg font-black uppercase tracking-tight">Falta Configuración Básica</h4>
              <p className="text-sm font-semibold opacity-85 mt-1">
                Para registrar movimientos de bodega, debe tener definidas las Bodegas y los Tipos de Producto correspondientes. Por favor configure estos elementos en la pestaña <strong className="font-black underline uppercase">CONFIGURACIÓN</strong> de este módulo.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'registrar' && (
          <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl overflow-hidden p-6 sm:p-10 animate-in slide-in-from-bottom-8 duration-500">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-6 mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-serif font-black tracking-tight text-slate-900 uppercase">Registrar Movimiento</h2>
                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mt-1">Traspaso físico entre bodegas de curación</p>
              </div>
              <div className="bg-slate-52 px-5 py-3 rounded-2xl border border-slate-100 flex items-center gap-3 shrink-0">
                <Calendar className="w-5 h-5 text-indigo-500" />
                <div className="text-left">
                  <span className="text-[10px] font-black text-slate-400 block uppercase">FECHA DEL DÍA</span>
                  <span className="text-xs font-black uppercase text-slate-800">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>

            {/* validation banner */}
            {validationError && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border-2 border-red-200 text-red-700 font-bold text-sm flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* STEP 1: JEFE DE EQUIPO SELECTOR (golden styled badge) */}
              <div className="p-6 rounded-[2rem] bg-amber-50/50 border border-amber-100">
                <label className="block text-xs font-black text-amber-800 uppercase tracking-widest mb-3">
                  1. SELECCIONAR JEFE DE EQUIPO DE MOVIMIENTO:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {jefes.length === 0 ? (
                    <p className="col-span-full text-xs text-amber-800 font-semibold italic">No se han definido operarios como Jefe de Equipo en la gestión de personas</p>
                  ) : (
                    jefes.map(j => {
                      const isSelected = jefeId === j.id;
                      return (
                        <button
                          key={j.id}
                          type="button"
                          onClick={() => setJefeId(j.id)}
                          className={`p-4 rounded-xl border text-left transition-all ${isSelected ? 'bg-amber-100 border-amber-500 font-black shadow-lg shadow-amber-100' : 'bg-white border-slate-200 hover:border-amber-300'}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-amber-600 bg-amber-600' : 'border-slate-300 bg-white'}`}>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                            </span>
                            <span className="text-xs font-black uppercase text-slate-700">{j.nombre}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* STEP 2: MOVEMENT TRANSACTION INPUT */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Bodega Origen */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest">BODEGA ORIGEN *</label>
                  <select
                    value={origenId}
                    onChange={(e) => setOrigenId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-wider outline-none focus:border-indigo-500 transition-all text-slate-700 bg-white"
                  >
                    <option value="">-- SELECCIONAR ORIGEN --</option>
                    {bodegas.map(b => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Bodega Destino */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest">BODEGA DESTINO *</label>
                  <select
                    value={destinoId}
                    onChange={(e) => setDestinoId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-wider outline-none focus:border-indigo-500 transition-all text-slate-700 bg-white"
                  >
                    <option value="">-- SELECCIONAR DESTINO --</option>
                    {bodegas.map(b => (
                      <option key={b.id} value={b.id}>{b.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Producto */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest">TIPO DE PRODUCTO *</label>
                  <select
                    value={tipoProductoId}
                    onChange={(e) => setTipoProductoId(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-wider outline-none focus:border-indigo-500 transition-all text-slate-700 bg-white"
                  >
                    <option value="">-- SELECCIONAR PRODUCTO --</option>
                    {tiposProducto.map(t => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Año */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest">AÑO DEL PRODUCTO *</label>
                  <select
                    value={anio}
                    onChange={(e) => setAnio(e.target.value)}
                    required
                    className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-wider outline-none focus:border-indigo-500 transition-all text-slate-700 bg-white"
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                {/* Cantidad (Pzs) */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest">CANTIDAD (PIEZAS) *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="INTRODUCE CANTIDAD..."
                    value={cantidad}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                      setCantidad(val as any);
                    }}
                    required
                    className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-wider outline-none focus:border-indigo-500 transition-all text-slate-700 bg-white"
                  />
                </div>

                {/* Comentarios */}
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-widest">COMENTARIOS / NOTAS (OPCIONAL)</label>
                  <textarea
                    rows={3}
                    placeholder="COMENTARIOS O DETALLES EXTRA DEL MOVIMIENTO..."
                    value={comentarios}
                    onChange={(e) => setComentarios(e.target.value)}
                    className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-wider outline-none focus:border-indigo-500 transition-all text-slate-700 bg-white"
                  />
                </div>
              </div>

              {/* SAVE BUTTON ACTIONS */}
              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving || bodegas.length === 0 || tiposProducto.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest px-12 py-5 rounded-2xl shadow-xl shadow-indigo-150 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border-none disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'GUARDANDO...' : 'REGISTRAR MOVIMIENTO'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'historico' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            {/* Filters Header card */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-md p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-serif font-black tracking-tight text-slate-900 uppercase">Consultar Histórico</h2>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-0.5">Filtrar registros por fecha operativa</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest shrink-0">FECHA:</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-full sm:w-auto bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-wider outline-none focus:border-indigo-500 transition-all text-slate-700 bg-white"
                />
              </div>
            </div>

            {/* List entries Table */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <th className="p-5 pl-8">HORA</th>
                      <th className="p-5">JEFE DE EQUIPO</th>
                      <th className="p-5">TIPO DE PRODUCTO</th>
                      <th className="p-5">BODEGA ORIGEN</th>
                      <th className="p-5">BODEGA DESTINO</th>
                      <th className="p-5 text-center">AÑO</th>
                      <th className="p-5 text-center">CANTIDAD (PZS)</th>
                      <th className="p-5">COMENTARIOS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovimientos.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">
                          No hay movimientos para esta fecha ({new Date(filterDate).toLocaleDateString('es-ES')})
                        </td>
                      </tr>
                    ) : (
                      filteredMovimientos.map((mov, index) => {
                        const productBadgeColor = index % 3 === 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-150' :
                                                  index % 3 === 1 ? 'bg-sky-50 text-sky-700 border-sky-150' : 
                                                  'bg-amber-50 text-amber-700 border-amber-150';
                        return (
                          <tr key={mov.id || index} className="border-b border-slate-100 text-xs text-slate-800 font-semibold hover:bg-slate-50/50 transition-all">
                            <td className="p-5 pl-8 font-black uppercase tracking-wider text-slate-400">
                              {mov.hora || '-'}
                            </td>
                            <td className="p-5">
                              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 font-black px-3 py-1.5 rounded-full uppercase tracking-wider border border-amber-100/50">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                {mov.jefeEquipo || 'S/N'}
                              </span>
                            </td>
                            <td className="p-5">
                              <span className={`inline-block px-3 py-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider ${productBadgeColor}`}>
                                {mov.tipoProducto || 'S/N'}
                              </span>
                            </td>
                            <td className="p-5 font-extrabold uppercase tracking-wide text-slate-700">
                              {mov.bodegaOrigen || 'S/N'}
                            </td>
                            <td className="p-5 font-extrabold uppercase tracking-wide text-slate-700">
                              {mov.bodegaDestino || 'S/N'}
                            </td>
                            <td className="p-5 text-center font-black uppercase tracking-wider text-slate-600">
                              {mov.anioJamon || '-'}
                            </td>
                            <td className="p-5 text-center font-black text-sm text-indigo-600">
                              {mov.cantidad || 0}
                            </td>
                            <td className="p-5 max-w-[200px] truncate text-slate-400 italic">
                              {mov.comentarios || '-'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PRODUCT TOTALS AGGREGATED BANNER */}
            {filteredMovimientos.length > 0 && (
              <div className="bg-slate-900 text-white rounded-[2.5rem] p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl animate-in zoom-in-95 duration-500">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-indigo-300">TOTALES OPERALES POR PRODUCTO</h3>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Suma agregada del total de piezas traspasadas en el día</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(productTotals).map(([prod, qty]) => (
                    <div key={prod} className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl flex items-center gap-3">
                      <div className="text-left">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{prod}</span>
                        <span className="text-lg font-black tracking-wide text-white">{qty} PZS</span>
                      </div>
                    </div>
                  ))}
                  <div className="bg-indigo-600 px-5 py-3 rounded-2xl flex items-center gap-3">
                    <div className="text-left">
                      <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest block">PIEZAS TOTALES</span>
                      <span className="text-lg font-black tracking-wide text-white">
                        {filteredMovimientos.reduce((sum, m) => sum + (m.cantidad || 0), 0)} PZS
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'configuracion' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
            {/* Header description */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-md p-6 sm:p-8">
              <h2 className="text-3xl font-serif font-black tracking-tight text-slate-900 uppercase">Configuración de Bodegas y Productos</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">
                Añadir y eliminar las bodegas de curación y los tipos de producto del sistema
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* SUBSECCIÓN BODEGAS */}
              <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-8 flex flex-col min-h-[400px]">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-inner font-extrabold text-sm">B</div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Bodegas de Curación</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Gestión de ubicaciones físicas</p>
                  </div>
                </div>

                {/* Form to Add Bodega */}
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    placeholder="NUEVA BODEGA (EJ: BODEGA 1)..."
                    value={newBodegaName}
                    onChange={(e) => setNewBodegaName(e.target.value)}
                    className="flex-1 bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all text-slate-900"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBodegaLocal();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddBodegaLocal}
                    className="bg-indigo-600 text-white px-6 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    Añadir
                  </button>
                </div>

                {/* List of Bodegas */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 flex-1">
                  {bodegas.length === 0 ? (
                    <div className="h-48 border-2 border-dashed border-slate-100 rounded-3xl flex items-center justify-center">
                      <p className="text-xs text-slate-400 italic font-black uppercase tracking-wider">No hay bodegas configuradas</p>
                    </div>
                  ) : (
                    bodegas.map(b => (
                      <div key={b.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all">
                        <span className="text-xs font-black uppercase tracking-tight text-slate-700">{b.nombre}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteBodegaLocal(b.id)}
                          className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all text-xs cursor-pointer border-none"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* SUBSECCIÓN TIPOS DE PRODUCTO */}
              <div className="bg-white rounded-[3.5rem] border border-slate-100 shadow-xl p-8 flex flex-col min-h-[400px]">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                  <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center shadow-inner font-extrabold text-sm">P</div>
                  <div>
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">Tipos de Producto</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jamones, paletas u otros artículos</p>
                  </div>
                </div>

                {/* Form to Add Producto */}
                <div className="flex gap-2 mb-6">
                  <input
                    type="text"
                    placeholder="NUEVO PRODUCTO (EJ: JAMÓN BELLO)..."
                    value={newTipoProductoName}
                    onChange={(e) => setNewTipoProductoName(e.target.value)}
                    className="flex-1 bg-slate-50 border-4 border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-black uppercase tracking-widest outline-none focus:border-indigo-500 transition-all text-slate-900"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTipoProductoLocal();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddTipoProductoLocal}
                    className="bg-indigo-600 text-white px-6 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-indigo-700 active:scale-95 transition-all shadow-md cursor-pointer"
                  >
                    Añadir
                  </button>
                </div>

                {/* List of Productos */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 flex-1">
                  {tiposProducto.length === 0 ? (
                    <div className="h-48 border-2 border-dashed border-slate-100 rounded-3xl flex items-center justify-center">
                      <p className="text-xs text-slate-400 italic font-black uppercase tracking-wider">No hay tipos de producto configurados</p>
                    </div>
                  ) : (
                    tiposProducto.map(tp => (
                      <div key={tp.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all">
                        <span className="text-xs font-black uppercase tracking-tight text-slate-700">{tp.nombre}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteTipoProductoLocal(tp.id)}
                          className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all text-xs cursor-pointer border-none"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default BodegasModule;
