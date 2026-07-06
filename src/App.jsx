import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Car, 
  ClipboardCheck, 
  AlertTriangle, 
  Settings, 
  LogOut, 
  Search, 
  Plus, 
  FileText, 
  CheckCircle, 
  Clock, 
  X, 
  User, 
  Camera, 
  Trash2, 
  Edit,
  ArrowRight,
  TrendingUp,
  Sliders,
  Calendar,
  Check,
  ChevronRight
} from 'lucide-react';
import { authAPI, vehicleAPI, checklistAPI, inspectionAPI, pendenciesAPI, dashboardAPI } from './services/api';

// Helper to get image full URL dynamically
const getPhotoURL = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const backendBase = import.meta.env.VITE_API_URL 
    ? import.meta.env.VITE_API_URL.replace('/api', '') 
    : `http://${window.location.hostname}:3001`;
  return `${backendBase}/${path}`;
};

// Main App Component
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard | vehicles | checklist | pendencies | config
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [activeInspection, setActiveInspection] = useState(null); // { id, vehicle }
  
  // Auth state check
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await authAPI.me();
          setUser(userData);
        } catch (err) {
          console.error('Session expired', err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setSelectedVehicleId(null);
    setActiveInspection(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0d14', color: '#fff' }}>
        <div className="loader">Carregando Sistema Premium...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Car size={24} />
          <span>AUTO</span>PREMIUM
        </div>

        <nav className="sidebar-nav">
          <button 
            className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => { setCurrentView('dashboard'); setSelectedVehicleId(null); setActiveInspection(null); }}
          >
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          
          <button 
            className={`nav-item ${currentView === 'vehicles' ? 'active' : ''}`}
            onClick={() => { setCurrentView('vehicles'); setSelectedVehicleId(null); setActiveInspection(null); }}
          >
            <Car size={18} />
            Veículos
          </button>

          <button 
            className={`nav-item ${currentView === 'pendencies' ? 'active' : ''}`}
            onClick={() => { setCurrentView('pendencies'); setSelectedVehicleId(null); setActiveInspection(null); }}
          >
            <AlertTriangle size={18} />
            Pendências
          </button>

          {user.role === 'Administrador' && (
            <button 
              className={`nav-item ${currentView === 'config' ? 'active' : ''}`}
              onClick={() => { setCurrentView('config'); setSelectedVehicleId(null); setActiveInspection(null); }}
            >
              <Settings size={18} />
              Configuração Checklist
            </button>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>
          <button className="nav-item" onClick={handleLogout} style={{ width: '100%', border: 'none', background: 'none', textAlign: 'left' }}>
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {activeInspection ? (
          <ChecklistExecution 
            inspectionId={activeInspection.id} 
            vehicle={activeInspection.vehicle} 
            onClose={() => {
              setSelectedVehicleId(activeInspection.vehicle.id);
              setCurrentView('vehicles');
              setActiveInspection(null);
            }} 
          />
        ) : selectedVehicleId ? (
          <VehicleDetail 
            vehicleId={selectedVehicleId} 
            onBack={() => setSelectedVehicleId(null)}
            onStartInspection={(insId, veh) => setActiveInspection({ id: insId, vehicle: veh })}
            currentUser={user}
          />
        ) : (
          <>
            {currentView === 'dashboard' && <DashboardView onSelectVehicle={(id) => { setCurrentView('vehicles'); setSelectedVehicleId(id); }} />}
            {currentView === 'vehicles' && <VehiclesView onSelectVehicle={setSelectedVehicleId} onStartInspection={(insId, veh) => setActiveInspection({ id: insId, vehicle: veh })} />}
            {currentView === 'pendencies' && <PendenciesView currentUser={user} onSelectVehicle={(id) => { setCurrentView('vehicles'); setSelectedVehicleId(id); }} />}
            {currentView === 'config' && <ConfigChecklistTree />}
          </>
        )}
      </main>
    </div>
  );
}

// 1. LOGIN PAGE COMPONENT
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await authAPI.login(username, password);
      onLogin(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao conectar com o servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Car size={36} />
            <span>AUTO</span>PREMIUM
          </div>
          <p style={{ color: '#8e9ea8', fontSize: '14px' }}>Gerenciador de Inspeção & Checklists</p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '12px', borderRadius: '8px', color: 'var(--danger)', fontSize: '14px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Usuário</label>
            <input 
              type="text" 
              className="form-input" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Digite seu usuário" 
              required 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <input 
              type="password" 
              className="form-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha" 
              required 
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar no Sistema'}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <p>Credenciais padrão:</p>
          <p>Admin: admin / admin123</p>
          <p>Vistoriador: vistoriador / visto123</p>
        </div>
      </div>
    </div>
  );
}

// 2. DASHBOARD VIEW COMPONENT
function DashboardView({ onSelectVehicle }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await dashboardAPI.getStats();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div>Carregando estatísticas...</div>;
  if (!stats) return <div>Erro ao carregar dashboard.</div>;

  return (
    <div>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Visão geral da frota e status das inspeções</p>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div>
            <div className="stat-label">Recebidos</div>
            <div className="stat-value">{stats.vehicleStats.Recebido}</div>
          </div>
          <div className="stat-icon-wrapper stat-icon-blue">
            <Clock size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Em Inspeção</div>
            <div className="stat-value">{stats.vehicleStats['Em inspeção']}</div>
          </div>
          <div className="stat-icon-wrapper stat-icon-yellow">
            <Sliders size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Com Pendências</div>
            <div className="stat-value">{stats.vehicleStats['Com pendências']}</div>
          </div>
          <div className="stat-icon-wrapper stat-icon-red">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Prontos para Venda</div>
            <div className="stat-value">{stats.vehicleStats['Pronto para venda']}</div>
          </div>
          <div className="stat-icon-wrapper stat-icon-green">
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      <div className="dashboard-layout-grid">
        {/* Left Side: Defect Rate / General info */}
        <div>
          <div className="panel-card">
            <h2 className="panel-title text-danger">
              <TrendingUp size={20} />
              Itens com Maior Índice de Defeito
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {stats.defectRates.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>Nenhum defeito registrado no sistema ainda.</p>
              ) : (
                stats.defectRates.map((defect, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{defect.item_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Categoria: {defect.category_name}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="badge badge-pending" style={{ fontSize: '13px' }}>
                        {defect.defect_count} {defect.defect_count === 1 ? 'defeito' : 'defeitos'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick info */}
        <div>
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h2 className="panel-title">
              <Calendar size={20} />
              Atividades do Mês
            </h2>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Inspeções realizadas este mês:</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)' }}>{stats.monthlyInspections}</div>
            </div>
            
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Pendências ativas em aberto:</div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--danger)' }}>{stats.openPendencies}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 3. VEHICLES VIEW COMPONENT (LIST / SEARCH / ADD)
function VehiclesView({ onSelectVehicle, onStartInspection }) {
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [version, setVersion] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [mileage, setMileage] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchVehicles = async (searchQuery = '') => {
    setLoading(true);
    try {
      const data = await vehicleAPI.list(searchQuery);
      setVehicles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchVehicles(search);
  };

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const vehicleData = {
        plate,
        brand,
        model,
        version,
        year: parseInt(year),
        color,
        mileage: parseInt(mileage),
        entry_date: entryDate,
        observations
      };
      await vehicleAPI.create(vehicleData);
      setIsModalOpen(false);
      // Reset form
      setPlate('');
      setBrand('');
      setModel('');
      setVersion('');
      setYear('');
      setColor('');
      setMileage('');
      setObservations('');
      fetchVehicles();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar veículo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="header-actions">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Veículos</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gerenciamento e controle de inspeções da frota</p>
        </div>
        <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Novo Veículo
        </button>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} style={{ marginBottom: '24px' }}>
        <div className="search-bar">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Pesquisar por placa, marca, modelo ou ano..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}>Buscar</button>
        </div>
      </form>

      {/* Vehicle Table */}
      {loading ? (
        <div>Carregando veículos...</div>
      ) : vehicles.length === 0 ? (
        <div className="panel-card" style={{ textAlign: 'center', padding: '40px' }}>
          <Car size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
          <h3>Nenhum veículo encontrado</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Tente refinar sua busca ou cadastre um novo veículo.</p>
        </div>
      ) : (
        <div className="vehicle-table-wrapper">
          <table className="vehicle-table">
            <thead>
              <tr>
                <th>Placa</th>
                <th>Marca / Modelo</th>
                <th>Ano / Cor</th>
                <th>KM</th>
                <th>Data Entrada</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{v.plate}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.brand} {v.model}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{v.version}</div>
                  </td>
                  <td>{v.year} / {v.color}</td>
                  <td>{v.mileage.toLocaleString()} km</td>
                  <td>{v.entry_date}</td>
                  <td>
                    <span className={`badge ${
                      v.status === 'Recebido' ? 'badge-received' :
                      v.status === 'Em inspeção' ? 'badge-inspecting' :
                      v.status === 'Com pendências' ? 'badge-pending' :
                      'badge-ready'
                    }`}>
                      {v.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-secondary" style={{ display: 'inline-flex', padding: '6px 12px', fontSize: '13px' }} onClick={() => onSelectVehicle(v.id)}>
                      Visualizar
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Vehicle Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>Cadastrar Novo Veículo</h2>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            {error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: '12px', borderRadius: '8px', color: 'var(--danger)', fontSize: '14px', marginBottom: '20px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleRegisterVehicle}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Placa (Única)</label>
                  <input type="text" className="form-input" placeholder="ABC-1234" value={plate} onChange={(e) => setPlate(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Marca</label>
                  <input type="text" className="form-input" placeholder="Ex: Chevrolet" value={brand} onChange={(e) => setBrand(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Modelo</label>
                  <input type="text" className="form-input" placeholder="Ex: Onix" value={model} onChange={(e) => setModel(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Versão</label>
                  <input type="text" className="form-input" placeholder="Ex: 1.0 Turbo LTZ" value={version} onChange={(e) => setVersion(e.target.value)} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ano</label>
                  <input type="number" className="form-input" placeholder="Ex: 2022" value={year} onChange={(e) => setYear(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cor</label>
                  <input type="text" className="form-input" placeholder="Ex: Preto" value={color} onChange={(e) => setColor(e.target.value)} required />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Quilometragem</label>
                  <input type="number" className="form-input" placeholder="KM" value={mileage} onChange={(e) => setMileage(e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Data de Entrada</label>
                <input type="date" className="form-input" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
              </div>

              <div className="form-group">
                <label className="form-label">Observações</label>
                <textarea className="form-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="Observações iniciais do veículo..." value={observations} onChange={(e) => setObservations(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting ? 'Cadastrando...' : 'Cadastrar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 4. VEHICLE DETAIL VIEW (WITH DETAILS, INSPECTION ACTIONS, HISTORY & AUDIT LOGS)
function VehicleDetail({ vehicleId, onBack, onStartInspection, currentUser }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const fetchVehicleDetail = async () => {
    try {
      const details = await vehicleAPI.get(vehicleId);
      setData(details);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicleDetail();
  }, [vehicleId]);

  const handleStartNewInspection = async () => {
    setStarting(true);
    try {
      const res = await inspectionAPI.start(vehicleId);
      onStartInspection(res.inspection_id, data.vehicle);
    } catch (err) {
      alert('Erro ao iniciar inspeção.');
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  if (loading) return <div>Carregando detalhes do veículo...</div>;
  if (!data) return <div>Veículo não encontrado.</div>;

  const { vehicle, inspections, pendencies, logs } = data;

  return (
    <div>
      <button className="btn-secondary" style={{ marginBottom: '20px', width: 'auto' }} onClick={onBack}>
        Voltar para lista
      </button>

      <div className="header-actions" style={{ marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>{vehicle.brand} {vehicle.model}</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Placa: <strong style={{ color: 'var(--accent)' }}>{vehicle.plate}</strong> | Versão: {vehicle.version}</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <span className={`badge ${
            vehicle.status === 'Recebido' ? 'badge-received' :
            vehicle.status === 'Em inspeção' ? 'badge-inspecting' :
            vehicle.status === 'Com pendências' ? 'badge-pending' :
            'badge-ready'
          }`} style={{ alignSelf: 'center', height: 'fit-content', padding: '6px 12px' }}>
            {vehicle.status}
          </span>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={handleStartNewInspection} disabled={starting}>
            {starting ? 'Iniciando...' : 'Nova Inspeção'}
          </button>
        </div>
      </div>

      <div className="dashboard-layout-grid">
        {/* Left Side: Vehicle Details and Inspections */}
        <div>
          {/* Details Card */}
          <div className="panel-card">
            <h2 className="panel-title">Dados Gerais do Veículo</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Ano</div>
                <div style={{ fontWeight: 600 }}>{vehicle.year}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Cor</div>
                <div style={{ fontWeight: 600 }}>{vehicle.color}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Quilometragem</div>
                <div style={{ fontWeight: 600 }}>{vehicle.mileage.toLocaleString()} km</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Data de Entrada</div>
                <div style={{ fontWeight: 600 }}>{vehicle.entry_date}</div>
              </div>
            </div>
            {vehicle.observations && (
              <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Observações</div>
                <div style={{ fontSize: '14px', whiteSpace: 'pre-line' }}>{vehicle.observations}</div>
              </div>
            )}
          </div>

          {/* Inspections History Section */}
          <div className="panel-card">
            <h2 className="panel-title">
              <ClipboardCheck size={20} />
              Histórico de Inspeções ({inspections.length})
            </h2>
            {inspections.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>Nenhuma inspeção realizada neste veículo ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {inspections.map((ins, index) => {
                  const completedDate = ins.completed_at ? new Date(ins.completed_at).toLocaleString('pt-BR') : 'Não finalizada';
                  const defects = ins.items.filter(i => i.status === 'Defeito');
                  const attention = ins.items.filter(i => i.status === 'Atenção');
                  
                  return (
                    <div key={ins.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>Inspeção #{ins.id}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Realizada por: {ins.inspector_name} em {completedDate}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <span className="badge badge-ready">{ins.items.filter(i => i.status === 'OK').length} OK</span>
                          {attention.length > 0 && <span className="badge badge-inspecting">{attention.length} Atenção</span>}
                          {defects.length > 0 && <span className="badge badge-pending">{defects.length} Defeito</span>}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        {ins.completed_at && (
                          <a 
                            href={inspectionAPI.getReportURL(ins.id)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn-secondary"
                            style={{ padding: '8px 14px', fontSize: '13px' }}
                          >
                            <FileText size={14} />
                            PDF Relatório
                          </a>
                        )}
                        {ins.completed_at && currentUser.role === 'Administrador' && (
                          <button 
                            type="button"
                            className="btn-primary" 
                            style={{ padding: '8px 14px', fontSize: '13px', width: 'auto', backgroundColor: 'var(--accent)' }}
                            onClick={() => onStartInspection(ins.id, vehicle)}
                          >
                            Editar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detailed Defect Repair Photos History */}
          <div className="panel-card">
            <h2 className="panel-title">Galeria de Fotos (Histórico)</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
              {inspections.flatMap(i => i.items.flatMap(item => item.photos)).length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>Nenhuma foto anexada neste veículo.</p>
              ) : (
                inspections.flatMap(i => i.items.flatMap(item => item.photos)).map((p, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden', aspectRatio: 1 }}>
                    <img 
                      src={getPhotoURL(p.photo_path)} 
                      alt="Fotos do veículo" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/150?text=Sem+Foto';
                      }}
                    />
                    <span style={{ 
                      position: 'absolute', 
                      bottom: 0, 
                      left: 0, 
                      right: 0, 
                      backgroundColor: p.type === 'defeito' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)', 
                      color: '#fff', 
                      fontSize: '9px', 
                      textAlign: 'center', 
                      padding: '2px 0',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {p.type === 'defeito' ? 'Defeito' : 'Reparo'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Timeline & Logs */}
        <div>
          {/* Pendencies Status List */}
          <div className="panel-card">
            <h2 className="panel-title text-danger">Pendências Atuais / Resolvidas</h2>
            {pendencies.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma pendência associada a este veículo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendencies.map((pend) => (
                  <div key={pend.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{pend.item_name}</span>
                      <span className={`badge ${
                        pend.status === 'Pendente' ? 'badge-pending' :
                        pend.status === 'Em andamento' ? 'badge-inspecting' :
                        'badge-ready'
                      }`} style={{ fontSize: '10px' }}>
                        {pend.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{pend.description}</p>
                    
                    {pend.responsible_name && (
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Resp: {pend.responsible_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Logs */}
          <div className="panel-card">
            <h2 className="panel-title">Histórico de Alterações</h2>
            <div className="timeline">
              {logs.map((log) => (
                <div key={log.id} className="timeline-item">
                  <div className="timeline-date">{new Date(log.created_at).toLocaleString('pt-BR')}</div>
                  <div className="timeline-title">{log.action}</div>
                  <div className="timeline-desc">{log.details}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Por: {log.user_name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 5. CHECKLIST RUNNER / EXECUTION
function ChecklistExecution({ inspectionId, vehicle, onClose }) {
  const [checklist, setChecklist] = useState([]);
  const [responses, setResponses] = useState({}); // { item_id: { status, description, priority, photos: [] } }
  const [activeItemDefect, setActiveItemDefect] = useState(null); // id of item being configured as Defeito
  const [submitting, setSubmitting] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  
  // Custom file inputs references for triggering clicks
  const fileInputRefs = useRef({});

  useEffect(() => {
    const fetchChecklistTree = async () => {
      try {
        const tree = await checklistAPI.getTree(false); // Active only
        setChecklist(tree);

        // Load existing answers
        const existingData = await inspectionAPI.get(inspectionId);
        if (existingData && existingData.items) {
          const loadedResponses = {};
          existingData.items.forEach(item => {
            loadedResponses[item.item_id] = {
              status: item.status,
              description: item.description || '',
              priority: item.priority || 'Média',
              photos: [],
              serverPhotos: item.photos || []
            };
          });
          setResponses(loadedResponses);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchChecklistTree();
  }, [inspectionId]);

  const handleStatusChange = async (itemId, status) => {
    // Initialize default response struct if not exists
    const current = responses[itemId] || { status: '', description: '', priority: 'Média', photos: [] };
    
    if (status === 'Defeito') {
      // Toggle card expanded form
      setResponses({
        ...responses,
        [itemId]: { ...current, status }
      });
      setActiveItemDefect(itemId);
    } else {
      // Direct save to database for OK and Atenção status
      try {
        const itemData = { status, description: '', priority: '', photos: [] };
        await inspectionAPI.saveItem(inspectionId, itemId, itemData);
        
        setResponses({
          ...responses,
          [itemId]: itemData
        });
        
        if (activeItemDefect === itemId) {
          setActiveItemDefect(null);
        }
      } catch (err) {
        alert('Erro ao salvar item.');
        console.error(err);
      }
    }
  };

  const handleDefectSave = async (itemId) => {
    const itemResponse = responses[itemId];
    if (!itemResponse || !itemResponse.description || itemResponse.description.trim() === '') {
      alert('Descrição do problema é obrigatória para defeitos.');
      return;
    }
    if (itemResponse.photos.length === 0) {
      alert('Pelo menos 1 foto é obrigatória para registrar o defeito.');
      return;
    }

    try {
      await inspectionAPI.saveItem(inspectionId, itemId, itemResponse);
      setActiveItemDefect(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao registrar defeito.');
      console.error(err);
    }
  };

  // Mock Photo generator helper for easy testing without physical camera
  const handleGenerateMockPhoto = (itemId) => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111622';
    ctx.fillRect(0, 0, 300, 200);
    ctx.fillStyle = '#007fff';
    ctx.font = '14px Outfit';
    ctx.fillText(`MOCK FOTO DEFEITO`, 80, 80);
    ctx.fillStyle = '#ef4444';
    ctx.fillText(`ITEM ID: ${itemId}`, 80, 110);
    ctx.font = '10px Outfit';
    ctx.fillStyle = '#8e9ea8';
    ctx.fillText(new Date().toLocaleString(), 80, 140);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `mock_photo_${itemId}_${Date.now()}.png`, { type: 'image/png' });
      const current = responses[itemId] || { status: 'Defeito', description: '', priority: 'Média', photos: [] };
      setResponses({
        ...responses,
        [itemId]: { ...current, photos: [...current.photos, file] }
      });
    }, 'image/png');
  };

  const handlePhotoUpload = (itemId, e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    const current = responses[itemId] || { status: 'Defeito', description: '', priority: 'Média', photos: [] };
    setResponses({
      ...responses,
      [itemId]: { ...current, photos: [...current.photos, ...files] }
    });
  };

  const handleFinalizeInspection = async () => {
    if (!signatureName || signatureName.trim() === '') {
      alert('Por favor, assine digitalmente para finalizar.');
      return;
    }

    setSubmitting(true);
    try {
      await inspectionAPI.finalize(inspectionId, signatureName.trim());
      
      // Auto open PDF report download in new tab
      const downloadURL = inspectionAPI.getReportURL(inspectionId);
      window.open(downloadURL, '_blank');
      
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao finalizar inspeção.');
    } finally {
      setSubmitting(false);
      setShowSignatureModal(false);
    }
  };

  return (
    <div>
      <div className="header-actions">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Realizar Inspeção</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Veículo: {vehicle.brand} {vehicle.model} ({vehicle.plate}) | KM: {vehicle.mileage.toLocaleString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" style={{ width: 'auto' }} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" style={{ width: 'auto' }} onClick={() => setShowSignatureModal(true)}>
            Finalizar Checklist
          </button>
        </div>
      </div>

      {checklist.map((category) => (
        <div key={category.id} className="checklist-category-container">
          <h2 className="checklist-category-title">
            {category.name}
          </h2>
          
          <div className="checklist-grid">
            {category.items.map((item) => {
              const res = responses[item.id] || { status: '', description: '', priority: 'Média', photos: [] };
              const isExpanded = activeItemDefect === item.id;
              
              let borderClass = '';
              if (res.status === 'OK') borderClass = 'card-ok';
              if (res.status === 'Atenção') borderClass = 'card-attention';
              if (res.status === 'Defeito') borderClass = 'card-defect';

              return (
                <div key={item.id} className={`checklist-card ${borderClass}`}>
                  <div>
                    <div className="checklist-item-header">{item.name}</div>
                  </div>

                  <div className="status-button-group">
                    <button 
                      type="button" 
                      className={`status-btn ${res.status === 'OK' ? 'active-ok' : ''}`}
                      onClick={() => handleStatusChange(item.id, 'OK')}
                    >
                      OK
                    </button>
                    <button 
                      type="button" 
                      className={`status-btn ${res.status === 'Atenção' ? 'active-attention' : ''}`}
                      onClick={() => handleStatusChange(item.id, 'Atenção')}
                    >
                      Atenção
                    </button>
                    <button 
                      type="button" 
                      className={`status-btn ${res.status === 'Defeito' ? 'active-defect' : ''}`}
                      onClick={() => handleStatusChange(item.id, 'Defeito')}
                    >
                      Defeito
                    </button>
                  </div>

                  {/* Defect subform */}
                  {res.status === 'Defeito' && isExpanded && (
                    <div className="defect-details-form">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Problema Encontrado *</label>
                        <textarea 
                          className="form-input" 
                          style={{ padding: '8px', fontSize: '13px', minHeight: '60px' }}
                          value={res.description}
                          onChange={(e) => setResponses({
                            ...responses,
                            [item.id]: { ...res, description: e.target.value }
                          })}
                          placeholder="Descreva o defeito..."
                          required
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Prioridade *</label>
                        <div className="priority-select-group">
                          {['Baixa', 'Média', 'Alta'].map((prio) => (
                            <button
                              type="button"
                              key={prio}
                              className={`priority-btn ${res.priority === prio ? `active active-${prio}` : ''}`}
                              onClick={() => setResponses({
                                ...responses,
                                [item.id]: { ...res, priority: prio }
                              })}
                            >
                              {prio}
                            </button>
                          ))}
                        </div>
                      </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px' }}>Fotos de Comprovação *</label>
                        <div className="photo-preview-grid">
                          {res.serverPhotos && res.serverPhotos.map((p, idx) => (
                            <div key={`server-${idx}`} className="photo-preview-box">
                              <img src={getPhotoURL(p.photo_path)} alt="Server" />
                            </div>
                          ))}
                          {res.photos.map((p, idx) => (
                            <div key={`local-${idx}`} className="photo-preview-box">
                              <img src={URL.createObjectURL(p)} alt="Preview" />
                            </div>
                          ))}
                          {((res.serverPhotos ? res.serverPhotos.length : 0) + res.photos.length) < 4 && (
                            <>
                              <button 
                                type="button" 
                                className="photo-preview-box btn-add-photo"
                                onClick={() => fileInputRefs.current[item.id].click()}
                                title="Upload de Imagem"
                              >
                                <Camera size={16} />
                              </button>
                              <input 
                                type="file" 
                                ref={el => fileInputRefs.current[item.id] = el}
                                style={{ display: 'none' }}
                                accept="image/*"
                                multiple
                                onChange={(e) => handlePhotoUpload(item.id, e)}
                              />
                            </>
                          )}
                        </div>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          style={{ fontSize: '10px', padding: '4px 8px', marginTop: '8px', width: '100%' }}
                          onClick={() => handleGenerateMockPhoto(item.id)}
                        >
                          Simular Foto local
                        </button>
                      </div>

                      <button 
                        type="button" 
                        className="btn-primary" 
                        style={{ padding: '8px', fontSize: '13px' }}
                        onClick={() => handleDefectSave(item.id)}
                      >
                        Salvar Defeito
                      </button>
                    </div>
                  )}

                  {res.status === 'Defeito' && !isExpanded && (
                    <div style={{ fontSize: '12px', color: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                      <span>Defeito registrado</span>
                      <button 
                        type="button" 
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                        onClick={() => setActiveItemDefect(item.id)}
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Finalizar Inspeção</h2>
              <button className="modal-close" onClick={() => setShowSignatureModal(false)}><X size={20} /></button>
            </div>

            <div className="form-group">
              <label className="form-label">Nome Completo do Responsável (Assinatura)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Digite seu nome para assinar" 
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                required
              />
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>
                Ao assinar, você certifica que todos os itens foram vistoriados de acordo com os padrões.
              </p>

              {signatureName && (
                <div style={{ marginTop: '20px', padding: '16px', border: '1px dashed var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-primary)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '24px', color: 'var(--accent)' }}>
                    {signatureName}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'uppercase' }}>
                    Assinatura Eletrônica Registrada
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowSignatureModal(false)}>Voltar</button>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ flex: 1 }} 
                onClick={handleFinalizeInspection}
                disabled={submitting}
              >
                {submitting ? 'Finalizando...' : 'Confirmar & Baixar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 6. PENDENCIES LIST VIEW
function PendenciesView({ currentUser, onSelectVehicle }) {
  const [pendencies, setPendencies] = useState([]);
  const [filterStatus, setFilterStatus] = useState('Pendente');
  const [loading, setLoading] = useState(true);
  
  // Resolve modal state
  const [resolvingPendency, setResolvingPendency] = useState(null);
  const [repairPhotos, setRepairPhotos] = useState([]);
  const [resolvingSubmit, setResolvingSubmit] = useState(false);

  const fetchPendencies = async () => {
    setLoading(true);
    try {
      const data = await pendenciesAPI.list(filterStatus);
      setPendencies(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendencies();
  }, [filterStatus]);

  const handleStartRepair = async (pendencyId) => {
    try {
      // Set to 'Em andamento' and assign current user as responsible
      await pendenciesAPI.updateStatus(pendencyId, 'Em andamento', currentUser.id);
      fetchPendencies();
    } catch (err) {
      alert('Erro ao iniciar reparo.');
    }
  };

  const handleGenerateMockRepairPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111622';
    ctx.fillRect(0, 0, 300, 200);
    ctx.fillStyle = '#10b981';
    ctx.font = '14px Outfit';
    ctx.fillText(`MOCK FOTO REPARO`, 80, 80);
    ctx.font = '10px Outfit';
    ctx.fillStyle = '#8e9ea8';
    ctx.fillText(new Date().toLocaleString(), 80, 120);
    
    canvas.toBlob((blob) => {
      const file = new File([blob], `mock_repair_${Date.now()}.png`, { type: 'image/png' });
      setRepairPhotos([...repairPhotos, file]);
    }, 'image/png');
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (repairPhotos.length === 0) {
      alert('Por favor, adicione pelo menos uma foto comprovando o reparo.');
      return;
    }

    setResolvingSubmit(true);
    try {
      await pendenciesAPI.resolve(resolvingPendency.id, repairPhotos);
      setResolvingPendency(null);
      setRepairPhotos([]);
      fetchPendencies();
    } catch (err) {
      alert('Erro ao concluir reparo.');
    } finally {
      setResolvingSubmit(false);
    }
  };

  return (
    <div>
      <div className="header-actions">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Controle de Pendências</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Acompanhamento de reparos e correção de defeitos</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          {['Pendente', 'Em andamento', 'Resolvido'].map((st) => (
            <button
              key={st}
              className={`status-btn ${filterStatus === st ? (st === 'Pendente' ? 'active-defect' : st === 'Em andamento' ? 'active-attention' : 'active-ok') : ''}`}
              style={{ padding: '6px 12px', minWidth: '100px' }}
              onClick={() => setFilterStatus(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div>Carregando pendências...</div>
      ) : pendencies.length === 0 ? (
        <div className="panel-card" style={{ textAlign: 'center', padding: '40px' }}>
          <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '16px' }} />
          <h3>Nenhuma pendência nesta categoria</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Bom trabalho! Todos os defeitos foram resolvidos.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {pendencies.map((pend) => (
            <div key={pend.id} className="pendency-card">
              <div className="pendency-header">
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{pend.item_name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Veículo: {pend.brand} {pend.model} ({pend.plate})</p>
                </div>
                <span className={`badge ${
                  pend.status === 'Pendente' ? 'badge-pending' :
                  pend.status === 'Em andamento' ? 'badge-inspecting' :
                  'badge-ready'
                }`}>
                  {pend.status}
                </span>
              </div>

              <div style={{ fontSize: '13px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <strong>Problema: </strong>
                <span style={{ color: 'var(--text-secondary)' }}>{pend.description}</span>
              </div>

              {/* Photos associated to defect */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {pend.photos.map((ph, idx) => (
                  <div key={idx} style={{ flexShrink: 0, width: '60px', height: '60px', borderRadius: '4px', border: '1px solid var(--border)', overflow: 'hidden', position: 'relative' }}>
                    <img 
                      src={getPhotoURL(ph.photo_path)} 
                      alt="Fotos do defeito" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: ph.type === 'defeito' ? 'var(--danger)' : 'var(--success)', fontSize: '8px', color: '#fff', textAlign: 'center', padding: '1px' }}>
                      {ph.type === 'defeito' ? 'Def' : 'Rep'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pendency-grid">
                <div>
                  <div className="pendency-meta-label">Data Registro</div>
                  <div className="pendency-meta-value">{new Date(pend.created_at).toLocaleDateString('pt-BR')}</div>
                </div>
                <div>
                  <div className="pendency-meta-label">Responsável</div>
                  <div className="pendency-meta-value">{pend.responsible_name || 'Não designado'}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, padding: '8px' }} onClick={() => onSelectVehicle(pend.vehicle_id)}>
                  Ver Veículo
                </button>
                {pend.status === 'Pendente' && (
                  <button type="button" className="btn-primary" style={{ flex: 1, padding: '8px' }} onClick={() => handleStartRepair(pend.id)}>
                    Iniciar Reparo
                  </button>
                )}
                {pend.status === 'Em andamento' && (
                  currentUser.role === 'Administrador' ? (
                    <button type="button" className="btn-primary" style={{ flex: 1, padding: '8px', backgroundColor: 'var(--success)' }} onClick={() => setResolvingPendency(pend)}>
                      Concluir Reparo
                    </button>
                  ) : (
                    <button type="button" className="btn-secondary" style={{ flex: 1, padding: '8px' }} disabled title="Apenas Administradores podem concluir reparos">
                      Aguardando Admin
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resolve Modal */}
      {resolvingPendency && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h2>Concluir Reparo</h2>
              <button className="modal-close" onClick={() => { setResolvingPendency(null); setRepairPhotos([]); }}><X size={20} /></button>
            </div>

            <form onSubmit={handleResolveSubmit}>
              <div className="form-group">
                <label className="form-label">Item sendo resolvido</label>
                <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <strong>{resolvingPendency.item_name}</strong>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{resolvingPendency.description}</div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Comprovante de Reparo (Fotos) *</label>
                <div className="photo-preview-grid" style={{ marginBottom: '10px' }}>
                  {repairPhotos.map((p, idx) => (
                    <div key={idx} className="photo-preview-box">
                      <img src={URL.createObjectURL(p)} alt="Preview" />
                    </div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ flex: 1, fontSize: '12px' }}
                    onClick={handleGenerateMockRepairPhoto}
                  >
                    Simular Foto Reparo
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => { setResolvingPendency(null); setRepairPhotos([]); }}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--success)' }} disabled={resolvingSubmit}>
                  {resolvingSubmit ? 'Concluindo...' : 'Concluir Pendência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 7. CONFIG CHECKLIST TREE (ADMIN ONLY)
function ConfigChecklistTree() {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals / Input states
  const [newCatName, setNewCatName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [activeCatForNewItem, setActiveCatForNewItem] = useState(null);

  const fetchTree = async () => {
    setLoading(true);
    try {
      const data = await checklistAPI.getTree(true); // Include disabled ones
      setTree(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      await checklistAPI.createCategory(newCatName.trim());
      setNewCatName('');
      fetchTree();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar categoria.');
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !activeCatForNewItem) return;

    try {
      await checklistAPI.createItem(activeCatForNewItem, newItemName.trim());
      setNewItemName('');
      setActiveCatForNewItem(null);
      fetchTree();
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao criar item.');
    }
  };

  const handleToggleItemStatus = async (item) => {
    try {
      const updatedStatus = item.is_active === 1 ? 0 : 1;
      await checklistAPI.updateItem(item.id, item.name, updatedStatus);
      fetchTree();
    } catch (err) {
      alert('Erro ao atualizar status do item.');
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Deseja realmente remover este item? Se ele tiver histórico de inspeções, será apenas desativado logicamente.')) return;
    try {
      await checklistAPI.deleteItem(itemId);
      fetchTree();
    } catch (err) {
      alert('Erro ao excluir item.');
    }
  };

  return (
    <div>
      <div className="header-actions">
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Configuração do Checklist</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gerenciamento de categorias e itens do checklist padrão</p>
        </div>
      </div>

      <div className="dashboard-layout-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        {/* Left Side: Create Category Form */}
        <div>
          <div className="panel-card">
            <h2 className="panel-title">Nova Categoria</h2>
            <form onSubmit={handleAddCategory}>
              <div className="form-group">
                <label className="form-label">Nome da Categoria</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ex: Motor" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  required 
                />
              </div>
              <button type="submit" className="btn-primary">
                Criar Categoria
              </button>
            </form>
          </div>

          {activeCatForNewItem && (
            <div className="panel-card" style={{ border: '1px solid var(--accent)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h2 className="panel-title" style={{ marginBottom: 0 }}>Novo Item</h2>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setActiveCatForNewItem(null)}>
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Adicionando item em: <strong>{tree.find(c => c.id === activeCatForNewItem)?.name}</strong>
              </p>
              <form onSubmit={handleAddItem}>
                <div className="form-group">
                  <label className="form-label">Nome do Item</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Ex: Nível do Óleo" 
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    required 
                  />
                </div>
                <button type="submit" className="btn-primary">
                  Adicionar Item
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Side: Checklist Tree View */}
        <div>
          {loading ? (
            <div>Carregando estrutura...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {tree.map((category) => (
                <div key={category.id} className="panel-card" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '14px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700 }}>{category.name}</h3>
                    
                    <button 
                      className="btn-secondary" 
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                      onClick={() => setActiveCatForNewItem(category.id)}
                    >
                      <Plus size={12} />
                      Adicionar Item
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {category.items.length === 0 ? (
                      <span style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', fontSize: '13px' }}>Nenhum item cadastrado nesta categoria.</span>
                    ) : (
                      category.items.map((item) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '13px', color: item.is_active === 1 ? '#fff' : 'var(--text-secondary)', textDecoration: item.is_active === 1 ? 'none' : 'line-through' }}>
                            {item.name}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                              type="button" 
                              style={{ background: 'none', border: 'none', color: item.is_active === 1 ? 'var(--success)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                              onClick={() => handleToggleItemStatus(item)}
                            >
                              {item.is_active === 1 ? 'Ativo' : 'Inativo'}
                            </button>
                            <button 
                              type="button" 
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              onClick={() => handleDeleteItem(item.id)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
