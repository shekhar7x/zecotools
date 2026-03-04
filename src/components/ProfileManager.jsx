import React, { useState, useEffect } from 'react';
import './ProfileManager.css';

export default function ProfileManager({ currentData, onLoadProfile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [showExportImport, setShowExportImport] = useState(false);
  const [importText, setImportText] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = () => {
    const saved = localStorage.getItem('dca_profiles');
    if (saved) {
      setProfiles(JSON.parse(saved));
    }
  };

  const saveProfiles = (newProfiles) => {
    localStorage.setItem('dca_profiles', JSON.stringify(newProfiles));
    setProfiles(newProfiles);
  };

  const handleSaveProfile = () => {
    if (!profileName.trim()) return;

    const profile = {
      id: Date.now(),
      name: profileName.trim(),
      data: currentData,
      createdAt: new Date().toISOString()
    };

    const newProfiles = [...profiles, profile];
    saveProfiles(newProfiles);
    setProfileName('');
  };

  const handleLoadProfile = (profile) => {
    onLoadProfile(profile.data);
    setIsOpen(false);
  };

  const handleDeleteProfile = (id) => {
    const newProfiles = profiles.filter(p => p.id !== id);
    saveProfiles(newProfiles);
  };

  const handleExport = () => {
    const exportData = JSON.stringify(profiles, null, 2);
    navigator.clipboard.writeText(exportData);
    alert('Profiles copied to clipboard!');
  };

  const handleImport = () => {
    try {
      const imported = JSON.parse(importText);
      if (Array.isArray(imported)) {
        saveProfiles(imported);
        setImportText('');
        setShowExportImport(false);
        alert('Profiles imported successfully!');
      } else {
        alert('Invalid format. Must be an array of profiles.');
      }
    } catch (e) {
      alert('Invalid JSON format');
    }
  };

  return (
    <div className="profile-manager">
      <button
        className="profile-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Manage Profiles"
      >
        ⊕
      </button>

      {isOpen && (
        <>
          <div className="profile-backdrop" onClick={() => setIsOpen(false)}></div>
          <div className="profile-panel">
            <div className="profile-header">
              <span>Profiles</span>
              <button className="profile-close" onClick={() => setIsOpen(false)}>×</button>
            </div>

            <div className="profile-save">
              <input
                type="text"
                placeholder="Profile name"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSaveProfile()}
              />
              <button onClick={handleSaveProfile} disabled={!profileName.trim()}>Save</button>
            </div>

            <div className="profile-list">
              {profiles.length === 0 ? (
                <div className="profile-empty">No saved profiles</div>
              ) : (
                profiles.map(profile => (
                  <div key={profile.id} className="profile-item">
                    <div className="profile-info" onClick={() => handleLoadProfile(profile)}>
                      <div className="profile-name">{profile.name}</div>
                      <div className="profile-date">{new Date(profile.createdAt).toLocaleDateString()}</div>
                    </div>
                    <button
                      className="profile-delete"
                      onClick={() => handleDeleteProfile(profile.id)}
                      title="Delete"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="profile-actions">
              <button onClick={() => setShowExportImport(!showExportImport)}>
                {showExportImport ? 'Hide' : 'Export/Import'}
              </button>
            </div>

            {showExportImport && (
              <div className="profile-export-import">
                <button onClick={handleExport}>Copy All</button>
                <textarea
                  placeholder="Paste profiles JSON here to import"
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={4}
                ></textarea>
                <button onClick={handleImport} disabled={!importText.trim()}>Import</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
