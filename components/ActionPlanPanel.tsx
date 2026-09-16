import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, Plus, Trash2, Search, User, AlertTriangle } from 'lucide-react';
import { PlanAccionTop60 } from '../types';
import { supabase, isConfigured } from '../lib/supabase';

interface ActionPlanPanelProps {
  storageKey: string;
  title: string;
  initialData?: any[];
  responsibles: string[];
  dbTable: string;
  passwords?: Record<string, string>;
  requiredLevel?: number;
}

// Initial 3 sample rows
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
    fecha_objetivo: '2026-07-25',
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
    fecha_objetivo: '2026-08-04',
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
    fecha_cierre: '2026-07-18',
    comentarios: 'Proveedor homologado con éxito y proceso finalizado'
  }
];

const DEFAULT_SECCIONES = [
  'Deshuesado / Prensado',
  'Loncheado',
  'Emp. Loncheado',
  'Emp. Deshuesado',
  'Envasado',
  'Empaquetado',
  'Expediciones',
  'Preparación',
  'Movimiento Jamones',
  'Sala Blanca',
  'Calidad',
  'Seguridad',
  'Mantenimiento'
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
    const absDays = Math.abs(diffDays);
    return {
      label: `${absDays} ${absDays === 1 ? 'día' : 'días'} retraso`,
      type: 'retrasado' as const,
      colorClass: 'bg-rose-100 text-rose-800 border-rose-300 font-black'
    };
  } else {
    return {
      label: `${diffDays} ${diffDays === 1 ? 'día' : 'días'} restantes`,
      type: 'futura' as const,
      colorClass: 'bg-blue-100 text-blue-800 border-blue-300 font-black'
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
  const itemsRef = useRef<PlanAccionTop60[]>([]);
  itemsRef.current = items;

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSeccionFilter, setSelectedSeccionFilter] = useState('TODAS');

  // Inline editing state: { id, field }
  const [editingCell, setEditingCell] = useState<{ id: string | number; field: string } | null>(null);

  // Delete modal state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PlanAccionTop60 | null>(null);

  // Load items on mount
  useEffect(() => {
    fetchData();
  }, [dbTable, storageKey]);

  const fetchData = async () => {
    setLoading(true);
    let loadedData: PlanAccionTop60[] = [];
    let fromDb = false;

    if (isConfigured) {
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
    }

    if (!fromDb) {
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

  // Persist single item to Supabase
  const persistItem = async (targetItem: PlanAccionTop60) => {
    if (!isConfigured) return;
    try {
      const dbItem: any = {
        id: targetItem.id,
        asunto: targetItem.problema || '',
        accion: targetItem.accion || '',
        responsable: targetItem.responsable || '',
        soporte: targetItem.soporte || '',
        fechaLanzamiento: targetItem.fecha_lanzamiento || '',
        fechaObjetivo: targetItem.fecha_objetivo || '',
        fechaCierre: targetItem.fecha_cierre || null,
        observaciones: JSON.stringify({
          numero: targetItem.numero,
          seccion: targetItem.seccion || '',
          comentarios: targetItem.comentarios || ''
        })
      };
      await supabase.from(dbTable).upsert(dbItem);
    } catch (err) {
      console.warn('Error syncing item to Supabase:', err);
    }
  };

  // Field change for text inputs (problema, accion, comentarios)
  const handleUpdateField = (id: string | number, field: keyof PlanAccionTop60, value: any) => {
    setItems(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      });
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  // Immediate save on blur for text fields
  const handleBlur = (id: string | number) => {
    setEditingCell(null);
    const target = itemsRef.current.find(i => i.id === id);
    if (target) {
      persistItem(target);
    }
  };

  // Instant update and persist for dropdowns and date pickers
  const handleSelectOrDateChange = (id: string | number, field: keyof PlanAccionTop60, value: any) => {
    setItems(prev => {
      let changedItem: PlanAccionTop60 | null = null;
      const next = prev.map(item => {
        if (item.id === id) {
          changedItem = { ...item, [field]: value };
          return changedItem;
        }
        return item;
      });
      localStorage.setItem(storageKey, JSON.stringify(next));
      if (changedItem) {
        persistItem(changedItem);
      }
      return next;
    });
  };

  // Add new empty row inline without opening modal
  const handleAddNewRow = () => {
    const nextNum = items.length > 0 ? Math.max(...items.map(i => Number(i.numero) || 0)) + 1 : 1;
    const defaultResp = availableResponsibles.length > 0 ? availableResponsibles[0] : '';
    const newId = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];

    const newItem: PlanAccionTop60 = {
      id: newId,
      numero: nextNum,
      seccion: availableSections[0] || 'Deshuesado / Prensado',
      problema: '',
      accion: '',
      responsable: defaultResp,
      soporte: '',
      fecha_lanzamiento: todayStr,
      fecha_objetivo: todayStr,
      fecha_cierre: null,
      comentarios: ''
    };

    const nextItems = [...items, newItem];
    setItems(nextItems);
    localStorage.setItem(storageKey, JSON.stringify(nextItems));

    // Reset filters if they would hide this new row
    if (selectedSeccionFilter !== 'TODAS') {
      setSelectedSeccionFilter('TODAS');
    }
    if (search.trim() !== '') {
      setSearch('');
    }

    // Set first cell (problema) in edit mode directly
    setEditingCell({ id: newId, field: 'problema' });

    // Persist to Supabase
    persistItem(newItem);
  };

  // Open delete confirm modal
  const handleOpenDelete = (item: PlanAccionTop60) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const targetId = deleteConfirmItem.id;

    const filtered = items.filter(i => i.id !== targetId && i.numero !== deleteConfirmItem.numero);
    setItems(filtered);
    localStorage.setItem(storageKey, JSON.stringify(filtered));

    if (isConfigured) {
      try {
        if (targetId) {
          await supabase.from(dbTable).delete().eq('id', targetId);
        } else {
          await supabase.from(dbTable).delete().eq('asunto', deleteConfirmItem.problema);
        }
      } catch (err) {
        console.warn('Error deleting from Supabase:', err);
      }
    }

    setDeleteConfirmItem(null);
    if (editingCell?.id === targetId) {
      setEditingCell(null);
    }
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

  // Available sections list
  const availableSections = Array.from(
    new Set([
      ...DEFAULT_SECCIONES,
      ...items.map(i => i.seccion).filter(Boolean)
    ])
  );

  // Available responsibles list
  const availableResponsibles = Array.from(
    new Set([
      ...(responsibles || []),
      ...items.map(i => i.responsable).filter(Boolean)
    ])
  ).filter(Boolean);

  // Unique sections for filter
  const seccionesDisponibles = Array.from(new Set(items.map(i => i.seccion).filter(Boolean)));

  const filteredItems = items.filter(item => {
    const matchesSearch =
      (item.problema || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.accion || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.responsable || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.seccion || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.comentarios || '').toLowerCase().includes(search.toLowerCase()) ||
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
              Seguimiento Estratégico de Desviaciones ({filteredItems.length} Acciones) • Edición directa tipo Excel
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
            onClick={handleAddNewRow}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-100 active:scale-95"
            title="Añadir una nueva fila editable"
          >
            <Plus className="w-4 h-4" />
            + Nueva Acción
          </button>
        </div>
      </div>

      {/* Main Table with Inline Excel Editing */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1250px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 px-3 w-12 text-center">Nº</th>
              <th className="py-3 px-3 w-36">Sección</th>
              <th className="py-3 px-3 min-w-[220px]">Problema / Asunto</th>
              <th className="py-3 px-3 min-w-[240px]">Acción Estratégica</th>
              <th className="py-3 px-3 w-40">Responsable</th>
              <th className="py-3 px-3 w-40">Soporte</th>
              <th className="py-3 px-3 w-32 text-center">F. Lanzam.</th>
              <th className="py-3 px-3 w-32 text-center">F. Objetivo</th>
              <th className="py-3 px-3 w-32 text-center">F. Cierre</th>
              <th className="py-3 px-3 w-32 text-center">Estado</th>
              <th className="py-3 px-3 min-w-[180px]">Comentarios</th>
              <th className="py-3 px-3 w-14 text-center">Acciones</th>
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
                  No se encontraron acciones registradas. Pulsa "+ Nueva Acción" para comenzar.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const itemId = item.id !== undefined ? item.id : item.numero;
                const est = calcularEstadoTop60(item.fecha_objetivo, item.fecha_cierre);

                const isEditing = (field: string) =>
                  editingCell?.id === itemId && editingCell?.field === field;

                return (
                  <tr key={itemId} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Nº */}
                    <td className="py-2.5 px-3 font-black text-slate-900 text-center bg-slate-50/30">
                      {item.numero}
                    </td>

                    {/* SECCIÓN (Dropdown inline) */}
                    <td
                      className="py-2.5 px-3 font-bold text-slate-800 cursor-pointer hover:bg-indigo-50/30 transition-colors relative"
                      onClick={() => {
                        if (!isEditing('seccion')) setEditingCell({ id: itemId, field: 'seccion' });
                      }}
                      title="Clic para seleccionar sección"
                    >
                      {isEditing('seccion') ? (
                        <select
                          autoFocus
                          value={item.seccion}
                          onChange={e => handleSelectOrDateChange(itemId, 'seccion', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-2 py-1.5 bg-white border-2 border-indigo-500 rounded-lg text-xs font-bold text-slate-800 outline-none shadow-sm"
                        >
                          {availableSections.map(sec => (
                            <option key={sec} value={sec}>
                              {sec}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] uppercase font-black tracking-wide border border-slate-200 group-hover:border-indigo-200 transition-colors">
                          {item.seccion || 'Seleccionar'}
                        </span>
                      )}
                    </td>

                    {/* PROBLEMA / ASUNTO (Textarea inline) */}
                    <td
                      className="py-2.5 px-3 font-semibold text-slate-900 leading-snug cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('problema')) setEditingCell({ id: itemId, field: 'problema' });
                      }}
                      title="Clic para editar problema / asunto"
                    >
                      {isEditing('problema') ? (
                        <textarea
                          autoFocus
                          rows={2}
                          value={item.problema}
                          onChange={e => handleUpdateField(itemId, 'problema', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              (e.target as HTMLElement).blur();
                            }
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          placeholder="Problema / Asunto..."
                          className="w-full p-2 bg-white border-2 border-indigo-500 rounded-lg text-xs font-semibold text-slate-900 outline-none shadow-inner resize-none"
                        />
                      ) : (
                        <div className="min-h-[28px] flex items-center">
                          {item.problema ? (
                            <span>{item.problema}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-normal">+ Escribir problema...</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* ACCIÓN ESTRATÉGICA (Textarea inline) */}
                    <td
                      className="py-2.5 px-3 font-medium text-slate-700 leading-snug cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('accion')) setEditingCell({ id: itemId, field: 'accion' });
                      }}
                      title="Clic para editar acción estratégica"
                    >
                      {isEditing('accion') ? (
                        <textarea
                          autoFocus
                          rows={2}
                          value={item.accion}
                          onChange={e => handleUpdateField(itemId, 'accion', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              (e.target as HTMLElement).blur();
                            }
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          placeholder="Acción estratégica..."
                          className="w-full p-2 bg-white border-2 border-indigo-500 rounded-lg text-xs font-medium text-slate-800 outline-none shadow-inner resize-none"
                        />
                      ) : (
                        <div className="min-h-[28px] flex items-center">
                          {item.accion ? (
                            <span>{item.accion}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-normal">+ Escribir acción...</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* RESPONSABLE (Dropdown inline) */}
                    <td
                      className="py-2.5 px-3 font-bold text-indigo-900 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('responsable')) setEditingCell({ id: itemId, field: 'responsable' });
                      }}
                      title="Clic para asignar responsable"
                    >
                      {isEditing('responsable') ? (
                        <select
                          autoFocus
                          value={item.responsable}
                          onChange={e => handleSelectOrDateChange(itemId, 'responsable', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-2 py-1.5 bg-white border-2 border-indigo-500 rounded-lg text-xs font-bold text-slate-800 outline-none shadow-sm"
                        >
                          <option value="">Seleccionar Responsable</option>
                          {availableResponsibles.map(r => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                          <span className="truncate">
                            {item.responsable || <span className="text-slate-400 font-normal italic">Sin asignar</span>}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* SOPORTE (Dropdown inline) */}
                    <td
                      className="py-2.5 px-3 text-slate-600 cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('soporte')) setEditingCell({ id: itemId, field: 'soporte' });
                      }}
                      title="Clic para asignar soporte"
                    >
                      {isEditing('soporte') ? (
                        <select
                          autoFocus
                          value={item.soporte || ''}
                          onChange={e => handleSelectOrDateChange(itemId, 'soporte', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-2 py-1.5 bg-white border-2 border-indigo-500 rounded-lg text-xs font-medium text-slate-800 outline-none shadow-sm"
                        >
                          <option value="">— Sin Soporte —</option>
                          {availableResponsibles.map(r => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : item.soporte ? (
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate font-medium">{item.soporte}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* F. LANZAMIENTO (Date picker inline) */}
                    <td
                      className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px] cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('fecha_lanzamiento')) setEditingCell({ id: itemId, field: 'fecha_lanzamiento' });
                      }}
                      title="Clic para modificar F. Lanzamiento"
                    >
                      {isEditing('fecha_lanzamiento') ? (
                        <input
                          type="date"
                          autoFocus
                          value={item.fecha_lanzamiento || ''}
                          onChange={e => handleSelectOrDateChange(itemId, 'fecha_lanzamiento', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-1.5 py-1 bg-white border-2 border-indigo-500 rounded-lg text-[11px] font-mono font-bold text-slate-800 outline-none shadow-sm text-center"
                        />
                      ) : (
                        <span>{formatFecha(item.fecha_lanzamiento)}</span>
                      )}
                    </td>

                    {/* F. OBJETIVO (Date picker inline) */}
                    <td
                      className="py-2.5 px-3 text-center font-bold text-slate-800 font-mono text-[11px] cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('fecha_objetivo')) setEditingCell({ id: itemId, field: 'fecha_objetivo' });
                      }}
                      title="Clic para modificar F. Objetivo"
                    >
                      {isEditing('fecha_objetivo') ? (
                        <input
                          type="date"
                          autoFocus
                          value={item.fecha_objetivo || ''}
                          onChange={e => handleSelectOrDateChange(itemId, 'fecha_objetivo', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-1.5 py-1 bg-white border-2 border-indigo-500 rounded-lg text-[11px] font-mono font-bold text-slate-800 outline-none shadow-sm text-center"
                        />
                      ) : (
                        <span>{formatFecha(item.fecha_objetivo)}</span>
                      )}
                    </td>

                    {/* F. CIERRE (Date picker inline) */}
                    <td
                      className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px] cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('fecha_cierre')) setEditingCell({ id: itemId, field: 'fecha_cierre' });
                      }}
                      title="Clic para modificar F. Cierre"
                    >
                      {isEditing('fecha_cierre') ? (
                        <input
                          type="date"
                          autoFocus
                          value={item.fecha_cierre || ''}
                          onChange={e => handleSelectOrDateChange(itemId, 'fecha_cierre', e.target.value || null)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-1.5 py-1 bg-white border-2 border-indigo-500 rounded-lg text-[11px] font-mono font-bold text-slate-800 outline-none shadow-sm text-center"
                        />
                      ) : item.fecha_cierre ? (
                        <span className="text-emerald-700 font-bold">{formatFecha(item.fecha_cierre)}</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* ESTADO (Calculado automáticamente, no editable) */}
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap ${est.colorClass}`}>
                        {est.label}
                      </span>
                    </td>

                    {/* COMENTARIOS (Input text inline) */}
                    <td
                      className="py-2.5 px-3 text-slate-600 text-[11px] cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('comentarios')) setEditingCell({ id: itemId, field: 'comentarios' });
                      }}
                      title="Clic para editar comentarios"
                    >
                      {isEditing('comentarios') ? (
                        <input
                          type="text"
                          autoFocus
                          value={item.comentarios || ''}
                          onChange={e => handleUpdateField(itemId, 'comentarios', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLElement).blur();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          placeholder="Comentarios u observaciones..."
                          className="w-full p-1.5 bg-white border-2 border-indigo-500 rounded-lg text-[11px] font-medium text-slate-800 outline-none shadow-inner"
                        />
                      ) : (
                        <div className="min-h-[28px] flex items-center">
                          {item.comentarios ? (
                            <span>{item.comentarios}</span>
                          ) : (
                            <span className="text-slate-300 italic">-</span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* ELIMINAR (Icono de papelera) */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          handleOpenDelete(item);
                        }}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        title="Eliminar Acción"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
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
              Esta acción eliminará de forma permanente el registro{' '}
              <span className="font-bold text-slate-900">"{deleteConfirmItem.problema || `Acción Nº ${deleteConfirmItem.numero}`}"</span>{' '}
              de la base de datos. Esta operación no se puede deshacer.
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
