// src/components/TableSettingsModal.tsx

import React, { useState, useEffect } from 'react';
import { X, Check, ArrowUp, ArrowDown, Trash2, Plus, GripVertical } from 'lucide-react';
import { ViewSettings, ColumnDef, SortRule, FilterRule } from '../types/table';

interface TableSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: ViewSettings;
    onUpdate: (s: ViewSettings) => void;
    allColumns: ColumnDef[];
}

export const TableSettingsModal: React.FC<TableSettingsModalProps> = ({
    isOpen, onClose, settings, onUpdate, allColumns
}) => {
    const [activeTab, setActiveTab] = useState < 'columns' | 'sort' | 'filter' | 'group' > ('columns');
    const [localSettings, setLocalSettings] = useState < ViewSettings > (settings);
    const [draggedItemIndex, setDraggedItemIndex] = useState < number | null > (null);

    useEffect(() => { if (isOpen) setLocalSettings(settings); }, [isOpen, settings]);

    const handleSave = () => { onUpdate(localSettings); onClose(); };

    if (!isOpen) return null;

    // --- LOGICA COLONNE ---
    const toggleCol = (id: string) => {
        setLocalSettings(prev => ({
            ...prev,
            columns: prev.columns.map(c => c.id === id ? { ...c, visible: !c.visible } : c)
        }));
    };

    const handleDragStart = (index: number) => setDraggedItemIndex(index);
    const handleDragOver = (e: React.DragEvent) => e.preventDefault();
    const handleDrop = (dropIndex: number) => {
        if (draggedItemIndex === null || draggedItemIndex === dropIndex) return;
        const newCols = [...localSettings.columns];
        const [movedItem] = newCols.splice(draggedItemIndex, 1);
        newCols.splice(dropIndex, 0, movedItem);
        setLocalSettings(prev => ({ ...prev, columns: newCols }));
        setDraggedItemIndex(null);
    };

    // --- LOGICA SORT ---
    const addSort = () => setLocalSettings(prev => ({ ...prev, sorts: [...prev.sorts, { id: Math.random().toString(), columnId: allColumns[0].id, direction: 'asc' }] }));
    const removeSort = (id: string) => setLocalSettings(prev => ({ ...prev, sorts: prev.sorts.filter(s => s.id !== id) }));
    const updateSort = (id: string, key: keyof SortRule, val: any) => setLocalSettings(prev => ({ ...prev, sorts: prev.sorts.map(s => s.id === id ? { ...s, [key]: val } : s) }));

    // --- LOGICA FILTER ---
    const addFilter = () => setLocalSettings(prev => ({ ...prev, filters: [...prev.filters, { id: Math.random().toString(), columnId: allColumns[0].id, type: 'include', operator: 'contains', value: '' }] }));
    const removeFilter = (id: string) => setLocalSettings(prev => ({ ...prev, filters: prev.filters.filter(f => f.id !== id) }));
    const updateFilter = (id: string, key: keyof FilterRule, val: any) => setLocalSettings(prev => ({ ...prev, filters: prev.filters.map(f => f.id === id ? { ...f, [key]: val } : f) }));

    // --- LOGICA GROUP ---
    const addGroup = () => setLocalSettings(prev => ({ ...prev, groups: [...prev.groups, { id: Math.random().toString(), columnId: allColumns[0].id }] }));
    const removeGroup = (id: string) => setLocalSettings(prev => ({ ...prev, groups: prev.groups.filter(g => g.id !== id) }));
    const updateGroup = (id: string, val: string) => setLocalSettings(prev => ({ ...prev, groups: prev.groups.map(g => g.id === id ? { ...g, columnId: val } : g) }));

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[600px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-slate-800">View Settings</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-500" /></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50">
                    {['columns', 'sort', 'filter', 'group'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-6 py-3 text-sm font-semibold capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                        >
                            {tab}
                            {(localSettings as any)[tab + 's']?.length > 0 && <span className="ml-2 bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-xs">{(localSettings as any)[tab + 's'].length}</span>}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    {/* COLUMNS */}
                    {activeTab === 'columns' && (
                        <div className="space-y-2">
                            <p className="text-xs text-gray-500 italic mb-4">Drag to reorder. Uncheck to hide.</p>
                            {localSettings.columns.map((col, index) => (
                                <div
                                    key={col.id}
                                    draggable
                                    onDragStart={() => handleDragStart(index)}
                                    onDragOver={handleDragOver}
                                    onDrop={() => handleDrop(index)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-move select-none ${col.visible ? 'bg-white border-gray-200 hover:border-blue-300' : 'bg-gray-50 border-gray-100 opacity-60'} ${draggedItemIndex === index ? 'opacity-50 bg-blue-50 ring-2 ring-blue-200' : ''}`}
                                >
                                    <div className="text-gray-400 cursor-move"><GripVertical size={16} /></div>
                                    <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${col.visible ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}`}>
                                            {col.visible && <Check size={14} className="text-white" />}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={col.visible} onChange={() => toggleCol(col.id)} />
                                        <span className={`text-sm font-medium ${col.visible ? 'text-slate-800' : 'text-slate-500'}`}>{col.label}</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* SORT */}
                    {activeTab === 'sort' && (
                        <div className="space-y-4">
                            {localSettings.sorts.map((sort, idx) => (
                                <div key={sort.id} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
                                    <select className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none" value={sort.columnId} onChange={(e) => updateSort(sort.id, 'columnId', e.target.value)}>
                                        {allColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <div className="flex bg-white rounded border border-gray-300 overflow-hidden">
                                        <button onClick={() => updateSort(sort.id, 'direction', 'asc')} className={`p-2 ${sort.direction === 'asc' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}><ArrowUp size={16} /></button>
                                        <div className="w-px bg-gray-300"></div>
                                        <button onClick={() => updateSort(sort.id, 'direction', 'desc')} className={`p-2 ${sort.direction === 'desc' ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}><ArrowDown size={16} /></button>
                                    </div>
                                    <button onClick={() => removeSort(sort.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            <button onClick={addSort} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline"><Plus size={16} /> Add Sort Level</button>
                        </div>
                    )}

                    {/* FILTER */}
                    {activeTab === 'filter' && (
                        <div className="space-y-4">
                            {localSettings.filters.map((filter) => (
                                <div key={filter.id} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <select className="w-24 p-2 border border-gray-300 rounded text-sm font-medium outline-none" value={filter.type} onChange={(e) => updateFilter(filter.id, 'type', e.target.value)}>
                                        <option value="include">Include</option>
                                        <option value="exclude">Exclude</option>
                                    </select>
                                    <select className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none" value={filter.columnId} onChange={(e) => updateFilter(filter.id, 'columnId', e.target.value)}>
                                        {allColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <select className="w-32 p-2 border border-gray-300 rounded text-sm outline-none" value={filter.operator} onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}>
                                        <option value="contains">Contains</option>
                                        <option value="equals">Equals</option>
                                        <option value="greater">Greater (&gt;)</option>
                                        <option value="less">Less (&lt;)</option>
                                        <option value="between">Between</option>
                                    </select>

                                    {filter.operator === 'between' ? (
                                        <div className="flex gap-2 w-full md:w-auto">
                                            <input type="text" className="w-24 p-2 border border-gray-300 rounded text-sm outline-none" placeholder="From" value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} />
                                            <input type="text" className="w-24 p-2 border border-gray-300 rounded text-sm outline-none" placeholder="To" value={filter.value2 || ''} onChange={(e) => updateFilter(filter.id, 'value2', e.target.value)} />
                                        </div>
                                    ) : (
                                        <input type="text" className="flex-1 p-2 border border-gray-300 rounded text-sm min-w-[150px] outline-none" placeholder="Value..." value={filter.value} onChange={(e) => updateFilter(filter.id, 'value', e.target.value)} />
                                    )}

                                    <button onClick={() => removeFilter(filter.id)} className="p-2 text-red-500 hover:bg-red-50 rounded self-end md:self-auto"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            <button onClick={addFilter} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline"><Plus size={16} /> Add Filter</button>
                        </div>
                    )}

                    {/* GROUP */}
                    {activeTab === 'group' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 italic">Group rows by column. The order determines nesting.</p>
                            {localSettings.groups.map((group, idx) => (
                                <div key={group.id} className="flex gap-3 items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <span className="text-xs font-bold text-gray-400 w-16">Level {idx + 1}</span>
                                    <select className="flex-1 p-2 border border-gray-300 rounded text-sm outline-none" value={group.columnId} onChange={(e) => updateGroup(group.id, e.target.value)}>
                                        {allColumns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                    </select>
                                    <button onClick={() => removeGroup(group.id)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            <button onClick={addGroup} className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline"><Plus size={16} /> Add Grouping</button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors">OK</button>
                </div>
            </div>
        </div>
    );
};