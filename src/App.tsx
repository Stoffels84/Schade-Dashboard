/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  Search, 
  Filter,
  Bus, 
  MapPin, 
  Calendar, 
  ExternalLink, 
  AlertCircle,
  BarChart3,
  FileSpreadsheet,
  X,
  LayoutDashboard,
  Trophy,
  Menu,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Database,
  Clock,
  Lock,
  User,
  FileText
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { DamageRecord, DashboardStats } from './types';
import { cn } from './lib/utils';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const EXCLUDED_HEADERS = [
  'personeelsnr', 'Personeelsnr', 'ID', 'stamnr',
  'Naam', 'naam', 'Chauffeur', 'Bestuurder', 'Volledige Naam',
  'datum', 'Datum',
  'bus/tram', 'Bus/Tram', 'Voertuig', 'voertuig',
  'Type', 'type',
  'link', 'Link',
  'TEAMCOACH', 'Teamcoach', 'teamcoach'
].map(h => h.toLowerCase().trim());

function Login({ onLogin, isLoading }: { onLogin: (user: string, pass: string) => void, isLoading: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    if (!username || !password) {
      setError('Vul zowel gebruikersnaam als wachtwoord in.');
      return;
    }
    onLogin(username, password);
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden"
      >
        <div className="bg-emerald-600 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-bold">OT Gent</h1>
          <p className="text-emerald-100 mt-1">Analyse en rapportering</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
              <User size={16} /> Gebruikersnaam
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50"
              placeholder="Je naam"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-700 flex items-center gap-2">
              <Lock size={16} /> Wachtwoord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                Laden...
              </>
            ) : (
              'Inloggen'
            )}
          </button>
          
          {isLoading && (
            <p className="text-center text-xs text-zinc-400 italic">
              Gebruikersgegevens worden geladen...
            </p>
          )}
        </form>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<'dashboard' | 'topcrashers' | 'locatie' | 'voertuig' | 'seniority'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [data, setData] = useState<DamageRecord[]>([]);
  const [seniorityData, setSeniorityData] = useState<any[]>([]);
  const [personnelInfo, setPersonnelInfo] = useState<any>(null);
  const [coachingData, setCoachingData] = useState<{ requested: any[], completed: any[] }>({ requested: [], completed: [] });
  const [personnelStatus, setPersonnelStatus] = useState<string>('idle');
  const [headers, setHeaders] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<any[]>([]);
  const [fileStatuses, setFileStatuses] = useState<Record<string, { status: 'success' | 'error' | 'not_found', message?: string }>>({});
  const [loginError, setLoginError] = useState<string | null>(null);

  const groupedSeniorityData = useMemo(() => {
    if (!seniorityData.length) return [];

    const bins: Record<string, { total: number; count: number }> = {};
    
    seniorityData.forEach(item => {
      const years = parseInt(item.Dienstjaren);
      const schades = parseFloat(item.schades);
      if (isNaN(years) || isNaN(schades)) return;
      
      let label = "";
      if (years <= 5) {
        label = "0 tot 5";
      } else {
        const binIndex = Math.ceil((years - 5) / 5);
        const start = 5 + (binIndex - 1) * 5 + 1;
        const end = 5 + binIndex * 5;
        label = `${start} tot ${end}`;
      }
      
      if (!bins[label]) {
        bins[label] = { total: 0, count: 0 };
      }
      bins[label].total += schades;
      bins[label].count += 1;
    });

    return Object.entries(bins)
      .map(([label, data]) => ({ 
        label, 
        avg: parseFloat((data.total / data.count).toFixed(2)), 
        personCount: data.count,
        sortKey: label === "0 tot 5" ? 0 : parseInt(label.split(' ')[0])
      }))
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [seniorityData]);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [typeSearch, setTypeSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ftpStatus, setFtpStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const processRawData = useCallback((rawData: any[]) => {
    if (rawData.length > 0) {
      setHeaders(Object.keys(rawData[0]));
    }

    const mappedData: DamageRecord[] = rawData.map((row: any) => {
      const rawType = String(row['Type'] || row['type'] || '').trim();
      let voertuigCategory = 'Overig';
      const lowerType = rawType.toLowerCase();
      
      if (lowerType.includes('standaard')) voertuigCategory = 'Standaard';
      else if (lowerType.includes('gelede')) voertuigCategory = 'Gelede';
      else if (lowerType.includes('flexity')) voertuigCategory = 'Flexity';
      else if (lowerType.includes('hermelijn')) voertuigCategory = 'Hermelijn';
      else if (rawType) voertuigCategory = rawType;

      const busTramMode = String(row['bus/tram'] || row['Bus/Tram'] || row['Voertuig'] || row['voertuig'] || '').trim();

      const damageTypeValue = String(
        row['Schade'] || 
        row['schade'] || 
        row['Soort'] || 
        row['soort'] || 
        row['Type Schade'] || 
        row['Schade Type'] || 
        row['Omschrijving'] || 
        ''
      ).trim();

      return {
        personeelsnr: String(row['personeelsnr'] || row['Personeelsnr'] || row['ID'] || row['stamnr'] || '').trim(),
        naam: String(
          row['Volledige Naam'] || 
          row['volledige naam'] || 
          row['Volledige naam'] || 
          row['VOLLEDIGE NAAM'] || 
          row['Naam'] || 
          row['naam'] || 
          row['Chauffeur'] || 
          row['Bestuurder'] || 
          row['bestuurder'] || 
          row['TEAMCOACH'] || 
          row['Teamcoach'] || 
          'Onbekend'
        ).trim(),
        locatie: String(row['locatie'] || row['Locatie'] || row['Plaats'] || '').trim(),
        datum: (row['Datum'] || row['datum']) instanceof Date 
          ? `${String((row['Datum'] || row['datum']).getDate()).padStart(2, '0')}-${String((row['Datum'] || row['datum']).getMonth() + 1).padStart(2, '0')}-${(row['Datum'] || row['datum']).getFullYear()}`
          : String(row['Datum'] || row['datum'] || ''),
        link: String(row['link'] || row['Link'] || '').trim(),
        type: voertuigCategory,
        damageType: damageTypeValue || 'Onbekend',
        bus_tram: busTramMode || 'Onbekend',
        rawData: row,
      };
    }).filter(r => r.personeelsnr);

    setData(mappedData);
  }, []);

  const fetchFTPData = useCallback(async () => {
    setIsLoading(true);
    setFtpStatus('loading');
    setError(null);
    try {
      const response = await fetch('/api/data');
      const result = await response.json();
      if (result.success) {
        processRawData(result.data);
        if (result.seniorityData) {
          setSeniorityData(result.seniorityData);
        }
        if (result.personnelData) {
          setPersonnelInfo(result.personnelData);
        }
        if (result.coachingData) {
          setCoachingData(result.coachingData);
        }
        if (result.allowedUsers) {
          setAllowedUsers(result.allowedUsers);
        }
        if (result.fileStatuses) {
          setFileStatuses(result.fileStatuses);
        }
        setFtpStatus('success');
      } else {
        setError(result.error);
        if (result.error.includes("Configuratie ontbreekt")) {
          setFtpStatus('idle');
        } else {
          setFtpStatus('error');
        }
      }
    } catch (err) {
      console.error("Failed to fetch FTP data:", err);
      setFtpStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [processRawData]);

  useEffect(() => {
    fetchFTPData();
  }, [fetchFTPData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        
        const wsname = 'BRON';
        const ws = wb.Sheets[wsname];
        
        if (!ws) {
          throw new Error('Tabblad "BRON" niet gevonden in het Excel bestand.');
        }

        const rawData = XLSX.utils.sheet_to_json(ws) as any[];
        processRawData(rawData);
      } catch (err: any) {
        setError(err.message || 'Fout bij het inlezen van het bestand.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Bestand kon niet worden gelezen.');
      setIsLoading(false);
    };
    reader.readAsBinaryString(file);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = !searchQuery || item.personeelsnr.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesVehicle = !vehicleSearch || item.bus_tram.toLowerCase().includes(vehicleSearch.toLowerCase());
      const matchesType = !typeSearch || item.type === typeSearch;
      
      let matchesDate = true;
      if (startDate || endDate) {
        // Parse DD-MM-YYYY or other formats to Date object
        let itemDate: Date | null = null;
        const parts = item.datum.split(/[-/]/).map(Number);
        
        if (parts.length === 3) {
          // Check if it's DD-MM-YYYY or YYYY-MM-DD
          if (parts[0] > 1000) {
            // YYYY-MM-DD
            itemDate = new Date(parts[0], parts[1] - 1, parts[2]);
          } else {
            // DD-MM-YYYY
            itemDate = new Date(parts[2], parts[1] - 1, parts[0]);
          }
        }

        if (itemDate && !isNaN(itemDate.getTime())) {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (itemDate < start) matchesDate = false;
          }
          
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (itemDate > end) matchesDate = false;
          }
        }
      }

      return matchesSearch && matchesVehicle && matchesType && matchesDate;
    });
  }, [data, searchQuery, vehicleSearch, typeSearch, startDate, endDate]);

  const uniqueTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach(item => {
      if (item.type) types.add(item.type);
    });
    return Array.from(types).sort();
  }, [data]);
  const stats = useMemo((): DashboardStats => {
    const targetData = filteredData;
    
    const typeCount: Record<string, number> = {};
    const vehicleCount: Record<string, number> = {};
    const locationCount: Record<string, number> = {};

    targetData.forEach(item => {
      const dType = item.damageType || 'Onbekend';
      const vType = item.type || 'Onbekend';
      const loc = item.locatie || 'Onbekend';
      
      typeCount[dType] = (typeCount[dType] || 0) + 1;
      vehicleCount[vType] = (vehicleCount[vType] || 0) + 1;
      locationCount[loc] = (locationCount[loc] || 0) + 1;
    });

    return {
      totalIncidents: targetData.length,
      byType: Object.entries(typeCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      byVehicle: Object.entries(vehicleCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
      byLocation: Object.entries(locationCount)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    };
  }, [filteredData]);

  const searchedPersonnel = useMemo(() => {
    if (!searchQuery || !personnelInfo) return null;
    
    const q = searchQuery.toLowerCase().trim();
    
    // Try to find the person in the JSON data
    if (Array.isArray(personnelInfo)) {
      return personnelInfo.find(p => {
        // Check specific known keys first
        const id = String(
          p.PersoneelsNr ||
          p.personeelsnr || 
          p.Personeelsnr || 
          p.ID || 
          p.id || 
          p.Stamnummer || 
          p.stamnummer || 
          p['Personeels Nr'] ||
          p['PersoneelsNr'] ||
          ''
        ).toLowerCase().trim();
        
        if (id === q || (id.length > 0 && id.replace(/^0+/, '') === q.replace(/^0+/, ''))) return true;

        // Fallback: check any key that looks like an ID key
        return Object.entries(p).some(([key, val]) => {
          const k = key.toLowerCase();
          if (k.includes('personeels') || k.includes('stamnr') || k.includes('id') || k.includes('nummer')) {
            const v = String(val).toLowerCase().trim();
            return v === q || (v.length > 0 && v.replace(/^0+/, '') === q.replace(/^0+/, ''));
          }
          return false;
        });
      });
    } else {
      // If it's an object, check if the searchQuery is a key
      const keys = Object.keys(personnelInfo);
      const matchingKey = keys.find(k => {
        const normalizedK = k.toLowerCase().trim();
        return normalizedK === q || (normalizedK.length > 0 && normalizedK.replace(/^0+/, '') === q.replace(/^0+/, ''));
      });
      if (matchingKey) return personnelInfo[matchingKey];

      // Or search through values
      return Object.values(personnelInfo).find((p: any) => {
        if (typeof p !== 'object' || p === null) return false;
        
        // Check specific known keys first
        const id = String(
          p.PersoneelsNr ||
          p.personeelsnr || 
          p.Personeelsnr || 
          p.ID || 
          p.id || 
          p.Stamnummer || 
          p.stamnummer || 
          p['Personeels Nr'] ||
          p['PersoneelsNr'] ||
          ''
        ).toLowerCase().trim();
        
        if (id === q || (id.length > 0 && id.replace(/^0+/, '') === q.replace(/^0+/, ''))) return true;

        // Fallback: check any key that looks like an ID key
        return Object.entries(p).some(([key, val]) => {
          const k = key.toLowerCase();
          if (k.includes('personeels') || k.includes('stamnr') || k.includes('id') || k.includes('nummer')) {
            const v = String(val).toLowerCase().trim();
            return v === q || (v.length > 0 && v.replace(/^0+/, '') === q.replace(/^0+/, ''));
          }
          return false;
        });
      });
    }
  }, [searchQuery, personnelInfo]);

  const filteredCoaching = useMemo(() => {
    if (!searchQuery) return { requested: [], completed: [] };
    const q = searchQuery.toLowerCase().trim();
    
    const filterFn = (item: any) => {
      const pNr = String(item['P-nr'] || item['p-nr'] || item['Personeelsnr'] || item['PersoneelsNr'] || '').toLowerCase().trim();
      return pNr === q || (pNr.length > 0 && pNr.replace(/^0+/, '') === q.replace(/^0+/, ''));
    };

    return {
      requested: coachingData.requested.filter(filterFn),
      completed: coachingData.completed.filter(filterFn)
    };
  }, [searchQuery, coachingData]);

  const handleLogin = (user: string, pass: string) => {
    const found = allowedUsers.find(u => {
      const uName = String(u['Naam'] || u['naam'] || '').trim();
      const uPass = String(u['Paswoord'] || u['paswoord'] || '').trim();
      return uName === user && uPass === pass;
    });

    if (found) {
      setIsAuthenticated(true);
      setLoginError(null);
    } else {
      alert('Ongeldige gebruikersnaam of wachtwoord.');
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} isLoading={isLoading || (ftpStatus === 'loading' && allowedUsers.length === 0)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className={cn(
        "bg-zinc-900 text-zinc-400 w-64 flex-shrink-0 flex flex-col transition-all duration-300 z-20",
        !isSidebarOpen && "-ml-64 lg:ml-0 lg:w-20"
      )}>
        <div className="h-16 flex items-center px-6 border-b border-zinc-800">
          <Bus className="text-emerald-500 w-6 h-6 flex-shrink-0" />
          {isSidebarOpen && (
            <div className="ml-3 flex flex-col">
              <span className="text-white font-bold tracking-tight whitespace-nowrap leading-tight">OT Gent</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">analyse en rapportering</span>
            </div>
          )}
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          <button
            onClick={() => setActivePage('dashboard')}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-lg transition-colors mb-6",
              activePage === 'dashboard' ? "bg-emerald-600 text-white" : "text-emerald-400 hover:bg-zinc-800"
            )}
          >
            <LayoutDashboard size={20} />
            {isSidebarOpen && <span className="ml-3 font-medium">Dashboard</span>}
          </button>

          {isSidebarOpen && (
            <div className="px-3 mb-2 mt-6 flex items-center justify-between">
              <span className="text-sm font-black text-emerald-400 uppercase tracking-[0.2em]">Schade</span>
              {personnelStatus === 'success' && (
                <div className="flex items-center gap-1" title="Personeelsdatabase geladen">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <Database size={12} className="text-emerald-500" />
                </div>
              )}
            </div>
          )}
          
          <button
            onClick={() => setActivePage('topcrashers')}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-lg transition-colors",
              activePage === 'topcrashers' ? "bg-emerald-600 text-white" : "hover:bg-zinc-800 hover:text-zinc-200"
            )}
          >
            <Trophy size={20} />
            {isSidebarOpen && <span className="ml-3 font-medium">Topcrashers</span>}
          </button>

          <button
            onClick={() => setActivePage('locatie')}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-lg transition-colors",
              activePage === 'locatie' ? "bg-emerald-600 text-white" : "hover:bg-zinc-800 hover:text-zinc-200"
            )}
          >
            <MapPin size={20} />
            {isSidebarOpen && <span className="ml-3 font-medium">Locatie</span>}
          </button>

          <button
            onClick={() => setActivePage('voertuig')}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-lg transition-colors",
              activePage === 'voertuig' ? "bg-emerald-600 text-white" : "hover:bg-zinc-800 hover:text-zinc-200"
            )}
          >
            <Bus size={20} />
            {isSidebarOpen && <span className="ml-3 font-medium">Voertuig</span>}
          </button>

          <button
            onClick={() => setActivePage('seniority')}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-lg transition-colors",
              activePage === 'seniority' ? "bg-emerald-600 text-white" : "hover:bg-zinc-800 hover:text-zinc-200"
            )}
          >
            <Clock size={20} />
            {isSidebarOpen && <span className="ml-3 font-medium">Anciënniteit</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          {isSidebarOpen && (
            <div className="mt-4 pt-4 border-t border-zinc-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">FTP Status</span>
                <button 
                  onClick={fetchFTPData}
                  disabled={isLoading}
                  className="text-zinc-500 hover:text-emerald-500 transition-colors"
                  title="Ververs FTP data"
                >
                  <RefreshCw size={12} className={cn(isLoading && "animate-spin")} />
                </button>
              </div>
              
              <div className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border",
                ftpStatus === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                ftpStatus === 'error' ? "bg-red-500/10 border-red-500/20 text-red-400" :
                ftpStatus === 'loading' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                "bg-zinc-800/50 border-zinc-700/50 text-zinc-500"
              )}>
                {ftpStatus === 'success' ? <CheckCircle2 size={14} /> :
                 ftpStatus === 'error' ? <XCircle size={14} /> :
                 ftpStatus === 'loading' ? <RefreshCw size={14} className="animate-spin" /> :
                 <Database size={14} />}
                
                <span className="truncate">
                  {ftpStatus === 'success' ? "FTP Verbonden" :
                   ftpStatus === 'error' ? "FTP Fout" :
                   ftpStatus === 'loading' ? "Laden..." :
                   error ? "Config Fout" : "Geen FTP Config"}
                </span>
              </div>

              {/* File Status Overview */}
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Bestanden</span>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(fileStatuses).length > 0 ? (
                    Object.entries(fileStatuses).map(([fileName, info]) => {
                      const statusInfo = info as { status: string, message?: string };
                      return (
                        <div key={fileName} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-zinc-800/30 border border-zinc-700/30">
                          <span className="text-[10px] text-zinc-400 truncate max-w-[100px]" title={fileName}>
                            {fileName}
                          </span>
                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            statusInfo.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
                            statusInfo.status === 'not_found' ? 'text-amber-400 bg-amber-500/10' :
                            'text-red-400 bg-red-500/10'
                          }`}>
                            {statusInfo.status === 'success' ? <CheckCircle2 size={8} /> : 
                             statusInfo.status === 'not_found' ? <AlertCircle size={8} /> : 
                             <XCircle size={8} />}
                            {statusInfo.status === 'success' ? 'OK' : 
                             statusInfo.status === 'not_found' ? '?' : 'ERR'}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic px-2">Geen bestanden</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-zinc-200 h-16 flex items-center px-4 justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-zinc-900 capitalize">
              {activePage}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {data.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {data.length} records geladen
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {!data.length && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-zinc-100 p-8 rounded-full mb-6">
                <FileSpreadsheet className="w-16 h-16 text-zinc-400" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Geen gegevens geladen</h2>
              <p className="text-zinc-500 max-w-md">
                Upload een .xlsm bestand via de zijbalk om het dashboard te bekijken.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 text-red-700 mb-8">
              <AlertCircle className="shrink-0 mt-0.5" size={18} />
              <p>{error}</p>
            </div>
          )}

          {data.length > 0 && (
            <div className="space-y-8 max-w-7xl mx-auto">
              {/* Common Filters */}
              <div className="flex flex-col lg:flex-row gap-4 items-end justify-between bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                  <div className="grid gap-4 w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
                    <div className="relative">
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Zoek Chauffeur</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                          type="text"
                          placeholder="Personeelsnr..."
                          className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Van Datum</label>
                      <input
                        type="date"
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Tot Datum</label>
                      <input
                        type="date"
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>

                    <div className="relative">
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Zoek Voertuig</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                        <input
                          type="text"
                          placeholder="Voertuignr..."
                          className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          value={vehicleSearch}
                          onChange={(e) => setVehicleSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5 ml-1">Filter op Type</label>
                      <select
                        className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none"
                        value={typeSearch}
                        onChange={(e) => setTypeSearch(e.target.value)}
                      >
                        <option value="">Alle Types</option>
                        {uniqueTypes.map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                
                <div className="flex gap-2 w-full lg:w-auto">
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setStartDate('');
                      setEndDate('');
                      setVehicleSearch('');
                      setTypeSearch('');
                    }}
                    className="flex-1 lg:flex-none px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                  >
                    Reset
                  </button>
                  <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl min-w-[120px] text-center">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest leading-none mb-1">Resultaten</p>
                    <p className="text-xl font-bold text-emerald-700 leading-none">{filteredData.length}</p>
                  </div>
                </div>
              </div>

              {activePage === 'dashboard' ? (
                <div className="space-y-8">
                  {/* Summary Stats Title */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-zinc-900">Dashboard Overzicht</h2>
                      {(searchQuery || startDate || endDate || vehicleSearch || typeSearch) && (
                        <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase rounded-md animate-pulse">
                          <Filter size={10} />
                          Filters Actief
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Personnel Info Card */}
                  {searchQuery && (
                    <div className="space-y-4">
                      {searchedPersonnel ? (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-white border border-emerald-200 rounded-2xl shadow-sm overflow-hidden"
                        >
                          <div className="bg-emerald-600 px-6 py-3 flex items-center justify-between">
                            <h3 className="text-white font-bold flex items-center gap-2">
                              <Database size={18} />
                              Personeelsgegevens: {searchQuery}
                            </h3>
                            <span className="text-emerald-100 text-xs font-medium uppercase tracking-wider">
                              Bron: personeelsficheGB.json
                            </span>
                          </div>
                          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {Object.entries(searchedPersonnel).map(([key, value]) => {
                              if (typeof value === 'object' && value !== null) return null;
                              if (!value || value === 'null' || value === 'undefined') return null;
                              return (
                                <div key={key} className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{key}</p>
                                  <p className="text-sm font-semibold text-zinc-900 break-words">{String(value)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ) : (
                        <div className="bg-zinc-100 border border-zinc-200 p-6 rounded-2xl flex flex-col items-center justify-center text-zinc-500">
                          <Search size={32} className="mb-2 opacity-20" />
                          <p className="font-medium">Geen personeelsgegevens gevonden voor "{searchQuery}"</p>
                          <p className="text-xs mt-1">Status database: <span className="font-mono font-bold">{personnelStatus}</span></p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary Stats Title - MOVED TO TOP */}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Totaal Schades</p>
                      <p className="text-3xl font-black text-zinc-900">{stats.totalIncidents}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Unieke Chauffeurs</p>
                      <p className="text-3xl font-black text-zinc-900">
                        {new Set(filteredData.map(d => d.personeelsnr)).size}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Unieke Voertuigen</p>
                      <p className="text-3xl font-black text-zinc-900">
                        {new Set(filteredData.map(d => d.bus_tram)).size}
                      </p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Unieke Locaties</p>
                      <p className="text-3xl font-black text-zinc-900">
                        {new Set(filteredData.map(d => d.locatie)).size}
                      </p>
                    </div>
                  </div>

                  {/* Dashboard Grid */}
                  <div className="space-y-6">
                    {/* Damage Type Chart */}
                    {!searchQuery && (
                      <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                          <AlertCircle size={18} className="text-emerald-600" />
                          <h3 className="font-semibold text-zinc-900">Top 5 Schade Types</h3>
                        </div>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.byType} layout="vertical" margin={{ left: 40 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                              <XAxis type="number" hide />
                              <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={120} 
                                tick={{ fontSize: 11, fill: '#71717a' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip 
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Location Chart - Full Width */}
                    <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2 mb-6">
                        <MapPin size={18} className="text-emerald-600" />
                        <h3 className="font-semibold text-zinc-900">Top 5 Locaties</h3>
                      </div>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.byLocation} layout="vertical" margin={{ left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={120} 
                              tick={{ fontSize: 11, fill: '#71717a' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Vehicle Type Bar Chart */}
                    <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm lg:col-span-2">
                      <div className="flex items-center gap-2 mb-6">
                        <BarChart3 size={18} className="text-emerald-600" />
                        <h3 className="font-semibold text-zinc-900">Voertuig Type Overzicht</h3>
                      </div>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.byVehicle} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                            <XAxis type="number" hide />
                            <YAxis 
                              dataKey="name" 
                              type="category" 
                              width={100} 
                              tick={{ fontSize: 12, fill: '#71717a' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip 
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Vehicle Distribution */}
                    <div className="bg-white border border-zinc-200 p-6 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-2 mb-6">
                        <Bus size={18} className="text-emerald-600" />
                        <h3 className="font-semibold text-zinc-900">Voertuig Type</h3>
                      </div>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.byVehicle}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {stats.byVehicle.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 space-y-2">
                        {stats.byVehicle.map((item, i) => (
                          <div key={item.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                              <span className="text-zinc-600">{item.name || 'Onbekend'}</span>
                            </div>
                            <span className="font-medium text-zinc-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Coaching Section */}
                  {searchQuery && (filteredCoaching.requested.length > 0 || filteredCoaching.completed.length > 0) && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                        <CheckCircle2 className="text-emerald-600" size={24} />
                        <h2 className="text-xl font-bold text-zinc-900">Coaching</h2>
                      </div>

                      {/* Requested Coaching */}
                      {filteredCoaching.requested.length > 0 && (
                        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/30">
                            <h3 className="font-semibold text-zinc-900">Aangevraagde coaching</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-zinc-50/50">
                                  <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">P-nr</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Volledige naam</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Opmerkingen</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {filteredCoaching.requested.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                                    <td className="px-6 py-4 text-sm text-zinc-900">{item['P-nr'] || item['p-nr'] || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{item['Volledige naam'] || item['volledige naam'] || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{item['Opmerkingen'] || item['opmerkingen'] || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Completed Coaching */}
                      {filteredCoaching.completed.length > 0 && (
                        <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/30">
                            <h3 className="font-semibold text-zinc-900">Voltooide coachings</h3>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-zinc-50/50">
                                  <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">P-nr</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Volledige naam</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Datum coaching</th>
                                  <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Opmerking</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {filteredCoaching.completed.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                                    <td className="px-6 py-4 text-sm text-zinc-900">{item['P-nr'] || item['p-nr'] || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{item['Volledige naam'] || item['volledige naam'] || '-'}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">
                                      {item['Datum coaching'] instanceof Date 
                                        ? item['Datum coaching'].toLocaleDateString('nl-BE')
                                        : String(item['Datum coaching'] || '-')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{item['Opmerking'] || item['opmerking'] || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Detailed Table (Visible when searching on Dashboard) */}
                  {searchQuery && (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 px-2">
                        <AlertCircle className="text-emerald-600" size={24} />
                        <h2 className="text-xl font-bold text-zinc-900">Schade</h2>
                      </div>
                      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
                          <h3 className="font-semibold text-zinc-900">
                            Details voor Chauffeur: {searchQuery}
                          </h3>
                          <span className="text-xs text-zinc-500 font-medium bg-zinc-100 px-2 py-1 rounded-md">
                            {filteredData.length} incidenten gevonden
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse min-w-max">
                            <thead>
                              <tr className="bg-zinc-50/50">
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Personeelsnr</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Volledige Naam</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Datum</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Bus/tram</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                                <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Link</th>
                                {headers
                                  .filter(h => !EXCLUDED_HEADERS.includes(h.toLowerCase().trim()))
                                  .map(header => (
                                    <th key={header} className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                                      {header}
                                    </th>
                                  ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                              <AnimatePresence mode="popLayout">
                                {filteredData.map((record, idx) => (
                                  <motion.tr 
                                    key={`${record.personeelsnr}-${idx}`}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="hover:bg-zinc-50/80 transition-colors group"
                                  >
                                    <td className="px-6 py-4 text-sm text-zinc-900 font-medium">{record.personeelsnr}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{record.naam}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">
                                      {record.datum.replace(/-/g, '/')}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{record.bus_tram}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{record.type}</td>
                                    <td className="px-6 py-4 text-sm">
                                      {record.link && record.link !== 'undefined' ? (
                                        <a 
                                          href={record.link} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-emerald-600 hover:text-emerald-700 underline font-medium"
                                        >
                                          klik hier om te openen
                                        </a>
                                      ) : (
                                        <span className="text-zinc-300">-</span>
                                      )}
                                    </td>
                                    {headers
                                      .filter(h => !EXCLUDED_HEADERS.includes(h.toLowerCase().trim()))
                                      .map(header => (
                                        <td key={header} className="px-6 py-4 text-sm text-zinc-600 whitespace-nowrap">
                                          {String(record.rawData[header] || '-')}
                                        </td>
                                      ))}
                                  </motion.tr>
                                ))}
                              </AnimatePresence>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : activePage === 'topcrashers' ? (
                <div className="space-y-8">
                  {/* Topcrashers Page Content */}
                  <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
                      <h3 className="font-semibold text-zinc-900">
                        {searchQuery ? `Details voor Chauffeur: ${searchQuery}` : 'Topcrashers Overzicht'}
                      </h3>
                      <span className="text-xs text-zinc-500 font-medium bg-zinc-100 px-2 py-1 rounded-md">
                        {searchQuery 
                          ? `${filteredData.length} incidenten gevonden`
                          : `${Object.keys(filteredData.reduce((acc, curr) => {
                              acc[curr.personeelsnr] = true;
                              return acc;
                            }, {} as Record<string, boolean>)).length} unieke chauffeurs`
                        }
                      </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      {searchQuery ? (
                        // Detailed View (Specific Columns + Others)
                        <table className="w-full text-left border-collapse min-w-max">
                          <thead>
                            <tr className="bg-zinc-50/50">
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Personeelsnr</th>
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Volledige Naam</th>
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Datum</th>
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Bus/tram</th>
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Type</th>
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">Link</th>
                              {headers
                                .filter(h => !EXCLUDED_HEADERS.includes(h.toLowerCase().trim()))
                                .map(header => (
                                  <th key={header} className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                                    {header}
                                  </th>
                                ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            <AnimatePresence mode="popLayout">
                              {filteredData.map((record, idx) => (
                                <motion.tr 
                                  key={`${record.personeelsnr}-${idx}`}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="hover:bg-zinc-50/80 transition-colors group"
                                >
                                  <td className="px-6 py-4 text-sm text-zinc-900 font-medium">{record.personeelsnr}</td>
                                  <td className="px-6 py-4 text-sm text-zinc-600">{record.naam}</td>
                                  <td className="px-6 py-4 text-sm text-zinc-600">
                                    {record.datum.replace(/-/g, '/')}
                                  </td>
                                  <td className="px-6 py-4 text-sm text-zinc-600">{record.bus_tram}</td>
                                  <td className="px-6 py-4 text-sm text-zinc-600">{record.type}</td>
                                  <td className="px-6 py-4 text-sm">
                                    {record.link && record.link !== 'undefined' ? (
                                      <a 
                                        href={record.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-emerald-600 hover:text-emerald-700 underline font-medium"
                                      >
                                        klik hier om te openen
                                      </a>
                                    ) : (
                                      <span className="text-zinc-300">-</span>
                                    )}
                                  </td>
                                  {headers
                                    .filter(h => !EXCLUDED_HEADERS.includes(h.toLowerCase().trim()))
                                    .map(header => (
                                      <td key={header} className="px-6 py-4 text-sm text-zinc-600 whitespace-nowrap">
                                        {String(record.rawData[header] || '-')}
                                      </td>
                                    ))}
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </tbody>
                        </table>
                      ) : (
                        // Summary View
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50/50">
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Personeelsnr</th>
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Volledige Naam</th>
                              <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Aantal Schades</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            <AnimatePresence mode="popLayout">
                              {Object.entries(
                                filteredData.reduce((acc, curr) => {
                                  if (!acc[curr.personeelsnr]) {
                                    acc[curr.personeelsnr] = { naam: curr.naam, count: 0 };
                                  }
                                  acc[curr.personeelsnr].count += 1;
                                  return acc;
                                }, {} as Record<string, { naam: string; count: number }>)
                              )
                              .sort((a, b) => (b[1] as { count: number }).count - (a[1] as { count: number }).count)
                              .map(([pnr, info]) => {
                                const chauffeurInfo = info as { naam: string; count: number };
                                return (
                                  <motion.tr 
                                    key={pnr}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="hover:bg-zinc-50/80 transition-colors group cursor-pointer"
                                    onClick={() => setSearchQuery(pnr)}
                                  >
                                    <td className="px-6 py-4 text-sm font-medium text-zinc-900">{pnr}</td>
                                    <td className="px-6 py-4 text-sm text-zinc-600">{chauffeurInfo.naam}</td>
                                    <td className="px-6 py-4 text-sm text-right font-semibold text-emerald-600">
                                      {chauffeurInfo.count}
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </AnimatePresence>
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              ) : activePage === 'locatie' ? (
                <div className="space-y-8">
                  {/* Locatie Page Content */}
                  <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
                      <h3 className="font-semibold text-zinc-900">
                        Overzicht per Locatie
                      </h3>
                      <span className="text-xs text-zinc-500 font-medium bg-zinc-100 px-2 py-1 rounded-md">
                        {Object.keys(filteredData.reduce((acc, curr) => {
                          acc[curr.locatie] = true;
                          return acc;
                        }, {} as Record<string, boolean>)).length} unieke locaties
                      </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50/50">
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Locatie</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Aantal Schades</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          <AnimatePresence mode="popLayout">
                            {Object.entries(
                              filteredData.reduce((acc, curr) => {
                                const loc = curr.locatie || 'Onbekend';
                                acc[loc] = (acc[loc] || 0) + 1;
                                return acc;
                              }, {} as Record<string, number>)
                            )
                            .sort((a, b) => (b[1] as number) - (a[1] as number))
                            .map(([loc, count]) => (
                              <motion.tr 
                                key={loc}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="hover:bg-zinc-50/80 transition-colors group"
                              >
                                <td className="px-6 py-4 text-sm font-medium text-zinc-900">{loc}</td>
                                <td className="px-6 py-4 text-sm text-right font-semibold text-emerald-600">
                                  {count}
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : activePage === 'seniority' ? (
                <div className="space-y-8">
                  <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-zinc-900 mb-6 flex items-center gap-2">
                      <Clock className="text-emerald-500" size={20} />
                      Gemiddelde Schades per Dienstjaar Bundel
                    </h3>
                    {groupedSeniorityData.length > 0 ? (
                      <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={groupedSeniorityData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis 
                              dataKey="label" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#71717a', fontSize: 12 }}
                              label={{ value: 'Dienstjaren Bundels', position: 'insideBottom', offset: -5 }}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#71717a', fontSize: 12 }}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: '#f4f4f5' }}
                              formatter={(value: number) => [`${value}`, 'Gemiddelde Schades']}
                            />
                            <Bar 
                              dataKey="avg" 
                              fill="#10b981" 
                              radius={[4, 4, 0, 0]} 
                              name="Gemiddelde Schades"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[400px] flex flex-col items-center justify-center text-zinc-500 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                        <Database size={40} className="mb-4 opacity-20" />
                        <p>Geen data gevonden in tabblad "schades-dienstjaar"</p>
                        <p className="text-xs mt-2">Controleer of de kolommen "Dienstjaren" en "schades" heten.</p>
                      </div>
                    )}
                  </div>

                  <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/30">
                      <h3 className="font-semibold text-zinc-900">Details Tabel</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50/50">
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Bundel (Dienstjaren)</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Aantal Personen</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Gemiddelde Schades</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {groupedSeniorityData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                              <td className="px-6 py-4 text-sm font-medium text-zinc-900">{row.label}</td>
                              <td className="px-6 py-4 text-sm text-right text-zinc-600">{row.personCount}</td>
                              <td className="px-6 py-4 text-sm text-right font-semibold text-emerald-600">{row.avg}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Voertuig Page Content */}
                  <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
                      <h3 className="font-semibold text-zinc-900">
                        Overzicht per Voertuig
                      </h3>
                      <span className="text-xs text-zinc-500 font-medium bg-zinc-100 px-2 py-1 rounded-md">
                        {Object.keys(filteredData.reduce((acc, curr) => {
                          acc[curr.bus_tram] = true;
                          return acc;
                        }, {} as Record<string, boolean>)).length} unieke voertuigen
                      </span>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-50/50">
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Voertuignr</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Aantal Schades</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          <AnimatePresence mode="popLayout">
                            {Object.entries(
                              filteredData.reduce((acc, curr) => {
                                const vnr = curr.bus_tram || 'Onbekend';
                                if (!acc[vnr]) {
                                  acc[vnr] = { type: curr.type, count: 0 };
                                }
                                acc[vnr].count += 1;
                                return acc;
                              }, {} as Record<string, { type: string; count: number }>)
                            )
                            .sort((a, b) => (b[1] as { count: number }).count - (a[1] as { count: number }).count)
                            .map(([vnr, info]) => {
                              const vehicleInfo = info as { type: string; count: number };
                              return (
                                <motion.tr 
                                  key={vnr}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="hover:bg-zinc-50/80 transition-colors group"
                                >
                                  <td className="px-6 py-4 text-sm font-medium text-zinc-900">{vnr}</td>
                                  <td className="px-6 py-4 text-sm text-zinc-600">{vehicleInfo.type}</td>
                                  <td className="px-6 py-4 text-sm text-right font-semibold text-emerald-600">
                                    {vehicleInfo.count}
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
