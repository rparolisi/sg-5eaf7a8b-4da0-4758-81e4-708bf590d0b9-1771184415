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

        // 1A. Filtri Header (Quick Filters - Imbuto)
        // Questi sono sempre "OR" tra i valori selezionati (es. "Ticker è A o B")
        Object.keys(columnFilters).forEach(colId => {
            const selectedVals = columnFilters[colId];
            if (selectedVals && selectedVals.length > 0) {
                const normalizedSelection = selectedVals.map(v => safeString(v));

                result = result.filter(item => {
                    const rawVal = (item as any)[colId];
                    const valStr = safeString(rawVal);
                    return normalizedSelection.some(sel => valStr === sel);
                });
            }
        });

        // 1B. Filtri Avanzati (Settings Modal - Ingranaggio)
        // Questi sono "AND" tra le regole (es. "Ticker contiene A" E "Price > 10")
        if (viewSettings.filters.length > 0) {
            result = result.filter(item => {
                return viewSettings.filters.every(rule => {
                    const rawVal = (item as any)[rule.columnId];

                    // Preparazione valori (Stringa vs Numero)
                    const itemValStr = safeString(rawVal);
                    const filterValStr = safeString(rule.value);
                    const filterVal2Str = safeString(rule.value2);

                    const itemValNum = Number(rawVal);
                    const filterValNum = Number(rule.value);
                    const filterVal2Num = Number(rule.value2);

                    // È un confronto numerico valido?
                    const isNumericComparison = !isNaN(itemValNum) && !isNaN(filterValNum) && rawVal !== null && rawVal !== '' && rule.value !== '';

                    let matches = false;

                    switch (rule.operator) {
                        case 'contains':
                            matches = itemValStr.includes(filterValStr);
                            break;
                        case 'equals':
                            // Usa confronto stringa normalizzato per precisione
                            matches = itemValStr === filterValStr;
                            break;
                        case 'greater':
                            if (isNumericComparison) matches = itemValNum > filterValNum;
                            else matches = itemValStr > filterValStr;
                            break;
                        case 'less':
                            if (isNumericComparison) matches = itemValNum < filterValNum;
                            else matches = itemValStr < filterValStr;
                            break;
                        case 'between':
                            if (isNumericComparison) {
                                const max = !isNaN(filterVal2Num) ? filterVal2Num : Infinity;
                                matches = itemValNum >= filterValNum && itemValNum <= max;
                            } else {
                                matches = itemValStr >= filterValStr && itemValStr <= filterVal2Str;
                            }
                            break;
                        default:
                            matches = true;
                    }

                    return rule.type === 'include' ? matches : !matches;
                });
            });
        }

        // 2. Ordinamento (Sorting)
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
                        comparison = String(valA).localeCompare(String(valB));
                    }

                    if (comparison !== 0) {
                        return rule.direction === 'asc' ? comparison : -comparison;
                    }
                }
                return 0;
            });
        }

        // 3. Strutturazione (Grouping)
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
                        // Trova la label della colonna per l'header del gruppo
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

    return {
        viewSettings,
        setViewSettings,
        processedRows,
        visibleColumns: viewSettings.columns.filter(c => c.visible)
    };
}