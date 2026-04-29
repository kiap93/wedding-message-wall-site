import React, { createContext, useContext, useState, useEffect } from 'react';
import { Agency } from '../types';
import { getCurrentSubdomain, resolveWorkspaceBySlug } from './workspace';

interface WorkspaceContextType {
  workspace: Agency | null;
  isLoading: boolean;
  isSubdomain: boolean;
  error: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subdomain = getCurrentSubdomain();

  useEffect(() => {
    async function loadWorkspace() {
      if (!subdomain) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await resolveWorkspaceBySlug(subdomain);
        if (data) {
          setWorkspace(data);
        } else {
          setError('Workspace not found');
        }
      } catch (err) {
        console.error('Failed to resolve workspace:', err);
        setError('Failed to load workspace data');
      } finally {
        setIsLoading(false);
      }
    }

    loadWorkspace();
  }, [subdomain]);

  return (
    <WorkspaceContext.Provider value={{ 
      workspace, 
      isLoading, 
      isSubdomain: !!subdomain,
      error 
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
