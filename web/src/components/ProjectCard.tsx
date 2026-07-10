'use client';

import React, { useTransition } from 'react';
import { triggerPing, triggerBackup } from '@/app/actions';

export default function ProjectCard({ p }: { p: any }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-500 transition-all group">
      <div className="p-5 border-b border-slate-700">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold">{p.name}</h3>
          <span className={`px-2 py-1 text-xs rounded-full font-medium 
            ${p.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : ''}
            ${p.status === 'paused' ? 'bg-amber-500/20 text-amber-400' : ''}
            ${p.status === 'at_risk' ? 'bg-red-500/20 text-red-400 animate-pulse' : ''}
            ${p.status === 'unknown' ? 'bg-slate-500/20 text-slate-400' : ''}
          `}>
            {p.status.toUpperCase()}
          </span>
        </div>
        <p className="text-slate-400 text-sm uppercase tracking-wider">{p.phase}</p>
      </div>
      
      <div className="p-5 bg-slate-800/50">
        <div className="flex justify-between text-sm mb-3">
          <span className="text-slate-400">Last Keep-Alive</span>
          <span className="font-medium text-slate-200">{p.lastPing}</span>
        </div>
        <div className="flex justify-between text-sm mb-3">
          <span className="text-slate-400">Last Backup</span>
          <span className="font-medium text-slate-200">{p.lastBackup}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Database Size</span>
          <span className="font-medium text-slate-200">{p.size}</span>
        </div>
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
        <button 
          onClick={() => startTransition(() => triggerPing(p.id))}
          disabled={isPending}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-sm transition-colors disabled:opacity-50"
        >
          Ping
        </button>
        <button 
          onClick={() => startTransition(() => triggerBackup(p.id))}
          disabled={isPending}
          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded text-sm transition-colors disabled:opacity-50"
        >
          Backup
        </button>
      </div>
    </div>
  );
}
