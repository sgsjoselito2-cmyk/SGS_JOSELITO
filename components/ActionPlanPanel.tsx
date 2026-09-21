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

const DEFAULT_RESPONSABLES = [
  'Alberto',
  'Eva',
  'Ana',
  'Gemma',
  'Laura',
  'Andreia',
  'Todos'
];

export function calcularEstadoTop60(fechaObjetivo?: string | null, fechaCierre?: string | null) {
  if (fechaCierre && String(fechaCierre).trim() !== '') {
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

  const parts = String(fechaObjetivo).split('-');
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
  dbTable = 'plan_accion_top60'
}) => {
  const [items, setItems] = useState<PlanAccionTop60[]>([]);
  const itemsRef = useRef<PlanAccionTop60[]>([]);
  itemsRef.current = items;

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Inline editing state: { id, field }
  const [editingCell, setEditingCell] = useState<{ id: string | number; field: string } | null>(null);

  // Delete modal state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<PlanAccionTop60 | null>(null);

  // Load items from Supabase on mount
  useEffect(() => {
    fetchData();
  }, [dbTable, storageKey]);

  const fetchData = async () => {
    setLoading(true);
    let loadedData: PlanAccionTop60[] = [];

    if (isConfigured) {
      try {
        const { data, error } = await supabase
          .from(dbTable || 'plan_accion_top60')
          .select('*')
          .order('id', { ascending: true });

        if (error) {
          console.error('Error al cargar datos desde Supabase:', error.message || error);
        } else if (data) {
          loadedData = data.map((d: any, idx: number) => ({
            id: Number(d.id),
            numero: idx + 1,
            asunto: d.asunto || '',
            accion: d.accion || '',
            responsable: d.responsable || '',
            soporte: d.soporte || '',
            fechalanzamiento: d.fechalanzamiento || '',
            fechaobjetivo: d.fechaobjetivo || '',
            fechacierre: d.fechacierre || null,
            observaciones: d.observaciones || '',
            created_at: d.created_at || '',
            // Aliases for compatibility
            problema: d.asunto || '',
            fecha_lanzamiento: d.fechalanzamiento || '',
            fecha_objetivo: d.fechaobjetivo || '',
            fecha_cierre: d.fechacierre || null,
            comentarios: d.observaciones || ''
          }));
          localStorage.setItem(storageKey, JSON.stringify(loadedData));
        }
      } catch (e) {
        console.error('Excepción al cargar datos desde Supabase:', e);
      }
    }

    // Fallback to local cache if network is offline or unconfigured
    if (loadedData.length === 0) {
      const local = localStorage.getItem(storageKey);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedData = parsed;
          }
        } catch (e) {
          console.error('Error parseando localStorage:', e);
        }
      }
    }

    setItems(loadedData);
    setLoading(false);
  };

  // Persist single item to Supabase table
  const persistItem = async (targetItem: PlanAccionTop60) => {
    if (!isConfigured) return;
    try {
      const payload = {
        id: targetItem.id,
        asunto: targetItem.asunto || '',
        accion: targetItem.accion || '',
        responsable: targetItem.responsable || '',
        soporte: targetItem.soporte ? targetItem.soporte : null,
        fechalanzamiento: targetItem.fechalanzamiento ? targetItem.fechalanzamiento : null,
        fechaobjetivo: targetItem.fechaobjetivo ? targetItem.fechaobjetivo : null,
        fechacierre: targetItem.fechacierre ? targetItem.fechacierre : null,
        observaciones: targetItem.observaciones ? targetItem.observaciones : null
      };

      const { error } = await supabase
        .from(dbTable || 'plan_accion_top60')
        .upsert(payload);

      if (error) {
        console.error('Error al guardar en Supabase:', error.message || error);
      }
    } catch (err) {
      console.error('Excepción al guardar en Supabase:', err);
    }
  };

  // Field change for text inputs (asunto, accion, observaciones)
  const handleUpdateField = (id: string | number, field: keyof PlanAccionTop60, value: any) => {
    setItems(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          if (field === 'asunto') updated.problema = value;
          if (field === 'observaciones') updated.comentarios = value;
          return updated;
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
          if (field === 'fechalanzamiento') changedItem.fecha_lanzamiento = value;
          if (field === 'fechaobjetivo') changedItem.fecha_objetivo = value;
          if (field === 'fechacierre') changedItem.fecha_cierre = value;
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
  const handleAddNewRow = async () => {
    const nextNum = items.length + 1;
    const currentMaxId = items.length > 0 ? Math.max(...items.map(i => Number(i.id) || 0)) : 0;
    const nextId = currentMaxId + 1;
    const defaultResp = availableResponsibles.length > 0 ? availableResponsibles[0] : '';
    const todayStr = new Date().toISOString().split('T')[0];

    const newItem: PlanAccionTop60 = {
      id: nextId,
      numero: nextNum,
      asunto: '',
      accion: '',
      responsable: defaultResp,
      soporte: '',
      fechalanzamiento: todayStr,
      fechaobjetivo: todayStr,
      fechacierre: null,
      observaciones: '',
      created_at: new Date().toISOString(),
      problema: '',
      fecha_lanzamiento: todayStr,
      fecha_objetivo: todayStr,
      fecha_cierre: null,
      comentarios: ''
    };

    const nextItems = [...items, newItem];
    setItems(nextItems);
    localStorage.setItem(storageKey, JSON.stringify(nextItems));

    if (search.trim() !== '') {
      setSearch('');
    }

    // Set first cell (asunto) in edit mode directly
    setEditingCell({ id: nextId, field: 'asunto' });

    // Persist to Supabase
    await persistItem(newItem);
  };

  // Open delete confirm modal
  const handleOpenDelete = (item: PlanAccionTop60) => {
    setDeleteConfirmItem(item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const targetId = deleteConfirmItem.id;

    const filtered = items.filter(i => i.id !== targetId);
    const renumbered = filtered.map((item, idx) => ({ ...item, numero: idx + 1 }));
    setItems(renumbered);
    localStorage.setItem(storageKey, JSON.stringify(renumbered));

    if (isConfigured && targetId) {
      try {
        const { error } = await supabase
          .from(dbTable || 'plan_accion_top60')
          .delete()
          .eq('id', targetId);
        if (error) {
          console.error('Error al eliminar en Supabase:', error.message || error);
        }
      } catch (err) {
        console.error('Excepción al eliminar en Supabase:', err);
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
    const parts = String(dStr).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  // Available responsibles list
  const availableResponsibles = Array.from(
    new Set([
      ...(responsibles || []),
      ...DEFAULT_RESPONSABLES,
      ...items.map(i => i.responsable).filter(Boolean)
    ])
  ).filter(Boolean);

  const filteredItems = items.filter(item => {
    const term = search.toLowerCase();
    return (
      (item.asunto || '').toLowerCase().includes(term) ||
      (item.accion || '').toLowerCase().includes(term) ||
      (item.responsable || '').toLowerCase().includes(term) ||
      (item.soporte || '').toLowerCase().includes(term) ||
      (item.observaciones || '').toLowerCase().includes(term) ||
      String(item.numero || '').includes(term)
    );
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
          {/* Search bar */}
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar acción, asunto, responsable..."
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
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <th className="py-3 px-3 w-12 text-center">Nº</th>
              <th className="py-3 px-3 min-w-[240px]">Problema / Asunto</th>
              <th className="py-3 px-3 min-w-[260px]">Acción Estratégica</th>
              <th className="py-3 px-3 w-40">Responsable</th>
              <th className="py-3 px-3 w-40">Soporte</th>
              <th className="py-3 px-3 w-32 text-center">F. Lanzam.</th>
              <th className="py-3 px-3 w-32 text-center">F. Objetivo</th>
              <th className="py-3 px-3 w-32 text-center">F. Cierre</th>
              <th className="py-3 px-3 w-32 text-center">Estado</th>
              <th className="py-3 px-3 min-w-[200px]">Comentarios</th>
              <th className="py-3 px-3 w-14 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
            {loading ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 font-bold">
                  Cargando Plan de Acción desde la base de datos...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400 font-bold">
                  No se encontraron acciones registradas. Pulsa "+ Nueva Acción" para comenzar.
                </td>
              </tr>
            ) : (
              filteredItems.map(item => {
                const itemId = item.id;
                const est = calcularEstadoTop60(item.fechaobjetivo, item.fechacierre);

                const isEditing = (field: string) =>
                  editingCell?.id === itemId && editingCell?.field === field;

                return (
                  <tr key={itemId} className="hover:bg-slate-50/50 transition-colors group">
                    {/* Nº */}
                    <td className="py-2.5 px-3 font-black text-slate-900 text-center bg-slate-50/30">
                      {item.numero}
                    </td>

                    {/* PROBLEMA / ASUNTO (Textarea inline) */}
                    <td
                      className="py-2.5 px-3 font-semibold text-slate-900 leading-snug cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('asunto')) setEditingCell({ id: itemId, field: 'asunto' });
                      }}
                      title="Clic para editar problema / asunto"
                    >
                      {isEditing('asunto') ? (
                        <textarea
                          autoFocus
                          rows={2}
                          value={item.asunto || ''}
                          onChange={e => handleUpdateField(itemId, 'asunto', e.target.value)}
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
                          {item.asunto ? (
                            <span>{item.asunto}</span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-normal">+ Escribir problema / asunto...</span>
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
                          value={item.accion || ''}
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
                          value={item.responsable || ''}
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
                        if (!isEditing('fechalanzamiento')) setEditingCell({ id: itemId, field: 'fechalanzamiento' });
                      }}
                      title="Clic para modificar F. Lanzamiento"
                    >
                      {isEditing('fechalanzamiento') ? (
                        <input
                          type="date"
                          autoFocus
                          value={item.fechalanzamiento || ''}
                          onChange={e => handleSelectOrDateChange(itemId, 'fechalanzamiento', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-1.5 py-1 bg-white border-2 border-indigo-500 rounded-lg text-[11px] font-mono font-bold text-slate-800 outline-none shadow-sm text-center"
                        />
                      ) : (
                        <span>{formatFecha(item.fechalanzamiento)}</span>
                      )}
                    </td>

                    {/* F. OBJETIVO (Date picker inline) */}
                    <td
                      className="py-2.5 px-3 text-center font-bold text-slate-800 font-mono text-[11px] cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('fechaobjetivo')) setEditingCell({ id: itemId, field: 'fechaobjetivo' });
                      }}
                      title="Clic para modificar F. Objetivo"
                    >
                      {isEditing('fechaobjetivo') ? (
                        <input
                          type="date"
                          autoFocus
                          value={item.fechaobjetivo || ''}
                          onChange={e => handleSelectOrDateChange(itemId, 'fechaobjetivo', e.target.value)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-1.5 py-1 bg-white border-2 border-indigo-500 rounded-lg text-[11px] font-mono font-bold text-slate-800 outline-none shadow-sm text-center"
                        />
                      ) : (
                        <span>{formatFecha(item.fechaobjetivo)}</span>
                      )}
                    </td>

                    {/* F. CIERRE (Date picker inline) */}
                    <td
                      className="py-2.5 px-3 text-center text-slate-600 font-mono text-[11px] cursor-pointer hover:bg-indigo-50/30 transition-colors"
                      onClick={() => {
                        if (!isEditing('fechacierre')) setEditingCell({ id: itemId, field: 'fechacierre' });
                      }}
                      title="Clic para modificar F. Cierre"
                    >
                      {isEditing('fechacierre') ? (
                        <input
                          type="date"
                          autoFocus
                          value={item.fechacierre || ''}
                          onChange={e => handleSelectOrDateChange(itemId, 'fechacierre', e.target.value || null)}
                          onBlur={() => handleBlur(itemId)}
                          className="w-full px-1.5 py-1 bg-white border-2 border-indigo-500 rounded-lg text-[11px] font-mono font-bold text-slate-800 outline-none shadow-sm text-center"
                        />
                      ) : item.fechacierre ? (
                        <span className="text-emerald-700 font-bold">{formatFecha(item.fechacierre)}</span>
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
                        if (!isEditing('observaciones')) setEditingCell({ id: itemId, field: 'observaciones' });
                      }}
                      title="Clic para editar comentarios"
                    >
                      {isEditing('observaciones') ? (
                        <input
                          type="text"
                          autoFocus
                          value={item.observaciones || ''}
                          onChange={e => handleUpdateField(itemId, 'observaciones', e.target.value)}
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
                          {item.observaciones ? (
                            <span>{item.observaciones}</span>
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
              <span className="font-bold text-slate-900">"{deleteConfirmItem.asunto || `Acción Nº ${deleteConfirmItem.numero}`}"</span>{' '}
              de la base de datos de Supabase. Esta operación no se puede deshacer.
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
