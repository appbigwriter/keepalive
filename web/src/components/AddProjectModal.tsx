'use client';

import React, { useState, useTransition } from 'react';
import { createProject } from '@/app/actions';
import { X, Plus } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
}

export default function AddProjectModal({
  organizations,
  onClose,
}: {
  organizations: Organization[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [isNewOrg, setIsNewOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgToken, setNewOrgToken] = useState('');

  const [nickname, setNickname] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [phase, setPhase] = useState('dev');
  const [criticality, setCriticality] = useState('medium');
  const [connString, setConnString] = useState('');
  const [scopeBuckets, setScopeBuckets] = useState(false);
  const [scopeEdge, setScopeEdge] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isNewOrg && !newOrgName.trim()) {
      setError('Por favor, informe o nome da nova organização.');
      return;
    }
    if (!isNewOrg && !selectedOrgId) {
      setError('Por favor, selecione ou crie uma organização.');
      return;
    }
    if (!nickname.trim() || !projectRef.trim() || !connString.trim()) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    startTransition(async () => {
      try {
        await createProject({
          orgId: isNewOrg ? null : selectedOrgId,
          newOrgName: isNewOrg ? newOrgName.trim() : undefined,
          newOrgToken: isNewOrg ? newOrgToken.trim() : undefined,
          nickname: nickname.trim(),
          projectRef: projectRef.trim(),
          phase,
          criticality,
          connString: connString.trim(),
          scopeBuckets,
          scopeEdge,
        });
        onClose();
      } catch (err: any) {
        setError(err.message || 'Erro ao cadastrar o projeto. Verifique a conexão.');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Plus size={20} className="text-emerald-400" />
            Cadastrar Novo Projeto
          </h2>
          <button 
            type="button"
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Org Section */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-300">Organização</label>
            <div className="flex gap-2">
              <select
                disabled={isNewOrg}
                value={selectedOrgId}
                onChange={(e) => setSelectedOrgId(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 disabled:opacity-50 text-sm"
              >
                <option value="">Selecione uma organização...</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setIsNewOrg(!isNewOrg);
                  setError(null);
                }}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  isNewOrg 
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600 text-slate-300'
                }`}
              >
                {isNewOrg ? 'Usar Existente' : '+ Nova Org'}
              </button>
            </div>

            {isNewOrg && (
              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nome da Organização *</label>
                  <input
                    type="text"
                    required={isNewOrg}
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Ex: Minha Empresa"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Token de Gerenciamento (Opcional)</label>
                  <input
                    type="password"
                    value={newOrgToken}
                    onChange={(e) => setNewOrgToken(e.target.value)}
                    placeholder="Supabase Management Token"
                    className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-800" />

          {/* Project Section */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Apelido do Projeto *</label>
              <input
                type="text"
                required
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: App Produção"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Project Ref (ID) *</label>
              <input
                type="text"
                required
                value={projectRef}
                onChange={(e) => setProjectRef(e.target.value)}
                placeholder="Ex: lmkiyzlqdnhhinxtsfst"
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Fase *</label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
              >
                <option value="dev">Desenvolvimento (dev)</option>
                <option value="homolog">Homologação (homolog)</option>
                <option value="production">Produção (production)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">Criticidade *</label>
              <select
                value={criticality}
                onChange={(e) => setCriticality(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-1">Postgres Connection String *</label>
            <input
              type="password"
              required
              value={connString}
              onChange={(e) => setConnString(e.target.value)}
              placeholder="postgresql://postgres.[ref]:[password]@host:5432/postgres"
              className="w-full bg-slate-800 border border-slate-700 text-slate-100 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500 text-sm"
            />
          </div>

          {/* Scope Checkboxes */}
          <div className="space-y-2 pt-2">
            <label className="block text-sm font-semibold text-slate-300">Escopo do Backup</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeBuckets}
                  onChange={(e) => setScopeBuckets(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                Incluir Storage Buckets
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scopeEdge}
                  onChange={(e) => setScopeEdge(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                Incluir Edge Functions
              </label>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-800 flex gap-3 justify-end bg-slate-900/30">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
            >
              {isPending ? 'Cadastrando...' : 'Confirmar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
