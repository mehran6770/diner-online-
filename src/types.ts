export interface Account {
  id: string;
  name: string;
  accountNumber: string;
  balance: number;
  maturityDate?: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  accountName: string;
  amount: number;
  type: 'deposit' | 'withdraw';
  description: string;
  timestamp: string;
}

export interface BankData {
  accounts: Account[];
  transactions: Transaction[];
}
