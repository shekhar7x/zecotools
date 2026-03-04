import React, { useState, useEffect, useMemo } from 'react';
import './DCACalculator.css';

// ── Helper Functions ──

const formatPct = (n) => {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';
};

export default function DcaCalculator() {
  // ── State ──
  const [primaryCurrency, setPrimaryCurrency] = useState('INR');
  const [inputs, setInputs] = useState({
    startPrice: 100,
    totalInvestment: '1,00,000', // String to handle commas
    initialInvestAmt: 10000,
    txChangePct: 50,
    initialDecline: 5,
    divisor: 2,
    declineBasis: 'relative', // 'relative' or 'start'
    gapDays: 10,
    startDate: new Date().toISOString().split('T')[0],
    targetPrice: 100,
    rateUSD: 83.5,
    rateAED: 22.7,
    buyAtStart: false,
  });
  
  const [fxEnabled, setFxEnabled] = useState(false);
  
  // Columns state
  const [cols, setCols] = useState([
    { key: 'txNum',        label: '#',                  visible: true  },
    { key: 'date',         label: 'Day',                visible: true  },
    { key: 'price',        label: 'Price',              visible: true,  currency: true },
    { key: 'txAmount',     label: 'Invested This Tx',   visible: true,  currency: true },
    { key: 'txUnits',      label: 'Units This Tx',      visible: true  },
    { key: 'avgCost',      label: 'Avg Cost/Unit',      visible: true,  currency: true },
    { key: 'totalCapital', label: 'Total Invested',     visible: true,  currency: true },
    { key: 'pnlCurrent',   label: 'P&L at Current',    visible: true,  currency: true },
    { key: 'pnlPrev',      label: 'P&L at Prev Stage', visible: true,  currency: true },
    { key: 'profit',       label: 'Profit @ Target',    visible: true,  currency: true },
  ]);

  const [lastRows, setLastRows] = useState([]);
  const [isColPanelOpen, setIsColPanelOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [lastTargetPriceINR, setLastTargetPriceINR] = useState(100);

  // Drag and drop state
  const [dragSrcIndex, setDragSrcIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // ── Persistence ──
  useEffect(() => {
    // Load state
    const savedPrimary = localStorage.getItem('dca_primaryCurrency');
    if (savedPrimary) setPrimaryCurrency(savedPrimary);

    const savedFx = localStorage.getItem('dca_fxEnabled');
    if (savedFx === 'true') setFxEnabled(true);
    
    const savedBuyAtStart = localStorage.getItem('dca_buyAtStart');

    const newInputs = { ...inputs };
    let hasSaved = false;
    
    // List of keys to load
    const keys = ['startPrice','totalInvestment','initialInvestAmt','txChangePct',
                  'gapDays','startDate','targetPrice','initialDecline','divisor',
                  'rateUSD','rateAED'];
    
    keys.forEach(key => {
      const v = localStorage.getItem('dca_' + key);
      if (v !== null) {
        if (key === 'totalInvestment') newInputs[key] = v; // keep as string with commas
        else if (['startDate'].includes(key)) newInputs[key] = v;
        else newInputs[key] = parseFloat(v);
        hasSaved = true;
      }
    });

    if (savedBuyAtStart !== null) newInputs.buyAtStart = savedBuyAtStart === 'true';

    const savedBasis = localStorage.getItem('dca_declineBasis');
    if (savedBasis) newInputs.declineBasis = savedBasis;

    if (hasSaved) setInputs(newInputs);

    // Load Cols
    const savedColsRaw = localStorage.getItem('dca_cols');
    if (savedColsRaw) {
      try {
        const savedCols = JSON.parse(savedColsRaw);
        const savedMap = Object.fromEntries(savedCols.map((c, i) => [c.key, { visible: c.visible, order: i }]));
        const sortedCols = [...cols].sort((a, b) => (savedMap[a.key]?.order ?? 999) - (savedMap[b.key]?.order ?? 999));
        sortedCols.forEach(c => {
          if (c.key in savedMap) c.visible = savedMap[c.key].visible;
        });
        setCols(sortedCols);
      } catch (e) { console.error("Error loading cols", e); }
    }
  }, []);

  // Save on change
  useEffect(() => {
    localStorage.setItem('dca_primaryCurrency', primaryCurrency);
  }, [primaryCurrency]);

  useEffect(() => {
    localStorage.setItem('dca_fxEnabled', fxEnabled);
  }, [fxEnabled]);

  useEffect(() => {
    localStorage.setItem('dca_cols', JSON.stringify(cols.map(c => ({ key: c.key, visible: c.visible }))));
  }, [cols]);

  useEffect(() => {
    Object.entries(inputs).forEach(([key, val]) => {
      if (key === 'declineBasis') localStorage.setItem('dca_' + key, val);
      else if (key === 'buyAtStart') localStorage.setItem('dca_' + key, val);
      else localStorage.setItem('dca_' + key, val);
    });
  }, [inputs]);


  // ── Derived Values & Helpers ──

  const getRateUSD = () => parseFloat(inputs.rateUSD) || 1;
  const getRateAED = () => parseFloat(inputs.rateAED) || 1;

  const curSym = (cur = primaryCurrency) => {
    return cur === 'INR' ? '₹' : cur === 'USD' ? '$' : 'AED\u202f';
  };

  const curLocale = (cur = primaryCurrency) => {
    return cur === 'INR' ? 'en-IN' : 'en-US';
  };

  const toPrimary = (inr) => {
    if (primaryCurrency === 'USD') return inr / getRateUSD();
    if (primaryCurrency === 'AED') return inr / getRateAED();
    return inr;
  };

  const fromPrimary = (val) => {
    if (primaryCurrency === 'USD') return val * getRateUSD();
    if (primaryCurrency === 'AED') return val * getRateAED();
    return val;
  };

  const inrTo = (inr, cur) => {
    if (cur === 'USD') return inr / getRateUSD();
    if (cur === 'AED') return inr / getRateAED();
    return inr;
  };

  const investStep = () => primaryCurrency === 'INR' ? 500 : 10;

  const getBudget = () => {
    const raw = typeof inputs.totalInvestment === 'string' ? inputs.totalInvestment.replace(/,/g, '') : inputs.totalInvestment;
    return parseFloat(raw) || 0;
  };

  const getInitialInvest = () => parseFloat(inputs.initialInvestAmt) || 0;

  const fmt = (n, dec = 2) => {
    const sym = curSym();
    return sym + n.toLocaleString(curLocale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  // ── Logic: Build Tx Amounts ──
  const buildTxAmounts = (total, initialAmt, txChangePct) => {
    const txMultiplier = 1 + txChangePct / 100;
    const txAmounts = [];
    let tx = initialAmt;
    let cumulative = 0;
    while (cumulative < total) {
      const remaining = total - cumulative;
      const thisAmount = Math.min(tx, remaining);
      txAmounts.push(thisAmount);
      cumulative += thisAmount;
      tx = tx * txMultiplier;
      if (tx <= 0 || txAmounts.length > 200) break;
    }
    return txAmounts;
  };

  // ── Logic: Preview ──
  const previewData = useMemo(() => {
    const total = getBudget() || 100000;
    const initialAmt = getInitialInvest() || total * 0.1;
    const txChgPct = parseFloat(inputs.txChangePct) || 50;
    const initial = parseFloat(inputs.initialDecline) || 5;
    const divisor = parseFloat(inputs.divisor) || 2;
    const basis = inputs.declineBasis;
    const startPrice = parseFloat(inputs.startPrice) || 100;

    const txAmounts = buildTxAmounts(total, initialAmt, txChgPct);
    const txPreview = txAmounts.slice(0, 5).map(a => fmt(a, 0)).join(' → ');

    const declinePreviews = [];
    let rate = initial;
    let simPrice = startPrice;

    for (let i = 0; i < Math.min(txAmounts.length, 5); i++) {
      if (basis === 'start') {
        simPrice = simPrice - startPrice * rate / 100;
      } else {
        simPrice = simPrice * (1 - rate / 100);
      }
      declinePreviews.push(`${formatPct(rate)} → ${fmt(simPrice, 2)}`);
      rate = rate / divisor;
    }

    return {
      initialAmt,
      pctOfBudget: (initialAmt / total * 100).toFixed(1),
      count: txAmounts.length,
      txPreview,
      hasMoreTx: txAmounts.length > 5,
      declinePreviews,
      basisLabel: basis === 'start' ? 'from start' : 'from last',
      basisHint: basis === 'start' ? 'flat from start price' : 'compounding'
    };
  }, [inputs, primaryCurrency]);

  // ── Logic: Calculate ──
  const handleCalculate = () => {
    const startPriceINR = fromPrimary(parseFloat(inputs.startPrice));
    const totalBudgetINR = fromPrimary(getBudget());
    const initialAmtINR = fromPrimary(getInitialInvest());
    const txChangePct = parseFloat(inputs.txChangePct);
    const gapDays = parseInt(inputs.gapDays);
    const initialDecline = parseFloat(inputs.initialDecline);
    const divisor = parseFloat(inputs.divisor);
    const targetPriceINR = fromPrimary(parseFloat(inputs.targetPrice));
    const startDate = new Date(inputs.startDate);

    const buyAtStart = inputs.buyAtStart;
    const txAmountsINR = buildTxAmounts(totalBudgetINR, initialAmtINR, txChangePct);
    const totalSteps = txAmountsINR.length;

    let currentPriceINR = startPriceINR;
    let currentDecline = initialDecline;
    let totalUnits = 0;
    let totalCapitalINR = 0;
    const rows = [];

    if (buyAtStart) {
      const units = initialAmtINR / startPriceINR;
      totalUnits += units;
      totalCapitalINR += initialAmtINR;
      const avgCostINR = totalCapitalINR / totalUnits;
      rows.push({
        txNum: 1, isStartBuy: true,
        date: startDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        priceINR: startPriceINR,
        txAmountINR: initialAmtINR,
        txUnits: units,
        avgCostINR,
        totalCapitalINR,
        totalUnits,
        profitAtTargetINR: (targetPriceINR - avgCostINR) * totalUnits,
        pnlCurrentINR: 0,
        pnlPrevINR: null,
        declineRate: 0,
      });
    }

    const declineBasis = inputs.declineBasis;
    const loopStart = buyAtStart ? 1 : 0;

    for (let i = loopStart; i < totalSteps; i++) {
      const declineUsed = currentDecline;
      if (declineBasis === 'start') {
        currentPriceINR = currentPriceINR - startPriceINR * currentDecline / 100;
      } else {
        currentPriceINR = currentPriceINR * (1 - currentDecline / 100);
      }
      currentDecline = currentDecline / divisor;

      const date = new Date(startDate);
      date.setDate(date.getDate() + i * gapDays);

      const investedINR = txAmountsINR[i];
      const units = investedINR / currentPriceINR;
      totalUnits += units;
      totalCapitalINR += investedINR;

      const avgCostINR = totalCapitalINR / totalUnits;
      const profitAtTargetINR = (targetPriceINR - avgCostINR) * totalUnits;
      const prevPriceINR = rows.length > 0 ? rows[rows.length - 1].priceINR : null;

      rows.push({
        txNum: i + 1 + (buyAtStart ? 1 : 0),
        date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        priceINR: currentPriceINR,
        txAmountINR: investedINR,
        txUnits: units,
        avgCostINR,
        totalCapitalINR,
        totalUnits,
        profitAtTargetINR,
        pnlCurrentINR: (currentPriceINR - avgCostINR) * totalUnits,
        pnlPrevINR: prevPriceINR !== null ? (prevPriceINR - avgCostINR) * totalUnits : null,
        declineRate: declineUsed,
      });
    }

    setLastRows(rows);
    setLastTargetPriceINR(targetPriceINR);
    setShowResults(true);
  };


  // ── Handlers ──
  const handleInputChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleBudgetChange = (e) => {
    // Basic comma formatting
    let raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      handleInputChange('totalInvestment', '');
      return;
    }
    const val = parseInt(raw, 10).toLocaleString(curLocale());
    handleInputChange('totalInvestment', val);
  };

  const syncTargetPrice = () => {
    handleInputChange('targetPrice', inputs.startPrice);
  };

  // ── UI Components ──

  const InputHint = ({ inrVal }) => {
    const others = ['INR', 'USD', 'AED'].filter(c => c !== primaryCurrency);
    if (!inrVal) return null;
    
    // We expect inrVal to be primary value here actually? No, hints take INR usually?
    // Wait, the original code takes "startPrice" which is primary currency value.
    // The `updateRateHints` function in original code converts "sp" (primary) -> INR -> others.
    
    // So if inputs.startPrice is 100 USD.
    // inr = 100 * 83.5 = 8350 INR.
    // others (INR, AED):
    // INR = 8350
    // AED = 8350 / 22.7
    
    const inr = fromPrimary(inrVal);
    
    const parts = others.map(cur => {
      const val = inrTo(inr, cur);
      const sym = curSym(cur);
      const loc = curLocale(cur);
      return `${sym}${val.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    
    return <div className="input-hint" style={{ color: '#b07d00', opacity: 0.85 }}>{parts.join(' · ')}</div>;
  };

  const FxHint = ({ inr }) => {
    if (!fxEnabled) return null;
    const others = ['INR', 'USD', 'AED'].filter(c => c !== primaryCurrency);
    const sign = inr < 0 ? '-' : '';
    const abs = Math.abs(inr);
    const parts = others.map(cur => {
      const val = inrTo(abs, cur);
      const sym = curSym(cur);
      const loc = curLocale(cur);
      return `${sign}${sym}${val.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    });
    return <span className="fx-hint">{parts.join(' · ')}</span>;
  };

  const CopyButton = () => {
    const [label, setLabel] = useState('⎘');
    
    const handleCopy = () => {
        const v = (key) => inputs[key];
        const sym = curSym();
        const others = ['INR','USD','AED'].filter(c => c !== primaryCurrency);

        const params = [
            `Currency: ${primaryCurrency}`,
            `Start Price: ${sym}${v('startPrice')}`,
            `Target Price: ${sym}${v('targetPrice')}`,
            `Budget: ${sym}${v('totalInvestment')}`,
            `Initial Invest: ${sym}${v('initialInvestAmt')}`,
            `Tx Change: ${v('txChangePct')}%`,
            `Initial Decline: ${v('initialDecline')}%`,
            `Divisor: ${v('divisor')}`,
            `Decline Basis: ${inputs.declineBasis}`,
            `Gap: ${v('gapDays')} days`,
            `Start Date: ${v('startDate')}`,
            `Buy at Start: ${inputs.buyAtStart}`,
            `₹/USD: ${v('rateUSD')} | ₹/AED: ${v('rateAED')}`,
        ].join(' | ');

        const visibleCols = cols.filter(c => c.visible);

        const headers = visibleCols.map(c => {
            if (c.key === 'profit') return `Profit@${sym}${toPrimary(lastTargetPriceINR).toFixed(0)}` +
                (fxEnabled ? others.map(x => `+${curSym(x)}`).join('') : '');
            if (c.currency && fxEnabled) return `${c.label}(${sym})` + others.map(x => `+${curSym(x)}`).join('');
            if (c.currency) return `${c.label}(${sym})`;
            return c.label;
        });

        const fmtCell = (inr, isNull = false) => {
            if (isNull) return 'n/a';
            const primary = toPrimary(inr).toFixed(2);
            if (!fxEnabled) return primary;
            return [primary, ...others.map(cur => inrTo(inr, cur).toFixed(2))].join('/');
        };

        const rowsStr = lastRows.map(r => {
            return visibleCols.map(c => {
                switch (c.key) {
                    case 'txNum': return r.txNum;
                    case 'date': return r.date + (r.declineRate ? ` -${r.declineRate.toFixed(2)}%` : '');
                    case 'price': return fmtCell(r.priceINR);
                    case 'txAmount': return fmtCell(r.txAmountINR);
                    case 'txUnits': return r.txUnits.toFixed(4);
                    case 'avgCost': return fmtCell(r.avgCostINR);
                    case 'totalCapital': return fmtCell(r.totalCapitalINR);
                    case 'pnlCurrent': return fmtCell(r.pnlCurrentINR) + ` (${(r.pnlCurrentINR / r.totalCapitalINR * 100).toFixed(2)}%)`;
                    case 'pnlPrev': return r.pnlPrevINR !== null ? fmtCell(r.pnlPrevINR) + ` (${(r.pnlPrevINR / r.totalCapitalINR * 100).toFixed(2)}%)` : 'n/a';
                    case 'profit': return fmtCell(r.profitAtTargetINR) + ` (${(r.profitAtTargetINR / r.totalCapitalINR * 100).toFixed(2)}%)`;
                    default: return '';
                }
            }).join('\t');
        }).join('\n');

        const text = `DCA Simulation\n${params}\n\n${headers.join('\t')}\n${rowsStr}`;
        
        navigator.clipboard.writeText(text).then(() => {
            setLabel('✓');
            setTimeout(() => setLabel('⎘'), 1500);
        });
    };

    return (
        <button className="col-btn" onClick={handleCopy} title="Copy all data for AI" style={{ fontSize: '13px', padding: '4px 7px' }}>
            {label}
        </button>
    );
  };

  // DnD Handlers
  const handleDragStart = (e, index) => {
    setDragSrcIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('dragging');
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (dragSrcIndex === null || dragSrcIndex === index) {
      setDragSrcIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newCols = [...cols];
    const [moved] = newCols.splice(dragSrcIndex, 1);
    newCols.splice(index, 0, moved);
    setCols(newCols);
    setDragSrcIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = (e) => {
      e.currentTarget.classList.remove('dragging');
      setDragSrcIndex(null);
      setDragOverIndex(null);
  };


  return (
    <>
      <div className="top-bar">
        <div className="top-bar-title">
          DCA — Decline & Invest Calculator
          <div style={{ display: 'flex', gap: '4px' }}>
            {['INR', 'USD', 'AED'].map(cur => (
              <button
                key={cur}
                className={`cur-btn ${primaryCurrency === cur ? 'active' : ''}`}
                onClick={() => setPrimaryCurrency(cur)}
              >
                {cur === 'INR' ? '₹ INR' : cur === 'USD' ? '$ USD' : 'AED'}
              </button>
            ))}
          </div>
        </div>

        <div className="inputs-row">
          <div className="input-cell">
            <label>Start Price (<span className="cur-sym">{curSym()}</span>)</label>
            <input
              type="number"
              value={inputs.startPrice}
              min="0" step="1"
              onChange={(e) => handleInputChange('startPrice', e.target.value)}
            />
            <InputHint inrVal={inputs.startPrice} />
          </div>

          <div className="input-cell" style={{ flexBasis: '150px', maxWidth: '200px' }}>
            <label>Total Budget (<span className="cur-sym">{curSym()}</span>)</label>
            <input
              type="text"
              value={inputs.totalInvestment}
              onChange={handleBudgetChange}
            />
            <InputHint inrVal={getBudget()} />
          </div>

          <div className="sec-divider"></div>

          <div className="input-cell" style={{ flexBasis: '150px', maxWidth: '200px' }}>
            <label>Initial Invest (<span className="cur-sym">{curSym()}</span>)</label>
            <input
              type="number"
              value={inputs.initialInvestAmt}
              min="0" step={investStep()}
              onChange={(e) => handleInputChange('initialInvestAmt', e.target.value)}
            />
            <div className="input-hint">{fmt(previewData.initialAmt, 0)} · {previewData.pctOfBudget}% of budget</div>
            <InputHint inrVal={getInitialInvest()} />
          </div>

          <div className="input-cell">
            <label>Tx Change / Decline (%)</label>
            <input
              type="number"
              value={inputs.txChangePct}
              min="-100" step="10"
              onChange={(e) => handleInputChange('txChangePct', e.target.value)}
            />
          </div>

          <div className="sec-divider"></div>

          <div className="input-cell">
            <label>Initial Decline (%)</label>
            <input
              type="number"
              value={inputs.initialDecline}
              min="0" step="1"
              onChange={(e) => handleInputChange('initialDecline', e.target.value)}
            />
          </div>
          <div className="input-cell">
            <label>Divisor</label>
            <input
              type="number"
              value={inputs.divisor}
              min="0" step="0.1"
              onChange={(e) => handleInputChange('divisor', e.target.value)}
            />
            <div className="input-hint">halves each step</div>
          </div>

          <div className="input-cell" style={{ flexBasis: '130px', maxWidth: '160px' }}>
            <label>Decline Basis</label>
            <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 500, color: '#555', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="declineBasis"
                  value="relative"
                  checked={inputs.declineBasis === 'relative'}
                  onChange={() => handleInputChange('declineBasis', 'relative')}
                  style={{ width: '11px', height: '11px', accentColor: '#4f46e5' }}
                />
                Last price
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 500, color: '#555', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="declineBasis"
                  value="start"
                  checked={inputs.declineBasis === 'start'}
                  onChange={() => handleInputChange('declineBasis', 'start')}
                  style={{ width: '11px', height: '11px', accentColor: '#4f46e5' }}
                />
                Start price
              </label>
            </div>
            <div className="input-hint">{previewData.basisHint}</div>
          </div>

          <div className="sec-divider"></div>

          <div className="input-cell">
            <label>Gap (days)</label>
            <input
              type="number"
              value={inputs.gapDays}
              min="1"
              onChange={(e) => handleInputChange('gapDays', e.target.value)}
            />
          </div>
          <div className="input-cell">
            <label>Start Date</label>
            <input
              type="date"
              value={inputs.startDate}
              onChange={(e) => handleInputChange('startDate', e.target.value)}
            />
          </div>

          <div className="input-cell">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Target Price (<span className="cur-sym">{curSym()}</span>)
              <button
                onClick={syncTargetPrice}
                title="Set to start price"
                style={{ fontSize: '11px', padding: '0 3px', border: 'none', background: 'none', color: '#bbb', cursor: 'pointer', lineHeight: 1, opacity: 0.6 }}
              >
                ⇡
              </button>
            </label>
            <input
              type="number"
              value={inputs.targetPrice}
              min="0" step="1"
              onChange={(e) => handleInputChange('targetPrice', e.target.value)}
            />
            <InputHint inrVal={inputs.targetPrice} />
          </div>

          <div className="sec-divider"></div>

          <div className="input-cell">
            <label>₹ per USD</label>
            <input
              type="number"
              value={inputs.rateUSD}
              min="0" step="1"
              onChange={(e) => handleInputChange('rateUSD', e.target.value)}
            />
          </div>
          <div className="input-cell">
            <label>₹ per AED</label>
            <input
              type="number"
              value={inputs.rateAED}
              min="0" step="1"
              onChange={(e) => handleInputChange('rateAED', e.target.value)}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#666', cursor: 'pointer', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={inputs.buyAtStart}
              onChange={(e) => handleInputChange('buyAtStart', e.target.checked)}
              style={{ width: '12px', height: '12px', accentColor: '#4f46e5' }}
            />
            Buy at start
          </label>

          <button className="calc-btn" onClick={handleCalculate}>Calculate</button>
        </div>

        <div className="formula-preview">
          <b>{previewData.count} transactions</b> · Amounts: <span>{previewData.txPreview}{previewData.hasMoreTx ? ' → …' : ''}</span> · Declines <em>({previewData.basisLabel})</em>: <span className="tx-seq">{previewData.declinePreviews.join(' → ')}{previewData.hasMoreTx ? ' → …' : ''}</span>
        </div>
      </div>

      {showResults && (
        <div id="results">
          <div className="table-card">
            <div className="table-header">
              <div className="table-title">Transaction Details</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#aaa', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fxEnabled}
                    onChange={(e) => setFxEnabled(e.target.checked)}
                    style={{ width: '12px', height: '12px', accentColor: '#b07d00' }}
                  />
                  <span style={{ fontSize: '9px' }}>Show FX</span>
                </label>
                <CopyButton />
                <div style={{ position: 'relative' }}>
                  <button className="col-btn" onClick={() => setIsColPanelOpen(!isColPanelOpen)}>⚙ Columns</button>
                  {isColPanelOpen && (
                    <div className="col-panel" onClick={(e) => e.stopPropagation()}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px',borderBottom:'1px solid #eee',paddingBottom:'6px'}}>
                            <div className="col-panel-title" style={{border:0,margin:0,padding:0}}>Show & reorder</div>
                            <button onClick={() => setIsColPanelOpen(false)} style={{border:'none',background:'transparent',cursor:'pointer',color:'#999'}}>✕</button>
                        </div>
                      <div>
                        {cols.map((col, idx) => (
                          <div
                            key={col.key}
                            className={`col-item ${dragOverIndex === idx ? 'drag-over' : ''}`}
                            draggable="true"
                            onDragStart={(e) => handleDragStart(e, idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={(e) => handleDrop(e, idx)}
                            onDragEnd={handleDragEnd}
                          >
                            <span className="drag-handle">⠿</span>
                            <input
                              type="checkbox"
                              checked={col.visible}
                              onChange={(e) => {
                                const newCols = [...cols];
                                newCols[idx].visible = e.target.checked;
                                setCols(newCols);
                              }}
                            />
                            <span className="col-item-label">{col.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Click outside listener could be added to body to close panel */}
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  {cols.filter(c => c.visible).map(c => {
                    let lbl;
                    const sym = curSym();
                    if (c.key === 'profit') {
                      lbl = `Profit @ ${fmt(toPrimary(lastTargetPriceINR), 0)}`;
                    } else if (c.currency) {
                      lbl = `${c.label} (${sym})`;
                    } else {
                      lbl = c.label;
                    }
                    return (
                        <th key={c.key} style={c.key === 'date' ? { textAlign: 'left' } : { textAlign: 'right' }}>
                            {lbl}
                        </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {lastRows.map((r, i) => (
                  <tr key={i}>
                    {cols.filter(c => c.visible).map(c => {
                      const sym = curSym();
                      let content;
                      
                      switch (c.key) {
                        case 'txNum':
                          content = <td>{r.txNum}</td>;
                          break;
                        case 'date':
                          content = (
                            <td className="col-date" style={{ textAlign: 'left', fontWeight: 500 }}>
                              {r.date}
                              {!r.isStartBuy && <span className="tag tag-decline">-{formatPct(r.declineRate)}</span>}
                            </td>
                          );
                          break;
                        case 'price': {
                          const priceDrop = (r.priceINR - lastTargetPriceINR) / lastTargetPriceINR * 100;
                          content = (
                            <td>
                              {fmt(toPrimary(r.priceINR))}
                              <span className="pct-hint">{priceDrop.toLocaleString(curLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% from target</span>
                              <FxHint inr={r.priceINR} />
                            </td>
                          );
                          break;
                        }
                        case 'txAmount':
                          content = (
                            <td>
                              {fmt(toPrimary(r.txAmountINR))}
                              <FxHint inr={r.txAmountINR} />
                            </td>
                          );
                          break;
                        case 'txUnits':
                          content = <td>{r.txUnits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>;
                          break;
                        case 'avgCost': {
                          const avgDrop = (r.avgCostINR - lastTargetPriceINR) / lastTargetPriceINR * 100;
                          content = (
                            <td>
                              {fmt(toPrimary(r.avgCostINR))}
                              <span className="pct-hint">{avgDrop.toLocaleString(curLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% from target</span>
                              <FxHint inr={r.avgCostINR} />
                            </td>
                          );
                          break;
                        }
                        case 'totalCapital':
                          content = (
                            <td>
                              {fmt(toPrimary(r.totalCapitalINR))}
                              <FxHint inr={r.totalCapitalINR} />
                            </td>
                          );
                          break;
                        case 'pnlPrev': {
                          if (r.pnlPrevINR === null) {
                            content = <td>—</td>;
                          } else {
                            const pct = r.pnlPrevINR / r.totalCapitalINR * 100;
                            const cls = r.pnlPrevINR >= 0 ? 'profit-pos' : 'profit-neg';
                            content = (
                              <td className={cls}>
                                {fmt(toPrimary(r.pnlPrevINR))}
                                <span className="pct-hint">{pct >= 0 ? '+' : ''}{pct.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                                <FxHint inr={r.pnlPrevINR} />
                              </td>
                            );
                          }
                          break;
                        }
                        case 'pnlCurrent': {
                          const pct = r.pnlCurrentINR / r.totalCapitalINR * 100;
                          const cls = r.pnlCurrentINR >= 0 ? 'profit-pos' : 'profit-neg';
                          content = (
                            <td className={cls}>
                              {fmt(toPrimary(r.pnlCurrentINR))}
                              <span className="pct-hint">{pct >= 0 ? '+' : ''}{pct.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                              <FxHint inr={r.pnlCurrentINR} />
                            </td>
                          );
                          break;
                        }
                        case 'profit': {
                          const pct = r.profitAtTargetINR / r.totalCapitalINR * 100;
                          const cls = r.profitAtTargetINR >= 0 ? 'profit-pos' : 'profit-neg';
                          content = (
                            <td className={cls}>
                              {fmt(toPrimary(r.profitAtTargetINR))}
                              <span className="pct-hint">{pct >= 0 ? '+' : ''}{pct.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span>
                              <FxHint inr={r.profitAtTargetINR} />
                            </td>
                          );
                          break;
                        }
                        default:
                          content = <td></td>;
                      }
                      return <React.Fragment key={c.key}>{content}</React.Fragment>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
