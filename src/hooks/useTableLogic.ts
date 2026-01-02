import { useState, useMemo, useEffect } from 'react';
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
    initialPageSize: number = 25
) {
    // --- STATI ---
    const [viewSettings, setViewSettings] = useState < ViewSettings > ({
        columns: initialColumns,
        filters: [],
        sorts: [],
        groups: []
    });

    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: initialPageSize
    });

    // Reset pagina a 1 se cambiano filtri
    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
    }, [viewSettings.filters, viewSettings.groups, data]);

    // --- 1. FILTRARE, ORDINARE E RAGGRUPPARE (Logica esistente) ---
    const processedRows = useMemo(() => {
        let result = [...data];

        // A. Filtri
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

        // B. Ordinamento
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
                    else comparison = safeString(valA).localeCompare(safeString(valB));

                    if (comparison !== 0) return rule.direction === 'asc' ? comparison : -comparison;
                }
                return 0;
            });
        }

        // C. Raggruppamento
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

    // --- 2. PAGINAZIONE (Per la visualizzazione a schermo) ---
    const paginatedRows = useMemo(() => {
        const start = (pagination.page - 1) * pagination.pageSize;
        return processedRows.slice(start, start + pagination.pageSize);
    }, [processedRows, pagination]);

    // --- 3. PREPARAZIONE EXPORT (Nuova logica per tutte le tabelle) ---
    const exportableRows = useMemo(() => {
        // Prende solo le colonne visibili
        const visibleCols = viewSettings.columns.filter(c => c.visible);

        // Prende tutte le righe di dati (escludendo header dei gruppi)
        return processedRows
            .filter(r => r.type === 'data')
            .map((r: any) => {
                const item = r.data;
                const exportRow: Record<string, any> = {};

                // Crea un nuovo oggetto usando l'etichetta (Label) come chiave
                visibleCols.forEach(col => {
                    // Mappa: Chiave (Excel Header) -> Valore
                    exportRow[col.label] = item[col.id];
                });

                return exportRow;
            });
    }, [processedRows, viewSettings.columns]);

    return {
        viewSettings,
        setViewSettings,
        paginatedRows,     // Dati paginati per la UI
        allFilteredRows: processedRows, // Dati grezzi filtrati per calcoli
        exportableRows,    // NUOVO: Dati pronti per l'export (solo colonne visibili)
        visibleColumns: viewSettings.columns.filter(c => c.visible),
        pagination,
        setPagination,
        totalRows: processedRows.length,
        totalPages: Math.ceil(processedRows.length / pagination.pageSize)
    };
}