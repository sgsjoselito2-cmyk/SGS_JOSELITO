import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Trash2, Edit2, Search, Calendar, User, ShieldAlert, CheckCircle2, AlertTriangle, Clock, X } from 'lucide-react';
import { PlanAccionTop60 } from '../types';
import { supabase } from '../lib/supabase';

interface ActionPlanPanelProps {
  storageKey: string;
  title: string;
  initialData?: any[];
  responsibles: string[];
  dbTable: string;
  passwords?: Record<string, string>;
  requiredLevel?: number;
}

// Initial 3 sample rows as requested by user
const INITIAL_SAMPLE_ROWS: PlanAccionTop60[] = [
  {
    id: 1,
    numero: 1,
    seccion: 'Deshuesado / Prensado',
    problema: 'Desviación de OEE por paradas no planificadas en deshuesado de paleta',
    accion: 'Reorganización de puestos de trabajo y ajuste de velocidad de cadena',
    responsable: 'Carlos Gómez',
    soporte: 'Ana Martínez',
    fecha_lanzamiento: '2026-07-01',
    fecha_objetivo: '2026-07-25', // Past date -> Retrasado (-5 días)
    fecha_cierre: null,
    comentarios: 'Pendiente de reajuste de plantilla de turno de tarde'
  },
  {
    id: 2,
    numero: 2,
    seccion: 'Loncheado',
    problema: 'Elevada tasa de merma en loncheado de piezas de bellota',
    accion: 'Control de atemperado de pieza previo al corte y calibración de cuchilla',
    responsable: 'Javier López',
    soporte: 'María Rodríguez',
    fecha_lanzamiento: '2026-07-15',
    fecha_objetivo: '2026-08-04', // 5 días restantes -> Próximo (ámbar)
    fecha_cierre: null,
    comentarios: 'En proceso de prueba con nuevos parámetros de corte'
  },
  {
    id: 3,
    numero: 3,
    seccion: 'Empaquetado',
    problema: 'Falta de material de empaquetado termoformado por cuello de botella',
    accion: 'Estandarización de matriz de sellado y homologación de nuevo film',
    responsable: 'Pedro Sánchez',
    soporte: 'Elena Fernández',
    fecha_lanzamiento: '2026-06-10',
    fecha_objetivo: '2026-07-20',
    fecha_cierre: '2026-07-18', // Tiene fecha cierre -> Cerrado (verde)
    comentarios: 'Proveedor homologado con éxito y proceso finalizado'
  }
];

export function calcularEstadoTop60(fechaObjetivo: string, fechaCierre?: string | null) {
  if (fechaCierre && fechaCierre.trim() !== '') {
    return {
      label: 'Cerrado',
      type: 'cerrado' as const,
      colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black'
    };
  }
  if (!fechaObjetivo) {
    return {
      label: '-',
      type: 'ok' as const,
      colorClass: 'bg-slate-100 text-slate-600 border-slate-200'
    };
  }

  const parts = fechaObjetivo.split('-');
  if (parts.length !== 3) {
    return {
      label: fechaObjetivo,
      type: 'ok' as const,
      colorClass: 'bg-slate-100 text-slate-600 border-slate-200'
    };
  }

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const obj = new Date(year, month, day);
  obj.setHours(0, 0, 0, 0);

  const diffTime = obj.getTime() - hoy.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `${diffDays} días`,
      type: 'retrasado' as const,
      colorClass: 'bg-rose-100 text-rose-800 border-rose-300 font-black animate-pulse'
    };
  } else if (diffDays <= 7) {
    return {
      label: `${diffDays} días`,
      type: 'proximo' as const,
      colorClass: 'bg-amber-100 text-amber-800 border-amber-300 font-black'
    };
  } else {
    return {
      label: `${diffDays} días`,
      type: 'ok' as const,
      colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black'
    };
  }
}

const ActionPlanPanel: React.FC<ActionPlanPanelProps> = ({
  storageKey,
  title,
  responsibles,
  dbTable,
}) => {
  const [items, setItems] = useState<PlanAccionTop60[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSeccionFilter, setSelectedSeccionFilter] = useState('TODAS');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanAccionTop60 | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PlanAccionTop60 | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<PlanAccionTop60>({
    numero: 1,
    seccion: 'Deshuesado',
    problema: '',
    accion: '',
    responsable: '',
    soporte: '',
    fecha_lanzamiento: todayStr,
    fecha_objetivo: todayStr,
    fecha_cierre: '',
    comentarios: ''
  });

  // Load items on mount
  useEffect(() => {
    fetchData();
  }, [dbTable, storageKey]);

  const fetchData = async () => {
    setLoading(true);
    let loadedData: PlanAccionTop60[] = [];
    let fromDb = false;

    try {
      const { data, error } = await supabase
        .from(dbTable)
        .select('*')
        .order('numero', { ascending: true });

      if (!error && data && data.length > 0) {
        loadedData = data.map((d: any) => {
          let num = d.numero || d.num || 0;
          let sec = d.seccion || d.area || '';
          let com = d.comentarios || d.observaciones || '';

          if (d.observaciones && typeof d.observaciones === 'string' && d.observaciones.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(d.observaciones);
              if (parsed.numero !== undefined) num = parsed.numero;
              if (parsed.seccion !== undefined) sec = parsed.seccion;
              if (parsed.comentarios !== undefined) com = parsed.comentarios;
            } catch (err) {}
          }

          return {
            id: d.id,
            numero: num,
            seccion: sec,
            problema: d.problema || d.asunto || '',
            accion: d.accion || '',
            responsable: d.responsable || '',
            soporte: d.soporte || '',
            fecha_lanzamiento: d.fecha_lanzamiento || d.fechaLanzamiento || '',
            fecha_objetivo: d.fecha_objetivo || d.fechaObjetivo || '',
            fecha_cierre: d.fecha_cierre || d.fechaCierre || null,
            comentarios: com
          };
        });
        fromDb = true;
      }
    } catch (e) {
      console.warn('Error fetching from Supabase:', e);
    }

    if (!fromDb) {
      // Fallback to localStorage
      const local = localStorage.getItem(storageKey);
      if (local) {
        try {
          loadedData = JSON.parse(local);
        } catch (e) {
          console.error('Failed parsing localStorage:', e);
        }
      }
    }

    // If still empty, use sample initial data
    if (loadedData.length === 0) {
      loadedData = INITIAL_SAMPLE_ROWS;
      localStorage.setItem(storageKey, JSON.stringify(loadedData));
    }

    setItems(loadedData);
    setLoading(false);
  };

  const handleOpenAdd = () => {
    const nextNum = items.length > 0 ? Math.max(...items.map(i => Number(i.numero) || 0)) + 1 : 1;
    const defaultResp = responsibles && responsibles.length > 0 ? responsibles[0] : '';
    setForm({
      numero: nextNum,
      seccion: 'Deshuesado / Prensado',
      problema: '',
      accion: '',
      responsable: defaultResp,
      soporte: defaultResp,
      fecha_lanzamiento: todayStr,
      fecha_objetivo: todayStr,
      fecha_cierre: '',
      comentarios: ''
    });
    setEditingItem(null);
    setShowModal(true);
  };

  const handleOpenEdit = (item: PlanAccionTop60) => {
    setEditingItem(item);
    setForm({
      id: item.id,
      numero: item.numero,
      seccion: item.seccion,
      problema: item.problema,
      accion: item.accion,
      responsable: item.responsable,
      soporte: item.soporte || '',
      fecha_lanzamiento: item.fecha_lanzamiento,
      fecha_objetivo: item.fecha_objetivo,
      fecha_cierre: item.fecha_cierre || '',
      comentarios: item.comentarios || ''
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.problema || !form.accion) {
      alert('Por favor, rellene los campos Problema y Acción.');
      return;
    }

    const payloadToSave: PlanAccionTop60 = {
      ...form,
      fecha_cierre: form.fecha_cierre ? form.fecha_cierre : null
    };

    let updatedItems: PlanAccionTop60[];

    const itemRecordId = editingItem && editingItem.id ? editingItem.id : Date.now();

    if (editingItem && editingItem.id !== undefined) {
      updatedItems = items.map(i => (i.id === editingItem.id ? { ...payloadToSave, id: editingItem.id } : i));
    } else {
      updatedItems = [...items, { ...payloadToSave, id: itemRecordId }];
    }

    // Sort by numero
    updatedItems.sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
    setItems(updatedItems);
    localStorage.setItem(storageKey, JSON.stringify(updatedItems));

    // Try saving to Supabase
    try {
      const dbItem: any = {
        id: itemRecordId,
        asunto: payloadToSave.problema,
        accion: payloadToSave.accion,
        responsable: payloadToSave.responsable,
        soporte: payloadToSave.soporte,
        fechaLanzamiento: payloadToSave.fecha_lanzamiento,
        fechaObjetivo: payloadToSave.fecha_objetivo,
        fechaCierre: payloadToSave.fecha_cierre,
        observaciones: JSON.stringify({
          numero: payloadToSave.numero,
          seccion: payloadToSave.seccion,
          comentarios: payloadToSave.comentarios || ''
        })
      };

      await supabase.from(dbTable).upsert(dbItem);
    } catch (err) {
      console.warn('Error saving to Supabase:', err);
    }

    setShowModal(false);
  };

  const handleOpenDelete = (item: PlanAccionTop60) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const targetId = deleteConfirmItem.id;

    const filtered = items.filter(i => i.id !== targetId && i.numero !== deleteConfirmItem.numero);
    setItems(filtered);
    localStorage.setItem(storageKey, JSON.stringify(filtered));

    try {
      if (targetId) {
        await supabase.from(dbTable).delete().eq('id', targetId);
      } else {
        await supabase.from(dbTable).delete().eq('asunto', deleteConfirmItem.problema);
      }
    } catch (err) {
      console.warn('Error deleting from Supabase:', err);
    }

    setDeleteConfirmItem(null);
  };

  // Helper date renderer (YYYY-MM-DD -> DD/MM/YYYY)
  const formatFecha = (dStr?: string | null) => {
    if (!dStr) return '-';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  // Unique sections for filter
  const seccionesDisponibles = Array.from(new Set(items.map(i => i.seccion).filter(Boolean)));

  const filteredItems = items.filter(item => {
    const matchesSearch =
      item.problema.toLowerCase().includes(search.toLowerCase()) ||
      item.accion.toLowerCase().includes(search.toLowerCase()) ||
      item.responsable.toLowerCase().includes(search.toLowerCase()) ||
      item.seccion.toLowerCase().includes(search.toLowerCase()) ||
      String(item.numero).includes(search);

    const matchesSeccion = selectedSeccionFilter === 'TODAS' || item.seccion === selectedSeccionFilter;

    return matchesSearch && matchesSeccion;
  });

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col min-h-[650px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-100">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-black text-slate-900 uppercase tracking-tight">{title}</h2>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Seguimiento Estratégico de Desviaciones ({filteredItems.length} Acciones)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Section filter */}
          <select
            value={selectedSeccionFilter}
            onChange={e => setSelectedSeccionFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="TODAS">Todas las Secciones</option>
            {seccionesDisponibles.map(sec => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>

          {/* Search bar */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar acción, problema, responsable..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Nueva Acción
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 px-3 w-12 text-center">Nº</th>
              <th className="py-3 px-3 w-32">Sección</th>
              <th className="py-3 px-3 min-w-[200px]">Problema / Asunto</th>
              <th className="py-3 px-3 min-w-[220px]">Acción Estratégica</th>
              <th className="py-3 px-3 w-36">Responsable</th>
              <th className="py-3 px-3 w-36">Soporte</th>
              <th className="py-3 px-3 w-28 text-center">F. Lanzam.</th>
              <th className="py-3 px-3 w-28 text-center">F. Objetivo</th>
              <th className="py-3 px-3 w-28 text-center">F. Cierre</th>
              <th className="py-3 px-3 w-28 text-center">Estado</th>
              <th className="py-3 px-3 min-w-[150px]">Comentarios</th>
              <th className="py-3 px-3 w-20 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
            {loading ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400 font-bold">
                  Cargando Plan de Acción...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400 font-bold">
                  No se encontraron acciones registradas.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const est = calcularEstadoTop60(item.fecha_objetivo, item.fecha_cierre);
                return (
                  <tr key={item.id || item.numero} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-black text-slate-900 text-center bg-slate-50/30">
                      {item.numero}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] uppercase font-black tracking-wide border border-slate-200">
                        {item.seccion}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900 leading-snug">
                      {item.problema}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 leading-snug">
                      {item.accion}
                    </td>
                    <td className="py-3 px-3 font-bold text-indigo-900">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                        <span>{item.responsable || '-'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {item.soporte ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{item.soporte}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-mono text-[11px]">
                      {formatFecha(item.fecha_lanzamiento)}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-800 font-mono text-[11px]">
                      {formatFecha(item.fecha_objetivo)}
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-mono text-[11px]">
                      {item.fecha_cierre ? (
                        <span className="text-emerald-700 font-bold">{formatFecha(item.fecha_cierre)}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[11px] border ${est.colorClass}`}
                      >
                        {est.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px] italic">
                      {item.comentarios || '-'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 hover:bg-slate-200 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors"
                          title="Editar Acción"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenDelete(item)}
                          className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Eliminar Acción"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for Create / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-2xl text-white">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-black text-slate-900 uppercase">
                    {editingItem ? `Editar Acción Nº ${form.numero}` : 'Nueva Acción Estratégica'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Plan de Acción TOP 60
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    Nº Correlativo
                  </label>
                  <input
                    type="number"
                    value={form.numero}
                    onChange={e => setForm({ ...form, numero: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    Sección / Taller
                  </label>
                  <input
                    type="text"
                    value={form.seccion}
                    onChange={e => setForm({ ...form, seccion: e.target.value })}
                    placeholder="Ej: Deshuesado, Loncheado, Calidad..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  Problema / Asunto
                </label>
                <textarea
                  value={form.problema}
                  onChange={e => setForm({ ...form, problema: e.target.value })}
                  placeholder="Descripción concisa del problema u oportunidad de mejora..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  Acción Estratégica
                </label>
                <textarea
                  value={form.accion}
                  onChange={e => setForm({ ...form, accion: e.target.value })}
                  placeholder="Acciones concretas a implementar para resolver la desviación..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    Responsable
                  </label>
                  {responsibles && responsibles.length > 0 ? (
                    <select
                      value={form.responsable}
                      onChange={e => setForm({ ...form, responsable: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    >
                      <option value="">Seleccionar Responsable</option>
                      {responsibles.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form.responsable}
                      onChange={e => setForm({ ...form, responsable: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    Soporte / Apoyo
                  </label>
                  {responsibles && responsibles.length > 0 ? (
                    <select
                      value={form.soporte}
                      onChange={e => setForm({ ...form, soporte: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Sin Soporte Asignado</option>
                      {responsibles.map(r => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={form.soporte}
                      onChange={e => setForm({ ...form, soporte: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    F. Lanzamiento
                  </label>
                  <input
                    type="date"
                    value={form.fecha_lanzamiento}
                    onChange={e => setForm({ ...form, fecha_lanzamiento: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    F. Objetivo
                  </label>
                  <input
                    type="date"
                    value={form.fecha_objetivo}
                    onChange={e => setForm({ ...form, fecha_objetivo: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    F. Cierre (Opcional)
                  </label>
                  <input
                    type="date"
                    value={form.fecha_cierre || ''}
                    onChange={e => setForm({ ...form, fecha_cierre: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                  Comentarios / Observaciones
                </label>
                <input
                  type="text"
                  value={form.comentarios || ''}
                  onChange={e => setForm({ ...form, comentarios: e.target.value })}
                  placeholder="Avance, impedimentos u observaciones adicionales..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-100"
                >
                  Guardar Acción
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion (No confirm() used) */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-serif font-black text-slate-900 uppercase mb-2">
              ¿Eliminar Acción Nº {deleteConfirmItem.numero}?
            </h3>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Esta acción eliminará de forma permanente el registro <span className="font-bold text-slate-900">"{deleteConfirmItem.problema}"</span> de la base de datos. Esta operación no se puede deshacer.
            </p>

            <div className="flex items-center justify-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-200"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionPlanPanel;
