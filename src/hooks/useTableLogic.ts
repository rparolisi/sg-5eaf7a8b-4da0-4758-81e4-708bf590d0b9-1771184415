import { useState, useMemo } from 'react';
import { ViewSettings, ColumnDef, ProcessedRow } from '../types/table';

// Helper per normalizzare i valori (stringhe, numeri, null) per confronti sicuri
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

        // 1A. FILTRI HEADER (Quick Filters)
        Object.keys(columnFilters).forEach(colId => {
            const selectedVals = columnFilters[colId];
            if (selectedVals && selectedVals.length > 0) {
                // Normalizza le selezioni del filtro
                const normalizedSelection = selectedVals.map(v => safeString(v));

                result = result.filter(item => {
                    const rawVal = (item as any)[colId];
                    // Normalizza il valore della cella
                    const valStr = safeString(rawVal);

                    // Verifica se il valore è incluso
                    return normalizedSelection.some(sel => valStr === sel);
                });
            }
        });

        // 1B. FILTRI AVANZATI (Settings Modal)
        if (viewSettings.filters.length > 0) {
            result = result.filter(item => {
                return viewSettings.filters.every(rule => {
                    const rawVal = (item as any)[rule.columnId];

                    const itemValStr = safeString(rawVal);
                    const filterValStr = safeString(rule.value);
                    const filterVal2Str = safeString(rule.value2);

                    const itemValNum = Number(rawVal);
                    const filterValNum = Number(rule.value);
                    const filterVal2Num = Number(rule.value2);

                    const isNumericComparison = !isNaN(itemValNum) && !isNaN(filterValNum) && rawVal !== null && rawVal !== '' && rule.value !== '';

                    let matches = false;

                    switch (rule.operator) {
                        case 'contains': matches = itemValStr.includes(filterValStr); break;
                        case 'equals': matches = itemValStr === filterValStr; break;
                        case 'greater': matches = isNumericComparison ? itemValNum > filterValNum : itemValStr > filterValStr; break;
                        case 'less': matches = isNumericComparison ? itemValNum < filterValNum : itemValStr < filterValStr; break;
                        case 'between':
                            if (isNumericComparison) {
                                const max = !isNaN(filterVal2Num) ? filterVal2Num : Infinity;
                                matches = itemValNum >= filterValNum && itemValNum <= max;
                            } else {
                                matches = itemValStr >= filterValStr && itemValStr <= filterVal2Str;
                            }
                            break;
                        default: matches = true;
                    }
                    return rule.type === 'include' ? matches : !matches;
                });
            });
        }

        // 2 & 3. ORDINAMENTO
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
                    if (typeof valA === 'number' && typeof valB === 'number') comparison = valA - valB;
                    else comparison = String(valA).localeCompare(String(valB));
                    return rule.direction === 'asc' ? comparison : -comparison;
                }
                return 0;
            });
        }

        // 4. RAGGRUPPAMENTO
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
                        rows.push({
                            type: 'group_header',
                            key: groupCol,
                            value: currentVal,
                            level: level,
                            field: initialColumns.find(c => c.id === groupCol)?.label || groupCol
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

    return {
        viewSettings,
        setViewSettings,
        processedRows,
        visibleColumns: viewSettings.columns.filter(c => c.visible)
    };
}