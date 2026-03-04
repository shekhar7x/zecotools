import React from 'react';
import './HomePage.css';

const tools = [
  {
    id: 'dca',
    name: 'DCA Calculator',
    icon: '📊',
    description: 'Decline & Invest Calculator'
  }
];

export default function HomePage({ onNavigate }) {
  return (
    <div className="homepage">
      <div className="homepage-header">
        <h1>ZecoTools</h1>
        <p>Your collection of financial tools</p>
      </div>

      <div className="tools-grid">
        {tools.map(tool => (
          <div
            key={tool.id}
            className="tool-card"
            onClick={() => onNavigate(tool.id)}
          >
            <div className="tool-icon">{tool.icon}</div>
            <div className="tool-name">{tool.name}</div>
            <div className="tool-description">{tool.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
