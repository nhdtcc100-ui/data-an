import React, { useState, useEffect } from 'react';
import {
  Radio, RefreshCw, Pause, Play, CheckCircle2,
  Clock, HardDrive, X, Zap
} from 'lucide-react';
import { liveWatcherService } from '../../services/localFileWatcherService';
import type {
  LiveWatcherStatus,
  LiveWatcherStats
} from '../../services/localFileWatcherService';

interface LiveSyncBannerProps {
  onDataRefresh?: () => void;
}

export const LiveSyncBanner: React.FC<LiveSyncBannerProps> = ({ onDataRefresh }) => {
  const [status, setStatus] = useState<LiveWatcherStatus>(liveWatcherService.getStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastNotification, setLastNotification] = useState<string | null>(null);

  useEffect(() => {
    // اشتراك في تحديثات الحالة
    const unsubscribeStatus = liveWatcherService.subscribeStatus((newStatus) => {
      setStatus(newStatus);
    });

    // اشتراك في وصول بيانات جديدة من الملف المحلي
    const unsubscribeData = liveWatcherService.onDataUpdate((_tables, stats: LiveWatcherStats) => {
      const addedText =
        stats.addedRows > 0
          ? `(+${stats.addedRows} صف جديد)`
          : stats.addedRows < 0
          ? `(${stats.addedRows} صف)`
          : '(تم تحديث القيم)';
      setLastNotification(`تم التحديث التلقائي بنجاح ${addedText} - ${new Date().toLocaleTimeString('ar-EG')}`);

      if (onDataRefresh) {
        onDataRefresh();
      }

      setTimeout(() => {
        setLastNotification(null);
      }, 6000);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeData();
    };
  }, [onDataRefresh]);

  if (!status.isWatching && !status.fileName) {
    return null;
  }

  const handleRefreshNow = async () => {
    setIsRefreshing(true);
    try {
      await liveWatcherService.checkForUpdates(true);
      if (onDataRefresh) onDataRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTogglePause = () => {
    if (status.isWatching) {
      liveWatcherService.stop();
    } else {
      liveWatcherService.resume();
    }
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ms = parseInt(e.target.value, 10);
    liveWatcherService.setIntervalMs(ms);
  };

  const handleDisconnect = () => {
    liveWatcherService.clear();
  };

  return (
    <div
      dir="rtl"
      className="bg-slate-900/90 border-b border-emerald-500/30 backdrop-blur-md px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg z-30 transition-all duration-300"
    >
      {/* ── Right side: Status and File Info ── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {status.isWatching ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            )}
          </span>
          <span className="font-bold text-slate-100 flex items-center gap-1.5">
            <Radio className={`w-3.5 h-3.5 ${status.isWatching ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            {status.isWatching ? 'تزامن حي نشط (Power Query Live)' : 'المراقبة متوقفة مؤقتاً'}
          </span>
        </div>

        <div className="h-3.5 w-px bg-slate-700 hidden sm:block" />

        <div className="flex items-center gap-1.5 text-slate-300">
          <HardDrive className="w-3.5 h-3.5 text-sky-400" />
          <span className="font-semibold text-sky-300 max-w-[200px] truncate" title={status.fileName || ''}>
            {status.fileName}
          </span>
          <span className="text-[10px] text-slate-500">
            ({(status.fileSizeBytes / 1024).toFixed(1)} KB)
          </span>
        </div>

        {status.updateCount > 0 && (
          <span className="hidden md:inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
            <Zap className="w-2.5 h-2.5" />
            {status.updateCount} تحديث تلقائي
          </span>
        )}
      </div>

      {/* ── Notification Banner ── */}
      {lastNotification && (
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-lg animate-fadeIn">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>{lastNotification}</span>
        </div>
      )}

      {/* ── Left side: Controls ── */}
      <div className="flex items-center gap-2">
        {/* Interval Selector */}
        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>كل:</span>
          <select
            value={status.intervalMs}
            onChange={handleIntervalChange}
            className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200 text-[11px] focus:outline-none focus:border-sky-500 cursor-pointer"
          >
            <option value={2000}>2 ثانية (فوري)</option>
            <option value={5000}>5 ثوانٍ</option>
            <option value={15000}>15 ثانية</option>
            <option value={30000}>30 ثانية</option>
            <option value={60000}>دقيقة</option>
          </select>
        </div>

        {/* Refresh Now Button */}
        <button
          onClick={handleRefreshNow}
          disabled={isRefreshing}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-[11px] font-semibold transition cursor-pointer"
          title="فحص فوري وتحديث الآن"
        >
          <RefreshCw className={`w-3 h-3 text-sky-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>تحديث الآن</span>
        </button>

        {/* Pause/Resume Button */}
        <button
          onClick={handleTogglePause}
          className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-semibold transition cursor-pointer ${
            status.isWatching
              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
          }`}
          title={status.isWatching ? 'إيقاف المراقبة مؤقتاً' : 'استئناف المراقبة'}
        >
          {status.isWatching ? (
            <>
              <Pause className="w-3 h-3" />
              <span>إيقاف مؤقت</span>
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              <span>استئناف</span>
            </>
          )}
        </button>

        {/* Disconnect Button */}
        <button
          onClick={handleDisconnect}
          className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
          title="فصل المراقبة الحية"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
