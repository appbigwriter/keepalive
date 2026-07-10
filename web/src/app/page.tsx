import React from 'react';
import { ShieldAlert, ShieldCheck, Database, Clock, Server } from 'lucide-react';
import { getDashboardStats, getProjects, getOrganizations } from './actions';
import ProjectCard from '@/components/ProjectCard';
import AddProjectButton from '@/components/AddProjectButton';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const stats = await getDashboardStats();
  const projects = await getProjects();
  const organizations = await getOrganizations();

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500">
            KeepAlive
          </h1>
          <p className="text-slate-400 mt-1">Supabase Projects Fleet Manager</p>
        </div>
        <AddProjectButton organizations={organizations} />
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
          <div className="bg-emerald-500/20 p-3 rounded-lg text-emerald-400">
            <Server size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Total Projects</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
          <div className="bg-blue-500/20 p-3 rounded-lg text-blue-400">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Active & Healthy</p>
            <p className="text-2xl font-bold">{stats.active}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
          <div className="bg-amber-500/20 p-3 rounded-lg text-amber-400">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">Paused</p>
            <p className="text-2xl font-bold">{stats.paused}</p>
          </div>
        </div>
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex items-center gap-4">
          <div className="bg-red-500/20 p-3 rounded-lg text-red-400">
            <ShieldAlert size={24} />
          </div>
          <div>
            <p className="text-slate-400 text-sm">At Risk (90 days)</p>
            <p className="text-2xl font-bold text-red-400">{stats.atRisk}</p>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((p) => (
          <ProjectCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
