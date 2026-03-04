import React from 'react';
import './MenuBar.css';

export default function MenuBar({ onNavigate, currentPage }) {
  return (
    <div className="menu-bar">
      <div className="menu-content">
        <button
          className="menu-home-btn"
          onClick={() => onNavigate('home')}
          title="Home"
        >
          ⌂
        </button>
        <div className="menu-spacer"></div>
        <button
          className={`menu-item ${currentPage === 'dca' ? 'active' : ''}`}
          onClick={() => onNavigate('dca')}
        >
          DCA Calculator
        </button>
      </div>
    </div>
  );
}
