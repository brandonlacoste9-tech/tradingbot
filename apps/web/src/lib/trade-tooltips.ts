/**
 * Trade floor hover / tap tips — keep short, paper-honest.
 * Sync with Tips panel copy where possible.
 */
export const TRADE_TIPS = {
  paperOnly:
    "This desk is paper-only. Simulated fills only — not a live brokerage. No real money moves.",
  usRth:
    "US regular trading hours (approx 9:30–16:00 America/New_York). Outside RTH you can still practice paper; quotes may be last/delayed.",
  quotesAsOf:
    "When market data last refreshed on this page. Feeds can be delayed vs a live exchange. Not Level 2.",
  netLiq:
    "Net liquidation = cash + mark-to-market value of open paper positions. Simulated PaperSim book only.",
  cash: "Cash left in your paper book after fills. Not a real bank balance.",
  buyingPower:
    "How much paper buying power this sim book shows for new buys. Simplified paper rules — not a broker margin formula.",
  bookPnl:
    "Change in total book equity vs book start (Paper budget sets that start). Not a live day-trading P&L from an exchange.",
  openPnl:
    "Unrealized P&L on open paper positions at current marks. Zero if you have no positions.",
  paperBudget:
    "Resets or sizes your virtual bankroll ($10k–$100k or custom). Practice only — not a real deposit.",
  last:
    "Last/mark price from our market-data cascade (FMP / Yahoo / etc.). May be delayed. Used for aggressive vs passive fill rules.",
  chgPct:
    "Percent change vs prior close from the quote feed, when available. Blank means the feed did not send a change.",
  limit:
    "Your limit price. Buy at or above last = aggressive (instant paper fill after confirm). Buy below last = passive (sits in Orders).",
  tifDay:
    "Time in force: Day. Working paper orders expire when the America/New_York calendar day rolls past the create day. Not a full exchange calendar.",
  aggressivePassive:
    "Aggressive: buy limit ≥ last or sell ≤ last → PaperSim fills at last/mark after confirm. Passiveive: buy below / sell above → working until mark crosses, Day TIF ends, or you cancel. Not exchange matching.",
  reason:
    "Policy requires a short thesis. Teaches process — not optional fluff.",
  positions:
    "Open paper holdings. Tap a row to load that symbol and prep a sell on the ticket.",
  orders:
    "Working passive limits after you confirm. Cancel anytime. Fills when last/mark crosses your limit (paper rules).",
  fills:
    "PaperSim fills that already hit the book. Not live broker executions.",
  working:
    "This limit is resting in the paper working book. Cancel, wait for mark cross, or Day TIF expiry. Not on a real exchange.",
  cancel:
    "Cancel this paper working order. Does not affect a real brokerage account.",
  maxShares:
    "Rough max whole shares you can buy with current paper cash at this limit (after a small buffer).",
  estNotional:
    "Estimated cost = qty × limit. Checked against paper cash and policy size limits.",
} as const;

export type TradeTipId = keyof typeof TRADE_TIPS;
