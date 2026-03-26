import React, { useState, useEffect } from 'react';
import { 
  LogIn, 
  LogOut, 
  Users, 
  FileText, 
  Download, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Search,
  User,
  ShieldCheck,
  Calendar,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// --- Types ---
interface UserData {
  login: string;
  nome: string;
  perfil: 'admin' | 'operador';
}

interface Payment {
  weekId: string;
  id: string;
  nome: string;
  pix: string;
  valorPagar: number;
  status: 'PAGO' | 'PENDENTE';
  pagoEm: string;
  pagoPor: string;
  loginResponsavel: string;
  nomeResponsavel: string;
}

interface Motoboy {
  id: string;
  nome: string;
  pix: string;
  ativo: boolean;
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [loginForm, setLoginForm] = useState({ login: '', senha: '' });
  const [weekId, setWeekId] = useState(getInitialWeekId());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PAGO' | 'PENDENTE'>('ALL');
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);

  function getInitialWeekId() {
    const d = new Date();
    return getWeekIdFromDate(d);
  }

  function getWeekIdFromDate(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(d); monday.setDate(d.getDate() - diffToMonday);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const fmt = (x: Date) => x.toISOString().slice(0, 10);
    return `${fmt(monday)}_a_${fmt(sunday)}`;
  }

  useEffect(() => {
    if (user) {
      loadData();
      loadAvailableWeeks();
    }
  }, [user, weekId]);

  const loadAvailableWeeks = async () => {
    try {
      const res = await fetch('/api/available-weeks');
      const data = await res.json();
      setAvailableWeeks(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payments?weekId=${weekId}&login=${user?.login}&perfil=${user?.perfil}`);
      const data = await res.json();
      setPayments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    const newWeekId = getWeekIdFromDate(date);
    setWeekId(newWeekId);
    setShowCalendar(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (data.ok) {
        setUser(data.user);
      } else {
        alert(data.msg);
      }
    } catch (err) {
      alert("Erro ao conectar ao servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet) as any[];

      const rows = json.map(r => ({
        id: String(r['ID Entregador'] || r['ID'] || ''),
        nome: String(r['Nome Entregador'] || r['Nome'] || ''),
        valorEntregas: Number(r['Valor Entregas'] || r['Valor'] || 0)
      })).filter(r => r.nome);

      await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: { weekId, rows }, user })
      });
      loadData();
      loadAvailableWeeks();
    };
    reader.readAsArrayBuffer(file);
  };

  const togglePaid = async (payment: Payment) => {
    if (!user) return;
    const newStatus = payment.status === 'PAGO' ? 'PENDENTE' : 'PAGO';
    try {
      await fetch('/api/set-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, id: payment.id, status: newStatus, user })
      });
      loadData();
    } catch (err) {
      alert("Erro ao atualizar status");
    }
  };

  const generateReceipt = (payment: Payment) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("RECIBO DE PAGAMENTO", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text(`Semana: ${payment.weekId}`, 20, 40);
    doc.text(`Motoboy: ${payment.nome} (${payment.id})`, 20, 50);
    doc.text(`Valor: R$ ${payment.valorPagar.toFixed(2)}`, 20, 60);
    doc.text(`PIX: ${payment.pix}`, 20, 70);
    doc.text(`Status: ${payment.status}`, 20, 80);
    doc.text(`Responsável: ${payment.nomeResponsavel}`, 20, 90);
    
    if (payment.status === 'PAGO') {
      doc.text(`Pago em: ${new Date(payment.pagoEm).toLocaleString()}`, 20, 100);
      doc.text(`Pago por: ${payment.pagoPor}`, 20, 110);
    }

    doc.save(`Recibo_${payment.nome}_${payment.weekId}.pdf`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
        >
          <div className="bg-gray-900 p-8 text-white text-center">
            <div className="w-16 h-16 bg-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Gestor Motoboy</h1>
            <p className="text-gray-400 text-sm mt-1 uppercase tracking-widest font-medium">Acesso Restrito</p>
          </div>
          
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Login</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  value={loginForm.login}
                  onChange={e => setLoginForm({...loginForm, login: e.target.value})}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-gray-700 font-medium"
                  placeholder="Seu usuário"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <LogIn className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="password" 
                  value={loginForm.senha}
                  onChange={e => setLoginForm({...loginForm, senha: e.target.value})}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all outline-none text-gray-700 font-medium"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? "Entrando..." : "Acessar Sistema"}
            </button>
          </form>
          <div className="p-6 bg-gray-50 text-center border-t border-gray-100">
            <p className="text-xs text-gray-400 font-medium">v2.0 Multi-usuário</p>
          </div>
        </motion.div>
      </div>
    );
  }

  const filteredPayments = payments.filter(p => {
    if (filter === 'PAGO') return p.status === 'PAGO';
    if (filter === 'PENDENTE') return p.status === 'PENDENTE';
    return true;
  });

  const totalPagar = filteredPayments.reduce((acc, p) => acc + p.valorPagar, 0);

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-md">
                <DollarSign size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-none">Dashboard</h2>
                <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-tighter">Gestão de Pagamentos</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-bold text-gray-900">{user.nome}</span>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">{user.perfil}</span>
              </div>
              <button 
                onClick={() => setUser(null)}
                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
          <div className="lg:col-span-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Período Selecionado</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCalendar(true)}
                className="flex-1 flex items-center gap-3 px-4 py-3 bg-gray-50 border-none rounded-2xl hover:bg-gray-100 transition-all text-sm font-bold text-gray-700 text-left"
              >
                <Calendar className="text-gray-400" size={18} />
                <span className="truncate">{weekId.replace('_a_', ' até ')}</span>
              </button>
              <button onClick={loadData} className="bg-gray-900 text-white px-4 rounded-2xl hover:bg-black transition-colors">
                <Search size={18} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 flex flex-wrap gap-4 items-end">
            <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
              {(['ALL', 'PENDENTE', 'PAGO'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all ${filter === f ? 'bg-gray-900 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}
                >
                  {f === 'ALL' ? 'Todos' : f}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <div className="flex gap-3">
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-blue-100 transition-all flex items-center gap-2">
                <Download size={18} />
                Importar Excel
                <input type="file" className="hidden" onChange={handleImport} accept=".xlsx,.xls" />
              </label>
              {user.perfil === 'admin' && (
                <button className="bg-white border border-gray-200 text-gray-700 px-6 py-3.5 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all flex items-center gap-2">
                  <Plus size={18} />
                  Novo Motoboy
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Calendar Modal */}
        <AnimatePresence>
          {showCalendar && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-gray-900">Selecionar Semana</h3>
                  <button onClick={() => setShowCalendar(false)} className="text-gray-400 hover:text-gray-600">
                    <XCircle size={20} />
                  </button>
                </div>
                
                <div className="p-6">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Semanas com Dados Importados</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {availableWeeks.length > 0 ? (
                      availableWeeks.map(w => (
                        <button
                          key={w}
                          onClick={() => { setWeekId(w); setShowCalendar(false); }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border ${
                            weekId === w 
                              ? 'bg-blue-50 border-blue-200 text-blue-700' 
                              : 'bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${weekId === w ? 'bg-blue-500' : 'bg-green-500'}`} />
                            <span className="font-bold text-sm">{w.replace('_a_', ' até ')}</span>
                          </div>
                          <CheckCircle size={16} className={weekId === w ? 'opacity-100' : 'opacity-0'} />
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-400 italic text-sm">
                        Nenhuma semana importada ainda.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Escolher Nova Data</p>
                    <input 
                      type="date" 
                      onChange={(e) => handleDateSelect(new Date(e.target.value))}
                      className="w-full p-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold text-gray-700"
                    />
                    <p className="text-[10px] text-gray-400 mt-2 text-center">Ao selecionar uma data, a semana correspondente será carregada.</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Total a Pagar</p>
            <h3 className="text-3xl font-black text-gray-900">R$ {totalPagar.toFixed(2)}</h3>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Entregadores</p>
            <h3 className="text-3xl font-black text-gray-900">{filteredPayments.length}</h3>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pendentes</p>
            <h3 className="text-3xl font-black text-orange-500">{filteredPayments.filter(p => p.status === 'PENDENTE').length}</h3>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">Entregador</th>
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider">PIX</th>
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Valor</th>
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Status</th>
                  <th className="px-8 py-5 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence mode="popLayout">
                  {filteredPayments.map((p) => (
                    <motion.tr 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      key={p.id} 
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="font-bold text-gray-900">{p.nome}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase mt-0.5">ID: {p.id}</div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">{p.pix || "Não informado"}</span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="font-black text-gray-900">R$ {p.valorPagar.toFixed(2)}</div>
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          p.status === 'PAGO' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {p.status === 'PAGO' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {p.status}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => togglePaid(p)}
                            className={`p-2.5 rounded-xl transition-all ${
                              p.status === 'PAGO' 
                                ? 'bg-orange-50 text-orange-600 hover:bg-orange-100' 
                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                            }`}
                            title={p.status === 'PAGO' ? "Marcar como Pendente" : "Marcar como Pago"}
                          >
                            {p.status === 'PAGO' ? <XCircle size={18} /> : <CheckCircle size={18} />}
                          </button>
                          <button 
                            onClick={() => generateReceipt(p)}
                            className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"
                            title="Gerar Recibo PDF"
                          >
                            <FileText size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300">
                          <FileText size={32} />
                        </div>
                        <p className="text-gray-400 font-medium">Nenhum registro encontrado para esta semana.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
