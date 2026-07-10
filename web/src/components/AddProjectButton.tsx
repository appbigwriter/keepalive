'use client';

import React, { useState } from 'react';
import AddProjectModal from './AddProjectModal';

interface Organization {
  id: string;
  name: string;
}

export default function AddProjectButton({
  organizations,
}: {
  organizations: Organization[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer"
      >
        + Add Project
      </button>

      {isOpen && (
        <AddProjectModal
          organizations={organizations}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
