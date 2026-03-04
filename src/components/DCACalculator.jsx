import React, { useState, useEffect, useMemo, useRef } from 'react';
import './DCACalculator.css';

const DEFAULT_COLS = [
  { key: 'txNum',        label: '#',                  visible: true  },
  { key: 'price',        label: 'Price',              visible: true,  currency: true },
  { key: 'avgCost',      label: 'Avg Cost/Unit',      visible: true,  currency: true },
  { key: 'txAmount',     label: 'Invested This Tx',   visible: true,  currency: true },
  { key: 'txUnits',      label: 'Units This Tx',      visible: true  },
  { key: 'totalCapital', label: 'Total Invested',     visible: true,  currency: true },
  { key: 'pnlCurrent',   label: 'P&L at Current',    visible: true,  currency: true },
  { key: 'pnlPrev',      label: 'P&L at Prev Stage', visible: true,  currency: true },
  { key: 'profit',       label: 'Profit @ Target',    visible: true,  currency: true },
];

export default function DCACalculator() {
  // ── State: Inputs ──
  const [primaryCurrency, setPrimaryCurrency] = useState(() => localStorage.getItem('dca_primaryCurrency') || 'INR');
  const [startPrice, setStartPrice] = useState(() => localStorage.getItem('dca_startPrice') || '100');
  const [totalInvestment, setTotalInvestment] = useState(() => localStorage.getItem('dca_totalInvestment') || '100000');
  const [initialInvestAmt, setInitialInvestAmt] = useState(() => localStorage.getItem('dca_initialInvestAmt') || '10000');
  const [txChangePct, setTxChangePct] = useState(() => localStorage.getItem('dca_txChangePct') || '50');
  const [initialDecline, setInitialDecline] = useState(() => localStorage.getItem('dca_initialDecline') || '5');
  const [divisor, setDivisor] = useState(() => localStorage.getItem('dca_divisor') || '2');
  const [declineBasis, setDeclineBasis] = useState(() => localStorage.getItem('dca_declineBasis') || 'relative');
  const [targetPrice, setTargetPrice] = useState(() => localStorage.getItem('dca_targetPrice') || '100');
  const [rateUSD, setRateUSD] = useState(() => localStorage.getItem('dca_rateUSD') || '83.5');
  const [rateAED, setRateAED] = useState(() => localStorage.getItem('dca_rateAED') || '22.7');
  const [buyAtStart, setBuyAtStart] = useState(() => localStorage.getItem('dca_buyAtStart') === 'true');
  const [fxEnabled, setFxEnabled] = useState(() => localStorage.getItem('dca_fxEnabled') === 'true');

  // ── State: UI ──
  const [cols, setCols] = useState(() => {
    const saved = localStorage.getItem('dca_cols');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Filter out any saved 'date' column just in case
      const validParsed = parsed.filter(c => c.key !== 'date');
      const savedMap = Object.fromEntries(validParsed.map((c, i) => [c.key, { visible: c.visible, order: i }]));
      const newCols = [...DEFAULT_COLS];
      newCols.sort((a, b) => (savedMap[a.key]?.order ?? 999) - (savedMap[b.key]?.order ?? 999));
      newCols.forEach(c => { if (c.key in savedMap) c.visible = savedMap[c.key].visible; });
      return newCols;
    }
    return DEFAULT_COLS;
  });
  const [isColPanelOpen, setIsColPanelOpen] = useState(false);
  const [dragSrc, setDragSrc] = useState(null);

  // ── Persistence ──
  useEffect(() => localStorage.setItem('dca_primaryCurrency', primaryCurrency), [primaryCurrency]);
  useEffect(() => localStorage.setItem('dca_startPrice', startPrice), [startPrice]);
  useEffect(() => localStorage.setItem('dca_totalInvestment', totalInvestment), [totalInvestment]);
  useEffect(() => localStorage.setItem('dca_initialInvestAmt', initialInvestAmt), [initialInvestAmt]);
  useEffect(() => localStorage.setItem('dca_txChangePct', txChangePct), [txChangePct]);
  useEffect(() => localStorage.setItem('dca_initialDecline', initialDecline), [initialDecline]);
  useEffect(() => localStorage.setItem('dca_divisor', divisor), [divisor]);
  useEffect(() => localStorage.setItem('dca_declineBasis', declineBasis), [declineBasis]);
  useEffect(() => localStorage.setItem('dca_targetPrice', targetPrice), [targetPrice]);
  useEffect(() => localStorage.setItem('dca_rateUSD', rateUSD), [rateUSD]);
  useEffect(() => localStorage.setItem('dca_rateAED', rateAED), [rateAED]);
  useEffect(() => localStorage.setItem('dca_buyAtStart', buyAtStart), [buyAtStart]);
  useEffect(() => localStorage.setItem('dca_fxEnabled', fxEnabled), [fxEnabled]);
  useEffect(() => localStorage.setItem('dca_cols', JSON.stringify(cols.map(c => ({ key: c.key, visible: c.visible })))), [cols]);

  // ── Helpers ──
  const getRateUSD = () => parseFloat(rateUSD) || 1;
  const getRateAED = () => parseFloat(rateAED) || 1;

  const curSym = (cur = primaryCurrency) => cur === 'INR' ? '₹' : cur === 'USD' ? '$' : 'AED\u202f';
  const curLocale = (cur = primaryCurrency) => cur === 'INR' ? 'en-IN' : 'en-US';

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

  const fmt = (n, dec = 2) => {
    const sym = curSym();
    return sym + n.toLocaleString(curLocale(), { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };
  const fmtPct = (n) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + '%';

  const parseNum = (v) => parseFloat(String(v).replace(/,/g, '')) || 0;

  // ── Logic ──
  const calculation = useMemo(() => {
    const startPriceINR = fromPrimary(parseNum(startPrice));
    const totalBudgetINR = fromPrimary(parseNum(totalInvestment));
    const initialAmtINR = fromPrimary(parseNum(initialInvestAmt));
    const txChgPctVal = parseNum(txChangePct);
    const initialDeclineVal = parseNum(initialDecline);
    const divisorVal = parseNum(divisor) || 1;
    const targetPriceINR = fromPrimary(parseNum(targetPrice));

    // Build Tx Amounts
    const txMultiplier = 1 + txChgPctVal / 100;
    const txAmountsINR = [];
    let tx = initialAmtINR;
    let cumulative = 0;
    // Safety break
    let safety = 0;
    while (cumulative < totalBudgetINR && safety < 500) {
      const remaining = totalBudgetINR - cumulative;
      const thisAmount = Math.min(tx, remaining);
      if (thisAmount <= 0.01) break; // avoid infinite dust
      txAmountsINR.push(thisAmount);
      cumulative += thisAmount;
      tx = tx * txMultiplier;
      safety++;
    }

    const rows = [];
    let currentPriceINR = startPriceINR;
    let currentDecline = initialDeclineVal;
    let totalUnits = 0;
    let totalCapitalINR = 0;

    if (buyAtStart) {
      const units = initialAmtINR / startPriceINR;
      totalUnits += units;
      totalCapitalINR += initialAmtINR;
      const avgCostINR = totalCapitalINR / totalUnits;
      rows.push({
        txNum: 1, isStartBuy: true,
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

    const loopStart = buyAtStart ? 1 : 0;
    const totalSteps = txAmountsINR.length;

    for (let i = loopStart; i < totalSteps; i++) {
      const declineUsed = currentDecline;
      if (declineBasis === 'start') {
        currentPriceINR = currentPriceINR - startPriceINR * currentDecline / 100;
      } else {
        currentPriceINR = currentPriceINR * (1 - currentDecline / 100);
      }
      currentDecline = currentDecline / divisorVal;

      const investedINR = txAmountsINR[i];
      const units = investedINR / currentPriceINR;
      totalUnits += units;
      totalCapitalINR += investedINR;

      const avgCostINR = totalCapitalINR / totalUnits;
      const profitAtTargetINR = (targetPriceINR - avgCostINR) * totalUnits;
      const prevPriceINR = rows.length > 0 ? rows[rows.length - 1].priceINR : null;

      rows.push({
        txNum: i + 1 + (buyAtStart ? 1 : 0),
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

    // Preview Data
    const txAmountsPreview = txAmountsINR.map(val => toPrimary(val));
    const declinePreviews = [];
    let rate = initialDeclineVal;
    let simPrice = parseNum(startPrice);
    for (let i = 0; i < Math.min(txAmountsPreview.length, 5); i++) {
        if (declineBasis === 'start') {
            simPrice = simPrice - parseNum(startPrice) * rate / 100;
        } else {
            simPrice = simPrice * (1 - rate / 100);
        }
        declinePreviews.push({ rate, price: simPrice });
        rate = rate / divisorVal;
    }

    return { rows, txAmountsPreview, declinePreviews, targetPriceINR, startPriceINR };
  }, [
    startPrice, totalInvestment, initialInvestAmt, txChangePct,
    targetPrice, rateUSD, rateAED, buyAtStart, declineBasis,
    divisor, initialDecline, primaryCurrency
  ]);

  const { rows, txAmountsPreview, declinePreviews, targetPriceINR } = calculation;

  // ── Handlers ──
  const handleDragStart = (e, idx) => {
    setDragSrc(idx);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  };
  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };
  const handleDrop = (e, targetIdx) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (dragSrc === null || dragSrc === targetIdx) return;
    const newCols = [...cols];
    const [moved] = newCols.splice(dragSrc, 1);
    newCols.splice(targetIdx, 0, moved);
    setCols(newCols);
    setDragSrc(null);
  };
  
  const toggleCol = (idx, checked) => {
    const newCols = [...cols];
    newCols[idx].visible = checked;
    setCols(newCols);
  };

  const copyForAI = (btn) => {
    const sym = curSym();
    const others = ['INR','USD','AED'].filter(c => c !== primaryCurrency);
    const visibleCols = cols.filter(c => c.visible);

    const params = [
      `Currency: ${primaryCurrency}`,
      `Start Price: ${sym}${startPrice}`,
      `Target Price: ${sym}${targetPrice}`,
      `Budget: ${sym}${totalInvestment}`,
      `Initial Invest: ${sym}${initialInvestAmt}`,
      `Tx Change: ${txChangePct}%`,
      `Initial Decline: ${initialDecline}%`,
      `Divisor: ${divisor}`,
      `Decline Basis: ${declineBasis}`,
      `Buy at Start: ${buyAtStart}`,
      `₹/USD: ${rateUSD} | ₹/AED: ${rateAED}`,
    ].join(' | ');

    const headers = visibleCols.map(c => {
      if (c.key === 'profit') return `Profit@${sym}${toPrimary(targetPriceINR).toFixed(0)}` + (fxEnabled ? others.map(x => `+${curSym(x)}`).join('') : '');
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

    const tableRows = rows.map(r => {
        return visibleCols.map(c => {
            switch (c.key) {
                case 'txNum': return r.txNum;
                case 'price': return fmtCell(r.priceINR);
                case 'txAmount': return fmtCell(r.txAmountINR);
                case 'txUnits': return r.txUnits.toFixed(4);
                case 'avgCost': return fmtCell(r.avgCostINR);
                case 'totalCapital': return fmtCell(r.totalCapitalINR);
                case 'pnlCurrent': return fmtCell(r.pnlCurrentINR) + ` (${(r.pnlCurrentINR/r.totalCapitalINR*100).toFixed(2)}%)`;
                case 'pnlPrev': return r.pnlPrevINR !== null ? fmtCell(r.pnlPrevINR) + ` (${(r.pnlPrevINR/r.totalCapitalINR*100).toFixed(2)}%)` : 'n/a';
                case 'profit': return fmtCell(r.profitAtTargetINR) + ` (${(r.profitAtTargetINR/r.totalCapitalINR*100).toFixed(2)}%)`;
                default: return '';
            }
        }).join('\t');
    }).join('\n');

    const text = `DCA Simulation\n${params}\n\n${headers.join('\t')}\n${tableRows}`;
    navigator.clipboard.writeText(text);
  };

  // ── Render Helpers ──
  const FxHint = ({ inr }) => {
    if (!fxEnabled) return null;
    const others = ['INR','USD','AED'].filter(c => c !== primaryCurrency);
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

  const RateHints = ({ valStr }) => {
      const val = parseNum(valStr);
      if (!val) return null;
      const others = ['INR','USD','AED'].filter(c => c !== primaryCurrency);
      const inr = fromPrimary(val); // Assume val is in primary
      const parts = others.map(cur => {
          const v = inrTo(inr, cur);
          const sym = curSym(cur);
          const loc = curLocale(cur);
          return `${sym}${v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      });
      return <div className="input-hint" style={{color:'#b07d00', opacity:0.85}}>{parts.join(' · ')}</div>
  };

  return (
    <div>
      <div className="top-bar">
        <div className="top-bar-title">
          DCA — Decline & Invest Calculator
          <div style={{display:'flex', gap:'4px'}}>
            {['INR','USD','AED'].map(c => (
              <button key={c}
                className={`cur-btn ${primaryCurrency === c ? 'active' : ''}`}
                onClick={() => setPrimaryCurrency(c)}
              >{c === 'INR' ? '₹ INR' : c === 'USD' ? '$ USD' : 'AED'}</button>
            ))}
          </div>
        </div>
        
        <div className="inputs-row">
            <div className="input-cell">
                <label>Start Price (<span className="cur-sym">{curSym()}</span>)</label>
                <input type="number" value={startPrice} min="0" step="1" onChange={e => setStartPrice(e.target.value)} />
                <RateHints valStr={startPrice} />
            </div>
            <div className="input-cell" style={{flexBasis:'150px', maxWidth:'200px'}}>
                <label>Total Budget (<span className="cur-sym">{curSym()}</span>)</label>
                <input type="text" value={totalInvestment} 
                       onChange={e => {
                           setTotalInvestment(e.target.value);
                       }}
                       onBlur={e => {
                           const raw = e.target.value.replace(/,/g, '');
                           if(raw && !isNaN(raw)) setTotalInvestment(Number(raw).toLocaleString(curLocale()));
                       }}
                />
                <RateHints valStr={totalInvestment} />
            </div>

            <div className="sec-divider"></div>

            <div className="input-cell" style={{flexBasis:'150px', maxWidth:'200px'}}>
                <label>Initial Invest (<span className="cur-sym">{curSym()}</span>)</label>
                <input type="number" value={initialInvestAmt} min="0" step={primaryCurrency === 'INR' ? 500 : 10} onChange={e => setInitialInvestAmt(e.target.value)} />
                <div className="input-hint">
                    {fmt(parseNum(initialInvestAmt), 0)} · {((parseNum(initialInvestAmt)/parseNum(totalInvestment))*100 || 0).toFixed(1)}% of budget
                </div>
                <RateHints valStr={initialInvestAmt} />
            </div>
            <div className="input-cell">
                <label>Tx Change / Decline (%)</label>
                <input type="number" value={txChangePct} min="-100" step="10" onChange={e => setTxChangePct(e.target.value)} />
            </div>

            <div className="sec-divider"></div>

            <div className="input-cell">
                <label>Initial Decline (%)</label>
                <input type="number" value={initialDecline} min="0" step="1" onChange={e => setInitialDecline(e.target.value)} />
            </div>
            <div className="input-cell">
                <label>Divisor</label>
                <input type="number" value={divisor} min="0" step="0.1" onChange={e => setDivisor(e.target.value)} />
                <div className="input-hint">halves each step</div>
            </div>
            <div className="input-cell" style={{flexBasis:'130px', maxWidth:'160px'}}>
                <label>Decline Basis</label>
                <div style={{display:'flex', gap:'6px', marginTop:'2px'}}>
                    <label style={{display:'flex', alignItems:'center', gap:'3px', fontSize:'11px', fontWeight:500, color:'#555', cursor:'pointer'}}>
                        <input type="radio" name="declineBasis" value="relative" checked={declineBasis === 'relative'} onChange={e => setDeclineBasis(e.target.value)} style={{width:'11px', height:'11px', accentColor:'#4f46e5'}} />
                        Last price
                    </label>
                    <label style={{display:'flex', alignItems:'center', gap:'3px', fontSize:'11px', fontWeight:500, color:'#555', cursor:'pointer'}}>
                        <input type="radio" name="declineBasis" value="start" checked={declineBasis === 'start'} onChange={e => setDeclineBasis(e.target.value)} style={{width:'11px', height:'11px', accentColor:'#4f46e5'}} />
                        Start price
                    </label>
                </div>
                <div className="input-hint">{declineBasis === 'start' ? 'flat from start price' : 'compounding'}</div>
            </div>

            <div className="sec-divider"></div>

            <div className="input-cell">
                <label style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                    Target Price (<span className="cur-sym">{curSym()}</span>)
                    <button onClick={() => setTargetPrice(startPrice)} title="Set to start price" style={{fontSize:'11px', padding:'0 3px', border:'none', background:'none', color:'#bbb', cursor:'pointer', lineHeight:1}}>⇡</button>
                </label>
                <input type="number" value={targetPrice} min="0" step="1" onChange={e => setTargetPrice(e.target.value)} />
                <RateHints valStr={targetPrice} />
            </div>

            <div className="sec-divider"></div>

            <div className="input-cell">
                <label>₹ per USD</label>
                <input type="number" value={rateUSD} min="0" step="1" onChange={e => setRateUSD(e.target.value)} />
            </div>
            <div className="input-cell">
                <label>₹ per AED</label>
                <input type="number" value={rateAED} min="0" step="1" onChange={e => setRateAED(e.target.value)} />
            </div>
            <label style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'#666', cursor:'pointer', alignSelf:'flexEnd', whiteSpace:'nowrap'}}>
                <input type="checkbox" checked={buyAtStart} onChange={e => setBuyAtStart(e.target.checked)} style={{width:'12px', height:'12px', accentColor:'#4f46e5'}} />
                Buy at start
            </label>
        </div>

        <div className="formula-preview" id="formulaPreview">
             <b>{txAmountsPreview.length} transactions</b> · Amounts: <span>{txAmountsPreview.slice(0,5).map(a => fmt(a,0)).join(' → ')}{txAmountsPreview.length > 5 ? ' → …' : ''}</span> · Declines <em>({declineBasis === 'start' ? 'from start' : 'from last'})</em>: <span className="tx-seq">{declinePreviews.map(d => `${fmtPct(d.rate)} → ${fmt(d.price, 2)}`).join(' → ')}{txAmountsPreview.length > 5 ? ' → …' : ''}</span>
        </div>
      </div>

      <div id="results" style={{display:'block'}}>
        <div className="table-card">
          <div className="table-header">
            <div className="table-title">Transaction Details</div>
            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
              <label style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', color:'#aaa', cursor:'pointer', userSelect:'none'}}>
                <input type="checkbox" checked={fxEnabled} onChange={e => setFxEnabled(e.target.checked)} style={{width:'12px', height:'12px', accentColor:'#b07d00'}} />
                <span style={{fontSize:'9px'}}>Show FX</span>
              </label>
              <button className="col-btn" onClick={e => copyForAI(e.target)} title="Copy all data for AI" style={{fontSize:'13px', padding:'4px 7px'}}>⎘</button>
              <div style={{position:'relative'}}>
                <button className="col-btn" onClick={() => setIsColPanelOpen(!isColPanelOpen)}>⚙ Columns</button>
                <div className={`col-panel ${isColPanelOpen ? 'open' : ''}`} id="colPanel">
                  <div className="col-panel-title">Show & reorder</div>
                  <div id="colItems">
                      {cols.map((c, i) => (
                          <div key={c.key} className="col-item" draggable="true"
                               onDragStart={(e) => handleDragStart(e, i)}
                               onDragOver={handleDragOver}
                               onDrop={(e) => handleDrop(e, i)}
                               onDragLeave={handleDragLeave}>
                            <span className="drag-handle">⠿</span>
                            <input type="checkbox" checked={c.visible} onChange={e => toggleCol(i, e.target.checked)} />
                            <span className="col-item-label">{c.label}</span>
                          </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Table */}
          <table id="mainTable">
              <thead>
                  <tr>
                      {cols.filter(c => c.visible).map(c => {
                          let lbl = c.label;
                          if (c.key === 'profit') lbl = `Profit @ ${fmt(toPrimary(targetPriceINR), 0)}`;
                          else if (c.currency) lbl = `${c.label} (${curSym()})`;
                          
                          return <th key={c.key} style={{textAlign:'right'}}>{lbl}</th>;
                      })}
                  </tr>
              </thead>
              <tbody>
                  {rows.map(r => (
                      <tr key={r.txNum}>
                          {cols.filter(c => c.visible).map(c => {
                              let content = null;
                              switch(c.key) {
                                  case 'txNum': content = r.txNum; break;
                                  case 'price': 
                                      const priceDrop = (r.priceINR - targetPriceINR) / targetPriceINR * 100;
                                      content = <>{fmt(toPrimary(r.priceINR))}<span className="pct-hint">{priceDrop.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}% from target</span><FxHint inr={r.priceINR} /></>;
                                      break;
                                  case 'txAmount':
                                      content = <>{fmt(toPrimary(r.txAmountINR))}<FxHint inr={r.txAmountINR} /></>;
                                      break;
                                  case 'txUnits':
                                      content = r.txUnits.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
                                      break;
                                  case 'avgCost':
                                      const avgDrop = (r.avgCostINR - targetPriceINR) / targetPriceINR * 100;
                                      content = <>{fmt(toPrimary(r.avgCostINR))}<span className="pct-hint">{avgDrop.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}% from target</span><FxHint inr={r.avgCostINR} /></>;
                                      break;
                                  case 'totalCapital':
                                      content = <>{fmt(toPrimary(r.totalCapitalINR))}<FxHint inr={r.totalCapitalINR} /></>;
                                      break;
                                  case 'pnlCurrent':
                                      const pctC = r.pnlCurrentINR / r.totalCapitalINR * 100;
                                      content = <span className={r.pnlCurrentINR >= 0 ? 'profit-pos' : 'profit-neg'}>{fmt(toPrimary(r.pnlCurrentINR))}<span className="pct-hint">{pctC >= 0 ? '+' : ''}{pctC.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span><FxHint inr={r.pnlCurrentINR} /></span>;
                                      break;
                                  case 'pnlPrev':
                                      if (r.pnlPrevINR === null) content = '—';
                                      else {
                                          const pctP = r.pnlPrevINR / r.totalCapitalINR * 100;
                                          content = <span className={r.pnlPrevINR >= 0 ? 'profit-pos' : 'profit-neg'}>{fmt(toPrimary(r.pnlPrevINR))}<span className="pct-hint">{pctP >= 0 ? '+' : ''}{pctP.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span><FxHint inr={r.pnlPrevINR} /></span>;
                                      }
                                      break;
                                  case 'profit':
                                      const pctPr = r.profitAtTargetINR / r.totalCapitalINR * 100;
                                      content = <span className={r.profitAtTargetINR >= 0 ? 'profit-pos' : 'profit-neg'}>{fmt(toPrimary(r.profitAtTargetINR))}<span className="pct-hint">{pctPr >= 0 ? '+' : ''}{pctPr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span><FxHint inr={r.profitAtTargetINR} /></span>;
                                      break;
                              }
                              return <td key={c.key} style={{textAlign:'right'}}>{content}</td>;
                          })}
                      </tr>
                  ))}
              </tbody>
          </table>
        </div>
      </div>
      {/* Click outside to close col panel logic is global in simple HTML, here we can use backdrop or simple onMouseLeave or just toggle */}
      {isColPanelOpen && <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:99}} onClick={() => setIsColPanelOpen(false)}></div>}
    </div>
  );
}
