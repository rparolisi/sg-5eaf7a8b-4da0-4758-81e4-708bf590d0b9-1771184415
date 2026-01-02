import { useState, useMemo } from 'react';
import { ViewSettings, ColumnDef, ProcessedRow } from '../types/table';

const applyColumnFilters = (
    rows: any[],
    columnFilters: Record<string, string[]>
) => {
    return rows.filter(row =>
        Object.entries(columnFilters).every(([colId, values]) => {
            // Nessun filtro su questa colonna
            if (!values || values.length === 0) return true;

            const cellValue = row[colId];

            // Se il valore è nullo, non passa
            if (cellValue === null || cellValue === undefined) return false;

            // MATCH ESATTO (NON contains!)
            return values.includes(String(cellValue));
        })
    );
};


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
        let rows = [...rawData];

        // 1️⃣ FILTRI HEADER (Ticker, Person, ecc.)
        rows = applyColumnFilters(rows, columnFilters);

        // 2️⃣ FILTRI AVANZATI (TableSettingsModal)
        if (viewSettings.filters.length > 0) {
            rows = rows.filter(row =>
                viewSettings.filters.every(f => {
                    const val = row[f.columnId];
                    if (val === null || val === undefined) return false;

                    const strVal = String(val).toLowerCase();
                    const filterVal = String(f.value).toLowerCase();

                    switch (f.operator) {
                        case 'equals':
                            return strVal === filterVal;

                        case 'contains':
                            return strVal.includes(filterVal);

                        case 'greater':
                            return Number(val) > Number(f.value);

                        case 'less':
                            return Number(val) < Number(f.value);

                        case 'between':
                            return (
                                Number(val) >= Number(f.value) &&
                                Number(val) <= Number(f.value2)
                            );

                        default:
                            return true;
                    }
                })
            );
        }

        // 3️⃣ SORT
        if (viewSettings.sorts.length > 0) {
            rows = [...rows].sort((a, b) => {
                for (const s of viewSettings.sorts) {
                    const av = a[s.columnId];
                    const bv = b[s.columnId];
                    if (av === bv) continue;

                    return s.direction === 'asc'
                        ? av > bv ? 1 : -1
                        : av < bv ? 1 : -1;
                }
                return 0;
            });
        }

        // 4️⃣ GROUP (alla fine!)
        if (viewSettings.groups.length > 0) {
            return applyGrouping(rows, viewSettings.groups);
        }

        // Se non ci sono group
        return rows.map(r => ({ type: 'data', data: r }));
    }, [rawData, columnFilters, viewSettings]);


    return {
        viewSettings,
        setViewSettings,
        processedRows,
        visibleColumns: viewSettings.columns.filter(c => c.visible)
    };
}