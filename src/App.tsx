/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import confetti from 'canvas-confetti';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Users,
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Edit2, 
  Check, 
  X,
  CreditCard,
  Banknote,
  Search,
  Settings,
  ShieldCheck,
  Calendar,
  Dices,
  RotateCw,
  Menu,
  LogIn,
  LogOut,
  Trash2,
  Trophy,
  Sparkles,
  Zap,
  Target,
  Download,
  FileJson
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  doc, 
  setDoc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDoc,
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { db, auth } from './firebase';
import type { Account, Transaction, BankData } from './types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const getGachaItemName = (cat: string, subNumber: number) => {
  const names: Record<string, string[]> = {
    'COMMON': ['Coin-Bag (কয়েন ব্যাগ)', 'Diner Voucher (কুপন)', 'Micro Cash (ক্ষুদ্র ক্যাশ)'],
    'UNCOMMON': ['Iron Safe Key (লোহার চাবি)', 'Silver Ticket (রূপালী টিকিট)', 'Vault Scroll (ভল্ট স্ক্রোল)'],
    'RARE': ['Platinum Stamp (প্লাটিনাম স্ট্যাম্প)', 'Emerald Token (পান্না টোকেন)', 'Golden Bar (সোনার বার)'],
    'LEGENDARY': ['Bank Crown (রাজকীয় মুকুট)', 'Sovereign Seal (সার্বভৌম সিল)', 'Ancient Relic (প্রাচীন রিলিক)'],
    'MYTHICAL': ['Core Arkenstone (আর্কেনস্টোন)', 'Mythic Scepter (মিথিক রাজদণ্ড)', 'Grand Ledger (প্রধান খাতা)']
  };
  return names[cat]?.[subNumber - 1] || 'Secret Prize';
};

const getCategoryIcon = (cat: string) => {
  switch (cat) {
    case 'COMMON': return <Target className="w-10 h-10" />;
    case 'UNCOMMON': return <Zap className="w-10 h-10" />;
    case 'RARE': return <Trophy className="w-10 h-10" />;
    case 'LEGENDARY': return <Sparkles className="w-10 h-10" />;
    case 'MYTHICAL': return <ShieldCheck className="w-10 h-10" />;
    default: return <Target className="w-10 h-10" />;
  }
};

const itemsInSet = [
  { cat: 'COMMON', subNumber: 1, color: 'text-slate-400' },
  { cat: 'COMMON', subNumber: 2, color: 'text-slate-400' },
  { cat: 'COMMON', subNumber: 3, color: 'text-slate-400' },
  { cat: 'UNCOMMON', subNumber: 1, color: 'text-green-500' },
  { cat: 'UNCOMMON', subNumber: 2, color: 'text-green-500' },
  { cat: 'UNCOMMON', subNumber: 3, color: 'text-green-500' },
  { cat: 'RARE', subNumber: 1, color: 'text-blue-600' },
  { cat: 'RARE', subNumber: 2, color: 'text-blue-600' },
  { cat: 'RARE', subNumber: 3, color: 'text-blue-600' },
  { cat: 'LEGENDARY', subNumber: 1, color: 'text-yellow-500' },
  { cat: 'LEGENDARY', subNumber: 2, color: 'text-yellow-500' },
  { cat: 'LEGENDARY', subNumber: 3, color: 'text-yellow-500' },
  { cat: 'MYTHICAL', subNumber: 1, color: 'text-purple-600' },
  { cat: 'MYTHICAL', subNumber: 2, color: 'text-purple-600' },
  { cat: 'MYTHICAL', subNumber: 3, color: 'text-purple-600' }
];

export default function App() {
  const [data, setData] = useState<BankData>({ accounts: [], transactions: [] });
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem('is_admin_active') === 'true';
  });
  const [myDeviceId, setMyDeviceId] = useState<string>(() => {
    let localId = localStorage.getItem('local_device_id');
    if (!localId) {
      localId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('local_device_id', localId);
    }
    return localId;
  });
  const [registeredAdminDeviceId, setRegisteredAdminDeviceId] = useState<string | null>(null);
  const [deviceLockChecked, setDeviceLockChecked] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  
  // Modals/Forms State
  const [showMenu, setShowMenu] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showTransaction, setShowTransaction] = useState<{acc: Account, type: 'deposit' | 'withdraw' | 'set'} | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showGacha, setShowGacha] = useState(false);
  const [gachaResult, setGachaResult] = useState<{category: string, value: number, subNumber?: number} | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinCount, setSpinCount] = useState(0);
  const [targetY, setTargetY] = useState(0);
  const [targetRotation, setTargetRotation] = useState(0);
  const [gachaId, setGachaId] = useState('');
  const [gachaError, setGachaError] = useState('');
  const [gachaStep, setGachaStep] = useState<'IDENTIFY' | 'PLAY'>('IDENTIFY');
  const [gachaUser, setGachaUser] = useState<Account | null>(null);
  const [activeGachaTab, setActiveGachaTab] = useState<'SPIN' | 'PRIZES'>('SPIN');
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);

  // Splash Screen Sequence State
  const [splashStep, setSplashStep] = useState<'EID_GREETING' | 'DINER_SPLASH' | 'ACTIVE'>('EID_GREETING');

  // Penalty Shootout Game State
  const [showPenaltyGame, setShowPenaltyGame] = useState(false);
  const [showPenaltyIntro, setShowPenaltyIntro] = useState(false);
  const [penaltyStep, setPenaltyStep] = useState<'IDENTIFY' | 'PLAY'>('IDENTIFY');
  const [penaltyUser, setPenaltyUser] = useState<Account | null>(null);
  const [penaltyInputId, setPenaltyInputId] = useState('');
  const [penaltyError, setPenaltyError] = useState('');
  const [penaltyGameState, setPenaltyGameState] = useState<'idle' | 'shooting' | 'goal' | 'save'>('idle');
  const [shotDirection, setShotDirection] = useState<'top_left' | 'top_right' | 'center' | 'left' | 'right' | null>(null);
  const [gkDirection, setGkDirection] = useState<'top_left' | 'top_right' | 'center' | 'left' | 'right' | null>(null);
  const [gameStreak, setGameStreak] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  // Cricket Batting Game State
  const [showCricketGame, setShowCricketGame] = useState(false);
  const [showCricketIntro, setShowCricketIntro] = useState(false);
  const [cricketStep, setCricketStep] = useState<'IDENTIFY' | 'PLAY'>('IDENTIFY');
  const [cricketUser, setCricketUser] = useState<Account | null>(null);
  const [cricketInputId, setCricketInputId] = useState('');
  const [cricketError, setCricketError] = useState('');
  const [cricketGameState, setCricketGameState] = useState<'idle' | 'batting' | 'boundary' | 'out'>('idle');
  const [hitDirection, setHitDirection] = useState<'left' | 'straight' | 'right' | null>(null);
  const [bowlerBall, setBowlerBall] = useState<'left' | 'straight' | 'right' | null>(null);
  const [cricketStreak, setCricketStreak] = useState(0);
  const [totalCricketScore, setTotalCricketScore] = useState(0);
  
  // Form values
  const [newAccName, setNewAccName] = useState('');
  const [newAccNumber, setNewAccNumber] = useState('');
  const [transAmount, setTransAmount] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [editName, setEditName] = useState('');

  // Backup & Export helper functions
  const downloadDataBackup = () => {
    try {
      const backupObj = {
        exportedAt: new Date().toISOString(),
        appName: "Diner Bank & Dhira Gachha Rolling System",
        accounts: data.accounts,
        transactions: data.transactions
      };
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(backupObj, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `diner_bank_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error("Backup failed", e);
    }
  };

  const downloadAccountsCSV = () => {
    try {
      const headers = ['Account Number', 'Name', 'Balance', 'Maturity Date'];
      const rows = data.accounts.map(acc => [
        `"${acc.accountNumber}"`,
        `"${acc.name.replace(/"/g, '""')}"`,
        acc.balance,
        acc.maturityDate || ''
      ]);
      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `accounts_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("CSV download failed", e);
    }
  };

  const titles = ["DINER BANK এখন হাতে হাতে", "DINER BANK", "THIS IS DINER", "JOY DIR"];
  const [titleIndex, setTitleIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTitleIndex((prev) => (prev + 1) % titles.length);
    }, 6000); // 6 seconds for a calm pace
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Stage 1: Eid Qurbani greetings show for 5.8s
    const timer1 = setTimeout(() => {
      setSplashStep('DINER_SPLASH');
    }, 5800);

    // Stage 2: Diner bank title rising screen shows for 4.2s (total 10.0s)
    const timer2 = setTimeout(() => {
      setSplashStep('ACTIVE');
    }, 10000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Securely verify & bind admin device
  useEffect(() => {
    if (!authReady) return;
    
    const checkDeviceLock = async () => {
      try {
        const docRef = doc(db, 'admin_config', 'device_lock');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const authorizedId = docSnap.data().authorized_device_id;
          setRegisteredAdminDeviceId(authorizedId);
          if (authorizedId !== myDeviceId) {
            // Foreign device! Restrict admin controls.
            setIsAdmin(false);
            localStorage.removeItem('is_admin_active');
          }
        } else {
          // No registered admin device. Register this one as the primary admin!
          await setDoc(docRef, {
            authorized_device_id: myDeviceId,
            registered_at: new Date().toISOString()
          });
          setRegisteredAdminDeviceId(myDeviceId);
          setIsAdmin(true);
          localStorage.setItem('is_admin_active', 'true');
        }
      } catch (err) {
        console.error("Error in verifying admin device lock status:", err);
      } finally {
        setDeviceLockChecked(true);
      }
    };

    checkDeviceLock();
  }, [authReady, myDeviceId]);

  useEffect(() => {
    if (!authReady) return;
    setLoading(true);
    setDbError(null);
    const accountsQuery = query(collection(db, 'accounts'), orderBy('name', 'asc'));
    const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
      const accounts = snapshot.docs.map(doc => {
        const d = doc.data();
        let balance = typeof d.balance === 'number' ? d.balance : 0;
        if (balance % 2 !== 0) {
          balance = Math.round(balance / 2) * 2;
        }
        return { id: doc.id, ...d, balance } as Account;
      });
      setData(prev => ({ ...prev, accounts }));
      if (accounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accounts[0].id);
      }
      setLoading(false);
    }, (error) => {
      console.error("Accounts Firestore Error:", error);
      setDbError(`অ্যাকাউন্ট লোড করতে ব্যর্থ হয়েছে: ${error.message}`);
      setLoading(false);
    });

    const transactionsQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
       const transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
       setData(prev => ({ ...prev, transactions }));
    }, (error) => {
      console.error("Transactions Firestore Error:", error);
      setDbError(prev => prev || `লেনদেন লোড করতে ব্যর্থ হয়েছে: ${error.message}`);
    });

    return () => {
      unsubscribeAccounts();
      unsubscribeTransactions();
    };
  }, [authReady]);

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName || !newAccNumber) return;
    
    try {
      const newAccountRef = doc(collection(db, 'accounts'));
      const accountData = {
        id: newAccountRef.id,
        name: newAccName,
        accountNumber: newAccNumber,
        balance: 0,
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      await setDoc(newAccountRef, accountData);
      
      setSelectedAccountId(newAccountRef.id);
      setNewAccName('');
      setNewAccNumber('');
      setShowAddAccount(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'accounts');
    }
  };

  const updateAccountName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editName) return;
    
    try {
      const accountRef = doc(db, 'accounts', editingAccount.id);
      await updateDoc(accountRef, { name: editName });
      setEditingAccount(null);
      setEditName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `accounts/${editingAccount.id}`);
    }
  };

  const [showEditFull, setShowEditFull] = useState<Account | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editFullNumber, setEditFullNumber] = useState('');

  const updateFullAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditFull) return;

    try {
      await updateDoc(doc(db, 'accounts', showEditFull.id), {
        name: editFullName,
        accountNumber: editFullNumber
      });
      setShowEditFull(null);
      alert('তথ্য সফলভাবে আপডেট করা হয়েছে।');
    } catch (err) {
      alert('আপডেট করতে ব্যর্থ হয়েছে।');
      handleFirestoreError(err, OperationType.UPDATE, `accounts/${showEditFull.id}`);
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই আইডিটি মুছতে চান?')) return;
    
    try {
      await deleteDoc(doc(db, 'accounts', accountId));
      alert('সফলভাবে মুছে ফেলা হয়েছে।');
    } catch (err) {
      alert('মুছতে ব্যর্থ হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      handleFirestoreError(err, OperationType.DELETE, `accounts/${accountId}`);
    }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showTransaction || !transAmount) return;
    
    try {
      const numAmount = parseFloat(transAmount);
      const accountRef = doc(db, 'accounts', showTransaction.acc.id);
      const transactionRef = doc(collection(db, 'transactions'));
      
      const batch = writeBatch(db);
      
      let newBalance = showTransaction.acc.balance;
      if (showTransaction.type === 'set') {
        newBalance = numAmount;
      } else if (showTransaction.type === 'deposit') {
        newBalance += numAmount;
      } else {
        newBalance -= numAmount;
      }
      
      // Force balance to always be an even number
      newBalance = Math.round(newBalance / 2) * 2;
      
      batch.update(accountRef, { balance: newBalance });
      
      batch.set(transactionRef, {
        id: transactionRef.id,
        accountId: showTransaction.acc.id,
        accountName: showTransaction.acc.name,
        amount: numAmount,
        type: showTransaction.type,
        description: transDesc || (showTransaction.type === 'deposit' ? 'জমা' : 'উত্তোলন'),
        timestamp: new Date().toISOString()
      });
      
      await batch.commit();

      setTransAmount('');
      setTransDesc('');
      setShowTransaction(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'transaction_batch');
    }
  };

  const getDaysRemaining = (date?: string) => {
    if (!date) return 0;
    const maturity = new Date(date);
    const now = new Date();
    const diffTime = maturity.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handleGachaAuth = () => {
    if (!gachaId) {
      setGachaError('ENTER ID FIRST');
      return;
    }
    const account = data?.accounts.find(a => a.name.toUpperCase() === gachaId.toUpperCase());
    if (!account) {
      setGachaError('INVALID ACCOUNT NAME');
      return;
    }
    if (account.balance < 150) {
      setGachaError(`INSUFFICIENT BALANCE. NEED 150, HAVE ${account.balance}`);
      return;
    }
    localStorage.setItem('last_gacha_id', gachaId);
    setGachaUser(account);
    setGachaStep('PLAY');
    setGachaError('');
  };

  // Sync gachaUser with latest data when data changes
  useEffect(() => {
    if (gachaUser && data.accounts.length > 0) {
      const updated = data.accounts.find(a => a.id === gachaUser.id);
      if (updated) setGachaUser(updated);
    }
  }, [data.accounts, gachaUser?.id]);

  useEffect(() => {
    const lastId = localStorage.getItem('last_gacha_id');
    if (lastId) setGachaId(lastId);
  }, []);

  const getDailyPenaltyCounts = (accountId: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    const todayTransactions = data.transactions.filter(t => {
      if (t.accountId !== accountId) return false;
      try {
        const tLocalDate = new Date(t.timestamp).toLocaleDateString('en-CA');
        return tLocalDate === todayStr;
      } catch {
        return false;
      }
    });

    const goals = todayTransactions.filter(t => t.description === 'ফুটবল পেনাল্টি গোল জয়').length;
    const attempts = todayTransactions.filter(t => 
      t.description === 'ফুটবল পেনাল্টি গোল জয়' || 
      t.description === 'ফুটবল পেনাল্টি ট্রাই (সেভ)'
    ).length;

    return { goals, attempts };
  };

  const getDailyCricketCounts = (accountId: string) => {
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    const todayTransactions = data.transactions.filter(t => {
      if (t.accountId !== accountId) return false;
      try {
        const tLocalDate = new Date(t.timestamp).toLocaleDateString('en-CA');
        return tLocalDate === todayStr;
      } catch {
        return false;
      }
    });

    const goals = todayTransactions.filter(t => t.description === 'ক্রিকেট বাউন্ডারি জয়').length;
    const attempts = todayTransactions.filter(t => 
      t.description === 'ক্রিকেট বাউন্ডারি জয়' || 
      t.description === 'ক্রিকেট ট্রাই (আউট)'
    ).length;

    return { goals, attempts };
  };

  // Penalty Game account sync
  useEffect(() => {
    if (penaltyUser && data.accounts.length > 0) {
      const updated = data.accounts.find(a => a.id === penaltyUser.id);
      if (updated) setPenaltyUser(updated);
    }
  }, [data.accounts, penaltyUser?.id]);

  // Cricket Game account sync
  useEffect(() => {
    if (cricketUser && data.accounts.length > 0) {
      const updated = data.accounts.find(a => a.id === cricketUser.id);
      if (updated) setCricketUser(updated);
    }
  }, [data.accounts, cricketUser?.id]);

  useEffect(() => {
    if (showPenaltyGame) {
      setShowPenaltyIntro(true);
      const timer = setTimeout(() => {
        setShowPenaltyIntro(false);
      }, 2200); // 2.2 seconds intro animation
      return () => clearTimeout(timer);
    }
  }, [showPenaltyGame]);

  useEffect(() => {
    if (showCricketGame) {
      setShowCricketIntro(true);
      const timer = setTimeout(() => {
        setShowCricketIntro(false);
      }, 2200); // 2.2 seconds intro animation
      return () => clearTimeout(timer);
    }
  }, [showCricketGame]);

  useEffect(() => {
    const lastPenaltyId = localStorage.getItem('last_penalty_account_number');
    if (lastPenaltyId) setPenaltyInputId(lastPenaltyId);
  }, []);

  useEffect(() => {
    const lastCricketId = localStorage.getItem('last_cricket_account_number');
    if (lastCricketId) setCricketInputId(lastCricketId);
  }, []);

  const handlePenaltyAuth = (idOverride?: string) => {
    const searchId = idOverride || penaltyInputId;
    if (!searchId) {
      setPenaltyError('ENTER ACCOUNT ID FIRST');
      return;
    }
    // Match against account ID (accountNumber) or account holder name
    const account = data?.accounts.find(
      a => a.accountNumber.toUpperCase() === searchId.toUpperCase() || 
           a.name.toUpperCase() === searchId.toUpperCase()
    );
    if (!account) {
      setPenaltyError('আইডি অথবা নাম পাওয়া যায়নি। আবার চেষ্টা করুন।');
      return;
    }
    localStorage.setItem('last_penalty_account_number', searchId);
    setPenaltyUser(account);
    setPenaltyStep('PLAY');
    setPenaltyError('');
    setPenaltyGameState('idle');
    setShotDirection(null);
    setGkDirection(null);
  };

  const handleCricketAuth = (idOverride?: string) => {
    const searchId = idOverride || cricketInputId;
    if (!searchId) {
      setCricketError('ENTER ACCOUNT ID FIRST');
      return;
    }
    // Match against account ID (accountNumber) or account holder name
    const account = data?.accounts.find(
      a => a.accountNumber.toUpperCase() === searchId.toUpperCase() || 
           a.name.toUpperCase() === searchId.toUpperCase()
    );
    if (!account) {
      setCricketError('আইডি অথবা নাম পাওয়া যায়নি। আবার চেষ্টা করুন।');
      return;
    }
    localStorage.setItem('last_cricket_account_number', searchId);
    setCricketUser(account);
    setCricketStep('PLAY');
    setCricketError('');
    setCricketGameState('idle');
    setHitDirection(null);
    setBowlerBall(null);
  };

  const handleShoot = async (direction: 'top_left' | 'top_right' | 'center' | 'left' | 'right') => {
    if (penaltyGameState === 'shooting' || !penaltyUser) return;

    // Daily limit checks
    const stats = getDailyPenaltyCounts(penaltyUser.id);
    if (stats.attempts >= 10) {
      alert("আজকের পেনাল্টি কিক খেলার লিমিট (১০ বার) শেষ হয়ে গেছে! অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন।");
      return;
    }
    if (stats.goals >= 10) {
      alert("আজকে আপনি ইতিমধ্যেই ১০ বার গোল করে লিমিট পূর্ণ করেছেন! অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন।");
      return;
    }

    setPenaltyGameState('shooting');
    setShotDirection(direction);

    // AI Goalkeeper behaves smarter to increase difficulty:
    // It has a 45% chance of guessing the player's correct shot direction (making it challenging).
    const options: ('top_left' | 'top_right' | 'center' | 'left' | 'right')[] = [
      'top_left', 'top_right', 'center', 'left', 'right'
    ];
    let aiChoice: 'top_left' | 'top_right' | 'center' | 'left' | 'right';
    if (Math.random() < 0.45) {
      aiChoice = direction;
    } else {
      const remainingOption = options.filter(opt => opt !== direction);
      aiChoice = remainingOption[Math.floor(Math.random() * remainingOption.length)];
    }
    setGkDirection(aiChoice);

    // Delayed evaluation for tension and animation completion
    setTimeout(async () => {
      if (aiChoice === direction) {
        // Goalkeeper guessed correct! Saved!
        setPenaltyGameState('save');
        setGameStreak(0);

        // Record missed/saved attempt in Firestore to track daily limits securely across devices
        try {
          const transactionRef = doc(collection(db, 'transactions'));
          await setDoc(transactionRef, {
            id: transactionRef.id,
            accountId: penaltyUser.id,
            accountName: penaltyUser.name,
            amount: 0,
            type: 'deposit',
            description: 'ফুটবল পেনাল্টি ট্রাই (সেভ)',
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.error("Failed to commit penalty save transaction", err);
        }
      } else {
        // GOAL! Scored successfully!
        setPenaltyGameState('goal');
        setGameStreak(prev => prev + 1);
        setTotalScore(prev => prev + 1);

        // Confetti effect
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });

        // Add 50 Diner to Firestore
        try {
          const accountRef = doc(db, 'accounts', penaltyUser.id);
          const transactionRef = doc(collection(db, 'transactions'));
          const batch = writeBatch(db);

          const newBalance = Math.round((penaltyUser.balance + 50) / 2) * 2;
          batch.update(accountRef, { balance: newBalance });

          batch.set(transactionRef, {
            id: transactionRef.id,
            accountId: penaltyUser.id,
            accountName: penaltyUser.name,
            amount: 50,
            type: 'deposit',
            description: 'ফুটবল পেনাল্টি গোল জয়',
            timestamp: new Date().toISOString()
          });

          await batch.commit();
        } catch (err) {
          console.error("Failed to commit penalty goal transaction", err);
        }
      }
    }, 1200);
  };

  const handleBat = async (dir: 'left' | 'straight' | 'right') => {
    if (cricketGameState === 'batting' || !cricketUser) return;

    // Daily limit checks
    const stats = getDailyCricketCounts(cricketUser.id);
    if (stats.attempts >= 10) {
      alert("আজকের ক্রিকেট খেলার লিমিট (১০ বার) শেষ হয়ে গেছে! অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন।");
      return;
    }
    if (stats.goals >= 10) {
      alert("আজকে আপনি ইতিমধ্যেই ১০ বার বাউন্ডারি মেরে লিমিট পূর্ণ করেছেন! অনুগ্রহ করে আগামীকাল আবার চেষ্টা করুন।");
      return;
    }

    setCricketGameState('batting');
    setHitDirection(dir);

    // AI Bowler delivers in one of three areas with a 45% chance of matching batsman's choice to make it challenging
    const options: ('left' | 'straight' | 'right')[] = ['left', 'straight', 'right'];
    let bowlDir: 'left' | 'straight' | 'right';
    if (Math.random() < 0.45) {
      bowlDir = dir;
    } else {
      const remainingOption = options.filter(opt => opt !== dir);
      bowlDir = remainingOption[Math.floor(Math.random() * remainingOption.length)];
    }
    setBowlerBall(bowlDir);

    // Wait 1.5 seconds for bowling delivery animation
    setTimeout(async () => {
      if (bowlDir === dir) {
        // MATCHED: Batsman is OUT (caught / bowled!)
        setCricketGameState('out');
        setCricketStreak(0);

        try {
          const transactionRef = doc(collection(db, 'transactions'));
          await setDoc(transactionRef, {
            id: transactionRef.id,
            accountId: cricketUser.id,
            accountName: cricketUser.name,
            amount: 0,
            type: 'deposit',
            description: 'ক্রিকেট ট্রাই (আউট)',
            timestamp: new Date().toISOString()
          });
        } catch (err) {
          console.error("Failed to commit cricket OUT transaction", err);
        }
      } else {
        // MISALIGNED: BOUNDARY! 4 or 6 scored!
        setCricketGameState('boundary');
        setCricketStreak(prev => prev + 1);
        setTotalCricketScore(prev => prev + 1);

        // Score 50 Diner!
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 }
        });

        // Update balance & log successful boundary transaction
        try {
          const accountRef = doc(db, 'accounts', cricketUser.id);
          const transactionRef = doc(collection(db, 'transactions'));
          const batch = writeBatch(db);

          const newBalance = Math.round((cricketUser.balance + 50) / 2) * 2;
          batch.update(accountRef, { balance: newBalance });

          batch.set(transactionRef, {
            id: transactionRef.id,
            accountId: cricketUser.id,
            accountName: cricketUser.name,
            amount: 50,
            type: 'deposit',
            description: 'ক্রিকেট বাউন্ডারি জয়',
            timestamp: new Date().toISOString()
          });

          await batch.commit();
        } catch (err) {
          console.error("Failed to commit cricket boundary transaction", err);
        }
      }
    }, 1500);
  };

  const spinTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

  const handleGachaSpin = async () => {
    if (!gachaUser || isSpinning) return;
    
    // 1. CHOOSE OUTCOME AND SET ANIMATION TARGET IMMEDIATELY & SYNCHRONOUSLY
    setIsSpinning(true);
    setSpinCount(prev => prev + 1);
    setGachaError('');
    setGachaResult(null);

    // Pre-calculate randomized category
    const rand = Math.random() * 100;
    let finalCategory = 'COMMON';
    if (rand < 2) finalCategory = 'MYTHICAL';
    else if (rand < 10) finalCategory = 'LEGENDARY';
    else if (rand < 25) finalCategory = 'RARE';
    else if (rand < 55) finalCategory = 'UNCOMMON';
    else finalCategory = 'COMMON';

    // Pre-calculate random sub-number between 1 and 3
    const finalSubNumber = Math.floor(Math.random() * 3) + 1;

    // Set precise target landing coordinate using our global itemsInSet definitions
    const targetIndexInSet = itemsInSet.findIndex(item => item.cat === finalCategory && item.subNumber === finalSubNumber);
    const itemHeight = 160; // Exact height of h-40 in pixels
    const targetSet = 6; // Spin past 6 sets
    const flatIndex = (targetSet * itemsInSet.length) + targetIndexInSet;
    const landingPos = -(flatIndex * itemHeight) + 80; // Centered in 320px viewport
    
    setTargetY(landingPos);

    // 3D Cylinder rotation calculation
    // Each item is spaced by 24 degrees (360 / 15).
    // Multiply by spinCount to always spin forwards dynamically.
    const runLoops = 6 + (spinCount % 3); // 6, 7 or 8 loops of 360 degrees for dynamic speeds
    const nextRotation = -((spinCount + 1) * 360 * runLoops + targetIndexInSet * 24);
    setTargetRotation(nextRotation);

    // Pre-calculate reward value corresponding to selected category (strictly even numbers)
    let finalValue = 2;
    switch(finalCategory) {
      case 'COMMON': finalValue = (Math.floor(Math.random() * 5) + 3) * 2; break; // Even between 6 and 14
      case 'UNCOMMON': finalValue = (Math.floor(Math.random() * 8) + 5) * 2; break; // Even between 10 and 24
      case 'RARE': finalValue = (Math.floor(Math.random() * 13) + 10) * 2; break; // Even between 20 and 44
      case 'LEGENDARY': finalValue = (Math.floor(Math.random() * 26) + 25) * 2; break; // Even between 50 and 100
      case 'MYTHICAL': finalValue = (Math.floor(Math.random() * 51) + 75) * 2; break; // Even between 150 and 250
    }
    const newRewardValue = finalValue;

    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);

    // 2. DISPATCH FIRESTORE OPERATION ASYNCHRONOUSLY (RUNS IN BACKGROUND WHILE SPINNING)
    const dbPromise = (async () => {
      const accountRef = doc(db, 'accounts', gachaUser.id);
      const accountSnap = await getDoc(accountRef);
      const latestAccount = accountSnap.exists() ? (accountSnap.data() as Account) : null;
      
      if (!latestAccount || latestAccount.balance < 150) {
        throw new Error('BALANCE EXHAUSTED');
      }

      const batch = writeBatch(db);
      const transactionRef = doc(collection(db, 'transactions'));
      const rewardTransactionRef = doc(collection(db, 'transactions'));
      
      const newBalance = Math.round((latestAccount.balance - 150 + newRewardValue) / 2) * 2;
      batch.update(accountRef, { balance: newBalance });
      
      // Cost entry
      batch.set(transactionRef, {
        id: transactionRef.id,
        accountId: gachaUser.id,
        accountName: gachaUser.name,
        amount: 150,
        type: 'withdraw',
        description: 'GACHA SPIN COST',
        timestamp: new Date().toISOString()
      });

      // Reward entry with number and name description
      const prizeName = getGachaItemName(finalCategory, finalSubNumber);
      batch.set(rewardTransactionRef, {
        id: rewardTransactionRef.id,
        accountId: gachaUser.id,
        accountName: gachaUser.name,
        amount: newRewardValue,
        type: 'deposit',
        description: `GACHA WIN: ${finalCategory} #${finalSubNumber} (${prizeName})`,
        timestamp: new Date().toISOString()
      });
      
      await batch.commit();
      return newRewardValue;
    })();

    // 3. WAIT EXACTLY 3 SECONDS FOR ANIMATION CYCLE TO COMPLETE
    spinTimerRef.current = setTimeout(async () => {
      try {
        const committedValue = await dbPromise;
        setGachaResult({ category: finalCategory, value: committedValue, subNumber: finalSubNumber });
        setIsSpinning(false);
        
        if (finalCategory === 'MYTHICAL' || finalCategory === 'LEGENDARY') {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: finalCategory === 'MYTHICAL' ? ['#9333ea', '#db2777', '#ffffff'] : ['#facc15', '#f59e0b', '#ffffff']
          });
        }
      } catch (err: any) {
        setIsSpinning(false);
        setGachaError(err?.message === 'BALANCE EXHAUSTED' ? 'INSUFFICIENT BALANCE. NEED 150.' : 'SYSTEM ERROR. TRY AGAIN.');
        setGachaStep('PLAY');
      }
    }, 3000);
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed", err);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setIsAdmin(false);
      localStorage.removeItem('is_admin_active');
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  if (splashStep === 'EID_GREETING') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950 flex flex-col items-center justify-center p-4 relative overflow-hidden text-white select-none">
        
        {/* Sparkly Background elements */}
        <div className="absolute inset-0 opacity-25 pointer-events-none">
          <div className="absolute top-10 left-10 text-3xl animate-pulse">✨</div>
          <div className="absolute top-24 right-20 text-xl animate-bounce">⭐</div>
          <div className="absolute bottom-32 left-16 text-2xl animate-pulse">✨</div>
          <div className="absolute bottom-16 right-24 text-3xl animate-bounce">⭐</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl"></div>
        </div>

        {/* Eid Card Container */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.05, y: -30 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md bg-white/10 backdrop-blur-md border-4 border-emerald-400 p-8 rounded-3xl text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative"
        >
          {/* Top Hanging Lanterns & Crescent Moon */}
          <div className="flex justify-center gap-10 -mt-2 mb-4 text-emerald-300">
            <motion.div animate={{ rotate: [ -6, 6, -6 ] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="text-4xl">🏮</motion.div>
            <motion.div animate={{ y: [ -2, 2, -2 ] }} transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }} className="text-5xl drop-shadow-[0_0_15px_rgba(253,224,71,0.6)]">🌙</motion.div>
            <motion.div animate={{ rotate: [ 6, -6, 6 ] }} transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }} className="text-4xl">🏮</motion.div>
          </div>

          <div className="space-y-6">
            {/* Themed Title */}
            <div>
              <p className="text-xs font-black tracking-[0.3em] text-yellow-300 uppercase">EID-UL-ADHA SPECIAL</p>
              <h1 className="text-4xl font-black mt-2 text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] font-sans">
                ঈদুল আযহার শুভেচ্ছা
              </h1>
            </div>

            {/* Sacrifice Animals Flat Design scene */}
            <div className="bg-emerald-950/80 border-4 border-yellow-500/40 p-6 rounded-2xl relative shadow-inner overflow-hidden">
              <div className="flex justify-center items-end gap-6">
                {/* Cow */}
                <motion.div 
                  initial={{ x: -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className="text-7xl filter drop-shadow-[0_8px_4px_rgba(0,0,0,0.35)] relative"
                >
                  🐂
                  <span className="absolute -top-3 -right-2 text-lg animate-pulse">🌸</span>
                </motion.div>
                {/* Goat */}
                <motion.div 
                  initial={{ x: 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="text-6xl filter drop-shadow-[0_8px_4px_rgba(0,0,0,0.35)] relative -bottom-1"
                >
                  🐐
                  <span className="absolute -top-3 -left-2 text-lg animate-pulse">💐</span>
                </motion.div>
              </div>
              
              {/* Grass details */}
              <div className="w-full h-3 bg-emerald-500/30 rounded-full mt-5 flex justify-between px-6">
                <span className="text-xs text-emerald-400">🌱</span>
                <span className="text-xs text-emerald-400">🌿</span>
                <span className="text-xs text-emerald-400">🌱</span>
              </div>
            </div>

            {/* Meaningful blessing quote */}
            <p className="text-base font-semibold text-emerald-100 max-w-sm mx-auto leading-relaxed">
              আপনার কুরবানি হোক কবুল এবং জীবনে বয়ে আনুক অনাবিল আনন্দ ও বরকত। ডিনার ব্যাংকের পক্ষ থেকে ঈদ মোবারক! ❤️
            </p>

            {/* Sparkles bottom decoration */}
            <div className="flex justify-center items-center gap-2 text-yellow-300">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-black tracking-[0.25em] uppercase text-emerald-300">EID MUBARAK</span>
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show diner splash if actively chosen OR we are still loading db under active status
  if (splashStep === 'DINER_SPLASH' || loading || !authReady) {
    return (
      <div className="min-h-screen bg-[#F2F4F7] flex flex-col items-center justify-center p-6 relative overflow-hidden text-black select-none">
        
        {/* Retro Grid network layout background */}
        <div className="absolute inset-0 bg-[radial-gradient(#CBD5E1_1px,transparent_1px)] [background-size:20px_20px] opacity-50"></div>

        <motion.div 
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0, scale: 0.95 }}
          className="text-center relative z-10 space-y-8"
        >
          {/* Bold visual brand avatar coin with neo-brutalist styling */}
          <div className="relative inline-block mx-auto">
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
              className="w-24 h-24 border-8 border-black rounded-xl bg-yellow-400 flex items-center justify-center shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] text-5xl font-black"
            >
              ৳
            </motion.div>
            <div className="absolute -top-4 -right-4 text-4xl animate-bounce">⚡</div>
          </div>

          {/* Majestic rising text labels */}
          <div className="space-y-3">
            <motion.h1 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="text-6xl font-black text-black tracking-tighter uppercase text-center font-sans"
            >
              ডিনার ব্যাংক
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-sm font-black tracking-[0.4em] text-gray-500 uppercase"
            >
              DINER BANK
            </motion.p>
          </div>

          <div className="flex flex-col items-center gap-2">
            {/* Neo-brutalist animated loader tracker bar */}
            <div className="w-64 h-8 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] p-1 overflow-hidden relative">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.8, ease: "easeInOut" }}
                className="h-full bg-emerald-500 border-r-4 border-black"
              />
            </div>
            <p className="text-xs font-black tracking-widest text-[#101828] animate-pulse mt-2 bg-yellow-400 border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
              {loading || !authReady ? "ব্যাংক ভল্ট তথ্য সিঙ্ক করা হচ্ছে..." : "সফলভাবে চালু হচ্ছে..."}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const selectedAccount = data.accounts.find(a => a.id === selectedAccountId);
  const accountTransactions = data.transactions.filter(t => t.accountId === selectedAccountId);
  const filteredAccounts = data.accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.accountNumber.includes(searchTerm)
  );

  return (
    <div className="bg-[#F2F4F7] min-h-screen font-sans flex flex-col text-[#101828]">
      
      {/* Header Section */}
      <header className="bg-white border-b-4 border-black py-3 px-4 md:px-6 flex justify-between items-center z-10 sticky top-0 shadow-[0_4px_0_0_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 border-2 border-black hover:bg-black hover:text-white transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] bg-white"
            >
              <Menu className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {showMenu && (
                <>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowMenu(false)}
                    className="fixed inset-0 z-40"
                  />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute left-0 mt-4 w-64 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b-4 border-black bg-gray-50">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Main Menu</p>
                    </div>
                    <button 
                      onClick={() => { setShowGacha(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-blue-600 hover:text-white transition-colors group/menuitem border-b-2 border-black"
                    >
                      <div className="p-2 border-2 border-black bg-black text-white group-hover/menuitem:bg-white group-hover/menuitem:text-blue-600 transition-colors">
                        <Dices className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-black uppercase text-sm leading-none">Dir Gacha</p>
                        <p className="text-[8px] font-bold uppercase opacity-60 mt-1 italic tracking-widest text-inherit">Test Your Luck</p>
                      </div>
                    </button>
                     <button 
                      onClick={() => { setShowPenaltyGame(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-green-600 hover:text-white transition-colors group/menuitem border-b-2 border-black"
                    >
                      <div className="p-2 border-2 border-black bg-black text-white group-hover/menuitem:bg-white group-hover/menuitem:text-green-600 transition-colors">
                        <Target className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-black uppercase text-sm leading-none">Penalty Shot</p>
                        <p className="text-[8px] font-bold uppercase opacity-60 mt-1 italic tracking-widest text-inherit">Shoot & Win 50 Diner ⚽</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => { setShowCricketGame(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-yellow-600 hover:text-white transition-colors group/menuitem border-b-2 border-black"
                    >
                      <div className="p-2 border-2 border-black bg-black text-white group-hover/menuitem:bg-white group-hover/menuitem:text-yellow-600 transition-colors">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="font-black uppercase text-sm leading-none">Cricket Match</p>
                        <p className="text-[8px] font-bold uppercase opacity-60 mt-1 italic tracking-widest text-inherit">Hit Corners & Win 50 Diner 🏏</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => { setShowDirectory(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-blue-600 hover:text-white transition-colors group/menuitem border-b-2 border-black"
                    >
                      <div className="p-2 border-2 border-black bg-black text-white group-hover/menuitem:bg-white group-hover/menuitem:text-blue-600 transition-colors">
                        <Users className="w-5 h-5 text-inherit" />
                      </div>
                      <div className="text-left">
                        <p className="font-black uppercase text-sm leading-none">সকল আইডি (LIST)</p>
                        <p className="text-[8px] font-bold uppercase opacity-60 mt-1 italic tracking-widest text-inherit">View All Account IDs</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => { downloadAccountsCSV(); setShowMenu(false); }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-orange-600 hover:text-white transition-colors group/menuitem border-b-2 border-black bg-orange-50/40"
                    >
                      <div className="p-2 border-2 border-black bg-black text-white group-hover/menuitem:bg-white group-hover/menuitem:text-orange-600 transition-colors">
                        <Download className="w-5 h-5 text-inherit" />
                      </div>
                      <div className="text-left">
                        <p className="font-black uppercase text-sm leading-none text-orange-950 group-hover/menuitem:text-white">লেজার ডাউনলোড (EXCEL)</p>
                        <p className="text-[8px] font-bold uppercase opacity-65 mt-1 italic tracking-widest text-inherit">Download Excel Spreadsheet</p>
                      </div>
                    </button>
                    <button 
                      onClick={() => { downloadDataBackup(); setShowMenu(false); }}
                      className="w-full flex items-center gap-4 p-4 hover:bg-purple-600 hover:text-white transition-colors group/menuitem border-b-2 border-black bg-purple-50/40"
                    >
                      <div className="p-2 border-2 border-black bg-black text-white group-hover/menuitem:bg-white group-hover/menuitem:text-purple-600 transition-colors">
                        <FileJson className="w-5 h-5 text-inherit" />
                      </div>
                      <div className="text-left">
                        <p className="font-black uppercase text-sm leading-none text-purple-950 group-hover/menuitem:text-white">ডাটা ব্যাকআপ (JSON)</p>
                        <p className="text-[8px] font-bold uppercase opacity-65 mt-1 italic tracking-widest text-inherit">Download complete database dump</p>
                      </div>
                    </button>
                    {isAdmin && (
                       <button 
                         onClick={() => { setShowAddAccount(true); setShowMenu(false); }}
                         className="w-full flex items-center gap-4 p-4 hover:bg-blue-600 hover:text-white transition-colors group/menuitem"
                       >
                         <div className="p-2 border-2 border-black bg-black text-white group-hover/menuitem:bg-white group-hover/menuitem:text-blue-600 transition-colors">
                           <Plus className="w-5 h-5" />
                         </div>
                         <div className="text-left">
                           <p className="font-black uppercase text-sm leading-none">Add User</p>
                           <p className="text-[8px] font-bold uppercase opacity-60 mt-1 italic tracking-widest text-inherit">Create Account</p>
                         </div>
                       </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="" 
                className="h-8 w-auto md:h-9 object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase leading-none text-black group-hover:text-blue-600 transition-colors flex items-center h-10 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.span
                  key={titles[titleIndex]}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -30, opacity: 0 }}
                  transition={{ 
                    duration: 0.8, 
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  className="whitespace-nowrap"
                >
                  {titles[titleIndex]}
                </motion.span>
              </AnimatePresence>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-6">
          {titleIndex !== 0 && (
            <span className="hidden md:block text-[8px] font-black tracking-[0.2em] text-gray-400 opacity-60">DIR.ORIGIN</span>
          )}
          {isAdmin ? (
            <div className="hidden md:flex bg-green-500 text-white px-3 py-1.5 border-2 border-black font-black uppercase text-[8px] tracking-widest items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <ShieldCheck className="w-3 h-3" /> ADMIN AUTHED
            </div>
          ) : (
            <div className="hidden md:flex bg-blue-600 text-white px-3 py-1.5 border-2 border-black font-black uppercase text-[8px] tracking-widest items-center gap-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <ShieldCheck className="w-3 h-3" /> SECURE
            </div>
          )}
        </div>
      </header>

      {/* Main Dashboard */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {dbError && (
            <div className="p-4 border-4 border-black bg-red-100 text-red-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-2">
              <p className="font-black text-xs uppercase tracking-wider text-red-600">⚠️ ডেটাবেস সংযোগ ত্রুটি (DATABASE CONNECTION ERROR)</p>
              <p className="text-sm font-bold">{dbError}</p>
              <p className="text-[10px] opacity-80">
                দয়া করে ইন্টারনেট কানেকশন বা ব্রাউজারের প্রাইভেট মোড সেটিং চেক করুন।
              </p>
            </div>
          )}
          
          {loading && data.accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
               <div className="w-12 h-12 border-4 border-black border-t-blue-600 rounded-full animate-spin"></div>
               <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">অ্যাকাউন্ট লোড হচ্ছে...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div className="relative w-full md:w-80">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="আপনার নাম দিয়ে খুঁজুন..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border-4 border-black font-black outline-none focus:bg-white bg-white text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  />
                </div>
                
                {/* Quick download utilities for local offline records */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={downloadAccountsCSV}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-100 hover:bg-orange-200 text-orange-950 border-4 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                    title="Download account lists as Excel spreadsheet"
                  >
                    <Download className="w-4 h-4 text-orange-600 shrink-0" />
                    <span>EXCEL ডাউনলোড</span>
                  </button>
                  <button
                    onClick={downloadDataBackup}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-100 hover:bg-purple-200 text-purple-950 border-4 border-black font-black uppercase text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
                    title="Export whole DB schema as JSON file"
                  >
                    <FileJson className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>JSON ব্যাকআপ</span>
                  </button>
                </div>

                {searchTerm && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    {filteredAccounts.length} জন পাওয়া গেছে
                  </p>
                )}
              </div>

          <div className="grid grid-cols-1 gap-6">
            {filteredAccounts.map((acc) => (
              <motion.div 
                key={acc.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border-4 border-black p-5 md:p-6 shadow-[8px_8px_0px_0px_#166534] relative overflow-hidden group hover:bg-gray-50 transition-colors"
              >
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => { setEditingAccount(acc); setEditName(acc.name); }}
                      className="p-1.5 border-2 border-black text-black hover:bg-black hover:text-white transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setShowTransaction({ acc, type: 'set' })}
                      className="p-1.5 bg-black text-white hover:bg-blue-600 transition-colors font-black text-[9px] px-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]"
                    >
                      SET
                    </button>
                    <button 
                      onClick={() => {
                        setShowEditFull(acc);
                        setEditFullName(acc.name);
                        setEditFullNumber(acc.accountNumber);
                      }}
                      className="p-1.5 border-2 border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white transition-colors"
                      title="Edit Full Details"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => deleteAccount(acc.id)}
                      className="p-1.5 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-[9px] font-black uppercase text-blue-600 tracking-[0.3em] mb-0.5">ACCOUNT HOLDER</p>
                      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-black group-hover:text-blue-600 transition-colors leading-tight">{acc.name}</h2>
                      <p className="text-gray-400 font-bold font-mono text-[10px]">ID: {acc.accountNumber}</p>
                    </div>
                    
                    <div className="pt-3 border-t-2 border-gray-100 flex gap-8">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">যতোদিন পর পাবেন</p>
                        <p className="text-xl font-black flex items-center gap-2 text-gray-800">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          {getDaysRemaining(acc.maturityDate)} দিন
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border-4 border-gray-50 p-6 flex flex-col justify-center min-w-[240px]">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1 text-center md:text-left">মোট ব্যালেন্স (৳)</p>
                    <p className="text-3xl md:text-4xl font-black text-black text-center md:text-left tracking-tighter">
                      {acc.balance.toLocaleString()}
                    </p>
                    <div className="mt-3 flex items-center justify-center md:justify-start gap-1.5 text-[9px] font-black text-gray-400">
                      <ShieldCheck className="w-3 h-3 text-blue-600" /> VERIFIED
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {searchTerm && filteredAccounts.length === 0 && (
              <div className="py-20 text-center border-4 border-dashed border-gray-300 rounded-lg">
                <Search className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                <h3 className="text-2xl font-black uppercase text-gray-400">আপনার নাম খুঁজে পাওয়া যায়নি</h3>
              </div>
            )}

            {!searchTerm && data.accounts.length > 5 && (
               <p className="text-center text-gray-400 font-bold uppercase text-xs tracking-widest">
                 আপনার একাউন্ট দেখতে সার্চ বক্স টি ব্যবহার করুন
               </p>
            )}

            {data.accounts.length === 0 && (
              <div className="py-20 text-center">
                 <p className="text-gray-400 font-black uppercase">কোন একাউন্ট যোগ করা হয়নি</p>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </main>

      {/* Status Bar */}
      <footer className="bg-black text-white p-3 px-6 flex justify-between text-[10px] uppercase font-black tracking-[0.25em]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3 h-3 text-blue-400" /> {isAdmin ? 'ADMIN ACCESS ENABLED' : 'SECURE VIEW ONLY MODE'}
          </div>
          {!isAdmin && (
            <div className="flex items-center gap-1 border-l border-white/20 pl-6 text-blue-400">
              <ShieldCheck className="w-2.5 h-2.5" /> OFFICIAL STATUS
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!user ? (
            <button 
              onClick={login}
              className="hover:text-blue-400 transition-colors flex items-center gap-1 text-blue-400"
            >
              <LogIn className="w-3 h-3" /> LOGIN TO EDIT
            </button>
          ) : (
            <>
              {registeredAdminDeviceId && registeredAdminDeviceId !== myDeviceId ? (
                <span className="text-gray-500 font-bold flex items-center gap-1 cursor-not-allowed select-none" title="Only authorized admin mobile can write changes">
                  🔒 USERS ONLY
                </span>
              ) : (
                <button 
                  onClick={() => {
                    if (isAdmin) {
                      setIsAdmin(false);
                      localStorage.removeItem('is_admin_active');
                    } else {
                      setShowAdminLogin(true);
                    }
                  }}
                  className="hover:text-blue-400 transition-colors flex items-center gap-1"
                >
                  {isAdmin ? <Check className="w-3 h-3 text-green-400" /> : <Settings className="w-3 h-3 text-gray-400" />}
                  {isAdmin ? 'LOGOUT ADMIN' : 'ADMIN LOGIN'}
                </button>
              )}
              <button onClick={logout} className="hover:text-red-400 transition-colors opacity-50">
                <LogOut className="w-3 h-3" />
              </button>
            </>
          )}
          <div className="hidden sm:block truncate opacity-50">
             {new Date().toLocaleDateString()} • v2.3.0
          </div>
        </div>
      </footer>

      {/* Modals - Standardised Bold Style */}
      <AnimatePresence>
        {/* Edit Full Account Modal */}
        {showEditFull && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black p-6 md:p-8 max-w-md w-full shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black uppercase tracking-tighter">সুপার এডিট প্যানেল</h3>
                <button onClick={() => setShowEditFull(null)} className="border-4 border-black p-1 hover:bg-black hover:text-white transition-colors"><X /></button>
              </div>
              <form onSubmit={updateFullAccount} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">অ্যাকাউন্ড নাম</label>
                  <input 
                    type="text" 
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full border-4 border-black p-3 font-bold focus:bg-yellow-50 outline-none"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">আইডি / পাসওয়ার্ড</label>
                  <input 
                    type="text" 
                    value={editFullNumber}
                    onChange={(e) => setEditFullNumber(e.target.value)}
                    className="w-full border-4 border-black p-3 font-mono font-bold focus:bg-yellow-50 outline-none"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-black text-white p-4 font-black uppercase tracking-widest hover:bg-blue-600 transition-colors shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none translate-y-0 active:translate-y-1"
                >
                  তথ্য পরিবর্তন করুন
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Account Directory Modal */}
        {showDirectory && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black p-6 md:p-8 max-w-2xl w-full shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-h-[85vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6 shrink-0">
                <div>
                  <h3 className="text-3xl font-black uppercase tracking-tighter">সকল আইডি তালিকা</h3>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Total Accounts: {data.accounts.length}</p>
                </div>
                <button onClick={() => setShowDirectory(false)} className="border-4 border-black p-1 hover:bg-black hover:text-white transition-colors"><X /></button>
              </div>
              
              <div className="overflow-y-auto border-4 border-black">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-black text-white text-[10px] uppercase font-black tracking-widest">
                    <tr>
                      <th className="p-3 border-b-2 border-black">Name</th>
                      <th className="p-3 border-b-2 border-black">Account ID</th>
                      <th className="p-3 border-b-2 border-black text-right">Balance</th>
                      {isAdmin && <th className="p-3 border-b-2 border-black text-center">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="font-bold text-sm">
                    {data.accounts.map((acc, idx) => (
                      <tr key={acc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="p-3 border-b border-gray-200">{acc.name}</td>
                        <td className="p-3 border-b border-gray-200 font-mono text-xs text-blue-600">{acc.accountNumber}</td>
                        <td className="p-3 border-b border-gray-200 text-right">৳{acc.balance.toLocaleString()}</td>
                        {isAdmin && (
                          <td className="p-3 border-b border-gray-200 text-center">
                            <button 
                              onClick={() => deleteAccount(acc.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {data.accounts.length === 0 && (
                      <tr>
                        <td colSpan={3} className="p-10 text-center text-gray-400 italic">কোন আইডি পাওয়া যায়নি</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 flex items-center gap-3">
                 <ShieldCheck className="w-5 h-5 text-blue-600" />
                 <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">
                   এখানের আইডি গুলো সুরক্ষিত এবং শুধুমাত্র ভেরিফাইড ইউজারদের জন্য।
                 </p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Add Account Modal */}
        {showAddAccount && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-black uppercase tracking-tighter">NEW ACCOUNT</h3>
                <button onClick={() => setShowAddAccount(false)} className="border-4 border-black p-1 hover:bg-black hover:text-white transition-colors"><X /></button>
              </div>
              <form onSubmit={addAccount} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">অ্যাকাউন্টের নাম</label>
                  <input 
                    type="text" 
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    className="w-full border-4 border-black p-4 font-black outline-none focus:bg-gray-50"
                    placeholder="নাম লিখুন"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">অ্যাকাউন্ট নাম্বার</label>
                  <input 
                    type="text" 
                    value={newAccNumber}
                    onChange={(e) => setNewAccNumber(e.target.value)}
                    className="w-full border-4 border-black p-4 font-black outline-none focus:bg-gray-50"
                    placeholder="নাম্বার লিখুন"
                  />
                </div>
                <button className="w-full bg-blue-600 text-white border-4 border-black p-5 font-black text-lg hover:bg-blue-700 transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none uppercase">
                  CREATE ACCOUNT
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Transaction Modal */}
        {showTransaction && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-black uppercase tracking-tighter">
                  {showTransaction.type === 'set' ? 'SET EXACT BALANCE' : (showTransaction.type === 'deposit' ? 'DEPOSIT' : 'WITHDRAW')}
                </h3>
                <button onClick={() => setShowTransaction(null)} className="border-4 border-black p-1 hover:bg-black hover:text-white transition-colors"><X /></button>
              </div>
              <div className="mb-6 p-4 border-4 border-gray-100 bg-gray-50">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">SELECTED ACCOUNT</p>
                <p className="font-black text-xl">{showTransaction.acc.name}</p>
                <p className="text-xs text-gray-400 font-bold uppercase truncate">#{showTransaction.acc.accountNumber}</p>
              </div>
              <form onSubmit={handleTransaction} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">টাকার পরিমাণ (৳)</label>
                  <input 
                    type="number" 
                    value={transAmount}
                    onChange={(e) => setTransAmount(e.target.value)}
                    className="w-full border-4 border-black p-4 text-3xl font-black outline-none focus:bg-gray-50"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">বিবরণ</label>
                  <input 
                    type="text" 
                    value={transDesc}
                    onChange={(e) => setTransDesc(e.target.value)}
                    className="w-full border-4 border-black p-4 font-black outline-none focus:bg-gray-50"
                    placeholder="লেনদেনের কারণ..."
                  />
                </div>
                <button className={`w-full text-white border-4 border-black p-5 font-black text-lg transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none uppercase ${
                  showTransaction.type === 'set' ? 'bg-blue-600 hover:bg-blue-700' : (showTransaction.type === 'deposit' ? 'bg-black hover:bg-black/80' : 'bg-red-600 hover:bg-red-700')
                }`}>
                  {showTransaction.type === 'set' ? 'UPDATE TO EXACT AMOUNT' : (showTransaction.type === 'deposit' ? 'CONFIRM DEPOSIT' : 'CONFIRM WITHDRAW')}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Admin Login Modal */}
        {showAdminLogin && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black p-8 max-w-sm w-full shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
            >
              <h3 className="text-3xl font-black mb-6 uppercase tracking-tighter">ADMIN PASSCODE</h3>
              <div className="space-y-6">
                <input 
                  type="password" 
                  value={adminPasscode}
                  onChange={(e) => setAdminPasscode(e.target.value)}
                  className="w-full border-4 border-black p-4 text-center text-4xl font-black outline-none tracking-[0.5em] focus:bg-gray-50"
                  placeholder="••••"
                  maxLength={4}
                  autoFocus
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowAdminLogin(false)}
                    className="flex-1 border-4 border-black p-4 font-black uppercase text-sm hover:bg-gray-50 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={() => {
                      if (registeredAdminDeviceId && registeredAdminDeviceId !== myDeviceId) {
                        alert('Error: This device is NOT authorized for Admin access! (এই ডিভাইসটি এডমিন হিসেবে অনুমোদিত নয়)');
                        setAdminPasscode('');
                        setShowAdminLogin(false);
                        return;
                      }
                      if (adminPasscode === '1234') {
                        setIsAdmin(true);
                        localStorage.setItem('is_admin_active', 'true');
                        setShowAdminLogin(false);
                        setAdminPasscode('');
                      } else {
                        alert('Incorrect Passcode!');
                        setAdminPasscode('');
                      }
                    }}
                    className="flex-1 bg-black text-white p-4 font-black uppercase text-sm shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)]"
                  >
                    LOGIN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Edit Name Modal */}
        {editingAccount && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 border-black p-8 max-w-md w-full shadow-[16px_16px_0px_0px_rgba(0,0,0,1)]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-black uppercase tracking-tighter">EDIT PROFILE</h3>
                <button onClick={() => setEditingAccount(null)} className="border-4 border-black p-1 hover:bg-black hover:text-white transition-colors"><X /></button>
              </div>
              <form onSubmit={updateAccountName} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">নতুন নাম</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border-4 border-black p-4 font-black outline-none focus:bg-gray-50"
                  />
                </div>
                <button className="w-full bg-blue-600 text-white border-4 border-black p-5 font-black text-lg hover:bg-blue-700 transition-all shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none uppercase">
                  SAVE CHANGES
                </button>
              </form>
            </motion.div>
          </div>
        )}
        {/* Gacha Modal */}
        {showGacha && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white border-8 border-black p-6 md:p-8 max-w-lg w-full shadow-[24px_24px_0px_0px_rgba(0,0,0,1)] relative max-h-[92vh] overflow-y-auto"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
              <div className="flex justify-between items-center mb-12">
                <div>
                  <h2 className="text-5xl font-black tracking-tighter uppercase leading-none">DIR GACHA</h2>
                  <p className="text-[10px] font-black tracking-[0.3em] text-blue-600 uppercase mt-2">TEST YOUR LUCK</p>
                </div>
                <button 
                  disabled={isSpinning}
                  onClick={() => { 
                    if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
                    setShowGacha(false); 
                    setGachaResult(null); 
                    setGachaStep('IDENTIFY'); 
                    setGachaId(''); 
                    setGachaError(''); 
                    setGachaUser(null); 
                    setIsSpinning(false);
                  }} 
                  className={`border-4 border-black p-2 transition-colors ${isSpinning ? 'opacity-20 cursor-not-allowed' : 'hover:bg-black hover:text-white'}`}
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {gachaStep === 'IDENTIFY' ? (
                  <motion.div
                    key="step-identify"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-gray-100 border-4 border-black p-6">
                      <label className="block text-xs font-black uppercase tracking-widest text-black mb-4">STEP 1: IDENTITY VERIFICATION</label>
                      <input
                        type="text"
                        value={gachaId}
                        onChange={(e) => setGachaId(e.target.value.toUpperCase())}
                        placeholder="ENTER ACCOUNT NAME (e.g. VXI)"
                        className="w-full border-4 border-black p-5 bg-white font-black text-2xl placeholder:text-gray-300 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        onKeyDown={(e) => e.key === 'Enter' && handleGachaAuth()}
                      />
                      {gachaError && (
                        <p className="text-red-600 text-[10px] font-black uppercase mt-4 tracking-widest bg-red-50 p-2 border-2 border-red-600 inline-block">
                          ! {gachaError}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleGachaAuth}
                      className="w-full py-6 bg-black text-white border-4 border-black font-black text-xl uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                    >
                      VERIFY ACCOUNT & ENTER
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step-play"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex justify-between items-end border-b-4 border-black pb-3">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => { setGachaStep('IDENTIFY'); setGachaUser(null); setGachaResult(null); setGachaError(''); }}
                          className="flex items-center gap-1.5 px-2.5 py-1 border-2 border-black bg-white hover:bg-black hover:text-white transition-colors group/back"
                          disabled={isSpinning}
                        >
                          <ArrowDownLeft className="w-3.5 h-3.5 rotate-45 group-hover/back:-translate-x-0.5 transition-transform" />
                          <span className="text-[9px] font-black uppercase tracking-widest">CHANGE ACC</span>
                        </button>
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">PLAYER NAME</p>
                          <p className="text-lg font-black leading-none">{gachaUser?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">BALANCE</p>
                        <motion.p 
                          key={gachaUser?.balance}
                          initial={{ y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="text-lg font-black text-blue-600 leading-none"
                        >
                          {Math.floor(gachaUser?.balance || 0)} ৳
                        </motion.p>
                      </div>
                    </div>

                    {/* Dual Tabs */}
                    <div className="flex border-4 border-black p-1 bg-gray-100 uppercase text-xs font-black">
                      <button
                        type="button"
                        onClick={() => !isSpinning && setActiveGachaTab('SPIN')}
                        disabled={isSpinning}
                        className={`flex-1 py-2 text-center transition-all ${isSpinning ? 'opacity-50 cursor-not-allowed' : ''} ${activeGachaTab === 'SPIN' ? 'bg-black text-white' : 'hover:bg-gray-200 text-black'}`}
                      >
                        🎰 SPIN GAME (লাকি ড্র)
                      </button>
                      <button
                        type="button"
                        onClick={() => !isSpinning && setActiveGachaTab('PRIZES')}
                        disabled={isSpinning}
                        className={`flex-1 py-2 text-center transition-all ${isSpinning ? 'opacity-50 cursor-not-allowed' : ''} ${activeGachaTab === 'PRIZES' ? 'bg-black text-white' : 'hover:bg-gray-200 text-black'}`}
                      >
                        🏆 PRIZE DICTIONARY
                      </button>
                    </div>

                    {activeGachaTab === 'SPIN' ? (
                      <div className="space-y-6">
                        {/* Immersive 3D Arcade Cabinet Gacha view */}
                        <div className="h-[320px] w-full bg-slate-950 border-8 border-black flex flex-col items-center justify-center relative shadow-[inset_0_0_80px_rgba(0,0,0,1)] overflow-hidden rounded-xl">
                          {/* Inner Retro Curved Glass Scanlines & Bezel Shadows */}
                          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[size:100%_4px,3px_100%] pointer-events-none z-30 opacity-75"></div>
                          
                          {/* Rich Gradient Ambient Vignette */}
                          <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-slate-950 via-slate-950/40 to-transparent z-30 pointer-events-none"></div>
                          <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent z-30 pointer-events-none"></div>
                          
                          {/* Side Light pillars that flash red/cyan during spin */}
                          <div className={`absolute left-0 top-0 w-3 h-full z-30 transition-all duration-300 ${
                            isSpinning 
                              ? 'bg-gradient-to-b from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_15px_#facc15]' 
                              : 'bg-slate-900 border-r border-slate-800'
                          }`}></div>
                          <div className={`absolute right-0 top-0 w-3 h-full z-30 transition-all duration-300 ${
                            isSpinning 
                              ? 'bg-gradient-to-b from-yellow-400 via-orange-500 to-red-500 shadow-[0_0_15px_#facc15]' 
                              : 'bg-slate-900 border-l border-slate-800'
                          }`}></div>

                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
                            {/* 3D Perspective Stage wrapping the 3D rotating cylinder */}
                            <div className="w-full h-[180px] relative flex items-center justify-center" style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}>
                              <motion.div
                                key={`reel-${spinCount}`}
                                initial={{ rotateX: 0 }}
                                animate={{ 
                                  rotateX: targetRotation,
                                }}
                                transition={{ 
                                  type: "spring",
                                  stiffness: 30,  // Smooth and heavy feel
                                  damping: 15,    // Premium settling effect
                                  mass: 1.8,
                                }}
                                className="w-full h-[84px] relative"
                                style={{ 
                                  transformStyle: 'preserve-3d',
                                }}
                              >
                                {itemsInSet.map((item, idx) => (
                                  <div 
                                    key={idx} 
                                    className={`absolute flex items-center gap-3 px-4 py-3 border-2 rounded-2xl bg-slate-900 text-white select-none whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-300 ${
                                      !isSpinning && gachaResult && (gachaResult.category === item.cat && gachaResult.subNumber === item.subNumber)
                                        ? 'border-yellow-400 bg-slate-800 scale-105 shadow-[0_0_20px_rgba(234,179,8,0.4)]'
                                        : 'border-slate-800/80 hover:border-slate-700'
                                    }`}
                                    style={{
                                      transform: `rotateX(${idx * 24}deg) translateZ(235px)`,
                                      backfaceVisibility: 'hidden',
                                      WebkitBackfaceVisibility: 'hidden',
                                      height: '84px',
                                      width: '320px',
                                      left: 'calc(50% - 160px)',
                                    }}
                                  >
                                    <div className={`p-2 rounded-xl border-2 bg-slate-950 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] shrink-0 transition-transform duration-300 ${
                                      !isSpinning ? 'scale-110' : 'scale-100'
                                    } ${
                                      item.cat === 'MYTHICAL' ? 'border-purple-500 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.5)]' :
                                      item.cat === 'LEGENDARY' ? 'border-yellow-400 text-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.5)]' :
                                      item.cat === 'RARE' ? 'border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]' :
                                      item.cat === 'UNCOMMON' ? 'border-green-500 text-green-400 shadow-[0_0_12px_rgba(34,197,94,0.5)]' :
                                      'border-slate-600 text-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.2)]'
                                    }`}>
                                      {getCategoryIcon(item.cat)}
                                    </div>
                                    <div className="text-left overflow-hidden">
                                      <div className="flex items-center gap-1.5 mb-1 leading-none">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                                          item.cat === 'MYTHICAL' ? 'text-purple-400 animate-pulse' :
                                          item.cat === 'LEGENDARY' ? 'text-yellow-400 animate-pulse' :
                                          item.cat === 'RARE' ? 'text-blue-400' :
                                          item.cat === 'UNCOMMON' ? 'text-green-400' :
                                          'text-slate-400'
                                        }`}>
                                          {item.cat} #{item.subNumber}
                                        </span>
                                      </div>
                                      <p className="text-xs font-black text-white truncate max-w-[170px] leading-tight">
                                        {getGachaItemName(item.cat, item.subNumber)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </motion.div>
                              
                              {/* Horizontal Selector Frame Indicator that pulses and glows neon yellow */}
                              <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-40">
                                <div className="w-[336px] h-[92px] border-4 border-yellow-400 bg-yellow-400/[0.03] rounded-2xl flex items-center justify-between px-2.5 relative shadow-[0_0_35px_rgba(234,179,8,0.35),inset_0_0_15px_rgba(234,179,8,0.15)]">
                                  {/* Pulsing Side Laser Arrow Markers */}
                                  <motion.div 
                                    animate={isSpinning ? { x: [-4, 4, -4], scale: [1, 1.15, 1] } : { x: 0, scale: 1 }}
                                    transition={{ repeat: Infinity, duration: 0.35 }}
                                    className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-l-[22px] border-l-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,1)]"
                                  ></motion.div>
                                  <motion.div 
                                    animate={isSpinning ? { x: [4, -4, 4], scale: [1, 1.15, 1] } : { x: 0, scale: 1 }}
                                    transition={{ repeat: Infinity, duration: 0.35 }}
                                    className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-r-[22px] border-r-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,1)]"
                                  ></motion.div>
                                </div>
                              </div>
                            </div>
                            
                            {isSpinning && (
                              <div className="absolute bottom-4 z-[45]">
                                <p className="text-xs font-black italic tracking-[0.4em] text-white animate-pulse bg-black px-4 py-1.5 border-2 border-yellow-400 shadow-[4px_4px_0px_0px_#facc15]">SPINNING REEL</p>
                              </div>
                            )}

                            <AnimatePresence>
                              {gachaResult && !isSpinning && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="absolute inset-0 flex flex-col items-center justify-center z-50 pointer-events-auto bg-black/60 backdrop-blur-sm p-4"
                                >
                                  <motion.div 
                                    initial={{ y: 20 }}
                                    animate={{ y: 0 }}
                                    className={`bg-black text-white px-6 py-5 border-4 flex flex-col items-center text-center w-full max-w-[280px] hover:scale-102 transition-transform ${
                                      gachaResult.category === 'MYTHICAL' ? 'border-purple-500 shadow-[10px_10px_0px_0px_#a855f7]' :
                                      gachaResult.category === 'LEGENDARY' ? 'border-yellow-400 shadow-[10px_10px_0px_0px_#facc15]' :
                                      gachaResult.category === 'RARE' ? 'border-blue-500 shadow-[10px_10px_0px_0px_#3b82f6]' :
                                      gachaResult.category === 'UNCOMMON' ? 'border-green-500 shadow-[10px_10px_0px_0px_#22c55e]' :
                                      'border-slate-500 shadow-[10px_10px_0px_0px_#64748b]'
                                    }`}
                                  >
                                    <span className={`text-[10px] font-black tracking-[0.25em] uppercase mb-1 ${
                                      gachaResult.category === 'MYTHICAL' ? 'text-purple-400 animate-pulse' :
                                      gachaResult.category === 'LEGENDARY' ? 'text-yellow-400 animate-pulse' :
                                      gachaResult.category === 'RARE' ? 'text-blue-400' :
                                      gachaResult.category === 'UNCOMMON' ? 'text-green-400' : 'text-slate-400'
                                    }`}>
                                      ✨ {gachaResult.category} #{gachaResult.subNumber} ✨
                                    </span>
                                    <span className="text-sm font-black text-white leading-tight mb-2">
                                      {getGachaItemName(gachaResult.category, gachaResult.subNumber || 1)}
                                    </span>
                                    <div className="border-t border-dashed border-white/20 w-full my-2"></div>
                                    <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">PRIZE UNLOCKED</span>
                                    <span className="text-4xl font-black leading-none tracking-tighter text-yellow-300 mt-2">+{gachaResult.value} ৳</span>
                                    <span className="text-[9px] font-bold opacity-60 mt-2 uppercase tracking-[0.2em]">ADDED TO BALANCE</span>
                                    
                                    <button
                                      type="button"
                                      onClick={() => setGachaResult(null)}
                                      className="mt-4 px-4 py-1.5 bg-white text-black font-black uppercase text-xs border-2 border-black hover:bg-yellow-400 transition-colors shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]"
                                    >
                                      CLOSE & SPIN AGAIN
                                    </button>
                                  </motion.div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {!isSpinning && !gachaResult && (
                            <div className="absolute inset-0 z-40 bg-black/65 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 space-y-3">
                              <motion.div
                                animate={{ rotate: [0, 8, -8, 0] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                              >
                                 <Dices className="w-14 h-14 text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                              </motion.div>
                              <div className="space-y-1 text-center">
                                  <p className="text-white font-black uppercase tracking-wider text-xs">READY TO RUN THE ROLL?</p>
                                  <p className="text-[10px] font-black text-yellow-400 bg-white/10 px-3 py-1 border border-yellow-400/30 inline-block uppercase leading-none">1 SPIN = 150 DINER ৳</p>
                              </div>
                              <button
                                type="button"
                                onClick={handleGachaSpin}
                                className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase text-xs border-2 border-black hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_0px_0px_white] flex items-center gap-1.5 animate-pulse mt-2 cursor-pointer z-50 pointer-events-auto"
                              >
                                🎰 SPIN NOW (স্পেন করুন)
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          disabled={isSpinning}
                          onClick={handleGachaSpin}
                          className={`w-full py-5 border-4 border-black font-black text-xl uppercase tracking-[0.15em] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] active:scale-[0.99] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-3 group relative overflow-hidden ${
                            isSpinning ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-blue-600'
                          }`}
                        >
                          {isSpinning ? <RotateCw className="animate-spin w-7 h-7" /> : <Dices className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                          <div className="flex flex-col items-start leading-none text-left">
                            <span className="text-lg font-black">{isSpinning ? 'SPINNING...' : (gachaResult ? 'SPIN AGAIN' : 'ROLL THE SLOTS')}</span>
                            {!isSpinning && <span className="text-[9px] opacity-60 tracking-[0.2em] font-normal mt-0.5">- Cost: 150 ৳ -</span>}
                          </div>
                        </button>
                        
                        {gachaError && (
                          <p className="text-red-600 text-[10px] font-black uppercase mt-1 text-center tracking-widest bg-red-50 p-1 border border-red-200 inline-block w-full">
                            ! {gachaError}
                          </p>
                        )}
                      </div>
                    ) : (
                      /* Live Item & Probability Dictionary Book */
                      <div className="space-y-4">
                        <div className="bg-gray-100 border-4 border-black p-3.5">
                          <p className="text-[10px] font-black text-black uppercase tracking-widest leading-none mb-1">PROBABILITIES STATS</p>
                          <p className="text-[11px] text-gray-500 font-bold">15 collectible items in 5 tiers of rarities. Rate % checks are rolled dynamically.</p>
                        </div>
                        <div className="max-h-[340px] overflow-y-auto border-4 border-black divide-y-4 divide-black bg-white rounded-lg">
                          {itemsInSet.map((item, index) => {
                            const name = getGachaItemName(item.cat, item.subNumber);
                            let rate = '45%';
                            let valRange = '6 - 14 ৳ (EVEN)';
                            if (item.cat === 'MYTHICAL') { rate = '2%'; valRange = '150 - 250 ৳ (EVEN)'; }
                            else if (item.cat === 'LEGENDARY') { rate = '8%'; valRange = '50 - 100 ৳ (EVEN)'; }
                            else if (item.cat === 'RARE') { rate = '15%'; valRange = '20 - 44 ৳ (EVEN)'; }
                            else if (item.cat === 'UNCOMMON') { rate = '30%'; valRange = '10 - 24 ৳ (EVEN)'; }
                            
                            return (
                              <div key={`${item.cat}-${item.subNumber}-${index}`} className="p-3 bg-white hover:bg-gray-50 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-left">
                                  <div className={`p-2 border-2 border-black bg-gray-50 shrink-0 ${item.color}`}>
                                    {getCategoryIcon(item.cat)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5 leading-none mb-1">
                                      <span className={`text-[11px] font-black uppercase tracking-wider leading-none ${item.color}`}>
                                        {item.cat} #{item.subNumber}
                                      </span>
                                      <span className="text-[8px] bg-black text-white px-1.5 py-0.5 rounded-sm font-mono font-bold leading-none">
                                        Drop Rate: {rate}
                                      </span>
                                    </div>
                                    <p className="text-sm font-black text-black leading-tight">
                                      {name}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">EST. VALUE</p>
                                  <p className="text-sm font-extrabold text-blue-600 leading-none">{valRange}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {/* Penalty Shootout Soccer Game Modal */}
        {showPenaltyGame && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white border-8 border-black p-8 max-w-lg w-full shadow-[24px_24px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-green-600"></div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter uppercase leading-none flex items-center gap-2">
                    ⚽ PENALTY SHOT
                  </h2>
                  <p className="text-[10px] font-black tracking-[0.3em] text-green-600 uppercase mt-2">Score & Earn 50 Diner per goal!</p>
                </div>
                <button 
                  disabled={penaltyGameState === 'shooting'}
                  onClick={() => { 
                    setShowPenaltyGame(false); 
                    setPenaltyStep('IDENTIFY'); 
                    setPenaltyInputId(''); 
                    setPenaltyError(''); 
                    setPenaltyUser(null); 
                    setPenaltyGameState('idle');
                    setShotDirection(null);
                    setGkDirection(null);
                    setGameStreak(0);
                  }} 
                  className={`border-4 border-black p-2 transition-colors ${penaltyGameState === 'shooting' ? 'opacity-20 cursor-not-allowed' : 'hover:bg-black hover:text-white'}`}
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {showPenaltyIntro ? (
                  <motion.div
                    key="penalty-intro-screen"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.1, opacity: 0 }}
                    className="flex flex-col items-center justify-center py-10 text-center space-y-6"
                  >
                    {/* Spinning bounce Football Animation */}
                    <div className="relative">
                      <motion.div
                        animate={{ 
                          rotate: 360,
                          y: [15, -15, 15],
                          scale: [0.85, 1.15, 0.85]
                        }}
                        transition={{ 
                          rotate: { repeat: Infinity, duration: 2, ease: "linear" },
                          y: { repeat: Infinity, duration: 2, ease: "easeInOut" },
                          scale: { repeat: Infinity, duration: 2, ease: "easeInOut" }
                        }}
                        className="text-8xl select-none"
                      >
                        ⚽
                      </motion.div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-black/10 rounded-full blur-[2px] animate-pulse"></div>
                    </div>

                    {/* Dramatic Entrance Lines */}
                    <div className="space-y-3">
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-[10px] font-black tracking-[0.4em] text-green-600 uppercase"
                      >
                        🔥 MATCH KICK-OFF 🔥
                      </motion.p>
                      
                      <motion.h3
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                        className="text-3xl md:text-4xl font-extrabold tracking-tighter text-black uppercase leading-none"
                      >
                        পেনাল্টি শ্যুটআউট
                      </motion.h3>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-xs font-bold text-gray-500 max-w-xs mx-auto"
                      >
                        পেনাল্টি কিক নিয়ে গোল করুন এবং প্রতি গোলের জন্য আপনার অ্যাকাউন্টে <span className="text-green-600 font-extrabold">৫০৳ (Diner)</span> জিতে নিন!
                      </motion.p>
                    </div>

                    {/* Goal Post mini wireframe */}
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "80%", opacity: 0.2 }}
                      transition={{ delay: 0.6, duration: 0.4 }}
                      className="h-10 border-4 border-b-0 border-black relative"
                    >
                    </motion.div>
                  </motion.div>
                ) : penaltyStep === 'IDENTIFY' ? (
                  <motion.form
                    key="penalty-identify"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handlePenaltyAuth();
                    }}
                  >
                    <div className="bg-gray-100 border-4 border-black p-6">
                      <label className="block text-xs font-black uppercase tracking-widest text-black mb-4">
                        ধাপ ১: অ্যাকাউন্ট নম্বর প্রডিউস করুন
                      </label>
                      <input
                        type="text"
                        value={penaltyInputId}
                        onChange={(e) => setPenaltyInputId(e.target.value.toUpperCase())}
                        placeholder="অ্যাকাউন্ট নম্বর লিখুন (e.g. VIIX, VXIV)"
                        className="w-full border-4 border-black p-5 bg-white font-black text-2xl placeholder:text-gray-300 focus:outline-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                        onKeyDown={(e) => e.key === 'Enter' && handlePenaltyAuth()}
                      />
                      
                      {/* Live matching name indicator */}
                      {(() => {
                        const matchingAcc = data.accounts.find(a => a.accountNumber.toUpperCase() === penaltyInputId.toUpperCase());
                        if (matchingAcc) {
                          return (
                            <div className="mt-3 bg-green-100 border-2 border-green-600 p-3 flex items-center gap-2">
                              <span className="text-sm font-black text-green-800">👤 অ্যাকাউন্ট হোল্ডার: {matchingAcc.name}</span>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {penaltyError && (
                        <p className="text-red-600 text-[10px] font-black uppercase mt-4 tracking-widest bg-red-50 p-2 border-2 border-red-600 inline-block">
                          ! {penaltyError}
                        </p>
                      )}

                      {/* Quick Select Account list / Autocomplete options */}
                      <div className="mt-6 pt-4 border-t-2 border-dashed border-gray-300">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                          অথবা নিচে থেকে একাউন্ট সিলেক্ট করুন (সহজে খেলার জন্য):
                        </label>
                        <div className="max-h-40 overflow-y-auto border-4 border-black bg-white p-2 space-y-2">
                          {data.accounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setPenaltyInputId(acc.accountNumber);
                                setPenaltyError('');
                                handlePenaltyAuth(acc.accountNumber);
                              }}
                              className={`w-full flex justify-between items-center text-left p-3 font-black text-xs border-2 transition-all ${
                                penaltyInputId.toUpperCase() === acc.accountNumber.toUpperCase()
                                  ? 'bg-green-600 text-white border-black scale-[0.98]'
                                  : 'bg-white text-black border-gray-200 hover:border-black hover:bg-gray-50'
                              }`}
                            >
                              <span>{acc.name}</span>
                              <span className="font-mono text-[9px] bg-black text-white px-2 py-1 uppercase font-bold">ID: {acc.accountNumber}</span>
                            </button>
                          ))}
                          {data.accounts.length === 0 && (
                            <p className="text-[10px] text-gray-400 italic text-center py-4">কোন একাউন্ট পাওয়া যায়নি। ড্যাশবোর্ডে গিয়ে এড করুন।</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 py-4 bg-black text-white border-4 border-black font-black text-base uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-green-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center"
                      >
                        ভেরিফাই করে খেলুন
                      </button>
                      <button
                        type="button"
                        onClick={() => { 
                          setShowPenaltyGame(false); 
                          setPenaltyStep('IDENTIFY'); 
                          setPenaltyInputId(''); 
                          setPenaltyError(''); 
                          setPenaltyUser(null); 
                          setPenaltyGameState('idle');
                          setShotDirection(null);
                          setGkDirection(null);
                          setGameStreak(0);
                        }}
                        className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white border-4 border-black font-black text-base uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center"
                      >
                        বন্ধ করুন
                      </button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div
                    key="penalty-play"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-6"
                  >
                    {/* Top Player Meta Section */}
                    <div className="flex justify-between items-end border-b-4 border-black pb-4">
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => { setPenaltyStep('IDENTIFY'); setPenaltyUser(null); setGameStreak(0); setPenaltyGameState('idle'); }}
                          className="flex items-center gap-2 px-3 py-1 border-2 border-black hover:bg-black hover:text-white transition-colors group/back"
                          disabled={penaltyGameState === 'shooting'}
                        >
                          <ArrowDownLeft className="w-4 h-4 rotate-45 group-hover/back:-translate-x-1 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-widest">আইডি বদল</span>
                        </button>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PLAYER NAME</p>
                          <p className="text-lg font-black">{penaltyUser?.name}</p>
                          <p className="text-[9px] font-mono text-gray-500 font-bold leading-none mt-0.5">ID: {penaltyUser?.accountNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">BALANCE</p>
                        <motion.p 
                          key={penaltyUser?.balance}
                          initial={{ y: -10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="text-xl font-black text-green-600"
                        >
                          {Math.floor(penaltyUser?.balance || 0)} ৳
                        </motion.p>
                      </div>
                    </div>

                    {/* Game Scoreboard */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black text-yellow-400 p-2 text-center border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">STREAK / গোল ধারা 🔥</p>
                        <p className="text-2xl font-black">{gameStreak}</p>
                      </div>
                      <div className="bg-black text-green-400 p-2 text-center border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">TOTAL GOALS / মোট গোল 🏆</p>
                        <p className="text-2xl font-black">{totalScore}</p>
                      </div>
                    </div>

                    {/* Daily Limits Section */}
                    {penaltyUser && (() => {
                      const dailyStats = getDailyPenaltyCounts(penaltyUser.id);
                      return (
                        <div className="grid grid-cols-2 gap-4 border-4 border-black p-3 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <div className="text-center">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">SHOTS TODAY / আজকের শট</p>
                            <p className="text-lg font-black mt-1">
                              <span className={dailyStats.attempts >= 10 ? 'text-red-600' : 'text-black'}>
                                {dailyStats.attempts}
                              </span> <span className="text-xs text-gray-400">/ ১০</span>
                            </p>
                          </div>
                          <div className="text-center border-l-4 border-black">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">GOALS TODAY / আজকের গোল</p>
                            <p className="text-lg font-black mt-1">
                              <span className={dailyStats.goals >= 10 ? 'text-red-500 animate-pulse' : 'text-green-600'}>
                                {dailyStats.goals}
                              </span> <span className="text-xs text-gray-400">/ ১০</span>
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Penalty Kick Arena Lawn */}
                    <div className="w-full h-80 bg-gradient-to-b from-green-800 via-green-700 to-green-600 border-8 border-black rounded-lg relative overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.3)]">
                      
                      {/* Net Backdrop & Goalposts lines */}
                      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-72 h-32 border-4 border-b-0 border-white/80 bg-white/5 z-0 flex flex-col justify-between">
                        {/* Net Cross Bars styling */}
                        <div className="w-full h-full opacity-10" style={{ 
                          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', 
                          backgroundSize: '10px 10px' 
                        }}></div>
                        {/* Goal line */}
                        <div className="w-full h-[2px] bg-white opacity-40"></div>
                      </div>

                      {/* Pitch Lines decorations */}
                      <div className="absolute bottom-0 left-12 right-12 h-16 border-2 border-b-0 border-white/20 rounded-t-full pointer-events-none"></div>
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white/50 pointer-events-none"></div>

                      {/* Goalkeeper character sprite with dynamic positioning animation */}
                      <div 
                        className={`absolute transition-all duration-700 ease-out z-20 flex flex-col items-center justify-center ${
                          (penaltyGameState === 'shooting' || penaltyGameState === 'goal' || penaltyGameState === 'save')
                            ? (gkDirection === 'top_left' ? 'top-8 left-[25%] -translate-x-1/2 scale-90 -rotate-[30deg]'
                             : gkDirection === 'top_right' ? 'top-8 right-[25%] translate-x-1/2 scale-90 rotate-[30deg]'
                             : gkDirection === 'left' ? 'top-16 left-[20%] -translate-x-1/2 -rotate-45'
                             : gkDirection === 'right' ? 'top-16 right-[20%] translate-x-1/2 rotate-45'
                             : 'top-12 left-1/2 -translate-x-1/2 scale-110')
                            : 'top-10 left-1/2 -translate-x-1/2 scale-100 animate-bounce'
                        }`}
                        style={{ transitionTimingFunction: 'cubic-bezier(0.12, 0, 0.39, 1)' }}
                      >
                        <div className="w-14 h-14 bg-black border-4 border-yellow-400 text-yellow-400 rounded-full flex items-center justify-center font-black text-2xl shadow-lg">
                          {penaltyGameState === 'save' ? '😎' : penaltyGameState === 'goal' ? '😭' : '🧤'}
                        </div>
                        <span className="text-[7px] font-black tracking-widest text-white bg-black px-1.5 py-[1px] mt-1 border border-white uppercase leading-none">AI GOALIE</span>
                      </div>

                      {/* Floating Target Nodes to Trigger Shot */}
                      {penaltyGameState === 'idle' && (
                        <>
                          {/* Top Left */}
                          <button 
                            onClick={() => handleShoot('top_left')}
                            className="absolute top-12 left-[25%] -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-dashed border-yellow-300 bg-yellow-300/10 hover:bg-yellow-300/40 flex items-center justify-center text-white text-base transition-all hover:scale-125 z-40 animate-pulse"
                            title="Top Left"
                          >
                            🎯
                          </button>
                          {/* Top Right */}
                          <button 
                            onClick={() => handleShoot('top_right')}
                            className="absolute top-12 right-[25%] translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-dashed border-yellow-300 bg-yellow-300/10 hover:bg-yellow-300/40 flex items-center justify-center text-white text-base transition-all hover:scale-125 z-40 animate-pulse"
                            title="Top Right"
                          >
                            🎯
                          </button>
                          {/* Bottom/Mid Left */}
                          <button 
                            onClick={() => handleShoot('left')}
                            className="absolute top-24 left-[20%] -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-dashed border-yellow-300 bg-yellow-300/10 hover:bg-yellow-300/40 flex items-center justify-center text-white text-base transition-all hover:scale-125 z-40 animate-pulse"
                            title="Left"
                          >
                            🎯
                          </button>
                          {/* Bottom/Mid Right */}
                          <button 
                            onClick={() => handleShoot('right')}
                            className="absolute top-24 right-[20%] translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-dashed border-yellow-300 bg-yellow-300/10 hover:bg-yellow-300/40 flex items-center justify-center text-white text-base transition-all hover:scale-125 z-40 animate-pulse"
                            title="Right"
                          >
                            🎯
                          </button>
                          {/* Center */}
                          <button 
                            onClick={() => handleShoot('center')}
                            className="absolute top-20 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 border-dashed border-yellow-300 bg-yellow-300/10 hover:bg-yellow-300/40 flex items-center justify-center text-white text-base transition-all hover:scale-125 z-40 animate-pulse"
                            title="Center"
                          >
                            🎯
                          </button>
                        </>
                      )}

                      {/* Football Sprite representing physical action trajectory */}
                      <div 
                        className={`absolute transition-all duration-[750ms] border-black z-30 ${
                          (penaltyGameState === 'shooting' || penaltyGameState === 'goal' || penaltyGameState === 'save')
                            ? (shotDirection === 'top_left' ? 'top-[44px] left-[26%] scale-[0.4] rotate-[540deg]'
                             : shotDirection === 'top_right' ? 'top-[44px] right-[26%] scale-[0.4] rotate-[540deg]'
                             : shotDirection === 'left' ? 'top-[75px] left-[21%] scale-[0.45] rotate-[540deg]'
                             : shotDirection === 'right' ? 'top-[75px] right-[21%] scale-[0.45] rotate-[540deg]'
                             : 'top-[68px] left-1/2 -translate-x-1/2 scale-[0.45] rotate-[540deg]')
                            : 'bottom-6 left-1/2 -translate-x-1/2 scale-100 hover:scale-110 cursor-pointer'
                        }`}
                        style={{ transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)' }}
                      >
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-black flex items-center justify-center shadow-lg relative overflow-hidden">
                          <span className="text-xl">⚽</span>
                        </div>
                      </div>

                      {/* Shooting Status Alert Overlay */}
                      {penaltyGameState === 'shooting' && (
                        <div className="absolute inset-x-0 bottom-4 text-center z-50">
                          <span className="bg-black text-white text-xs font-black tracking-[0.2em] px-4 py-1.5 border-2 border-white uppercase italic animate-pulse">
                            SHOOTING / কিক নেওয়া হচ্ছে...
                          </span>
                        </div>
                      )}

                      {/* Goal Celebration Overlay banner */}
                      {penaltyGameState === 'goal' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4 z-50">
                          <motion.div 
                            initial={{ scale: 0.5, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-green-600 text-white p-5 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center w-full max-w-sm"
                          >
                            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-yellow-300">GOOOOOAAAAL!!! ⚽🎉</span>
                            <span className="text-4xl font-extrabold tracking-tight my-1">চমৎকার গোল!</span>
                            <span className="text-2xl font-black text-yellow-300">+৫০ Diner অর্জিত</span>
                            <button 
                              onClick={() => { setPenaltyGameState('idle'); setShotDirection(null); setGkDirection(null); }}
                              className="mt-4 px-6 py-2 bg-black text-white font-black text-xs border-2 border-white hover:bg-white hover:text-black hover:border-black transition-all uppercase tracking-widest"
                            >
                              আবার কিক নিন
                            </button>
                          </motion.div>
                        </div>
                      )}

                      {/* Save/Caught Feedback Overlay banner */}
                      {penaltyGameState === 'save' && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4 z-50">
                          <motion.div 
                            initial={{ scale: 0.5, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-red-650 bg-red-600 text-white p-5 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center w-full max-w-sm"
                          >
                            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-200">SAVED 🧤😞</span>
                            <span className="text-3xl font-extrabold tracking-tight my-1">গোলকিপার আটকে দিয়েছে!</span>
                            <span className="text-xs font-bold text-gray-200 opacity-90 mt-1">আবার লক্ষ্যবস্তুতে শুট করুন।</span>
                            <button 
                              onClick={() => { setPenaltyGameState('idle'); setShotDirection(null); setGkDirection(null); }}
                              className="mt-4 px-6 py-2 bg-black text-white font-black text-xs border-2 border-white hover:bg-white hover:text-black hover:border-black transition-all uppercase tracking-widest"
                            >
                              আবার চেষ্টা করুন
                            </button>
                          </motion.div>
                        </div>
                      )}
                    </div>

                    <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                      টিপস: গোলপোস্টের যেকোনো একটি <span className="text-yellow-600 font-extrabold">লক্ষ্যবস্তু (🎯)</span> সিলেক্ট করে শুট করুন!
                    </p>

                    <button
                      type="button"
                      disabled={penaltyGameState === 'shooting'}
                      onClick={() => { 
                        setShowPenaltyGame(false); 
                        setPenaltyStep('IDENTIFY'); 
                        setPenaltyInputId(''); 
                        setPenaltyError(''); 
                        setPenaltyUser(null); 
                        setPenaltyGameState('idle');
                        setShotDirection(null);
                        setGkDirection(null);
                        setGameStreak(0);
                      }}
                      className="w-full py-4 bg-red-600 hover:bg-red-700 text-white border-4 border-black font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.01] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center flex items-center justify-center gap-2"
                    >
                      🚪 খেলা শেষ করে বের হোন (Exit Game)
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}

        {/* Cricket Match Game Modal */}
        {showCricketGame && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="bg-white border-8 border-black p-8 max-w-lg w-full shadow-[24px_24px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-yellow-500"></div>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-4xl font-black tracking-tighter uppercase leading-none flex items-center gap-2">
                    🏏 CRICKET MATCH
                  </h2>
                  <p className="text-[10px] font-black tracking-[0.3em] text-yellow-600 uppercase mt-2">Hit Boundary & Earn 50 Diner per boundary!</p>
                </div>
                <button 
                  disabled={cricketGameState === 'batting'}
                  onClick={() => { 
                    setShowCricketGame(false); 
                    setCricketStep('IDENTIFY'); 
                    setCricketInputId(''); 
                    setCricketError(''); 
                    setCricketUser(null); 
                    setCricketGameState('idle');
                    setHitDirection(null);
                    setBowlerBall(null);
                    setCricketStreak(0);
                  }}
                  className="p-1 border-4 border-black hover:bg-black hover:text-white transition-colors cursor-pointer bg-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {showCricketIntro ? (
                  <motion.div
                    key="cricket-intro-screen"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.1, opacity: 0 }}
                    className="flex flex-col items-center justify-center py-10 text-center space-y-6"
                  >
                    {/* Spinning bounce Cricket Ball & Bat Animation */}
                    <div className="relative">
                      <motion.div
                        animate={{ 
                          rotate: -360,
                          y: [15, -15, 15],
                          scale: [0.85, 1.15, 0.85]
                        }}
                        transition={{ 
                          rotate: { repeat: Infinity, duration: 2.2, ease: "linear" },
                          y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
                          scale: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
                        }}
                        className="text-8xl select-none"
                      >
                        🏏
                      </motion.div>
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-black/10 rounded-full blur-[2px] animate-pulse"></div>
                    </div>

                    {/* Dramatic Entrance Lines */}
                    <div className="space-y-3">
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-[10px] font-black tracking-[0.4em] text-yellow-600 uppercase"
                      >
                        ⚡ TOURNAMENT MODE ON ⚡
                      </motion.p>
                      
                      <motion.h3
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5, type: 'spring' }}
                        className="text-3xl md:text-4xl font-extrabold tracking-tighter text-black uppercase leading-none"
                      >
                        ক্রিকেট ম্যাচ
                      </motion.h3>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="text-xs font-bold text-gray-500 max-w-xs mx-auto"
                      >
                        ক্রিকেট ম্যাচে বাউন্ডারি (৪ অথবা ৬) মেরে প্রতি বাউন্ডারির জন্য আপনার অ্যাকাউন্টে <span className="text-yellow-600 font-extrabold">৫০৳ (Diner)</span> জিতে নিন!
                      </motion.p>
                    </div>

                    {/* Pitch mini wireframe */}
                    <motion.div
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: "80%", opacity: 0.2 }}
                      transition={{ delay: 0.6, duration: 0.4 }}
                      className="h-10 border-4 border-b-0 border-black relative"
                    >
                    </motion.div>
                  </motion.div>
                ) : cricketStep === 'IDENTIFY' ? (
                  <motion.form
                    key="cricket-identify"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={(e) => { e.preventDefault(); handleCricketAuth(); }}
                    className="space-y-6"
                  >
                    <div className="border-4 border-black p-5 bg-yellow-50/50 space-y-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">খেলার আইডি (ACCOUNT NUMBER OR ID)</label>
                        <div className="relative">
                          <input 
                            type="text" 
                            required
                            autoFocus
                            placeholder="যেমন: F-1002"
                            value={cricketInputId}
                            onChange={(e) => setCricketInputId(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && handleCricketAuth()}
                            className="w-full px-4 py-4 bg-white border-4 border-black font-black text-xl placeholder-gray-300 focus:outline-none focus:bg-yellow-50 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] uppercase tracking-wide transition-all"
                          />
                          <button
                            type="submit"
                            title="Verify ID"
                            className="absolute right-3 top-3 p-1.5 bg-black hover:bg-yellow-500 hover:text-black text-white border-2 border-black transition-colors"
                          >
                            <ArrowUpRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {/* Instant Match Search Results helper */}
                      <div className="space-y-2">
                        <p className="text-[10px] font-black tracking-widest uppercase text-gray-400">SELECT FROM MATCHING LIST / নিচের আইডি লিস্ট</p>
                        <div className="max-h-36 overflow-y-auto border-2 border-black divide-y-2 divide-black">
                          {data.accounts
                            .filter(acc => 
                              !cricketInputId || 
                              acc.accountNumber.toUpperCase().includes(cricketInputId.toUpperCase()) ||
                              acc.name.toUpperCase().includes(cricketInputId.toUpperCase())
                            )
                            .map(acc => {
                              const dailyCount = getDailyCricketCounts(acc.id);
                              const isDisallowed = dailyCount.attempts >= 10 || dailyCount.goals >= 10;
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => {
                                    setCricketInputId(acc.accountNumber);
                                    setCricketError('');
                                    handleCricketAuth(acc.accountNumber);
                                  }}
                                  className="w-full text-left p-2.5 font-bold hover:bg-yellow-500 hover:text-black text-xs flex justify-between items-center transition-colors bg-white group"
                                >
                                  <div>
                                    <span className="text-[10px] font-black font-mono text-gray-400 block group-hover:text-black/50">ID: {acc.accountNumber}</span>
                                    <span className="text-sm font-black text-black">{acc.name}</span>
                                  </div>
                                  <div className="flex flex-col items-end text-right">
                                    <span className="text-[10px] text-green-600 font-extrabold">{acc.balance} ৳</span>
                                    <span className="text-[8px] font-black text-gray-400 italic">
                                      {isDisallowed ? 'সীমা শেষ (Limit Reached)' : `আজ খেলেছেন: ${dailyCount.attempts}/১০ বার`}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>

                      {cricketError && (
                        <p className="text-red-500 bg-red-100 text-red-700 p-3 text-xs font-black uppercase text-center border-2 border-red-600 animate-bounce">
                          ! {cricketError}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-4">
                      <button
                        type="submit"
                        className="flex-1 py-4 bg-black text-white border-4 border-black font-black text-base uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-500 hover:text-black active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center"
                      >
                        ভেরিফাই করে খেলুন
                      </button>
                      <button
                        type="button"
                        onClick={() => { 
                          setShowCricketGame(false); 
                          setCricketStep('IDENTIFY'); 
                          setCricketInputId(''); 
                          setCricketError(''); 
                          setCricketUser(null); 
                          setCricketGameState('idle');
                          setHitDirection(null);
                          setBowlerBall(null);
                          setCricketStreak(0);
                        }}
                        className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white border-4 border-black font-black text-base uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center"
                      >
                        বন্ধ করুন
                      </button>
                    </div>
                  </motion.form>
                ) : (
                  <motion.div
                    key="cricket-play"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    {/* User Mini Card */}
                    <div className="flex justify-between items-center border-4 border-black p-4 bg-yellow-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div>
                        <p className="text-lg font-black">{cricketUser?.name}</p>
                        <p className="text-[9px] font-mono text-gray-500 font-bold leading-none mt-0.5">ID: {cricketUser?.accountNumber}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <button
                            onClick={() => { setCricketStep('IDENTIFY'); setCricketUser(null); setCricketStreak(0); setCricketGameState('idle'); }}
                            className="text-[8px] bg-black text-yellow-500 font-black tracking-widest px-1.5 py-0.5 hover:bg-yellow-500 hover:text-black transition-colors uppercase"
                          >
                            CHANGE ID / আইডি পরিবর্তন
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-none">CURRENT BALANCE / ব্যাংকের ব্যালেন্স</p>
                        <motion.p 
                          key={cricketUser?.balance}
                          initial={{ scale: 1.2, color: '#f59e0b' }}
                          animate={{ scale: 1, color: '#000000' }}
                          className="text-2xl font-black mt-1"
                        >
                          {Math.floor(cricketUser?.balance || 0)} ৳
                        </motion.p>
                      </div>
                    </div>

                    {/* Streak & Score Trackers */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black text-yellow-400 p-2 text-center border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">STREAK / টানা বাউন্ডারি 🔥</p>
                        <p className="text-2xl font-black">{cricketStreak}</p>
                      </div>
                      <div className="bg-black text-green-400 p-2 text-center border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">TOTAL BOUNDARIES / মোট বাউন্ডারি 🏆</p>
                        <p className="text-2xl font-black">{totalCricketScore}</p>
                      </div>
                    </div>

                    {/* Daily Limits Section */}
                    {cricketUser && (() => {
                      const dailyStats = getDailyCricketCounts(cricketUser.id);
                      return (
                        <div className="grid grid-cols-2 gap-4 border-4 border-black p-3 bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                          <div className="text-center">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">BALLS TODAY / আজকের শট</p>
                            <p className="text-lg font-black mt-1">
                              <span className={dailyStats.attempts >= 10 ? 'text-red-500 font-extrabold' : 'text-black'}>
                                {dailyStats.attempts}
                              </span> <span className="text-xs text-gray-400">/ ১০</span>
                            </p>
                          </div>
                          <div className="text-center border-l-4 border-black">
                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">BOUNDARIES TODAY / আজকের গোল</p>
                            <p className="text-lg font-black mt-1">
                              <span className={dailyStats.goals >= 10 ? 'text-red-500 animate-pulse' : 'text-green-600'}>
                                {dailyStats.goals}
                              </span> <span className="text-xs text-gray-400">/ ১০</span>
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Cricket Stadium Pitch Turf */}
                    <div className="w-full h-80 bg-gradient-to-b from-emerald-800 via-emerald-700 to-emerald-600 border-8 border-black rounded-lg relative overflow-hidden shadow-[inset_0_0_80px_rgba(0,0,0,0.3)]">
                      
                      {/* Cricket Pitch rectangle styling */}
                      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-32 border-l-2 border-r-2 border-dashed border-white/20 bg-yellow-900/10 z-0 flex flex-col justify-between">
                        {/* Crease markings */}
                        <div className="w-full h-10 border-b-2 border-white/40 bg-yellow-900/10"></div>
                        <div className="w-full h-10 border-t-2 border-white/40 bg-yellow-900/10"></div>
                      </div>

                      {/* Pitch boundaries */}
                      <div className="absolute bottom-0 left-12 right-12 h-16 border-2 border-b-0 border-white/10 rounded-t-full pointer-events-none"></div>

                      {/* Bowling wickets */}
                      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                        <div className="w-1.5 h-6 bg-white border-r border-black/40"></div>
                        <div className="w-1.5 h-6 bg-white border-r border-black/40"></div>
                        <div className="w-1.5 h-6 bg-white border-r border-black/40"></div>
                        <div className="absolute -top-1 left-0 right-0 h-1 bg-yellow-650 rounded"></div>
                      </div>

                      {/* Batting wickets */}
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                        <div className="w-1.5 h-6 bg-white border-r border-black/40"></div>
                        <div className="w-1.5 h-6 bg-white border-r border-black/40"></div>
                        <div className="w-1.5 h-6 bg-white border-r border-black/40"></div>
                        <div className="absolute -top-1 left-0 right-0 h-1 bg-yellow-650 rounded"></div>
                      </div>

                      {/* Bowler running up / animation */}
                      <motion.div 
                        animate={cricketGameState === 'batting' ? {
                          y: [16, 120, 16],
                          scale: [0.7, 1.2, 0.7]
                        } : {}}
                        transition={{ duration: 1.5, ease: "easeInOut" }}
                        className="absolute top-10 left-1/2 -translate-x-1/2 text-2xl select-none z-10 pointer-events-none filter drop-shadow-md"
                      >
                        🏃‍♂️
                      </motion.div>

                      {/* Cricket Ball state animations */}
                      <AnimatePresence>
                        {cricketGameState === 'batting' && (
                          <motion.div
                            initial={{ 
                              x: "0%", 
                              y: "40px", 
                              scale: 0.5 
                            }}
                            animate={{ 
                              x: hitDirection === 'left' ? "-80px" : hitDirection === 'right' ? "80px" : "0px",
                              y: "220px", 
                              scale: 1.4,
                              rotate: 360
                            }}
                            transition={{ duration: 1.2, ease: "easeOut" }}
                            className="absolute left-1/2 -translate-x-1/2 text-3xl select-none z-20 pointer-events-none"
                          >
                            🥎
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Batsman Character swing animation */}
                      <motion.div
                        animate={cricketGameState === 'batting' ? {
                          scale: [1, 1.3, 1],
                          rotate: [0, -30, 45, 0],
                        } : {}}
                        transition={{ duration: 1.5 }}
                        className="absolute bottom-12 left-1/2 -translate-x-1/2 text-4xl select-none z-10"
                      >
                        🏏
                      </motion.div>

                      {/* Target Select Overlay markers */}
                      {cricketGameState === 'idle' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-30 p-4 transition-all">
                          <div className="text-center space-y-4 w-full">
                            <p className="text-[10px] font-black tracking-widest text-yellow-400 uppercase leading-none bg-black/70 inline-block px-3 py-1.5 border border-black/50">
                              CHOOSE HITTING CORNER / মারার দিক সিলেক্ট করুন
                            </p>
                            <div className="flex justify-center gap-4 w-full">
                              <button
                                onClick={() => handleBat('left')}
                                className="px-4 py-3 bg-white text-black font-black text-xs border-4 border-black hover:bg-yellow-500 hover:text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all uppercase flex flex-col items-center gap-1 min-w-[75px]"
                              >
                                🎯 LEFT
                                <span className="text-[7px] text-gray-400 font-bold leading-none mt-0.5">অফ সাইড</span>
                              </button>
                              <button
                                onClick={() => handleBat('straight')}
                                className="px-4 py-3 bg-white text-black font-black text-xs border-4 border-black hover:bg-yellow-500 hover:text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all uppercase flex flex-col items-center gap-1 min-w-[75px]"
                              >
                                🎯 STRAIGHT
                                <span className="text-[7px] text-gray-400 font-bold leading-none mt-0.5">সরাসরি</span>
                              </button>
                              <button
                                onClick={() => handleBat('right')}
                                className="px-4 py-3 bg-white text-black font-black text-xs border-4 border-black hover:bg-yellow-500 hover:text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all uppercase flex flex-col items-center gap-1 min-w-[75px]"
                              >
                                🎯 RIGHT
                                <span className="text-[7px] text-gray-400 font-bold leading-none mt-0.5">লেগ সাইড</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Batting action animation in progress loader */}
                      {cricketGameState === 'batting' && (
                        <div className="absolute inset-x-0 bottom-1/2 translate-y-1/2 flex items-center justify-center z-30">
                          <div className="bg-black text-white px-5 py-3 border-4 border-black font-black text-lg uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                            <span className="animate-spin inline-block">🥎</span>
                            বোলার বল করছে...
                          </div>
                        </div>
                      )}

                      {/* OUT Screen Overlay */}
                      {cricketGameState === 'out' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30 p-4">
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-red-600 text-white p-5 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center w-full max-w-sm"
                          >
                            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-200">OUT! 🧤😞</span>
                            <span className="text-3xl font-extrabold tracking-tight my-1">উইকেট পড়ে গেছে!</span>
                            <span className="text-xs font-bold text-gray-200 opacity-90 mt-1">ফিল্ডার ক্যাচ লুফে নিয়েছে। আবার মারুন।</span>
                            <button 
                              onClick={() => { setCricketGameState('idle'); setHitDirection(null); setBowlerBall(null); }}
                              className="mt-4 px-6 py-2 bg-black text-white font-black text-xs border-2 border-white hover:bg-white hover:text-black hover:border-black transition-all uppercase tracking-widest"
                            >
                              আবার চেষ্টা করুন
                            </button>
                          </motion.div>
                        </div>
                      )}

                      {/* BOUNDARY SUCCESS Screen Overlay */}
                      {cricketGameState === 'boundary' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-30 p-4">
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-yellow-500 text-black p-6 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col items-center w-full max-w-sm text-center"
                          >
                            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-black/60">SIXER/BOUNDARY 🏏🔥</span>
                            <span className="text-4xl font-extrabold tracking-tighter my-1 animate-bounce">বাউন্ডারি হয়েছে!</span>
                            <span className="text-sm font-black bg-black text-yellow-400 px-3 py-1 mt-1 border-2 border-black inline-block">
                              + ৫০৳ দিনাজপুর ব্যালেন্স জয়!
                            </span>
                            <button 
                              onClick={() => { setCricketGameState('idle'); setHitDirection(null); setBowlerBall(null); }}
                              className="mt-4 px-6 py-2 bg-black text-white font-black text-xs border-2 border-black hover:bg-white hover:text-black transition-all uppercase tracking-widest"
                            >
                              পরের বল খেলুন
                            </button>
                          </motion.div>
                        </div>
                      )}
                    </div>

                    <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                      টিপস: পিচের যেকোনো একটি <span className="text-yellow-600 font-extrabold">মারার কোণ (🎯)</span> সিলেক্ট করে ফেস করুন!
                    </p>

                    <button
                      type="button"
                      disabled={cricketGameState === 'batting'}
                      onClick={() => { 
                        setShowCricketGame(false); 
                        setCricketStep('IDENTIFY'); 
                        setCricketInputId(''); 
                        setCricketError(''); 
                        setCricketUser(null); 
                        setCricketGameState('idle');
                        setHitDirection(null);
                        setBowlerBall(null);
                        setCricketStreak(0);
                      }}
                      className="w-full py-4 bg-red-600 hover:bg-red-700 text-white border-4 border-black font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.01] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-center flex items-center justify-center gap-2"
                    >
                      🚪 খেলা শেষ করে বের হোন (Exit Game)
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

