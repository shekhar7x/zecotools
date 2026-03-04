import { useState } from 'react'
import MenuBar from './components/MenuBar'
import HomePage from './components/HomePage'
import DCACalculator from './components/DCACalculator'

function App() {
  const [currentPage, setCurrentPage] = useState('dca')

  const handleNavigate = (page) => {
    setCurrentPage(page)
  }

  return (
    <div className="app-container">
      <MenuBar onNavigate={handleNavigate} currentPage={currentPage} />

      {currentPage === 'home' && <HomePage onNavigate={handleNavigate} />}
      {currentPage === 'dca' && <DCACalculator />}
    </div>
  )
}

export default App
