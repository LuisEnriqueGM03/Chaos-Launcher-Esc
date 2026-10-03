import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0505] text-slate-100 p-8 select-none">
          <div className="max-w-lg w-full bg-[#160a0a] border border-red-800/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-8 h-8" />
              <h1 className="text-xl font-bold font-gamer tracking-wide">
                ERROR EN LA INTERFAZ
              </h1>
            </div>
            <p className="text-xs text-slate-300">
              Ocurrió un error inesperado al renderizar el launcher.
            </p>
            <div className="p-3 bg-black/60 rounded-xl border border-red-900/40 text-xs font-mono text-red-300 max-h-48 overflow-auto whitespace-pre-wrap">
              {this.state.error?.toString()}
              {this.state.errorInfo?.componentStack}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-gamer font-bold text-sm tracking-wider flex items-center justify-center gap-2 shadow-neon-red/40 shadow transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>RECARGAR LAUNCHER</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
