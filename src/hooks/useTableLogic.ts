import { useState, useMemo } from 'react';
import { ViewSettings, ColumnDef, ProcessedRow } from '../types/table';

// Helper: Pulisce e normalizza i valori per confronti sicuri
const safeString = (val: any) => {
    if (val === null || val === undefined) return '';
    // Converte oggetti/array in stringa se necessario, altrimenti stringa standard
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return str.trim().toLowerCase();
};

export function useTableLogic<T>(
    data: T[],
    initialColumns: ColumnDef[]
) {
    const [viewSettings, setViewSettings] = useState < ViewSettings > ({
        columns: initialColumns,
        filters: [],
        sorts: [],
        groups: []
    });

    const processedRows = useMemo(() => {
        let result = [...data];

        // 1. FILTRI AVANZATI (Settings Modal)
        if (viewSettings.filters.length > 0) {
            console.log("--- DEBUG FILTER ---"); // DEBUG
            result = result.filter(item => {
                return viewSettings.filters.every(rule => {
                    const rawVal = (item as any)[rule.columnId];

                    const itemValStr = safeString(rawVal);
                    const filterValStr = safeString(rule.value);

                    // Log per capire cosa stiamo confrontando
                    // console.log(`Checking ${rule.columnId}: '${itemValStr}' vs '${filterValStr}' (${rule.operator})`);

                    const itemValNum = Number(rawVal);
                    const filterValNum = Number(rule.value);
                    const filterVal2Num = Number(rule.value2);

                    // Verifica se è un confronto numerico valido
                    const isNum = !isNaN(itemValNum) && !isNaN(filterValNum) && rawVal !== null && rawVal !== '' && rule.value !== '';

                    let matches = false;

                    switch (rule.operator) {
                        case 'contains':
                            matches = itemValStr.includes(filterValStr);
                            break;
                        case 'equals':
                            matches = itemValStr === filterValStr;
                            break;
                        case 'greater':
                            matches = isNum ? itemValNum > filterValNum : itemValStr > filterValStr;
                            break;
                        case 'less':
                            matches = isNum ? itemValNum < filterValNum : itemValStr < filterValStr;
                            break;
                        case 'between':
                            if (isNum) {
                                const max = !isNaN(filterVal2Num) ? filterVal2Num : Infinity;
                                matches = itemValNum >= filterValNum && itemValNum <= max;
                            } else {
                                matches = itemValStr >= filterValStr && itemValStr <= safeString(rule.value2);
                            }
                            break;
                        default:
                            matches = true;
                    }

                    // Logica Include/Exclude
                    return rule.type === 'include' ? matches : !matches;
                });
            });
        }

        // 2. ORDINAMENTO
        // Priorità: Gruppi > Sort Utente
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

    return {
        viewSettings,
        setViewSettings,
        processedRows,
        visibleColumns: viewSettings.columns.filter(c => c.visible)
    };
}