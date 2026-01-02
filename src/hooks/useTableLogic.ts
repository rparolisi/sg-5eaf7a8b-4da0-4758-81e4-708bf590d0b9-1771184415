// src/hooks/useTableLogic.ts

import { useState, useMemo, useEffect } from 'react'; // Aggiungi useEffect
import { ViewSettings, ColumnDef, ProcessedRow } from '../types/table';

// Helper: Pulisce e normalizza i valori per confronti sicuri
const safeString = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return str.trim().toLowerCase();
};

export function useTableLogic<T>(
    data: T[],
    initialColumns: ColumnDef[],
    initialPageSize: number = 25 // Nuova prop default
) {
    // --- STATI ESISTENTI ---
    const [viewSettings, setViewSettings] = useState < ViewSettings > ({
        columns: initialColumns,
        filters: [],
        sorts: [],
        groups: []
    });

    // --- NUOVO STATO PAGINAZIONE ---
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: initialPageSize
    });

    // Reset pagina a 1 se cambiano filtri o raggruppamenti
    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [viewSettings.filters, viewSettings.groups, data]);

    const processedRows = useMemo(() => {
        let result = [...data];

        // 1. FILTRI AVANZATI
        if (viewSettings.filters.length > 0) {
            result = result.filter(item => {
                return viewSettings.filters.every(rule => {
                    const rawVal = (item as any)[rule.columnId];
                    const itemValStr = safeString(rawVal);
                    const filterValStr = safeString(rule.value);
                    const itemValNum = Number(rawVal);
                    const filterValNum = Number(rule.value);
                    const filterVal2Num = Number(rule.value2);
                    const isNum = !isNaN(itemValNum) && !isNaN(filterValNum) && rawVal !== null && rawVal !== '' && rule.value !== '';

                    let matches = false;
                    switch (rule.operator) {
                        case 'contains': matches = itemValStr.includes(filterValStr); break;
                        case 'equals': matches = itemValStr === filterValStr; break;
                        case 'greater': matches = isNum ? itemValNum > filterValNum : itemValStr > filterValStr; break;
                        case 'less': matches = isNum ? itemValNum < filterValNum : itemValStr < filterValStr; break;
                        case 'between':
                            if (isNum) {
                                const max = !isNaN(filterVal2Num) ? filterVal2Num : Infinity;
                                matches = itemValNum >= filterValNum && itemValNum <= max;
                            } else {
                                matches = itemValStr >= filterValStr && itemValStr <= safeString(rule.value2);
                            }
                            break;
                        default: matches = true;
                    }
                    return rule.type === 'include' ? matches : !matches;
                });
            });
        }

        // 2. ORDINAMENTO
        const groupCols = viewSettings.groups.map(g => g.columnId);
        const sortRules = [
            ...groupCols.map(col => ({ columnId: col, direction: 'asc' as const })),
            ...viewSettings.sorts
        ];

        if (sortRules.length > 0) {
            result.sort((a, b) => {
                for (const rule of sortRules) {
                    const valA = (a as any)[rule.columnId];
                    const valB = (b as any)[rule.columnId];
                    if (valA === valB) continue;
                    if (valA === null || valA === undefined) return 1;
                    if (valB === null || valB === undefined) return -1;
                    let comparison = 0;
                    if (typeof valA === 'number' && typeof valB === 'number') {
                        comparison = valA - valB;
                    } else {
                        comparison = safeString(valA).localeCompare(safeString(valB));
                    }
                    if (comparison !== 0) return rule.direction === 'asc' ? comparison : -comparison;
                }
                return 0;
            });
        }

        // 3. RAGGRUPPAMENTO
        if (groupCols.length === 0) {
            return result.map(item => ({ type: 'data', data: item } as ProcessedRow<T>));
        } else {
            const rows: ProcessedRow<T>[] = [];
            let previousValues: Record<string, any> = {};
            result.forEach((item) => {
                groupCols.forEach((groupCol, level) => {
                    const currentVal = (item as any)[groupCol];
                    const prevVal = previousValues[groupCol];
                    if (currentVal !== prevVal) {
                        const colDef = initialColumns.find(c => c.id === groupCol);
                        rows.push({
                            type: 'group_header',
                            key: groupCol,
                            value: currentVal,
                            level: level,
                            field: colDef ? colDef.label : groupCol
                        });
                        previousValues[groupCol] = currentVal;
                        for (let l = level + 1; l < groupCols.length; l++) delete previousValues[groupCols[l]];
                    }
                });
                rows.push({ type: 'data', data: item });
            });
            return rows;
        }
    }, [data, viewSettings, initialColumns]);

    // 4. PAGINAZIONE (Calcolata sui processedRows finali)
    const paginatedRows = useMemo(() => {
        const start = (pagination.page - 1) * pagination.pageSize;
        return processedRows.slice(start, start + pagination.pageSize);
    }, [processedRows, pagination]);

    return {
        viewSettings,
        setViewSettings,
        // Restituisci paginatedRows per la tabella visualizzata
        paginatedRows,
        // Restituisci processedRows per l'export (così scarichi tutto il filtrato, non solo la pagina)
        allFilteredRows: processedRows,
        visibleColumns: viewSettings.columns.filter(c => c.visible),
        // Nuovi ritorni per la paginazione
        pagination,
        setPagination,
        totalRows: processedRows.length,
        totalPages: Math.ceil(processedRows.length / pagination.pageSize)
    };
}