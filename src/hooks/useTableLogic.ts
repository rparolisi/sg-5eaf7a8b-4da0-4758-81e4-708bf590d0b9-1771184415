import { useState, useMemo } from 'react';
import { ViewSettings, ColumnDef, ProcessedRow } from '../types/table';

// Helper per pulire i valori prima del confronto
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
        Object.keys(columnFilters).forEach(colId => {
            const selectedVals = columnFilters[colId];
            if (selectedVals && selectedVals.length > 0) {
                // Normalizziamo anche i valori selezionati dal filtro rapido
                const normalizedSelection = selectedVals.map(v => v.trim().toLowerCase());

                result = result.filter(item => {
                    const rawVal = (item as any)[colId];
                    // Se rawVal è numero, lo convertiamo in stringa per cercare nel set
                    const valStr = String(rawVal === null || rawVal === undefined ? '' : rawVal).trim().toLowerCase();

                    // Verifica se il valore della riga è incluso nella selezione
                    // Nota: usiamo include parziale per flessibilità o match esatto
                    return normalizedSelection.some(sel => valStr === sel);
                });
            }
        });

        // 1B. Filtri Avanzati (Settings Modal - Ingranaggio)
        if (viewSettings.filters.length > 0) {
            result = result.filter(item => {
                // Deve soddisfare TUTTE le regole (Logic AND)
                return viewSettings.filters.every(rule => {
                    const rawVal = (item as any)[rule.columnId];

                    // Preparazione valori per confronto Testuale
                    const itemValStr = safeString(rawVal);
                    const filterValStr = safeString(rule.value);
                    const filterVal2Str = safeString(rule.value2);

                    // Preparazione valori per confronto Numerico
                    const itemValNum = Number(rawVal);
                    const filterValNum = Number(rule.value);
                    const filterVal2Num = Number(rule.value2);

                    // Verifica se i valori sono numeri validi per operatori matematici
                    const isItemNum = !isNaN(itemValNum) && rawVal !== null && rawVal !== '';
                    const isFilterNum = !isNaN(filterValNum) && rule.value !== '';

                    let matches = false;

                    switch (rule.operator) {
                        case 'contains':
                            matches = itemValStr.includes(filterValStr);
                            break;
                        case 'equals':
                            // Supporta sia stringhe che numeri (es. prezzo esatto)
                            matches = itemValStr === filterValStr;
                            break;
                        case 'greater':
                            if (isItemNum && isFilterNum) matches = itemValNum > filterValNum;
                            else matches = itemValStr > filterValStr; // Fallback alfabetico
                            break;
                        case 'less':
                            if (isItemNum && isFilterNum) matches = itemValNum < filterValNum;
                            else matches = itemValStr < filterValStr;
                            break;
                        case 'between':
                            if (isItemNum && isFilterNum) {
                                const max = !isNaN(filterVal2Num) ? filterVal2Num : Infinity;
                                matches = itemValNum >= filterValNum && itemValNum <= max;
                            } else {
                                matches = itemValStr >= filterValStr && itemValStr <= filterVal2Str;
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

        // 2. Ordinamento (Sorting)
        // Priorità: Prima ordina per i Gruppi, poi per le regole di Sort utente
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
                    // Confronto numerico se entrambi sono numeri
                    if (typeof valA === 'number' && typeof valB === 'number') {
                        comparison = valA - valB;
                    } else {
                        // Confronto stringa locale (gestisce accenti ecc.)
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
        // Se non ci sono gruppi, restituisci array piatto. Altrimenti crea struttura header/data
        if (groupCols.length === 0) {
            return result.map(item => ({ type: 'data', data: item } as ProcessedRow<T>));
        } else {
            const rows: ProcessedRow<T>[] = [];
            let previousValues: Record<string, any> = {};

            result.forEach((item) => {
                // Controlla cambiamenti nei livelli di gruppo
                groupCols.forEach((groupCol, level) => {
                    const currentVal = (item as any)[groupCol];
                    const prevVal = previousValues[groupCol];

                    // Se il valore cambia rispetto alla riga precedente, inserisci header
                    // Nota: Grazie al sort preventivo, righe uguali sono vicine
                    if (currentVal !== prevVal) {
                        // Trova label colonna per display (es. "Ticker: AAPL")
                        const colDef = initialColumns.find(c => c.id === groupCol);

                        rows.push({
                            type: 'group_header',
                            key: groupCol,
                            value: currentVal,
                            level: level,
                            field: colDef ? colDef.label : groupCol
                        });

                        // Aggiorna valore corrente
                        previousValues[groupCol] = currentVal;

                        // Reset dei livelli più profondi (se cambia il padre, i figli sono nuovi anche se hanno stesso valore di prima)
                        for (let l = level + 1; l < groupCols.length; l++) {
                            delete previousValues[groupCols[l]];
                        }
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