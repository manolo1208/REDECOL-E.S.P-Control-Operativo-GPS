
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Navigation, 
  MapPin, 
  Settings as SettingsIcon, 
  History, 
  Play, 
  Square, 
  Share2, 
  FileText, 
  AlertCircle,
  Trash2,
  CheckCircle2,
  CloudUpload
} from 'lucide-react';
import { GPSPoint, RouteSession, AppSettings, AppView } from './types';
import { generateRouteAnalysis } from './services/geminiService';

// Initial constants
const STORAGE_KEY_SETTINGS = 'redecol_settings';
const STORAGE_KEY_HISTORY = 'redecol_history';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.MONITOR);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    return saved ? JSON.parse(saved) : { operatorName: '', webhookUrl: '', autoSync: false };
  });
  
  const [currentSession, setCurrentSession] = useState<RouteSession | null>(null);
  const [history, setHistory] = useState<RouteSession[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
    return saved ? JSON.parse(saved) : [];
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const watchIdRef = useRef<number | null>(null);

  // Save state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }, [history]);

  // GPS Logic
  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("Geolocalización no soportada en este navegador.");
      return;
    }

    const session: RouteSession = {
      id: Date.now().toString(),
      startTime: new Date().toISOString(),
      operator: settings.operatorName || 'Operador Desconocido',
      points: [],
      status: 'active'
    };

    setCurrentSession(session);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPoint: GPSPoint = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          timestamp: new Date().toISOString()
        };
        
        setCurrentSession(prev => {
          if (!prev) return null;
          return {
            ...prev,
            points: [...prev.points, newPoint]
          };
        });
      },
      (error) => {
        console.error("GPS Error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (currentSession) {
      const completedSession: RouteSession = {
        ...currentSession,
        endTime: new Date().toISOString(),
        status: 'completed'
      };
      setHistory(prev => [completedSession, ...prev]);
      setCurrentSession(null);
      setView(AppView.HISTORY);

      if (settings.autoSync && settings.webhookUrl) {
        handleSync(completedSession);
      }
    }
  };

  const handleSync = async (session: RouteSession) => {
    if (!settings.webhookUrl) return;
    setSyncStatus('syncing');
    try {
      const response = await fetch(settings.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'ROUTE_COMPLETED',
          session
        })
      });
      if (response.ok) setSyncStatus('success');
      else setSyncStatus('error');
    } catch (e) {
      setSyncStatus('error');
    } finally {
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  const analyzeSession = async (session: RouteSession) => {
    setIsAnalyzing(true);
    setView(AppView.REPORT);
    try {
      const result = await generateRouteAnalysis(session.points, session.operator);
      setAnalysisResult(result);
    } catch (error) {
      alert("Error al analizar la ruta con IA.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const deleteSession = (id: string) => {
    if (confirm("¿Seguro que deseas eliminar este registro?")) {
      setHistory(prev => prev.filter(s => s.id !== id));
    }
  };

  const exportCSV = (session: RouteSession) => {
    const headers = ['Latitud', 'Longitud', 'Timestamp', 'Exactitud', 'Velocidad'];
    const rows = session.points.map(p => [
      p.lat,
      p.lng,
      p.timestamp,
      p.accuracy || 0,
      p.speed || 0
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ruta_${session.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-emerald-700 text-white p-4 shadow-md sticky top-0 z-50">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="bg-white p-1 rounded-md">
              <img src="https://picsum.photos/id/191/40/40" alt="Logo" className="w-8 h-8 object-contain rounded" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">REDECOL E.S.P</h1>
              <p className="text-[10px] opacity-80 uppercase tracking-wider">Control Operativo GPS</p>
            </div>
          </div>
          {syncStatus !== 'idle' && (
            <div className={`px-2 py-1 rounded text-xs flex items-center space-x-1 ${
              syncStatus === 'syncing' ? 'bg-amber-500' : 
              syncStatus === 'success' ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {syncStatus === 'syncing' && <div className="w-2 h-2 border-2 border-white border-t-transparent animate-spin rounded-full"></div>}
              <span>{syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'success' ? 'Sincronizado' : 'Error Sync'}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto p-4 pb-24">
        
        {view === AppView.MONITOR && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Seguimiento en Vivo</h2>
                    <p className="text-slate-500 text-sm">Captura de coordenadas en tiempo real</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${currentSession ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`}></div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Puntos Capturados</span>
                    <p className="text-3xl font-bold text-emerald-600">{currentSession?.points.length || 0}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Tiempo Transcurrido</span>
                    <p className="text-3xl font-bold text-emerald-600">
                      {currentSession ? `${Math.floor((Date.now() - new Date(currentSession.startTime).getTime()) / 60000)}m` : '0m'}
                    </p>
                  </div>
                </div>

                {!currentSession ? (
                  <button 
                    onClick={startTracking}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-95"
                  >
                    <Play className="fill-current" />
                    <span>INICIAR RUTA</span>
                  </button>
                ) : (
                  <button 
                    onClick={stopTracking}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-95"
                  >
                    <Square className="fill-current" />
                    <span>DETENER Y GUARDAR</span>
                  </button>
                )}
              </div>
              
              {currentSession && currentSession.points.length > 0 && (
                <div className="bg-slate-900 h-48 relative overflow-hidden flex items-center justify-center text-slate-500 italic text-sm">
                  {/* Visual representation of route */}
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path 
                        d={`M ${currentSession.points.map((p, i) => `${(p.lng + 180) % 100},${(p.lat + 90) % 100}`).join(' L ')}`} 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                  <div className="z-10 bg-black/40 p-2 rounded backdrop-blur-sm border border-white/10">
                    Lat: {currentSession.points[currentSession.points.length - 1].lat.toFixed(6)} | Lng: {currentSession.points[currentSession.points.length - 1].lng.toFixed(6)}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start space-x-3">
              <AlertCircle className="text-emerald-600 shrink-0 mt-1" size={20} />
              <div className="text-sm text-emerald-800">
                <p className="font-semibold">Decreto 1381 de 2024</p>
                <p className="opacity-80">Asegúrese de activar el GPS antes de iniciar la jornada para validar correctamente el cargue en el SUI.</p>
              </div>
            </div>
          </div>
        )}

        {view === AppView.HISTORY && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">Historial de Rutas</h2>
            {history.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
                <History className="mx-auto text-slate-300" size={48} />
                <p className="text-slate-500">No hay rutas registradas todavía.</p>
              </div>
            ) : (
              history.map(session => (
                <div key={session.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:border-emerald-200 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-slate-800">Ruta #{session.id.slice(-6)}</h3>
                      <p className="text-xs text-slate-400">{new Date(session.startTime).toLocaleString()}</p>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => exportCSV(session)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Exportar CSV"
                      >
                        <Share2 size={18} />
                      </button>
                      <button 
                        onClick={() => deleteSession(session.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 mb-4 text-sm">
                    <div className="flex items-center space-x-1 text-slate-600">
                      <MapPin size={14} className="text-emerald-500" />
                      <span>{session.points.length} puntos</span>
                    </div>
                    <div className="flex items-center space-x-1 text-slate-600">
                      <FileText size={14} className="text-emerald-500" />
                      <span>{session.operator}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleSync(session)}
                      className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-lg flex items-center justify-center space-x-1"
                    >
                      <CloudUpload size={14} />
                      <span>Sincronizar</span>
                    </button>
                    <button 
                      onClick={() => analyzeSession(session)}
                      className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg flex items-center justify-center space-x-1"
                    >
                      <CheckCircle2 size={14} />
                      <span>Analizar con IA</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === AppView.SETTINGS && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 text-center">Configuración de Planta</h2>
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Nombre del Operador / Reciclador</label>
                <input 
                  type="text" 
                  value={settings.operatorName}
                  onChange={(e) => setSettings({...settings, operatorName: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">Webhook URL (Destino de Datos)</label>
                <input 
                  type="url" 
                  value={settings.webhookUrl}
                  onChange={(e) => setSettings({...settings, webhookUrl: e.target.value})}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="https://tu-api.com/webhook"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-sm font-semibold text-slate-600">Sincronización Automática</span>
                <button 
                  onClick={() => setSettings({...settings, autoSync: !settings.autoSync})}
                  className={`w-12 h-6 rounded-full transition-colors relative ${settings.autoSync ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.autoSync ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400 text-center px-4">
              La configuración se guarda localmente en su dispositivo para futuras sesiones.
            </p>
          </div>
        )}

        {view === AppView.REPORT && (
          <div className="space-y-4">
             <div className="flex items-center space-x-2 mb-4">
               <button onClick={() => setView(AppView.HISTORY)} className="text-emerald-600 text-sm font-bold">← Volver al Historial</button>
             </div>
             {isAnalyzing ? (
               <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full mx-auto"></div>
                  <h3 className="text-xl font-bold text-slate-800">Generando Informe IA</h3>
                  <p className="text-slate-500 animate-pulse">Analizando cumplimiento del Decreto 1381...</p>
               </div>
             ) : analysisResult ? (
               <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                  <div className="bg-emerald-700 p-6 text-white">
                    <h2 className="text-2xl font-bold">Resultado del Análisis IA</h2>
                    <div className="flex items-center space-x-2 mt-2">
                      <div className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">CALIFICACIÓN: {analysisResult.calificacionRuta}/10</div>
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <section>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resumen Operativo</h4>
                      <p className="text-slate-700 leading-relaxed">{analysisResult.resumen}</p>
                    </section>
                    
                    <section className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-2">Cumplimiento Normativo</h4>
                      <p className="text-emerald-900">{analysisResult.cumplimientoNormativo}</p>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Anomalías Detectadas</h4>
                      <ul className="space-y-2">
                        {analysisResult.anomalias.map((a: string, i: number) => (
                          <li key={i} className="flex items-start space-x-2 text-slate-700">
                            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                            <span>{a}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sugerencia de Eficiencia</h4>
                      <p className="text-slate-700 italic">"{analysisResult.sugerenciaEficiencia}"</p>
                    </section>
                  </div>
               </div>
             ) : (
               <div className="text-center p-8">Hubo un error al generar el reporte.</div>
             )}
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50">
        <button 
          onClick={() => setView(AppView.MONITOR)}
          className={`flex flex-col items-center space-y-1 ${view === AppView.MONITOR ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <Navigation size={24} className={view === AppView.MONITOR ? 'fill-emerald-50' : ''} />
          <span className="text-[10px] font-bold uppercase">Monitor</span>
        </button>
        <button 
          onClick={() => setView(AppView.HISTORY)}
          className={`flex flex-col items-center space-y-1 ${view === AppView.HISTORY ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <History size={24} />
          <span className="text-[10px] font-bold uppercase">Rutas</span>
        </button>
        <button 
          onClick={() => setView(AppView.SETTINGS)}
          className={`flex flex-col items-center space-y-1 ${view === AppView.SETTINGS ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <SettingsIcon size={24} />
          <span className="text-[10px] font-bold uppercase">Config</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
