// src/types/table.ts

export type FilterOperator = 'contains' | 'equals' | 'greater' | 'less' | 'between';
export type FilterType = 'include' | 'exclude';

export interface FilterRule {
    id: string;
    columnId: string;
    type: FilterType;
    operator: FilterOperator;
    value: string;
    value2?: string;
}

export interface SortRule {
    id: string;
    columnId: string;
    direction: 'asc' | 'desc';
}

export interface GroupRule {
    id: string;
    columnId: string;
}

export interface ColumnDef {
    id: string;
    label: string;
    visible: boolean;
    width: number;
    type: 'text' | 'number' | 'date';
    align: 'left' | 'right' | 'center';
}

export interface ViewSettings {
    columns: ColumnDef[];
    filters: FilterRule[];
    sorts: SortRule[];
    groups: GroupRule[];
}

export type ProcessedRow<T> =
    | { type: 'data', data: T }
    | { type: 'group_header', key: string, value: any, level: number, field: string };