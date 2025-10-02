

import { 
    Employee, PayrollRun, Subagent, ConduceDocument, SubagentMonthlyPayment, 
    ManualReportEntry, MiHeladitoReportEntry, FuelLogEntry, BankTransaction, 
    MiHeladitoWorker, MiHeladitoPayrollRun, Debtor, Receivable
} from '../types';
import { 
    MOCK_EMPLOYEES, MOCK_PAYROLL_RUNS, MOCK_SUBAGENTS, MOCK_CONDUCE_DOCUMENTS, 
    MOCK_MI_HELADITO_WORKERS 
} from '../constants';

// --- Configuration ---
const SIMULATED_NETWORK_DELAY = 250; // ms
const collectionsWithMocks: Record<string, any[]> = {
    'gdp_employees': MOCK_EMPLOYEES,
    'gdp_payrollRuns': MOCK_PAYROLL_RUNS,
    'gdp_subagents': MOCK_SUBAGENTS,
    'gdp_conduceDocuments': MOCK_CONDUCE_DOCUMENTS,
    'gdp_miHeladitoWorkers': MOCK_MI_HELADITO_WORKERS,
    'gdp_subagentMonthlyPayments': [],
    'gdp_fuelLogEntries': [],
    'gdp_bankTransactions': [],
    'gdp_miHeladitoPayrollRuns': [],
    'gdp_debtors': [{id: 'debtor-jamao', name: 'JAMAO'}],
    'gdp_receivables': [
        { id: 'rec-001', debtorId: 'debtor-jamao', date: '2025-06-05', amount: 4028.77, isPaid: false },
        { id: 'rec-002', debtorId: 'debtor-jamao', date: '2025-06-10', amount: 3233.79, isPaid: false },
        { id: 'rec-003', debtorId: 'debtor-jamao', date: '2025-06-14', amount: 4337.95, isPaid: false },
        { id: 'rec-004', debtorId: 'debtor-jamao', date: '2025-06-20', amount: 2296.83, isPaid: false },
    ],
    'gdp_loans': [],
    'gdp_loanPayments': [],
};
const objectStores = {
    'gdp_manualReportEntries': {},
    'gdp_miHeladitoReportEntries': {},
};


// --- Helper Functions ---
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const getCollection = <T>(key: string): T[] => {
    try {
        const stored = localStorage.getItem(key);
        if (stored) return JSON.parse(stored);
        
        const mockData = collectionsWithMocks[key] || [];
        localStorage.setItem(key, JSON.stringify(mockData));
        return mockData;
    } catch (e) {
        console.error(`Error reading collection ${key}:`, e);
        const mockData = collectionsWithMocks[key] || [];
        localStorage.setItem(key, JSON.stringify(mockData));
        return mockData;
    }
};

const getObjectStore = <T extends object>(key: string): T => {
    try {
        const stored = localStorage.getItem(key);
        if (stored) return JSON.parse(stored);
        
        const mockData = objectStores[key as keyof typeof objectStores] || {};
        localStorage.setItem(key, JSON.stringify(mockData));
        return mockData as T;
    } catch (e) {
        console.error(`Error reading object store ${key}:`, e);
        const mockData = objectStores[key as keyof typeof objectStores] || {};
        localStorage.setItem(key, JSON.stringify(mockData));
        return mockData as T;
    }
}

const setCollection = <T>(key: string, data: T[]): void => {
    localStorage.setItem(key, JSON.stringify(data));
};

const setObjectStore = <T extends object>(key: string, data: T): void => {
    localStorage.setItem(key, JSON.stringify(data));
}

// --- Generic API Service ---
export const api = {
    fetchAll: async <T>(key: string): Promise<T[]> => {
        await delay(SIMULATED_NETWORK_DELAY);
        return getCollection<T>(key);
    },

    saveNew: async <T extends { id: string }>(key: string, itemData: Omit<T, 'id'>): Promise<T> => {
        await delay(SIMULATED_NETWORK_DELAY);
        const collection = getCollection<T>(key);
        const idPrefix = key.replace('gdp_', '').slice(0, 4);
        const newItem = { ...itemData, id: `${idPrefix}-${Date.now()}` } as T;
        const updatedCollection = [...collection, newItem];
        setCollection(key, updatedCollection);
        return newItem;
    },
    
    update: async <T extends { id: string }>(key: string, updatedItem: T): Promise<T> => {
        await delay(SIMULATED_NETWORK_DELAY);
        const collection = getCollection<T>(key);
        const updatedCollection = collection.map(item => item.id === updatedItem.id ? updatedItem : item);
        setCollection(key, updatedCollection);
        return updatedItem;
    },

    delete: async <T extends { id: string }>(key: string, itemId: string): Promise<{ id: string }> => {
        await delay(SIMULATED_NETWORK_DELAY);
        const collection = getCollection<T>(key);
        const updatedCollection = collection.filter(item => item.id !== itemId);
        setCollection(key, updatedCollection);
        return { id: itemId };
    },

    batchUpdate: async <T extends { id: string }>(key: string, updates: Partial<T> & { id: string }[]): Promise<void> => {
        await delay(SIMULATED_NETWORK_DELAY);
        let collection = getCollection<T>(key);
        updates.forEach(update => {
            collection = collection.map(item => item.id === update.id ? { ...item, ...update } : item);
        });
        setCollection(key, collection);
    },
    
    // --- Special Object Store Handlers ---
    fetchObjectStore: async <T extends object>(key: string): Promise<T> => {
        await delay(SIMULATED_NETWORK_DELAY);
        return getObjectStore<T>(key);
    },

    updateObjectStore: async <T extends object>(key: string, updatedData: T): Promise<T> => {
        await delay(SIMULATED_NETWORK_DELAY);
        setObjectStore(key, updatedData);
        return updatedData;
    }
};