

export interface Employee {
  id: string; // Will use Cédula for this for the new employee
  cedula: string;
  name: string;
  email: string;
  department: string;
  role: string;
  salary: number; // Monthly base salary
  bankAccountNumber: string;
  bankName: string; // Added field for bank name
  hireDate: string; 
}

export interface Deduction {
  name: string;
  amount: number;
}

export interface Payslip {
  id: string;
  employeeId: string; // Corresponds to Employee's Cédula/id
  employeeName: string;
  employeeEmail?: string; // Added: To store employee's email for sending
  employeeCedula?: string; // Optional: To display on payslip if needed
  payrollRunId: string;
  payPeriod: string; // e.g., "July 2024 - 1st Fortnight"
  baseSalary: number; // Fortnightly base salary (monthly / 2)
  overtimeHours: number;
  overtimePay: number;
  totalEarnings: number; // baseSalary + overtimePay for the fortnight
  deductions: Deduction[]; // AFP, SFS, ISR
  netSalary: number; // Final net salary
  generatedDate: string;
}

export enum PayrollRunStatus {
  PENDING = "Pending",
  PROCESSING = "Processing",
  COMPLETED = "Completed",
  FAILED = "Failed",
}

export interface PayrollRun {
  id: string;
  payPeriod: string; // e.g., "July 2024 - 1st Fortnight"
  status: PayrollRunStatus;
  totalAmount: number; // Sum of net salaries for this run
  employeesProcessed: number;
  processingDate?: string;
  payslipsGenerated: Payslip[];
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

// New types for Subagents Module
export enum SubagentPaymentModel {
  PER_CONDUCE_DOCUMENT = "Pago por Conduce",
  MONTHLY_AGGREGATE_WEIGHT = "Peso Agregado Mensual",
}

export interface Subagent {
  id: string; // auto-generated
  code: string; // e.g., "BS1", "C01" - User-provided unique identifier
  name: string;
  paymentModel: SubagentPaymentModel;
  ratePerPound: number; // DOP
  locationOrNotes?: string; // e.g., "SAN VICTOR", "Paga por conduces"
}

export interface ConduceDocument {
  id: string; // auto-generated
  subagentId: string; // links to Subagent.id
  conduceIdentifier: string; // User-entered ID for the physical conduce paper or date-based
  date: string; // ISO date string

  paymentType: 'calculated' | 'direct'; // How the payment amount is determined
  totalWeightPounds?: number; // Optional, primarily for 'calculated' type
  directPaymentAmount?: number; // Used if paymentType is 'direct'
  notes?: string; // Optional notes for the specific conduce

  calculatedPayment: number; // Final amount to be paid, derived from calculation or direct input

  paymentRunId?: string; // links to SubagentMonthlyPayment.id once paid
  isPaid: boolean;
  numberOfPackages?: number; // Optional: Number of packages in the conduce
  declaredValue?: number; // Optional: Declared value of the packages in the conduce (DOP)
}

// New type for AI-extracted conduces from image
export interface ExtractedConduce {
  fecha?: string;
  peso?: number;
  paquetes?: number;
  monto?: number;
  [key: string]: any; // Allow for other columns the AI might find
}

export interface SubagentMonthlyPayment {
  id: string; // auto-generated
  subagentId: string;
  monthYear: string; // e.g., "2024-08" for August 2024
  totalAmountPaid: number; // DOP
  conduceDocIdsIncluded?: string[]; // Array of ConduceDocument.id, if paymentModel is PER_CONDUCE_DOCUMENT
  totalWeightForMonth?: number; // if paymentModel is MONTHLY_AGGREGATE_WEIGHT
  processingDate: string; // ISO date string
  paymentVoucherImage?: string; // Base64 encoded image data URL
  voucherFileName?: string; // Original name of the uploaded voucher file
}

// Types for Monthly Financial Report
export interface ReportExpenseItem {
  id: string; // auto-generated
  remark: string;
  amount: number;
  isAutomatic?: boolean; // True if aggregated from payroll/subagents
  category?: 'payroll' | 'subagents' | 'manual'; // Helps in grouping or identifying source
}

export interface ReportIncomeItem {
  id: string; // auto-generated
  source: string; // e.g., "PAQUETERIA LOCAL", "GANANCIA PAQUETERIA COURRIER"
  amount: number;
}

export interface ManualReportEntry {
  expenses: ReportExpenseItem[];
  incomes: ReportIncomeItem[];
  manualPoundsForSelectedYear?: Record<string, number | ''>; // Key: "Enero", "Febrero", etc. Value: pounds
}

// Types for Mi Heladito Monthly Financial Report
export interface MiHeladitoReportEntry {
  expenses: ReportExpenseItem[]; // Reusing ReportExpenseItem, ensuring category is 'manual'
  incomes: ReportIncomeItem[];   // Reusing ReportIncomeItem
  investmentPurchases?: ReportExpenseItem[]; // New field for investment purchases
}

// Types for Mi Heladito Payroll
export enum MiHeladitoWorkerType {
  PART_TIME = "Medio Tiempo", // e.g., monthly salary pro-rated by days
  CONTRACTOR = "Pago Fijo", // e.g., fixed payment for a specific task/period
}

export interface MiHeladitoWorker {
  id: string; // auto-generated
  name: string;
  workerType: MiHeladitoWorkerType;
  baseAmount: number; // Monthly salary for Part-Time, Fixed payment for Contractor
}

export interface MiHeladitoPayslip {
  id: string; // auto-generated
  payrollRunId: string;
  workerId: string;
  workerName: string;
  workerType: MiHeladitoWorkerType;
  payPeriod: string; // "YYYY-MM"
  
  // For PART_TIME
  daysWorked?: number; 
  baseMonthlySalary?: number;

  // Final calculated amount
  netPayment: number;
}

export interface MiHeladitoPayrollRun {
  id: string; // auto-generated
  payPeriod: string; // e.g., "Agosto 2024"
  status: PayrollRunStatus; // Re-using from main payroll
  totalAmountPaid: number;
  payslips: MiHeladitoPayslip[];
  processingDate: string; // ISO date string
}


// Types for Fuel Expense Report
export enum FuelType {
  GASOLINA_REGULAR = "Gasolina Regular",
  GASOLINA_PREMIUM = "Gasolina Premium",
  DIESEL = "Diesel",
  GAS_GLP = "Gas GLP",
}

export interface RouteSegment {
  id: string; // for UI key e.g., `segment-${Date.now()}`
  description: string;
  startKmOdometer: number;
  endKmOdometer: number;
  segmentKm: number; // Calculated: endKmOdometer - startKmOdometer
}

export interface FuelLogEntry {
  id:string;
  date: string; // Date of the log entry / end of trip
  vehicle: string;
  segments: RouteSegment[]; // List of segments for this trip/log period

  // Calculated from segments
  totalKilometersThisLog: number;

  // Refueling details (if refueling happened at the end of this period)
  refueledThisLog: boolean;
  gallonsAdded?: number; // Gallons added in this refueling
  totalFuelCost?: number; // Cost of this refueling
  costPerGallon?: number; // Calculated or entered
  fuelType?: FuelType;
  hasInvoice?: boolean;
  invoiceNumber?: string;
  invoiceImage?: string; // Base64
  invoiceFileName?: string;

  // Efficiency for this log period (if refueledThisLog is true)
  // Calculated as: totalKilometersThisLog / gallonsAdded
  efficiencyKmpg?: number;

  notes?: string;
}

// Types for Bank Transactions Module
export enum ExpenseCategory {
  PAGO_SUBAGENTE = "Pago subagente",
  NOMINA = "Nómina",
  IMPUESTOS = "Impuestos",
  PAGO_OFICINA = "Pago oficina",
  INTERNET = "Internet",
  LUZ = "Luz",
  FLOTA = "Flota",
  PAGO_CONDUCE = "Pago conduce",
  OTRO = "Otro",
}

export interface BankTransaction {
  id: string;
  date: string; // ISO date string
  referenceNumber: string;
  description: string;
  code: string; // New field for the value from 4th line of pasted data
  debit: number | null;
  credit: number | null;
  balance: number;
  comment: string;
  isDebit: boolean; // Derived: true if debit > 0
  category?: ExpenseCategory; // Optional: For expense categorization
  customCategory?: string; // Optional: If category is "Otro"
}

// Type for Authentication
export interface AppUser {
  username: string;
  password: string;
  name: string;
  permissions: 'all' | 'mi_heladito_only';
}

// Types for Accounts Receivable
export interface Debtor {
  id: string;
  name: string;
}

export interface Receivable {
  id: string;
  debtorId: string;
  date: string; // ISO date string
  amount: number;
  isPaid: boolean;
}

// Types for Loans Module
export interface Loan {
  id: string;
  name: string;
  lender: string;
  initialAmount: number;
  monthlyPaymentAmount: number; // cuota fija
  monthlyInterestAmount: number; // interés fijo
  startDate: string; // ISO date string
}

export interface LoanPayment {
  id: string;
  loanId: string;
  paymentDate: string; // ISO date string
  amountPaid: number;
  principalPaid: number;
  interestPaid: number;
  remainingBalance: number;
  notes?: string;
}
