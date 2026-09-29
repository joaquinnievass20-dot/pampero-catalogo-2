import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  tabName?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AdminErrorBoundary caught an error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-amber-50 border-2 border-amber-300 rounded-xs text-[#18231C]">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wide">
                Aviso en {this.props.tabName || 'Panel de Control'}
              </h3>
              <p className="text-xs text-[#6F6860]">
                Ocurrió un problema al cargar esta sección. El resto del sistema sigue funcionando con normalidad.
              </p>
            </div>
          </div>
          {this.state.error?.message && (
            <div className="mb-4 p-2.5 bg-white border border-amber-200 rounded-xs text-xs font-mono text-red-700 overflow-x-auto">
              {this.state.error.message}
            </div>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 bg-[#18231C] text-white rounded-xs text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-black transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar carga
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
