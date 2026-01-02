import { useState, useMemo } from 'react';
import { ViewSettings, ColumnDef, ProcessedRow } from '../types/table';

// Helper: Pulisce e normalizza i valori per confronti sicuri
const safeString = (val: any) => {
    if (val === null || val === undefined) return '';
    return String(val).trim().toLowerCase();
};

export function useTableLogic<T>(
    data: T[],
    initialColumns: ColumnDef[],
    columnFilters: Record<string, string[]> = {}
) {
    const [viewSettings, setViewSettings] = useState < ViewSettings > ({
        columns: initialColumns,
        filters: [],
        sorts: [],
        groups: []
    });

    const processedRows = useMemo(() => {
        let result = [...data];

        // 1. FILTRI
        // A. Header (Quick Filters)
        Object.keys(columnFilters).forEach(colId => {
            const selectedVals = columnFilters[colId];
            if (selectedVals && selectedVals.length > 0) {
                const normalizedSelection = selectedVals.map(v => safeString(v));
                result = result.filter(item => {
                    const valStr = safeString((item as any)[colId]);
                    return normalizedSelection.some(sel => valStr === sel);
                });
            }
        });

        // B. Advanced Filters
        if (viewSettings.filters.length > 0) {
            result = result.filter(item => {
                return viewSettings.filters.every(rule => {
                    const rawVal = (item as any)[rule.columnId];
                    const valStr = safeString(rawVal);
                    const filterStr = safeString(rule.value);
                    const valNum = Number(rawVal);
                    const filterNum = Number(rule.value);
                    const isNum = !isNaN(valNum) && !isNaN(filterNum) && rawVal !== null && rawVal !== '';

                    switch (rule.operator) {
                        case 'contains': return valStr.includes(filterStr);
                        case 'equals': return valStr === filterStr;
                        case 'greater': return isNum ? valNum > filterNum : valStr > filterStr;
                        case 'less': return isNum ? valNum < filterNum : valStr < filterStr;
                        case 'between': return isNum
                            ? (valNum >= filterNum && valNum <= Number(rule.value2))
                            : (valStr >= filterStr && valStr <= safeString(rule.value2));
                        default: return true;
                    }
                }) ? (rule.type === 'include') : (rule.type !== 'include');
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
                    const rawA = (a as any)[rule.columnId];
                    const rawB = (b as any)[rule.columnId];

                    // Gestione Nulls (sempre in fondo)
                    if (rawA === rawB) continue;
                    if (rawA === null || rawA === undefined) return 1;
                    if (rawB === null || rawB === undefined) return -1;

                    let comparison = 0;
                    // Se entrambi sono numeri validi, usa sottrazione
                    if (typeof rawA === 'number' && typeof rawB === 'number') {
                        comparison = rawA - rawB;
                    } else {
                        // Altrimenti usa safeString per confronto alfabetico sicuro
                        const strA = safeString(rawA);
                        const strB = safeString(rawB);
                        comparison = strA.localeCompare(strB);
                    }

                    if (comparison !== 0) {
                        return rule.direction === 'asc' ? comparison : -comparison;
                    }
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
                    if (currentVal !== previousValues[groupCol]) {
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

    }, [data, viewSettings, columnFilters, initialColumns]);

    return { viewSettings, setViewSettings, processedRows, visibleColumns: viewSettings.columns.filter(c => c.visible) };
}