// src/hooks/useTableLogic.ts

import { useState, useMemo } from 'react';
import { ViewSettings, ColumnDef, ProcessedRow } from '../types/table';

const safeString = (val: any) => val === null || val === undefined ? '' : String(val);

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

        // 1A. Filtri Header (Quick)
        Object.keys(columnFilters).forEach(colId => {
            const selectedVals = columnFilters[colId];
            if (selectedVals && selectedVals.length > 0) {
                result = result.filter(item => {
                    const val = (item as any)[colId];
                    return selectedVals.includes(safeString(val));
                });
            }
        });

        // 1B. Filtri Avanzati (Modal)
        if (viewSettings.filters.length > 0) {
            result = result.filter(item => {
                return viewSettings.filters.every(rule => {
                    const val = (item as any)[rule.columnId];
                    if (val === undefined || val === null) return false;

                    const valStr = String(val).toLowerCase();
                    const filterVal = rule.value.toLowerCase();
                    const numVal = Number(val);
                    const filterNum = Number(rule.value);

                    let matches = false;
                    switch (rule.operator) {
                        case 'contains': matches = valStr.includes(filterVal); break;
                        case 'equals': matches = valStr === filterVal; break;
                        case 'greater': matches = numVal > filterNum; break;
                        case 'less': matches = numVal < filterNum; break;
                        case 'between':
                            const filterNum2 = Number(rule.value2);
                            matches = numVal >= filterNum && numVal <= filterNum2;
                            break;
                    }
                    return rule.type === 'include' ? matches : !matches;
                });
            });
        }

        // 2 & 3. Ordinamento (Include Group Columns per priorità)
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
                    if (valA === null) return 1;
                    if (valB === null) return -1;

                    let comparison = 0;
                    if (typeof valA === 'number' && typeof valB === 'number') comparison = valA - valB;
                    else comparison = String(valA).localeCompare(String(valB));

                    return rule.direction === 'asc' ? comparison : -comparison;
                }
                return 0;
            });
        }

        // 4. Strutturazione (Grouping)
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