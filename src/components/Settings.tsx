import React from 'react';
import { Button } from './ui';
import { ArrowLeft } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        <div className="text-center text-muted-foreground">
          Settings - Coming Soon
        </div>
      </div>
    </div>
  );
};